<?php

declare(strict_types=1);

use App\Modules\Assignment\Actions\AssignDispatchResources;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Actions\ApproveRentalReservation;
use App\Modules\Rental\Actions\CheckoutRental;
use App\Modules\Rental\Actions\CreateRentalReservation;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Sales\Actions\AcceptSalesQuote;
use App\Modules\Sales\Actions\FulfillSalesOrder;
use App\Modules\Sales\Actions\TransferSalesOwnership;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesQuote;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetStatusGuard;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Validation\ValidationException;

require dirname(__DIR__, 3).'/vendor/autoload.php';

$workerArguments = array_slice($argv, 1);
$mode = $workerArguments[0] ?? null;
$actorId = $workerArguments[1] ?? null;
$recordId = $workerArguments[2] ?? null;
$extra = $workerArguments[3] ?? null;
$extraTwo = $workerArguments[4] ?? null;
$barrier = getenv('CORE2_R6_BARRIER') ?: null;

function r6WorkerTrace(string $message): void
{
    $path = getenv('CORE2_R6_TRACE_PATH');
    if (is_string($path) && $path !== '') {
        file_put_contents($path, $message."\n", FILE_APPEND);
    }
}

function r6WorkerReport(array $result): void
{
    $path = getenv('CORE2_R6_RESULT_PATH');
    $payload = json_encode($result, JSON_THROW_ON_ERROR);
    if (is_string($path) && $path !== '') {
        file_put_contents($path, $payload);
    } else {
        fwrite(STDOUT, $payload);
    }
}

function r6WorkerWaitAtBarrier(?string $barrier): void
{
    if (! is_string($barrier) || $barrier === '') {
        return;
    }
    touch($barrier.'.ready.'.getmypid());
    $deadline = microtime(true) + 20;
    while (! file_exists($barrier.'.go') && microtime(true) < $deadline) {
        usleep(10_000);
    }
    if (! file_exists($barrier.'.go')) {
        throw new RuntimeException('R6 worker barrier timed out.');
    }
}

$app = require dirname(__DIR__, 3).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

try {
    if (! is_string($mode) || ! is_string($actorId)) {
        throw new InvalidArgumentException('R6 worker mode and actor are required.');
    }
    DB::statement("set lock_timeout = '15s'");
    $actor = User::query()->findOrFail((int) $actorId);
    r6WorkerWaitAtBarrier($barrier);

    $result = match ($mode) {
        'rental_create' => (static function () use ($app, $actor, $recordId, $extra, $extraTwo): array {
            $reservation = $app->make(CreateRentalReservation::class)->handle($actor, [
                'reference' => (string) $extra,
                'client_id' => (int) $recordId,
                'start_date' => now()->addDay()->toDateString(),
                'end_date' => now()->addDays(2)->toDateString(),
                'fulfillment_mode' => 'delivery',
                'items' => array_map(static fn (int $assetId): array => ['operational_asset_id' => $assetId, 'quantity' => 1, 'rate_cents' => 100], json_decode((string) $extraTwo, true, 512, JSON_THROW_ON_ERROR)),
            ]);

            return ['id' => $reservation->id];
        })(),
        'sales_accept' => ['id' => $app->make(AcceptSalesQuote::class)->handle(SalesQuote::query()->findOrFail((int) $recordId), $actor)->id],
        'rental_approve' => ['id' => $app->make(ApproveRentalReservation::class)->handle(RentalReservation::query()->findOrFail((int) $recordId), $actor)->id],
        'rental_checkout' => ['id' => $app->make(CheckoutRental::class)->handle(RentalReservation::query()->findOrFail((int) $recordId), $actor, ['condition' => ['engine' => 'good']])->id],
        'dispatch_assign' => (static function () use ($app, $actor, $recordId, $extra): array {
            $data = json_decode((string) $extra, true, 512, JSON_THROW_ON_ERROR);
            $job = DispatchJob::query()->findOrFail((int) $recordId);
            $result = $app->make(AssignDispatchResources::class)->handle($actor, $job, [], array_map(static fn (int $assetId): array => ['operational_asset_id' => $assetId, 'assignment_type' => 'equipment'], $data['asset_ids']));

            return ['id' => $result->id];
        })(),
        'sales_fulfill' => ['id' => $app->make(FulfillSalesOrder::class)->handle(SalesOrder::query()->findOrFail((int) $recordId), $actor)->id],
        'sales_transfer' => ['id' => $app->make(TransferSalesOwnership::class)->handle(SalesOrder::query()->findOrFail((int) $recordId), $actor)->id],
        'restore_asset' => (static function () use ($app, $recordId): array {
            $asset = OperationalAsset::query()->findOrFail((int) $recordId);
            $app->make(OperationalAssetStatusGuard::class)->transition($asset, AssetStatus::Available, new AssetUsageRequest(
                assetId: $asset->id,
                usageType: AssetUsageType::AssetStatusChange,
                targetStatus: AssetStatus::Available,
            ));

            return ['id' => $asset->id];
        })(),
        default => throw new InvalidArgumentException("Unsupported R6 worker mode: {$mode}"),
    };
    r6WorkerReport(['ok' => true, 'result' => $result]);
    exit(0);
} catch (ValidationException $exception) {
    r6WorkerReport(['ok' => false, 'exception' => $exception::class, 'errors' => $exception->errors()]);
    exit(1);
} catch (Throwable $exception) {
    r6WorkerTrace($exception::class.': '.$exception->getMessage());
    r6WorkerReport(['ok' => false, 'exception' => $exception::class, 'message' => $exception->getMessage()]);
    exit(1);
}
