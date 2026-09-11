<?php

declare(strict_types=1);

use App\Modules\HoursOfService\Actions\RecordDutyStatusTransitionAction;
use App\Modules\HoursOfService\Actions\StartOperatorShiftAction;
use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Platform\Identity\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 3).'/vendor/autoload.php';

[$mode, $userId, $status, $argumentBarrier] = array_pad(array_slice($argv, 1), 4, null);
$barrier = getenv('CORE2_HOS_BARRIER') ?: $argumentBarrier;

function hosWorkerTrace(string $message): void
{
    $tracePath = getenv('CORE2_HOS_TRACE_PATH');
    if (is_string($tracePath) && $tracePath !== '') {
        file_put_contents($tracePath, $message."\n", FILE_APPEND);
    }
}

function hosWorkerReport(array $result): void
{
    $payload = json_encode($result, JSON_THROW_ON_ERROR);
    $resultPath = getenv('CORE2_HOS_RESULT_PATH');

    if (is_string($resultPath) && $resultPath !== '') {
        file_put_contents($resultPath, $payload);

        return;
    }

    fwrite(STDOUT, $payload);
}

function hosWorkerWaitAtBarrier(?string $barrier): void
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
        throw new RuntimeException('HOS worker barrier timed out.');
    }
}

hosWorkerTrace('autoloaded');
$app = require dirname(__DIR__, 3).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
hosWorkerTrace('application-bootstrapped');

try {
    if (! is_string($mode) || ! is_string($userId) || ! is_string($status)) {
        throw new InvalidArgumentException('HOS worker mode, user, and duty status are required.');
    }

    DB::statement("set lock_timeout = '15s'");
    $operator = User::query()->findOrFail((int) $userId);
    hosWorkerWaitAtBarrier(is_string($barrier) ? $barrier : null);

    $dutyStatus = DutyStatus::from($status);
    $result = match ($mode) {
        'start' => ['shift_id' => $app->make(StartOperatorShiftAction::class)->execute(
            user: $operator,
            initialDutyStatus: $dutyStatus,
        )->id],
        'transition' => ['shift_id' => $app->make(RecordDutyStatusTransitionAction::class)->execute(
            user: $operator,
            nextStatus: $dutyStatus,
        )->id],
        default => throw new InvalidArgumentException("Unsupported HOS worker mode: {$mode}"),
    };

    hosWorkerReport(['ok' => true, 'result' => $result]);
    exit(0);
} catch (Throwable $exception) {
    hosWorkerTrace($exception::class.': '.$exception->getMessage());
    hosWorkerReport(['ok' => false, 'exception' => $exception::class, 'message' => $exception->getMessage()]);
    exit(1);
}
