<?php

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Models\UnitLink;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

// Truncation, not rollback: the workers need committed rows, and old
// migrations cannot roll back past the removed sales tables.
uses(DatabaseTruncation::class);

beforeEach(function (): void {
    if (DB::connection()->getDriverName() !== 'pgsql') {
        throw new RuntimeException('Unit link concurrency tests require PostgreSQL row locking; run with phpunit.concurrency.xml.');
    }
});

afterEach(function (): void {
    foreach (glob(sys_get_temp_dir().DIRECTORY_SEPARATOR.'core2-unit-link-*') ?: [] as $path) {
        if (is_file($path)) {
            @unlink($path);
        }
    }
});

function unitLinkRaceCrane(string $code): OperationalAsset
{
    /** @var OperationalAsset */
    return OperationalAsset::query()->create([
        'code' => $code,
        'name' => '50T Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);
}

/** A working job with the cranes assigned and each operator accepted on it. */
function unitLinkRaceJob(array $cranes, User ...$operators): DispatchJob
{
    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-ULR-'.Str::upper(Str::random(5)),
        'client' => 'Acme',
        'title' => 'Tandem lift',
        'site' => 'Pier 4',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Working,
        'version' => 1,
        'created_by' => $operators[0]->id,
    ]);

    foreach ($operators as $operator) {
        DispatchPersonnelAssignment::query()->create([
            'dispatch_job_id' => $job->id,
            'user_id' => $operator->id,
            'assignment_type' => 'crane_operator',
            'assigned_by' => $operator->id,
            'response_status' => AssignmentResponse::Accepted,
        ]);
    }

    foreach ($cranes as $crane) {
        DispatchAssetAssignment::query()->create([
            'dispatch_job_id' => $job->id,
            'operational_asset_id' => $crane->id,
            'assignment_type' => 'crane',
            'assigned_by' => $operators[0]->id,
        ]);
    }

    return $job;
}

/**
 * Starts one phone's link request as a separate PHP process with its own
 * database connection. proc_open works on Linux CI and on Windows.
 *
 * @return array{process: resource, stdout: resource}
 */
function unitLinkRaceStartPhone(User $operator, OperationalAsset $asset, string $barrier): array
{
    $environment = getenv();
    $environment['APP_ENV'] = 'testing';
    $environment['APP_KEY'] = (string) config('app.key');
    $environment['DB_CONNECTION'] = 'pgsql';
    foreach (['host', 'port', 'database', 'username', 'password', 'sslmode'] as $key) {
        $environment['DB_'.strtoupper($key)] = (string) config("database.connections.pgsql.{$key}");
    }
    $environment['CACHE_STORE'] = 'array';
    $environment['QUEUE_CONNECTION'] = 'sync';
    $environment['BROADCAST_CONNECTION'] = 'null';

    $process = proc_open(
        [PHP_BINARY, base_path('tests/Concurrency/Support/unit-link-process.php'), (string) $operator->id, (string) $asset->id, $barrier],
        [1 => ['pipe', 'w'], 2 => ['file', $barrier.'.stderr.'.$operator->id.'.'.$asset->id, 'a']],
        $pipes,
        base_path(),
        $environment,
    );

    if (! is_resource($process)) {
        throw new RuntimeException('Unable to start the unit link worker.');
    }

    return ['process' => $process, 'stdout' => $pipes[1]];
}

/**
 * @param  array{process: resource, stdout: resource}  $phone
 * @return array<string, mixed>
 */
function unitLinkRaceFinish(array $phone): array
{
    $output = (string) stream_get_contents($phone['stdout']);
    fclose($phone['stdout']);
    $exitCode = proc_close($phone['process']);
    $result = json_decode($output, true);

    expect($exitCode)->toBe(0, "Unit link worker failed: {$output}");

    return is_array($result) ? $result : ['ok' => false, 'raw' => $output];
}

/**
 * Lets every phone reach the starting line, then releases them together.
 *
 * @param  list<array{0: User, 1: OperationalAsset}>  $requests
 * @return list<array<string, mixed>>
 */
