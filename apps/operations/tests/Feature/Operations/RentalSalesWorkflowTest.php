<?php

use App\Modules\Dispatch\Models\Client;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesQuote;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    $this->seed(RolePermissionSeeder::class);
});

function workflowUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

function workflowClient(): Client
{
    return Client::query()->create(['code' => 'CLI-'.fake()->unique()->numerify('####'), 'company_name' => 'Alibaton Customer', 'status' => 'active']);
}

it('completes an authorized rental reservation checkout and return with conflict protection', function (): void {
    $dispatcher = workflowUser(RoleName::OperationsManager);
    $manager = workflowUser(RoleName::OperationsManager);
    $client = workflowClient();
    $asset = OperationalAsset::query()->create(['code' => 'EQ-RENT-1', 'name' => 'Crawler crane', 'kind' => 'equipment', 'status' => AssetStatus::Available]);
    $dates = ['start_date' => now()->addDays(2)->toDateString(), 'end_date' => now()->addDays(3)->toDateString()];
    $payload = [
        'reference' => 'REN-1001', 'client_id' => $client->id, ...$dates,
        'fulfillment_mode' => 'pickup', 'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 250000]],
    ];

    $created = $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', $payload)->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-1001')->sole();
    expect($reservation->status)->toBe(RentalReservationStatus::Requested)->and($reservation->total_cents)->toBe(500000);

    $this->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertOk();
    $this->actingAs($dispatcher)->postJson("/operations/rental-reservations/{$reservation->id}/checkout", ['condition' => ['engine' => 'good']])->assertOk();
    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::CheckedOut)->and($asset->fresh()->status)->toBe(AssetStatus::Assigned);

    $this->actingAs($dispatcher)->postJson("/operations/rental-reservations/{$reservation->id}/return", ['condition' => ['engine' => 'good']])->assertOk();
    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::Returned)->and($asset->fresh()->status)->toBe(AssetStatus::Available);

    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [...$payload, 'reference' => 'REN-1002'])->assertCreated();
    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [...$payload, 'reference' => 'REN-1003'])->assertUnprocessable()->assertJsonValidationErrors('items');
});

it('derives sales totals, reserves inventory, and makes sold equipment unavailable', function (): void {
    $dispatcher = workflowUser(RoleName::OperationsManager);
    $manager = workflowUser(RoleName::OperationsManager);
    $client = workflowClient();
    $asset = OperationalAsset::query()->create(['code' => 'EQ-SALE-1', 'name' => 'Mobile crane', 'kind' => 'equipment', 'status' => AssetStatus::Available]);
    $catalog = SalesCatalogItem::query()->create(['sku' => 'SALE-CRANE-1', 'name' => 'Mobile crane', 'unit_price_cents' => 12500000, 'quantity_on_hand' => 1, 'quantity_reserved' => 0, 'operational_asset_id' => $asset->id, 'status' => 'active']);

    $this->actingAs($dispatcher)->postJson('/operations/sales/quotes', [
        'reference' => 'QUO-1001', 'client_id' => $client->id,
        'items' => [['sales_catalog_item_id' => $catalog->id, 'quantity' => 1]],
    ])->assertCreated();
    $quote = SalesQuote::query()->where('reference', 'QUO-1001')->sole();
    expect($quote->total_cents)->toBe(12500000);

    $this->actingAs($manager)->postJson("/operations/sales/quotes/{$quote->id}/accept")->assertCreated();
    $order = SalesOrder::query()->where('sales_quote_id', $quote->id)->sole();
    expect($catalog->fresh()->quantity_reserved)->toBe(1)->and($order->status)->toBe(SalesOrderStatus::Confirmed);
    expect(DB::table('sales_inventory_ledger')->where('sales_order_id', $order->id)->where('entry_type', 'reserve')->value('quantity_delta'))->toBe(1);
    $this->actingAs($manager)->postJson("/operations/sales/orders/{$order->id}/fulfill")->assertOk();
    expect(DB::table('sales_inventory_ledger')->where('sales_order_id', $order->id)->where('entry_type', 'sale')->value('quantity_delta'))->toBe(-1);
    $this->actingAs($manager)->postJson("/operations/sales/orders/{$order->id}/transfer-ownership")->assertOk();
    $this->actingAs($manager)
        ->postJson("/operations/sales/orders/{$order->id}/transfer-ownership")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
    expect($order->fresh()->status)->toBe(SalesOrderStatus::Transferred)
        ->and($catalog->fresh()->quantity_on_hand)->toBe(0)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Unavailable);
});

