<?php

use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    $this->admin = User::factory()->create(['name' => 'Ada Admin']);
    $this->admin->syncRoles([RoleName::SystemAdministrator->value]);
});

function auditEvent(?User $actor, string $action, string $occurredAt, ?string $reason = null, ?string $requestId = null): AuditEvent
{
    return AuditEvent::query()->create([
        'actor_id' => $actor?->id,
        'subject_type' => 'user',
        'subject_id' => $actor?->id ?? 1,
        'action' => $action,
        'reason' => $reason,
        'request_id' => $requestId ?? (string) Str::uuid(),
        'ip_address' => '10.0.0.5',
        'occurred_at' => Carbon::parse($occurredAt),
    ]);
}

it('pages every audit event newest first instead of a fixed sample', function (): void {
    foreach (range(1, 130) as $minute) {
        auditEvent($this->admin, 'user.login', "2026-09-01 08:00:00 +{$minute} minutes");
    }

    $response = $this->actingAs($this->admin)
        ->getJson('/operations/audit-events?per_page=50&page=3')
        ->assertOk();

    expect($response->json('total'))->toBe(130)
        ->and($response->json('current_page'))->toBe(3)
        ->and($response->json('last_page'))->toBe(3)
        ->and($response->json('events'))->toHaveCount(30);
});

it('filters by category using the recorded action prefixes and returns real counts', function (): void {
    auditEvent($this->admin, 'user.login', '2026-09-01 08:00');
    auditEvent($this->admin, 'personnel.credential_added', '2026-09-01 08:01');
    auditEvent($this->admin, 'dispatch.emergency_abort', '2026-09-01 08:02');
    auditEvent($this->admin, 'gpt.recommendation_accepted', '2026-09-01 08:03');
    auditEvent($this->admin, 'safety.sos_resolved', '2026-09-01 08:04');
    auditEvent($this->admin, 'asset.safety_lockdown', '2026-09-01 08:05');

    $response = $this->actingAs($this->admin)
        ->getJson('/operations/audit-events?category=access')
        ->assertOk();

    expect(collect($response->json('events'))->pluck('action')->all())
        ->toBe(['personnel.credential_added', 'user.login'])
        ->and($response->json('counts'))->toMatchArray([
            'all' => 6,
            'access' => 2,
            'dispatch' => 1,
            'fleet' => 1,
            'safety' => 1,
            'gpt' => 1,
            'overrides' => 2,
        ]);
});

it('narrows by actor, including system events without an actor', function (): void {
    $manager = User::factory()->create(['name' => 'Mia Manager']);
    auditEvent($this->admin, 'user.login', '2026-09-01 08:00');
    auditEvent($manager, 'dispatch.created', '2026-09-01 08:01');
    auditEvent(null, 'attachment.expired', '2026-09-01 08:02');

    $byManager = $this->actingAs($this->admin)
        ->getJson("/operations/audit-events?actor={$manager->id}")
        ->assertOk();
    $bySystem = $this->actingAs($this->admin)
        ->getJson('/operations/audit-events?actor=system')
        ->assertOk();

    expect(collect($byManager->json('events'))->pluck('action')->all())->toBe(['dispatch.created'])
        ->and(collect($bySystem->json('events'))->pluck('action')->all())->toBe(['attachment.expired'])
        ->and(collect($byManager->json('actors'))->pluck('name')->all())->toContain('Ada Admin', 'Mia Manager');
});

it('bounds results to a date range and searches action, reason, and request id', function (): void {
    auditEvent($this->admin, 'user.login', '2026-08-31 23:59:59');
    auditEvent($this->admin, 'dispatch.created', '2026-09-01 00:00:00', 'Crane lift for tower B');
    auditEvent($this->admin, 'dispatch.status_updated', '2026-09-02 23:59:59', null, '5b0e9b4e-1d1c-4a51-9d0b-6a3e0f7f2c11');
    auditEvent($this->admin, 'fuel.requested', '2026-09-03 00:00:00');

    $inRange = $this->actingAs($this->admin)
        ->getJson('/operations/audit-events?from=2026-09-01&to=2026-09-02')
        ->assertOk();
    $byReason = $this->actingAs($this->admin)
        ->getJson('/operations/audit-events?q=tower')
        ->assertOk();
    $byRequest = $this->actingAs($this->admin)
        ->getJson('/operations/audit-events?q=5b0e9b4e')
        ->assertOk();

    expect(collect($inRange->json('events'))->pluck('action')->all())
        ->toBe(['dispatch.status_updated', 'dispatch.created'])
        ->and(collect($byReason->json('events'))->pluck('action')->all())->toBe(['dispatch.created'])
        ->and(collect($byRequest->json('events'))->pluck('action')->all())->toBe(['dispatch.status_updated']);
});

it('reports the latest event and today\'s count for the dashboard summary', function (): void {
    Carbon::setTestNow('2026-09-10 12:00:00');
    auditEvent($this->admin, 'user.login', '2026-09-09 11:00');
    auditEvent($this->admin, 'dispatch.created', '2026-09-10 11:30');

    $this->actingAs($this->admin)
        ->getJson('/operations/audit-events?per_page=5')
        ->assertOk()
        ->assertJsonPath('last_24h_total', 1)
        ->assertJsonPath('events.0.action', 'dispatch.created')
        ->assertJsonPath('events.0.actor.name', 'Ada Admin')
        ->assertJsonPath('events.0.ip_address', '10.0.0.5');

    Carbon::setTestNow();
});

it('rejects invalid filters', function (): void {
    $this->actingAs($this->admin)
        ->getJson('/operations/audit-events?category=everything&per_page=500&from=yesterday')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['category', 'per_page', 'from']);
});

it('forbids users without audit access', function (): void {
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $this->actingAs($manager)->getJson('/operations/audit-events')->assertForbidden();
});

it('requires a signed-in user', function (): void {
    $this->getJson('/operations/audit-events')->assertUnauthorized();
});
