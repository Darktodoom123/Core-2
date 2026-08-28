<?php

use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Models\JobReport;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('contains the normalized physical mapping for every supplied ERD entity', function () {
    foreach ([
        'clients',
        'service_requests',
        'personnel_profiles',
        'personnel_credentials',
        'operational_assets',
        'dispatch_jobs',
        'location_updates',
        'job_reports',
        'gpt_recommendations',
        'fuel_logs',
        'maintenance_work_orders',
        'notifications',
        'attachments',
        'rental_reservations',
        'rental_reservation_items',
        'rental_operator_assignments',
        'rental_checkouts',
        'rental_returns',
        'sales_catalog_items',
        'sales_quotes',
        'sales_quote_items',
        'sales_orders',
        'sales_order_items',
        'sales_inventory_ledger',
        'ownership_transfers',
    ] as $table) {
        expect(Schema::hasTable($table))->toBeTrue("Expected {$table} to exist.");
    }

    expect(Schema::hasColumns('users', ['username', 'phone', 'is_active', 'suspended_at']))->toBeTrue()
        ->and(Schema::hasColumns('operational_assets', ['registration_number', 'manufacturer', 'model', 'rated_capacity', 'capacity_unit', 'meter_type', 'meter_value']))->toBeTrue()
        ->and(Schema::hasColumns('location_updates', ['dispatch_job_id', 'speed', 'remarks']))->toBeTrue()
        ->and(Schema::hasColumns('fuel_logs', ['price_per_litre', 'total_cost', 'fuel_station', 'remarks']))->toBeTrue()
        ->and(Schema::hasColumns('maintenance_work_orders', ['scheduled_at', 'next_due_at', 'release_verified_by', 'release_checklist']))->toBeTrue()
        ->and(Schema::hasColumns('rental_reservations', ['reference', 'client_id', 'created_by', 'approved_by', 'dispatch_job_id', 'status', 'start_date', 'end_date', 'delivery_location', 'fulfillment_mode', 'notes', 'total_cents', 'deleted_at']))->toBeTrue()
        ->and(Schema::hasColumns('rental_reservation_items', ['rental_reservation_id', 'operational_asset_id', 'quantity', 'rate_cents', 'line_total_cents']))->toBeTrue()
        ->and(Schema::hasColumns('rental_operator_assignments', ['rental_reservation_id', 'rental_reservation_item_id', 'user_id', 'operator_type', 'assigned_by', 'active_from', 'active_until']))->toBeTrue()
        ->and(Schema::hasColumns('rental_checkouts', ['rental_reservation_id', 'checked_out_by', 'checked_out_at', 'condition_before', 'notes']))->toBeTrue()
        ->and(Schema::hasColumns('rental_returns', ['rental_reservation_id', 'returned_by', 'returned_at', 'condition_after', 'damage_notes']))->toBeTrue()
        ->and(Schema::hasColumns('sales_catalog_items', ['sku', 'name', 'description', 'unit_price_cents', 'quantity_on_hand', 'quantity_reserved', 'operational_asset_id', 'status']))->toBeTrue()
        ->and(Schema::hasColumns('sales_quotes', ['reference', 'client_id', 'created_by', 'status', 'currency', 'total_cents', 'valid_until', 'notes']))->toBeTrue()
        ->and(Schema::hasColumns('sales_quote_items', ['sales_quote_id', 'sales_catalog_item_id', 'quantity', 'unit_price_cents', 'line_total_cents']))->toBeTrue()
        ->and(Schema::hasColumns('sales_orders', ['reference', 'client_id', 'sales_quote_id', 'created_by', 'status', 'currency', 'total_cents', 'fulfilled_at']))->toBeTrue()
        ->and(Schema::hasColumns('sales_order_items', ['sales_order_id', 'sales_catalog_item_id', 'quantity', 'unit_price_cents', 'line_total_cents']))->toBeTrue()
        ->and(Schema::hasColumns('sales_inventory_ledger', ['sales_catalog_item_id', 'sales_order_id', 'created_by', 'entry_type', 'quantity_delta', 'metadata']))->toBeTrue()
        ->and(Schema::hasColumns('ownership_transfers', ['sales_order_id', 'sales_order_item_id', 'sales_catalog_item_id', 'operational_asset_id', 'transferred_by', 'transferred_at']))->toBeTrue();

    expect(collect(Schema::getIndexes('rental_reservations'))->pluck('name'))
        ->toContain('rental_reservations_reference_unique')
        ->and(collect(Schema::getIndexes('rental_operator_assignments'))->pluck('name'))
        ->toContain('rental_operator_assignments_rental_reservation_item_id_user_id_unique')
        ->and(collect(Schema::getIndexes('rental_checkouts'))->pluck('name'))
        ->toContain('rental_checkouts_rental_reservation_id_unique')
        ->and(collect(Schema::getIndexes('rental_returns'))->pluck('name'))
        ->toContain('rental_returns_rental_reservation_id_unique')
        ->and(collect(Schema::getIndexes('sales_catalog_items'))->pluck('name'))
        ->toContain('sales_catalog_items_sku_unique')
        ->toContain('sales_catalog_items_operational_asset_id_unique')
        ->and(collect(Schema::getIndexes('sales_quotes'))->pluck('name'))
        ->toContain('sales_quotes_reference_unique')
        ->and(collect(Schema::getIndexes('sales_orders'))->pluck('name'))
        ->toContain('sales_orders_reference_unique')
        ->and(collect(Schema::getIndexes('ownership_transfers'))->pluck('name'))
        ->toContain('ownership_transfers_operational_asset_id_unique')
        ->toContain('ownership_transfers_sales_order_item_id_sales_catalog_item_id_unique');
});

