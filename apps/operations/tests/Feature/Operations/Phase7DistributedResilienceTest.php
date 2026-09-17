<?php

namespace Tests\Feature\Operations;

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Jobs\GenerateGptRecommendationJob;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Models\GptRecommendationMetric;
use App\Platform\Gpt\Services\GptRecommendationTransition;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use App\Platform\Gpt\Services\RecordGptOperationalMetric;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Actions\CreateReportExportAction;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Exports\ReportExportCatalog;
use App\Platform\Reporting\Jobs\GenerateReportExportJob;
use App\Platform\Reporting\Models\ReportExport;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Exceptions\TrackingConflictException;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Platform\Tracking\Services\HttpTrackingClient;
use App\Platform\Workspace\Events\WorkspaceUpdated;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Closure;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use InvalidArgumentException;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

uses(RefreshDatabase::class);

class Phase7ResilienceOperationalJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public static bool $executed = false;

    public function __construct()
    {
        $this->queue = 'default';
        $this->onQueue('default');
    }

    public function handle(): void
    {
        self::$executed = true;
    }
}

/**
 * Subclass of GenerateReportExportJob designed for failure-injection testing
 * without modifying or mocking production final classes.
 */
class FailingReportExportJob extends GenerateReportExportJob
{
    public function __construct(
        string $exportId,
        public readonly bool $seedPartialFile = false,
    ) {
        parent::__construct($exportId);
    }

    /**
     * @param  list<string>  $headers
     * @param  iterable<list<string|int|float|null>>  $rows
     */
    protected function writeCsv(string $temporaryPath, array $headers, iterable $rows): int
    {
        if ($this->seedPartialFile) {
            Storage::disk($this->targetDisk())->put($temporaryPath, 'partial,corrupt,data');
        }

        throw new RuntimeException('Simulated disk/storage failure during CSV dataset compilation');
    }
}

/**
 * Local HMAC-SHA256 signature verification helper for inter-service resilience testing.
 * Replaces direct instantiation of Tracking microservice's internal ValidateServiceSignature middleware,
 * decoupling Operations tests from Tracking's namespace while validating identical HMAC invariants.
 */
class Phase7ServiceSignatureValidator
{
    /**
     * Maximum allowed clock drift tolerance in seconds (5 minutes).
     */
    public const int TOLERANCE_WINDOW_SECONDS = 300;

    /**
     * Handle an incoming request and validate HMAC-SHA256 service signature.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $serviceName = $request->header('X-Service-Name');
        /** @var list<string> $allowedServices */
        $allowedServices = config('services.tracking.allowed_services', ['operations']);

        if (empty($serviceName)) {
            return new JsonResponse([
                'message' => 'Missing X-Service-Name header.',
                'error' => 'unauthorized',
            ], 401);
        }

        if (! in_array($serviceName, $allowedServices, true)) {
            return new JsonResponse([
                'message' => 'Unauthorized service caller.',
                'error' => 'forbidden',
            ], 403);
        }

        $timestampHeader = $request->header('X-Timestamp');
        if ($timestampHeader === null || ! is_numeric($timestampHeader)) {
            return new JsonResponse([
                'message' => 'Missing or invalid X-Timestamp header.',
                'error' => 'unauthorized',
            ], 401);
        }

        $timestamp = (int) $timestampHeader;
        $now = time();
        if (abs($now - $timestamp) > self::TOLERANCE_WINDOW_SECONDS) {
            return new JsonResponse([
                'message' => 'Request timestamp expired or outside 5-minute tolerance window.',
                'error' => 'unauthorized',
            ], 401);
        }

        $payloadDigest = $request->header('X-Payload-Digest');
        if ($payloadDigest === null || $payloadDigest === '') {
            return new JsonResponse([
                'message' => 'Missing X-Payload-Digest header.',
                'error' => 'unauthorized',
            ], 401);
        }

        $rawBody = (string) $request->getContent();
        $expectedDigest = hash('sha256', $rawBody);

        $isGetOrHead = in_array(strtoupper($request->getMethod()), ['GET', 'HEAD'], true);
        $emptyDigest = hash('sha256', '');

        $digestMatches = hash_equals($expectedDigest, $payloadDigest)
            || ($isGetOrHead && hash_equals($emptyDigest, $payloadDigest));

        if (! $digestMatches) {
            return new JsonResponse([
                'message' => 'Payload digest mismatch.',
                'error' => 'unauthorized',
            ], 401);
        }

        $signature = $request->header('X-Signature');
        if ($signature === null || $signature === '') {
            return new JsonResponse([
                'message' => 'Missing X-Signature header.',
                'error' => 'unauthorized',
            ], 401);
        }

        $secret = (string) config('services.tracking.secret', '');
        if ($secret === '') {
            return new JsonResponse([
                'message' => 'Tracking service secret is not configured.',
                'error' => 'server_error',
            ], 500);
        }

        $method = strtoupper($request->getMethod());
        $rawPath = (string) parse_url($request->getRequestUri(), PHP_URL_PATH);
        $canonicalPath = '/'.trim($rawPath, '/');
        $pathWithoutSlash = trim($rawPath, '/');
        $rawUri = (string) $request->getRequestUri();

