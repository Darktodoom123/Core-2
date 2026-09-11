<?php

use App\Modules\Dispatch\Models\Client;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalCheckout;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Enums\SalesQuoteStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesQuote;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    $this->seed(RolePermissionSeeder::class);
});

/** @return list<array{route: string, permission: PermissionName, adjacent: PermissionName}> */
function r6AuthorizationRoutes(): array
{
    return [
        ['route' => 'rental.index', 'permission' => PermissionName::RentalView, 'adjacent' => PermissionName::SalesView],
        ['route' => 'rental.store', 'permission' => PermissionName::RentalCreate, 'adjacent' => PermissionName::SalesCreateQuote],
        ['route' => 'rental.approve', 'permission' => PermissionName::RentalApprove, 'adjacent' => PermissionName::SalesApproveOrder],
        ['route' => 'rental.checkout', 'permission' => PermissionName::RentalCheckout, 'adjacent' => PermissionName::RentalApprove],
        ['route' => 'rental.return', 'permission' => PermissionName::RentalReturn, 'adjacent' => PermissionName::RentalCheckout],
        ['route' => 'sales.catalog.index', 'permission' => PermissionName::SalesView, 'adjacent' => PermissionName::RentalView],
        ['route' => 'sales.catalog.store', 'permission' => PermissionName::SalesCatalogManage, 'adjacent' => PermissionName::SalesCreateQuote],
        ['route' => 'sales.quotes.index', 'permission' => PermissionName::SalesView, 'adjacent' => PermissionName::RentalView],
        ['route' => 'sales.quotes.store', 'permission' => PermissionName::SalesCreateQuote, 'adjacent' => PermissionName::RentalCreate],
        ['route' => 'sales.quotes.accept', 'permission' => PermissionName::SalesApproveOrder, 'adjacent' => PermissionName::SalesCreateQuote],
        ['route' => 'sales.orders.index', 'permission' => PermissionName::SalesView, 'adjacent' => PermissionName::RentalView],
        ['route' => 'sales.orders.fulfill', 'permission' => PermissionName::SalesFulfill, 'adjacent' => PermissionName::SalesApproveOrder],
        ['route' => 'sales.orders.transfer', 'permission' => PermissionName::SalesTransferOwnership, 'adjacent' => PermissionName::SalesFulfill],
    ];
}

function r6AuthorizationClient(): Client
{
    return Client::query()->create([
        'code' => 'CLI-R6-'.fake()->unique()->numerify('#####'),
        'company_name' => 'R6 authorization customer',
        'status' => 'active',
    ]);
}

function r6AuthorizationAsset(AssetStatus $status = AssetStatus::Available): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => 'EQ-R6-'.fake()->unique()->numerify('#####'),
        'name' => 'R6 authorization asset',
        'kind' => 'equipment',
        'status' => $status,
    ]);
}

function r6AuthorizationUser(): User
{
    return User::factory()->create();
}

