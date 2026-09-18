<?php

use App\Modules\Assignment\Actions\AssignDispatchResources;
use App\Modules\Assignment\Actions\ReassignDispatchResources;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Actions\CancelDispatchJob;
use App\Modules\Dispatch\Actions\RescheduleDispatchJob;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Models\UserDeviceToken;
use App\Platform\Notifications\Data\PushPayload;
use App\Platform\Notifications\DispatchAssignmentNotification;
use App\Platform\Notifications\DispatchReassignmentNotification;
use App\Platform\Notifications\DispatchScheduleChangeNotification;
use App\Platform\Notifications\Jobs\ProcessPushReceiptsJob;
use App\Platform\Notifications\Jobs\SendPushNotificationJob;
use App\Platform\Notifications\Jobs\SendQueuedNotificationJob;
use App\Platform\Notifications\Models\PushDelivery;
use App\Platform\Notifications\Services\PushNotificationService;
use App\Platform\Safety\Enums\SosIncidentCategory;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Models\SosIncident;
use App\Platform\Safety\Models\SosIncidentRecipient;
use App\Platform\Safety\Services\DatabaseSosResponderDelivery;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createPushUser(RoleName $role = RoleName::CraneOperator): User
{
    $user = User::factory()->create([
        'is_active' => true,
        'email_verified_at' => now(),
    ]);
    $user->syncRoles([$role->value]);

    return $user;
}

function registerTestDeviceToken(User $user, string $token = 'ExponentPushToken[mock-token-123]', string $installationId = 'install-001'): UserDeviceToken
{
    return UserDeviceToken::query()->create([
        'user_id' => $user->id,
        'installation_id' => $installationId,
        'token' => $token,
        'platform' => 'android',
        'provider' => 'expo',
        'is_active' => true,
        'last_registered_at' => now(),
    ]);
}

function createPushDispatchJob(User $creator, DispatchStatus $status = DispatchStatus::Scheduled): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => 'JOB-'.strtoupper(Str::random(6)),
        'client' => 'Metro Rail Transit',
        'title' => 'Emergency Track Maintenance',
        'site' => 'Cubao Station',
        'scheduled_start' => now()->addHours(2),
        'scheduled_end' => now()->addHours(8),
        'priority' => DispatchPriority::Priority,
        'status' => $status,
        'created_by' => $creator->id,
        'version' => 1,
    ]);
}

it('delivers push notification to active device tokens and updates last_used_at', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response([
            'data' => [
                ['status' => 'ok', 'id' => 'ticket-uuid-12345'],
            ],
        ], 200),
    ]);

    $user = createPushUser();
    $deviceToken = registerTestDeviceToken($user, 'ExponentPushToken[device-aaa-111]');

    $payload = new PushPayload(
        title: 'New Dispatch Assignment',
        body: 'You have been assigned to Emergency Track Maintenance',
        data: [
            'event' => 'dispatch.assigned',
            'job_id' => 42,
            'reference' => 'JOB-0042',
        ],
        channelId: 'dispatch-urgent',
    );

    $service = new PushNotificationService;
    $result = $service->sendToUser($user, $payload);

    expect($result['attempted'])->toBe(1)
        ->and($result['accepted'])->toBe(1)
        ->and($result['failed'])->toBe(0)
        ->and($result['tickets'])->toContain('ticket-uuid-12345');

    $deviceToken->refresh();
    expect($deviceToken->last_used_at)->not()->toBeNull();

    Http::assertSent(function ($request): bool {
        $body = $request->data();

        return count($body) === 1
            && $body[0]['to'] === 'ExponentPushToken[device-aaa-111]'
            && $body[0]['title'] === 'New Dispatch Assignment'
            && $body[0]['channelId'] === 'dispatch-urgent'
            && $body[0]['data']['job_id'] === 42;
    });
});

it('automatically revokes device token when provider returns DeviceNotRegistered', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response([
            'data' => [
                [
                    'status' => 'error',
                    'message' => '"ExponentPushToken[stale-token]" is not a registered push notification recipient',
                    'details' => ['error' => 'DeviceNotRegistered'],
                ],
            ],
        ], 200),
    ]);

    $user = createPushUser();
    $deviceToken = registerTestDeviceToken($user, 'ExponentPushToken[stale-token]');

    $payload = new PushPayload(
        title: 'Schedule Change',
        body: 'Job time has changed',
        data: ['event' => 'dispatch.schedule_changed', 'job_id' => 99],
    );

    $service = new PushNotificationService;
    $result = $service->sendToUser($user, $payload);

    expect($result['attempted'])->toBe(1)
        ->and($result['accepted'])->toBe(0)
        ->and($result['failed'])->toBe(1)
        ->and($result['deactivated'])->toBe(1);

    $deviceToken->refresh();
    expect($deviceToken->is_active)->toBeFalse()
        ->and($deviceToken->revoked_at)->not()->toBeNull();
});

it('throws RuntimeException on 429 rate limit to trigger queue backoff retry', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response([
            'error' => 'Too Many Requests',
        ], 429, ['Retry-After' => '30']),
    ]);

    $user = createPushUser();
    registerTestDeviceToken($user);

    $payload = new PushPayload(title: 'Test', body: 'Rate Limit Test');
    $service = new PushNotificationService;

    expect(fn () => $service->sendToUser($user, $payload))
        ->toThrow(RuntimeException::class, 'Push notification provider rate limit exceeded.');
});

