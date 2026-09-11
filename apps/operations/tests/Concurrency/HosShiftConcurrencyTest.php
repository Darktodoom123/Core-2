<?php

use App\Modules\HoursOfService\Actions\StartOperatorShiftAction;
use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;

uses(DatabaseMigrations::class);

beforeEach(function (): void {
    if (DB::connection()->getDriverName() !== 'pgsql') {
        throw new RuntimeException('HOS concurrency tests require PostgreSQL row locking; run with phpunit.concurrency.xml.');
    }

    if (! function_exists('pcntl_fork') || ! function_exists('pcntl_exec')) {
        throw new RuntimeException('HOS concurrency tests require the POSIX PCNTL extension; run them in the Linux test runner.');
    }
});

function hosNewBarrier(): string
{
    $path = tempnam(sys_get_temp_dir(), 'core2-hos-');
    if ($path === false) {
        throw new RuntimeException('Unable to allocate the HOS worker barrier.');
    }

    unlink($path);

    return $path;
}

/**
 * @return array{pid: int, result_path: string, trace_path: string}
 */
function hosStartWorker(string $mode, int $userId, DutyStatus $status, string $barrier): array
{
    $resultPath = tempnam(sys_get_temp_dir(), 'core2-hos-result-');
    if ($resultPath === false) {
        throw new RuntimeException('Unable to allocate the HOS worker result file.');
    }

    $tracePath = $resultPath.'.trace';
    $script = base_path('tests/Concurrency/Support/hos-process.php');
    $arguments = [$script, $mode, (string) $userId, $status->value, $barrier];
    $environment = getenv();
    if (! is_array($environment)) {
        $environment = [];
    }

    $environment['APP_ENV'] = 'testing';
    $environment['APP_KEY'] = (string) config('app.key', 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
    $environment['DB_CONNECTION'] = 'pgsql';
    $environment['DB_HOST'] = (string) config('database.connections.pgsql.host');
    $environment['DB_PORT'] = (string) config('database.connections.pgsql.port');
    $environment['DB_DATABASE'] = (string) config('database.connections.pgsql.database');
    $environment['DB_USERNAME'] = (string) config('database.connections.pgsql.username');
    $environment['DB_PASSWORD'] = (string) config('database.connections.pgsql.password');
    $environment['DB_SSLMODE'] = (string) config('database.connections.pgsql.sslmode');
    $environment['CACHE_STORE'] = 'array';
    $environment['QUEUE_CONNECTION'] = 'sync';
    $environment['CORE2_HOS_BARRIER'] = $barrier;
    $environment['CORE2_HOS_RESULT_PATH'] = $resultPath;
    $environment['CORE2_HOS_TRACE_PATH'] = $tracePath;

    $pid = pcntl_fork();
    if ($pid === -1) {
        @unlink($resultPath);

        throw new RuntimeException('Unable to fork the HOS worker.');
    }

    if ($pid === 0) {
        pcntl_exec(PHP_BINARY, $arguments, $environment);
        file_put_contents($resultPath, json_encode([
            'ok' => false,
            'exception' => 'Unable to exec the HOS worker.',
        ], JSON_THROW_ON_ERROR));
        exit(127);
    }

    return [
        'pid' => $pid,
        'result_path' => $resultPath,
        'trace_path' => $tracePath,
    ];
}

/**
 * @param  array{pid: int, result_path: string, trace_path: string}  $worker
 * @return array{exit_code: int|null, result: array<string, mixed>, trace: string}
 */
function hosFinishWorker(array $worker): array
{
    $status = 0;
    pcntl_waitpid($worker['pid'], $status);
    $rawResult = is_file($worker['result_path'])
        ? (string) file_get_contents($worker['result_path'])
        : '';
    $decoded = $rawResult !== '' ? json_decode($rawResult, true) : null;

    return [
        'exit_code' => pcntl_wifexited($status) ? pcntl_wexitstatus($status) : null,
        'result' => is_array($decoded) ? $decoded : ['ok' => false, 'raw' => $rawResult],
        'trace' => is_file($worker['trace_path']) ? (string) file_get_contents($worker['trace_path']) : '',
    ];
}

function hosWaitForReady(string $barrier, int $expected): void
{
    $deadline = microtime(true) + 30;
    do {
        $ready = glob($barrier.'.ready.*') ?: [];
        if (count($ready) >= $expected) {
            return;
        }

        usleep(10_000);
    } while (microtime(true) < $deadline);

    throw new RuntimeException("HOS worker barrier timed out: expected {$expected} ready workers; found ".count($ready));
}

/** @param list<array{exit_code: int|null, result: array<string, mixed>, trace: string}> $results */
function hosAssertSuccessfulWorkers(array $results): void
{
    foreach ($results as $result) {
        expect($result['exit_code'])->toBe(0);
        expect($result['result']['ok'] ?? false)->toBeTrue();
    }
}

afterEach(function (): void {
    foreach (glob(sys_get_temp_dir().DIRECTORY_SEPARATOR.'core2-hos-*') ?: [] as $path) {
        if (is_file($path)) {
            @unlink($path);
        }
    }
});

it('keeps one active shift and one open duty log when two starts race', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $barrier = hosNewBarrier();

    $first = hosStartWorker('start', $operator->id, DutyStatus::OPERATING, $barrier);
    $second = hosStartWorker('start', $operator->id, DutyStatus::DRIVING, $barrier);
    hosWaitForReady($barrier, 2);
    touch($barrier.'.go');

    $results = [hosFinishWorker($first), hosFinishWorker($second)];
    hosAssertSuccessfulWorkers($results);

    $activeShifts = OperatorShift::query()
        ->where('user_id', $operator->id)
        ->whereIn('status', [ShiftStatus::ACTIVE, ShiftStatus::ON_BREAK])
        ->get();
    $activeLogs = OperatorDutyLog::query()
        ->where('user_id', $operator->id)
        ->whereNull('ended_at')
        ->get();

    expect($activeShifts)->toHaveCount(1)
        ->and($activeLogs)->toHaveCount(1)
        ->and($activeLogs->first()->operator_shift_id)->toBe($activeShifts->first()->id)
        ->and(OperatorDutyLog::query()->where('operator_shift_id', $activeShifts->first()->id)->count())->toBe(1);
});