/** @return array{client: Client, asset: OperationalAsset, reservation: RentalReservation|null, quote: SalesQuote|null, order: SalesOrder|null, catalog: SalesCatalogItem|null} */
function r6AuthorizationContext(string $route): array
{
    $client = r6AuthorizationClient();
    $asset = r6AuthorizationAsset($route === 'rental.return' ? AssetStatus::Assigned : AssetStatus::Available);
    $reservation = null;
    $quote = null;
    $order = null;
    $catalog = null;

    if (in_array($route, ['rental.approve', 'rental.checkout', 'rental.return'], true)) {
        $status = match ($route) {
            'rental.approve' => RentalReservationStatus::Requested,
            'rental.checkout' => RentalReservationStatus::Reserved,
            default => RentalReservationStatus::CheckedOut,
        };
        $reservation = RentalReservation::query()->create([
            'reference' => 'REN-R6-'.fake()->unique()->numerify('#####'),
            'client_id' => $client->id,
            'created_by' => User::factory()->create()->id,
            'status' => $status,
            'start_date' => CarbonImmutable::tomorrow()->toDateString(),
            'end_date' => CarbonImmutable::tomorrow()->addDay()->toDateString(),
            'fulfillment_mode' => $route === 'rental.checkout' ? 'pickup' : 'delivery',
            'total_cents' => 100,
        ]);
        RentalReservationItem::query()->create([
            'rental_reservation_id' => $reservation->id,
            'operational_asset_id' => $asset->id,
            'quantity' => 1,
            'rate_cents' => 100,
            'line_total_cents' => 200,
        ]);

        if ($route === 'rental.return') {
            RentalCheckout::query()->create([
                'rental_reservation_id' => $reservation->id,
                'checked_out_by' => $reservation->created_by,
                'checked_out_at' => now(),
                'condition_before' => ['engine' => 'good'],
            ]);
        }
    }

    if (in_array($route, ['sales.quotes.store', 'sales.quotes.accept', 'sales.orders.fulfill', 'sales.orders.transfer'], true)) {
        $catalog = SalesCatalogItem::query()->create([
            'sku' => 'SKU-R6-'.fake()->unique()->numerify('#####'),
            'name' => 'R6 authorization catalog item',
            'unit_price_cents' => 100,
            'quantity_on_hand' => $route === 'sales.orders.transfer' ? 0 : 1,
            'quantity_reserved' => in_array($route, ['sales.orders.fulfill', 'sales.orders.transfer'], true) ? 1 : 0,
            'operational_asset_id' => $route === 'sales.orders.transfer' ? $asset->id : null,
            'status' => 'active',
        ]);
    }

    if (in_array($route, ['sales.quotes.accept'], true)) {
        $quote = SalesQuote::query()->create([
            'reference' => 'QUO-R6-'.fake()->unique()->numerify('#####'),
            'client_id' => $client->id,
            'created_by' => User::factory()->create()->id,
            'status' => SalesQuoteStatus::Draft,
            'currency' => 'PHP',
            'total_cents' => 100,
        ]);
        $quote->items()->create([
            'sales_catalog_item_id' => $catalog->id,
            'quantity' => 1,
            'unit_price_cents' => 100,
            'line_total_cents' => 100,
        ]);
    }

    if (in_array($route, ['sales.orders.fulfill', 'sales.orders.transfer'], true)) {
        $order = SalesOrder::query()->create([
            'reference' => 'SO-R6-'.fake()->unique()->numerify('#####'),
            'client_id' => $client->id,
            'created_by' => User::factory()->create()->id,
            'status' => $route === 'sales.orders.fulfill' ? SalesOrderStatus::Confirmed : SalesOrderStatus::Fulfilled,
            'currency' => 'PHP',
            'total_cents' => 100,
        ]);
        $order->items()->create([
            'sales_catalog_item_id' => $catalog->id,
            'quantity' => 1,
            'unit_price_cents' => 100,
            'line_total_cents' => 100,
        ]);
    }

    return compact('client', 'asset', 'reservation', 'quote', 'order', 'catalog');
}