it('creates a client request and linked dispatch without duplicating ERD identity records', function () {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $clientId = $this->actingAs($dispatcher)->postJson('/operations/clients', [
        'code' => 'CLI-001',
        'company_name' => 'Arcwell Construction',
        'contact_person' => 'Ana Reyes',
        'phone' => '+63 900 000 0000',
        'email' => 'ana@example.com',
        'address' => 'Quezon City',
    ])->assertCreated()->json('data.id');

    $requestId = $this->actingAs($dispatcher)->postJson('/operations/service-requests', [
        'reference' => 'SR-1001',
        'client_id' => $clientId,
        'project_name' => 'Plant lift',
        'service_type' => 'crane_and_truck',
        'location' => 'Pasig City',
        'scheduled_date' => now()->addDay()->toIso8601String(),
        'priority' => 'routine',
        'requirements' => ['25t crane', 'flatbed truck'],
    ])->assertCreated()->json('data.id');

    $this->actingAs($dispatcher)->post('/operations/dispatch-jobs', [
        'service_request_id' => $requestId,
        'reference' => 'DSP-1001',
        'scheduled_start' => now()->addDay()->toIso8601String(),
        'scheduled_end' => now()->addDay()->addHours(4)->toIso8601String(),
    ])->assertRedirect('/');

    $job = DispatchJob::query()->where('reference', 'DSP-1001')->sole();

    expect(Client::findOrFail($clientId)->serviceRequests)->toHaveCount(1)
        ->and(ServiceRequest::findOrFail($requestId)->dispatchJobs)->toHaveCount(1)
        ->and($job->client)->toBe('Arcwell Construction')
        ->and($job->title)->toBe('Plant lift')
        ->and($job->serviceRequest?->id)->toBe($requestId);
});

it('stores personnel availability and verified credentials through administration', function () {
    $administrator = User::factory()->create();
    $administrator->syncRoles([RoleName::SystemAdministrator->value]);
    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::CraneOperator->value]);

    $this->actingAs($administrator)->patchJson("/operations/users/{$driver->id}/personnel-profile", [
        'employee_number' => 'DRV-001',
        'availability_status' => 'available',
        'emergency_contact_name' => 'Maria Driver',
        'emergency_contact_phone' => '+63 900 111 1111',
    ])->assertOk();

    $this->actingAs($administrator)->postJson("/operations/users/{$driver->id}/credentials", [
        'kind' => 'driver_license',
        'credential_number' => 'N01-23-456789',
        'credential_type' => 'professional',
        'issued_at' => now()->subYear()->toDateString(),
        'expires_at' => now()->addYear()->toDateString(),
    ])->assertCreated();

    expect($driver->refresh()->personnelProfile?->availability_status)->toBe('available')
        ->and($driver->personnelCredentials()->validAt(now())->count())->toBe(1);
});

it('relates final job reports to private attachment metadata', function () {
    $dispatcher = User::factory()->create();
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-REPORT-1',
        'client' => 'Northline',
        'title' => 'Lift report',
        'site' => 'Manila',
        'scheduled_start' => now(),
        'scheduled_end' => now()->addHour(),
        'priority' => 'routine',
        'status' => 'completed',
        'created_by' => $dispatcher->id,
    ]);
    $report = JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $dispatcher->id,
        'work_summary' => 'Lift completed safely.',
        'status' => 'submitted',
        'submitted_at' => now(),
    ]);
    $report->attachments()->create([
        'uploaded_by' => $dispatcher->id,
        'kind' => 'job_image',
        'disk' => 'private',
        'path' => 'job-reports/report-1/image.jpg',
        'original_filename' => 'image.jpg',
        'mime_type' => 'image/jpeg',
        'size_bytes' => 1024,
        'checksum_sha256' => str_repeat('a', 64),
    ]);

    expect($job->reports)->toHaveCount(1)
        ->and($report->attachments)->toHaveCount(1)
        ->and($report->attachments->first()?->disk)->toBe('private');
});
