<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Planning\Models\ProjectPlan;
use App\Modules\Dispatch\Planning\Models\ProjectShift;
use App\Platform\Gpt\Actions\GenerateGptRecommendation;
use App\Platform\Gpt\Jobs\GenerateGptRecommendationJob;
use App\Platform\Gpt\Jobs\SweepProactiveGptRecommendationsJob;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Models\GptRecommendationMetric;
use App\Platform\Gpt\Services\BlockerAdviceReview;
use App\Platform\Gpt\Services\BlockerResolutionContextBuilder;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\PersonnelProfile;
use App\Platform\Identity\Models\User;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Cache::flush();
    Queue::fake();
    OpenAiClientWrapper::fake();
    config(['services.openai.blocker_resolution_enabled' => true]);
    $this->dispatcher = User::factory()->create(['is_active' => true]);
    $this->dispatcher->syncRoles([RoleName::OperationsManager->value]);
    $this->job = DispatchJob::query()->create([
        'reference' => 'BLOCKER-001', 'title' => 'Planned lift', 'client' => 'Client', 'site' => 'North yard',
        'scheduled_start' => now()->addDay(), 'scheduled_end' => now()->addDay()->addHours(8),
        'priority' => DispatchPriority::Routine, 'status' => DispatchStatus::Draft,
        'created_by' => $this->dispatcher->id, 'version' => 1,
    ]);
});

afterEach(fn () => OpenAiClientWrapper::resetFakes());

function eligibleBlockerOperator(): User
{
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    PersonnelProfile::query()->create(['user_id' => $operator->id, 'availability_status' => 'available']);
    PersonnelCredential::query()->create([
        'user_id' => $operator->id, 'kind' => 'operator_certification',
        'credential_number' => 'BLOCKER-CERT-'.$operator->id, 'credential_type' => 'Operator', 'status' => 'active',
        'issued_at' => now()->subYear(), 'expires_at' => now()->addYear(),
    ]);

    return $operator;
}

test('blocker advice uses the typed role deficit instead of a hard-coded crane operator', function (): void {
    $this->job->update(['resource_requirements' => [
        'personnel' => ['driver' => 1],
        'assets' => ['truck' => 1],
    ]]);

    $context = app(BlockerResolutionContextBuilder::class)->buildForDispatchJob($this->job);

    expect($context['context']['blocker']['code'])->toBe('missing_personnel')
        ->and($context['context']['blocker']['assignment_type'])->toBe('driver')
        ->and($context['context']['blocker']['evidence']['required_count'])->toBe(1);
});

test('no eligible option yields useful deterministic advice without a model call or quota use', function (): void {
    $rec = app(GenerateGptRecommendation::class)->handle($this->dispatcher, $this->job, 'dispatch_blocker_resolution');

    expect($rec->status->value)->toBe('pending_review')
        ->and($rec->model)->toBe('rules')
        ->and($rec->recommendation['blocker']['code'])->toBe('missing_personnel')
        ->and($rec->recommendation['options'])->toBe([])
        ->and(OpenAiClientWrapper::recordedRequests())->toBeEmpty()
        ->and(Cache::get('gpt_rate_limit:system:'.now()->format('Y-m-d')))->toBeNull();
    Queue::assertNothingPushed();
});

test('unrecorded availability is explained in plain language', function (): void {
    $operator = eligibleBlockerOperator();
    $operator->personnelProfile()->delete();
    $rec = app(GenerateGptRecommendation::class)->handle($this->dispatcher, $this->job, 'dispatch_blocker_resolution');
    $context = app(BlockerResolutionContextBuilder::class)->buildForDispatchJob($this->job);

    app()->call([new GenerateGptRecommendationJob($rec->id, $context['context']), 'handle']);

    expect($rec->fresh()->recommendation['options'][0]['explanation'])
        ->toBe('Availability is not recorded. Confirm it before assigning.');
});