function r6InvokeAuthorizationRoute(TestCase $test, string $route, User $actor, ?array $context = null): TestResponse
{
    $context ??= r6AuthorizationContext($route);
    $client = $context['client'];
    $asset = $context['asset'];

    return match ($route) {
        'rental.index' => $test->actingAs($actor)->getJson('/operations/rental-reservations'),
        'rental.store' => $test->actingAs($actor)->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R6-NEW-'.fake()->unique()->numerify('#####'),
            'client_id' => $client->id,
            'start_date' => CarbonImmutable::tomorrow()->toDateString(),
            'end_date' => CarbonImmutable::tomorrow()->addDay()->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
        ]),
        'rental.approve' => $test->actingAs($actor)->postJson('/operations/rental-reservations/'.$context['reservation']->id.'/approve'),
        'rental.checkout' => $test->actingAs($actor)->postJson('/operations/rental-reservations/'.$context['reservation']->id.'/checkout', ['condition' => ['engine' => 'good']]),
        'rental.return' => $test->actingAs($actor)->postJson('/operations/rental-reservations/'.$context['reservation']->id.'/return', ['condition' => ['engine' => 'good']]),
        'sales.catalog.index' => $test->actingAs($actor)->getJson('/operations/sales/catalog'),
        'sales.catalog.store' => $test->actingAs($actor)->postJson('/operations/sales/catalog', [
            'sku' => 'SKU-R6-NEW-'.fake()->unique()->numerify('#####'),
            'name' => 'R6 new catalog item',
            'unit_price_cents' => 100,
            'quantity_on_hand' => 1,
        ]),
        'sales.quotes.index' => $test->actingAs($actor)->getJson('/operations/sales/quotes'),
        'sales.quotes.store' => $test->actingAs($actor)->postJson('/operations/sales/quotes', [
            'reference' => 'QUO-R6-NEW-'.fake()->unique()->numerify('#####'),
            'client_id' => $client->id,
            'items' => [['sales_catalog_item_id' => $context['catalog']->id, 'quantity' => 1]],
        ]),
        'sales.quotes.accept' => $test->actingAs($actor)->postJson('/operations/sales/quotes/'.$context['quote']->id.'/accept'),
        'sales.orders.index' => $test->actingAs($actor)->getJson('/operations/sales/orders'),
        'sales.orders.fulfill' => $test->actingAs($actor)->postJson('/operations/sales/orders/'.$context['order']->id.'/fulfill'),
        'sales.orders.transfer' => $test->actingAs($actor)->postJson('/operations/sales/orders/'.$context['order']->id.'/transfer-ownership'),
    };
}

it('allows only the exact dedicated permission on every Rental and Sales route', function (string $route, PermissionName $permission, PermissionName $adjacent): void {
    $actor = r6AuthorizationUser();
    $actor->givePermissionTo($permission->value);

    $response = r6InvokeAuthorizationRoute($this, $route, $actor);

    expect($response->status())->toBeIn([200, 201]);
})->with(r6AuthorizationRoutes());

it('does not substitute an adjacent Rental or Sales permission on any route', function (string $route, PermissionName $permission, PermissionName $adjacent): void {
    $actor = r6AuthorizationUser();
    $actor->givePermissionTo($adjacent->value);

    $response = r6InvokeAuthorizationRoute($this, $route, $actor);

    $response->assertForbidden();
})->with(r6AuthorizationRoutes());

it('rejects guests at the session boundary for every Rental and Sales route', function (string $route): void {
    $context = r6AuthorizationContext($route);
    $response = match ($route) {
        'rental.index' => $this->getJson('/operations/rental-reservations'),
        'rental.store' => $this->postJson('/operations/rental-reservations', ['reference' => 'guest', 'client_id' => $context['client']->id, 'start_date' => CarbonImmutable::tomorrow()->toDateString(), 'end_date' => CarbonImmutable::tomorrow()->addDay()->toDateString(), 'fulfillment_mode' => 'delivery', 'items' => [['operational_asset_id' => $context['asset']->id, 'quantity' => 1, 'rate_cents' => 100]]]),
        'rental.approve' => $this->postJson('/operations/rental-reservations/'.$context['reservation']->id.'/approve'),
        'rental.checkout' => $this->postJson('/operations/rental-reservations/'.$context['reservation']->id.'/checkout', ['condition' => ['engine' => 'good']]),
        'rental.return' => $this->postJson('/operations/rental-reservations/'.$context['reservation']->id.'/return', ['condition' => ['engine' => 'good']]),
        'sales.catalog.index' => $this->getJson('/operations/sales/catalog'),
        'sales.catalog.store' => $this->postJson('/operations/sales/catalog', ['sku' => 'guest', 'name' => 'guest', 'unit_price_cents' => 100, 'quantity_on_hand' => 1]),
        'sales.quotes.index' => $this->getJson('/operations/sales/quotes'),
        'sales.quotes.store' => $this->postJson('/operations/sales/quotes', ['reference' => 'guest', 'client_id' => $context['client']->id, 'items' => [['sales_catalog_item_id' => $context['catalog']->id, 'quantity' => 1]]]),
        'sales.quotes.accept' => $this->postJson('/operations/sales/quotes/'.$context['quote']->id.'/accept'),
        'sales.orders.index' => $this->getJson('/operations/sales/orders'),
        'sales.orders.fulfill' => $this->postJson('/operations/sales/orders/'.$context['order']->id.'/fulfill'),
        'sales.orders.transfer' => $this->postJson('/operations/sales/orders/'.$context['order']->id.'/transfer-ownership'),
    };

    expect($response->status())->toBeIn([401, 302]);
})->with(array_column(r6AuthorizationRoutes(), 'route'));

