<?php

namespace Tests\Feature\Operations;

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Gpt\Actions\GenerateGptRecommendation;
use App\Platform\Gpt\Jobs\GenerateGptRecommendationJob;
use App\Platform\Gpt\Jobs\PruneGptRecommendationsJob;
use App\Platform\Gpt\Jobs\SweepProactiveGptRecommendationsJob;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\Jobs\SendQueuedNotificationJob;
use App\Platform\Reporting\Actions\CreateReportExportAction;
use App\Platform\Reporting\Actions\RetryReportExportAction;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Jobs\GenerateReportExportJob;
use App\Platform\Reporting\Jobs\PruneExpiredExportsJob;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

class DummyTestOperationalJob implements ShouldQueue
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

class DummyTestNotification extends Notification
{
    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return ['message' => 'Operational alert'];
    }
}

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    OpenAiClientWrapper::fake();
    config(['filesystems.protected_disk' => 'private']);
    Storage::fake('private');
    Storage::fake('r2-private');
    DummyTestOperationalJob::$executed = false;
});

afterEach(function (): void {
    OpenAiClientWrapper::resetFakes();
});

test('config queue exposes dedicated channels for default, ai, and reports worker pools', function (): void {
    expect(config('queue.queues.default'))->toBeArray()
        ->and(config('queue.queues.default.name'))->toBe('default')
        ->and(config('queue.queues.default.timeout'))->toBe(60)
        ->and(config('queue.queues.default.tries'))->toBe(3);

    expect(config('queue.queues.ai'))->toBeArray()
        ->and(config('queue.queues.ai.name'))->toBe('ai')
        ->and(config('queue.queues.ai.timeout'))->toBe(120)
        ->and(config('queue.queues.ai.tries'))->toBe(3);

    expect(config('queue.queues.reports'))->toBeArray()
        ->and(config('queue.queues.reports.name'))->toBe('reports')
        ->and(config('queue.queues.reports.timeout'))->toBe(300)
        ->and(config('queue.queues.reports.tries'))->toBe(2);

    expect(config('queue.connections.database-ai.queue'))->toBe('ai')
        ->and(config('queue.connections.database-reports.queue'))->toBe('reports')
        ->and(config('queue.connections.ai.queue'))->toBe('ai')
        ->and(config('queue.connections.reports.queue'))->toBe('reports');
});

test('GenerateGptRecommendationJob explicitly routes strictly to ai queue', function (): void {
    $job = new GenerateGptRecommendationJob(123, ['context' => 'test']);
    expect($job->queue)->toBe('ai')
        ->and($job->timeout)->toBe(120);

    Queue::fake();
    GenerateGptRecommendationJob::dispatch(123, ['context' => 'test']);

    Queue::assertPushedOn('ai', GenerateGptRecommendationJob::class);
    Queue::assertNotPushed(GenerateGptRecommendationJob::class, function ($job) {
        return $job->queue !== 'ai';
    });
});

test('SweepProactiveGptRecommendationsJob and PruneGptRecommendationsJob route strictly to ai queue', function (): void {
    $sweepJob = new SweepProactiveGptRecommendationsJob;
    expect($sweepJob->queue)->toBe('ai');

    $pruneJob = new PruneGptRecommendationsJob;
    expect($pruneJob->queue)->toBe('ai');

    Queue::fake();
    SweepProactiveGptRecommendationsJob::dispatch();
    PruneGptRecommendationsJob::dispatch();

    Queue::assertPushedOn('ai', SweepProactiveGptRecommendationsJob::class);
    Queue::assertPushedOn('ai', PruneGptRecommendationsJob::class);
});

test('GenerateReportExportJob explicitly routes strictly to reports queue', function (): void {
    $job = new GenerateReportExportJob('test-export-uuid');
    expect($job->queue)->toBe('reports')
        ->and($job->timeout)->toBe(300);

    Queue::fake();
    GenerateReportExportJob::dispatch('test-export-uuid');

    Queue::assertPushedOn('reports', GenerateReportExportJob::class);
    Queue::assertNotPushed(GenerateReportExportJob::class, function ($job) {
        return $job->queue !== 'reports';
    });
});

test('PruneExpiredExportsJob routes strictly to reports queue', function (): void {
    $job = new PruneExpiredExportsJob;
    expect($job->queue)->toBe('reports');

    Queue::fake();
    PruneExpiredExportsJob::dispatch();

    Queue::assertPushedOn('reports', PruneExpiredExportsJob::class);
});

