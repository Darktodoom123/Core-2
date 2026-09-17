<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);
beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('requires post-repair passing inspection before a blocking work order can release an asset', function () {
    $technician = User::factory()->create();
    $technician->syncRoles([RoleName::OperationsManager->value]);
    $asset = OperationalAsset::query()->create(['code' => 'CR-99', 'name' => 'Crane 99', 'kind' => 'crane', 'status' => AssetStatus::Available]);
    $response = $this->actingAs($technician)->postJson("/operations/assets/{$asset->id}/maintenance", ['defect' => 'Hydraulic pressure loss', 'dispatch_blocking' => true])->assertCreated();
    $workId = $response->json('data.id');
    $this->actingAs($technician)->postJson("/operations/maintenance/{$workId}/release", ['work_performed' => ['Replaced hose']])->assertUnprocessable();
    $this->actingAs($technician)->postJson("/operations/maintenance/{$workId}/complete", ['work_performed' => ['Replaced hose']])->assertOk();
    $this->actingAs($technician)->postJson("/operations/assets/{$asset->id}/inspections", ['type' => 'safety', 'result' => 'passed', 'checklist' => ['hydraulics' => true]])->assertCreated();
    $this->actingAs($technician)->postJson("/operations/maintenance/{$workId}/release", ['work_performed' => ['Replaced hose'], 'parts' => ['H-100']])->assertOk();
    expect($asset->refresh()->status)->toBe(AssetStatus::ReadyForService);
});

it('rejects web release of blocking work order when persisted repair completion is missing', function (): void {
    $technician = User::factory()->create();
    $technician->syncRoles([RoleName::OperationsManager->value]);
    $asset = OperationalAsset::query()->create(['code' => 'CR-101', 'name' => 'Crane 101', 'kind' => 'crane', 'status' => AssetStatus::Available]);
    $response = $this->actingAs($technician)->postJson("/operations/assets/{$asset->id}/maintenance", [
        'defect' => 'Boom cable wear',
        'dispatch_blocking' => true,
    ])->assertCreated();
    $workId = $response->json('data.id');

    // Passing inspection submitted before repair completion is recorded
    $this->actingAs($technician)->postJson("/operations/assets/{$asset->id}/inspections", [
        'type' => 'post_repair',
        'result' => 'passed',
        'checklist' => ['cable' => true],
    ])->assertCreated();

    // Release must be rejected with completed_at validation error
    $releaseRes = $this->actingAs($technician)->postJson("/operations/maintenance/{$workId}/release", [
        'work_performed' => ['Replaced boom cable'],
    ]);
    $releaseRes->assertUnprocessable();
    $releaseRes->assertJsonValidationErrors(['completed_at']);
    expect($asset->refresh()->status)->toBe(AssetStatus::UnderMaintenance);
});

it('rejects web release request attempting to substitute an earlier completed_at than recorded repair completion', function (): void {
    $technician = User::factory()->create();
    $technician->syncRoles([RoleName::OperationsManager->value]);
    $asset = OperationalAsset::query()->create(['code' => 'CR-102', 'name' => 'Crane 102', 'kind' => 'crane', 'status' => AssetStatus::Available]);

    Carbon::setTestNow(Carbon::parse('2026-09-17 08:00:00'));
    $response = $this->actingAs($technician)->postJson("/operations/assets/{$asset->id}/maintenance", [
        'defect' => 'Winch motor fault',
        'dispatch_blocking' => true,
    ])->assertCreated();
    $workId = $response->json('data.id');

    // Repair completed at 09:00
    Carbon::setTestNow(Carbon::parse('2026-09-17 09:00:00'));
    $this->actingAs($technician)->postJson("/operations/maintenance/{$workId}/complete", [
        'work_performed' => ['Replaced motor'],
    ])->assertOk();

    // Inspection at 09:15
    Carbon::setTestNow(Carbon::parse('2026-09-17 09:15:00'));
    $this->actingAs($technician)->postJson("/operations/assets/{$asset->id}/inspections", [
        'type' => 'post_repair',
        'result' => 'passed',
        'checklist' => ['motor' => true],
    ])->assertCreated();

    // Release attempts to substitute earlier completed_at 08:30 (before 09:00)
    Carbon::setTestNow(Carbon::parse('2026-09-17 09:30:00'));
    $releaseRes = $this->actingAs($technician)->postJson("/operations/maintenance/{$workId}/release", [
        'work_performed' => ['Replaced motor'],
        'completed_at' => '2026-09-17 08:30:00',
    ]);
    $releaseRes->assertUnprocessable();
    $releaseRes->assertJsonValidationErrors(['completed_at']);

    Carbon::setTestNow();
});