it('skips queued assignment push if dispatch job was cancelled prior to job execution', function (): void {
    Http::fake();

    $dispatcher = createPushUser(RoleName::OperationsManager);
    $driver = createPushUser(RoleName::CraneOperator);
    registerTestDeviceToken($driver);

    $job = createPushDispatchJob($dispatcher, DispatchStatus::Cancelled);

    $payload = new PushPayload(
        title: 'New Dispatch Assignment',
        body: 'Assigned to '.$job->reference,
        data: ['event' => 'dispatch.assigned', 'job_id' => $job->id],
    );

    $jobInstance = new SendPushNotificationJob(
        recipient: $driver,
        payload: $payload,
        relevanceType: 'dispatch_job',
        relevanceId: $job->id,
    );

    app()->call([$jobInstance, 'handle']);

    Http::assertNothingSent();
});

it('skips queued assignment push if driver is no longer assigned to job', function (): void {
    Http::fake();

    $dispatcher = createPushUser(RoleName::OperationsManager);
    $driver = createPushUser(RoleName::CraneOperator);
    registerTestDeviceToken($driver);

    $job = createPushDispatchJob($dispatcher, DispatchStatus::Scheduled);

    // Assignment ended
    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHours(2),
        'active_until' => now()->subMinute(),
    ]);

    $payload = new PushPayload(
        title: 'New Dispatch Assignment',
        body: 'Assigned to '.$job->reference,
        data: ['event' => 'dispatch.assigned', 'job_id' => $job->id],
    );

    $jobInstance = new SendPushNotificationJob(
        recipient: $driver,
        payload: $payload,
        relevanceType: 'dispatch_job',
        relevanceId: $job->id,
    );

    app()->call([$jobInstance, 'handle']);

    Http::assertNothingSent();
});

it('skips queued SOS push if incident was already resolved', function (): void {
    Http::fake();

    $operator = createPushUser(RoleName::CraneOperator);
    $responder = createPushUser(RoleName::OperationsManager);
    registerTestDeviceToken($responder);

    $incident = SosIncident::factory()->create([
        'reporter_id' => $operator->id,
        'status' => SosIncidentStatus::Resolved,
        'resolved_at' => now()->subMinute(),
    ]);

    $payload = new PushPayload(
        title: 'EMERGENCY SOS ALERT',
        body: 'SOS triggered by operator',
        data: ['event' => 'sos.incident', 'incident_id' => $incident->id],
    );

    $jobInstance = new SendPushNotificationJob(
        recipient: $responder,
        payload: $payload,
        relevanceType: 'sos_incident',
        relevanceId: $incident->id,
    );

    app()->call([$jobInstance, 'handle']);

    Http::assertNothingSent();
});

it('dispatches push notification when AssignDispatchResources assigns personnel', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response(['data' => [['status' => 'ok']]], 200),
    ]);

    $dispatcher = createPushUser(RoleName::OperationsManager);
    $driver = createPushUser(RoleName::CraneOperator);
    $driver->personnelCredentials()->create([
        'kind' => 'driver_license',
        'credential_number' => 'DL-999',
        'credential_type' => 'professional',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
        'status' => 'active',
    ]);
    registerTestDeviceToken($driver, 'ExponentPushToken[driver-assign-token]');

    $asset = OperationalAsset::query()->create([
        'code' => 'CR-55',
        'name' => '50T Mobile Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    $job = createPushDispatchJob($dispatcher, DispatchStatus::Draft);

    $action = app(AssignDispatchResources::class);
    $action->handle(
        actor: $dispatcher,
        job: $job,
        personnel: [
            ['user_id' => $driver->id, 'assignment_type' => 'driver'],
        ],
        assets: [
            ['operational_asset_id' => $asset->id, 'assignment_type' => 'crane'],
        ],
        version: 1,
    );

    Http::assertSent(function ($request) use ($job): bool {
        $body = $request->data();

        return count($body) === 1
            && $body[0]['to'] === 'ExponentPushToken[driver-assign-token]'
            && $body[0]['data']['event'] === 'dispatch.assigned'
            && $body[0]['data']['job_id'] === $job->id;
    });
});

it('dispatches push notification when CancelDispatchJob cancels an active job with assigned personnel', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response(['data' => [['status' => 'ok']]], 200),
    ]);

    $dispatcher = createPushUser(RoleName::OperationsManager);
    $driver = createPushUser(RoleName::CraneOperator);
    registerTestDeviceToken($driver, 'ExponentPushToken[driver-cancel-token]');

    $job = createPushDispatchJob($dispatcher, DispatchStatus::Dispatched);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHour(),
        'active_until' => null,
    ]);

    $action = app(CancelDispatchJob::class);
    $action->handle(
        actor: $dispatcher,
        job: $job,
        reason: 'Client requested postponement',
        version: 1,
    );

    Http::assertSent(function ($request) use ($job): bool {
        $body = $request->data();

        return count($body) === 1
            && $body[0]['to'] === 'ExponentPushToken[driver-cancel-token]'
            && $body[0]['data']['event'] === 'dispatch.cancelled'
            && $body[0]['data']['job_id'] === $job->id
            && $body[0]['data']['reason'] === 'Client requested postponement';
    });
});

