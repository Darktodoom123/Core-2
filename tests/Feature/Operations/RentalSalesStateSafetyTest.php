<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalCheckout;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesQuote;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\Inspection;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    $this->seed(RolePermissionSeeder::class);
});

function r0StateUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

function r0StateClient(): Client
{
    return Client::query()->create([
        'code' => 'CLI-R0-'.fake()->unique()->numerify('####'),
        'company_name' => 'R0 Regression Customer',
        'status' => 'active',
    ]);
}

function r0StateAsset(string $code, AssetStatus $status = AssetStatus::Available): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => $code,
        'name' => 'R0 regression asset',
        'kind' => 'equipment',
        'status' => $status,
    ]);
}

function r0StateReservation(
    User $creator,
    Client $client,
    OperationalAsset $asset,
    RentalReservationStatus $status = RentalReservationStatus::Reserved,
): RentalReservation {
    $start = CarbonImmutable::now()->addDays(2)->startOfDay();
    $end = $start->addDay();
    $reservation = RentalReservation::query()->create([
        'reference' => 'REN-R0-'.fake()->unique()->numerify('#####'),
        'client_id' => $client->id,
        'created_by' => $creator->id,
        'status' => $status,
        'start_date' => $start,
        'end_date' => $end,
        'fulfillment_mode' => 'delivery',
        'total_cents' => 100,
    ]);

    RentalReservationItem::query()->create([
        'rental_reservation_id' => $reservation->id,
        'operational_asset_id' => $asset->id,
        'quantity' => 1,
        'rate_cents' => 100,
        'line_total_cents' => 200,
    ]);

    return $reservation->fresh();
}

function r0StateDispatchJob(User $creator, CarbonImmutable $start, CarbonImmutable $end): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => 'DSP-R0-'.fake()->unique()->numerify('#####'),
        'client' => 'R0 Dispatch Customer',
        'title' => 'R0 asset usage regression',
        'site' => 'R0 test site',
        'scheduled_start' => $start,
        'scheduled_end' => $end,
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Scheduled,
        'created_by' => $creator->id,
        'version' => 1,
    ]);
}

