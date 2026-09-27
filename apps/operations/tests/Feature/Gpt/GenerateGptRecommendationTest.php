<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Jobs\GenerateGptRecommendationJob;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\BoundedContextBuilder;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    OpenAiClientWrapper::fake();
});

afterEach(function (): void {
    OpenAiClientWrapper::resetFakes();
});

function gptUser(RoleName $role): User
{
    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([$role->value]);

    return $user;
}

function gptDispatchJob(User $creator): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => 'JOB-GPT-001',
        'client' => 'Acme Crane Operations',
        'title' => 'Lift operation at North Yard (Contact: john.doe@example.com / 555-019-2831)',
        'site' => 'North Yard, Pier 4',
        'site_notes' => 'Location: 14.5995, 120.9842. Secret Key: ABC123XYZ',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $creator->id,
    ]);
}

test('authorized dispatcher can initiate async gpt recommendation request', function (): void {
    Queue::fake();

    $dispatcher = gptUser(RoleName::OperationsManager);
    $job = gptDispatchJob($dispatcher);

    $response = $this->actingAs($dispatcher)->post('/operations/gpt-recommendations', [
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'purpose' => 'dispatch_assignment',
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('flash.success');

    $this->assertDatabaseHas('gpt_recommendations', [
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'status' => 'draft',
        'model' => 'gpt-6-luna',
    ]);

    Queue::assertPushed(GenerateGptRecommendationJob::class);
});

test('bounded AI context presents the scheduled window in Philippine local time', function (): void {
    $manager = gptUser(RoleName::OperationsManager);
    $job = gptDispatchJob($manager);
    $job->update([
        'scheduled_start' => '2026-09-30 08:00:00',
        'scheduled_end' => '2026-09-30 12:00:00',
    ]);

    $context = app(BoundedContextBuilder::class)->buildForDispatchJob($job)['context']['job'];

    expect($context['schedule_timezone'])->toBe('Asia/Manila')
        ->and($context['scheduled_start'])->toBe('2026-09-30T16:00:00+08:00')
        ->and($context['scheduled_end'])->toBe('2026-09-30T20:00:00+08:00');
});

test('extra AI crew is marked optional and unverified clock advice is rejected', function (): void {
    $manager = gptUser(RoleName::OperationsManager);
    $job = gptDispatchJob($manager);
    $context = [
        'job' => [
            'id' => $job->id,
            'version' => $job->version,
            'schedule_timezone' => 'Asia/Manila',
            'scheduled_start' => '2026-09-30T16:00:00+08:00',
            'scheduled_end' => '2026-09-30T20:00:00+08:00',
            'resource_requirements' => ['personnel' => ['crane_operator' => 1], 'assets' => ['crane' => 1]],
            'assigned_personnel' => [],
            'assigned_assets' => [],
        ],
        'personnel_candidates' => [
            ['user_id' => 101, 'name' => 'Operator One', 'role' => 'crane_operator', 'assignment_type' => 'crane_operator', 'eligible' => true],
            ['user_id' => 102, 'name' => 'Operator Two', 'role' => 'crane_operator', 'assignment_type' => 'crane_operator', 'eligible' => true],
        ],
        'asset_candidates' => [
            ['asset_id' => 201, 'code' => 'CR-201', 'name' => 'Test crane', 'kind' => 'crane', 'eligible' => true],
        ],
    ];
    $payload = [
        'summary' => 'Use the selected resources during the planned window.',
        'proposed_personnel' => [['user_id' => 101], ['user_id' => 102]],
        'proposed_assets' => [['operational_asset_id' => 201]],
        'reasons' => ['Candidates are available.'],
        'assumptions' => ['Confirm site readiness.'],
    ];

    $makeRecommendation = static fn () => GptRecommendation::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $manager->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'quality-test',
        'input_references' => ['user_ids' => [101, 102], 'asset_ids' => [201]],
        'recommendation' => [],
        'model' => 'gpt-6-luna',
        'status' => 'draft',
    ]);

    OpenAiClientWrapper::fake(['recommendation' => $payload]);
    $valid = $makeRecommendation();
    (new GenerateGptRecommendationJob($valid->id, $context))->handle(app(OpenAiClientWrapper::class), app(RecordAuditEvent::class));
    expect($valid->fresh()->status->value)->toBe('pending_review')
        ->and($valid->fresh()->recommendation['proposed_personnel'][0]['optional'])->toBeFalse()
        ->and($valid->fresh()->recommendation['proposed_personnel'][1]['optional'])->toBeTrue()
        ->and($valid->fresh()->recommendation['proposed_assets'][0]['optional'])->toBeFalse();

    OpenAiClientWrapper::fake(['recommendation' => [...$payload, 'summary' => 'Start at 08:00.']]);
    $invalid = $makeRecommendation();
    (new GenerateGptRecommendationJob($invalid->id, $context))->handle(app(OpenAiClientWrapper::class), app(RecordAuditEvent::class));
    expect($invalid->fresh()->status->value)->toBe('failed');
});

