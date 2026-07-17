<?php

use App\Enums\FuelRequestStatus;
use App\Enums\RoleName;
use App\Models\FuelRequest;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);
beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function fieldUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

it('enforces the submitted forwarded approved verified fuel workflow', function () {
    $driver = fieldUser(RoleName::Driver);
    $dispatcher = fieldUser(RoleName::Dispatcher);
    $manager = fieldUser(RoleName::OperationsManager);
    $technician = fieldUser(RoleName::FieldTechnician);
    $response = $this->actingAs($driver)->postJson('/operations/fuel-requests', ['quantity_litres' => 120, 'fuel_type' => 'diesel', 'purpose' => 'Assigned haul'])->assertCreated();
    $id = $response->json('data.id');
    $this->actingAs($driver)->postJson("/operations/fuel-requests/{$id}/status", ['status' => 'approved'])->assertForbidden();
    $this->actingAs($dispatcher)->postJson("/operations/fuel-requests/{$id}/status", ['status' => 'forwarded'])->assertOk();
    $this->actingAs($manager)->postJson("/operations/fuel-requests/{$id}/status", ['status' => 'approved'])->assertOk();
    $this->actingAs($technician)->postJson("/operations/fuel-requests/{$id}/status", ['status' => 'verified'])->assertOk();
    expect(FuelRequest::findOrFail($id)->status)->toBe(FuelRequestStatus::Verified);
});

it('accepts own location sharing but reserves the all-operations feed for office roles', function () {
    $driver = fieldUser(RoleName::Driver);
    $dispatcher = fieldUser(RoleName::Dispatcher);
    $this->actingAs($driver)->postJson('/operations/locations', ['latitude' => 14.5995, 'longitude' => 120.9842, 'accuracy_metres' => 8, 'captured_at' => now()->subMinute()->toIso8601String(), 'sharing_enabled' => true])->assertCreated()->assertJsonPath('data.user_id', $driver->id);
    $this->actingAs($driver)->getJson('/operations/locations')->assertForbidden();
    $this->actingAs($dispatcher)->getJson('/operations/locations')->assertOk();
});