        $expectedSigWithSlash = hash_hmac('sha256', $method."\n".$canonicalPath."\n".$timestamp."\n".$payloadDigest, $secret);
        $expectedSigWithoutSlash = hash_hmac('sha256', $method."\n".$pathWithoutSlash."\n".$timestamp."\n".$payloadDigest, $secret);
        $expectedSigRawUri = hash_hmac('sha256', $method."\n".$rawUri."\n".$timestamp."\n".$payloadDigest, $secret);

        $strippedApiPath = '/'.ltrim((string) (preg_replace('#^/api/#', '/', $canonicalPath) ?? $canonicalPath), '/');
        $expectedSigStrippedApi = hash_hmac('sha256', $method."\n".$strippedApiPath."\n".$timestamp."\n".$payloadDigest, $secret);

        if (
            ! hash_equals($expectedSigWithSlash, $signature)
            && ! hash_equals($expectedSigWithoutSlash, $signature)
            && ! hash_equals($expectedSigRawUri, $signature)
            && ! hash_equals($expectedSigStrippedApi, $signature)
        ) {
            return new JsonResponse([
                'message' => 'Invalid HMAC-SHA256 request signature.',
                'error' => 'unauthorized',
            ], 401);
        }

        return $next($request);
    }
}

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    OpenAiClientWrapper::fake();
    config([
        'filesystems.protected_disk' => 'private',
        'services.tracking.secret' => 'test-tracking-service-secret',
    ]);
    Storage::fake('private');
    Storage::fake('r2-private');
    Phase7ResilienceOperationalJob::$executed = false;
});

afterEach(function (): void {
    OpenAiClientWrapper::resetFakes();
});

/*
|--------------------------------------------------------------------------
| 1. Tracking Service Outage & Network Partition Resilience
|--------------------------------------------------------------------------
*/

it('handles Tracking microservice HTTP 500 error by logging structured warning and falling back to DatabaseTrackingClient', function (): void {
    Log::spy();

    $client = new HttpTrackingClient(baseUrl: 'http://localhost:8001', allowIngestFallback: true);

    $user = User::factory()->create(['name' => 'Operator Outage User']);
    $user->syncRoles([RoleName::CraneOperator->value]);

    Http::fake([
        'http://localhost:8001/internal/v1/locations' => Http::response(['error' => 'Internal Server Error'], 500),
    ]);

    $sample = LocationSampleDto::fromArray([
        'user_id' => $user->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now()->toIso8601String(),
    ]);

    $result = $client->ingestLocation($sample);

    expect($result)->toBeInstanceOf(LatestLocationDto::class)
        ->and($result->userId)->toBe($user->id)
        ->and(LocationUpdate::query()->where('user_id', $user->id)->count())->toBe(1);

    Log::shouldHaveReceived('warning')
        ->withArgs(function (string $message, array $context): bool {
            return $message === 'Tracking microservice returned error on ingestLocation'
                && ($context['status'] ?? null) === 500;
        })
        ->once();
});

it('handles Tracking microservice HTTP 503 Service Unavailable by logging structured warning and falling back to local database', function (): void {
    Log::spy();

    $client = new HttpTrackingClient(baseUrl: 'http://localhost:8001');

    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = User::factory()->create(['name' => 'Field Driver']);
    $driver->syncRoles([RoleName::CraneOperator->value]);

    LocationUpdate::query()->create([
        'user_id' => $driver->id,
        'latitude' => 14.5800,
        'longitude' => 121.0600,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinute(),
        'received_at' => now()->subMinute(),
    ]);

    Http::fake([
        'http://localhost:8001/internal/v1/locations/latest*' => Http::response(['message' => 'Service Unavailable'], 503),
    ]);

    $latestLocations = $client->getLatestLocations($dispatcher);

    expect($latestLocations)->toHaveCount(1)
        ->and($latestLocations->first()->userId)->toBe($driver->id)
        ->and($latestLocations->first()->latitude)->toBe(14.58);

    Log::shouldHaveReceived('warning')
        ->withArgs(function (string $message, array $context): bool {
            return $message === 'Tracking microservice returned error on getLatestLocations'
                && ($context['status'] ?? null) === 503;
        })
        ->once();
});

it('handles Tracking microservice HTTP 500 and 503 errors on getLatestLocationForUser, getLatestLocationForAsset, and queryLocationHistory with structured warning logs', function (): void {
    Log::spy();

    $client = new HttpTrackingClient(baseUrl: 'http://localhost:8001');

    $driver = User::factory()->create(['name' => 'Query Driver']);
    $driver->syncRoles([RoleName::CraneOperator->value]);

    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-QUERY-01',
        'name' => 'Tadano Query 550',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    LocationUpdate::query()->create([
        'user_id' => $driver->id,
        'operational_asset_id' => $crane->id,
        'latitude' => 14.5500,
        'longitude' => 121.0500,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(5),
        'received_at' => now()->subMinutes(5),
    ]);

    Http::fake([
        'http://localhost:8001/internal/v1/locations/latest?user_id=*' => Http::response(['error' => 'Internal Server Error'], 500),
        'http://localhost:8001/internal/v1/locations/latest?operational_asset_id=*' => Http::response(['message' => 'Service Unavailable'], 503),
        'http://localhost:8001/internal/v1/locations?*' => Http::response(['error' => 'Bad Gateway'], 502),
    ]);

    $forUser = $client->getLatestLocationForUser($driver->id);
    expect($forUser)->not->toBeNull()
        ->and($forUser->userId)->toBe($driver->id);

    $forAsset = $client->getLatestLocationForAsset($crane->id);
    expect($forAsset)->not->toBeNull()
        ->and($forAsset->operationalAssetId)->toBe($crane->id);

    $history = $client->queryLocationHistory(['user_id' => $driver->id]);
    expect($history)->not->toBeNull();

    Log::shouldHaveReceived('warning')
        ->withArgs(function (string $message, array $context) use ($driver): bool {
            return $message === 'Tracking microservice returned error on getLatestLocationForUser'
                && ($context['status'] ?? null) === 500
                && ($context['user_id'] ?? null) === $driver->id;
        })
        ->once();

    Log::shouldHaveReceived('warning')
        ->withArgs(function (string $message, array $context) use ($crane): bool {
            return $message === 'Tracking microservice returned error on getLatestLocationForAsset'
                && ($context['status'] ?? null) === 503
                && ($context['asset_id'] ?? null) === $crane->id;
        })
        ->once();

    Log::shouldHaveReceived('warning')
        ->withArgs(function (string $message, array $context): bool {
            return $message === 'Tracking microservice returned error on queryLocationHistory'
                && ($context['status'] ?? null) === 502;
        })
        ->once();
});