function r0StateCommitment(
    User $creator,
    Client $client,
    OperationalAsset $asset,
    SalesOrderStatus $status,
): SalesOrder {
    $catalog = SalesCatalogItem::query()->create([
        'sku' => 'SKU-R0-'.fake()->unique()->numerify('#####'),
        'name' => 'R0 committed asset',
        'unit_price_cents' => 100,
        'quantity_on_hand' => $status === SalesOrderStatus::Confirmed ? 1 : 0,
        'quantity_reserved' => $status === SalesOrderStatus::Confirmed ? 1 : 0,
        'operational_asset_id' => $asset->id,
        'status' => 'active',
    ]);
    $order = SalesOrder::query()->create([
        'reference' => 'SO-R0-'.fake()->unique()->numerify('#####'),
        'client_id' => $client->id,
        'created_by' => $creator->id,
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

    return $order->fresh(['items.catalogItem']);
}

it('requires non-empty bounded condition evidence for checkout and return', function (string $operation, string $shape): void {
    $actor = r0StateUser(RoleName::Dispatcher);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-CONDITION-'.fake()->unique()->numerify('###'));
    $reservation = r0StateReservation(
        $actor,
        $client,
        $asset,
        $operation === 'checkout' ? RentalReservationStatus::Reserved : RentalReservationStatus::CheckedOut,
    );

    if ($operation === 'return') {
        RentalCheckout::query()->create([
            'rental_reservation_id' => $reservation->id,
            'checked_out_by' => $actor->id,
            'checked_out_at' => now(),
            'condition_before' => ['engine' => 'good'],
        ]);
    }

    $payload = match ($shape) {
        'missing' => [],
        'null' => ['condition' => null],
        'empty' => ['condition' => []],
        'nested' => ['condition' => ['engine' => ['nested']]],
        'blank' => ['condition' => ['engine' => '   ']],
        'oversize' => ['condition' => ['engine' => str_repeat('x', 256)]],
        'too_many_entries' => ['condition' => array_fill_keys(array_map(static fn (int $index): string => "item_{$index}", range(1, 51)), 'good')],
    };
    $url = $operation === 'checkout'
        ? "/operations/rental-reservations/{$reservation->id}/checkout"
        : "/operations/rental-reservations/{$reservation->id}/return";

    $this->actingAs($actor)
        ->postJson($url, $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(in_array($shape, ['nested', 'blank', 'oversize'], true) ? 'condition.engine' : 'condition');

    $evidenceTable = $operation === 'checkout' ? 'rental_checkouts' : 'rental_returns';
    expect($this->getConnection()->table($evidenceTable)->count())->toBe(0);
    expect($reservation->fresh()->status)->toBe(
        $operation === 'checkout' ? RentalReservationStatus::Reserved : RentalReservationStatus::CheckedOut,
    );
})->with([
    ['checkout', 'missing'],
    ['checkout', 'null'],
    ['checkout', 'empty'],
    ['checkout', 'nested'],
    ['checkout', 'blank'],
    ['checkout', 'oversize'],
    ['checkout', 'too_many_entries'],
    ['return', 'missing'],
    ['return', 'null'],
    ['return', 'empty'],
    ['return', 'nested'],
    ['return', 'blank'],
    ['return', 'oversize'],
    ['return', 'too_many_entries'],
]);

it('revalidates rental checkout after each operational blocker appears', function (string $blocker): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $manager = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-LATE-'.fake()->unique()->numerify('###'));
    $start = CarbonImmutable::now()->addDays(2)->startOfDay();
    $reservation = r0StateReservation($dispatcher, $client, $asset, RentalReservationStatus::Requested);

    $this->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertOk();

    if ($blocker === 'unavailable') {
        $asset->update(['status' => AssetStatus::Unavailable]);
    } elseif ($blocker === 'maintenance') {
        MaintenanceWorkOrder::query()->create([
            'operational_asset_id' => $asset->id,
            'technician_id' => $manager->id,
            'status' => AssetStatus::UnderMaintenance,
            'defect' => 'R0 blocking maintenance',
            'dispatch_blocking' => true,
        ]);
    } elseif ($blocker === 'sale') {
        r0StateCommitment($manager, $client, $asset, SalesOrderStatus::Fulfilled);
    } elseif ($blocker === 'dispatch') {
        $job = r0StateDispatchJob($manager, $start->addHours(4), $start->addHours(8));
        DispatchAssetAssignment::query()->create([
            'dispatch_job_id' => $job->id,
            'operational_asset_id' => $asset->id,
            'assignment_type' => 'equipment',
            'assigned_by' => $manager->id,
            'active_from' => $job->scheduled_start,
        ]);
    }

    $this->actingAs($dispatcher)
        ->postJson("/operations/rental-reservations/{$reservation->id}/checkout", ['condition' => ['engine' => 'good']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');

    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::Reserved);
    expect($this->getConnection()->table('rental_checkouts')->count())->toBe(0);
})->with(['unavailable', 'maintenance', 'sale', 'dispatch']);

it('keeps confirmed, fulfilled, and transferred physical sales committed against rental approval', function (SalesOrderStatus $status): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $manager = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-SALE-'.fake()->unique()->numerify('###'));
    r0StateCommitment($manager, $client, $asset, $status);
    $reservation = r0StateReservation($dispatcher, $client, $asset, RentalReservationStatus::Requested);

    $this->actingAs($manager)
        ->postJson("/operations/rental-reservations/{$reservation->id}/approve")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');

    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::Requested);
})->with([
    SalesOrderStatus::Confirmed,
    SalesOrderStatus::Fulfilled,
    SalesOrderStatus::Transferred,
]);

it('keeps committed physical sales out of dispatch eligibility', function (SalesOrderStatus $status): void {
    $manager = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-DISPATCH-SALE-'.fake()->unique()->numerify('###'));
    r0StateCommitment($manager, $client, $asset, $status);
    $job = r0StateDispatchJob($manager, CarbonImmutable::now()->addHours(2), CarbonImmutable::now()->addHours(4));

    $assessment = app(DispatchResourceEligibility::class)->asset($asset->fresh(), 'equipment', $job);

    expect($assessment['eligible'])->toBeFalse();
})->with([
    SalesOrderStatus::Confirmed,
    SalesOrderStatus::Fulfilled,
    SalesOrderStatus::Transferred,
]);

it('keeps rental reservations out of dispatch eligibility', function (): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-RENT-DISPATCH-'.fake()->unique()->numerify('###'));
    r0StateReservation($dispatcher, $client, $asset, RentalReservationStatus::Requested);
    $start = CarbonImmutable::now()->addDays(2)->startOfDay()->addHours(2);
    $job = r0StateDispatchJob($dispatcher, $start, $start->addHours(4));

    $assessment = app(DispatchResourceEligibility::class)->asset($asset->fresh(), 'equipment', $job);

    expect($assessment['eligible'])->toBeFalse();
});

