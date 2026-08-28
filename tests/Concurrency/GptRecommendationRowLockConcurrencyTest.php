<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Gpt\Actions\RejectGptRecommendation;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\BoundedContextBuilder;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

uses(DatabaseMigrations::class);

beforeEach(function (): void {
    if (DB::connection()->getDriverName() !== 'pgsql') {
        throw new RuntimeException('R3 concurrency tests require PostgreSQL row locking; run with phpunit.concurrency.xml.');
    }

    if (! function_exists('pcntl_fork') || ! function_exists('pcntl_exec')) {
        throw new RuntimeException('R3 concurrency tests require the POSIX PCNTL extension; run them in the Linux test runner.');
    }

    $this->seed(RolePermissionSeeder::class);
    Cache::flush();
});

function concurrentDispatcher(): User
{
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    return $dispatcher;
}

function concurrentJob(User $dispatcher): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => 'JOB-CON-'.uniqid(),
        'client' => 'Concurrent Test Client',
        'title' => 'Concurrent dispatch decision',
        'site' => 'Controlled test site',
        'scheduled_start' => now()->addDays(2),
        'scheduled_end' => now()->addDays(2)->addHours(4),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);
}

function concurrentRecommendation(User $dispatcher, DispatchJob $job, GptRecommendationStatus $status = GptRecommendationStatus::PendingReview): GptRecommendation
{
    $context = app(BoundedContextBuilder::class)->buildForDispatchJob($job);

    return GptRecommendation::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $context['context_hash'],
        'input_references' => $context['input_references'],
        'recommendation' => [
            'summary' => 'Concurrent decision test',
            'proposed_personnel' => [],
            'proposed_assets' => [],
            'reasons' => [],
            'assumptions' => [],
            'conflicts' => [],
        ],
        'conflicts' => [],
        'model' => 'gpt-5-mini',
        'status' => $status,
        'expires_at' => now()->addMinutes(10),
    ]);
}

/** @return array{pid: int, result_path: string, trace_path: string} */
function startConcurrentGptProcess(string $mode, int $actorId, int $recordId, ?string $barrier = null): array
{
    $script = base_path('tests/Concurrency/Support/gpt-process.php');
    $arguments = [$script, $mode, (string) $actorId, (string) $recordId];
    if ($barrier !== null) {
        $arguments[] = $barrier;
    }

    $resultPath = tempnam(sys_get_temp_dir(), 'core2-gpt-result-');
    if ($resultPath === false) {
        throw new RuntimeException('Unable to allocate concurrent test result output.');
    }
    $tracePath = $resultPath.'.trace';

    $environment = getenv();
    if (! is_array($environment)) {
        $environment = [];
    }
    $environment['APP_ENV'] = 'testing';
    $environment['DB_CONNECTION'] = (string) config('database.default');
    $environment['DB_HOST'] = (string) config('database.connections.pgsql.host');
    $environment['DB_PORT'] = (string) config('database.connections.pgsql.port');
    $environment['DB_DATABASE'] = (string) config('database.connections.pgsql.database');
    $environment['DB_USERNAME'] = (string) config('database.connections.pgsql.username');
    $environment['DB_PASSWORD'] = (string) config('database.connections.pgsql.password');
    $environment['DB_SSLMODE'] = (string) config('database.connections.pgsql.sslmode');
    $environment['CACHE_STORE'] = (string) config('cache.default');
    $environment['QUEUE_CONNECTION'] = (string) config('queue.default');
    if ($barrier !== null) {
        $environment['CORE2_GPT_BARRIER'] = $barrier;
    }
    $environment['CORE2_GPT_RESULT_PATH'] = $resultPath;
    $environment['CORE2_GPT_TRACE_PATH'] = $tracePath;

    $pid = pcntl_fork();
    if ($pid === -1) {
        unlink($resultPath);

        throw new RuntimeException('Unable to fork concurrent GPT test worker.');
    }

    if ($pid === 0) {
        pcntl_exec(PHP_BINARY, $arguments, $environment);

        file_put_contents($resultPath, json_encode([
            'ok' => false,
            'exception' => 'Unable to exec concurrent GPT test worker.',
        ], JSON_THROW_ON_ERROR));
        exit(127);
    }

    return ['pid' => $pid, 'result_path' => $resultPath, 'trace_path' => $tracePath];
}

/** @param array{pid: int, result_path: string, trace_path: string} $process */
function finishConcurrentGptProcess(array $process): array
{
    $status = 0;
    pcntl_waitpid($process['pid'], $status);

    $output = is_file($process['result_path'])
        ? (string) file_get_contents($process['result_path'])
        : '';

    return [
        'exit_code' => pcntl_wifexited($status) ? pcntl_wexitstatus($status) : null,
        'output' => $output,
        'trace' => is_file($process['trace_path']) ? (string) file_get_contents($process['trace_path']) : '',
    ];
}

function waitForBarrier(string $pattern, int $expected): void
{
    // Parallel PHP worker startup is slower on Docker Desktop bind mounts than
    // on the native Linux CI runner; keep the barrier bounded but allow the
    // full worker set to start before asserting concurrency behavior.
    $deadline = microtime(true) + 30;
    while (count(glob($pattern) ?: []) < $expected && microtime(true) < $deadline) {
        usleep(10_000);
    }

    expect(count(glob($pattern) ?: []))->toBe($expected);
}

function newBarrier(): string
{
    $path = tempnam(sys_get_temp_dir(), 'core2-gpt-');
    if ($path === false) {
        throw new RuntimeException('Unable to allocate concurrent test barrier.');
    }
    unlink($path);

    return $path;
}

