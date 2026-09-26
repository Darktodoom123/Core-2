<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

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

it('reports the Tracking microservice offline and the platform degraded when its readiness probe fails', function (): void {
    config(['services.tracking.driver' => 'http', 'services.tracking.url' => 'http://localhost:8001']);
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    Http::fake(['http://localhost:8001/ready' => Http::response(['status' => 'not_ready'], 503)]);

    $this->actingAs($admin)
        ->getJson('/operations/admin/health')
        ->assertOk()
        ->assertJsonPath('services.tracking.status', 'offline')
        ->assertJsonPath('status', 'degraded');
});

it('reports the Tracking microservice offline when it cannot be reached', function (): void {
    config(['services.tracking.driver' => 'http', 'services.tracking.url' => 'http://localhost:8001']);
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    Http::fake(fn () => throw new ConnectionException('Connection refused'));

    $this->actingAs($admin)
        ->getJson('/operations/admin/health')
        ->assertOk()
        ->assertJsonPath('services.tracking.status', 'offline')
        ->assertJsonPath('services.tracking.latency_ms', null);
});

it('reports the Tracking microservice operational when its readiness probe succeeds', function (): void {
    config(['services.tracking.driver' => 'http', 'services.tracking.url' => 'http://localhost:8001']);
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    Http::fake(['http://localhost:8001/ready' => Http::response(['status' => 'ready'], 200)]);

    $this->actingAs($admin)
        ->getJson('/operations/admin/health')
        ->assertOk()
        ->assertJsonPath('services.tracking.status', 'operational')
        ->assertJsonPath('status', 'healthy');
});

it('reuses a recent Tracking readiness result so rapid health polls do not each wait on the probe', function (): void {
    config(['services.tracking.driver' => 'http', 'services.tracking.url' => 'http://localhost:8001']);
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    Http::fake(['http://localhost:8001/ready' => Http::response(['status' => 'not_ready'], 503)]);

    $this->actingAs($admin)->getJson('/operations/admin/health')->assertJsonPath('services.tracking.status', 'offline');
    $this->actingAs($admin)->getJson('/operations/admin/health')->assertJsonPath('services.tracking.status', 'offline');

    Http::assertSentCount(1);
});

it('does not probe a Tracking microservice when tracking runs inside operations', function (): void {
    config(['services.tracking.driver' => 'database']);
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    Http::fake();

    $this->actingAs($admin)
        ->getJson('/operations/admin/health')
        ->assertOk()
        ->assertJsonPath('services.tracking.status', 'not_applicable');

    Http::assertNothingSent();
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
    expect($response->json('acceptance_rate'))->toBeNull();
});
