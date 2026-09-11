<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Platform\Gpt\Actions\GenerateGptRecommendation;
use App\Platform\Gpt\Actions\RetryGptRecommendation;
use App\Platform\Gpt\Jobs\GenerateGptRecommendationJob;
use App\Platform\Gpt\Jobs\SweepProactiveGptRecommendationsJob;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\BoundedContextBuilder;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\PersonnelProfile;
use App\Platform\Identity\Models\User;
use App\Platform\Workspace\Events\WorkspaceUpdated;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Cache::flush();
    Queue::fake();
    OpenAiClientWrapper::fake();
    config(['services.openai.proactive_enabled' => true]);
    $this->owner = User::factory()->create(['is_active' => true]);
    $this->owner->syncRoles([RoleName::OperationsManager->value]);
    $this->dispatch = DispatchJob::query()->create([
        'reference' => 'PROACTIVE-001', 'title' => 'Planned lift', 'client' => 'Client',
        'site' => 'North yard', 'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(8),
        'priority' => DispatchPriority::Routine, 'status' => DispatchStatus::Draft,
        'created_by' => $this->owner->id,
    ]);
});

afterEach(fn () => OpenAiClientWrapper::resetFakes());

function sweepProactiveRecommendations(): void
{
    app()->call([new SweepProactiveGptRecommendationsJob, 'handle']);
}

test('scheduled incomplete allocation generates once without a browser action or assignment mutation', function (): void {
    sweepProactiveRecommendations();
    sweepProactiveRecommendations();
    expect(GptRecommendation::query()->count())->toBe(1)
        ->and($this->dispatch->personnelAssignments()->count())->toBe(0)
        ->and($this->dispatch->assetAssignments()->count())->toBe(0)
        ->and(Cache::get('gpt_rate_limit:system:'.now()->format('Y-m-d')))->toBe(1);
    Queue::assertPushed(GenerateGptRecommendationJob::class, 1);
});

test('automatic requests respect configuration owner authority and draft completeness', function (string $condition): void {
    match ($condition) {
        'disabled' => config(['services.openai.proactive_enabled' => false]),
        'inactive' => $this->owner->update(['is_active' => false]),
        'suspended' => $this->owner->update(['suspended_at' => now()]),
        'unauthorized' => $this->owner->syncRoles([RoleName::CraneOperator->value]),
        'unscheduled' => $this->dispatch->update(['scheduled_start' => null]),
        'invalid_schedule' => $this->dispatch->update(['scheduled_end' => now()]),
        'missing_site' => $this->dispatch->update(['site' => '']),
        'completed' => $this->dispatch->update(['status' => DispatchStatus::Completed]),
        'cancelled' => $this->dispatch->update(['status' => DispatchStatus::Cancelled]),
        'archived' => $this->dispatch->delete(),
        'circuit_breaker' => Cache::put('gpt_circuit_breaker_disabled', true),
        'rate_limit' => Cache::put('gpt_rate_limit:system:'.now()->format('Y-m-d'), 100),
    };
    sweepProactiveRecommendations();
    expect(GptRecommendation::query()->count())->toBe(0);
    Queue::assertNothingPushed();
})->with(['disabled', 'inactive', 'suspended', 'unauthorized', 'unscheduled', 'invalid_schedule', 'missing_site', 'completed', 'cancelled', 'archived', 'circuit_breaker', 'rate_limit']);

test('unchanged outcomes and expiry do not restart automatic generation', function (string $status): void {
    sweepProactiveRecommendations();
    GptRecommendation::query()->firstOrFail()->update(['status' => $status, 'expires_at' => now()->subMinute()]);
    $this->travel(20)->minutes();
    $this->dispatch->increment('version');
    sweepProactiveRecommendations();
    expect(GptRecommendation::query()->count())->toBe(1);
})->with(['pending_review', 'failed', 'rejected', 'accepted', 'expired', 'stale']);

test('changed requirements regenerate after cooldown and manual requests reuse automatic work', function (): void {
    sweepProactiveRecommendations();
    $first = GptRecommendation::query()->firstOrFail();
    $manual = app(GenerateGptRecommendation::class)->handle($this->owner, $this->dispatch);
    expect($manual->id)->toBe($first->id);
    $first->update(['status' => 'pending_review', 'expires_at' => now()->addMinutes(15)]);
    $this->dispatch->update(['requirements' => ['capacity_tonnes' => 100]]);
    sweepProactiveRecommendations();
    expect(GptRecommendation::query()->count())->toBe(1);
    $this->travel(6)->minutes();
    sweepProactiveRecommendations();
    expect(GptRecommendation::query()->count())->toBe(2);
    Queue::assertPushed(GenerateGptRecommendationJob::class, 2);
});