it('handles Tracking microservice network partition and timeout (> 3.0s connect / 5.0s read) by logging structured warning and falling back to database', function (): void {
    Log::spy();

    $client = new HttpTrackingClient(
        baseUrl: 'http://localhost:8001',
        timeout: 5.0,
        connectTimeout: 3.0,
        allowIngestFallback: true,
    );

    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = User::factory()->create(['name' => 'Partition Driver']);
    $driver->syncRoles([RoleName::CraneOperator->value]);

    LocationUpdate::query()->create([
        'user_id' => $driver->id,
        'latitude' => 14.6100,
        'longitude' => 120.9900,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinute(),
        'received_at' => now()->subMinute(),
    ]);

    // Simulate connection timeout (> 3.0s connect)
    Http::fake([
        'http://localhost:8001/*' => function () {
            throw new ConnectionException('cURL error 28: Connection timed out after 3001 milliseconds');
        },
    ]);

    $locations = $client->getLatestLocations($dispatcher);

    expect($locations)->toHaveCount(1)
        ->and($locations->first()->userId)->toBe($driver->id);

    Log::shouldHaveReceived('warning')
        ->withArgs(function (string $message, array $context): bool {
            return $message === 'Tracking microservice unavailable during getLatestLocations, falling back to local database'
                && str_contains((string) ($context['error'] ?? ''), 'Connection timed out');
        })
        ->once();

    // Also verify location ingestion falls back cleanly under timeout
    $sample = LocationSampleDto::fromArray([
        'user_id' => $driver->id,
        'latitude' => 14.6200,
        'longitude' => 120.9950,
        'sharing_enabled' => true,
        'captured_at' => now()->toIso8601String(),
    ]);

    $ingested = $client->ingestLocation($sample);

    expect($ingested)->toBeInstanceOf(LatestLocationDto::class)
        ->and($ingested->userId)->toBe($driver->id);

    Log::shouldHaveReceived('warning')
        ->withArgs(function (string $message, array $context) use ($driver): bool {
            return $message === 'Tracking microservice unavailable during ingestLocation, falling back to local database'
                && ($context['user_id'] ?? null) === $driver->id;
        })
        ->once();
});

it('ensures Operations dispatch live map continues to load gracefully without 500 exceptions during complete Tracking service outage', function (): void {
    $dispatcher = User::factory()->create(['name' => 'Dispatch Lead']);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = User::factory()->create(['name' => 'Live Map Driver']);
    $driver->syncRoles([RoleName::CraneOperator->value]);

    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-RESILIENCE-01',
        'name' => 'Tadano GT-550E',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
        'location' => 'Port of Manila',
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-RESILIENCE-001',
        'client' => 'Resilience Client',
        'title' => 'Emergency Cargo Transfer',
        'site' => 'Harbor Pier 3',
        'status' => DispatchStatus::Dispatched,
        'priority' => DispatchPriority::Priority,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(6),
        'created_by' => $dispatcher->id,
        'version' => 1,
    ]);

    LocationUpdate::query()->create([
        'user_id' => $driver->id,
        'operational_asset_id' => $crane->id,
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5900,
        'longitude' => 120.9700,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(2),
        'received_at' => now()->subMinutes(2),
    ]);

    // 1. Simulate complete Tracking microservice outage (HTTP 503)
    Http::fake([
        'http://localhost:8001/*' => Http::response(['message' => 'Tracking Microservice Outage'], 503),
    ]);

    // Bind HttpTrackingClient as TrackingClientInterface to exercise the real fallback pipeline
    app()->singleton(TrackingClientInterface::class, fn () => new HttpTrackingClient(baseUrl: 'http://localhost:8001'));

    // Request the workspace overview view which resolves locations for the overview map
    $responseOverview = $this->actingAs($dispatcher)->get('/?view=overview');

    $responseOverview->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('locations', 1)
                ->where('locations.0.user.id', $driver->id)
                ->where('locations.0.user.name', 'Live Map Driver')
                ->where('locations.0.asset.id', $crane->id)
                ->where('locations.0.asset.code', 'CRN-RESILIENCE-01')
                ->where('locations.0.job.id', $job->id)
                ->where('locations.0.job.reference', 'DISP-RESILIENCE-001')
                ->where('locations.0.latitude', 14.59)
                ->where('locations.0.longitude', 120.97)
            )
        );

    // Also test /operations directly which resolves the workspace overview live map
    $responseOperations = $this->actingAs($dispatcher)->get('/operations');

    $responseOperations->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('locations', 1)
                ->where('locations.0.user.id', $driver->id)
                ->where('locations.0.asset.id', $crane->id)
            )
        );

    // Also test /operations?view=assets which also loads locations via fetchLocations
    $responseAssets = $this->actingAs($dispatcher)->get('/operations?view=assets');

    $responseAssets->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('initial_section', 'assets')
            ->loadDeferredProps('workspace-assets', fn (Assert $section) => $section
                ->has('locations', 1)
                ->where('locations.0.user.id', $driver->id)
                ->where('locations.0.asset.id', $crane->id)
            )
        );

    // 2. Simulate network partition and timeout (> 3.0s connect / 5.0s read) during live map access
    Http::fake([
        'http://localhost:8001/*' => function () {
            throw new ConnectionException('cURL error 28: Connection timed out after 3001 milliseconds');
        },
    ]);

    $responseTimeout = $this->actingAs($dispatcher)->get('/operations');

    $responseTimeout->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('locations', 1)
                ->where('locations.0.user.id', $driver->id)
            )
        );
});