it('dispatches emergency push notification to authorized SOS responders via DatabaseSosResponderDelivery', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response(['data' => [['status' => 'ok']]], 200),
    ]);

    $operator = createPushUser(RoleName::CraneOperator);
    $responder = createPushUser(RoleName::OperationsManager);
    registerTestDeviceToken($responder, 'ExponentPushToken[responder-emergency-token]');

    $incident = SosIncident::factory()->create([
        'reporter_id' => $operator->id,
        'status' => SosIncidentStatus::Active,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
    ]);

    $recipientRecord = SosIncidentRecipient::factory()->create([
        'sos_incident_id' => $incident->id,
        'user_id' => $responder->id,
        'role_at_alert' => 'operations_manager',
    ]);

    $delivery = app(DatabaseSosResponderDelivery::class);
    $delivery->deliver($recipientRecord);

    Http::assertSent(function ($request) use ($incident): bool {
        $body = $request->data();

        return count($body) === 1
            && $body[0]['to'] === 'ExponentPushToken[responder-emergency-token]'
            && $body[0]['channelId'] === 'sos-emergency'
            && $body[0]['priority'] === 'high'
            && $body[0]['data']['event'] === 'safety.sos_received'
            && $body[0]['data']['incident_id'] === $incident->id;
    });
});

it('prevents duplicate push deliveries when SendPushNotificationJob is retried with a deduplicationKey', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response(['data' => [['status' => 'ok', 'id' => 'ticket-dedup-1']]], 200),
    ]);

    $user = createPushUser();
    registerTestDeviceToken($user, 'ExponentPushToken[dedup-token-1]');

    $payload = new PushPayload(
        title: 'Important Alert',
        body: 'This is an alert',
        data: ['event' => 'dispatch.assigned', 'job_id' => 10],
    );

    $job1 = new SendPushNotificationJob(
        recipient: $user,
        payload: $payload,
        deduplicationKey: 'stable-job-10-user-'.$user->id,
    );
    app()->call([$job1, 'handle']);

    expect(Http::recorded())->toHaveCount(1);

    // Second run with same deduplication key
    $job2 = new SendPushNotificationJob(
        recipient: $user,
        payload: $payload,
        deduplicationKey: 'stable-job-10-user-'.$user->id,
    );
    app()->call([$job2, 'handle']);

    // HTTP request count must still be 1 (no duplicate sent)
    expect(Http::recorded())->toHaveCount(1);
});

it('processes push delivery receipts, marks deliveries delivered, and deactivates unregistered devices', function (): void {
    $user = createPushUser();
    $tokenActive = registerTestDeviceToken($user, 'ExponentPushToken[valid-token]', 'inst-valid');
    $tokenInvalid = registerTestDeviceToken($user, 'ExponentPushToken[invalid-token]', 'inst-invalid');

    // Create 2 accepted deliveries
    $delivery1 = PushDelivery::query()->create([
        'user_id' => $user->id,
        'user_device_token_id' => $tokenActive->id,
        'ticket_id' => 'ticket-receipt-delivered',
        'event' => 'dispatch.assigned',
        'status' => PushDelivery::STATUS_ACCEPTED,
        'sent_at' => now()->subMinutes(15),
        'provider' => 'expo',
    ]);

    $delivery2 = PushDelivery::query()->create([
        'user_id' => $user->id,
        'user_device_token_id' => $tokenInvalid->id,
        'ticket_id' => 'ticket-receipt-unregistered',
        'event' => 'dispatch.assigned',
        'status' => PushDelivery::STATUS_ACCEPTED,
        'sent_at' => now()->subMinutes(15),
        'provider' => 'expo',
    ]);

    Http::fake([
        'https://exp.host/--/api/v2/push/getReceipts' => Http::response([
            'data' => [
                'ticket-receipt-delivered' => ['status' => 'ok'],
                'ticket-receipt-unregistered' => [
                    'status' => 'error',
                    'message' => 'The recipient device is no longer registered.',
                    'details' => ['error' => 'DeviceNotRegistered'],
                ],
            ],
        ], 200),
    ]);

    $job = new ProcessPushReceiptsJob;
    app()->call([$job, 'handle']);

    $delivery1->refresh();
    expect($delivery1->status)->toBe(PushDelivery::STATUS_DELIVERED)
        ->and($delivery1->delivered_at)->not()->toBeNull();

    $delivery2->refresh();
    expect($delivery2->status)->toBe(PushDelivery::STATUS_FAILED)
        ->and($delivery2->error_code)->toBe('DeviceNotRegistered');

    $tokenInvalid->refresh();
    expect($tokenInvalid->is_active)->toBeFalse()
        ->and($tokenInvalid->revoked_at)->not()->toBeNull();

    $tokenActive->refresh();
    expect($tokenActive->is_active)->toBeTrue();
});

it('dispatches push notification when RescheduleDispatchJob reschedules an active assignment', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response(['data' => [['status' => 'ok']]], 200),
    ]);

    $dispatcher = createPushUser(RoleName::OperationsManager);
    $driver = createPushUser(RoleName::CraneOperator);
    registerTestDeviceToken($driver, 'ExponentPushToken[driver-resched-token]');

    $job = createPushDispatchJob($dispatcher, DispatchStatus::Scheduled);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHour(),
        'active_until' => null,
    ]);

    $action = app(RescheduleDispatchJob::class);
    $action->handle(
        actor: $dispatcher,
        job: $job,
        scheduledStart: now()->addHours(4),
        scheduledEnd: now()->addHours(10),
        reason: 'Shift pushed back due to weather delay',
        version: 1,
    );

    Http::assertSent(function ($request) use ($job): bool {
        $body = $request->data();

        return count($body) === 1
            && $body[0]['to'] === 'ExponentPushToken[driver-resched-token]'
            && $body[0]['data']['event'] === 'dispatch.schedule_changed'
            && $body[0]['data']['job_id'] === $job->id
            && $body[0]['channelId'] === 'dispatch-updates';
    });
});