test('GenerateGptRecommendation action dispatches GenerateGptRecommendationJob to ai queue', function (): void {
    Queue::fake();

    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([RoleName::OperationsManager->value]);

    $dispatchJob = DispatchJob::query()->create([
        'reference' => 'DISP-AI-001',
        'client' => 'Client AI',
        'title' => 'AI Test Lift',
        'site' => 'Port Terminal',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'created_by' => $user->id,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(4),
        'version' => 1,
    ]);

    $action = app(GenerateGptRecommendation::class);
    $action->handle($user, $dispatchJob);

    Queue::assertPushedOn('ai', GenerateGptRecommendationJob::class);
});

test('CreateReportExportAction and RetryReportExportAction dispatch GenerateReportExportJob to reports queue', function (): void {
    Queue::fake();

    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([RoleName::SystemAdministrator->value]);

    $createAction = app(CreateReportExportAction::class);
    $export = $createAction->execute($user, ReportExportType::SystemAudit, 'csv', []);

    Queue::assertPushedOn('reports', GenerateReportExportJob::class);

    // Test retry action
    $export->update(['status' => ReportExportStatus::Failed]);

    $retryAction = app(RetryReportExportAction::class);
    $retryAction->execute($user, $export);

    Queue::assertPushedOn('reports', GenerateReportExportJob::class);
});

test('operational and notification jobs remain on default queue', function (): void {
    Queue::fake();

    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([RoleName::OperationsManager->value]);

    SendQueuedNotificationJob::dispatch($user, new DummyTestNotification);
    DummyTestOperationalJob::dispatch();

    Queue::assertPushedOn('default', SendQueuedNotificationJob::class);
    Queue::assertPushedOn('default', DummyTestOperationalJob::class);
});

test('starvation immunity: simulated backlog of heavy export and AI jobs does not delay or block operational dispatch queue processing', function (): void {
    config(['queue.default' => 'database']);

    // 1. Seed heavy reports queue backlog
    for ($i = 1; $i <= 5; $i++) {
        GenerateReportExportJob::dispatch("export-backlog-{$i}")->onQueue('reports');
    }

    // 2. Seed heavy AI queue backlog
    for ($i = 1; $i <= 5; $i++) {
        GenerateGptRecommendationJob::dispatch($i, ['payload' => "ai-backlog-{$i}"])->onQueue('ai');
    }

    // Assert backlogs exist in the database jobs table
    expect(DB::table('jobs')->where('queue', 'reports')->count())->toBe(5)
        ->and(DB::table('jobs')->where('queue', 'ai')->count())->toBe(5)
        ->and(DB::table('jobs')->where('queue', 'default')->count())->toBe(0)
        ->and(DB::table('jobs')->count())->toBe(10);

    // 3. Enqueue an operational dispatch job on default queue AFTER the heavy jobs
    DummyTestOperationalJob::$executed = false;
    DummyTestOperationalJob::dispatch()->onQueue('default');

    expect(DB::table('jobs')->where('queue', 'default')->count())->toBe(1)
        ->and(DB::table('jobs')->count())->toBe(11);

    // 4. Run the operational worker listening only to operational channels (default,high)
    Artisan::call('queue:work', [
        '--queue' => 'default,high',
        '--once' => true,
    ]);

    // Starvation immunity proof:
    // The operational worker immediately processed the default job without being delayed
    // or blocked behind the 10 prior heavy export and AI jobs.
    expect(DummyTestOperationalJob::$executed)->toBeTrue()
        ->and(DB::table('jobs')->where('queue', 'default')->count())->toBe(0)
        ->and(DB::table('jobs')->where('queue', 'reports')->count())->toBe(5)
        ->and(DB::table('jobs')->where('queue', 'ai')->count())->toBe(5)
        ->and(DB::table('jobs')->count())->toBe(10);

    // 5. Run the dedicated reporting worker; it only dequeues from the reports queue
    Artisan::call('queue:work', [
        '--queue' => 'reports',
        '--once' => true,
    ]);

    expect(DB::table('jobs')->where('queue', 'reports')->count())->toBe(4)
        ->and(DB::table('jobs')->where('queue', 'ai')->count())->toBe(5)
        ->and(DB::table('jobs')->count())->toBe(9);

    // 6. Run the dedicated AI worker; it only dequeues from the ai queue
    Artisan::call('queue:work', [
        '--queue' => 'ai',
        '--once' => true,
    ]);

    expect(DB::table('jobs')->where('queue', 'reports')->count())->toBe(4)
        ->and(DB::table('jobs')->where('queue', 'ai')->count())->toBe(4)
        ->and(DB::table('jobs')->count())->toBe(8);
});