/*
|--------------------------------------------------------------------------
| 2. External AI (OpenRouter) Outage Resilience
|--------------------------------------------------------------------------
*/

it('fails cleanly on OpenRouter connection timeout during GenerateGptRecommendationJob and records failure metrics', function (): void {
    OpenAiClientWrapper::resetFakes();
    config([
        'services.openai.key' => 'test-key',
        'services.openai.fake' => false,
    ]);

    // Simulate network timeout to OpenRouter API
    Http::fake([
        'https://openrouter.ai/api/v1/chat/completions' => function () {
            throw new ConnectionException('cURL error 28: Operation timed out after 30000 milliseconds');
        },
    ]);

    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-AI-FAIL-01',
        'client' => 'AI Client',
        'title' => 'Timeout Test Job',
        'site' => 'Site A',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'created_by' => $dispatcher->id,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(4),
        'version' => 1,
    ]);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'hash-resilience-timeout',
        'input_references' => ['user_ids' => [], 'asset_ids' => []],
        'recommendation' => [],
        'model' => 'gpt-5-mini',
        'status' => 'draft',
    ]);

    $jobHandler = new GenerateGptRecommendationJob($recommendation->id, ['job' => ['id' => $job->id]]);
    $jobHandler->handle(
        openAi: app(OpenAiClientWrapper::class),
        audit: app(RecordAuditEvent::class),
        transitions: app(GptRecommendationTransition::class),
        metrics: app(RecordGptOperationalMetric::class),
    );

    $recommendation->refresh();
    expect($recommendation->status)->toBe(GptRecommendationStatus::Failed)
        ->and($recommendation->error_message)->toBe('GPT generation timed out. Please retry.');

    // Assert failure metric recorded in gpt_recommendation_metrics
    $metric = GptRecommendationMetric::query()
        ->where('recommendation_id', $recommendation->id)
        ->where('event', 'failed')
        ->first();

    expect($metric)->not->toBeNull()
        ->and($metric->status)->toBe('failed');
});

it('fails cleanly on OpenRouter rate-limit (HTTP 429) during GenerateGptRecommendationJob and records failure metrics', function (): void {
    OpenAiClientWrapper::resetFakes();
    config([
        'services.openai.key' => 'test-key',
        'services.openai.fake' => false,
    ]);

    // Simulate HTTP 429 Too Many Requests from OpenRouter
    Http::fake([
        'https://openrouter.ai/api/v1/chat/completions' => Http::response([
            'error' => [
                'message' => 'Rate limit exceeded: 200 requests per minute quota reached.',
                'code' => 429,
            ],
        ], 429),
    ]);

    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-AI-429-01',
        'client' => 'AI Client',
        'title' => 'Rate Limit Test Job',
        'site' => 'Site B',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'created_by' => $dispatcher->id,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(4),
        'version' => 1,
    ]);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'hash-resilience-429',
        'input_references' => ['user_ids' => [], 'asset_ids' => []],
        'recommendation' => [],
        'model' => 'gpt-5-mini',
        'status' => 'draft',
    ]);

    $jobHandler = new GenerateGptRecommendationJob($recommendation->id, ['job' => ['id' => $job->id]]);
    $jobHandler->handle(
        openAi: app(OpenAiClientWrapper::class),
        audit: app(RecordAuditEvent::class),
        transitions: app(GptRecommendationTransition::class),
        metrics: app(RecordGptOperationalMetric::class),
    );

    $recommendation->refresh();
    expect($recommendation->status)->toBe(GptRecommendationStatus::Failed)
        ->and($recommendation->error_message)->toBe('GPT generation failed. Please retry.');

    $metric = GptRecommendationMetric::query()
        ->where('recommendation_id', $recommendation->id)
        ->where('event', 'failed')
        ->first();

    expect($metric)->not->toBeNull()
        ->and($metric->status)->toBe('failed');
});