it('delivers push notification to multiple active devices for the same user', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response([
            'data' => [
                ['status' => 'ok', 'id' => 'ticket-dev-1'],
                ['status' => 'ok', 'id' => 'ticket-dev-2'],
            ],
        ], 200),
    ]);

    $user = createPushUser();
    $token1 = registerTestDeviceToken($user, 'ExponentPushToken[phone-token]', 'install-phone');
    $token2 = registerTestDeviceToken($user, 'ExponentPushToken[tablet-token]', 'install-tablet');

    $payload = new PushPayload(
        title: 'New Dispatch Assignment',
        body: 'You have been assigned to dispatch job JOB-001.',
        data: ['event' => 'dispatch.assigned', 'job_id' => 10, 'recipient_id' => $user->id],
        channelId: 'dispatch-urgent',
    );

    $service = new PushNotificationService;
    $result = $service->sendToUser($user, $payload, 'evt-hash-multi-01');

    expect($result['accepted'])->toBe(2)
        ->and($result['failed'])->toBe(0);

    Http::assertSent(function ($request): bool {
        $data = $request->data();

        return count($data) === 2
            && $data[0]['to'] === 'ExponentPushToken[phone-token]'
            && $data[1]['to'] === 'ExponentPushToken[tablet-token]';
    });

    $deliveries = PushDelivery::query()->where('user_id', $user->id)->get();
    expect($deliveries)->toHaveCount(2)
        ->and($deliveries->pluck('user_device_token_id')->all())->toEqualCanonicalizing([$token1->id, $token2->id])
        ->and($deliveries->pluck('status')->all())->toBe(['accepted', 'accepted']);
});

it('skips already delivered device token on retry but notifies pending device token', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response([
            'data' => [
                ['status' => 'ok', 'id' => 'ticket-dev-2-retry'],
            ],
        ], 200),
    ]);

    $user = createPushUser();
    $token1 = registerTestDeviceToken($user, 'ExponentPushToken[phone-already-delivered]', 'install-phone');
    $token2 = registerTestDeviceToken($user, 'ExponentPushToken[tablet-pending-send]', 'install-tablet');

    $eventHash = 'evt-retry-dedup-hash';

    // Device 1 already has an accepted delivery for this event
    PushDelivery::query()->create([
        'user_id' => $user->id,
        'user_device_token_id' => $token1->id,
        'business_event_hash' => $eventHash,
        'deduplication_key' => $eventHash,
        'ticket_id' => 'ticket-dev-1-prev',
        'event' => 'dispatch.assigned',
        'status' => PushDelivery::STATUS_ACCEPTED,
        'sent_at' => now()->subMinute(),
        'provider' => 'expo',
    ]);

    $payload = new PushPayload(
        title: 'New Dispatch Assignment',
        body: 'You have been assigned to dispatch job JOB-001.',
        data: ['event' => 'dispatch.assigned', 'job_id' => 10, 'recipient_id' => $user->id],
        channelId: 'dispatch-urgent',
    );

    $service = new PushNotificationService;
    $result = $service->sendToUser($user, $payload, $eventHash);

    // Only device 2 is sent
    expect($result['accepted'])->toBe(1);

    Http::assertSent(function ($request): bool {
        $data = $request->data();

        return count($data) === 1
            && $data[0]['to'] === 'ExponentPushToken[tablet-pending-send]';
    });
});

it('notifies all active devices across successive schedule changes with distinct timestamps', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response([
            'data' => [
                ['status' => 'ok', 'id' => 'ticket-1'],
                ['status' => 'ok', 'id' => 'ticket-2'],
            ],
        ], 200),
    ]);

    $user = createPushUser();
    registerTestDeviceToken($user, 'ExponentPushToken[phone-sc]', 'install-phone');
    registerTestDeviceToken($user, 'ExponentPushToken[tablet-sc]', 'install-tablet');

    $service = new PushNotificationService;

    // Schedule Change 1
    $payload1 = new PushPayload(
        title: 'Schedule Update',
        body: 'Schedule updated for dispatch job JOB-001.',
        data: [
            'event' => 'dispatch.schedule_changed',
            'job_id' => 10,
            'scheduled_start' => '2026-09-18T10:00:00Z',
            'recipient_id' => $user->id,
        ],
        channelId: 'dispatch-updates',
    );
    $hash1 = hash('sha256', "dispatch.schedule_changed:10:{$user->id}:2026-09-18T10:00:00Z");
    $result1 = $service->sendToUser($user, $payload1, $hash1);
    expect($result1['accepted'])->toBe(2);

    // Schedule Change 2 (successive schedule adjustment)
    $payload2 = new PushPayload(
        title: 'Schedule Update',
        body: 'Schedule updated for dispatch job JOB-001.',
        data: [
            'event' => 'dispatch.schedule_changed',
            'job_id' => 10,
            'scheduled_start' => '2026-09-18T14:00:00Z',
            'recipient_id' => $user->id,
        ],
        channelId: 'dispatch-updates',
    );
    $hash2 = hash('sha256', "dispatch.schedule_changed:10:{$user->id}:2026-09-18T14:00:00Z");
    $result2 = $service->sendToUser($user, $payload2, $hash2);
    expect($result2['accepted'])->toBe(2);

    expect(PushDelivery::query()->where('user_id', $user->id)->count())->toBe(4);
});

