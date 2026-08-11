<?php

use App\Modules\Dispatch\Models\Client;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesQuote;
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
    $dispatcher = workflowUser(RoleName::Dispatcher);
    $manager = workflowUser(RoleName::OperationsManager);
    $client = workflowClient();
    $asset = OperationalAsset::query()->create(['code' => 'EQ-RENT-1', 'name' => 'Crawler crane', 'kind' => 'equipment', 'status' => AssetStatus::Available]);
    $dates = ['start_date' => now()->addDays(2)->toDateString(), 'end_date' => now()->addDays(3)->toDateString()];
    $payload = [
        'reference' => 'REN-1001', 'client_id' => $client->id, ...$dates,
        'fulfillment_mode' => 'delivery', 'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 250000]],
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
    $dispatcher = workflowUser(RoleName::Dispatcher);
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
    $this->actingAs($manager)->postJson("/operations/sales/orders/{$order->id}/fulfill")->assertOk();
    $this->actingAs($manager)->postJson("/operations/sales/orders/{$order->id}/transfer-ownership")->assertOk();
    expect($order->fresh()->status)->toBe(SalesOrderStatus::Transferred)
        ->and($catalog->fresh()->quantity_on_hand)->toBe(0)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Unavailable);
});

it('keeps rental and sales writes behind their dedicated permissions', function (): void {
    $fieldWorker = workflowUser(RoleName::Driver);
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
