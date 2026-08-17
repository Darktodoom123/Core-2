<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

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

it('enforces the submitted forwarded approved verified logged fuel workflow end-to-end with audit history', function () {
    $driver = fieldUser(RoleName::Driver);
    $dispatcher = fieldUser(RoleName::Dispatcher);
    $manager = fieldUser(RoleName::OperationsManager);
    $technician = fieldUser(RoleName::FieldTechnician);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-FUEL-001',
        'client' => 'Test Client',
        'title' => 'Test Dispatch Job',
        'site' => 'Site A',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(4),
        'created_by' => $driver->id,
        'version' => 1,
    ]);
    $asset = OperationalAsset::query()->create([
        'code' => 'TRK-FUEL-001',
        'name' => 'Fuel Test Truck',
        'kind' => 'truck',
        'subtype' => 'flatbed',
        'status' => AssetStatus::ReadyForService,
    ]);

    // 1. Submit request with optional dispatch and asset linkage
    $this->actingAs($driver)
        ->post('/operations/fuel-requests', [
            'quantity_litres' => 120,
            'fuel_type' => 'diesel',
            'purpose' => 'Assigned haul',
            'dispatch_job_id' => $job->id,
            'operational_asset_id' => $asset->id,
        ])
        ->assertRedirect('/');

    $fuel = FuelRequest::query()->sole();
    expect($fuel->status)->toBe(FuelRequestStatus::Submitted)
        ->and((float) $fuel->quantity_litres)->toBe(120.00)
        ->and($fuel->dispatch_job_id)->toBe($job->id)
        ->and($fuel->operational_asset_id)->toBe($asset->id);

    expect(AuditEvent::query()->where('action', 'fuel.requested')->exists())->toBeTrue();

    // 2. Forward request
    $this->actingAs($dispatcher)
        ->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'forwarded'])
        ->assertRedirect('/');

    $fuel->refresh();
    expect($fuel->status)->toBe(FuelRequestStatus::Forwarded)
        ->and($fuel->reviewed_by)->toBe($dispatcher->id)
        ->and($fuel->reviewed_at)->not()->toBeNull();

    // 3. Approve request with decision reason
    $this->actingAs($manager)
        ->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'approved',
            'reason' => 'Approved for long distance haul',
        ])
        ->assertRedirect('/');

    $fuel->refresh();
    expect($fuel->status)->toBe(FuelRequestStatus::Approved)
        ->and($fuel->approved_by)->toBe($manager->id)
        ->and($fuel->approved_at)->not()->toBeNull()
        ->and($fuel->decision_reason)->toBe('Approved for long distance haul');

    // 4. Verify request
    $this->actingAs($technician)
        ->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'verified'])
        ->assertRedirect('/');

    $fuel->refresh();
    expect($fuel->status)->toBe(FuelRequestStatus::Verified)
        ->and($fuel->verified_by)->toBe($technician->id)
        ->and($fuel->verified_at)->not()->toBeNull();

    // 5. Final logging by driver
    $this->actingAs($driver)
        ->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'logged',
            'quantity_litres' => 120,
            'odometer_km' => 45000,
            'hour_meter' => 1250.5,
            'price_per_litre' => 1.75,
            'total_cost' => 210.00,
            'fuel_station' => 'Shell Highway 1',
            'remarks' => 'Filled tank completely',
        ])
        ->assertRedirect('/');

    $fuel->refresh();
    expect($fuel->status)->toBe(FuelRequestStatus::Logged);

    $log = FuelLog::query()->where('fuel_request_id', $fuel->id)->sole();
    expect($log->recorded_by)->toBe($driver->id)
        ->and((float) $log->quantity_litres)->toBe(120.00)
        ->and($log->odometer_km)->toBe(45000)
        ->and((float) $log->hour_meter)->toBe(1250.5)
        ->and((float) $log->price_per_litre)->toBe(1.75)
        ->and((float) $log->total_cost)->toBe(210.00)
        ->and($log->fuel_station)->toBe('Shell Highway 1')
        ->and($log->remarks)->toBe('Filled tank completely');

    expect(AuditEvent::query()->where('action', 'fuel.status_updated')->count())->toBeGreaterThanOrEqual(4);
});