it('fails cleanly on OpenRouter external API connection failure or server error (HTTP 502/503) during GenerateGptRecommendationJob and records failure metrics', function (): void {
    OpenAiClientWrapper::resetFakes();
    config([
        'services.openai.key' => 'test-key',
        'services.openai.fake' => false,
    ]);

    // Simulate HTTP 502 Bad Gateway from OpenRouter
    Http::fake([
        'https://openrouter.ai/api/v1/chat/completions' => Http::response([
            'error' => [
                'message' => 'Provider bad gateway or connection failed.',
                'code' => 502,
            ],
        ], 502),
    ]);

    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-AI-502-01',
        'client' => 'AI Client',
        'title' => 'Server Error Test Job',
        'site' => 'Site 502',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'created_by' => $dispatcher->id,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(4),
        'version' => 1,
    ]);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'hash-resilience-502',
        'input_references' => ['user_ids' => [], 'asset_ids' => []],
        'recommendation' => [],
        'model' => 'gpt-5-mini',
        'status' => 'draft',
    ]);

    $jobHandler = new GenerateGptRecommendationJob($recommendation->id, ['job' => ['id' => $job->id]]);
    $jobHandler->handle(
        openAi: app(OpenAiClientWrapper::class),
        audit: app(RecordAuditEvent::class),
        transitions: app(GptRecommendationTransition::class),
        metrics: app(RecordGptOperationalMetric::class),
    );

    $recommendation->refresh();
    expect($recommendation->status)->toBe(GptRecommendationStatus::Failed)
        ->and($recommendation->error_message)->toBe('GPT generation failed. Please retry.');

    $metric = GptRecommendationMetric::query()
        ->where('recommendation_id', $recommendation->id)
        ->where('event', 'failed')
        ->first();

    expect($metric)->not->toBeNull()
        ->and($metric->status)->toBe('failed');
});

it('ensures failed AI job does not block subsequent AI queue jobs and never starves the default dispatch queue', function (): void {
    config(['queue.default' => 'database']);

    OpenAiClientWrapper::resetFakes();
    config([
        'services.openai.key' => 'test-key',
        'services.openai.fake' => false,
    ]);

    $callCount = 0;
    Http::fake([
        'https://openrouter.ai/api/v1/chat/completions' => function () use (&$callCount) {
            $callCount++;
            if ($callCount === 1) {
                // First call fails with 429 rate limit
                return Http::response(['error' => 'Rate limit exceeded'], 429);
            }

            // Second call succeeds after backoff/recovery
            return Http::response([
                'choices' => [[
                    'finish_reason' => 'stop',
                    'message' => [
                        'content' => json_encode([
                            'summary' => 'Optimized crane operator allocation',
                            'proposed_personnel' => [],
                            'proposed_assets' => [],
                            'reasons' => ['Optimal fatigue clock compliance'],
                            'assumptions' => [],
                        ], JSON_THROW_ON_ERROR),
                    ],
                ]],
                'usage' => [
                    'prompt_tokens' => 120,
                    'completion_tokens' => 60,
                    'total_tokens' => 180,
                ],
            ], 200);
        },
    ]);

    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-AI-BACKLOG-01',
        'client' => 'AI Backlog Client',
        'title' => 'Backlog Test Job',
        'site' => 'Site C',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'created_by' => $dispatcher->id,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(4),
        'version' => 1,
    ]);

    $rec1 = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'hash-resilience-job1',
        'input_references' => ['user_ids' => [], 'asset_ids' => []],
        'recommendation' => [],
        'model' => 'gpt-5-mini',
        'status' => 'draft',
    ]);

    $rec2 = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'hash-resilience-job2',
        'input_references' => ['user_ids' => [], 'asset_ids' => []],
        'recommendation' => [],
        'model' => 'gpt-5-mini',
        'status' => 'draft',
    ]);

    // Enqueue two AI jobs
    GenerateGptRecommendationJob::dispatch($rec1->id, ['job' => ['id' => $job->id]])->onQueue('ai');
    GenerateGptRecommendationJob::dispatch($rec2->id, ['job' => ['id' => $job->id]])->onQueue('ai');

    // Enqueue an operational dispatch job on default queue
    Phase7ResilienceOperationalJob::$executed = false;
    Phase7ResilienceOperationalJob::dispatch()->onQueue('default');

    expect(DB::table('jobs')->where('queue', 'ai')->count())->toBe(2)
        ->and(DB::table('jobs')->where('queue', 'default')->count())->toBe(1);

    // 1. Starvation immunity proof: operational worker drains default queue unblocked
    Artisan::call('queue:work', [
        '--queue' => 'default,high',
        '--once' => true,
    ]);

    expect(Phase7ResilienceOperationalJob::$executed)->toBeTrue()
        ->and(DB::table('jobs')->where('queue', 'default')->count())->toBe(0)
        ->and(DB::table('jobs')->where('queue', 'ai')->count())->toBe(2);

    // 2. Non-blocking AI queue proof: first job fails cleanly
    Artisan::call('queue:work', [
        '--queue' => 'ai',
        '--once' => true,
    ]);

    expect($rec1->fresh()->status)->toBe(GptRecommendationStatus::Failed)
        ->and(DB::table('jobs')->where('queue', 'ai')->count())->toBe(1);

    // 3. Second AI job executes and completes without being blocked by previous failure
    Artisan::call('queue:work', [
        '--queue' => 'ai',
        '--once' => true,
    ]);

    expect($rec2->fresh()->status)->toBe(GptRecommendationStatus::PendingReview)
        ->and(DB::table('jobs')->where('queue', 'ai')->count())->toBe(0);
});

