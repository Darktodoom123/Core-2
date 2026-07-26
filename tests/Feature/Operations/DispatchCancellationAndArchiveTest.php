<?php

use App\Enums\AssetStatus;
use App\Enums\DispatchPriority;
use App\Enums\DispatchStatus;
use App\Enums\RoleName;
use App\Models\AuditEvent;
use App\Models\DispatchAssetAssignment;
use App\Models\DispatchJob;
use App\Models\DispatchPersonnelAssignment;
use App\Models\OperationalAsset;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createTestUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

function createTestJob(User $creator, DispatchStatus $status = DispatchStatus::Draft): DispatchJob
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

it('allows authorized user to cancel a job with a required reason and closes active assignments', function () {
    $dispatcher = createTestUser(RoleName::Dispatcher);
    $driver = createTestUser(RoleName::Driver);
    $asset = OperationalAsset::query()->create([
        'code' => 'TR-99',
        'name' => 'Heavy Hauler',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);

    $job = createTestJob($dispatcher, DispatchStatus::Dispatched);

    $personnelAssignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHour(),
        'active_until' => null,
    ]);

    $assetAssignment = DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'truck',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHour(),
        'active_until' => null,
    ]);

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/cancel", [
        'reason' => 'Client emergency cancellation request',
        'version' => 1,
    ]);

    $response->assertRedirect("/operations/dispatch-jobs/{$job->id}");
    $response->assertSessionHas('flash.tone', 'warning');

    $job->refresh();
    expect($job->status)->toBe(DispatchStatus::Cancelled)
        ->and($job->cancelled_by)->toBe($dispatcher->id)
        ->and($job->cancellation_reason)->toBe('Client emergency cancellation request')
        ->and($job->version)->toBe(2);

    expect($personnelAssignment->fresh()->active_until)->not->toBeNull()
        ->and($assetAssignment->fresh()->active_until)->not->toBeNull();

    $audit = AuditEvent::query()
        ->where('subject_type', DispatchJob::class)
        ->where('subject_id', $job->id)
        ->where('action', 'dispatch.cancelled')
        ->latest('id')
        ->first();

    expect($audit)->not->toBeNull()
        ->and($audit->reason)->toBe('Client emergency cancellation request')
        ->and($audit->actor_id)->toBe($dispatcher->id);
});

it('rejects cancellation without a reason', function () {
    $dispatcher = createTestUser(RoleName::Dispatcher);
    $job = createTestJob($dispatcher, DispatchStatus::Scheduled);

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/cancel", [
        'reason' => '   ',
        'version' => 1,
    ]);

    $response->assertSessionHasErrors(['reason']);
    expect($job->fresh()->status)->toBe(DispatchStatus::Scheduled);
});

it('prevents cancellation of completed or already cancelled jobs', function () {
    $dispatcher = createTestUser(RoleName::Dispatcher);
    $completedJob = createTestJob($dispatcher, DispatchStatus::Completed);
    $cancelledJob = createTestJob($dispatcher, DispatchStatus::Cancelled);

    $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$completedJob->id}/cancel", [
        'reason' => 'Trying to cancel completed job',
        'version' => 1,
    ])->assertSessionHasErrors(['status']);

    $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$cancelledJob->id}/cancel", [
        'reason' => 'Trying to cancel cancelled job again',
        'version' => 1,
    ])->assertSessionHasErrors(['status']);
});

it('prevents unauthorized user from cancelling a job', function () {
    $driver = createTestUser(RoleName::Driver);
    $dispatcher = createTestUser(RoleName::Dispatcher);
    $job = createTestJob($dispatcher, DispatchStatus::Scheduled);

    $this->actingAs($driver)->post("/operations/dispatch-jobs/{$job->id}/cancel", [
        'reason' => 'Unauthorized driver attempt',
        'version' => 1,
    ])->assertForbidden();
});

it('restricts reopen, archive, and restore to their administrative capabilities', function () {
    $driver = createTestUser(RoleName::Driver);
    $dispatcher = createTestUser(RoleName::Dispatcher);
    $manager = createTestUser(RoleName::OperationsManager);
    $cancelledJob = createTestJob($dispatcher, DispatchStatus::Cancelled);
    $draftJob = createTestJob($dispatcher, DispatchStatus::Draft);

    $this->actingAs($driver)->post("/operations/dispatch-jobs/{$cancelledJob->id}/reopen", [
        'reason' => 'Unauthorized reopen',
        'version' => 1,
    ])->assertForbidden();

    $this->actingAs($manager)->post("/operations/dispatch-jobs/{$draftJob->id}/archive", [
        'reason' => 'Unauthorized archive',
    ])->assertForbidden();

    $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$draftJob->id}/restore", [
        'reason' => 'Unauthorized restore',
    ])->assertForbidden();

    expect($cancelledJob->fresh()->status)->toBe(DispatchStatus::Cancelled)
        ->and($draftJob->fresh()->trashed())->toBeFalse();
});

it('rejects cancellation when the optimistic version is stale', function () {
    $dispatcher = createTestUser(RoleName::Dispatcher);
    $job = createTestJob($dispatcher, DispatchStatus::Draft);

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/cancel", [
        'reason' => 'Stale attempt',
        'version' => 999,
    ]);

    $response->assertSessionHasErrors(['version']);
    expect($job->fresh()->status)->toBe(DispatchStatus::Draft);
});