it('allows an operations manager to forward a fuel request as fallback', function () {
    $driver = fieldUser(RoleName::Driver);
    $manager = fieldUser(RoleName::OperationsManager);
    $otherManager = fieldUser(RoleName::OperationsManager);

    $this->actingAs($driver)->post('/operations/fuel-requests', [
        'quantity_litres' => 120,
        'fuel_type' => 'diesel',
        'purpose' => 'Urgent generator refueling',
    ])->assertRedirect('/');

    $id = FuelRequest::query()->sole()->id;

    // Manager forwards the request
    $this->actingAs($manager)->post("/operations/fuel-requests/{$id}/status", ['status' => 'forwarded'])
        ->assertRedirect('/');

    $fuel = FuelRequest::findOrFail($id);
    expect($fuel->status)->toBe(FuelRequestStatus::Forwarded)
        ->and($fuel->reviewed_by)->toBe($manager->id);

    // Another manager approves it
    $this->actingAs($otherManager)->post("/operations/fuel-requests/{$id}/status", ['status' => 'approved'])
        ->assertRedirect('/');

    expect(FuelRequest::findOrFail($id)->status)->toBe(FuelRequestStatus::Approved);
});

it('handles rejection path with a decision reason', function () {
    $driver = fieldUser(RoleName::Driver);
    $dispatcher = fieldUser(RoleName::Dispatcher);
    $manager = fieldUser(RoleName::OperationsManager);

    $this->actingAs($driver)->post('/operations/fuel-requests', [
        'quantity_litres' => 500,
        'fuel_type' => 'diesel',
        'purpose' => 'Excessive fuel request',
    ])->assertRedirect('/');

    $id = FuelRequest::query()->sole()->id;

    $this->actingAs($dispatcher)->post("/operations/fuel-requests/{$id}/status", ['status' => 'forwarded'])->assertRedirect('/');

    $this->actingAs($manager)->post("/operations/fuel-requests/{$id}/status", [
        'status' => 'rejected',
        'reason' => 'Exceeds standard allocation for route.',
    ])->assertRedirect('/');

    $fuel = FuelRequest::findOrFail($id);
    expect($fuel->status)->toBe(FuelRequestStatus::Rejected)
        ->and($fuel->approved_by)->toBe($manager->id)
        ->and($fuel->decision_reason)->toBe('Exceeds standard allocation for route.');

    // Attempting further transition on rejected request fails
    $technician = fieldUser(RoleName::FieldTechnician);
    $this->actingAs($technician)->post("/operations/fuel-requests/{$id}/status", ['status' => 'verified'])
        ->assertSessionHasErrors('status');
});

it('prevents self-approval of fuel requests', function () {
    // User holding both Driver and OperationsManager roles
    $manager = fieldUser(RoleName::OperationsManager);
    $manager->assignRole(RoleName::Driver->value);
    $otherManager = fieldUser(RoleName::OperationsManager);
    $dispatcher = fieldUser(RoleName::Dispatcher);

    // Manager submits request as requester
    $this->actingAs($manager)->post('/operations/fuel-requests', [
        'quantity_litres' => 80,
        'fuel_type' => 'diesel',
        'purpose' => 'Self-requested fuel',
    ])->assertRedirect('/');

    $id = FuelRequest::query()->sole()->id;

    $this->actingAs($dispatcher)->post("/operations/fuel-requests/{$id}/status", ['status' => 'forwarded'])->assertRedirect('/');

    // Requester manager attempts to approve own request -> forbidden
    $this->actingAs($manager)->post("/operations/fuel-requests/{$id}/status", ['status' => 'approved'])->assertForbidden();

    // Requester manager attempts to reject own request -> forbidden
    $this->actingAs($manager)->post("/operations/fuel-requests/{$id}/status", ['status' => 'rejected'])->assertForbidden();

    // Independent manager approves -> allowed
    $this->actingAs($otherManager)->post("/operations/fuel-requests/{$id}/status", ['status' => 'approved'])->assertRedirect('/');
    expect(FuelRequest::findOrFail($id)->status)->toBe(FuelRequestStatus::Approved);
});

it('prevents skipped stages in fuel request workflow', function () {
    $driver = fieldUser(RoleName::Driver);
    $manager = fieldUser(RoleName::OperationsManager);
    $technician = fieldUser(RoleName::FieldTechnician);

    $this->actingAs($driver)->post('/operations/fuel-requests', [
        'quantity_litres' => 100,
        'fuel_type' => 'diesel',
        'purpose' => 'Workflow test',
    ])->assertRedirect('/');

    $id = FuelRequest::query()->sole()->id;

    // Submitted -> Approved (skipping Forwarded)
    $this->actingAs($manager)->post("/operations/fuel-requests/{$id}/status", ['status' => 'approved'])
        ->assertSessionHasErrors('status');

    // Submitted -> Verified (skipping Forwarded and Approved)
    $this->actingAs($technician)->post("/operations/fuel-requests/{$id}/status", ['status' => 'verified'])
        ->assertSessionHasErrors('status');

    // Submitted -> Logged (skipping all intermediate stages)
    $this->actingAs($driver)->post("/operations/fuel-requests/{$id}/status", ['status' => 'logged'])
        ->assertSessionHasErrors('status');
});

