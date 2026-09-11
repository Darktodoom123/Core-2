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

it('provisions Operations Manager with the safety governance permissions', function (): void {
    $manager = User::factory()->create(['name' => 'Jane Operations Manager']);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    expect($manager->hasRole(RoleName::OperationsManager->value))->toBeTrue()
        ->and($manager->operationalRole())->toBe(RoleName::OperationsManager)
        ->and($manager->can(PermissionName::SosView->value))->toBeTrue()
        ->and($manager->can(PermissionName::SosRespond->value))->toBeTrue()
        ->and($manager->can(PermissionName::TrackingViewAll->value))->toBeTrue()
        ->and($manager->can(PermissionName::FleetInspect->value))->toBeTrue()
        ->and($manager->can(PermissionName::EquipmentInspect->value))->toBeTrue()
        ->and($manager->can(PermissionName::DispatchViewAll->value))->toBeTrue()
        ->and($manager->can(PermissionName::ReportsViewAll->value))->toBeTrue()
        ->and($manager->can(PermissionName::SafetyTbmCoSign->value))->toBeTrue()
        ->and($manager->can(PermissionName::SafetyLiftPlanApprove->value))->toBeTrue()
        ->and($manager->can(PermissionName::SafetyWorkStoppageIssue->value))->toBeTrue()
        ->and($manager->can(PermissionName::SafetyWorkStoppageLift->value))->toBeTrue();
});

it('includes active Operations Managers as recipients when an SOS alert is triggered', function (): void {
    $manager = User::factory()->create(['name' => 'Ops Manager', 'is_active' => true, 'email_verified_at' => now()]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

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
    expect($recipientUserIds)->toContain($manager->id);

    $managerRecipient = $recipients->first(fn (array $item) => $item['user']->id === $manager->id);
    expect($managerRecipient['resolution_reason'])->toBe('assignment_manager');
});

it('allows Operations Manager to acknowledge and resolve SOS emergency incidents', function (): void {
    $worker = User::factory()->create(['name' => 'Field Worker', 'is_active' => true, 'email_verified_at' => now()]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Device')->plainTextToken;

    $commandId = (string) Str::uuid();
    $this->withToken($token)->withHeader('Idempotency-Key', $commandId)->postJson('/api/v1/sos-incidents', [
        'command_id' => $commandId,
        'worker_note' => 'Hydraulic failure during heavy lift',
    ])->assertCreated();

    $incident = SosIncident::query()->sole();

    $manager = User::factory()->create(['name' => 'Operations Manager']);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $this->actingAs($manager)->postJson("/operations/sos-incidents/{$incident->id}/acknowledge")
        ->assertOk()
        ->assertJsonPath('data.status', 'acknowledged');

    expect($incident->fresh()->status)->toBe(SosIncidentStatus::Acknowledged)
        ->and($incident->fresh()->acknowledged_by)->toBe($manager->id);

    $this->actingAs($manager)->postJson("/operations/sos-incidents/{$incident->id}/resolve", [
        'resolution_code' => 'asset_secured',
        'resolution_notes' => 'Load lowered to ground level safely, crane boom locked out, no injuries.',
    ])->assertOk()
        ->assertJsonPath('data.status', 'resolved');

    expect($incident->fresh()->status)->toBe(SosIncidentStatus::Resolved)
        ->and($incident->fresh()->resolution_notes)->toBe('Load lowered to ground level safely, crane boom locked out, no injuries.');
});

it('allows Operations Manager to trigger an emergency safety lockdown on a compromised asset', function (): void {
    $manager = User::factory()->create(['name' => 'Operations Manager']);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRANE-LOTO-001',
        'name' => 'Tadano 50T Rough Terrain Crane',
        'kind' => 'mobile_crane',
        'status' => AssetStatus::Available,
    ]);

    $this->actingAs($manager)->postJson("/operations/admin/assets/{$asset->id}/safety-lockdown", [
        'reason' => 'Failed outrigger pressure test and hydraulic leak detected during pre-lift audit.',
    ])->assertOk()
        ->assertJsonPath('asset.status', AssetStatus::Unavailable->value);

    expect($asset->fresh()->status)->toBe(AssetStatus::Unavailable);
});
