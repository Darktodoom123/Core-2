<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
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
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    $this->seed(RolePermissionSeeder::class);
});

function r6StateUser(PermissionName ...$permissions): User
{
    $user = User::factory()->create();
    foreach ($permissions as $permission) {
        $user->givePermissionTo($permission->value);
    }

    return $user;
}

function r6StateClient(): Client
{
    return Client::query()->create([
        'code' => 'CLI-R6S-'.fake()->unique()->numerify('#####'),
        'company_name' => 'R6 state customer',
        'status' => 'active',
    ]);
}

function r6StateAsset(AssetStatus $status = AssetStatus::Available): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => 'EQ-R6S-'.fake()->unique()->numerify('#####'),
        'name' => 'R6 state asset',
        'kind' => 'equipment',
        'status' => $status,
    ]);
}

function r6StateReservation(User $creator, OperationalAsset $asset, RentalReservationStatus $status): RentalReservation
{
    $reservation = RentalReservation::query()->create([
        'reference' => 'REN-R6S-'.fake()->unique()->numerify('#####'),
        'client_id' => r6StateClient()->id,
        'created_by' => $creator->id,
        'status' => $status,
        'start_date' => CarbonImmutable::tomorrow()->toDateString(),
        'end_date' => CarbonImmutable::tomorrow()->addDay()->toDateString(),
        'fulfillment_mode' => 'delivery',
        'total_cents' => 200,
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

function r6StateCatalog(?OperationalAsset $asset = null, int $onHand = 1, int $reserved = 0): SalesCatalogItem
{
    return SalesCatalogItem::query()->create([
        'sku' => 'SKU-R6S-'.fake()->unique()->numerify('#####'),
        'name' => 'R6 state catalog item',
        'unit_price_cents' => 100,
        'quantity_on_hand' => $onHand,
        'quantity_reserved' => $reserved,
        'operational_asset_id' => $asset?->id,
        'status' => 'active',
    ]);
}

function r6StateQuote(User $creator, SalesCatalogItem $catalog, SalesQuoteStatus $status = SalesQuoteStatus::Draft, ?string $validUntil = null): SalesQuote
{
    $quote = SalesQuote::query()->create([
        'reference' => 'QUO-R6S-'.fake()->unique()->numerify('#####'),
        'client_id' => r6StateClient()->id,
        'created_by' => $creator->id,
        'status' => $status,
        'currency' => 'PHP',
        'total_cents' => 100,
        'valid_until' => $validUntil,
    ]);
    $quote->items()->create([
        'sales_catalog_item_id' => $catalog->id,
        'quantity' => 1,
        'unit_price_cents' => 100,
        'line_total_cents' => 100,
    ]);

    return $quote->fresh();
}

function r6StateOrder(User $creator, SalesCatalogItem $catalog, SalesOrderStatus $status): SalesOrder
{
    $order = SalesOrder::query()->create([
        'reference' => 'SO-R6S-'.fake()->unique()->numerify('#####'),
        'client_id' => r6StateClient()->id,
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

    return $order->fresh();
}

/** @return array{rental: array{before: list<string>, after: list<string>}, sales_catalog: array{before: null, after: list<string>}, sales_quote: array{before: list<string>|null, after: list<string>}, sales_order: array{before: list<string>|null, after: list<string>}} */
function r6AuditAllowLists(): array
{
    return [
        'rental' => [
            'before' => ['id', 'reference', 'client_id', 'created_by', 'approved_by', 'dispatch_job_id', 'status', 'start_date', 'end_date', 'fulfillment_mode', 'total_cents', 'created_at', 'updated_at', 'deleted_at'],
            'after' => ['id', 'reference', 'client_id', 'created_by', 'approved_by', 'dispatch_job_id', 'status', 'start_date', 'end_date', 'fulfillment_mode', 'total_cents', 'created_at', 'updated_at', 'deleted_at'],
        ],
        'sales_catalog' => [
            'before' => null,
            'after' => ['id', 'sku', 'name', 'unit_price_cents', 'quantity_on_hand', 'quantity_reserved', 'operational_asset_id', 'status', 'created_at', 'updated_at'],
        ],
        'sales_quote' => [
            'before' => ['id', 'reference', 'client_id', 'created_by', 'status', 'currency', 'total_cents', 'valid_until', 'created_at', 'updated_at'],
            'after' => ['id', 'reference', 'client_id', 'created_by', 'status', 'currency', 'total_cents', 'valid_until', 'created_at', 'updated_at'],
        ],
        'sales_order' => [
            'before' => ['id', 'reference', 'client_id', 'sales_quote_id', 'created_by', 'dispatch_job_id', 'fulfillment_mode', 'status', 'currency', 'total_cents', 'fulfilled_at', 'created_at', 'updated_at'],
            'after' => ['id', 'reference', 'client_id', 'sales_quote_id', 'created_by', 'dispatch_job_id', 'fulfillment_mode', 'status', 'currency', 'total_cents', 'fulfilled_at', 'created_at', 'updated_at'],
        ],
    ];
}

it('rejects every invalid Rental and Sales source state without mutation or success audit', function (string $operation, string $status): void {
    $actor = match ($operation) {
        'rental.approve' => r6StateUser(PermissionName::RentalApprove),
        'rental.checkout' => r6StateUser(PermissionName::RentalCheckout),
        'rental.return' => r6StateUser(PermissionName::RentalReturn),
        'sales.quotes.accept' => r6StateUser(PermissionName::SalesApproveOrder),
        'sales.orders.fulfill' => r6StateUser(PermissionName::SalesFulfill),
        default => r6StateUser(PermissionName::SalesTransferOwnership),
    };
    $asset = r6StateAsset($operation === 'rental.return' ? AssetStatus::Assigned : AssetStatus::Available);
    $reservation = null;
    $quote = null;
    $order = null;
    $catalog = null;

    if (str_starts_with($operation, 'rental.')) {
        $reservation = r6StateReservation($actor, $asset, RentalReservationStatus::from($status));
    } elseif ($operation === 'sales.quotes.accept') {
        $catalog = r6StateCatalog();
        $quote = r6StateQuote($actor, $catalog, SalesQuoteStatus::from($status));
    } else {
        $catalog = r6StateCatalog(null, 1, 1);
        $order = r6StateOrder($actor, $catalog, SalesOrderStatus::from($status));
    }

    $url = match ($operation) {
        'rental.approve' => "/operations/rental-reservations/{$reservation->id}/approve",
        'rental.checkout' => "/operations/rental-reservations/{$reservation->id}/checkout",
        'rental.return' => "/operations/rental-reservations/{$reservation->id}/return",
        'sales.quotes.accept' => "/operations/sales/quotes/{$quote->id}/accept",
        'sales.orders.fulfill' => "/operations/sales/orders/{$order->id}/fulfill",
        default => "/operations/sales/orders/{$order->id}/transfer-ownership",
    };
    $payload = str_contains($operation, 'checkout') || str_contains($operation, 'return')
        ? ['condition' => ['engine' => 'good']]
        : [];
    $before = [
        'reservations' => RentalReservation::query()->count(),
        'checkouts' => RentalCheckout::query()->count(),
        'returns' => $this->getConnection()->table('rental_returns')->count(),
        'orders' => SalesOrder::query()->count(),
        'ledger' => $this->getConnection()->table('sales_inventory_ledger')->count(),
        'ownership' => $this->getConnection()->table('ownership_transfers')->count(),
        'audits' => AuditEvent::query()->count(),
        'asset_status' => $asset->fresh()->status->value,
        'catalog' => $catalog?->fresh()->only(['quantity_on_hand', 'quantity_reserved']),
    ];

    $this->actingAs($actor)->postJson($url, $payload)->assertUnprocessable();

    expect([
        'reservations' => RentalReservation::query()->count(),
        'checkouts' => RentalCheckout::query()->count(),
        'returns' => $this->getConnection()->table('rental_returns')->count(),
        'orders' => SalesOrder::query()->count(),
        'ledger' => $this->getConnection()->table('sales_inventory_ledger')->count(),
        'ownership' => $this->getConnection()->table('ownership_transfers')->count(),
        'audits' => AuditEvent::query()->count(),
        'asset_status' => $asset->fresh()->status->value,
        'catalog' => $catalog?->fresh()->only(['quantity_on_hand', 'quantity_reserved']),
    ])->toBe($before);
})->with([
    ['rental.approve', RentalReservationStatus::Reserved->value],
    ['rental.approve', RentalReservationStatus::CheckedOut->value],
    ['rental.approve', RentalReservationStatus::Returned->value],
    ['rental.approve', RentalReservationStatus::Closed->value],
    ['rental.checkout', RentalReservationStatus::Requested->value],
    ['rental.checkout', RentalReservationStatus::CheckedOut->value],
    ['rental.checkout', RentalReservationStatus::Returned->value],
    ['rental.checkout', RentalReservationStatus::Closed->value],
    ['rental.return', RentalReservationStatus::Requested->value],
    ['rental.return', RentalReservationStatus::Reserved->value],
    ['rental.return', RentalReservationStatus::Returned->value],
    ['rental.return', RentalReservationStatus::Closed->value],
    ['sales.quotes.accept', SalesQuoteStatus::Accepted->value],
    ['sales.quotes.accept', SalesQuoteStatus::Rejected->value],
    ['sales.quotes.accept', SalesQuoteStatus::Expired->value],
    ['sales.orders.fulfill', SalesOrderStatus::Fulfilled->value],
    ['sales.orders.fulfill', SalesOrderStatus::Transferred->value],
    ['sales.orders.fulfill', SalesOrderStatus::Cancelled->value],
    ['sales.orders.transfer', SalesOrderStatus::Confirmed->value],
    ['sales.orders.transfer', SalesOrderStatus::Transferred->value],
    ['sales.orders.transfer', SalesOrderStatus::Cancelled->value],
]);

it('rejects an expired draft quote and accepts a current-day draft without changing invalid state', function (bool $expired): void {
    $actor = r6StateUser(PermissionName::SalesApproveOrder);
    $catalog = r6StateCatalog();
    $quote = r6StateQuote($actor, $catalog, SalesQuoteStatus::Draft, $expired ? CarbonImmutable::yesterday()->toDateString() : today()->toDateString());

    $response = $this->actingAs($actor)->postJson("/operations/sales/quotes/{$quote->id}/accept");

    if ($expired) {
        $response->assertUnprocessable()->assertJsonValidationErrors('valid_until');
        expect($quote->fresh()->status)->toBe(SalesQuoteStatus::Draft)
            ->and(SalesOrder::query()->count())->toBe(0)
            ->and($catalog->fresh()->quantity_reserved)->toBe(0)
            ->and(AuditEvent::query()->whereIn('action', ['sales_quote.accepted', 'sales_order.created'])->count())->toBe(0);
    } else {
        $response->assertCreated();
        expect($quote->fresh()->status)->toBe(SalesQuoteStatus::Accepted)
            ->and(SalesOrder::query()->count())->toBe(1);
    }
})->with([true, false]);

it('records the exact safe audit matrix with actor, subject, UUID, IP, and bounded time', function (): void {
    $dispatcher = r6StateUser(PermissionName::RentalCreate, PermissionName::RentalCheckout, PermissionName::RentalReturn, PermissionName::SalesCreateQuote);
    $manager = r6StateUser(PermissionName::RentalApprove, PermissionName::SalesCatalogManage, PermissionName::SalesApproveOrder, PermissionName::SalesFulfill, PermissionName::SalesTransferOwnership);
    $rentalAsset = r6StateAsset();
    $rentalClient = r6StateClient();
    $start = CarbonImmutable::tomorrow();
    $rentalPayload = [
        'reference' => 'REN-R6-AUDIT',
        'client_id' => $rentalClient->id,
        'start_date' => $start->toDateString(),
        'end_date' => $start->addDay()->toDateString(),
        'fulfillment_mode' => 'delivery',
        'delivery_location' => 'private location/contact data',
        'notes' => 'private rental notes/contact data',
        'items' => [['operational_asset_id' => $rentalAsset->id, 'quantity' => 1, 'rate_cents' => 100]],
    ];
    $request = $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.55']);
    $request->actingAs($dispatcher)->postJson('/operations/rental-reservations', $rentalPayload)->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-R6-AUDIT')->sole();
    $request->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertOk();
    $request->actingAs($dispatcher)->postJson("/operations/rental-reservations/{$reservation->id}/checkout", ['condition' => ['engine' => 'good'], 'notes' => 'private checkout note'])->assertOk();
    $request->actingAs($dispatcher)->postJson("/operations/rental-reservations/{$reservation->id}/return", ['condition' => ['engine' => 'good'], 'damage_notes' => 'private damage/contact data'])->assertOk();

    $salesAsset = r6StateAsset();
    $catalog = null;
    $request->actingAs($manager)->postJson('/operations/sales/catalog', [
        'sku' => 'SKU-R6-AUDIT',
        'name' => 'R6 audit catalog',
        'unit_price_cents' => 100,
        'quantity_on_hand' => 1,
        'operational_asset_id' => $salesAsset->id,
    ])->assertCreated();
    $catalog = SalesCatalogItem::query()->where('sku', 'SKU-R6-AUDIT')->sole();
    $request->actingAs($dispatcher)->postJson('/operations/sales/quotes', [
        'reference' => 'QUO-R6-AUDIT',
        'client_id' => $rentalClient->id,
        'notes' => 'private quote contact data',
        'items' => [['sales_catalog_item_id' => $catalog->id, 'quantity' => 1]],
    ])->assertCreated();
    $quote = SalesQuote::query()->where('reference', 'QUO-R6-AUDIT')->sole();
    $request->actingAs($manager)->postJson("/operations/sales/quotes/{$quote->id}/accept")->assertCreated();
    $order = SalesOrder::query()->where('sales_quote_id', $quote->id)->sole();
    $request->actingAs($manager)->postJson("/operations/sales/orders/{$order->id}/fulfill")->assertOk();
    $request->actingAs($manager)->postJson("/operations/sales/orders/{$order->id}/transfer-ownership")->assertOk();

    $allowLists = r6AuditAllowLists();
    $actions = [
        'rental_reservation.created' => [$dispatcher->id, $reservation->id, 'rental'],
        'rental_reservation.approved' => [$manager->id, $reservation->id, 'rental'],
        'rental_reservation.checked_out' => [$dispatcher->id, $reservation->id, 'rental'],
        'rental_reservation.returned' => [$dispatcher->id, $reservation->id, 'rental'],
        'sales_catalog_item.created' => [$manager->id, $catalog->id, 'sales_catalog'],
        'sales_quote.created' => [$dispatcher->id, $quote->id, 'sales_quote'],
        'sales_quote.accepted' => [$manager->id, $quote->id, 'sales_quote'],
        'sales_order.created' => [$manager->id, $order->id, 'sales_order'],
        'sales_order.fulfilled' => [$manager->id, $order->id, 'sales_order'],
        'sales_order.ownership_transferred' => [$manager->id, $order->id, 'sales_order'],
    ];
    $startedAt = now()->subMinutes(2);
    foreach ($actions as $action => [$actorId, $subjectId, $subjectKind]) {
        $audit = AuditEvent::query()->where('action', $action)->sole();
        $keys = $allowLists[$subjectKind];
        $expectedBefore = str_ends_with($action, '.created') ? null : $keys['before'];
        $actualBefore = $audit->before === null ? null : array_keys($audit->before);
        $actualAfter = $audit->after === null ? null : array_keys($audit->after);
        if (is_array($expectedBefore)) {
            sort($expectedBefore);
            sort($actualBefore);
        }
        $expectedAfter = $keys['after'];
        sort($expectedAfter);
        sort($actualAfter);
        expect($audit->actor_id)->toBe($actorId)
            ->and($audit->subject_id)->toBe($subjectId)
            ->and(Str::isUuid((string) $audit->request_id))->toBeTrue()
            ->and($audit->ip_address)->toBe('203.0.113.55')
            ->and($audit->occurred_at->between($startedAt, now()->addMinute()))->toBeTrue()
            ->and($actualBefore)->toBe($expectedBefore)
            ->and($actualAfter)->toBe($expectedAfter);
        $serialized = json_encode([$audit->before, $audit->after], JSON_THROW_ON_ERROR);
        expect($serialized)->not->toContain('private')
            ->and($serialized)->not->toContain('contact')
            ->and($serialized)->not->toContain('location')
            ->and($serialized)->not->toContain('damage');
    }

    $pair = AuditEvent::query()->whereIn('action', ['sales_quote.accepted', 'sales_order.created'])->pluck('request_id')->unique();
    expect($pair)->toHaveCount(1);
});

it('rolls back the business transaction when an audit write fails', function (): void {
    $actor = r6StateUser(PermissionName::RentalCreate);
    $client = r6StateClient();
    $asset = r6StateAsset();
    $failure = new RuntimeException('injected audit failure');
    $this->withoutExceptionHandling();
    $listener = function (QueryExecuted $query) use ($failure): void {
        if (str_contains(strtolower($query->sql), 'insert into "audit_events"')) {
            throw $failure;
        }
    };
    $this->app['db']->listen($listener);

    expect(fn () => $this->actingAs($actor)->postJson('/operations/rental-reservations', [
        'reference' => 'REN-R6-FAIL-AUDIT',
        'client_id' => $client->id,
        'start_date' => CarbonImmutable::tomorrow()->toDateString(),
        'end_date' => CarbonImmutable::tomorrow()->addDay()->toDateString(),
        'fulfillment_mode' => 'delivery',
        'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
    ]))->toThrow($failure);

    expect(RentalReservation::query()->count())->toBe(0)
        ->and(RentalReservationItem::query()->count())->toBe(0)
        ->and(AuditEvent::query()->count())->toBe(0)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Available);
});

it('does not partially checkout, return, accept, fulfill, or transfer multi-item operations', function (string $operation): void {
    $actor = match ($operation) {
        'checkout', 'return' => r6StateUser($operation === 'checkout' ? PermissionName::RentalCheckout : PermissionName::RentalReturn),
        'accept' => r6StateUser(PermissionName::SalesApproveOrder),
        'fulfill' => r6StateUser(PermissionName::SalesFulfill),
        default => r6StateUser(PermissionName::SalesTransferOwnership),
    };
    $firstAsset = r6StateAsset($operation === 'return' ? AssetStatus::Assigned : AssetStatus::Available);
    $secondAsset = r6StateAsset($operation === 'return' ? AssetStatus::Assigned : AssetStatus::Available);

    if ($operation === 'checkout' || $operation === 'return') {
        $reservation = RentalReservation::query()->create([
            'reference' => 'REN-R6-MULTI-'.$operation,
            'client_id' => r6StateClient()->id,
            'created_by' => $actor->id,
            'status' => $operation === 'checkout' ? RentalReservationStatus::Reserved : RentalReservationStatus::CheckedOut,
            'start_date' => CarbonImmutable::tomorrow()->toDateString(),
            'end_date' => CarbonImmutable::tomorrow()->addDay()->toDateString(),
            'fulfillment_mode' => 'delivery',
            'total_cents' => 200,
        ]);
        $reservation->items()->createMany([
            ['operational_asset_id' => $firstAsset->id, 'quantity' => 1, 'rate_cents' => 100, 'line_total_cents' => 200],
            ['operational_asset_id' => $secondAsset->id, 'quantity' => 1, 'rate_cents' => 100, 'line_total_cents' => 200],
        ]);
        if ($operation === 'return') {
            RentalCheckout::query()->create(['rental_reservation_id' => $reservation->id, 'checked_out_by' => $actor->id, 'checked_out_at' => now(), 'condition_before' => ['engine' => 'good']]);
            $secondAsset->delete();
        } else {
            $job = DispatchJob::query()->create(['reference' => 'DSP-R6-MULTI', 'client' => 'R6', 'title' => 'R6 blocker', 'site' => 'R6', 'scheduled_start' => CarbonImmutable::tomorrow()->addHours(2), 'scheduled_end' => CarbonImmutable::tomorrow()->addHours(4), 'priority' => DispatchPriority::Routine, 'status' => DispatchStatus::Scheduled, 'created_by' => $actor->id, 'version' => 1]);
            $job->assetAssignments()->create(['operational_asset_id' => $secondAsset->id, 'assignment_type' => 'equipment', 'assigned_by' => $actor->id, 'active_from' => $job->scheduled_start]);
        }
        $url = $operation === 'checkout' ? "/operations/rental-reservations/{$reservation->id}/checkout" : "/operations/rental-reservations/{$reservation->id}/return";
        $this->actingAs($actor)->postJson($url, ['condition' => ['engine' => 'good']])->assertUnprocessable();
        expect($reservation->fresh()->status)->toBe($operation === 'checkout' ? RentalReservationStatus::Reserved : RentalReservationStatus::CheckedOut)
            ->and(RentalCheckout::query()->count())->toBe($operation === 'checkout' ? 0 : 1)
            ->and($this->getConnection()->table('rental_returns')->count())->toBe(0)
            ->and($firstAsset->fresh()->status)->toBe($operation === 'return' ? AssetStatus::Assigned : AssetStatus::Available)
            ->and(AuditEvent::query()->whereIn('action', ['rental_reservation.checked_out', 'rental_reservation.returned'])->count())->toBe(0);
    } else {
        $first = r6StateCatalog($operation === 'transfer' ? $firstAsset : null, $operation === 'fulfill' ? 1 : 0, $operation === 'fulfill' ? 1 : 0);
        $second = r6StateCatalog($operation === 'transfer' ? $secondAsset : null, $operation === 'fulfill' ? 0 : 0, $operation === 'fulfill' ? 0 : 0);
        $status = $operation === 'accept' ? SalesQuoteStatus::Draft : ($operation === 'fulfill' ? SalesOrderStatus::Confirmed : SalesOrderStatus::Fulfilled);
        if ($operation === 'accept') {
            $quote = SalesQuote::query()->create(['reference' => 'QUO-R6-MULTI', 'client_id' => r6StateClient()->id, 'created_by' => $actor->id, 'status' => SalesQuoteStatus::Draft, 'currency' => 'PHP', 'total_cents' => 200]);
            $quote->items()->createMany([['sales_catalog_item_id' => $first->id, 'quantity' => 1, 'unit_price_cents' => 100, 'line_total_cents' => 100], ['sales_catalog_item_id' => $second->id, 'quantity' => 1, 'unit_price_cents' => 100, 'line_total_cents' => 100]]);
            $this->actingAs($actor)->postJson("/operations/sales/quotes/{$quote->id}/accept")->assertUnprocessable();
            expect($quote->fresh()->status)->toBe(SalesQuoteStatus::Draft);
        } else {
            $order = SalesOrder::query()->create(['reference' => 'SO-R6-MULTI-'.$operation, 'client_id' => r6StateClient()->id, 'created_by' => $actor->id, 'status' => $status, 'currency' => 'PHP', 'total_cents' => 200]);
            $order->items()->createMany([['sales_catalog_item_id' => $first->id, 'quantity' => 1, 'unit_price_cents' => 100, 'line_total_cents' => 100], ['sales_catalog_item_id' => $second->id, 'quantity' => 1, 'unit_price_cents' => 100, 'line_total_cents' => 100]]);
            if ($operation === 'transfer') {
                $existing = r6StateOrder($actor, $second, SalesOrderStatus::Transferred);
                $existingItem = $existing->items()->first();
                $this->getConnection()->table('ownership_transfers')->insert(['sales_order_id' => $existing->id, 'sales_order_item_id' => $existingItem->id, 'sales_catalog_item_id' => $second->id, 'operational_asset_id' => $secondAsset->id, 'transferred_by' => $actor->id, 'transferred_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            }
            $url = $operation === 'fulfill' ? "/operations/sales/orders/{$order->id}/fulfill" : "/operations/sales/orders/{$order->id}/transfer-ownership";
            $this->actingAs($actor)->postJson($url)->assertUnprocessable();
            expect($order->fresh()->status)->toBe($status);
        }
        expect($this->getConnection()->table('sales_inventory_ledger')->where('sales_order_id', $operation === 'accept' ? 0 : $order->id)->count())->toBe(0)
            ->and(AuditEvent::query()->whereIn('action', ['sales_quote.accepted', 'sales_order.created', 'sales_order.fulfilled', 'sales_order.ownership_transferred'])->count())->toBe(0);
    }
})->with(['checkout', 'return', 'accept', 'fulfill', 'transfer']);