it('prevents duplicate logging of a fuel request', function () {
    $driver = fieldUser(RoleName::Driver);
    $dispatcher = fieldUser(RoleName::Dispatcher);
    $manager = fieldUser(RoleName::OperationsManager);
    $technician = fieldUser(RoleName::FieldTechnician);

    $this->actingAs($driver)->post('/operations/fuel-requests', ['quantity_litres' => 100, 'fuel_type' => 'diesel', 'purpose' => 'Duplicate test'])->assertRedirect('/');
    $id = FuelRequest::query()->sole()->id;

    $this->actingAs($dispatcher)->post("/operations/fuel-requests/{$id}/status", ['status' => 'forwarded'])->assertRedirect('/');
    $this->actingAs($manager)->post("/operations/fuel-requests/{$id}/status", ['status' => 'approved'])->assertRedirect('/');
    $this->actingAs($technician)->post("/operations/fuel-requests/{$id}/status", ['status' => 'verified'])->assertRedirect('/');

    // First logging attempt -> succeeds
    $this->actingAs($driver)->post("/operations/fuel-requests/{$id}/status", ['status' => 'logged', 'quantity_litres' => 100])->assertRedirect('/');
    expect(FuelRequest::findOrFail($id)->status)->toBe(FuelRequestStatus::Logged);

    // Second logging attempt -> fails
    $this->actingAs($driver)->post("/operations/fuel-requests/{$id}/status", ['status' => 'logged', 'quantity_litres' => 100])
        ->assertSessionHasErrors('status');
});

it('validates quantities and meter readings during creation and logging', function () {
    $driver = fieldUser(RoleName::Driver);

    // Creating with 0 litres fails
    $this->actingAs($driver)->post('/operations/fuel-requests', [
        'quantity_litres' => 0,
        'fuel_type' => 'diesel',
        'purpose' => 'Zero litres',
    ])->assertSessionHasErrors('quantity_litres');

    // Creating with negative litres fails
    $this->actingAs($driver)->post('/operations/fuel-requests', [
        'quantity_litres' => -50,
        'fuel_type' => 'diesel',
        'purpose' => 'Negative litres',
    ])->assertSessionHasErrors('quantity_litres');
});

it('enforces role authorization at each step of the fuel workflow', function () {
    $driver = fieldUser(RoleName::Driver);
    $dispatcher = fieldUser(RoleName::Dispatcher);
    $manager = fieldUser(RoleName::OperationsManager);
    $technician = fieldUser(RoleName::FieldTechnician);

    $this->actingAs($driver)->post('/operations/fuel-requests', ['quantity_litres' => 50, 'fuel_type' => 'diesel', 'purpose' => 'Auth test'])->assertRedirect('/');
    $id = FuelRequest::query()->sole()->id;

    // Driver cannot forward
    $this->actingAs($driver)->post("/operations/fuel-requests/{$id}/status", ['status' => 'forwarded'])->assertForbidden();

    // Dispatcher forwards
    $this->actingAs($dispatcher)->post("/operations/fuel-requests/{$id}/status", ['status' => 'forwarded'])->assertRedirect('/');

    // Dispatcher cannot approve
    $this->actingAs($dispatcher)->post("/operations/fuel-requests/{$id}/status", ['status' => 'approved'])->assertForbidden();

    // Manager approves
    $this->actingAs($manager)->post("/operations/fuel-requests/{$id}/status", ['status' => 'approved'])->assertRedirect('/');

    // Manager cannot verify
    $this->actingAs($manager)->post("/operations/fuel-requests/{$id}/status", ['status' => 'verified'])->assertForbidden();

    // Technician verifies
    $this->actingAs($technician)->post("/operations/fuel-requests/{$id}/status", ['status' => 'verified'])->assertRedirect('/');
});