test('vetted option is reviewed and adopted only through the normal assignment route', function (): void {
    $operator = eligibleBlockerOperator();
    $rec = app(GenerateGptRecommendation::class)->handle($this->dispatcher, $this->job, 'dispatch_blocker_resolution');
    expect($rec->status->value)->toBe('pending_review')
        ->and($rec->model)->toBe('rules')
        ->and($this->job->personnelAssignments()->count())->toBe(0)
        ->and($rec->recommendation['options'][0]['candidate_id'])->toBe($operator->id)
        ->and($rec->recommendation['options'][0]['resource_kind'])->toBe('personnel')
        ->and(OpenAiClientWrapper::recordedRequests())->toBeEmpty()
        ->and(Cache::get('gpt_rate_limit:system:'.now()->format('Y-m-d')))->toBeNull();
    Queue::assertNothingPushed();

    $prefill = app(BlockerAdviceReview::class)->prefill($this->dispatcher, $this->job, $rec->id, 1);
    expect($prefill['candidate']['id'])->toBe($operator->id);
    $this->actingAs($this->dispatcher)
        ->get("/operations/dispatch-jobs/{$this->job->id}?advice_id={$rec->id}&option_id=1")
        ->assertInertia(fn ($page) => $page->where('advice_prefill.candidate.id', $operator->id));

    $this->actingAs($this->dispatcher)->post("/operations/dispatch-jobs/{$this->job->id}/assignments", [
        'personnel' => [['user_id' => $operator->id, 'assignment_type' => 'crane_operator']],
        'version' => $this->job->version,
        'advice_id' => $rec->id,
        'option_id' => 1,
    ])->assertSessionHasNoErrors()->assertRedirect();

    expect($this->job->personnelAssignments()->where('user_id', $operator->id)->exists())->toBeTrue()
        ->and($rec->fresh()->status->value)->toBe('accepted')
        ->and(GptRecommendationMetric::query()->where('recommendation_id', $rec->id)->where('event', 'adopted')->exists())->toBeTrue()
        ->and(GptRecommendationMetric::query()->where('recommendation_id', $rec->id)->where('event', 'blocker_resolved')->exists())->toBeTrue();
});

test('changed candidate eligibility stops queued advice before an OpenAI request', function (): void {
    $operator = eligibleBlockerOperator();
    eligibleBlockerOperator();
    $rec = app(GenerateGptRecommendation::class)->handle($this->dispatcher, $this->job, 'dispatch_blocker_resolution');
    $context = app(BlockerResolutionContextBuilder::class)->buildForDispatchJob($this->job);
    $operator->personnelProfile()->update(['availability_status' => 'on_leave']);

    app()->call([new GenerateGptRecommendationJob($rec->id, $context['context']), 'handle']);

    expect($rec->fresh()->status->value)->toBe('failed')
        ->and(OpenAiClientWrapper::recordedRequests())->toBeEmpty()
        ->and(app(BlockerAdviceReview::class)->prefill($this->dispatcher, $this->job, $rec->id, 1))->toBeNull();
});

test('invalid model option IDs cannot become reviewable advice', function (): void {
    eligibleBlockerOperator();
    eligibleBlockerOperator();
    OpenAiClientWrapper::fake(['summary' => 'Use an unknown resource', 'options' => [['id' => 99, 'explanation' => 'Unknown']]]);
    $rec = app(GenerateGptRecommendation::class)->handle($this->dispatcher, $this->job, 'dispatch_blocker_resolution');
    $context = app(BlockerResolutionContextBuilder::class)->buildForDispatchJob($this->job);

    app()->call([new GenerateGptRecommendationJob($rec->id, $context['context']), 'handle']);

    expect($rec->fresh()->status->value)->toBe('failed');
});

test('unsupported model evidence is discarded before review', function (): void {
    eligibleBlockerOperator();
    eligibleBlockerOperator();
    OpenAiClientWrapper::fake(['options' => [['id' => 1, 'focus' => 'lifting_capacity']]]);
    $rec = app(GenerateGptRecommendation::class)->handle($this->dispatcher, $this->job, 'dispatch_blocker_resolution');
    $context = app(BlockerResolutionContextBuilder::class)->buildForDispatchJob($this->job);

    app()->call([new GenerateGptRecommendationJob($rec->id, $context['context']), 'handle']);

    expect($rec->fresh()->status->value)->toBe('failed');
});

