<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Actions\TransitionFuelRequest;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function mobileFuelActor(): User
{
    $user = User::factory()->create(['is_active' => true]);
    $user->givePermissionTo(['fuel.request', 'fuel.view_own', 'fuel.record']);

    return $user;
}

function mobileFuelPayload(): array
{
    return ['client_request_id' => (string) Str::uuid(), 'quantity_litres' => 50, 'fuel_type' => 'diesel', 'purpose' => 'Field operation'];
}

it('requires bearer authentication and fuel permissions', function (): void {
    $this->postJson('/api/v1/fuel-requests', mobileFuelPayload())->assertUnauthorized();
    $user = User::factory()->create(['is_active' => true]);
    $this->withToken($user->createToken('mobile')->plainTextToken)->postJson('/api/v1/fuel-requests', mobileFuelPayload())->assertForbidden();
});

it('accepts matching active assignments and excludes unrelated or ended assignments', function (): void {
    $user = mobileFuelActor();
    $other = mobileFuelActor();
    $asset = OperationalAsset::create(['code' => 'FUEL-A', 'name' => 'Crane', 'kind' => 'crane', 'subtype' => 'mobile', 'status' => 'ready_for_service']);
    $job = DispatchJob::create(['reference' => 'FUEL-J', 'client' => 'Client', 'title' => 'Lift', 'site' => 'Site', 'status' => 'draft', 'priority' => 'routine', 'scheduled_start' => now(), 'scheduled_end' => now()->addHour(), 'created_by' => $user->id, 'version' => 1]);
    $assignment = DispatchPersonnelAssignment::create(['dispatch_job_id' => $job->id, 'user_id' => $user->id, 'assignment_type' => 'operator', 'assigned_by' => $user->id, 'active_from' => now()->subHour()]);
    DispatchAssetAssignment::create(['dispatch_job_id' => $job->id, 'operational_asset_id' => $asset->id, 'assignment_type' => 'primary', 'assigned_by' => $user->id, 'active_from' => now()->subHour()]);
    $this->withToken($other->createToken('mobile')->plainTextToken);
    $payload = [...mobileFuelPayload(), 'operational_asset_id' => $asset->id, 'dispatch_job_id' => $job->id];
    $this->postJson('/api/v1/fuel-requests', $payload)->assertUnprocessable()->assertJsonValidationErrors(['operational_asset_id', 'dispatch_job_id']);
    $this->app['auth']->forgetGuards();
    $this->withToken($user->createToken('mobile')->plainTextToken);
    $this->getJson('/api/v1/fuel-options')->assertOk()->assertJsonPath('data.assets.0.id', $asset->id)->assertJsonPath('data.jobs.0.operational_asset_ids.0', $asset->id);
    $id = $this->postJson('/api/v1/fuel-requests', $payload)->assertCreated()->json('data.id');
    $assignment->update(['active_until' => now()->subMinute()]);
    $this->getJson('/api/v1/fuel-options')->assertOk()->assertJsonCount(0, 'data.assets');
    $this->postJson('/api/v1/fuel-requests', $payload)->assertOk()->assertJsonPath('data.id', $id);
    $this->postJson('/api/v1/fuel-requests', [...$payload, 'client_request_id' => (string) Str::uuid()])->assertUnprocessable();
});

it('rejects unassigned asset job and foreign shift contexts', function (): void {
    $user = mobileFuelActor();
    $this->withToken($user->createToken('mobile')->plainTextToken)->postJson('/api/v1/fuel-requests', [
        ...mobileFuelPayload(), 'operational_asset_id' => 9999, 'dispatch_job_id' => 9999, 'operator_shift_id' => 9999,
    ])->assertUnprocessable()->assertJsonValidationErrors(['operational_asset_id', 'dispatch_job_id', 'operator_shift_id']);
    $this->getJson('/api/v1/fuel-options')->assertOk()->assertJsonPath('data.can_request', true)->assertJsonCount(0, 'data.assets')->assertJsonCount(0, 'data.jobs');
    expect(FuelRequest::count())->toBe(0);
});