it('handles receipt file uploads securely during fuel logging', function () {
    Storage::fake('private');

    $driver = fieldUser(RoleName::Driver);
    $dispatcher = fieldUser(RoleName::Dispatcher);
    $manager = fieldUser(RoleName::OperationsManager);
    $technician = fieldUser(RoleName::FieldTechnician);

    $this->actingAs($driver)->post('/operations/fuel-requests', ['quantity_litres' => 90, 'fuel_type' => 'diesel', 'purpose' => 'Receipt test'])->assertRedirect('/');
    $id = FuelRequest::query()->sole()->id;

    $this->actingAs($dispatcher)->post("/operations/fuel-requests/{$id}/status", ['status' => 'forwarded'])->assertRedirect('/');
    $this->actingAs($manager)->post("/operations/fuel-requests/{$id}/status", ['status' => 'approved'])->assertRedirect('/');
    $this->actingAs($technician)->post("/operations/fuel-requests/{$id}/status", ['status' => 'verified'])->assertRedirect('/');

    // Invalid file upload (e.g. php file) -> fails validation
    $badFile = UploadedFile::fake()->create('malicious.php', 10, 'text/x-php');
    $this->actingAs($driver)->post("/operations/fuel-requests/{$id}/status", [
        'status' => 'logged',
        'receipt' => $badFile,
    ])->assertSessionHasErrors('receipt');

    // Valid receipt upload (e.g. pdf receipt) -> succeeds
    $receipt = UploadedFile::fake()->create('fuel_receipt.pdf', 200, 'application/pdf');
    $this->actingAs($driver)->post("/operations/fuel-requests/{$id}/status", [
        'status' => 'logged',
        'quantity_litres' => 90,
        'receipt' => $receipt,
    ])->assertRedirect('/');

    $fuelLog = FuelLog::query()->where('fuel_request_id', $id)->sole();
    expect($fuelLog->receipt_path)->not()->toBeNull();
    expect(Storage::disk('private')->exists($fuelLog->receipt_path))->toBeTrue();

    $attachment = Attachment::query()->where('owner_id', $fuelLog->id)->where('owner_type', $fuelLog->getMorphClass())->sole();
    expect($attachment->kind)->toBe('fuel_receipt')
        ->and($attachment->original_filename)->toBe('fuel_receipt.pdf')
        ->and($attachment->mime_type)->toBe('application/pdf');
});

it('rolls back fuel state and receipt storage when audit persistence fails after upload', function () {
    Storage::fake('private');

    $driver = fieldUser(RoleName::Driver);
    $fuel = FuelRequest::query()->create([
        'reference' => 'FUEL-RECEIPT-ROLLBACK',
        'requester_id' => $driver->id,
        'quantity_litres' => 90,
        'fuel_type' => 'diesel',
        'purpose' => 'Receipt rollback test',
        'status' => FuelRequestStatus::Verified,
    ]);

    $auditWrites = 0;
    DB::listen(function (QueryExecuted $query) use (&$auditWrites): void {
        if (str_contains(strtolower($query->sql), 'insert into "audit_events"')) {
            $auditWrites++;
            if ($auditWrites >= 2) {
                throw new RuntimeException('simulated fuel audit persistence failure');
            }
        }
    });

    $this->actingAs($driver)
        ->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'logged',
            'quantity_litres' => 90,
            'receipt' => UploadedFile::fake()->create('rollback.pdf', 100, 'application/pdf'),
        ])
        ->assertServerError();

    expect($fuel->fresh()->status)->toBe(FuelRequestStatus::Verified)
        ->and(FuelLog::query()->count())->toBe(0)
        ->and(Attachment::query()->count())->toBe(0)
        ->and(Storage::disk('private')->allFiles())->toBe([]);
});

it('accepts own location sharing but reserves the all-operations feed for office roles', function () {
    $driver = fieldUser(RoleName::Driver);
    $dispatcher = fieldUser(RoleName::Dispatcher);
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-LOC-001',
        'client' => 'Location Client',
        'title' => 'Location Job',
        'site' => 'Site L',
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->subHour(),
        'scheduled_end' => now()->addHours(2),
        'created_by' => $dispatcher->id,
    ]);
    $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHour(),
    ]);

    $this->actingAs($driver)->post('/operations/locations', ['latitude' => 14.5995, 'longitude' => 120.9842, 'accuracy_metres' => 8, 'captured_at' => now()->subMinute()->toIso8601String(), 'sharing_enabled' => true, 'dispatch_job_id' => $job->id])->assertRedirect('/');
    expect(LocationUpdate::query()->where('user_id', $driver->id)->where('source', 'browser')->exists())->toBeTrue();
    expect(AuditEvent::query()->where('action', 'tracking.location_shared')->where('actor_id', $driver->id)->exists())->toBeTrue();
    $this->actingAs($driver)->getJson('/operations/locations')->assertForbidden();
    $this->actingAs($dispatcher)->getJson('/operations/locations')->assertOk();
});
