<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('returns synthetic infrastructure health status to system administrator', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $response = $this->actingAs($admin)
        ->getJson('/operations/admin/health')
        ->assertOk();

    $data = $response->json();
    expect($data)->toHaveKey('status');
    expect($data['services'])->toHaveKeys(['database', 'cache', 'outbox', 'queues']);
    expect($data['services']['database']['status'])->toBe('operational');
});

it('allows system administrator to toggle the GPT advisory circuit breaker', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    Cache::forget('gpt_circuit_breaker_disabled');

    // 1. Toggle ON
    $res1 = $this->actingAs($admin)
        ->postJson('/operations/gpt-circuit-breaker/toggle')
        ->assertOk();

    expect($res1->json('circuit_breaker_active'))->toBeTrue();
    expect(Cache::get('gpt_circuit_breaker_disabled'))->toBeTrue();

    // 2. Toggle OFF (Resume)
    $res2 = $this->actingAs($admin)
        ->postJson('/operations/gpt-circuit-breaker/toggle')
        ->assertOk();

    expect($res2->json('circuit_breaker_active'))->toBeFalse();
    expect(Cache::get('gpt_circuit_breaker_disabled'))->toBeFalse();
});

it('returns governance telemetry to authorized users', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $response = $this->actingAs($admin)
        ->getJson('/operations/gpt-governance/telemetry')
        ->assertOk();

    expect($response->json())->toHaveKeys([
        'monthly_spend_usd',
        'monthly_budget_ceiling_usd',
        'total_tokens',
        'avg_latency_ms',
        'acceptance_rate',
    ]);
});
