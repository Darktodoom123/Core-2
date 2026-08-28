<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Jobs\GenerateGptRecommendationJob;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\BoundedContextBuilder;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    OpenAiClientWrapper::fake();
});

afterEach(function (): void {
    OpenAiClientWrapper::resetFakes();
});

function gptUser(RoleName $role): User
{
    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([$role->value]);

    return $user;
}

function gptDispatchJob(User $creator): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => 'JOB-GPT-001',
        'client' => 'Acme Crane Operations',
        'title' => 'Lift operation at North Yard (Contact: john.doe@example.com / 555-019-2831)',
        'site' => 'North Yard, Pier 4',
        'site_notes' => 'Location: 14.5995, 120.9842. Secret Key: ABC123XYZ',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $creator->id,
    ]);
}

test('authorized dispatcher can initiate async gpt recommendation request', function (): void {
    Queue::fake();

    $dispatcher = gptUser(RoleName::OperationsManager);
    $job = gptDispatchJob($dispatcher);

    $response = $this->actingAs($dispatcher)->post('/operations/gpt-recommendations', [
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'purpose' => 'dispatch_assignment',
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('flash.success');

    $this->assertDatabaseHas('gpt_recommendations', [
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'status' => 'draft',
        'model' => 'gpt-5-mini',
    ]);

    Queue::assertPushed(GenerateGptRecommendationJob::class);
});

test('unauthorized user cannot request gpt recommendation', function (): void {
    $driver = gptUser(RoleName::Driver);
    $job = gptDispatchJob($driver);

    $response = $this->actingAs($driver)->post('/operations/gpt-recommendations', [
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'purpose' => 'dispatch_assignment',
    ]);

    $response->assertForbidden();
});

test('async job processes context redaction and generates structured recommendation via fake client', function (): void {
    $dispatcher = gptUser(RoleName::OperationsManager);
    $job = gptDispatchJob($dispatcher);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'dummy-hash',
        'input_references' => ['user_ids' => [], 'asset_ids' => []],
        'recommendation' => [],
        'model' => 'gpt-5-mini',
        'status' => 'draft',
        'prompt_summary' => 'Dispatch test prompt',
    ]);

    $jobHandler = new GenerateGptRecommendationJob($recommendation->id, ['job' => ['id' => $job->id]]);
    $jobHandler->handle(app(OpenAiClientWrapper::class), app(RecordAuditEvent::class));

    $recommendation->refresh();

    expect($recommendation->status->value)->toBe('pending_review')
        ->and($recommendation->expires_at)->not->toBeNull()
        ->and($recommendation->expires_at->isFuture())->toBeTrue()
        ->and($recommendation->cost_usd)->toBeGreaterThan(0)
        ->and($recommendation->recommendation)->toHaveKey('summary')
        ->and($recommendation->recommendation)->toHaveKey('proposed_personnel')
        ->and($recommendation->recommendation)->toHaveKey('proposed_assets');

    $this->assertDatabaseHas('audit_events', [
        'action' => 'gpt.recommendation_generated',
        'actor_id' => $dispatcher->id,
    ]);
});

test('provider output is redacted before recommendation persistence', function (): void {
    $dispatcher = gptUser(RoleName::OperationsManager);
    $job = gptDispatchJob($dispatcher);
    $context = app(BoundedContextBuilder::class)->buildForDispatchJob($job);

    OpenAiClientWrapper::fake([
        'recommendation' => [
            'summary' => "Use {$job->title} at {$job->site}; contact jane@example.com 555-019-2831.",
            'proposed_personnel' => [],
            'proposed_assets' => [],
            'reasons' => ['Coordinates 14.5995, 120.9842 and token sk-live-secret-value.'],
            'assumptions' => ['Provider raw response should never be stored.'],
        ],
    ]);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $context['context_hash'],
        'input_references' => $context['input_references'],
        'recommendation' => [],
        'model' => 'gpt-5-mini',
        'status' => 'draft',
    ]);

    (new GenerateGptRecommendationJob($recommendation->id, $context['context']))->handle(
        app(OpenAiClientWrapper::class),
        app(RecordAuditEvent::class),
    );

    $recommendation->refresh();
    $serialized = json_encode($recommendation->recommendation, JSON_THROW_ON_ERROR);

    expect($serialized)
        ->not->toContain($job->title)
        ->not->toContain($job->site)
        ->not->toContain('jane@example.com')
        ->not->toContain('555-019-2831')
        ->not->toContain('14.5995, 120.9842')
        ->not->toContain('sk-live-secret-value');
});