/*
|--------------------------------------------------------------------------
| 3. Inter-Service Tampering & Replay Defense
|--------------------------------------------------------------------------
*/

it('rejects command replay with a modified payload yielding an explicit HTTP 409 Conflict (TrackingConflictException)', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-REPLAY-409',
        'client' => 'Replay Client',
        'title' => 'Replay Conflict Job',
        'site' => 'Pier 9',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $operator->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $operator->id,
        'assignment_type' => 'driver',
        'assigned_by' => $operator->id,
        'created_at' => now(),
    ]);

    $commandId = (string) Str::uuid();

    // 1. Assert HttpTrackingClient directly throws TrackingConflictException on 409
    $client = new HttpTrackingClient(baseUrl: 'http://localhost:8001');

    Http::fake([
        'http://localhost:8001/internal/v1/locations' => Http::response([
            'message' => 'This command ID was already used for a different command payload.',
            'error' => 'conflict',
        ], 409),
    ]);

    $sample = LocationSampleDto::fromArray([
        'command_id' => $commandId,
        'user_id' => $operator->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
    ]);

    expect(fn () => $client->ingestLocation($sample))
        ->toThrow(TrackingConflictException::class, 'This command ID was already used for a different command payload.');

    // 2. Assert Operations BFF controller propagates HTTP 409 Conflict back to client
    app()->singleton(TrackingClientInterface::class, fn () => new HttpTrackingClient(baseUrl: 'http://localhost:8001'));

    Event::fake([WorkspaceUpdated::class]);

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/locations', [
            'dispatch_job_id' => $job->id,
            'latitude' => 14.6100, // Modified payload with same commandId
            'longitude' => 120.9900,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ]);

    $response->assertStatus(409)
        ->assertJsonPath('error', 'conflict')
        ->assertJsonPath('message', 'This command ID was already used for a different command payload.');

    // Assert that no Reverb broadcast is sent when a conflict occurs
    Event::assertNotDispatched(WorkspaceUpdated::class, function (WorkspaceUpdated $event): bool {
        return $event->resourceType === 'tracking';
    });

    // 3. Assert Operations web controller (/operations/locations) also propagates HTTP 409 Conflict
    $webCommandId = (string) Str::uuid();
    $webResponse = $this->actingAs($operator)
        ->withHeader('Idempotency-Key', $webCommandId)
        ->postJson('/operations/locations', [
            'dispatch_job_id' => $job->id,
            'latitude' => 14.6200,
            'longitude' => 120.9950,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ]);

    $webResponse->assertStatus(409)
        ->assertJsonPath('error', 'conflict')
        ->assertJsonPath('message', 'This command ID was already used for a different command payload.');
});

it('strictly rejects forged HMAC signatures with HTTP 401 Unauthorized', function (): void {
    $middleware = new Phase7ServiceSignatureValidator;
    $rawBody = '{"user_id":101,"latitude":14.5995}';

    // 1. Request with completely forged signature string
    $request = Request::create('/internal/v1/locations', 'POST', [], [], [], [], $rawBody);
    $request->headers->set('X-Service-Name', 'operations');
    $request->headers->set('X-Timestamp', (string) time());
    $request->headers->set('X-Payload-Digest', hash('sha256', $rawBody));
    $request->headers->set('X-Signature', 'forged-invalid-hmac-signature-abcdef123456');

    $response = $middleware->handle($request, fn () => response()->json(['status' => 'ok']));

    expect($response->getStatusCode())->toBe(401)
        ->and(json_decode((string) $response->getContent(), true)['message'])->toBe('Invalid HMAC-SHA256 request signature.');

    // 2. Request signed with an incorrect secret key
    $timestamp = (string) time();
    $digest = hash('sha256', $rawBody);
    $stringToSign = "POST\n/internal/v1/locations\n{$timestamp}\n{$digest}";
    $signatureWithWrongSecret = hash_hmac('sha256', $stringToSign, 'attacker-secret-key');

    $requestWrongSecret = Request::create('/internal/v1/locations', 'POST', [], [], [], [], $rawBody);
    $requestWrongSecret->headers->set('X-Service-Name', 'operations');
    $requestWrongSecret->headers->set('X-Timestamp', $timestamp);
    $requestWrongSecret->headers->set('X-Payload-Digest', $digest);
    $requestWrongSecret->headers->set('X-Signature', $signatureWithWrongSecret);

    $responseWrongSecret = $middleware->handle($requestWrongSecret, fn () => response()->json(['status' => 'ok']));

    expect($responseWrongSecret->getStatusCode())->toBe(401)
        ->and(json_decode((string) $responseWrongSecret->getContent(), true)['error'])->toBe('unauthorized');
});

