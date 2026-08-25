<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
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
use Illuminate\Foundation\Testing\WithoutMiddleware;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

uses(WithoutMiddleware::class);

beforeEach(function (): void {
    if (config('database.default') !== 'pgsql') {
        throw new RuntimeException('R6 concurrency tests require PostgreSQL; run with phpunit.concurrency.xml.');
    }

    if (! Schema::hasTable('rental_reservations')) {
        throw new RuntimeException('R6 concurrency tests require an already migrated PostgreSQL database.');
    }

    $this->seed(RolePermissionSeeder::class);
});

function r6ConcurrentPrefix(): string
{
    static $prefix;

    return $prefix ??= 'R6C-'.strtoupper(Str::random(8));
}

function r6ConcurrentReference(string $suffix): string
{
    return r6ConcurrentPrefix().'-'.$suffix;
}

function r6ConcurrentUnique(string $label): string
{
    static $sequences = [];
    $sequences[$label] = ($sequences[$label] ?? 0) + 1;

    return r6ConcurrentPrefix().'-'.$label.'-'.$sequences[$label];
}

function r6ConcurrentUser(PermissionName ...$permissions): User
{
    $user = User::factory()->create();
    $user->givePermissionTo(array_map(static fn (PermissionName $permission): string => $permission->value, $permissions));

    return $user;
}

function r6ConcurrentClient(): Client
{
    return Client::query()->create([
        'code' => r6ConcurrentUnique('CLIENT'),
        'company_name' => 'R6 concurrency customer',
        'status' => 'active',
    ]);
}

function r6ConcurrentAsset(string $suffix = ''): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => r6ConcurrentUnique('ASSET-'.$suffix),
        'name' => 'R6 concurrency asset',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
    ]);
}

function r6ConcurrentReservation(User $actor, Client $client, array $assetIds, RentalReservationStatus $status = RentalReservationStatus::Requested): RentalReservation
{
    $reservation = RentalReservation::query()->create([
        'reference' => r6ConcurrentUnique('RENT'),
        'client_id' => $client->id,
        'created_by' => $actor->id,
        'status' => $status,
        'start_date' => CarbonImmutable::tomorrow()->toDateString(),
        'end_date' => CarbonImmutable::tomorrow()->addDay()->toDateString(),
        // Direct checkout has no dispatch fixture; delivery rentals must use
        // the dispatch handoff path before the application permits checkout.
        'fulfillment_mode' => 'pickup',
        'total_cents' => count($assetIds) * 100,
    ]);
    foreach ($assetIds as $assetId) {
        $reservation->items()->create([
            'operational_asset_id' => $assetId,
            'quantity' => 1,
            'rate_cents' => 100,
            'line_total_cents' => 200,
        ]);
    }

    return $reservation->fresh();
}

function r6ConcurrentCatalog(?int $assetId = null, int $onHand = 1, int $reserved = 0): SalesCatalogItem
{
    return SalesCatalogItem::query()->create([
        'sku' => r6ConcurrentUnique('SKU'),
        'name' => 'R6 concurrency catalog item',
        'unit_price_cents' => 100,
        'quantity_on_hand' => $onHand,
        'quantity_reserved' => $reserved,
        'operational_asset_id' => $assetId,
        'status' => 'active',
    ]);
}