test('unauthorized user cannot request gpt recommendation', function (): void {
    $driver = gptUser(RoleName::CraneOperator);
    $job = gptDispatchJob($driver);

    $response = $this->actingAs($driver)->post('/operations/gpt-recommendations', [
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'purpose' => 'dispatch_assignment',
    ]);

    $response->assertForbidden();
});

test('async job processes context redaction and generates structured recommendation via fake client', function (): void {
    $dispatcher = gptUser(RoleName::OperationsManager);
    $job = gptDispatchJob($dispatcher);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'dummy-hash',
        'input_references' => ['user_ids' => [], 'asset_ids' => []],
        'recommendation' => [],
        'model' => 'gpt-5-mini',
        'status' => 'draft',
        'prompt_summary' => 'Dispatch test prompt',
    ]);

    $jobHandler = new GenerateGptRecommendationJob($recommendation->id, ['job' => ['id' => $job->id]]);
    $jobHandler->handle(app(OpenAiClientWrapper::class), app(RecordAuditEvent::class));

    $recommendation->refresh();

    expect($recommendation->status->value)->toBe('pending_review')
        ->and($recommendation->expires_at)->not->toBeNull()
        ->and($recommendation->expires_at->isFuture())->toBeTrue()
        ->and($recommendation->cost_usd)->toBeGreaterThan(0)
        ->and($recommendation->recommendation)->toHaveKey('summary')
        ->and($recommendation->recommendation)->toHaveKey('proposed_personnel')
        ->and($recommendation->recommendation)->toHaveKey('proposed_assets')
        ->and(OpenAiClientWrapper::recordedRequests()[0]['model'])->toBe('gpt-5-mini');

    $this->assertDatabaseHas('audit_events', [
        'action' => 'gpt.recommendation_generated',
        'actor_id' => $dispatcher->id,
    ]);
});

test('failed recommendation retains reported token usage and cost for governance telemetry', function (): void {
    $dispatcher = gptUser(RoleName::OperationsManager);
    $job = gptDispatchJob($dispatcher);
    $recommendation = GptRecommendation::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'failure-cost-hash',
        'input_references' => ['user_ids' => [], 'asset_ids' => []],
        'recommendation' => [],
        'model' => 'gpt-6-luna',
        'status' => 'draft',
    ]);

    OpenAiClientWrapper::fake([
        'success' => false,
        'usage' => ['prompt_tokens' => 1000, 'completion_tokens' => 400, 'total_tokens' => 1400],
        'cost_usd' => 0.0003,
        'error_message' => 'The estimated GPT cost exceeds the configured ceiling.',
    ]);

    (new GenerateGptRecommendationJob($recommendation->id, ['job' => ['id' => $job->id]]))->handle(
        app(OpenAiClientWrapper::class),
        app(RecordAuditEvent::class),
    );

    $recommendation->refresh();
    expect($recommendation->status->value)->toBe('failed')
        ->and($recommendation->usage['total_tokens'])->toBe(1400)
        ->and((float) $recommendation->cost_usd)->toBe(0.0003);

    $this->assertDatabaseHas('gpt_recommendation_metrics', [
        'recommendation_id' => $recommendation->id,
        'event' => 'failed',
        'total_tokens' => 1400,
        'cost_usd' => 0.0003,
    ]);
});

test('worker rejects ineligible or unknown proposed resources before review', function (): void {
    $dispatcher = gptUser(RoleName::OperationsManager);
    $job = gptDispatchJob($dispatcher);
    $context = [
        'job' => ['id' => $job->id],
        'personnel_candidates' => [
            ['user_id' => 12, 'eligible' => false],
            ['user_id' => 13, 'eligible' => true],
        ],
        'asset_candidates' => [
            ['asset_id' => 21, 'eligible' => true],
        ],
    ];

    foreach ([
        ['proposed_personnel' => [['user_id' => 12]], 'proposed_assets' => []],
        ['proposed_personnel' => [], 'proposed_assets' => [['operational_asset_id' => 22]]],
        ['proposed_personnel' => [['user_id' => 13], ['user_id' => 13]], 'proposed_assets' => []],
    ] as $proposal) {
        $recommendation = GptRecommendation::query()->create([
            'subject_type' => $job->getMorphClass(),
            'subject_id' => $job->id,
            'requested_by' => $dispatcher->id,
            'purpose' => 'dispatch_assignment',
            'context_hash' => 'invalid-candidate-hash',
            'input_references' => ['user_ids' => [12, 13], 'asset_ids' => [21]],
            'recommendation' => [],
            'model' => 'gpt-6-luna',
            'status' => 'draft',
        ]);
        OpenAiClientWrapper::fake([
            'recommendation' => array_merge($proposal, [
                'summary' => 'Invalid proposal',
                'reasons' => [],
                'assumptions' => [],
            ]),
            'cost_usd' => 0.0003,
        ]);

        (new GenerateGptRecommendationJob($recommendation->id, $context))->handle(
            app(OpenAiClientWrapper::class),
            app(RecordAuditEvent::class),
        );

        $recommendation->refresh();
        expect($recommendation->status->value)->toBe('failed')
            ->and($recommendation->recommendation)->toBe([])
            ->and((float) $recommendation->cost_usd)->toBe(0.0003);
    }
});

