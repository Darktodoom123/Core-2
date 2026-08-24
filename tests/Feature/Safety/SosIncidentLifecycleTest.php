<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Actions\EscalateUnacknowledgedSosIncident;
use App\Platform\Safety\Actions\PruneSosIncidentCoordinates;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Models\SosEmergencyContact;
use App\Platform\Safety\Models\SosIncident;
use App\Platform\Safety\Models\SosIncidentRecipient;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    config(['sos.enabled' => true]);
    Queue::fake();
});

function safetyUser(RoleName $role, string $name = 'Safety user'): User
{
    $user = User::factory()->create(['name' => $name]);
    $user->syncRoles([$role->value]);

    return $user;
}

/** @return array{job: DispatchJob, assignment: DispatchPersonnelAssignment} */
function safetyAssignment(User $worker, User $assignedBy, string $reference = 'SOS-DSP-001'): array
{
    $job = DispatchJob::query()->create([
        'reference' => $reference,
        'client' => 'Synthetic safety client',
        'title' => 'Synthetic safety dispatch',
        'site' => 'Synthetic safety site',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Accepted,
        'version' => 1,
        'created_by' => $assignedBy->id,
    ]);
    $assignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'response_status' => 'accepted',
        'assigned_by' => $assignedBy->id,
        'active_from' => now()->subMinute(),
    ]);

    return ['job' => $job, 'assignment' => $assignment];
}

function triggerSafety(User $worker, array $payload = [], ?string $token = null): TestResponse
{
    $token ??= $worker->createToken('Synthetic SOS device')->plainTextToken;
    $commandId = $payload['command_id'] ?? (string) Str::uuid();

    return test()->withToken($token)->withHeader('Idempotency-Key', $commandId)->postJson('/api/v1/sos-incidents', [
        'command_id' => $commandId,
        ...$payload,
    ]);
}

it('keeps SOS disabled unless explicitly enabled', function (): void {
    config(['sos.enabled' => false]);
    $worker = safetyUser(RoleName::Driver);

    triggerSafety($worker)->assertStatus(503)->assertJsonPath('error', 'sos_disabled');
    expect(SosIncident::query()->count())->toBe(0);
});

it('accepts a field SOS without a dispatch and snapshots dispatcher and manager recipients', function (): void {
    $dispatcher = safetyUser(RoleName::Dispatcher, 'Synthetic dispatcher');
    $manager = safetyUser(RoleName::OperationsManager, 'Synthetic manager');
    $worker = safetyUser(RoleName::Driver, 'Synthetic field worker');

    triggerSafety($worker, ['worker_note' => 'Synthetic test note'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.dispatch', null);

    $incident = SosIncident::query()->sole();
    expect($incident->reporter_id)->toBe($worker->id)
        ->and((int) abs($incident->escalation_due_at->diffInSeconds($incident->received_at)))->toBe(180)
        ->and(SosIncidentRecipient::query()->where('sos_incident_id', $incident->id)->pluck('user_id')->all())
        ->toEqualCanonicalizing([$dispatcher->id, $manager->id]);
});

it('replays the same command and reuses a different command while an incident is unresolved', function (): void {
    $worker = safetyUser(RoleName::Driver);
    $firstCommand = (string) Str::uuid();

    triggerSafety($worker, ['command_id' => $firstCommand])->assertCreated();
    triggerSafety($worker, ['command_id' => $firstCommand])->assertOk()->assertJsonPath('reused', true);
    triggerSafety($worker, ['command_id' => (string) Str::uuid()])->assertOk()
        ->assertJsonPath('reused_active_incident', true);

    expect(SosIncident::query()->where('reporter_id', $worker->id)->count())->toBe(1);
});

it('denies office roles even if the trigger permission is manually granted', function (): void {
    $administrator = safetyUser(RoleName::SystemAdministrator);
    $administrator->givePermissionTo(PermissionName::SosTrigger->value);

    triggerSafety($administrator)->assertForbidden();
});

it('returns not found for a dispatch outside the worker assignment scope', function (): void {
    $worker = safetyUser(RoleName::Driver);
    $otherWorker = safetyUser(RoleName::Driver);
    $dispatcher = safetyUser(RoleName::Dispatcher);
    $assignment = safetyAssignment($otherWorker, $dispatcher);

    triggerSafety($worker, ['dispatch_job_id' => $assignment['job']->id])->assertNotFound();
    expect(SosIncident::query()->count())->toBe(0);
});

it('allows the worker to classify an active incident and attach only an assigned asset', function (): void {
    $dispatcher = safetyUser(RoleName::Dispatcher);
    $worker = safetyUser(RoleName::Driver);
    $assignment = safetyAssignment($worker, $dispatcher, 'SOS-DSP-CLASSIFY');
    $assetId = DB::table('operational_assets')->insertGetId([
        'code' => 'SOS-ASSET-001', 'name' => 'Synthetic safety asset', 'kind' => 'vehicle', 'status' => 'available',
        'created_at' => now(), 'updated_at' => now(),
    ]);
    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $assignment['job']->id, 'operational_asset_id' => $assetId, 'assignment_type' => 'vehicle',
        'assigned_by' => $dispatcher->id, 'active_from' => now()->subMinute(),
    ]);

    $response = triggerSafety($worker, ['dispatch_job_id' => $assignment['job']->id]);
    $incident = SosIncident::query()->sole();

    test()->withToken($worker->tokens()->latest()->first()->token)->patchJson("/api/v1/sos-incidents/{$incident->id}/classification", [
        'category' => 'critical_asset_malfunction', 'operational_asset_id' => $assetId,
    ])->assertOk()->assertJsonPath('data.category', 'critical_asset_malfunction');

    expect($response->status())->toBe(201)->and($incident->fresh()->operational_asset_id)->toBe($assetId);
});

