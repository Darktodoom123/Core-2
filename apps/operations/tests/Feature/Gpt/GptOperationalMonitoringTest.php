<?php

use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Models\GptRecommendationMetric;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;

uses(RefreshDatabase::class);

it('reports aggregate GPT queue status without recommendation context', function (): void {
    $this->seed(RolePermissionSeeder::class);
    $user = User::factory()->create();
    $user->syncRoles([RoleName::OperationsManager->value]);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => 'dispatch_job',
        'subject_id' => 1,
        'requested_by' => $user->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'safe-hash',
        'input_references' => [],
        'recommendation' => [],
        'conflicts' => [],
        'model' => 'gpt-5-mini',
        'status' => GptRecommendationStatus::Processing,
    ]);
    GptRecommendationMetric::query()->create([
        'recommendation_id' => $recommendation->id,
        'event' => 'failed',
        'status' => 'failed',
        'occurred_at' => now(),
        'purge_at' => now()->addDays(90),
    ]);

    expect(Artisan::call('gpt:queue-status'))->toBe(0);
    $output = json_decode(Artisan::output(), true, 512, JSON_THROW_ON_ERROR);

    expect($output)->toMatchArray([
        'pending' => 1,
        'pending_review' => 0,
        'failed' => 0,
    ])
        ->and(json_encode($output, JSON_THROW_ON_ERROR))->not->toContain('safe-hash');
});