it('strictly rejects timestamps outside the 300-second window with HTTP 401 Unauthorized', function (): void {
    $middleware = new Phase7ServiceSignatureValidator;
    $rawBody = '{"user_id":101,"latitude":14.5995}';
    $secret = (string) config('services.tracking.secret', 'test-tracking-service-secret');
    $digest = hash('sha256', $rawBody);

    // 1. Expired timestamp (> 300s in the past: 305 seconds ago)
    $expiredTimestamp = (string) (time() - 305);
    $stringToSign = "POST\n/internal/v1/locations\n{$expiredTimestamp}\n{$digest}";
    $validSignatureOnExpired = hash_hmac('sha256', $stringToSign, $secret);

    $expiredRequest = Request::create('/internal/v1/locations', 'POST', [], [], [], [], $rawBody);
    $expiredRequest->headers->set('X-Service-Name', 'operations');
    $expiredRequest->headers->set('X-Timestamp', $expiredTimestamp);
    $expiredRequest->headers->set('X-Payload-Digest', $digest);
    $expiredRequest->headers->set('X-Signature', $validSignatureOnExpired);

    $expiredResponse = $middleware->handle($expiredRequest, fn () => response()->json(['status' => 'ok']));

    expect($expiredResponse->getStatusCode())->toBe(401)
        ->and(json_decode((string) $expiredResponse->getContent(), true)['message'])
        ->toBe('Request timestamp expired or outside 5-minute tolerance window.');

    // 2. Future timestamp (> 300s in the future: 305 seconds ahead)
    $futureTimestamp = (string) (time() + 305);
    $stringToSignFuture = "POST\n/internal/v1/locations\n{$futureTimestamp}\n{$digest}";
    $validSignatureOnFuture = hash_hmac('sha256', $stringToSignFuture, $secret);

    $futureRequest = Request::create('/internal/v1/locations', 'POST', [], [], [], [], $rawBody);
    $futureRequest->headers->set('X-Service-Name', 'operations');
    $futureRequest->headers->set('X-Timestamp', $futureTimestamp);
    $futureRequest->headers->set('X-Payload-Digest', $digest);
    $futureRequest->headers->set('X-Signature', $validSignatureOnFuture);

    $futureResponse = $middleware->handle($futureRequest, fn () => response()->json(['status' => 'ok']));

    expect($futureResponse->getStatusCode())->toBe(401)
        ->and(json_decode((string) $futureResponse->getContent(), true)['message'])
        ->toBe('Request timestamp expired or outside 5-minute tolerance window.');
});

it('strictly rejects tampered payload digest and altered payloads with HTTP 401 Unauthorized', function (): void {
    $middleware = new Phase7ServiceSignatureValidator;
    $originalBody = '{"user_id":101,"latitude":14.5995}';
    $tamperedBody = '{"user_id":999,"latitude":14.5995}';
    $secret = (string) config('services.tracking.secret', 'test-tracking-service-secret');
    $timestamp = (string) time();

    // 1. Tampered payload digest mismatch
    $request = Request::create('/internal/v1/locations', 'POST', [], [], [], [], $originalBody);
    $request->headers->set('X-Service-Name', 'operations');
    $request->headers->set('X-Timestamp', $timestamp);
    $request->headers->set('X-Payload-Digest', hash('sha256', 'altered-unmatched-content'));
    $request->headers->set('X-Signature', 'any-signature');

    $response = $middleware->handle($request, fn () => response()->json(['status' => 'ok']));

    expect($response->getStatusCode())->toBe(401)
        ->and(json_decode((string) $response->getContent(), true)['message'])->toBe('Payload digest mismatch.');

    // 2. Original valid digest and signature sent with altered body
    $originalDigest = hash('sha256', $originalBody);
    $originalSig = hash_hmac('sha256', "POST\n/internal/v1/locations\n{$timestamp}\n{$originalDigest}", $secret);

    $tamperedRequest = Request::create('/internal/v1/locations', 'POST', [], [], [], [], $tamperedBody);
    $tamperedRequest->headers->set('X-Service-Name', 'operations');
    $tamperedRequest->headers->set('X-Timestamp', $timestamp);
    $tamperedRequest->headers->set('X-Payload-Digest', $originalDigest);
    $tamperedRequest->headers->set('X-Signature', $originalSig);

    $tamperedResponse = $middleware->handle($tamperedRequest, fn () => response()->json(['status' => 'ok']));

    expect($tamperedResponse->getStatusCode())->toBe(401)
        ->and(json_decode((string) $tamperedResponse->getContent(), true)['message'])->toBe('Payload digest mismatch.');

    // 3. Completely unsigned request with missing headers
    $unsignedRequest = Request::create('/internal/v1/locations', 'POST', [], [], [], [], $originalBody);
    $unsignedResponse = $middleware->handle($unsignedRequest, fn () => response()->json(['status' => 'ok']));

    expect($unsignedResponse->getStatusCode())->toBe(401)
        ->and(json_decode((string) $unsignedResponse->getContent(), true)['message'])->toBe('Missing X-Service-Name header.');
});

/*
|--------------------------------------------------------------------------
| 4. Export Worker Graceful Failure Resilience
|--------------------------------------------------------------------------
*/