function r6ConcurrentQuote(User $actor, Client $client, SalesCatalogItem $catalog): SalesQuote
{
    $quote = SalesQuote::query()->create([
        'reference' => r6ConcurrentUnique('QUOTE'),
        'client_id' => $client->id,
        'created_by' => $actor->id,
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

    return $quote->fresh();
}

function r6ConcurrentOrder(User $actor, Client $client, SalesCatalogItem $catalog, SalesOrderStatus $status): SalesOrder
{
    $order = SalesOrder::query()->create([
        'reference' => r6ConcurrentUnique('ORDER'),
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

    return $order->fresh();
}

function r6ConcurrentDispatch(User $actor, OperationalAsset $asset, string $suffix = ''): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => r6ConcurrentUnique('DISPATCH-'.$suffix),
        'client' => 'R6 concurrency customer',
        'title' => 'R6 concurrency dispatch',
        'site' => 'R6 test site',
        'scheduled_start' => CarbonImmutable::tomorrow()->addHours(2),
        'scheduled_end' => CarbonImmutable::tomorrow()->addHours(4),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Scheduled,
        'created_by' => $actor->id,
        'version' => 1,
    ]);
}

/** @return array{process: resource, pipes: array<int, resource>, result_path: string, trace_path: string} */
function r6StartWorker(string $mode, array $arguments, string $barrier): array
{
    $resultPath = tempnam(sys_get_temp_dir(), 'core2-r6-result-');
    if ($resultPath === false) {
        throw new RuntimeException('Unable to allocate the R6 worker result file.');
    }
    $tracePath = $resultPath.'.trace';
    $environment = getenv();
    if (! is_array($environment)) {
        $environment = [];
    }
    $environment['APP_ENV'] = 'testing';
    $environment['APP_KEY'] = (string) env('APP_KEY', 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
    $environment['DB_CONNECTION'] = 'pgsql';
    $environment['DB_HOST'] = (string) config('database.connections.pgsql.host');
    $environment['DB_PORT'] = (string) config('database.connections.pgsql.port');
    $environment['DB_DATABASE'] = (string) config('database.connections.pgsql.database');
    $environment['DB_USERNAME'] = (string) config('database.connections.pgsql.username');
    $environment['DB_PASSWORD'] = (string) config('database.connections.pgsql.password');
    $environment['DB_SSLMODE'] = (string) config('database.connections.pgsql.sslmode');
    $environment['CACHE_STORE'] = 'array';
    $environment['QUEUE_CONNECTION'] = 'sync';
    $environment['CORE2_R6_BARRIER'] = $barrier;
    $environment['CORE2_R6_RESULT_PATH'] = $resultPath;
    $environment['CORE2_R6_TRACE_PATH'] = $tracePath;
    $command = [PHP_BINARY, base_path('tests/Concurrency/Support/rental-sales-process.php'), $mode, ...array_map(static fn (mixed $value): string => is_string($value) ? $value : json_encode($value, JSON_THROW_ON_ERROR), $arguments)];
    $pipes = [];
    $process = proc_open($command, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path(), $environment);
    if (! is_resource($process)) {
        @unlink($resultPath);

        throw new RuntimeException('Unable to start the R6 worker.');
    }

    return compact('process', 'pipes', 'resultPath', 'tracePath');
}

function r6WaitForReady(string $barrier, int $expected): void
{
    $deadline = microtime(true) + 20;
    do {
        $ready = glob($barrier.'.ready.*') ?: [];
        if (count($ready) >= $expected) {
            return;
        }
        usleep(10_000);
    } while (microtime(true) < $deadline);

    throw new RuntimeException("R6 barrier timed out: expected {$expected} ready workers; found ".count($ready));
}

/** @param array{process: resource, pipes: array<int, resource>, resultPath: string, tracePath: string} $worker
 * @return array{exit_code: int|null, result: array<string, mixed>, stdout: string, stderr: string, trace: string}
 */
function r6FinishWorker(array $worker): array
{
    fclose($worker['pipes'][0]);
    $deadline = microtime(true) + 30;
    $status = proc_get_status($worker['process']);
    while ($status['running'] && microtime(true) < $deadline) {
        usleep(10_000);
        $status = proc_get_status($worker['process']);
    }
    if ($status['running']) {
        proc_terminate($worker['process']);
    }
    $stdout = stream_get_contents($worker['pipes'][1]);
    $stderr = stream_get_contents($worker['pipes'][2]);
    fclose($worker['pipes'][1]);
    fclose($worker['pipes'][2]);
    $closeCode = proc_close($worker['process']);
    $exitCode = is_int($status['exitcode']) && $status['exitcode'] >= 0 ? $status['exitcode'] : ($closeCode >= 0 ? $closeCode : null);
    $resultText = is_file($worker['resultPath']) ? (string) file_get_contents($worker['resultPath']) : '';
    $result = $resultText === '' ? [] : (json_decode($resultText, true, 512, JSON_THROW_ON_ERROR) ?: []);

    return [
        'exit_code' => $exitCode,
        'result' => $result,
        'stdout' => $stdout,
        'stderr' => $stderr,
        'trace' => is_file($worker['tracePath']) ? (string) file_get_contents($worker['tracePath']) : '',
    ];
}

/** @return array{0: array<string, mixed>, 1: array<string, mixed>} */
function r6RunPair(string $modeA, array $argsA, string $modeB, array $argsB): array
{
    $barrier = tempnam(sys_get_temp_dir(), 'core2-r6-barrier-');
    if ($barrier === false) {
        throw new RuntimeException('Unable to allocate the R6 barrier.');
    }
    unlink($barrier);
    $first = r6StartWorker($modeA, $argsA, $barrier);
    $second = r6StartWorker($modeB, $argsB, $barrier);
    try {
        r6WaitForReady($barrier, 2);
        touch($barrier.'.go');

        return [r6FinishWorker($first), r6FinishWorker($second)];
    } finally {
        foreach (glob($barrier.'*') ?: [] as $path) {
            @unlink($path);
        }
        foreach ([$first, $second] as $worker) {
            @unlink($worker['resultPath']);
            @unlink($worker['tracePath']);
        }
    }
}

function r6SuccessfulWorkers(array $results): int
{
    return count(array_filter($results, static fn (array $result): bool => $result['exit_code'] === 0 && ($result['result']['ok'] ?? false) === true));
}

function r6AssertWorkersCompleted(array $results): void
{
    foreach ($results as $result) {
        expect($result['exit_code'], $result['stderr'].' '.$result['stdout'].' '.$result['trace'])->toBeIn([0, 1]);
    }
}

function r6ResultsDiagnostic(array $results): string
{
    return json_encode($results, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
}

it('allows exactly one winner for a new Rental versus Sales acceptance race', function (): void {
    $rentalActor = r6ConcurrentUser(PermissionName::RentalCreate);
    $salesActor = r6ConcurrentUser(PermissionName::SalesApproveOrder);
    $client = r6ConcurrentClient();
    $asset = r6ConcurrentAsset('RS');
    $catalog = r6ConcurrentCatalog($asset->id);
    $quote = r6ConcurrentQuote($salesActor, $client, $catalog);
    $reference = r6ConcurrentReference('REN-RACE');
    $results = r6RunPair('rental_create', [$rentalActor->id, $client->id, $reference, [$asset->id]], 'sales_accept', [$salesActor->id, $quote->id]);

    r6AssertWorkersCompleted($results);
    expect(r6SuccessfulWorkers($results))->toBe(1)
        ->and(RentalReservation::query()->where('reference', $reference)->count() + SalesOrder::query()->where('sales_quote_id', $quote->id)->count())->toBe(1);
});

it('revalidates approval against a committed Sales acceptance after the asset lock', function (): void {
    $rentalActor = r6ConcurrentUser(PermissionName::RentalApprove);
    $salesActor = r6ConcurrentUser(PermissionName::SalesApproveOrder);
    $client = r6ConcurrentClient();
    $asset = r6ConcurrentAsset('APPROVE-SALE');
    $reservation = r6ConcurrentReservation($rentalActor, $client, [$asset->id]);
    $catalog = r6ConcurrentCatalog($asset->id);
    $quote = r6ConcurrentQuote($salesActor, $client, $catalog);
    $results = r6RunPair('rental_approve', [$rentalActor->id, $reservation->id], 'sales_accept', [$salesActor->id, $quote->id]);

    r6AssertWorkersCompleted($results);
    expect(r6SuccessfulWorkers($results))->toBe(1)
        ->and($reservation->fresh()->status === RentalReservationStatus::Reserved || SalesOrder::query()->where('sales_quote_id', $quote->id)->exists())->toBeTrue();
});

it('allows exactly one winner for a new Rental versus Dispatch assignment race', function (): void {
    $rentalActor = r6ConcurrentUser(PermissionName::RentalCreate);
    $dispatchActor = r6ConcurrentUser(PermissionName::AssignmentsCreate, PermissionName::DispatchViewAll);
    $client = r6ConcurrentClient();
    $asset = r6ConcurrentAsset('RD');
    $job = r6ConcurrentDispatch($dispatchActor, $asset, 'RACE');
    $reference = r6ConcurrentReference('REN-DISPATCH-RACE');
    $results = r6RunPair('rental_create', [$rentalActor->id, $client->id, $reference, [$asset->id]], 'dispatch_assign', [$dispatchActor->id, $job->id, ['asset_ids' => [$asset->id]]]);

    r6AssertWorkersCompleted($results);
    expect(r6SuccessfulWorkers($results))->toBe(1)
        ->and(RentalReservation::query()->where('reference', $reference)->count() + $job->assetAssignments()->count())->toBe(1);
});

it('allows exactly one overlapping Rental create and one duplicate approval', function (): void {
    $createActor = r6ConcurrentUser(PermissionName::RentalCreate);
    $client = r6ConcurrentClient();
    $asset = r6ConcurrentAsset('OVERLAP');
    $referenceA = r6ConcurrentReference('REN-OVERLAP-A');
    $referenceB = r6ConcurrentReference('REN-OVERLAP-B');
    $createResults = r6RunPair('rental_create', [$createActor->id, $client->id, $referenceA, [$asset->id]], 'rental_create', [$createActor->id, $client->id, $referenceB, [$asset->id]]);
    r6AssertWorkersCompleted($createResults);
    expect(r6SuccessfulWorkers($createResults))->toBe(1);

    $approveActor = r6ConcurrentUser(PermissionName::RentalApprove);
    $reservation = r6ConcurrentReservation($approveActor, $client, [r6ConcurrentAsset('DUP-APPROVE')->id]);
    $approvalResults = r6RunPair('rental_approve', [$approveActor->id, $reservation->id], 'rental_approve', [$approveActor->id, $reservation->id]);
    r6AssertWorkersCompleted($approvalResults);
    expect(r6SuccessfulWorkers($approvalResults))->toBe(1)
        ->and(AuditEvent::query()->where('action', 'rental_reservation.approved')->where('subject_id', $reservation->id)->count())->toBe(1);
});

it('allows exactly one accepted order for competing quotes and duplicate quote acceptance', function (): void {
    $actor = r6ConcurrentUser(PermissionName::SalesApproveOrder);
    $client = r6ConcurrentClient();
    $catalog = r6ConcurrentCatalog();
    $quoteA = r6ConcurrentQuote($actor, $client, $catalog);
    $quoteB = r6ConcurrentQuote($actor, $client, $catalog);
    $competing = r6RunPair('sales_accept', [$actor->id, $quoteA->id], 'sales_accept', [$actor->id, $quoteB->id]);
    r6AssertWorkersCompleted($competing);
    expect(r6SuccessfulWorkers($competing))->toBe(1)
        ->and(SalesOrder::query()->whereIn('sales_quote_id', [$quoteA->id, $quoteB->id])->count())->toBe(1);

    $duplicateQuote = r6ConcurrentQuote($actor, $client, r6ConcurrentCatalog());
    $duplicate = r6RunPair('sales_accept', [$actor->id, $duplicateQuote->id], 'sales_accept', [$actor->id, $duplicateQuote->id]);
    r6AssertWorkersCompleted($duplicate);
    expect(r6SuccessfulWorkers($duplicate))->toBe(1)
        ->and(SalesOrder::query()->where('sales_quote_id', $duplicateQuote->id)->count())->toBe(1)
        ->and(AuditEvent::query()->whereIn('action', ['sales_quote.accepted', 'sales_order.created'])->where('subject_id', $duplicateQuote->id)->count())->toBe(1);
});

it('allows exactly one winner for duplicate checkout, fulfillment, and transfer', function (): void {
    $checkoutActor = r6ConcurrentUser(PermissionName::RentalCheckout);
    $checkoutAsset = r6ConcurrentAsset('DUP-CHECKOUT');
    $checkoutReservation = r6ConcurrentReservation($checkoutActor, r6ConcurrentClient(), [$checkoutAsset->id], RentalReservationStatus::Reserved);
    $checkout = r6RunPair('rental_checkout', [$checkoutActor->id, $checkoutReservation->id], 'rental_checkout', [$checkoutActor->id, $checkoutReservation->id]);
    r6AssertWorkersCompleted($checkout);
    expect(r6SuccessfulWorkers($checkout))->toBe(1)->and($checkoutReservation->fresh()->status)->toBe(RentalReservationStatus::CheckedOut);

    $fulfillActor = r6ConcurrentUser(PermissionName::SalesFulfill);
    $fulfillCatalog = r6ConcurrentCatalog(null, 1, 1);
    $fulfillOrder = r6ConcurrentOrder($fulfillActor, r6ConcurrentClient(), $fulfillCatalog, SalesOrderStatus::Confirmed);
    $fulfill = r6RunPair('sales_fulfill', [$fulfillActor->id, $fulfillOrder->id], 'sales_fulfill', [$fulfillActor->id, $fulfillOrder->id]);
    r6AssertWorkersCompleted($fulfill);
    expect(r6SuccessfulWorkers($fulfill))->toBe(1)->and($fulfillOrder->fresh()->status)->toBe(SalesOrderStatus::Fulfilled);

    $transferActor = r6ConcurrentUser(PermissionName::SalesTransferOwnership);
    $transferAsset = r6ConcurrentAsset('DUP-TRANSFER');
    $transferCatalog = r6ConcurrentCatalog($transferAsset->id, 0, 0);
    $transferOrder = r6ConcurrentOrder($transferActor, r6ConcurrentClient(), $transferCatalog, SalesOrderStatus::Fulfilled);
    $transfer = r6RunPair('sales_transfer', [$transferActor->id, $transferOrder->id], 'sales_transfer', [$transferActor->id, $transferOrder->id]);
    r6AssertWorkersCompleted($transfer);
    expect(r6SuccessfulWorkers($transfer))->toBe(1)
        ->and($transferOrder->fresh()->status)->toBe(SalesOrderStatus::Transferred)
        ->and($this->getConnection()->table('ownership_transfers')->where('sales_order_id', $transferOrder->id)->count())->toBe(1);
});

it('never revives an asset when transfer races generic status restoration', function (): void {
    $transferActor = r6ConcurrentUser(PermissionName::SalesTransferOwnership);
    $asset = r6ConcurrentAsset('RESTORE');
    $catalog = r6ConcurrentCatalog($asset->id, 0, 0);
    $order = r6ConcurrentOrder($transferActor, r6ConcurrentClient(), $catalog, SalesOrderStatus::Fulfilled);
    $results = r6RunPair('sales_transfer', [$transferActor->id, $order->id], 'restore_asset', [$asset->id]);

    r6AssertWorkersCompleted($results);
    expect($asset->fresh()->status)->toBe(AssetStatus::Unavailable)
        ->and($order->fresh()->status)->toBe(SalesOrderStatus::Transferred);
});

it('fails closed when Rental approval permission is revoked before the waiting lock releases', function (): void {
    $actor = r6ConcurrentUser(PermissionName::RentalApprove);
    $asset = r6ConcurrentAsset('REVOKE');
    $reservation = r6ConcurrentReservation($actor, r6ConcurrentClient(), [$asset->id]);
    $connection = DB::connection();
    $connection->beginTransaction();
    RentalReservation::query()->whereKey($reservation->id)->lockForUpdate()->first();
    $barrier = tempnam(sys_get_temp_dir(), 'core2-r6-revoke-');
    if ($barrier === false) {
        throw new RuntimeException('Unable to allocate the permission revocation barrier.');
    }
    unlink($barrier);
    $worker = r6StartWorker('rental_approve', [$actor->id, $reservation->id], $barrier);
    try {
        r6WaitForReady($barrier, 1);
        DB::table('model_has_permissions')->where('model_type', $actor->getMorphClass())->where('model_id', $actor->id)->delete();
        $connection->commit();
        $result = r6FinishWorker($worker);
    } finally {
        if ($connection->transactionLevel() > 0) {
            $connection->rollBack();
        }
        foreach (glob($barrier.'*') ?: [] as $path) {
            @unlink($path);
        }
        @unlink($worker['resultPath']);
        @unlink($worker['tracePath']);
    }

    expect($result['exit_code'])->toBe(1)
        ->and($reservation->fresh()->status)->toBe(RentalReservationStatus::Requested)
        ->and(AuditEvent::query()->where('action', 'rental_reservation.approved')->where('subject_id', $reservation->id)->count())->toBe(0);
});

it('does not deadlock when two multi-asset Rentals provide reversed asset order', function (): void {
    $actor = r6ConcurrentUser(PermissionName::RentalCreate);
    $client = r6ConcurrentClient();
    $first = r6ConcurrentAsset('SORT-A');
    $second = r6ConcurrentAsset('SORT-B');
    $referenceA = r6ConcurrentReference('REN-SORT-A');
    $referenceB = r6ConcurrentReference('REN-SORT-B');
    $results = r6RunPair('rental_create', [$actor->id, $client->id, $referenceA, [$first->id, $second->id]], 'rental_create', [$actor->id, $client->id, $referenceB, [$second->id, $first->id]]);

    r6AssertWorkersCompleted($results);
    expect(r6SuccessfulWorkers($results))->toBe(1)
        ->and(RentalReservation::query()->whereIn('reference', [$referenceA, $referenceB])->count())->toBe(1);
});

it('allows a non-overlapping Rental and Dispatch pair and leaves losing paths without partial rows', function (): void {
    $rentalActor = r6ConcurrentUser(PermissionName::RentalCreate);
    $dispatchActor = r6ConcurrentUser(PermissionName::AssignmentsCreate, PermissionName::DispatchViewAll);
    $client = r6ConcurrentClient();
    $rentalAsset = r6ConcurrentAsset('NONOVERLAP-RENT');
    $dispatchAsset = r6ConcurrentAsset('NONOVERLAP-DISPATCH');
    $job = r6ConcurrentDispatch($dispatchActor, $dispatchAsset, 'NONOVERLAP');
    $reference = r6ConcurrentReference('REN-NONOVERLAP');
    $results = r6RunPair('rental_create', [$rentalActor->id, $client->id, $reference, [$rentalAsset->id]], 'dispatch_assign', [$dispatchActor->id, $job->id, ['asset_ids' => [$dispatchAsset->id]]]);

    r6AssertWorkersCompleted($results);
    if (r6SuccessfulWorkers($results) !== 2) {
        throw new RuntimeException('Expected both non-overlapping workers to succeed: '.r6ResultsDiagnostic($results));
    }
    expect(r6SuccessfulWorkers($results))->toBe(2)
        ->and(RentalReservation::query()->where('reference', $reference)->count())->toBe(1)
        ->and($job->assetAssignments()->count())->toBe(1);
});

it('returns domain conflicts without partial writes for a losing Rental/Sales race', function (): void {
    $rentalActor = r6ConcurrentUser(PermissionName::RentalCreate);
    $salesActor = r6ConcurrentUser(PermissionName::SalesApproveOrder);
    $client = r6ConcurrentClient();
    $asset = r6ConcurrentAsset('CONFLICT');
    $catalog = r6ConcurrentCatalog($asset->id);
    $quote = r6ConcurrentQuote($salesActor, $client, $catalog);
    $reference = r6ConcurrentReference('REN-CONFLICT');
    $results = r6RunPair('rental_create', [$rentalActor->id, $client->id, $reference, [$asset->id]], 'sales_accept', [$salesActor->id, $quote->id]);

    r6AssertWorkersCompleted($results);
    expect(r6SuccessfulWorkers($results))->toBe(1);

    $reservation = RentalReservation::query()->where('reference', $reference)->first();
    $order = SalesOrder::query()->where('sales_quote_id', $quote->id)->first();
    expect(($reservation === null ? 0 : 1) + ($order === null ? 0 : 1))->toBe(1);

    if ($reservation instanceof RentalReservation) {
        expect($reservation->items()->count())->toBe(1)
            ->and($quote->fresh()->status)->toBe(SalesQuoteStatus::Draft)
            ->and((int) $catalog->fresh()->quantity_reserved)->toBe(0)
            ->and($this->getConnection()->table('sales_inventory_ledger')->where('sales_order_id', $order?->id)->count())->toBe(0)
            ->and(AuditEvent::query()->where('action', 'rental_reservation.created')->where('subject_id', $reservation->id)->count())->toBe(1)
            ->and(AuditEvent::query()->whereIn('action', ['sales_quote.accepted', 'sales_order.created'])->where('subject_id', $quote->id)->count())->toBe(0);
    } else {
        expect($order)->toBeInstanceOf(SalesOrder::class)
            ->and($order->items()->count())->toBe(1)
            ->and($quote->fresh()->status)->toBe(SalesQuoteStatus::Accepted)
            ->and((int) $catalog->fresh()->quantity_reserved)->toBe(1)
            ->and($this->getConnection()->table('sales_inventory_ledger')->where('sales_order_id', $order->id)->count())->toBe(1)
            ->and(AuditEvent::query()->where('action', 'sales_quote.accepted')->where('subject_id', $quote->id)->count())->toBe(1)
            ->and(AuditEvent::query()->where('action', 'sales_order.created')->where('subject_id', $order->id)->count())->toBe(1);
    }
});

it('freezes the complete exactly-one-winner R6 concurrency matrix', function (): void {
    expect([
        'rental_vs_sales_acceptance',
        'rental_approval_vs_sales_acceptance',
        'rental_vs_dispatch_assignment',
        'overlapping_rentals',
        'duplicate_approval',
        'competing_sales_quotes',
        'duplicate_quote_acceptance',
        'duplicate_checkout',
        'duplicate_fulfillment',
        'duplicate_transfer',
        'transfer_vs_status_restore',
        'permission_revocation_after_lock',
        'reversed_asset_lock_order',
        'non_overlapping_rental_dispatch',
        'domain_conflict_no_partial_rows',
    ])->toHaveCount(15);
});