it('keeps dispatch assignments out of rental creation', function (): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-DISPATCH-RENT-'.fake()->unique()->numerify('###'));
    $start = CarbonImmutable::now()->addDays(2)->startOfDay();
    $job = r0StateDispatchJob($dispatcher, $start->addHours(2), $start->addHours(5));
    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'equipment',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-DISPATCH-CONFLICT',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->addDay()->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items');

    expect(RentalReservation::query()->where('reference', 'REN-R0-DISPATCH-CONFLICT')->exists())->toBeFalse();
});

it('rejects duplicate rental asset IDs before creating a reservation', function (): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-DUPLICATE-'.fake()->unique()->numerify('###'));
    $start = CarbonImmutable::now()->addDays(2)->startOfDay();

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-DUPLICATE',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [
                ['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100],
                ['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items.1.operational_asset_id');

    expect(RentalReservation::query()->where('reference', 'REN-R0-DUPLICATE')->exists())->toBeFalse();
});

it('persists valid rental checkout and return condition evidence as JSON', function (): void {
    $actor = r0StateUser(RoleName::Dispatcher);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-EVIDENCE-'.fake()->unique()->numerify('###'));
    $reservation = r0StateReservation($actor, $client, $asset, RentalReservationStatus::Reserved);

    $this->actingAs($actor)
        ->postJson("/operations/rental-reservations/{$reservation->id}/checkout", [
            'condition' => ['engine' => 'good', 'hydraulics' => 'normal'],
        ])
        ->assertOk();

    $this->actingAs($actor)
        ->postJson("/operations/rental-reservations/{$reservation->id}/return", [
            'condition' => ['engine' => 'good', 'hydraulics' => 'normal'],
            'damage_notes' => 'No new damage observed.',
        ])
        ->assertOk();

    expect($reservation->fresh()->checkout->condition_before)->toBe([
        'engine' => 'good',
        'hydraulics' => 'normal',
    ])->and($reservation->fresh()->returnRecord->condition_after)->toBe([
        'engine' => 'good',
        'hydraulics' => 'normal',
    ]);
});

it('does not restore a returned rental asset that became committed to a terminal sale', function (): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $manager = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-RETURN-SALE-'.fake()->unique()->numerify('###'), AssetStatus::Assigned);
    $reservation = r0StateReservation($dispatcher, $client, $asset, RentalReservationStatus::CheckedOut);
    RentalCheckout::query()->create([
        'rental_reservation_id' => $reservation->id,
        'checked_out_by' => $dispatcher->id,
        'checked_out_at' => now(),
        'condition_before' => ['engine' => 'good'],
    ]);
    r0StateCommitment($manager, $client, $asset, SalesOrderStatus::Transferred);

    $this->actingAs($dispatcher)
        ->postJson("/operations/rental-reservations/{$reservation->id}/return", [
            'condition' => ['engine' => 'good'],
        ])
        ->assertOk();

    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::Returned)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Assigned)
        ->and($reservation->fresh()->returnRecord->condition_after)->toBe(['engine' => 'good']);
});

it('allows an exact dispatch end to rental start boundary', function (): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-BOUNDARY-'.fake()->unique()->numerify('###'));
    $start = CarbonImmutable::now()->addDays(2)->startOfDay();
    $job = r0StateDispatchJob($dispatcher, $start->subHours(4), $start);
    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'equipment',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-BOUNDARY',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->addDay()->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
        ])
        ->assertCreated();
});

