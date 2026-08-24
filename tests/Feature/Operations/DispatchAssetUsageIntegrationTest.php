<?php

use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function r4Dispatcher(string $name = 'R4 Dispatcher'): User
{
    $dispatcher = User::factory()->create(['name' => $name]);
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);

    return $dispatcher;
}

function r4Approve(DispatchJob $job, User $dispatcher): void
{
    $manager = User::factory()->create(['name' => 'R4 Operations Manager']);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    ApprovalRequest::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'kind' => 'dispatch_activation',
        'status' => ApprovalStatus::Approved,
        'requested_by' => $dispatcher->id,
        'decided_by' => $manager->id,
        'decided_at' => now(),
        'reason' => 'Approved for dispatch safety test',
    ]);
}

function r4Asset(string $code, string $kind = 'equipment'): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => $code,
        'name' => 'R4 asset',
        'kind' => $kind,
        'status' => AssetStatus::Available,
    ]);
}

function r4DispatchJob(User $dispatcher, string $reference = 'R4-DISPATCH'): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => $reference,
        'client' => 'R4 client',
        'title' => 'R4 dispatch',
        'site' => 'R4 site',
        'scheduled_start' => CarbonImmutable::parse('2026-08-21 00:00:00'),
        'scheduled_end' => CarbonImmutable::parse('2026-08-21 04:00:00'),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Scheduled,
        'created_by' => $dispatcher->id,
        'version' => 1,
    ]);
}

function r4Rental(
    User $actor,
    OperationalAsset $asset,
    RentalReservationStatus $status,
    string $reference = 'R4-RENTAL',
    string $startDate = '2026-08-21',
    string $endDate = '2026-08-21',
): RentalReservation {
    $client = Client::query()->create([
        'code' => 'R4-'.strtoupper(Str::random(8)),
        'company_name' => 'R4 rental client',
        'status' => 'active',
    ]);
    $reservation = RentalReservation::query()->create([
        'reference' => $reference,
        'client_id' => $client->id,
        'created_by' => $actor->id,
        'status' => $status,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'total_cents' => 100,
    ]);
    RentalReservationItem::query()->create([
        'rental_reservation_id' => $reservation->id,
        'operational_asset_id' => $asset->id,
        'quantity' => 1,
        'rate_cents' => 100,
        'line_total_cents' => 100,
    ]);

    return $reservation;
}

function r4SalesOrder(User $actor, OperationalAsset $asset, SalesOrderStatus $status): SalesOrder
{
    $client = Client::query()->create([
        'code' => 'R4-'.strtoupper(Str::random(8)),
        'company_name' => 'R4 sales client',
        'status' => 'active',
    ]);
    $catalog = SalesCatalogItem::query()->create([
        'sku' => 'R4-'.strtoupper(Str::random(8)),
        'name' => 'R4 physical sale',
        'unit_price_cents' => 100,
        'quantity_on_hand' => 0,
        'quantity_reserved' => 0,
        'operational_asset_id' => $asset->id,
        'status' => 'active',
    ]);
    $order = SalesOrder::query()->create([
        'reference' => 'R4-SO-'.strtoupper(Str::random(8)),
        'client_id' => $client->id,
        'created_by' => $actor->id,
        'status' => $status,
        'currency' => 'PHP',
        'total_cents' => 100,
    ]);
    $order->items()->create([
        'sales_catalog_item_id' => $catalog->id,
        'quantity' => 1,
        'unit_price_cents' => 100,
        'line_total_cents' => 100,
    ]);

    return $order;
}

function r4Driver(User $dispatcher, DispatchJob $job): User
{
    $driver = User::factory()->create(['name' => 'R4 Driver']);
    $driver->syncRoles([RoleName::Driver->value]);
    $driver->personnelCredentials()->create([
        'kind' => 'driver_license',
        'credential_number' => 'R4-DL-'.strtoupper(Str::random(8)),
        'credential_type' => 'professional',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
        'status' => 'active',
    ]);
    $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    return $driver;
}