/** @return array{User, OperationalAsset} */
function proactiveAllocation(DispatchJob $dispatch, User $owner): array
{
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    PersonnelProfile::query()->create(['user_id' => $operator->id, 'availability_status' => 'available']);
    PersonnelCredential::query()->create([
        'user_id' => $operator->id, 'kind' => 'driver_license', 'credential_number' => 'TEST-123',
        'credential_type' => 'Professional License', 'status' => 'active',
        'issued_at' => now()->subYear(), 'expires_at' => now()->addYear(),
    ]);
    $asset = OperationalAsset::query()->create(['code' => 'AUTO-TRUCK', 'name' => 'Truck', 'kind' => 'truck', 'status' => AssetStatus::Available]);
    $asset->inspections()->create(['technician_id' => $owner->id, 'type' => 'daily_safety', 'result' => 'passed', 'checklist' => [], 'completed_at' => now()->subDay()]);
    $dispatch->personnelAssignments()->create(['user_id' => $operator->id, 'assignment_type' => 'driver', 'assigned_by' => $owner->id, 'response_status' => 'accepted']);
    $dispatch->assetAssignments()->create(['operational_asset_id' => $asset->id, 'assignment_type' => 'truck', 'assigned_by' => $owner->id]);

    return [$operator, $asset];
}

test('healthy allocation is quiet but resource conflicts automatically generate advisory', function (string $conflict): void {
    [$operator, $asset] = proactiveAllocation($this->dispatch, $this->owner);
    sweepProactiveRecommendations();
    expect(GptRecommendation::query()->count())->toBe(0);
    match ($conflict) {
        'asset' => $asset->update(['status' => AssetStatus::Unavailable]),
        'personnel' => $operator->personnelProfile()->update(['availability_status' => 'on_leave']),
        'rejection' => $this->dispatch->personnelAssignments()->update(['response_status' => 'rejected']),
        'active_asset' => (function () use ($asset): void {
            $this->dispatch->update(['status' => DispatchStatus::Working]);
            $asset->update(['status' => AssetStatus::Unavailable]);
        })(),
    };
    sweepProactiveRecommendations();
    expect(GptRecommendation::query()->count())->toBe(1)
        ->and($this->dispatch->assetAssignments()->count())->toBe(1);
})->with(['asset', 'personnel', 'rejection', 'active_asset']);

test('resource availability changes refresh suggestions and expired failures allow explicit retry', function (): void {
    sweepProactiveRecommendations();
    $first = GptRecommendation::query()->firstOrFail();
    $first->update(['status' => 'failed']);
    $retry = app(RetryGptRecommendation::class)->handle($this->owner, $first);
    expect($retry->id)->not->toBe($first->id)->and($retry->retry_of_id)->toBe($first->id);
    $retry->update(['status' => 'pending_review', 'expires_at' => now()->addMinutes(15)]);
    OperationalAsset::query()->create(['code' => 'NEW-TRUCK', 'name' => 'Truck', 'kind' => 'truck', 'status' => AssetStatus::Available]);
    $this->travel(6)->minutes();
    sweepProactiveRecommendations();
    expect(GptRecommendation::query()->count())->toBe(3);
});

test('automatic worker rechecks context and authority before spending a provider request', function (string $condition): void {
    sweepProactiveRecommendations();
    $recommendation = GptRecommendation::query()->firstOrFail();
    $context = app(BoundedContextBuilder::class)->buildForDispatchJob($this->dispatch);
    match ($condition) {
        'access' => $this->owner->syncRoles([RoleName::CraneOperator->value]),
        'inactive' => $this->owner->update(['is_active' => false]),
        'circuit' => Cache::put('gpt_circuit_breaker_disabled', true),
        'context' => $this->dispatch->update(['requirements' => ['Larger crane']]),
        'completed' => $this->dispatch->update(['status' => DispatchStatus::Completed]),
        'resolved' => proactiveAllocation($this->dispatch, $this->owner),
    };
    app()->call([new GenerateGptRecommendationJob($recommendation->id, $context['context'], true), 'handle']);
    expect(OpenAiClientWrapper::recordedRequests())->toBeEmpty()
        ->and($recommendation->fresh()->status->value)->toBe('failed');
})->with(['access', 'inactive', 'circuit', 'context', 'completed', 'resolved']);

test('automatic worker finishes with a workspace notification and still awaits human action', function (): void {
    sweepProactiveRecommendations();
    Event::fake([WorkspaceUpdated::class]);
    $recommendation = GptRecommendation::query()->firstOrFail();
    $context = app(BoundedContextBuilder::class)->buildForDispatchJob($this->dispatch);
    app()->call([new GenerateGptRecommendationJob($recommendation->id, $context['context'], true), 'handle']);
    expect($recommendation->fresh()->status->value)->toBe('pending_review')
        ->and($this->dispatch->assetAssignments()->count())->toBe(0)
        ->and($this->dispatch->personnelAssignments()->count())->toBe(0);
    Event::assertDispatched(WorkspaceUpdated::class, fn (WorkspaceUpdated $event): bool => $event->resourceType === 'gpt');
});