it('does not suppress dispatch.cancelled push notification even though job status is cancelled', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response([
            'data' => [['status' => 'ok', 'id' => 'ticket-cancel-1']],
        ], 200),
    ]);

    $dispatcher = createPushUser(RoleName::OperationsManager);
    $driver = createPushUser(RoleName::CraneOperator);
    registerTestDeviceToken($driver, 'ExponentPushToken[driver-cancel-device]');

    // Job is Cancelled
    $job = createPushDispatchJob($dispatcher, DispatchStatus::Cancelled);

    // Driver was assigned in the past
    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHours(2),
        'active_until' => now()->subMinute(),
    ]);

    $payload = new PushPayload(
        title: 'Dispatch Job Cancelled',
        body: "Dispatch job {$job->reference} has been cancelled.",
        data: [
            'event' => 'dispatch.cancelled',
            'job_id' => $job->id,
            'reference' => $job->reference,
            'recipient_id' => $driver->id,
        ],
        channelId: 'dispatch-urgent',
    );

    // Execute SendPushNotificationJob
    $jobInstance = new SendPushNotificationJob($driver, $payload, 'cancel-hash-001', 'dispatch_job', $job->id);
    app()->call([$jobInstance, 'handle']);

    Http::assertSent(function ($request): bool {
        $data = $request->data();

        return count($data) === 1
            && $data[0]['to'] === 'ExponentPushToken[driver-cancel-device]'
            && $data[0]['data']['event'] === 'dispatch.cancelled';
    });
});

it('does not suppress dispatch.reassigned removal notice when user has been released', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response([
            'data' => [['status' => 'ok', 'id' => 'ticket-reassign-1']],
        ], 200),
    ]);

    $dispatcher = createPushUser(RoleName::OperationsManager);
    $releasedDriver = createPushUser(RoleName::CraneOperator);
    registerTestDeviceToken($releasedDriver, 'ExponentPushToken[released-driver-device]');

    $job = createPushDispatchJob($dispatcher, DispatchStatus::Scheduled);

    // Released driver's assignment ended
    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $releasedDriver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHours(3),
        'active_until' => now()->subMinutes(10),
    ]);

    $payload = new PushPayload(
        title: 'Dispatch Assignment Updated',
        body: "You have been released from dispatch job {$job->reference}.",
        data: [
            'event' => 'dispatch.reassigned',
            'action' => 'released',
            'job_id' => $job->id,
            'reference' => $job->reference,
            'recipient_id' => $releasedDriver->id,
        ],
        channelId: 'dispatch-updates',
    );

    $jobInstance = new SendPushNotificationJob($releasedDriver, $payload, 'release-hash-001', 'dispatch_job', $job->id);
    app()->call([$jobInstance, 'handle']);

    Http::assertSent(function ($request): bool {
        $data = $request->data();

        return count($data) === 1
            && $data[0]['to'] === 'ExponentPushToken[released-driver-device]'
            && $data[0]['data']['event'] === 'dispatch.reassigned'
            && $data[0]['data']['action'] === 'released';
    });
});

it('discards dispatch.schedule_changed notification when schedule timestamp is obsolete', function (): void {
    Http::fake();

    $dispatcher = createPushUser(RoleName::OperationsManager);
    $driver = createPushUser(RoleName::CraneOperator);
    registerTestDeviceToken($driver, 'ExponentPushToken[driver-obsolete-device]');

    // Current job schedule is at +5 hours
    $job = createPushDispatchJob($dispatcher, DispatchStatus::Scheduled);
    $job->update(['scheduled_start' => now()->addHours(5)]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHour(),
        'active_until' => null,
    ]);

    // Outdated push notification from a superseded schedule update (e.g. +2 hours)
    $obsoletePayload = new PushPayload(
        title: 'Schedule Update',
        body: "Schedule updated for dispatch job {$job->reference}.",
        data: [
            'event' => 'dispatch.schedule_changed',
            'job_id' => $job->id,
            'reference' => $job->reference,
            'scheduled_start' => now()->addHours(2)->toIso8601String(),
            'recipient_id' => $driver->id,
        ],
        channelId: 'dispatch-updates',
    );

    $jobInstance = new SendPushNotificationJob($driver, $obsoletePayload, 'obsolete-hash-001', 'dispatch_job', $job->id);
    app()->call([$jobInstance, 'handle']);

    // HTTP push must NOT be sent because the update was discarded as obsolete
    Http::assertNothingSent();
});

