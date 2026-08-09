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
use Illuminate\Support\Facades\Http;

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
    expect($recommendation->status->value)->toBe('failed')
        ->and($recommendation->error_message)->toBe('GPT generation timed out. Please retry.');
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
    expect($recommendation->status->value)->toBe('failed')
        ->and($recommendation->error_message)->toBe('GPT generation failed. Please retry.')
        ->and($recommendation->response_summary)->toBeNull()
        ->and($recommendation->error_message)->not->toContain('refused');
});

test('fails closed when the provider key is missing', function (): void {
    OpenAiClientWrapper::resetFakes();
    config(['services.openai.key' => '', 'services.openai.fake' => false]);

    $result = app(OpenAiClientWrapper::class)->generateRecommendation(['job' => []]);

    expect($result['success'])->toBeFalse()
        ->and($result['error_message'])->toBe('OpenAI API key is not configured.')
        ->and($result['response_summary'])->toBeNull();
});

test('rejects provider responses with an invalid schema without persisting raw output', function (): void {
    OpenAiClientWrapper::resetFakes();
    config(['services.openai.key' => 'test-key', 'services.openai.fake' => false]);
    Http::fake([
        'https://api.openai.com/v1/chat/completions' => Http::response([
            'choices' => [[
                'finish_reason' => 'stop',
                'message' => ['content' => '{"secret":"provider output"}'],
            ]],
        ]),
    ]);

    $result = app(OpenAiClientWrapper::class)->generateRecommendation(['job' => []]);

    expect($result['success'])->toBeFalse()
        ->and($result['error_message'])->toBe('Model output failed schema validation.')
        ->and($result['response_summary'])->toBeNull();
});

test('enforces input-token and cost ceilings before accepting provider output', function (): void {
    OpenAiClientWrapper::resetFakes();
    config([
        'services.openai.key' => 'test-key',
        'services.openai.fake' => false,
        'services.openai.max_input_tokens' => 1,
    ]);

    $tooLarge = app(OpenAiClientWrapper::class)->generateRecommendation(['job' => str_repeat('x', 100)]);
    expect($tooLarge['success'])->toBeFalse()
        ->and($tooLarge['error_message'])->toBe('The GPT context exceeds the maximum input size.');

    config(['services.openai.max_input_tokens' => 32000, 'services.openai.max_cost_usd' => 0.0001]);
    Http::fake([
        'https://api.openai.com/v1/chat/completions' => Http::response([
            'choices' => [[
                'finish_reason' => 'stop',
                'message' => ['content' => json_encode([
                    'summary' => 'Safe result',
                    'proposed_personnel' => [],
                    'proposed_assets' => [],
                    'reasons' => [],
                    'assumptions' => [],
                ], JSON_THROW_ON_ERROR)],
            ]],
            'usage' => [
                'prompt_tokens' => 100000,
                'completion_tokens' => 100000,
                'total_tokens' => 200000,
            ],
        ]),
    ]);

    $tooExpensive = app(OpenAiClientWrapper::class)->generateRecommendation(['job' => []]);
    expect($tooExpensive['success'])->toBeFalse()
        ->and($tooExpensive['error_message'])->toBe('The estimated GPT cost exceeds the configured ceiling.');
});