test('bounded sweep rotates through jobs instead of starving later dispatches', function (): void {
    config(['services.openai.proactive_batch_size' => 1]);
    $second = $this->dispatch->replicate();
    $second->reference = 'PROACTIVE-002';
    $second->save();
    sweepProactiveRecommendations();
    expect(GptRecommendation::query()->count())->toBe(1);
    sweepProactiveRecommendations();
    expect(GptRecommendation::query()->count())->toBe(2)
        ->and(GptRecommendation::query()->where('subject_id', $second->id)->exists())->toBeTrue();
});

test('enqueue failure after commit leaves a retryable outcome and releases the unused reservation', function (): void {
    Bus::partialMock()->shouldReceive('dispatch')->once()->andThrow(new RuntimeException('Queue unavailable'));
    expect(fn () => app(GenerateGptRecommendation::class)->handle($this->owner, $this->dispatch))
        ->toThrow(RuntimeException::class, 'Queue unavailable');
    expect(GptRecommendation::query()->sole()->status->value)->toBe('failed')
        ->and(Cache::get('gpt_rate_limit:system:'.now()->format('Y-m-d')))->toBe(0);
});

test('worker failures after claiming a request do not refund spent quota or overwrite its result', function (): void {
    Bus::partialMock()->shouldReceive('dispatch')->once()->andReturnUsing(function (GenerateGptRecommendationJob $job): void {
        GptRecommendation::query()->findOrFail($job->recommendationId)->update(['status' => 'pending_review']);
        throw new RuntimeException('Failure after provider processing');
    });
    expect(fn () => app(GenerateGptRecommendation::class)->handle($this->owner, $this->dispatch))->toThrow(RuntimeException::class);
    expect(GptRecommendation::query()->sole()->status->value)->toBe('pending_review')
        ->and(Cache::get('gpt_rate_limit:system:'.now()->format('Y-m-d')))->toBe(1);
});

test('canonical mandatory slots trigger suggestions even with existing healthy legacy resources', function (): void {
    proactiveAllocation($this->dispatch, $this->owner);
    $handoff = DispatchHandoff::query()->create([
        'workspace_key' => 'operations', 'source_type' => 'legacy_dispatch_job',
        'source_id' => $this->dispatch->id, 'source_reference' => $this->dispatch->reference,
        'legacy_dispatch_job_id' => $this->dispatch->id, 'created_by' => $this->owner->id,
        'compatibility_state' => 'v2_command',
    ]);
    $attempt = DispatchExecutionAttempt::query()->create([
        'handoff_id' => $handoff->id, 'workspace_key' => 'operations', 'attempt_number' => 1,
        'legacy_dispatch_job_id' => $this->dispatch->id, 'status' => 'draft', 'version' => 1,
        'scheduled_start' => $this->dispatch->scheduled_start, 'scheduled_end' => $this->dispatch->scheduled_end,
        'created_by' => $this->owner->id,
    ]);
    DispatchPlanVersion::query()->create([
        'attempt_id' => $attempt->id, 'workspace_key' => 'operations', 'version' => 1, 'status' => 'draft',
        'content_hash' => hash('sha256', 'proactive-plan'),
        'snapshot' => ['mandatory_assignments' => [['slot' => 'operator', 'assignment_type' => 'crane_operator']]],
        'scheduled_start' => $this->dispatch->scheduled_start, 'scheduled_end' => $this->dispatch->scheduled_end,
        'created_by' => $this->owner->id,
    ]);
    sweepProactiveRecommendations();
    expect(GptRecommendation::query()->count())->toBe(1);
    Queue::assertPushed(GenerateGptRecommendationJob::class, fn (GenerateGptRecommendationJob $job): bool => $job->boundedContext['plan_requirements']['mandatory_assignments'][0]['assignment_type'] === 'crane_operator');
});

test('a failed job does not prevent other dispatches receiving suggestions', function (): void {
    $second = $this->dispatch->replicate();
    $second->reference = 'PROACTIVE-SECOND';
    $second->save();
    Bus::partialMock()->shouldReceive('dispatch')->once()->andThrow(new RuntimeException('Queue interruption'));
    Bus::partialMock()->shouldReceive('dispatch')->once()->andReturnNull();
    sweepProactiveRecommendations();
    expect(GptRecommendation::query()->where('subject_id', $second->id)->exists())->toBeTrue();
});
