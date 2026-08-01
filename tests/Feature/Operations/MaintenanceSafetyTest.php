<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);
beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('requires post-repair passing inspection before a blocking work order can release an asset', function () {
    $technician = User::factory()->create();
    $technician->syncRoles([RoleName::FieldTechnician->value]);
    $asset = OperationalAsset::query()->create(['code' => 'CR-99', 'name' => 'Crane 99', 'kind' => 'crane', 'status' => AssetStatus::Available]);
    $response = $this->actingAs($technician)->postJson("/operations/assets/{$asset->id}/maintenance", ['defect' => 'Hydraulic pressure loss', 'dispatch_blocking' => true])->assertCreated();
    $workId = $response->json('data.id');
    $this->actingAs($technician)->postJson("/operations/maintenance/{$workId}/release", ['work_performed' => ['Replaced hose']])->assertUnprocessable();
    $this->actingAs($technician)->postJson("/operations/assets/{$asset->id}/inspections", ['type' => 'safety', 'result' => 'passed', 'checklist' => ['hydraulics' => true]])->assertCreated();
    $this->actingAs($technician)->postJson("/operations/maintenance/{$workId}/release", ['work_performed' => ['Replaced hose'], 'parts' => ['H-100']])->assertOk();
    expect($asset->refresh()->status)->toBe(AssetStatus::ReadyForService);
});