it('sanitizes lock-screen push payloads and includes recipient_id for privacy', function (): void {
    $creator = createPushUser(RoleName::OperationsManager);
    $operator = createPushUser(RoleName::CraneOperator);

    $job = createPushDispatchJob($creator);
    $job->update([
        'title' => 'Confidential High-Security Reactor Lift',
        'client' => 'National Power Corp',
        'site' => 'Bataan Nuclear Power Plant',
    ]);

    // 1. Assignment notification
    $assignNotif = new DispatchAssignmentNotification($job, 'crane_operator');
    $assignPush = $assignNotif->toPush($operator);

    expect($assignPush->title)->toBe('New Dispatch Assignment')
        ->and($assignPush->body)->not()->toContain('Confidential')
        ->and($assignPush->body)->not()->toContain('National Power Corp')
        ->and($assignPush->body)->not()->toContain('Bataan')
        ->and($assignPush->data['recipient_id'])->toBe($operator->id);

    // 2. Schedule change notification
    $schedNotif = new DispatchScheduleChangeNotification($job, 'Client moved window by 2h');
    $schedPush = $schedNotif->toPush($operator);

    expect($schedPush->title)->toBe('Schedule Update')
        ->and($schedPush->body)->not()->toContain('Client moved window')
        ->and($schedPush->body)->not()->toContain('National Power Corp')
        ->and($schedPush->data['recipient_id'])->toBe($operator->id);

    // 3. Reassignment notification
    $reassignNotif = new DispatchReassignmentNotification($job, 'released', 'Replaced due to HOS fatigue');
    $reassignPush = $reassignNotif->toPush($operator);

    expect($reassignPush->title)->toBe('Dispatch Assignment Updated')
        ->and($reassignPush->body)->not()->toContain('fatigue')
        ->and($reassignPush->body)->not()->toContain('National Power Corp')
        ->and($reassignPush->data['recipient_id'])->toBe($operator->id);

    // 4. DatabaseSosResponderDelivery payload
    Queue::fake([SendPushNotificationJob::class]);
    $delivery = app(DatabaseSosResponderDelivery::class);
    $incident = SosIncident::query()->create([
        'command_id' => (string) Str::uuid(),
        'reporter_id' => $operator->id,
        'category' => SosIncidentCategory::CriticalAssetMalfunction,
        'status' => SosIncidentStatus::Active,
        'device_activated_at' => now(),
        'received_at' => now(),
        'escalation_due_at' => now()->addMinutes(3),
        'worker_note' => 'Hydraulic system failure',
    ]);
    $recipient = SosIncidentRecipient::query()->create([
        'sos_incident_id' => $incident->id,
        'user_id' => $creator->id,
        'role_at_alert' => 'operations_manager',
        'resolution_reason' => 'operations_manager_fallback',
    ]);

    $delivery->deliver($recipient);

    Queue::assertPushed(SendPushNotificationJob::class, function (SendPushNotificationJob $job) use ($operator, $creator, $incident): bool {
        $sosPush = $job->payload;

        return $sosPush->title === 'EMERGENCY SOS ALERT'
            && ! str_contains($sosPush->body, $operator->name)
            && ! str_contains($sosPush->body, 'Hydraulic')
            && ($sosPush->data['recipient_id'] ?? null) === $creator->id
            && ($sosPush->data['incident_id'] ?? null) === $incident->id;
    });
});

it('dispatches push notifications to both released and newly assigned personnel during reassignment', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response([
            'data' => [
                ['status' => 'ok', 'id' => 'ticket-reassign-dual-1'],
            ],
        ], 200),
    ]);

    $dispatcher = createPushUser(RoleName::OperationsManager);
    $oldDriver = createPushUser(RoleName::CraneOperator);
    $newDriver = createPushUser(RoleName::CraneOperator);

    $oldDriver->personnelProfile()->create(['availability_status' => 'available']);
    $oldDriver->personnelCredentials()->create([
        'kind' => 'operator_certification',
        'credential_number' => 'OP-OLD-101',
        'credential_type' => 'mobile_crane',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
        'status' => 'active',
    ]);

    $newDriver->personnelProfile()->create(['availability_status' => 'available']);
    $newDriver->personnelCredentials()->create([
        'kind' => 'operator_certification',
        'credential_number' => 'OP-NEW-202',
        'credential_type' => 'mobile_crane',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
        'status' => 'active',
    ]);

    registerTestDeviceToken($oldDriver, 'ExponentPushToken[old-driver-tok]', 'install-old');
    registerTestDeviceToken($newDriver, 'ExponentPushToken[new-driver-tok]', 'install-new');

    $job = createPushDispatchJob($dispatcher, DispatchStatus::Scheduled);
    $job->update(['priority' => DispatchPriority::Routine]);

    $existingAssignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $oldDriver->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
        'active_until' => null,
    ]);

    $reassignAction = app(ReassignDispatchResources::class);
    $reassignAction->handle(
        actor: $dispatcher,
        job: $job,
        endPersonnelIds: [$existingAssignment->id],
        endAssetIds: [],
        newPersonnel: [
            ['user_id' => $newDriver->id, 'assignment_type' => 'crane_operator'],
        ],
        newAssets: [],
        reason: 'Shift fatigue swap',
        version: $job->version,
    );

    Http::assertSent(function ($request): bool {
        $data = $request->data();

        return count($data) === 1
            && $data[0]['to'] === 'ExponentPushToken[old-driver-tok]'
            && $data[0]['data']['event'] === 'dispatch.reassigned'
            && $data[0]['data']['action'] === 'released';
    });

    Http::assertSent(function ($request): bool {
        $data = $request->data();

        return count($data) === 1
            && $data[0]['to'] === 'ExponentPushToken[new-driver-tok]'
            && $data[0]['data']['event'] === 'dispatch.assigned'
            && $data[0]['data']['assignment_type'] === 'crane_operator';
    });
});