it('keeps rental and sales writes behind their dedicated permissions', function (): void {
    $fieldWorker = workflowUser(RoleName::CraneOperator);
    $client = workflowClient();

    $this->actingAs($fieldWorker)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-FORBIDDEN',
            'client_id' => $client->id,
            'start_date' => now()->addDays(2)->toDateString(),
            'end_date' => now()->addDays(3)->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [],
        ])
        ->assertForbidden();

    $this->actingAs($fieldWorker)
        ->postJson('/operations/sales/catalog', [
            'sku' => 'SALE-FORBIDDEN',
            'name' => 'Restricted item',
            'unit_price_cents' => 100,
            'quantity_on_hand' => 1,
        ])
        ->assertForbidden();
});

it('rechecks asset availability and quantity when approving a rental', function (): void {
    $dispatcher = workflowUser(RoleName::OperationsManager);
    $manager = workflowUser(RoleName::OperationsManager);
    $client = workflowClient();
    $asset = OperationalAsset::query()->create(['code' => 'EQ-RECHECK-1', 'name' => 'Crane', 'kind' => 'equipment', 'status' => AssetStatus::Available]);
    $payload = [
        'reference' => 'REN-RECHECK-1', 'client_id' => $client->id,
        'start_date' => now()->addDays(2)->toDateString(), 'end_date' => now()->addDays(3)->toDateString(),
        'fulfillment_mode' => 'delivery', 'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
    ];
    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [...$payload, 'reference' => 'REN-RECHECK-2', 'items' => [['operational_asset_id' => $asset->id, 'quantity' => 2, 'rate_cents' => 100]]])->assertUnprocessable()->assertJsonValidationErrors('items.0.quantity');
    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', $payload)->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-RECHECK-1')->sole();
    $asset->update(['status' => AssetStatus::Unavailable]);
    $this->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertUnprocessable()->assertJsonValidationErrors('status');
});

