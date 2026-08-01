<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Jobs\GenerateGptRecommendationJob;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    OpenAiClientWrapper::fake();
});

afterEach(function (): void {
    OpenAiClientWrapper::resetFakes();
});

test('rate limit prevents user from generating more than 10 recommendations per hour', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-RTL-001',
        'client' => 'Rate Limit Corp',
        'title' => 'Rate limit test',
        'site' => 'Site A',
        'scheduled_start' => now()->addDays(2),
        'scheduled_end' => now()->addDays(2)->addHours(4),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    // Manually push rate limit counter to 10
    $userKey = "gpt_rate_limit:user:{$dispatcher->id}:".now()->format('Y-m-d-H');
    Cache::put($userKey, 10, 3600);

    $response = $this->actingAs($dispatcher)->post('/operations/gpt-recommendations', [
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'purpose' => 'dispatch_assignment',
    ]);

    $response->assertSessionHasErrors(['gpt']);
});

test('handles openai timeout gracefully and sets status failed', function (): void {
    OpenAiClientWrapper::fake([
        'success' => false,
        'error_message' => 'OpenAI API connection timed out.',
        'is_timeout' => true,
    ]);

    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-TMO-001',
        'client' => 'Timeout Test',
        'title' => 'Timeout test job',
        'site' => 'Site B',
        'scheduled_start' => now()->addDays(2),
        'scheduled_end' => now()->addDays(2)->addHours(4),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'hash-tmo',
        'input_references' => ['user_ids' => [], 'asset_ids' => []],
        'recommendation' => [],
        'model' => 'gpt-5-mini',
        'status' => 'draft',
    ]);

    $jobHandler = new GenerateGptRecommendationJob($recommendation->id, ['job' => ['id' => $job->id]]);
    $jobHandler->handle(app(OpenAiClientWrapper::class), app(RecordAuditEvent::class));

    $recommendation->refresh();
    expect($recommendation->status)->toBe('failed')
        ->and($recommendation->error_message)->toContain('timed out');
});

test('handles model refusal gracefully and sets status failed', function (): void {
    OpenAiClientWrapper::fake([
        'success' => false,
        'error_message' => 'Model refused to answer request.',
        'is_refusal' => true,
    ]);

    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-REF-001',
        'client' => 'Refusal Test',
        'title' => 'Refusal test job',
        'site' => 'Site C',
        'scheduled_start' => now()->addDays(2),
        'scheduled_end' => now()->addDays(2)->addHours(4),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'hash-ref',
        'input_references' => ['user_ids' => [], 'asset_ids' => []],
        'recommendation' => [],
        'model' => 'gpt-5-mini',
        'status' => 'draft',
    ]);

    $jobHandler = new GenerateGptRecommendationJob($recommendation->id, ['job' => ['id' => $job->id]]);
    $jobHandler->handle(app(OpenAiClientWrapper::class), app(RecordAuditEvent::class));

    $recommendation->refresh();
    expect($recommendation->status)->toBe('failed')
        ->and($recommendation->error_message)->toContain('refused');
});