it('rejects web release when passing inspection completed before recorded repair completion', function (): void {
    $technician = User::factory()->create();
    $technician->syncRoles([RoleName::OperationsManager->value]);
    $asset = OperationalAsset::query()->create(['code' => 'CR-103', 'name' => 'Crane 103', 'kind' => 'crane', 'status' => AssetStatus::Available]);

    // Work order created at 08:00
    Carbon::setTestNow(Carbon::parse('2026-09-17 08:00:00'));
    $response = $this->actingAs($technician)->postJson("/operations/assets/{$asset->id}/maintenance", [
        'defect' => 'Hydraulic seal leak',
        'dispatch_blocking' => true,
    ])->assertCreated();
    $workId = $response->json('data.id');

    // Passing inspection at 08:15 (BEFORE repair completion)
    Carbon::setTestNow(Carbon::parse('2026-09-17 08:15:00'));
    $this->actingAs($technician)->postJson("/operations/assets/{$asset->id}/inspections", [
        'type' => 'post_repair',
        'result' => 'passed',
        'checklist' => ['seals' => true],
    ])->assertCreated();

    // Repair completed at 08:30
    Carbon::setTestNow(Carbon::parse('2026-09-17 08:30:00'));
    $this->actingAs($technician)->postJson("/operations/maintenance/{$workId}/complete", [
        'work_performed' => ['Replaced seal'],
    ])->assertOk();

    // Release attempted at 08:35 -> must FAIL because inspection was before repair completion
    Carbon::setTestNow(Carbon::parse('2026-09-17 08:35:00'));
    $releaseRes = $this->actingAs($technician)->postJson("/operations/maintenance/{$workId}/release", [
        'work_performed' => ['Replaced seal'],
    ]);
    $releaseRes->assertUnprocessable();
    $releaseRes->assertJsonValidationErrors(['inspection']);

    Carbon::setTestNow();
});

it('permits web release when passing inspection completed after recorded repair completion', function (): void {
    $technician = User::factory()->create();
    $technician->syncRoles([RoleName::OperationsManager->value]);
    $asset = OperationalAsset::query()->create(['code' => 'CR-104', 'name' => 'Crane 104', 'kind' => 'crane', 'status' => AssetStatus::Available]);

    // Work order created at 08:00
    Carbon::setTestNow(Carbon::parse('2026-09-17 08:00:00'));
    $response = $this->actingAs($technician)->postJson("/operations/assets/{$asset->id}/maintenance", [
        'defect' => 'Hydraulic cylinder rebuild',
        'dispatch_blocking' => true,
    ])->assertCreated();
    $workId = $response->json('data.id');

    // Repair completed at 08:30
    Carbon::setTestNow(Carbon::parse('2026-09-17 08:30:00'));
    $this->actingAs($technician)->postJson("/operations/maintenance/{$workId}/complete", [
        'work_performed' => ['Rebuilt cylinder'],
        'completed_at' => '2026-09-17 08:25:00',
    ])->assertOk();

    // Passing inspection completed at 08:35 (after repair completion at 08:25)
    Carbon::setTestNow(Carbon::parse('2026-09-17 08:35:00'));
    $this->actingAs($technician)->postJson("/operations/assets/{$asset->id}/inspections", [
        'type' => 'post_repair',
        'result' => 'passed',
        'checklist' => ['cylinder' => true],
    ])->assertCreated();

    // Release at 08:40 succeeds
    Carbon::setTestNow(Carbon::parse('2026-09-17 08:40:00'));
    $releaseRes = $this->actingAs($technician)->postJson("/operations/maintenance/{$workId}/release", [
        'work_performed' => ['Rebuilt cylinder'],
    ]);
    $releaseRes->assertOk();
    expect($asset->refresh()->status)->toBe(AssetStatus::ReadyForService);

    Carbon::setTestNow();
});