it('serializes concurrent duty transitions onto the same active shift', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $shift = app(StartOperatorShiftAction::class)->execute(
        user: $operator,
        initialDutyStatus: DutyStatus::OPERATING,
    );
    $barrier = hosNewBarrier();

    $first = hosStartWorker('transition', $operator->id, DutyStatus::DRIVING, $barrier);
    $second = hosStartWorker('transition', $operator->id, DutyStatus::STANDBY, $barrier);
    hosWaitForReady($barrier, 2);
    touch($barrier.'.go');

    $results = [hosFinishWorker($first), hosFinishWorker($second)];
    hosAssertSuccessfulWorkers($results);

    $activeShifts = OperatorShift::query()
        ->where('user_id', $operator->id)
        ->whereIn('status', [ShiftStatus::ACTIVE, ShiftStatus::ON_BREAK])
        ->get();
    $logs = OperatorDutyLog::query()
        ->where('operator_shift_id', $shift->id)
        ->orderBy('started_at')
        ->get();
    $activeLogs = $logs->whereNull('ended_at');

    expect($activeShifts)->toHaveCount(1)
        ->and($activeShifts->first()->id)->toBe($shift->id)
        ->and($logs)->toHaveCount(3)
        ->and($activeLogs)->toHaveCount(1)
        ->and($logs->whereNotNull('ended_at'))->toHaveCount(2)
        ->and($activeLogs->first()->duty_status)->toBeIn([DutyStatus::DRIVING, DutyStatus::STANDBY])
        ->and(OperatorDutyLog::query()->where('user_id', $operator->id)->whereNull('ended_at')->count())->toBe(1);
});
