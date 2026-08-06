<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Gpt\Jobs\GenerateGptRecommendationJob;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\BoundedContextBuilder;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createGptUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

function createGptJob(User $creator, DispatchStatus $status = DispatchStatus::Draft): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => 'JOB-'.uniqid(),
        'client' => 'Acme Corporation',
        'title' => 'Structural Crane Support',
        'site' => 'Makati City',
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(6),
        'priority' => DispatchPriority::Routine,
        'status' => $status,
        'created_by' => $creator->id,
        'version' => 1,
    ]);
}

it('allows authorized dispatcher to request GPT recommendation and queues background job', function (): void {
    Queue::fake();

    $dispatcher = createGptUser(RoleName::Dispatcher);
    $job = createGptJob($dispatcher, DispatchStatus::Draft);

    $this->actingAs($dispatcher)
        ->post('/operations/gpt-recommendations', [
            'subject_type' => (new DispatchJob)->getMorphClass(),
            'subject_id' => $job->id,
            'purpose' => 'dispatch_assignment',
        ])
        ->assertRedirect();

    $recommendation = GptRecommendation::query()->first();
    expect($recommendation)->not()->toBeNull()
        ->and($recommendation->requested_by)->toBe($dispatcher->id)
        ->and($recommendation->subject_id)->toBe($job->id)
        ->and($recommendation->purpose)->toBe('dispatch_assignment')
        ->and($recommendation->status)->toBe('draft');

    Queue::assertPushed(GenerateGptRecommendationJob::class);
});

it('prevents unauthorized field driver from requesting GPT recommendation', function (): void {
    $driver = createGptUser(RoleName::Driver);
    $dispatcher = createGptUser(RoleName::Dispatcher);
    $job = createGptJob($dispatcher, DispatchStatus::Draft);

    $this->actingAs($driver)
        ->post('/operations/gpt-recommendations', [
            'subject_type' => (new DispatchJob)->getMorphClass(),
            'subject_id' => $job->id,
            'purpose' => 'dispatch_assignment',
        ])
        ->assertStatus(403);
});

it('allows authorized dispatcher to accept valid GPT recommendation and record audit log', function (): void {
    $dispatcher = createGptUser(RoleName::Dispatcher);
    $job = createGptJob($dispatcher, DispatchStatus::Draft);

    $contextBuilder = app(BoundedContextBuilder::class);
    $context = $contextBuilder->buildForDispatchJob($job);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $context['context_hash'],
        'input_references' => [],
        'recommendation' => [
            'proposed_personnel' => [],
            'proposed_assets' => [],
        ],
        'conflicts' => [],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(15),
    ]);

    $this->actingAs($dispatcher)
        ->post("/operations/gpt-recommendations/{$recommendation->id}/accept")
        ->assertRedirect();

    $recommendation->refresh();
    expect($recommendation->status)->toBe('accepted')
        ->and($recommendation->decided_by)->toBe($dispatcher->id)
        ->and($recommendation->decided_at)->not()->toBeNull();

    expect(AuditEvent::query()->where('action', 'gpt.recommendation_accepted')->exists())->toBeTrue();
});

it('rejects acceptance of expired GPT recommendation after 15 minutes', function (): void {
    $dispatcher = createGptUser(RoleName::Dispatcher);
    $job = createGptJob($dispatcher, DispatchStatus::Draft);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'dummy_hash',
        'input_references' => [],
        'recommendation' => [],
        'conflicts' => [],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->subMinute(),
    ]);

    $this->actingAs($dispatcher)
        ->post("/operations/gpt-recommendations/{$recommendation->id}/accept")
        ->assertSessionHasErrors('gpt');

    $recommendation->refresh();
    expect($recommendation->status)->toBe('expired');
});

it('rejects acceptance when dispatch context hash changes (stale revalidation)', function (): void {
    $dispatcher = createGptUser(RoleName::Dispatcher);
    $job = createGptJob($dispatcher, DispatchStatus::Draft);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'outdated_hash_value',
        'input_references' => [],
        'recommendation' => [],
        'conflicts' => [],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(15),
    ]);

    $this->actingAs($dispatcher)
        ->post("/operations/gpt-recommendations/{$recommendation->id}/accept")
        ->assertSessionHasErrors('gpt');

    $recommendation->refresh();
    expect($recommendation->status)->toBe('stale');
});

it('allows human actor to reject GPT recommendation with optional reason', function (): void {
    $dispatcher = createGptUser(RoleName::Dispatcher);
    $job = createGptJob($dispatcher, DispatchStatus::Draft);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'some_hash',
        'input_references' => [],
        'recommendation' => [],
        'conflicts' => [],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(15),
    ]);

    $this->actingAs($dispatcher)
        ->post("/operations/gpt-recommendations/{$recommendation->id}/reject", [
            'reason' => 'Resource requested off shift',
        ])
        ->assertRedirect();

    $recommendation->refresh();
    expect($recommendation->status)->toBe('rejected')
        ->and($recommendation->decided_by)->toBe($dispatcher->id)
        ->and($recommendation->response_summary)->toBe('Resource requested off shift');

    expect(AuditEvent::query()->where('action', 'gpt.recommendation_rejected')->exists())->toBeTrue();
});