test('provider output is redacted before recommendation persistence', function (): void {
    $dispatcher = gptUser(RoleName::OperationsManager);
    $job = gptDispatchJob($dispatcher);
    $context = app(BoundedContextBuilder::class)->buildForDispatchJob($job);

    OpenAiClientWrapper::fake([
        'recommendation' => [
            'summary' => "Use {$job->title} at {$job->site}; contact jane@example.com 555-019-2831.",
            'proposed_personnel' => [],
            'proposed_assets' => [],
            'reasons' => ['Coordinates 14.5995, 120.9842 and token sk-live-secret-value.'],
            'assumptions' => ['Provider raw response should never be stored.'],
        ],
    ]);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $context['context_hash'],
        'input_references' => $context['input_references'],
        'recommendation' => [],
        'model' => 'gpt-5-mini',
        'status' => 'draft',
    ]);

    (new GenerateGptRecommendationJob($recommendation->id, $context['context']))->handle(
        app(OpenAiClientWrapper::class),
        app(RecordAuditEvent::class),
    );

    $recommendation->refresh();
    $serialized = json_encode($recommendation->recommendation, JSON_THROW_ON_ERROR);

    expect($serialized)
        ->not->toContain($job->title)
        ->not->toContain($job->site)
        ->not->toContain('jane@example.com')
        ->not->toContain('555-019-2831')
        ->not->toContain('14.5995, 120.9842')
        ->not->toContain('sk-live-secret-value');
});

test('async job hydrates personnel names and equipment codes and capacities from candidates before saving', function (): void {
    $dispatcher = gptUser(RoleName::OperationsManager);
    $job = gptDispatchJob($dispatcher);

    OpenAiClientWrapper::fake([
        'recommendation' => [
            'summary' => 'Recommend candidate personnel and asset.',
            'proposed_personnel' => [
                ['user_id' => 99, 'name' => 'Wrong person', 'role' => 'crane_operator', 'assignment_type' => 'crane_operator'],
            ],
            'proposed_assets' => [
                ['operational_asset_id' => 88, 'name' => 'Wrong asset', 'asset_code' => 'WRONG', 'capacity' => '1 t', 'assignment_type' => 'truck'],
            ],
            'reasons' => ['Matches criteria.'],
            'assumptions' => ['Normal conditions.'],
        ],
    ]);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'dummy-hash',
        'input_references' => ['user_ids' => [99], 'asset_ids' => [88]],
        'recommendation' => [],
        'model' => 'gpt-5-mini',
        'status' => 'draft',
        'prompt_summary' => 'Hydration test prompt',
    ]);

    $boundedContext = [
        'job' => ['id' => $job->id],
        'personnel_candidates' => [
            [
                'user_id' => 99,
                'name' => 'Candidate Driver Bob',
                'role' => 'driver',
                'assignment_type' => 'driver',
                'eligible' => true,
            ],
        ],
        'asset_candidates' => [
            [
                'asset_id' => 88,
                'code' => 'CR-088',
                'name' => 'Grove GMK 5150',
                'kind' => 'mobile_crane',
                'rated_capacity' => 150,
                'capacity_unit' => 't',
                'eligible' => true,
            ],
        ],
    ];

    $jobHandler = new GenerateGptRecommendationJob($recommendation->id, $boundedContext);
    $jobHandler->handle(app(OpenAiClientWrapper::class), app(RecordAuditEvent::class));

    $recommendation->refresh();
    $payload = $recommendation->recommendation;

    expect($payload['proposed_personnel'][0]['name'])->toBe('Candidate Driver Bob')
        ->and($payload['proposed_personnel'][0]['role'])->toBe('driver')
        ->and($payload['proposed_personnel'][0]['assignment_type'])->toBe('driver')
        ->and($payload['proposed_assets'][0]['name'])->toBe('Grove GMK 5150')
        ->and($payload['proposed_assets'][0]['asset_code'])->toBe('CR-088')
        ->and($payload['proposed_assets'][0]['capacity'])->toBe('150 t')
        ->and($payload['proposed_assets'][0]['assignment_type'])->toBe('mobile_crane');
});