it('records error status in ReportExport on export failure and does not leave database locks hanging', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $export = ReportExport::query()->create([
        'user_id' => $admin->id,
        'export_type' => ReportExportType::SystemAudit,
        'format' => 'csv',
        'status' => ReportExportStatus::Queued,
        'expires_at' => now()->addDay(),
        'download_expires_at' => now()->addDay(),
        'purge_at' => now()->addDays(7),
    ]);

    // Use FailingReportExportJob which throws during writeCsv to simulate unexpected failure
    $job = new FailingReportExportJob($export->id);

    $caughtException = null;
    try {
        $job->handle(
            recordAudit: app(RecordAuditEvent::class),
            catalog: app(ReportExportCatalog::class),
        );
    } catch (Throwable $e) {
        $caughtException = $e;
    }

    // 1. Assert the job re-throws the exception for queue retry/failed_job tracking
    expect($caughtException)->toBeInstanceOf(RuntimeException::class)
        ->and($caughtException->getMessage())->toBe('Simulated disk/storage failure during CSV dataset compilation');

    // 2. Assert ReportExport status transitioned to Failed with error message
    $freshExport = $export->fresh();
    expect($freshExport->status)->toBe(ReportExportStatus::Failed)
        ->and($freshExport->error_message)->toBe('Export generation failed. Please retry or contact support.');

    // 3. Assert database transaction level is at baseline (1 with RefreshDatabase)
    expect(DB::transactionLevel())->toBe(1);

    // 4. Assert database locks are not hanging by re-acquiring pessimistic lock immediately
    $reacquired = DB::transaction(function () use ($export) {
        return ReportExport::query()->lockForUpdate()->find($export->id);
    });

    expect($reacquired)->not->toBeNull()
        ->and($reacquired->status)->toBe(ReportExportStatus::Failed);

    // 5. Assert audit event was recorded for failure tracking
    $auditEvent = AuditEvent::query()
        ->where('action', 'report_export.failed')
        ->where('subject_type', (new ReportExport)->getMorphClass())
        ->where('subject_id', $export->id)
        ->first();

    expect($auditEvent)->not->toBeNull()
        ->and($auditEvent->actor_id)->toBe($admin->id);
});

it('cleans up temporary partially-written export files upon worker failure to prevent storage leaks', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $export = ReportExport::query()->create([
        'user_id' => $admin->id,
        'export_type' => ReportExportType::SystemAudit,
        'format' => 'csv',
        'status' => ReportExportStatus::Queued,
        'expires_at' => now()->addDay(),
        'download_expires_at' => now()->addDay(),
        'purge_at' => now()->addDays(7),
    ]);

    $filename = $export->export_type->filenamePrefix().'-'.$export->id.'.csv';
    $temporaryPath = 'exports/.'.$filename.'.part';

    // Use FailingReportExportJob with seedPartialFile = true to simulate partial file write before crash
    $job = new FailingReportExportJob($export->id, seedPartialFile: true);

    try {
        $job->handle(
            recordAudit: app(RecordAuditEvent::class),
            catalog: app(ReportExportCatalog::class),
        );
    } catch (Throwable) {
        // Expected re-throw
    }

    // Assert that the partial file was purged during failure compensation
    expect(Storage::disk('private')->exists($temporaryPath))->toBeFalse()
        ->and($export->fresh()->status)->toBe(ReportExportStatus::Failed);
});

it('gracefully fails and sets error status when an unsupported export format is processed', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $export = ReportExport::query()->create([
        'user_id' => $admin->id,
        'export_type' => ReportExportType::SystemAudit,
        'format' => 'unsupported_format',
        'status' => ReportExportStatus::Queued,
        'expires_at' => now()->addDay(),
        'download_expires_at' => now()->addDay(),
        'purge_at' => now()->addDays(7),
    ]);

    $job = new GenerateReportExportJob($export->id);

    $caught = null;
    try {
        $job->handle(app(RecordAuditEvent::class), app(ReportExportCatalog::class));
    } catch (Throwable $e) {
        $caught = $e;
    }

    expect($caught)->toBeInstanceOf(InvalidArgumentException::class)
        ->and($export->fresh()->status)->toBe(ReportExportStatus::Failed)
        ->and($export->fresh()->error_message)->toBe('Export generation failed. Please retry or contact support.');
});

it('ensures failing export job on reports queue releases locks and does not block subsequent report export jobs', function (): void {
    config(['queue.default' => 'database']);

    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    // 1. Create a failing export record and a valid export record
    $failingExport = ReportExport::query()->create([
        'user_id' => $admin->id,
        'export_type' => ReportExportType::SystemAudit,
        'format' => 'unsupported_format_for_queue',
        'status' => ReportExportStatus::Queued,
        'expires_at' => now()->addDay(),
        'download_expires_at' => now()->addDay(),
        'purge_at' => now()->addDays(7),
    ]);

    // Dispatch failing job to reports queue
    GenerateReportExportJob::dispatch($failingExport->id)->onQueue('reports');

    // Create and dispatch valid export to reports queue
    $createAction = app(CreateReportExportAction::class);
    $validExport = $createAction->execute($admin, ReportExportType::SystemAudit, 'csv', []);

    expect(DB::table('jobs')->where('queue', 'reports')->count())->toBe(2);

    // 2. Run the reports worker for the first job (fails cleanly without hanging locks)
    try {
        Artisan::call('queue:work', [
            '--queue' => 'reports',
            '--once' => true,
        ]);
    } catch (Throwable) {
        // Expected exception
    }

    expect($failingExport->fresh()->status)->toBe(ReportExportStatus::Failed)
        ->and(DB::transactionLevel())->toBe(1);

    // 3. Run the reports worker for the second job (proves worker processes subsequent export)
    Artisan::call('queue:work', [
        '--queue' => 'reports',
        '--once' => true,
    ]);

    expect($validExport->fresh()->status)->toBe(ReportExportStatus::Completed)
        ->and(DB::transactionLevel())->toBe(1);
});
