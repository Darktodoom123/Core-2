<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Services\DispatchV2MetricsService;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('runs dispatch:v2:status command and outputs JSON telemetry metrics', function (): void {
    $actor = User::factory()->create();
    $client = Client::query()->create([
        'code' => 'CLI-P6-METRICS',
        'company_name' => 'Metrics Test Client',
        'status' => 'active',
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'P6-JOB-STATUS-01',
        'client' => $client->company_name,
        'title' => 'Rollout status check',
        'site' => 'Zone 4',
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(2),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $actor->id,
    ]);

    $handoff = DispatchHandoff::query()->create([
        'workspace_key' => 'operations',
        'source_type' => 'legacy_dispatch_job',
        'source_id' => $job->id,
        'source_reference' => $job->reference,
        'legacy_dispatch_job_id' => $job->id,
        'created_by' => $actor->id,
        'compatibility_state' => 'v2_command',
    ]);

    $attempt = DispatchExecutionAttempt::query()->create([
        'handoff_id' => $handoff->id,
        'workspace_key' => 'operations',
        'attempt_number' => 1,
        'legacy_dispatch_job_id' => $job->id,
        'status' => 'draft',
        'version' => 1,
        'created_by' => $actor->id,
    ]);

    Artisan::call('dispatch:v2:status', [
        '--workspace' => 'operations',
        '--json' => true,
    ]);

    $output = Artisan::output();
    $data = json_decode($output, true);

    expect($data)->toBeArray()
        ->and($data['workspace_key'])->toBe('operations')
        ->and($data['cohort_active'])->toBeTrue()
        ->and($data['v2_commands_enabled'])->toBeTrue()
        ->and($data['jobs']['total'])->toBe(1)
        ->and($data['jobs']['handoffs'])->toBe(1);
});

it('gathers comprehensive metrics via DispatchV2MetricsService', function (): void {
    $metricsService = app(DispatchV2MetricsService::class);
    $snapshot = $metricsService->snapshot('operations');

    expect($snapshot)->toHaveKeys(['workspace_key', 'cohort_active', 'v2_commands_enabled', 'telemetry_enabled', 'sunset_date', 'jobs', 'planning', 'outbox', 'reconciliation'])
        ->and($snapshot['cohort_active'])->toBeTrue()
        ->and($snapshot['sunset_date'])->toBe('2027-02-14');
});

it('reconciles legacy jobs and creates canonical handoffs via dispatch:reconcile command', function (): void {
    $actor = User::factory()->create();
    $client = Client::query()->create([
        'code' => 'CLI-P6-RECONCILE',
        'company_name' => 'Reconciliation Test Client',
        'status' => 'active',
    ]);

    $legacyJob = DispatchJob::query()->create([
        'reference' => 'P6-LEGACY-JOB-01',
        'client' => $client->company_name,
        'title' => 'Legacy Job To Reconcile',
        'site' => 'Zone 8',
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(2),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $actor->id,
    ]);

    expect(DispatchHandoff::query()->where('legacy_dispatch_job_id', $legacyJob->id)->exists())->toBeFalse();

    $this->artisan('dispatch:reconcile', ['--limit' => 10])
        ->assertSuccessful();

    expect(DispatchHandoff::query()->where('legacy_dispatch_job_id', $legacyJob->id)->exists())->toBeTrue();
    $handoff = DispatchHandoff::query()->where('legacy_dispatch_job_id', $legacyJob->id)->firstOrFail();
    expect($handoff->attempts()->exists())->toBeTrue();
});

it('respects dry run mode in reconciliation without persisting canonical rows', function (): void {
    $actor = User::factory()->create();
    $client = Client::query()->create([
        'code' => 'CLI-P6-DRYRUN',
        'company_name' => 'Dry Run Test Client',
        'status' => 'active',
    ]);

    $legacyJob = DispatchJob::query()->create([
        'reference' => 'P6-DRYRUN-JOB-01',
        'client' => $client->company_name,
        'title' => 'Dry Run Job',
        'site' => 'Zone 9',
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(2),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $actor->id,
    ]);

    $this->artisan('dispatch:reconcile', ['--limit' => 10, '--dry-run' => true])
        ->assertSuccessful();

    expect(DispatchHandoff::query()->where('legacy_dispatch_job_id', $legacyJob->id)->exists())->toBeFalse();
});

it('demonstrates rollback safeguard when v2_commands_enabled is disabled', function (): void {
    config(['dispatch.v2_commands_enabled' => false]);
    $metricsService = app(DispatchV2MetricsService::class);
    $snapshot = $metricsService->snapshot('operations');

    expect($snapshot['v2_commands_enabled'])->toBeFalse();
});