test('automatic checks deduplicate the same blocker and refresh when options change', function (): void {
    eligibleBlockerOperator();
    app()->call([new SweepProactiveGptRecommendationsJob, 'handle']);
    app()->call([new SweepProactiveGptRecommendationsJob, 'handle']);
    expect(GptRecommendation::query()->count())->toBe(1)
        ->and(GptRecommendation::query()->sole()->purpose)->toBe('dispatch_blocker_resolution');

    $first = GptRecommendation::query()->sole();
    $first->update(['status' => 'pending_review', 'expires_at' => now()->addMinutes(15)]);
    $firstOptionId = $first->input_references['user_ids'][0];
    User::query()->findOrFail($firstOptionId)->personnelProfile()->update(['availability_status' => 'on_leave']);
    app()->call([new SweepProactiveGptRecommendationsJob, 'handle']);
    expect(GptRecommendation::query()->count())->toBe(2);
});

test('failed automatic advice retries after the configured cooldown', function (): void {
    eligibleBlockerOperator();
    eligibleBlockerOperator();
    OpenAiClientWrapper::fake(['options' => [['id' => 99, 'focus' => 'availability']]]);
    $first = app(GenerateGptRecommendation::class)->handle($this->dispatcher, $this->job, 'dispatch_blocker_resolution', automatic: true);
    $context = app(BlockerResolutionContextBuilder::class)->buildForDispatchJob($this->job);
    app()->call([new GenerateGptRecommendationJob($first->id, $context['context'], true), 'handle']);
    expect($first->fresh()->status->value)->toBe('failed');

    $same = app(GenerateGptRecommendation::class)->handle($this->dispatcher, $this->job, 'dispatch_blocker_resolution', automatic: true);
    expect($same->id)->toBe($first->id);

    $first->forceFill(['created_at' => now()->subMinutes(6)])->save();
    $retried = app(GenerateGptRecommendation::class)->handle($this->dispatcher, $this->job, 'dispatch_blocker_resolution', automatic: true);
    expect($retried->id)->not->toBe($first->id);
});

test('stale advice cannot prefill or be directly accepted', function (): void {
    $operator = eligibleBlockerOperator();
    $rec = app(GenerateGptRecommendation::class)->handle($this->dispatcher, $this->job, 'dispatch_blocker_resolution');
    $context = app(BlockerResolutionContextBuilder::class)->buildForDispatchJob($this->job);
    app()->call([new GenerateGptRecommendationJob($rec->id, $context['context']), 'handle']);

    $this->actingAs($this->dispatcher)->post("/operations/gpt-recommendations/{$rec->id}/accept", [
        'selected_personnel_ids' => [$operator->id],
    ])->assertSessionHasErrors();
    expect($this->job->personnelAssignments()->count())->toBe(0);
    $this->job->increment('version');
    expect(app(BlockerAdviceReview::class)->prefill($this->dispatcher, $this->job, $rec->id, 1))->toBeNull();
});

test('advice review rejects users without dispatch access', function (): void {
    eligibleBlockerOperator();
    $rec = app(GenerateGptRecommendation::class)->handle($this->dispatcher, $this->job, 'dispatch_blocker_resolution');
    $context = app(BlockerResolutionContextBuilder::class)->buildForDispatchJob($this->job);
    app()->call([new GenerateGptRecommendationJob($rec->id, $context['context']), 'handle']);

    $outsider = User::factory()->create(['is_active' => true]);
    expect(app(BlockerAdviceReview::class)->prefill($outsider, $this->job, $rec->id, 1))->toBeNull();
    $this->actingAs($outsider)->get("/operations/dispatch-jobs/{$this->job->id}?advice_id={$rec->id}&option_id=1")
        ->assertNotFound();
});