it('rejects inactive, suspended, and unverified users for every Rental and Sales route', function (string $accountState, string $route): void {
    $context = r6AuthorizationContext($route);
    $actor = match ($accountState) {
        'inactive' => User::factory()->create(['is_active' => false]),
        'suspended' => User::factory()->suspended()->create(),
        default => User::factory()->unverified()->create(),
    };
    $response = r6InvokeAuthorizationRoute($this, $route, $actor);

    expect($response->status())->toBe(403);
})->with(['inactive', 'suspended', 'unverified'])->with(array_column(r6AuthorizationRoutes(), 'route'));

it('rejects every unauthorized mutation without domain, asset, evidence, ledger, ownership, or success-audit changes', function (string $route, PermissionName $permission, PermissionName $adjacent): void {
    $actor = r6AuthorizationUser();
    $actor->givePermissionTo($adjacent->value);
    $context = r6AuthorizationContext($route);
    $before = [
        'rental_reservations' => RentalReservation::query()->count(),
        'rental_reservation_items' => RentalReservationItem::query()->count(),
        'rental_checkouts' => RentalCheckout::query()->count(),
        'rental_returns' => $this->getConnection()->table('rental_returns')->count(),
        'sales_catalog_items' => SalesCatalogItem::query()->count(),
        'sales_quotes' => SalesQuote::query()->count(),
        'sales_quote_items' => $this->getConnection()->table('sales_quote_items')->count(),
        'sales_orders' => SalesOrder::query()->count(),
        'sales_order_items' => $this->getConnection()->table('sales_order_items')->count(),
        'sales_inventory_ledger' => $this->getConnection()->table('sales_inventory_ledger')->count(),
        'ownership_transfers' => $this->getConnection()->table('ownership_transfers')->count(),
        'audit_events' => AuditEvent::query()->count(),
    ];
    $response = r6InvokeAuthorizationRoute($this, $route, $actor, $context);

    $response->assertForbidden();
    foreach ($before as $table => $count) {
        $actual = match ($table) {
            'rental_reservations' => RentalReservation::query()->count(),
            'rental_reservation_items' => RentalReservationItem::query()->count(),
            'rental_checkouts' => RentalCheckout::query()->count(),
            'sales_catalog_items' => SalesCatalogItem::query()->count(),
            'sales_quotes' => SalesQuote::query()->count(),
            'sales_orders' => SalesOrder::query()->count(),
            'audit_events' => AuditEvent::query()->count(),
            default => $this->getConnection()->table($table)->count(),
        };
        expect($actual, $table)->toBe($count);
    }
})->with(array_values(array_filter(r6AuthorizationRoutes(), static fn (array $case): bool => str_ends_with($case['route'], '.store') || in_array($case['route'], ['rental.approve', 'rental.checkout', 'rental.return', 'sales.quotes.accept', 'sales.orders.fulfill', 'sales.orders.transfer'], true))));