it('acknowledges without resolving, then requires a code and note to resolve', function (): void {
    $dispatcher = safetyUser(RoleName::Dispatcher);
    $worker = safetyUser(RoleName::Driver);
    $incident = tap(triggerSafety($worker)->assertCreated(), fn () => null);
    $model = SosIncident::query()->sole();

    test()->actingAs($dispatcher)->postJson("/operations/sos-incidents/{$model->id}/acknowledge")
        ->assertOk()->assertJsonPath('data.status', 'acknowledged');
    expect($model->fresh()->status)->toBe(SosIncidentStatus::Acknowledged);

    test()->actingAs($dispatcher)->postJson("/operations/sos-incidents/{$model->id}/resolve", [
        'resolution_code' => 'worker_safe', 'resolution_notes' => 'Synthetic test closure note',
    ])->assertOk()->assertJsonPath('data.status', 'resolved');
    expect($model->fresh()->status)->toBe(SosIncidentStatus::Resolved);
});

it('escalates once at the server deadline and preserves the acknowledgement history', function (): void {
    $dispatcher = safetyUser(RoleName::Dispatcher);
    $worker = safetyUser(RoleName::Driver);
    triggerSafety($worker)->assertCreated();
    $incident = SosIncident::query()->sole();
    $incident->update(['escalation_due_at' => now()->subSecond()]);

    app(EscalateUnacknowledgedSosIncident::class)->handle($incident->id);
    app(EscalateUnacknowledgedSosIncident::class)->handle($incident->id);

    expect($incident->fresh()->status)->toBe(SosIncidentStatus::Escalated)
        ->and($incident->fresh()->escalated_at)->not()->toBeNull();

    test()->actingAs($dispatcher)->postJson("/operations/sos-incidents/{$incident->id}/acknowledge")
        ->assertOk()->assertJsonPath('data.status', 'acknowledged');
    expect($incident->fresh()->escalated_at)->not()->toBeNull();
});

it('cancels rather than deletes a delivered false alarm', function (): void {
    $worker = safetyUser(RoleName::Driver);
    triggerSafety($worker)->assertCreated();
    $incident = SosIncident::query()->sole();

    test()->withToken($worker->tokens()->latest()->first()->token)->postJson("/api/v1/sos-incidents/{$incident->id}/cancel", [
        'cancellation_reason' => 'Synthetic false alarm',
    ])->assertOk()->assertJsonPath('data.status', 'cancelled');

    expect(SosIncident::query()->whereKey($incident->id)->exists())->toBeTrue()
        ->and($incident->fresh()->cancellation_reason)->toBe('Synthetic false alarm');
});

it('prunes precise coordinates while retaining the incident record', function (): void {
    $worker = safetyUser(RoleName::Driver);
    triggerSafety($worker, ['latitude' => 14.5995, 'longitude' => 120.9842, 'accuracy_metres' => 12])->assertCreated();
    $incident = SosIncident::query()->sole();
    $incident->update(['location_captured_at' => now()->subDays(31)]);

    app(PruneSosIncidentCoordinates::class)->handle();
    $incident->refresh();

    expect($incident->latitude)->toBeNull()
        ->and($incident->longitude)->toBeNull()
        ->and($incident->location_pruned_at)->not()->toBeNull()
        ->and(SosIncident::query()->whereKey($incident->id)->exists())->toBeTrue();
});

it('keeps company emergency contact phones encrypted and does not expose them in configuration output', function (): void {
    $admin = safetyUser(RoleName::SystemAdministrator);

    test()->actingAs($admin)->postJson('/operations/sos-configuration/contacts', [
        'name' => 'Synthetic escalation contact', 'role_label' => 'Synthetic duty officer',
        'phone_e164' => '+15550000001', 'escalation_order' => 1,
    ])->assertCreated();

    $contact = SosEmergencyContact::query()->sole();
    expect($contact->phone_e164)->toBe('+15550000001')
        ->and((string) $contact->getRawOriginal('phone_e164'))->not()->toContain('+15550000001');

    test()->actingAs($admin)->getJson('/operations/sos-configuration/contacts')
        ->assertOk()->assertJsonMissing(['phone_e164' => '+15550000001']);
});

it('returns deliberate call and SMS actions only for a validated configured number', function (): void {
    config([
        'sos.local_emergency_label' => 'Duty officer',
        'sos.local_emergency_number' => '+15550000002',
    ]);
    $worker = safetyUser(RoleName::Driver);
    $token = $worker->createToken('Synthetic SOS configuration device')->plainTextToken;

    test()->withToken($token)->getJson('/api/v1/sos-configuration')
        ->assertOk()
        ->assertJsonPath('data.actions.0.kind', 'call')
        ->assertJsonPath('data.actions.0.uri', 'tel:+15550000002')
        ->assertJsonPath('data.actions.1.kind', 'sms')
        ->assertJsonPath('data.actions.1.uri', 'sms:+15550000002');
});
