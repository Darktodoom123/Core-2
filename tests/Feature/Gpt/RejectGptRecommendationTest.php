<?php

use App\Enums\DispatchPriority;
use App\Enums\DispatchStatus;
use App\Enums\RoleName;
use App\Models\DispatchJob;
use App\Models\GptRecommendation;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

test('authorized dispatcher can reject a pending gpt recommendation with reason', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-REJ-001',
        'client' => 'Client X',
        'title' => 'Rejection test job',
        'site' => 'Site Y',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => DispatchJob::class,
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'hash-123',
        'input_references' => ['user_ids' => [], 'asset_ids' => []],
        'recommendation' => ['summary' => 'Proposed plan'],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->actingAs($dispatcher)->post("/operations/gpt-recommendations/{$recommendation->id}/reject", [
        'reason' => 'Resource preferences differ from recommendation',
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('flash.info');

    $recommendation->refresh();
    expect($recommendation->status)->toBe('rejected')
        ->and($recommendation->decided_by)->toBe($dispatcher->id)
        ->and($recommendation->decided_at)->not->toBeNull();

    $this->assertDatabaseHas('audit_events', [
        'action' => 'gpt.recommendation_rejected',
        'actor_id' => $dispatcher->id,
        'reason' => 'Resource preferences differ from recommendation',
    ]);
});