it('rejects assignment for each active rental reservation status', function (RentalReservationStatus $status): void {
    $dispatcher = r4Dispatcher();
    $asset = r4Asset('R4-RENTAL-'.$status->value);
    $job = r4DispatchJob($dispatcher, 'R4-RENTAL-'.$status->value);
    r4Rental($dispatcher, $asset, $status);

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/assignments", [
        'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'equipment']],
    ]);

    $response->assertSessionHasErrors(['assets']);
    expect($response->getSession()->get('errors')->get('assets')[0])
        ->toContain('another active rental reservation')
        ->and($job->assetAssignments()->count())->toBe(0);
})->with([
    'requested' => RentalReservationStatus::Requested,
    'reserved' => RentalReservationStatus::Reserved,
    'checked out' => RentalReservationStatus::CheckedOut,
]);

it('rejects assignment for each committed physical sales order status', function (SalesOrderStatus $status): void {
    $dispatcher = r4Dispatcher();
    $asset = r4Asset('R4-SALES-'.$status->value);
    $job = r4DispatchJob($dispatcher, 'R4-SALES-'.$status->value);
    r4SalesOrder($dispatcher, $asset, $status);

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/assignments", [
        'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'equipment']],
    ]);

    $response->assertSessionHasErrors(['assets']);
    expect($response->getSession()->get('errors')->get('assets')[0])
        ->toContain('committed to another sales order')
        ->and($job->assetAssignments()->count())->toBe(0);
})->with([
    'confirmed' => SalesOrderStatus::Confirmed,
    'fulfilled' => SalesOrderStatus::Fulfilled,
    'transferred' => SalesOrderStatus::Transferred,
]);

it('allows an assignment when the rental window does not overlap', function (): void {
    $dispatcher = r4Dispatcher();
    $asset = r4Asset('R4-RENTAL-NONOVERLAP');
    $job = r4DispatchJob($dispatcher, 'R4-RENTAL-NONOVERLAP');
    r4Rental($dispatcher, $asset, RentalReservationStatus::Requested, startDate: '2026-08-10', endDate: '2026-08-12');

    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
            'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'equipment']],
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    expect($job->assetAssignments()->count())->toBe(1);
});

it('allows an assignment at the exact inclusive-rental end boundary', function (): void {
    $dispatcher = r4Dispatcher();
    $asset = r4Asset('R4-RENTAL-BOUNDARY');
    $job = r4DispatchJob($dispatcher, 'R4-RENTAL-BOUNDARY');
    r4Rental($dispatcher, $asset, RentalReservationStatus::Requested, startDate: '2026-08-20', endDate: '2026-08-20');

    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
            'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'equipment']],
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    expect($job->assetAssignments()->count())->toBe(1);
});

it('rejects an assignment that duplicates an active asset on the same dispatch', function (): void {
    $dispatcher = r4Dispatcher();
    $asset = r4Asset('R4-SAME-JOB');
    $job = r4DispatchJob($dispatcher, 'R4-SAME-JOB');
    $job->assetAssignments()->create([
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'equipment',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/assignments", [
        'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'equipment']],
    ]);

    $response->assertSessionHasErrors(['assets']);
    expect($response->getSession()->get('errors')->get('assets')[0])->toContain('already assigned to this dispatch');
});

it('uses the same rental blocker reason in the read model and assignment write path', function (): void {
    $dispatcher = r4Dispatcher();
    $asset = r4Asset('R4-READ-WRITE');
    $job = r4DispatchJob($dispatcher, 'R4-READ-WRITE');
    r4Rental($dispatcher, $asset, RentalReservationStatus::Requested);

    $this->actingAs($dispatcher)
        ->get("/operations/dispatch-jobs/{$job->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('dispatch-candidates', fn (Assert $deferred) => $deferred
                ->where('asset_candidates.data.0.code', 'R4-READ-WRITE')
                ->where('asset_candidates.data.0.eligible', false)
                ->where('asset_candidates.data.0.reasons.0', 'The asset is committed to another active rental reservation.')));

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/assignments", [
        'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'equipment']],
    ]);

    $response->assertSessionHasErrors(['assets']);
    expect($response->getSession()->get('errors')->get('assets')[0])
        ->toContain('The asset is committed to another active rental reservation.');
});