afterEach(function (): void {
    foreach (glob(sys_get_temp_dir().DIRECTORY_SEPARATOR.'core2-gpt-*') ?: [] as $path) {
        if (is_file($path)) {
            unlink($path);
        }
    }
});

it('serializes concurrent accept and reject requests to exactly one terminal decision', function (): void {
    $dispatcher = concurrentDispatcher();
    $recommendation = concurrentRecommendation($dispatcher, concurrentJob($dispatcher));
    $barrier = newBarrier();

    $accept = startConcurrentGptProcess('accept', $dispatcher->id, $recommendation->id, $barrier);
    $reject = startConcurrentGptProcess('reject', $dispatcher->id, $recommendation->id, $barrier);
    waitForBarrier($barrier.'.ready.*', 2);
    touch($barrier.'.go');

    $results = [finishConcurrentGptProcess($accept), finishConcurrentGptProcess($reject)];
    $recommendation->refresh();

    expect($recommendation->status->isTerminal())->toBeTrue()
        ->and($recommendation->status)->toBeIn([GptRecommendationStatus::Accepted, GptRecommendationStatus::Rejected])
        ->and(collect($results)->where('exit_code', 0))->toHaveCount(1)
        ->and(DB::table('audit_events')->whereIn('action', ['gpt.recommendation_accepted', 'gpt.recommendation_rejected'])->count())->toBe(1);
});

it('fails closed when decision authorization is revoked while a PostgreSQL row lock is held', function (): void {
    $dispatcher = concurrentDispatcher();
    $recommendation = concurrentRecommendation($dispatcher, concurrentJob($dispatcher));

    $connection = DB::connection('pgsql');
    $connection->beginTransaction();
    $released = false;

    try {
        DB::table('gpt_recommendations')->where('id', $recommendation->id)->lockForUpdate()->first();

        $accept = startConcurrentGptProcess('accept', $dispatcher->id, $recommendation->id);
        $deadline = microtime(true) + 10;
        do {
            $waiting = (int) DB::selectOne('select count(*) as count from pg_locks where not granted')->count;
            if ($waiting > 0) {
                break;
            }
            usleep(10_000);
        } while (microtime(true) < $deadline);

        expect($waiting)->toBeGreaterThan(0);
        DB::table('model_has_roles')->where('model_type', $dispatcher->getMorphClass())->where('model_id', $dispatcher->id)->delete();
        $connection->commit();
        $released = true;
    } finally {
        if (! $released && $connection->transactionLevel() > 0) {
            $connection->rollBack();
        }
    }

    $result = finishConcurrentGptProcess($accept);
    $recommendation->refresh();

    expect($result['exit_code'])->not->toBe(0)
        ->and($recommendation->status)->toBe(GptRecommendationStatus::PendingReview)
        ->and(DB::table('audit_events')->where('action', 'gpt.recommendation_accepted')->count())->toBe(0);
});

it('does not allow late queue completion or failure to overwrite a human rejection', function (string $mode): void {
    $dispatcher = concurrentDispatcher();
    $recommendation = concurrentRecommendation($dispatcher, concurrentJob($dispatcher), GptRecommendationStatus::Draft);
    $barrier = newBarrier();

    $worker = startConcurrentGptProcess($mode, $dispatcher->id, $recommendation->id, $barrier);
    waitForBarrier($barrier.'.ready', 1);

    $recommendation->refresh();
    app(RejectGptRecommendation::class)->handle($dispatcher, $recommendation, 'Human decision wins.');
    touch($barrier.'.go');
    $result = finishConcurrentGptProcess($worker);

    $recommendation->refresh();
    expect($result['exit_code'])->toBe(0)
        ->and($recommendation->status)->toBe(GptRecommendationStatus::Rejected)
        ->and($recommendation->decided_by)->toBe($dispatcher->id);
})->with(['completion' => 'complete_after_barrier', 'failure' => 'fail_after_barrier']);

it('keeps user and system GPT rate ceilings atomic under parallel requests', function (): void {
    $dispatcher = concurrentDispatcher();
    $jobs = collect(range(1, 12))->map(fn () => concurrentJob($dispatcher));
    $barrier = newBarrier();
    $processes = $jobs->map(fn (DispatchJob $job) => startConcurrentGptProcess('generate', $dispatcher->id, $job->id, $barrier))->all();
    waitForBarrier($barrier.'.ready.*', 12);
    touch($barrier.'.go');
    $results = array_map(finishConcurrentGptProcess(...), $processes);

    $userKey = 'gpt_rate_limit:user:'.$dispatcher->id.':'.now()->format('Y-m-d-H');
    expect(collect($results)->where('exit_code', 0))->toHaveCount(10)
        ->and(Cache::get($userKey))->toBe(10);

    Cache::flush();
    $systemKey = 'gpt_rate_limit:system:'.now()->format('Y-m-d');
    Cache::put($systemKey, 99, now()->addHour());
    $actors = collect(range(1, 4))->map(fn () => concurrentDispatcher());
    $barrier = newBarrier();
    $processes = $actors->map(fn (User $actor) => startConcurrentGptProcess('generate', $actor->id, concurrentJob($actor)->id, $barrier))->all();
    waitForBarrier($barrier.'.ready.*', 4);
    touch($barrier.'.go');
    $results = array_map(finishConcurrentGptProcess(...), $processes);

    expect(collect($results)->where('exit_code', 0))->toHaveCount(1)
        ->and(Cache::get($systemKey))->toBe(100);
});
