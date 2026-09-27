<?php

declare(strict_types=1);

use App\Modules\Assignment\Actions\LinkUnit;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

require dirname(__DIR__, 3).'/vendor/autoload.php';

[$userId, $assetId, $barrier] = array_pad(array_slice($argv, 1), 3, null);

function unitLinkWorkerReport(array $result): void
{
    fwrite(STDOUT, json_encode($result, JSON_THROW_ON_ERROR));
}

function unitLinkWorkerWaitAtBarrier(string $barrier): void
{
    touch($barrier.'.ready.'.getmypid());
    $deadline = microtime(true) + 20;
    while (! file_exists($barrier.'.go') && microtime(true) < $deadline) {
        usleep(5_000);
    }

    if (! file_exists($barrier.'.go')) {
        throw new RuntimeException('Unit link worker barrier timed out.');
    }
}

$app = require dirname(__DIR__, 3).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

try {
    if (! is_string($userId) || ! is_string($assetId) || ! is_string($barrier)) {
        throw new InvalidArgumentException('Unit link worker needs a user, an asset, and a barrier.');
    }

    DB::statement("set lock_timeout = '15s'");
    $operator = User::query()->findOrFail((int) $userId);
    $asset = OperationalAsset::query()->findOrFail((int) $assetId);
    unitLinkWorkerWaitAtBarrier($barrier);

    $outcome = $app->make(LinkUnit::class)->handle($operator, $asset);

    unitLinkWorkerReport(['ok' => true, 'created' => $outcome['created'], 'link_id' => $outcome['link']->id]);
    exit(0);
} catch (HttpExceptionInterface $exception) {
    unitLinkWorkerReport(['ok' => false, 'status' => $exception->getStatusCode(), 'message' => $exception->getMessage()]);
    exit(0);
} catch (Throwable $exception) {
    unitLinkWorkerReport(['ok' => false, 'exception' => $exception::class, 'message' => $exception->getMessage()]);
    exit(1);
}