it('revalidates a linked asset before sales fulfillment', function (): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $manager = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-FULFILL-'.fake()->unique()->numerify('###'));
    $catalog = SalesCatalogItem::query()->create([
        'sku' => 'SKU-R0-FULFILL-'.fake()->unique()->numerify('###'),
        'name' => 'R0 fulfillment asset',
        'unit_price_cents' => 100,
        'quantity_on_hand' => 1,
        'quantity_reserved' => 0,
        'operational_asset_id' => $asset->id,
        'status' => 'active',
    ]);

    $this->actingAs($dispatcher)->postJson('/operations/sales/quotes', [
        'reference' => 'QUO-R0-FULFILL',
        'client_id' => $client->id,
        'items' => [['sales_catalog_item_id' => $catalog->id, 'quantity' => 1]],
    ])->assertCreated();
    $quote = SalesQuote::query()->where('reference', 'QUO-R0-FULFILL')->sole();
    $this->actingAs($manager)->postJson("/operations/sales/quotes/{$quote->id}/accept")->assertCreated();
    $order = SalesOrder::query()->where('sales_quote_id', $quote->id)->sole();
    $asset->update(['status' => AssetStatus::Unavailable]);

    $this->actingAs($manager)
        ->postJson("/operations/sales/orders/{$order->id}/fulfill")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items');

    expect($order->fresh()->status)->toBe(SalesOrderStatus::Confirmed)
        ->and($catalog->fresh()->quantity_on_hand)->toBe(1)
        ->and($catalog->fresh()->quantity_reserved)->toBe(1);
});

it('rejects generic operational restoration after ownership transfer', function (): void {
    $manager = r0StateUser(RoleName::OperationsManager);
    $asset = r0StateAsset('EQ-R0-TERMINAL-'.fake()->unique()->numerify('###'), AssetStatus::Unavailable);
    Inspection::query()->create([
        'operational_asset_id' => $asset->id,
        'technician_id' => $manager->id,
        'type' => 'safety',
        'result' => 'passed',
        'checklist' => ['terminal' => true],
        'completed_at' => now(),
    ]);

    $this->actingAs($manager)
        ->postJson("/operations/assets/{$asset->id}/status", [
            'status' => AssetStatus::Available->value,
            'reason' => 'Attempted generic restoration',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');

    expect($asset->fresh()->status)->toBe(AssetStatus::Unavailable);
});

it('rejects a persisted value above the signed integer maximum', function (): void {
    $manager = r0StateUser(RoleName::OperationsManager);

    $this->actingAs($manager)
        ->postJson('/operations/sales/catalog', [
            'sku' => 'SKU-R0-OVER-MAX',
            'name' => 'Overflow item',
            'unit_price_cents' => 2_147_483_648,
            'quantity_on_hand' => 1,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('unit_price_cents');
});

it('accepts the maximum safe persisted money and count values', function (): void {
    $manager = r0StateUser(RoleName::OperationsManager);

    $this->actingAs($manager)
        ->postJson('/operations/sales/catalog', [
            'sku' => 'SKU-R0-MAX-SAFE',
            'name' => 'Maximum safe item',
            'unit_price_cents' => 2_147_483_647,
            'quantity_on_hand' => 2_147_483_647,
        ])
        ->assertCreated();
});

it('rejects a count above the signed integer maximum', function (): void {
    $manager = r0StateUser(RoleName::OperationsManager);

    $this->actingAs($manager)
        ->postJson('/operations/sales/catalog', [
            'sku' => 'SKU-R0-OVER-COUNT',
            'name' => 'Overflow count item',
            'unit_price_cents' => 1,
            'quantity_on_hand' => 2_147_483_648,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('quantity_on_hand');
});

it('accepts a 48-character quote reference and derives its order reference', function (): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $manager = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $catalog = SalesCatalogItem::query()->create([
        'sku' => 'SKU-R0-REF-'.fake()->unique()->numerify('###'),
        'name' => 'R0 reference item',
        'unit_price_cents' => 100,
        'quantity_on_hand' => 1,
        'quantity_reserved' => 0,
        'status' => 'active',
    ]);
    $reference = str_repeat('Q', 48);

    $this->actingAs($dispatcher)->postJson('/operations/sales/quotes', [
        'reference' => $reference,
        'client_id' => $client->id,
        'items' => [['sales_catalog_item_id' => $catalog->id, 'quantity' => 1]],
    ])->assertCreated();
    $quote = SalesQuote::query()->where('reference', $reference)->sole();

    $this->actingAs($manager)->postJson("/operations/sales/quotes/{$quote->id}/accept")->assertCreated();

    expect(SalesOrder::query()->where('reference', 'SO-'.$reference)->exists())->toBeTrue();
});

it('rejects rental line multiplication overflow before persistence', function (): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-RATE-OVERFLOW');
    $start = CarbonImmutable::now()->addDays(2);

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-RATE-OVERFLOW',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->addDay()->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 2_147_483_647]],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items');
});

it('accepts the maximum safe rental line total', function (): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-RENTAL-MAX');
    $start = CarbonImmutable::now()->addDays(2);

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-RENTAL-MAX',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 2_147_483_647]],
        ])
        ->assertCreated();

    $reservation = RentalReservation::query()->where('reference', 'REN-R0-RENTAL-MAX')->sole();
    expect($reservation->total_cents)->toBe(2_147_483_647)
        ->and($reservation->items()->sole()->line_total_cents)->toBe(2_147_483_647);
});