it('allows an operations manager to reopen a cancelled job back to draft', function () {
    $dispatcher = createTestUser(RoleName::Dispatcher);
    $manager = createTestUser(RoleName::OperationsManager);

    $job = createTestJob($dispatcher, DispatchStatus::Cancelled);
    $job->update([
        'cancelled_by' => $dispatcher->id,
        'cancellation_reason' => 'Weather warning',
        'version' => 2,
    ]);

    $response = $this->actingAs($manager)->post("/operations/dispatch-jobs/{$job->id}/reopen", [
        'reason' => 'Weather cleared up',
        'version' => 2,
    ]);

    $response->assertRedirect("/operations/dispatch-jobs/{$job->id}");
    $response->assertSessionHas('flash.tone', 'success');

    $job->refresh();
    expect($job->status)->toBe(DispatchStatus::Draft)
        ->and($job->cancelled_by)->toBeNull()
        ->and($job->cancellation_reason)->toBeNull()
        ->and($job->version)->toBe(3);

    $audit = AuditEvent::query()
        ->where('subject_type', DispatchJob::class)
        ->where('subject_id', $job->id)
        ->where('action', 'dispatch.reopened')
        ->first();

    expect($audit)->not->toBeNull()
        ->and($audit->actor_id)->toBe($manager->id)
        ->and($audit->reason)->toBe('Weather cleared up');
});

it('prevents reopening jobs that are not cancelled', function () {
    $manager = createTestUser(RoleName::OperationsManager);
    $dispatcher = createTestUser(RoleName::Dispatcher);
    $draftJob = createTestJob($dispatcher, DispatchStatus::Draft);

    $this->actingAs($manager)->post("/operations/dispatch-jobs/{$draftJob->id}/reopen", [
        'reason' => 'Reopening draft',
        'version' => 1,
    ])->assertSessionHasErrors(['status']);
});

it('allows authorized administrative user to archive and restore jobs using soft delete', function () {
    $sysAdmin = createTestUser(RoleName::SystemAdministrator);
    $dispatcher = createTestUser(RoleName::Dispatcher);
    $driver = createTestUser(RoleName::Driver);
    $asset = OperationalAsset::query()->create([
        'code' => 'TR-100',
        'name' => 'Archive Test Truck',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);
    $job = createTestJob($dispatcher, DispatchStatus::Draft);
    $personnelAssignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHour(),
        'active_until' => null,
    ]);
    $assetAssignment = DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'truck',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHour(),
        'active_until' => null,
    ]);

    // Archive
    $response = $this->actingAs($sysAdmin)->post("/operations/dispatch-jobs/{$job->id}/archive", [
        'reason' => 'Archiving obsolete test draft',
    ]);

    $response->assertRedirect('/');
    expect(DispatchJob::query()->where('id', $job->id)->exists())->toBeFalse();
    expect(DispatchJob::withTrashed()->where('id', $job->id)->exists())->toBeTrue();
    expect($personnelAssignment->fresh()->active_until)->not->toBeNull()
        ->and($assetAssignment->fresh()->active_until)->not->toBeNull()
        ->and($job->fresh()->version)->toBe(2);

    $archiveAudit = AuditEvent::query()
        ->where('subject_type', DispatchJob::class)
        ->where('subject_id', $job->id)
        ->where('action', 'dispatch.archived')
        ->first();
    expect($archiveAudit)->not->toBeNull();

    // Restore
    $restoreResponse = $this->actingAs($sysAdmin)->post("/operations/dispatch-jobs/{$job->id}/restore", [
        'reason' => 'Restoring mistakenly archived job',
    ]);

    $restoreResponse->assertRedirect("/operations/dispatch-jobs/{$job->id}");
    expect(DispatchJob::query()->where('id', $job->id)->exists())->toBeTrue();
    expect($job->fresh()->version)->toBe(3);

    $restoreAudit = AuditEvent::query()
        ->where('subject_type', DispatchJob::class)
        ->where('subject_id', $job->id)
        ->where('action', 'dispatch.restored')
        ->first();
    expect($restoreAudit)->not->toBeNull();
});

it('rolls back archive, assignment closure, and audit history when auditing fails', function () {
    $sysAdmin = createTestUser(RoleName::SystemAdministrator);
    $dispatcher = createTestUser(RoleName::Dispatcher);
    $driver = createTestUser(RoleName::Driver);
    $job = createTestJob($dispatcher, DispatchStatus::Draft);
    $assignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHour(),
        'active_until' => null,
    ]);

    DB::unprepared(<<<'SQL'
        CREATE TRIGGER fail_archive_audit
        BEFORE INSERT ON audit_events
        WHEN NEW.action = 'dispatch.archived'
        BEGIN
            SELECT RAISE(ABORT, 'forced archive audit failure');
        END
        SQL);

    $this->withoutExceptionHandling();

    expect(fn () => $this->actingAs($sysAdmin)
        ->post("/operations/dispatch-jobs/{$job->id}/archive", [
            'reason' => 'Archive rollback test',
        ]))->toThrow(QueryException::class);

    expect($job->fresh()->trashed())->toBeFalse()
        ->and($job->fresh()->version)->toBe(1)
        ->and($assignment->fresh()->active_until)->toBeNull()
        ->and(AuditEvent::query()->where('action', 'dispatch.archived')->exists())->toBeFalse();
});

it('prevents archiving active field jobs directly', function () {
    $sysAdmin = createTestUser(RoleName::SystemAdministrator);
    $dispatcher = createTestUser(RoleName::Dispatcher);
    $activeJob = createTestJob($dispatcher, DispatchStatus::Working);

    $this->actingAs($sysAdmin)->post("/operations/dispatch-jobs/{$activeJob->id}/archive", [
        'reason' => 'Archiving active job',
    ])->assertSessionHasErrors(['status']);

    expect($activeJob->fresh()->trashed())->toBeFalse();
});
