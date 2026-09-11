<?php

use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

test('audit events can be recorded but cannot be modified or updated', function (): void {
    $user = User::factory()->create();

    $event = AuditEvent::query()->create([
        'actor_id' => $user->id,
        'subject_type' => User::class,
        'subject_id' => $user->id,
        'action' => 'user.permission_granted',
        'before' => ['status' => 'pending'],
        'after' => ['status' => 'active'],
        'reason' => 'Initial operational setup',
        'request_id' => (string) Str::uuid(),
        'ip_address' => '127.0.0.1',
        'occurred_at' => now(),
    ]);

    expect($event->exists)->toBeTrue();

    // Attempting to update must throw LogicException
    expect(fn () => $event->update(['action' => 'tampered.action']))
        ->toThrow(LogicException::class, 'Audit records are immutable and cannot be modified.');
});

test('audit events cannot be deleted', function (): void {
    $user = User::factory()->create();

    $event = AuditEvent::query()->create([
        'actor_id' => $user->id,
        'subject_type' => User::class,
        'subject_id' => $user->id,
        'action' => 'dispatch.emergency_abort',
        'reason' => 'Severe weather lightning strike',
        'request_id' => (string) Str::uuid(),
        'ip_address' => '127.0.0.1',
        'occurred_at' => now(),
    ]);

    expect($event->exists)->toBeTrue();

    // Attempting to delete must throw LogicException
    expect(fn () => $event->delete())
        ->toThrow(LogicException::class, 'Audit records are immutable and cannot be deleted.');
});
