<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\DispatchAssignmentNotification;
use App\Platform\Notifications\Jobs\SendQueuedNotificationJob;
use App\Platform\Notifications\Models\Notification;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createNotifUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

it('delivers notification to recipient and ensures queue retry idempotency', function (): void {
    $driver = createNotifUser(RoleName::CraneOperator);
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-NTF-001',
        'client' => 'Client',
        'title' => 'Title',
        'site' => 'Site',
        'status' => DispatchStatus::Scheduled,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(4),
        'created_by' => $driver->id,
        'version' => 1,
    ]);

    $notification = new DispatchAssignmentNotification($job, 'driver');

    // First execution
    $job1 = new SendQueuedNotificationJob($driver, $notification);
    $job1->handle();

    expect(Notification::query()->count())->toBe(1);

    // Second execution (Simulated retry or duplicate trigger)
    $job2 = new SendQueuedNotificationJob($driver, $notification);
    $job2->handle();

    // Must remain 1 due to idempotency check!
    expect(Notification::query()->count())->toBe(1);
});

it('allows recipient to list and mark notification as read while protecting cross-user access', function (): void {
    $userA = createNotifUser(RoleName::CraneOperator);
    $userB = createNotifUser(RoleName::CraneOperator);

    $notifA = Notification::query()->create([
        'type' => 'App\Platform\Notifications\DispatchAssignmentNotification',
        'notifiable_type' => $userA->getMorphClass(),
        'notifiable_id' => $userA->id,
        'status' => 'unread',
        'data' => ['message' => 'Assignment for User A'],
    ]);

    // User A can list notification
    $this->actingAs($userA)
        ->getJson('/operations/notifications')
        ->assertStatus(200)
        ->assertJsonFragment(['id' => $notifA->id]);

    // User B cannot mark User A's notification as read
    $this->actingAs($userB)
        ->postJson("/operations/notifications/{$notifA->id}/read")
        ->assertStatus(403);

    // User A can mark notification as read
    $this->actingAs($userA)
        ->postJson("/operations/notifications/{$notifA->id}/read")
        ->assertStatus(200);

    $notifA->refresh();
    expect($notifA->status)->toBe('read')
        ->and($notifA->read_at)->not()->toBeNull();
});