test('project shifts use coverage guidance and never queue blocker AI', function (): void {
    $plan = ProjectPlan::query()->create([
        'source_reference' => 'BLOCKER-PROJECT', 'name' => 'Project', 'client' => 'Client',
        'site' => 'North yard', 'created_by' => $this->dispatcher->id,
    ]);
    $phase = $plan->phases()->create([
        'name' => 'Lift phase', 'kind' => 'operations',
        'starts_at' => now(), 'ends_at' => now()->addMonth(),
        'coverage' => ['crane_operator' => 1],
    ]);
    ProjectShift::query()->create(['project_phase_id' => $phase->id, 'dispatch_job_id' => $this->job->id]);

    expect(app(BlockerResolutionContextBuilder::class)->buildForDispatchJob($this->job))->toBeNull();
    app()->call([new SweepProactiveGptRecommendationsJob, 'handle']);
    expect(GptRecommendation::query()->count())->toBe(0);
    $view = OperationsWorkspaceViewModel::job($this->job->load('projectShift.phase'));
    expect($view['project_coverage_url'])->toContain('project='.$plan->id);
});

test('ineligible assigned personnel is replaced through reassignment with advice attribution', function (): void {
    $old = User::factory()->create(['is_active' => true]);
    $old->syncRoles([RoleName::CraneOperator->value]);
    $assignment = $this->job->personnelAssignments()->create([
        'user_id' => $old->id, 'assignment_type' => 'crane_operator',
        'assigned_by' => $this->dispatcher->id, 'response_status' => 'accepted',
    ]);
    $replacement = eligibleBlockerOperator();
    $rec = app(GenerateGptRecommendation::class)->handle($this->dispatcher, $this->job, 'dispatch_blocker_resolution');
    $context = app(BlockerResolutionContextBuilder::class)->buildForDispatchJob($this->job);
    expect($context['context']['blocker']['action'])->toBe('reassign');
    app()->call([new GenerateGptRecommendationJob($rec->id, $context['context']), 'handle']);

    $prefill = app(BlockerAdviceReview::class)->prefill($this->dispatcher, $this->job, $rec->id, 1);
    expect($prefill['replace_assignment_id'])->toBe($assignment->id);
    $this->actingAs($this->dispatcher)->post("/operations/dispatch-jobs/{$this->job->id}/reassign", [
        'end_personnel_assignment_ids' => [$assignment->id],
        'personnel' => [['user_id' => $replacement->id, 'assignment_type' => 'crane_operator']],
        'version' => $this->job->version,
        'advice_id' => $rec->id, 'option_id' => 1,
    ])->assertSessionHasNoErrors()->assertRedirect();

    expect($assignment->fresh()->active_until)->not->toBeNull()
        ->and($this->job->personnelAssignments()->open()->where('user_id', $replacement->id)->exists())->toBeTrue()
        ->and($rec->fresh()->status->value)->toBe('accepted');
});

test('an edited selection saves normally but is not counted as AI adoption', function (): void {
    eligibleBlockerOperator();
    $chosen = eligibleBlockerOperator();
    $rec = app(GenerateGptRecommendation::class)->handle($this->dispatcher, $this->job, 'dispatch_blocker_resolution');
    $context = app(BlockerResolutionContextBuilder::class)->buildForDispatchJob($this->job);
    app()->call([new GenerateGptRecommendationJob($rec->id, $context['context']), 'handle']);
    $suggested = $rec->fresh()->recommendation['options'][0]['candidate_id'];
    expect($chosen->id)->not->toBe($suggested);

    $this->actingAs($this->dispatcher)->post("/operations/dispatch-jobs/{$this->job->id}/assignments", [
        'personnel' => [['user_id' => $chosen->id, 'assignment_type' => 'crane_operator']],
        'version' => $this->job->version,
        'advice_id' => $rec->id, 'option_id' => 1,
    ])->assertSessionHasNoErrors();

    expect($this->job->personnelAssignments()->open()->where('user_id', $chosen->id)->exists())->toBeTrue()
        ->and($rec->fresh()->status->value)->toBe('stale');
});