it('rechecks a late rental commitment before activation', function (): void {
    $dispatcher = r4Dispatcher();
    $asset = r4Asset('R4-LATE-RENTAL');
    $job = r4DispatchJob($dispatcher, 'R4-LATE-RENTAL');
    r4Driver($dispatcher, $job);
    $job->assetAssignments()->create([
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'equipment',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);
    r4Rental($dispatcher, $asset, RentalReservationStatus::Requested, 'R4-LATE-RENTAL-RESERVATION');
    r4Approve($job, $dispatcher);

    $this->actingAs($dispatcher)
        ->get("/operations/dispatch-jobs/{$job->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('activation.ready', false)
            ->where('activation.blockers.0', 'R4-LATE-RENTAL is not currently safe for dispatch: The asset is committed to another active rental reservation.'));

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1]);

    $response->assertSessionHasErrors(['assets']);
    expect($response->getSession()->get('errors')->get('assets')[0])
        ->toContain('The asset is committed to another active rental reservation.')
        ->and($job->fresh()->status)->toBe(DispatchStatus::Scheduled);
});

it('rechecks a late committed sale before activation', function (): void {
    $dispatcher = r4Dispatcher();
    $asset = r4Asset('R4-LATE-SALE');
    $job = r4DispatchJob($dispatcher, 'R4-LATE-SALE');
    r4Driver($dispatcher, $job);
    $job->assetAssignments()->create([
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'equipment',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);
    r4SalesOrder($dispatcher, $asset, SalesOrderStatus::Confirmed);
    r4Approve($job, $dispatcher);

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1]);

    $response->assertSessionHasErrors(['assets']);
    expect($job->fresh()->status)->toBe(DispatchStatus::Scheduled);
});

it('checks replacement assets during reassignment and leaves the old assignment active on conflict', function (): void {
    $dispatcher = r4Dispatcher();
    $oldAsset = r4Asset('R4-REASSIGN-OLD');
    $newAsset = r4Asset('R4-REASSIGN-NEW');
    $job = r4DispatchJob($dispatcher, 'R4-REASSIGN-CONFLICT');
    $oldAssignment = $job->assetAssignments()->create([
        'operational_asset_id' => $oldAsset->id,
        'assignment_type' => 'equipment',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);
    r4Rental($dispatcher, $newAsset, RentalReservationStatus::Reserved, 'R4-REASSIGN-RENTAL');

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/reassign", [
        'end_asset_assignment_ids' => [$oldAssignment->id],
        'assets' => [['operational_asset_id' => $newAsset->id, 'assignment_type' => 'equipment']],
        'version' => 1,
    ]);

    $response->assertSessionHasErrors(['assets']);
    expect($oldAssignment->fresh()->active_until)->toBeNull()
        ->and($job->assetAssignments()->where('operational_asset_id', $newAsset->id)->exists())->toBeFalse();
});

it('only excludes assignment rows being ended when reusing an asset on the same dispatch', function (): void {
    $dispatcher = r4Dispatcher();
    $dispatcher->givePermissionTo(PermissionName::AssignmentsOverride->value);
    $asset = r4Asset('R4-REASSIGN-SELF');
    $job = r4DispatchJob($dispatcher, 'R4-REASSIGN-SELF');
    $oldAssignment = $job->assetAssignments()->create([
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'equipment',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $duplicate = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/reassign", [
        'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'equipment']],
        'version' => 1,
    ]);
    $duplicate->assertSessionHasErrors(['assets']);

    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/reassign", [
            'end_asset_assignment_ids' => [$oldAssignment->id],
            'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'equipment']],
            'version' => 1,
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    expect($oldAssignment->fresh()->active_until)->not->toBeNull()
        ->and($job->assetAssignments()->whereNull('active_until')->count())->toBe(1);
});