it('rejects an approval when another reservation conflicts with the same unit', function (): void {
    $dispatcher = workflowUser(RoleName::OperationsManager);
    $manager = workflowUser(RoleName::OperationsManager);
    $client = workflowClient();
    $asset = OperationalAsset::query()->create(['code' => 'EQ-CONFLICT-1', 'name' => 'Crane', 'kind' => 'equipment', 'status' => AssetStatus::Available]);
    $start = now()->addDays(4)->toDateString();
    $end = now()->addDays(5)->toDateString();
    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [
        'reference' => 'REN-CONFLICT-1', 'client_id' => $client->id, 'start_date' => $start, 'end_date' => $end,
        'fulfillment_mode' => 'delivery', 'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
    ])->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-CONFLICT-1')->sole();
    $other = RentalReservation::query()->create(['reference' => 'REN-CONFLICT-2', 'client_id' => $client->id, 'created_by' => $dispatcher->id, 'status' => RentalReservationStatus::Requested, 'start_date' => $start, 'end_date' => $end, 'fulfillment_mode' => 'delivery', 'total_cents' => 100]);
    RentalReservationItem::query()->create(['rental_reservation_id' => $other->id, 'operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100, 'line_total_cents' => 100]);
    $this->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertUnprocessable()->assertJsonValidationErrors('status');
});

it('prevents serialized catalog overstock and records catalog creation audit', function (): void {
    $manager = workflowUser(RoleName::OperationsManager);
    $asset = OperationalAsset::query()->create(['code' => 'EQ-CATALOG-1', 'name' => 'Crane', 'kind' => 'equipment', 'status' => AssetStatus::Available]);
    $this->actingAs($manager)->postJson('/operations/sales/catalog', ['sku' => 'SERIAL-OVER', 'name' => 'Crane', 'unit_price_cents' => 100, 'quantity_on_hand' => 2, 'operational_asset_id' => $asset->id])->assertUnprocessable()->assertJsonValidationErrors('quantity_on_hand');
    $this->actingAs($manager)->postJson('/operations/sales/catalog', ['sku' => 'SERIAL-OK', 'name' => 'Crane', 'unit_price_cents' => 100, 'quantity_on_hand' => 1, 'operational_asset_id' => $asset->id])->assertCreated();
    expect(AuditEvent::query()->where('action', 'sales_catalog_item.created')->count())->toBe(1);
    expect(DB::table('sales_inventory_ledger')->where('entry_type', 'initial_stock')->where('quantity_delta', 1)->count())->toBe(1);
});

it('rejects a quote when its linked unit becomes unavailable and rejects duplicate lines', function (): void {
    $dispatcher = workflowUser(RoleName::OperationsManager);
    $manager = workflowUser(RoleName::OperationsManager);
    $client = workflowClient();
    $asset = OperationalAsset::query()->create(['code' => 'EQ-QUOTE-1', 'name' => 'Crane', 'kind' => 'equipment', 'status' => AssetStatus::Available]);
    $catalog = SalesCatalogItem::query()->create(['sku' => 'QUOTE-SERIAL', 'name' => 'Crane', 'unit_price_cents' => 100, 'quantity_on_hand' => 1, 'quantity_reserved' => 0, 'operational_asset_id' => $asset->id, 'status' => 'active']);
    $this->actingAs($dispatcher)->postJson('/operations/sales/quotes', ['reference' => 'QUO-DUP', 'client_id' => $client->id, 'items' => [['sales_catalog_item_id' => $catalog->id, 'quantity' => 1], ['sales_catalog_item_id' => $catalog->id, 'quantity' => 1]]])->assertUnprocessable()->assertJsonValidationErrors('items');
    $this->actingAs($dispatcher)->postJson('/operations/sales/quotes', ['reference' => 'QUO-UNAVAILABLE', 'client_id' => $client->id, 'items' => [['sales_catalog_item_id' => $catalog->id, 'quantity' => 1]]])->assertCreated();
    $quote = SalesQuote::query()->where('reference', 'QUO-UNAVAILABLE')->sole();
    $asset->update(['status' => AssetStatus::Unavailable]);
    $this->actingAs($manager)->postJson("/operations/sales/quotes/{$quote->id}/accept")->assertUnprocessable()->assertJsonValidationErrors('items');
});

it('prevents duplicate ownership transfers for one physical unit', function (): void {
    $manager = workflowUser(RoleName::OperationsManager);
    $client = workflowClient();
    $asset = OperationalAsset::query()->create(['code' => 'EQ-TRANSFER-1', 'name' => 'Crane', 'kind' => 'equipment', 'status' => AssetStatus::Available]);
    $catalog = SalesCatalogItem::query()->create(['sku' => 'TRANSFER-SERIAL', 'name' => 'Crane', 'unit_price_cents' => 100, 'quantity_on_hand' => 0, 'quantity_reserved' => 0, 'operational_asset_id' => $asset->id, 'status' => 'active']);
    $order = SalesOrder::query()->create(['reference' => 'SO-DUP-TRANSFER', 'client_id' => $client->id, 'created_by' => $manager->id, 'status' => SalesOrderStatus::Fulfilled, 'currency' => 'PHP', 'total_cents' => 200]);
    $order->items()->createMany([
        ['sales_catalog_item_id' => $catalog->id, 'quantity' => 1, 'unit_price_cents' => 100, 'line_total_cents' => 100],
        ['sales_catalog_item_id' => $catalog->id, 'quantity' => 1, 'unit_price_cents' => 100, 'line_total_cents' => 100],
    ]);
    $this->actingAs($manager)->postJson("/operations/sales/orders/{$order->id}/transfer-ownership")->assertUnprocessable()->assertJsonValidationErrors('status');
});