function unitLinkRace(array $requests): array
{
    $barrier = sys_get_temp_dir().DIRECTORY_SEPARATOR.'core2-unit-link-'.Str::random(12);
    $phones = array_map(
        fn (array $request): array => unitLinkRaceStartPhone($request[0], $request[1], $barrier),
        $requests,
    );

    $deadline = microtime(true) + 30;
    while (count(glob($barrier.'.ready.*') ?: []) < count($phones)) {
        if (microtime(true) > $deadline) {
            throw new RuntimeException('Unit link workers did not reach the barrier.');
        }

        usleep(10_000);
    }

    touch($barrier.'.go');

    return array_map(fn (array $phone): array => unitLinkRaceFinish($phone), $phones);
}

it('lets exactly one of two operators link a unit when both tap at once', function (): void {
    $crane = unitLinkRaceCrane('CRN-RACE-1');
    $first = User::factory()->create(['is_active' => true, 'name' => 'Operator A']);
    $second = User::factory()->create(['is_active' => true, 'name' => 'Operator B']);
    unitLinkRaceJob([$crane], $first, $second);

    $results = unitLinkRace([[$first, $crane], [$second, $crane]]);

    $winners = array_values(array_filter($results, fn (array $result): bool => $result['ok'] === true));
    $losers = array_values(array_filter($results, fn (array $result): bool => $result['ok'] === false));

    expect($winners)->toHaveCount(1)
        ->and($winners[0]['created'])->toBeTrue()
        ->and($losers)->toHaveCount(1)
        ->and($losers[0]['status'])->toBe(409)
        ->and($losers[0]['message'])->toContain('Unit CRN-RACE-1 is actively bound to Operator')
        ->and(UnitLink::query()->open()->where('operational_asset_id', $crane->id)->count())->toBe(1);
});

it('links an operator to one unit when two phones claim different units at once', function (): void {
    $craneOne = unitLinkRaceCrane('CRN-RACE-2');
    $craneTwo = unitLinkRaceCrane('CRN-RACE-3');
    $operator = User::factory()->create(['is_active' => true]);
    unitLinkRaceJob([$craneOne, $craneTwo], $operator);

    $results = unitLinkRace([[$operator, $craneOne], [$operator, $craneTwo]]);

    $winners = array_values(array_filter($results, fn (array $result): bool => $result['ok'] === true));
    $losers = array_values(array_filter($results, fn (array $result): bool => $result['ok'] === false));

    expect($winners)->toHaveCount(1)
        ->and($losers)->toHaveCount(1)
        ->and($losers[0]['status'])->toBe(409)
        ->and($losers[0]['message'])->toStartWith('Release CRN-RACE-')
        ->and(UnitLink::query()->open()->where('user_id', $operator->id)->count())->toBe(1);
});

it('gives one link when the same operator taps link on two phones at once', function (): void {
    $crane = unitLinkRaceCrane('CRN-RACE-4');
    $operator = User::factory()->create(['is_active' => true]);
    unitLinkRaceJob([$crane], $operator);

    $results = unitLinkRace([[$operator, $crane], [$operator, $crane]]);

    expect(array_column($results, 'ok'))->toBe([true, true])
        ->and(array_unique(array_column($results, 'link_id')))->toHaveCount(1)
        ->and(array_values(array_filter(array_column($results, 'created'))))->toHaveCount(1)
        ->and(UnitLink::query()->open()->where('operational_asset_id', $crane->id)->count())->toBe(1);
});

it('refuses a second open link for a unit at the database even without the locks', function (): void {
    $crane = unitLinkRaceCrane('CRN-RACE-5');
    $first = User::factory()->create(['is_active' => true]);
    $second = User::factory()->create(['is_active' => true]);
    UnitLink::query()->create(['operational_asset_id' => $crane->id, 'user_id' => $first->id, 'linked_at' => now()]);

    expect(fn () => UnitLink::query()->create([
        'operational_asset_id' => $crane->id,
        'user_id' => $second->id,
        'linked_at' => now(),
    ]))->toThrow(UniqueConstraintViolationException::class);
});