it('records actual fuel only after verification and prevents duplicate logs', function (): void {
    $user = mobileFuelActor();
    $this->withToken($user->createToken('mobile')->plainTextToken);
    $id = $this->postJson('/api/v1/fuel-requests', mobileFuelPayload())->assertCreated()->json('data.id');
    $this->postJson("/api/v1/fuel-requests/{$id}/logs", ['quantity_litres' => 48])->assertUnprocessable();
    $fuel = FuelRequest::findOrFail($id);
    $manager = User::factory()->create();
    $manager->givePermissionTo(['fuel.forward', 'fuel.approve', 'fuel.verify']);
    $transition = app(TransitionFuelRequest::class);
    foreach ([FuelRequestStatus::Forwarded, FuelRequestStatus::Approved, FuelRequestStatus::Verified] as $status) {
        $transition->handle($manager, $fuel, $status);
    }
    $this->getJson("/api/v1/fuel-requests/{$id}")->assertOk()->assertJsonPath('data.can_record', true);
    $this->postJson("/api/v1/fuel-requests/{$id}/logs", ['quantity_litres' => 48, 'price_per_litre' => 60])->assertCreated()->assertJsonPath('data.status', 'logged')->assertJsonPath('data.can_record', false)->assertJsonPath('data.logs.0.total_cost', '2880.00');
    $this->postJson("/api/v1/fuel-requests/{$id}/logs", ['quantity_litres' => 48])->assertUnprocessable();
    expect($fuel->logs()->count())->toBe(1);
});

it('keeps another operators request hidden and rejects their log writes', function (): void {
    $owner = mobileFuelActor();
    $fuel = FuelRequest::create(['reference' => 'FUEL-PRIVATE', 'requester_id' => $owner->id, 'quantity_litres' => 20, 'fuel_type' => 'diesel', 'purpose' => 'Private', 'status' => 'verified']);
    $other = mobileFuelActor();
    $this->withToken($other->createToken('mobile')->plainTextToken);
    $this->getJson('/api/v1/fuel-requests')->assertOk()->assertJsonCount(0, 'data');
    $this->getJson("/api/v1/fuel-requests/{$fuel->id}")->assertNotFound();
    $this->postJson("/api/v1/fuel-requests/{$fuel->id}/logs", ['quantity_litres' => 20])->assertForbidden();
});

it('stores private receipt attachments and rejects unsafe receipt input', function (): void {
    Storage::fake(config('attachments.disk'));
    $owner = mobileFuelActor();
    $fuel = FuelRequest::create(['reference' => 'FUEL-RECEIPT', 'requester_id' => $owner->id, 'quantity_litres' => 20, 'fuel_type' => 'diesel', 'purpose' => 'Receipt', 'status' => 'verified']);
    $this->withToken($owner->createToken('mobile')->plainTextToken);
    $this->postJson("/api/v1/fuel-requests/{$fuel->id}/logs", ['quantity_litres' => 20, 'receipt_path' => '/private/forged'])->assertUnprocessable();
    $this->postJson("/api/v1/fuel-requests/{$fuel->id}/logs", ['quantity_litres' => 20, 'receipt' => UploadedFile::fake()->create('bad.exe', 10, 'application/octet-stream')])->assertUnprocessable();
    $this->postJson("/api/v1/fuel-requests/{$fuel->id}/logs", ['quantity_litres' => 20, 'receipt' => UploadedFile::fake()->image('receipt.jpg')])->assertCreated()->assertJsonPath('data.logs.0.has_receipt', true)->assertJsonMissingPath('data.logs.0.receipt_path');
    $log = $fuel->logs()->sole();
    Storage::disk(config('attachments.disk'))->assertExists($log->receipt_path);
});

it('creates an authenticated mobile fuel request exactly once across retries', function (): void {
    $user = User::factory()->create(['is_active' => true]);
    $user->givePermissionTo(['fuel.request', 'fuel.view_own', 'fuel.record']);
    $payload = ['client_request_id' => (string) Str::uuid(), 'quantity_litres' => 50, 'fuel_type' => 'diesel', 'purpose' => 'Morning operations'];
    $this->withToken($user->createToken('mobile')->plainTextToken);
    $id = $this->postJson('/api/v1/fuel-requests', $payload)->assertCreated()->assertJsonPath('data.status', 'submitted')->json('data.id');
    $this->postJson('/api/v1/fuel-requests', $payload)->assertOk()->assertJsonPath('data.id', $id);
    expect(FuelRequest::count())->toBe(1);
    $this->postJson('/api/v1/fuel-requests', [...$payload, 'quantity_litres' => 90])->assertConflict();
});