it('rejects a rental rate above the signed integer maximum', function (): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-RENTAL-OVER-MAX');
    $start = CarbonImmutable::now()->addDays(2);

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-RENTAL-OVER-MAX',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 2_147_483_648]],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items.0.rate_cents');

    expect(RentalReservation::query()->where('reference', 'REN-R0-RENTAL-OVER-MAX')->exists())->toBeFalse();
});

it('rejects rental aggregate overflow before persistence', function (): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $client = r0StateClient();
    $first = r0StateAsset('EQ-R0-RENTAL-AGG-1');
    $second = r0StateAsset('EQ-R0-RENTAL-AGG-2');
    $start = CarbonImmutable::now()->addDays(2);

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-RENTAL-AGG-OVERFLOW',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [
                ['operational_asset_id' => $first->id, 'quantity' => 1, 'rate_cents' => 2_147_483_647],
                ['operational_asset_id' => $second->id, 'quantity' => 1, 'rate_cents' => 1],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items');

    expect(RentalReservation::query()->where('reference', 'REN-R0-RENTAL-AGG-OVERFLOW')->exists())->toBeFalse();
});

it('rejects multi-line aggregate overflow before quote persistence', function (): void {
    $dispatcher = r0StateUser(RoleName::Dispatcher);
    $client = r0StateClient();
    $first = SalesCatalogItem::query()->create([
        'sku' => 'SKU-R0-AGG-1',
        'name' => 'Aggregate item one',
        'unit_price_cents' => 2_147_483_647,
        'quantity_on_hand' => 1,
        'quantity_reserved' => 0,
        'status' => 'active',
    ]);
    $second = SalesCatalogItem::query()->create([
        'sku' => 'SKU-R0-AGG-2',
        'name' => 'Aggregate item two',
        'unit_price_cents' => 2_147_483_647,
        'quantity_on_hand' => 1,
        'quantity_reserved' => 0,
        'status' => 'active',
    ]);

    $this->actingAs($dispatcher)
        ->postJson('/operations/sales/quotes', [
            'reference' => 'QUO-R0-AGG-OVERFLOW',
            'client_id' => $client->id,
            'items' => [
                ['sales_catalog_item_id' => $first->id, 'quantity' => 1],
                ['sales_catalog_item_id' => $second->id, 'quantity' => 1],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items');

    expect(SalesQuote::query()->where('reference', 'QUO-R0-AGG-OVERFLOW')->exists())->toBeFalse();
});

it('freezes the module boundary against foreign imports and raw foreign tables', function (): void {
    $rentalFiles = [];
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(base_path('app/Modules/Rental'))) as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $rentalFiles[] = $file->getPathname();
        }
    }
    $salesFiles = [];
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(base_path('app/Modules/Sales'))) as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $salesFiles[] = $file->getPathname();
        }
    }

    foreach ($rentalFiles as $file) {
        $contents = file_get_contents($file);
        expect($contents)->not->toContain('App\\Modules\\Sales\\');
        expect($contents)->not->toContain('sales_catalog_items');
        expect($contents)->not->toContain('sales_orders');
    }

    foreach ($salesFiles as $file) {
        $contents = file_get_contents($file);
        expect($contents)->not->toContain('App\\Modules\\Rental\\');
        expect($contents)->not->toContain('rental_reservation_items');
        expect($contents)->not->toContain('rental_reservations');
    }
});
