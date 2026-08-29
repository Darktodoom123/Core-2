<?php

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Models\SosIncident;
use App\Platform\Safety\Services\SosRecipientResolver;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    config(['sos.enabled' => true]);
    Queue::fake();
});

it('provisions Safety Officer with the exact required permissions', function (): void {
    $safetyOfficer = User::factory()->create(['name' => 'Jane Safety']);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);

    expect($safetyOfficer->hasRole(RoleName::SafetyOfficer->value))->toBeTrue()
        ->and($safetyOfficer->operationalRole())->toBe(RoleName::SafetyOfficer)
        ->and($safetyOfficer->can(PermissionName::SosView->value))->toBeTrue()
        ->and($safetyOfficer->can(PermissionName::SosRespond->value))->toBeTrue()
        ->and($safetyOfficer->can(PermissionName::TrackingViewAll->value))->toBeTrue()
        ->and($safetyOfficer->can(PermissionName::FleetInspect->value))->toBeTrue()
        ->and($safetyOfficer->can(PermissionName::EquipmentInspect->value))->toBeTrue()
        ->and($safetyOfficer->can(PermissionName::DispatchViewAll->value))->toBeTrue()
        ->and($safetyOfficer->can(PermissionName::ReportsViewAll->value))->toBeTrue()
        ->and($safetyOfficer->can(PermissionName::AuditView->value))->toBeFalse()
        ->and($safetyOfficer->can(PermissionName::DispatchCreate->value))->toBeFalse()
        ->and($safetyOfficer->can(PermissionName::SalesCreateQuote->value))->toBeFalse()
        ->and($safetyOfficer->can(PermissionName::UsersManage->value))->toBeFalse();
});

it('includes active Safety Officers as recipients when an SOS alert is triggered', function (): void {
    $manager = User::factory()->create(['name' => 'Ops Manager', 'is_active' => true, 'email_verified_at' => now()]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $safetyOfficer = User::factory()->create(['name' => 'Chief Safety Officer', 'is_active' => true, 'email_verified_at' => now()]);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);

    $worker = User::factory()->create(['name' => 'Field Crane Operator', 'is_active' => true, 'email_verified_at' => now()]);
    $worker->syncRoles([RoleName::CraneOperator->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-SAFE-001',
        'client' => 'Safety Client Inc',
        'title' => 'Critical Lift Work',
        'site' => 'Port Sector B',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Accepted,
        'version' => 1,
        'created_by' => $manager->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'crane_operator',
        'response_status' => 'accepted',
        'assigned_by' => $manager->id,
        'active_from' => now()->subMinute(),
    ]);

    $resolver = app(SosRecipientResolver::class);
    $recipients = $resolver->resolve($worker, $job);

    $recipientUserIds = $recipients->pluck('user.id')->all();
    expect($recipientUserIds)->toContain($manager->id)
        ->and($recipientUserIds)->toContain($safetyOfficer->id);

    $safetyRecipient = $recipients->first(fn (array $item) => $item['user']->id === $safetyOfficer->id);
    expect($safetyRecipient['resolution_reason'])->toBe('safety_officer');
});

it('allows Safety Officer to acknowledge and resolve SOS emergency incidents', function (): void {
    $worker = User::factory()->create(['name' => 'Field Worker', 'is_active' => true, 'email_verified_at' => now()]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Device')->plainTextToken;

    $commandId = (string) Str::uuid();
    $this->withToken($token)->withHeader('Idempotency-Key', $commandId)->postJson('/api/v1/sos-incidents', [
        'command_id' => $commandId,
        'worker_note' => 'Hydraulic failure during heavy lift',
    ])->assertCreated();

    $incident = SosIncident::query()->sole();

    $safetyOfficer = User::factory()->create(['name' => 'Safety Officer']);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);

    $this->actingAs($safetyOfficer)->postJson("/operations/sos-incidents/{$incident->id}/acknowledge")
        ->assertOk()
        ->assertJsonPath('data.status', 'acknowledged');

    expect($incident->fresh()->status)->toBe(SosIncidentStatus::Acknowledged)
        ->and($incident->fresh()->acknowledged_by)->toBe($safetyOfficer->id);

    $this->actingAs($safetyOfficer)->postJson("/operations/sos-incidents/{$incident->id}/resolve", [
        'resolution_code' => 'asset_secured',
        'resolution_notes' => 'Load lowered to ground level safely, crane boom locked out, no injuries.',
    ])->assertOk()
        ->assertJsonPath('data.status', 'resolved');

    expect($incident->fresh()->status)->toBe(SosIncidentStatus::Resolved)
        ->and($incident->fresh()->resolution_notes)->toBe('Load lowered to ground level safely, crane boom locked out, no injuries.');
});

it('allows Safety Officer to trigger an emergency safety lockdown on a compromised asset', function (): void {
    $safetyOfficer = User::factory()->create(['name' => 'HSE Inspector']);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRANE-LOTO-001',
        'name' => 'Tadano 50T Rough Terrain Crane',
        'kind' => 'mobile_crane',
        'status' => AssetStatus::Available,
    ]);

    $this->actingAs($safetyOfficer)->postJson("/operations/admin/assets/{$asset->id}/safety-lockdown", [
        'reason' => 'Failed outrigger pressure test and hydraulic leak detected during pre-lift audit.',
    ])->assertOk()
        ->assertJsonPath('asset.status', AssetStatus::Unavailable->value);

    expect($asset->fresh()->status)->toBe(AssetStatus::Unavailable);
});