it('sends push only to pending or failed devices on retry when one device already accepted', function (): void {
    $dispatcher = createPushUser(RoleName::OperationsManager);
    $driver = createPushUser(RoleName::CraneOperator);

    $token1 = registerTestDeviceToken($driver, 'ExponentPushToken[driver-phone-111]', 'phone-001');
    $token2 = registerTestDeviceToken($driver, 'ExponentPushToken[driver-tablet-222]', 'tablet-002');

    $job = createPushDispatchJob($dispatcher, DispatchStatus::Scheduled);
    $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
        'active_until' => null,
    ]);

    $dedupKey = "test:retry:multi-device:{$job->id}";

    // Simulate Device 1 previously accepted
    PushDelivery::query()->create([
        'user_id' => $driver->id,
        'user_device_token_id' => $token1->id,
        'ticket_id' => 'ticket-phone-already-ok',
        'event' => 'dispatch.assigned',
        'relevance_type' => 'dispatch_job',
        'relevance_id' => (string) $job->id,
        'deduplication_key' => $dedupKey,
        'status' => PushDelivery::STATUS_ACCEPTED,
        'sent_at' => now()->subMinute(),
        'provider' => 'expo',
    ]);

    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response([
            'data' => [
                ['status' => 'ok', 'id' => 'ticket-tablet-now-ok'],
            ],
        ], 200),
    ]);

    $payload = new PushPayload(
        title: 'New Dispatch Assignment',
        body: "You have been assigned to dispatch job {$job->reference}.",
        data: [
            'event' => 'dispatch.assigned',
            'job_id' => $job->id,
            'reference' => $job->reference,
            'recipient_id' => $driver->id,
        ],
        channelId: 'dispatch-urgent',
    );

    $retryJob = new SendPushNotificationJob($driver, $payload, $dedupKey, 'dispatch_job', $job->id);
    app()->call([$retryJob, 'handle']);

    // HTTP call should ONLY have been made for Device 2 (tablet), skipping Device 1 (phone)
    Http::assertSent(function ($request): bool {
        $messages = $request->data();

        return count($messages) === 1
            && $messages[0]['to'] === 'ExponentPushToken[driver-tablet-222]';
    });
});

it('preserves stable push event identity across retries and completely skips sending when all devices have accepted', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response([
            'data' => [
                ['status' => 'ok', 'id' => 'ticket-stable-phone'],
                ['status' => 'ok', 'id' => 'ticket-stable-tablet'],
            ],
        ], 200),
    ]);

    $dispatcher = createPushUser(RoleName::OperationsManager);
    $driver = createPushUser(RoleName::CraneOperator);
    $token1 = registerTestDeviceToken($driver, 'ExponentPushToken[driver-stable-phone]', 'phone-inst-stable');
    $token2 = registerTestDeviceToken($driver, 'ExponentPushToken[driver-stable-tablet]', 'tablet-inst-stable');

    $job = createPushDispatchJob($dispatcher, DispatchStatus::Scheduled);
    $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
        'active_until' => null,
    ]);

    $notification = new DispatchAssignmentNotification($job, 'crane_operator');

    // First attempt via SendQueuedNotificationJob
    $queuedJob1 = new SendQueuedNotificationJob($driver, $notification);
    $queuedJob1->handle();

    // 1 HTTP batch was sent for 2 devices
    Http::assertSentCount(1);
    expect(PushDelivery::query()->where('user_id', $driver->id)->count())->toBe(2);

    $deliveries = PushDelivery::query()->where('user_id', $driver->id)->get();
    $dedupKey = $deliveries->first()->deduplication_key;
    expect($dedupKey)->not()->toBeNull()
        ->and($deliveries->last()->deduplication_key)->toBe($dedupKey)
        ->and($deliveries->pluck('status')->all())->toBe(['accepted', 'accepted']);

    // Attempt 2: Re-running SendQueuedNotificationJob (idempotency check)
    $queuedJob2 = new SendQueuedNotificationJob($driver, $notification);
    $queuedJob2->handle();

    // No additional HTTP request or delivery created
    Http::assertSentCount(1);
    expect(PushDelivery::query()->where('user_id', $driver->id)->count())->toBe(2);

    // Attempt 3: Direct retry of SendPushNotificationJob with the exact same deduplication key
    $pushPayload = $notification->toPush($driver);
    $pushJobRetry = new SendPushNotificationJob($driver, $pushPayload, $dedupKey, 'dispatch_job', $job->id);
    app()->call([$pushJobRetry, 'handle']);

    // Still no additional HTTP request, still 2 deliveries
    Http::assertSentCount(1);
    expect(PushDelivery::query()->where('user_id', $driver->id)->count())->toBe(2);
});

it('generates distinct push event identities for two successive schedule changes and delivers both to all active devices via SendQueuedNotificationJob', function (): void {
    Http::fake([
        'https://exp.host/--/api/v2/push/send' => Http::response([
            'data' => [
                ['status' => 'ok', 'id' => 'ticket-succ-1'],
                ['status' => 'ok', 'id' => 'ticket-succ-2'],
            ],
        ], 200),
    ]);

    $dispatcher = createPushUser(RoleName::OperationsManager);
    $driver = createPushUser(RoleName::CraneOperator);
    $token1 = registerTestDeviceToken($driver, 'ExponentPushToken[driver-succ-phone]', 'phone-inst-succ');
    $token2 = registerTestDeviceToken($driver, 'ExponentPushToken[driver-succ-tablet]', 'tablet-inst-succ');

    $job = createPushDispatchJob($dispatcher, DispatchStatus::Scheduled);
    $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
        'active_until' => null,
    ]);

    // Update 1: Scheduled start moved to +3h
    $job->update([
        'scheduled_start' => now()->addHours(3),
        'scheduled_end' => now()->addHours(9),
    ]);
    $notif1 = new DispatchScheduleChangeNotification($job, 'Shift moved to 10:00 - 16:00');
    $queuedJob1 = new SendQueuedNotificationJob($driver, $notif1);
    $queuedJob1->handle();

    // Update 2: Scheduled start moved to +6h
    $job->update([
        'scheduled_start' => now()->addHours(6),
        'scheduled_end' => now()->addHours(12),
    ]);
    $notif2 = new DispatchScheduleChangeNotification($job, 'Shift moved to 13:00 - 19:00');
    $queuedJob2 = new SendQueuedNotificationJob($driver, $notif2);
    $queuedJob2->handle();

    // Exactly 2 HTTP calls were made (1 per schedule change update)
    Http::assertSentCount(2);

    // Total 4 delivery records created (2 devices x 2 events)
    $allDeliveries = PushDelivery::query()->where('user_id', $driver->id)->orderBy('id')->get();
    expect($allDeliveries)->toHaveCount(4);

    $update1Deliveries = $allDeliveries->slice(0, 2);
    $update2Deliveries = $allDeliveries->slice(2, 2);

    $dedupKey1 = $update1Deliveries->first()->deduplication_key;
    $dedupKey2 = $update2Deliveries->first()->deduplication_key;

    // Both updates must have distinct event identities
    expect($dedupKey1)->not()->toBeNull()
        ->and($dedupKey2)->not()->toBeNull()
        ->and($dedupKey1)->not()->toBe($dedupKey2);

    // Both updates delivered to both devices
    expect($update1Deliveries->pluck('user_device_token_id')->all())->toEqualCanonicalizing([$token1->id, $token2->id])
        ->and($update2Deliveries->pluck('user_device_token_id')->all())->toEqualCanonicalizing([$token1->id, $token2->id]);
});

it('strictly excludes operator names, locations, and incident details from safety.sos_received lock-screen push and payload', function (): void {
    Queue::fake([SendPushNotificationJob::class]);

    $operator = createPushUser(RoleName::CraneOperator);
    $responder = createPushUser(RoleName::OperationsManager);

    $incident = SosIncident::query()->create([
        'command_id' => (string) Str::uuid(),
        'reporter_id' => $operator->id,
        'category' => SosIncidentCategory::CriticalAssetMalfunction,
        'status' => SosIncidentStatus::Active,
        'latitude' => 14.599512,
        'longitude' => 120.984222,
        'location_label' => 'North Harbor Pier 4 Crane Terminal',
        'worker_note' => 'Boom cable frayed and operator unable to dismount safely',
        'device_activated_at' => now(),
        'received_at' => now(),
        'escalation_due_at' => now()->addMinutes(3),
    ]);

    $recipient = SosIncidentRecipient::query()->create([
        'sos_incident_id' => $incident->id,
        'user_id' => $responder->id,
        'role_at_alert' => 'operations_manager',
        'resolution_reason' => 'operations_manager_fallback',
    ]);

    $delivery = app(DatabaseSosResponderDelivery::class);
    $delivery->deliver($recipient);

    Queue::assertPushed(SendPushNotificationJob::class, function (SendPushNotificationJob $job) use ($operator, $responder, $incident): bool {
        $push = $job->payload;

        // 1. Lock-screen Title: generic and contains no operator name or details
        expect($push->title)->toBe('EMERGENCY SOS ALERT')
            ->and($push->title)->not()->toContain($operator->name);

        // 2. Lock-screen Body: generic and sanitized
        expect($push->body)->toBe('Emergency SOS alert received for active operations.')
            ->and($push->body)->not()->toContain($operator->name)
            ->and($push->body)->not()->toContain('Boom')
            ->and($push->body)->not()->toContain('frayed')
            ->and($push->body)->not()->toContain('Pier 4')
            ->and($push->body)->not()->toContain('14.5995')
            ->and($push->body)->not()->toContain('120.9842');

        // 3. Payload data: strictly scoped identifiers only, zero sensitive location or notes
        expect($push->data)->toMatchArray([
            'event' => 'safety.sos_received',
            'incident_id' => $incident->id,
            'recipient_id' => $responder->id,
            'status' => 'active',
        ]);

        expect($push->data)->not()->toHaveKey('latitude')
            ->and($push->data)->not()->toHaveKey('longitude')
            ->and($push->data)->not()->toHaveKey('location_label')
            ->and($push->data)->not()->toHaveKey('worker_note')
            ->and($push->data)->not()->toHaveKey('note')
            ->and($push->data)->not()->toHaveKey('operator_name')
            ->and($push->data)->not()->toHaveKey('reporter_name')
            ->and($push->data)->not()->toHaveKey('category');

        return true;
    });
});
