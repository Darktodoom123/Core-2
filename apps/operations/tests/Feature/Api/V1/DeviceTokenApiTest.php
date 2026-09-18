<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Models\UserDeviceToken;
use App\Platform\Notifications\Models\PushDelivery;
use App\Platform\Safety\Enums\SosIncidentCategory;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Models\SosIncident;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createDeviceTestUser(RoleName $role = RoleName::CraneOperator): array
{
    $user = User::factory()->create([
        'is_active' => true,
        'email_verified_at' => now(),
    ]);
    $user->syncRoles([$role->value]);
    $token = $user->createToken('Mobile Token')->plainTextToken;

    return ['user' => $user, 'token' => $token];
}

it('rejects unauthenticated requests to register device tokens', function (): void {
    $this->postJson('/api/v1/auth/device-tokens', [
        'token' => 'ExponentPushToken[mock-token-123456]',
        'installation_id' => 'device-install-001',
        'platform' => 'android',
    ])->assertStatus(401);
});

it('rejects registration from suspended or inactive accounts', function (): void {
    ['user' => $suspendedUser, 'token' => $token] = createDeviceTestUser();
    $suspendedUser->update([
        'is_active' => false,
        'suspended_at' => now(),
    ]);

    $this->withToken($token)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => 'ExponentPushToken[mock-token-123456]',
            'installation_id' => 'device-install-001',
            'platform' => 'android',
        ])
        ->assertStatus(403);
});

it('validates device token registration payload', function (): void {
    ['user' => $user, 'token' => $token] = createDeviceTestUser();

    // Missing token
    $this->withToken($token)
        ->postJson('/api/v1/auth/device-tokens', [
            'installation_id' => 'device-install-001',
            'platform' => 'android',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['token']);

    // Invalid platform
    $this->withToken($token)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => 'ExponentPushToken[mock-token-123456]',
            'installation_id' => 'device-install-001',
            'platform' => 'windows_phone',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['platform']);
});

it('registers device token and derives user ownership server-side without exposing token', function (): void {
    ['user' => $user, 'token' => $token] = createDeviceTestUser();

    $response = $this->withToken($token)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => 'ExponentPushToken[mock-token-secret-777]',
            'installation_id' => 'device-install-001',
            'platform' => 'android',
            'provider' => 'expo',
            'app_version' => '1.0.0',
        ]);

    $response->assertStatus(200)
        ->assertJson([
            'status' => 'registered',
            'installation_id' => 'device-install-001',
        ]);

    // Token must NOT be echoed in JSON response
    $response->assertJsonMissing(['token' => 'ExponentPushToken[mock-token-secret-777]']);

    $record = UserDeviceToken::query()
        ->where('user_id', $user->id)
        ->where('installation_id', 'device-install-001')
        ->first();

    expect($record)->not()->toBeNull()
        ->and($record->is_active)->toBeTrue()
        ->and($record->token)->toBe('ExponentPushToken[mock-token-secret-777]')
        ->and($record->platform)->toBe('android')
        ->and($record->last_registered_at)->not()->toBeNull();
});

it('rotates device token idempotently for same user and installation', function (): void {
    ['user' => $user, 'token' => $token] = createDeviceTestUser();

    // Initial registration
    $this->withToken($token)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => 'ExponentPushToken[initial-token-111111]',
            'installation_id' => 'device-install-phone',
            'platform' => 'android',
        ])
        ->assertStatus(200);

    expect(UserDeviceToken::query()->where('user_id', $user->id)->count())->toBe(1);

    // Rotated token registration
    $this->withToken($token)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => 'ExponentPushToken[rotated-token-222222]',
            'installation_id' => 'device-install-phone',
            'platform' => 'android',
        ])
        ->assertStatus(200);

    // Should still only have 1 record for this installation, with updated token
    expect(UserDeviceToken::query()->where('user_id', $user->id)->count())->toBe(1);
    $updated = UserDeviceToken::query()->where('user_id', $user->id)->first();
    expect($updated->token)->toBe('ExponentPushToken[rotated-token-222222]')
        ->and($updated->is_active)->toBeTrue();
});

it('supports multiple active devices per user', function (): void {
    ['user' => $user, 'token' => $token] = createDeviceTestUser();

    // Register Phone
    $this->withToken($token)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => 'ExponentPushToken[phone-token-111111]',
            'installation_id' => 'phone-installation-id',
            'platform' => 'android',
        ])
        ->assertStatus(200);

    // Register Tablet
    $this->withToken($token)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => 'ExponentPushToken[tablet-token-222222]',
            'installation_id' => 'tablet-installation-id',
            'platform' => 'android',
        ])
        ->assertStatus(200);

    $activeTokens = UserDeviceToken::query()
        ->where('user_id', $user->id)
        ->where('is_active', true)
        ->get();

    expect($activeTokens)->toHaveCount(2);
});

it('enforces shared-device account switch isolation and revokes previous account registration', function (): void {
    ['user' => $userA, 'token' => $tokenA_auth] = createDeviceTestUser();
    ['user' => $userB, 'token' => $tokenB_auth] = createDeviceTestUser();

    $sharedInstallation = 'shared-crane-cab-tablet';
    $sharedToken = 'ExponentPushToken[shared-tablet-token]';

    // User A registers on tablet
    $this->withToken($tokenA_auth)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => $sharedToken,
            'installation_id' => $sharedInstallation,
            'platform' => 'android',
        ])
        ->assertStatus(200);

    $tokenA = UserDeviceToken::query()
        ->where('user_id', $userA->id)
        ->where('installation_id', $sharedInstallation)
        ->first();
    expect($tokenA->is_active)->toBeTrue();

    // User B signs in on same tablet and registers
    $this->app['auth']->forgetGuards();
    $this->withToken($tokenB_auth)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => $sharedToken,
            'installation_id' => $sharedInstallation,
            'platform' => 'android',
        ])
        ->assertStatus(200);

    // User A's token on this tablet MUST be deactivated
    $tokenA->refresh();
    expect($tokenA->is_active)->toBeFalse()
        ->and($tokenA->revoked_at)->not()->toBeNull();

    // User B's token is active
    $tokenB = UserDeviceToken::query()
        ->where('user_id', $userB->id)
        ->where('installation_id', $sharedInstallation)
        ->first();
    expect($tokenB->is_active)->toBeTrue();
});

it('revokes device token on logout and prevents stale cleanup from revoking newer account registration', function (): void {
    ['user' => $userA, 'token' => $tokenA_auth] = createDeviceTestUser();
    ['user' => $userB, 'token' => $tokenB_auth] = createDeviceTestUser();
    $sharedInstallation = 'rugged-handheld-01';

    // User A registers
    $this->withToken($tokenA_auth)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => 'ExponentPushToken[handheld-token-111]',
            'installation_id' => $sharedInstallation,
            'platform' => 'android',
        ])
        ->assertStatus(200);

    // User B registers on same device
    $this->app['auth']->forgetGuards();
    $this->withToken($tokenB_auth)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => 'ExponentPushToken[handheld-token-222]',
            'installation_id' => $sharedInstallation,
            'platform' => 'android',
        ])
        ->assertStatus(200);

    // Stale logout cleanup request from User A arrives later
    $this->app['auth']->forgetGuards();
    $this->withToken($tokenA_auth)
        ->deleteJson('/api/v1/auth/device-tokens', [
            'installation_id' => $sharedInstallation,
        ])
        ->assertStatus(200);

    // User B's token MUST NOT be revoked by User A's stale cleanup!
    $tokenB = UserDeviceToken::query()
        ->where('user_id', $userB->id)
        ->where('installation_id', $sharedInstallation)
        ->first();
    expect($tokenB->is_active)->toBeTrue();
});

it('revokes device token during logout when installation_id is passed', function (): void {
    ['user' => $user, 'token' => $token] = createDeviceTestUser();
    $installationId = 'my-personal-phone';

    $this->withToken($token)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => 'ExponentPushToken[my-phone-token-999]',
            'installation_id' => $installationId,
            'platform' => 'android',
        ])
        ->assertStatus(200);

    $tokenRecord = UserDeviceToken::query()
        ->where('user_id', $user->id)
        ->where('installation_id', $installationId)
        ->first();
    expect($tokenRecord->is_active)->toBeTrue();

    // Logout with installation_id
    $this->withToken($token)
        ->postJson('/api/v1/auth/logout', [
            'installation_id' => $installationId,
        ])
        ->assertStatus(200);

    $tokenRecord->refresh();
    expect($tokenRecord->is_active)->toBeFalse()
        ->and($tokenRecord->revoked_at)->not()->toBeNull();
});

it('protects newer re-registration by the same user when a stale offline logout supplies the older token', function (): void {
    ['user' => $user, 'token' => $authToken] = createDeviceTestUser();
    $installationId = 'rugged-tablet-01';

    // Step 1: User registers token-1
    $this->withToken($authToken)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => 'ExponentPushToken[old-session-token-111]',
            'installation_id' => $installationId,
            'platform' => 'android',
        ])
        ->assertStatus(200);

    // Step 2: User re-registers with rotated token-2 (e.g. new login)
    $this->withToken($authToken)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => 'ExponentPushToken[new-session-token-222]',
            'installation_id' => $installationId,
            'platform' => 'android',
        ])
        ->assertStatus(200);

    // Step 3: Delayed offline logout revocation request arrives with the old token
    $this->withToken($authToken)
        ->deleteJson('/api/v1/auth/device-tokens', [
            'installation_id' => $installationId,
            'token' => 'ExponentPushToken[old-session-token-111]',
        ])
        ->assertStatus(200);

    // The newer token must still be active!
    $newToken = UserDeviceToken::query()
        ->where('user_id', $user->id)
        ->where('installation_id', $installationId)
        ->first();

    expect($newToken->token)->toBe('ExponentPushToken[new-session-token-222]')
        ->and($newToken->is_active)->toBeTrue();
});

it('records push notification opened event via authenticated API', function (): void {
    ['user' => $user, 'token' => $authToken] = createDeviceTestUser();

    $delivery = PushDelivery::query()->create([
        'user_id' => $user->id,
        'ticket_id' => 'ticket-uuid-open-test-123',
        'event' => 'dispatch.assigned',
        'status' => PushDelivery::STATUS_ACCEPTED,
        'sent_at' => now()->subMinute(),
        'provider' => 'expo',
    ]);

    expect($delivery->opened_at)->toBeNull()
        ->and($delivery->status)->toBe(PushDelivery::STATUS_ACCEPTED);

    $this->withToken($authToken)
        ->postJson('/api/v1/push-deliveries/opened', [
            'ticket_id' => 'ticket-uuid-open-test-123',
        ])
        ->assertStatus(200)
        ->assertJson(['status' => 'acknowledged']);

    $delivery->refresh();
    expect($delivery->status)->toBe(PushDelivery::STATUS_OPENED)
        ->and($delivery->opened_at)->not()->toBeNull();
});

it('rejects recording push opened if delivery belongs to a different user', function (): void {
    ['user' => $userA, 'token' => $tokenA] = createDeviceTestUser();
    ['user' => $userB] = createDeviceTestUser();

    PushDelivery::query()->create([
        'user_id' => $userB->id,
        'ticket_id' => 'ticket-user-b-secret',
        'event' => 'dispatch.assigned',
        'status' => PushDelivery::STATUS_ACCEPTED,
        'sent_at' => now()->subMinute(),
        'provider' => 'expo',
    ]);

    $this->withToken($tokenA)
        ->postJson('/api/v1/push-deliveries/opened', [
            'ticket_id' => 'ticket-user-b-secret',
        ])
        ->assertStatus(403);
});

it('rejects recording push opened by delivery_id if delivery belongs to a different user', function (): void {
    ['user' => $userA] = createDeviceTestUser();
    ['token' => $tokenB] = createDeviceTestUser();

    $delivery = PushDelivery::query()->create([
        'user_id' => $userA->id,
        'ticket_id' => 'ticket-delivery-id-secret',
        'event' => 'dispatch.assigned',
        'status' => PushDelivery::STATUS_ACCEPTED,
        'sent_at' => now()->subMinute(),
        'provider' => 'expo',
    ]);

    $this->withToken($tokenB)
        ->postJson('/api/v1/push-deliveries/opened', [
            'delivery_id' => $delivery->id,
        ])
        ->assertStatus(403);

    expect($delivery->fresh()->opened_at)->toBeNull();
});

it('records push opened by delivery_id for owner', function (): void {
    ['user' => $user, 'token' => $token] = createDeviceTestUser();

    $delivery = PushDelivery::query()->create([
        'user_id' => $user->id,
        'ticket_id' => 'ticket-delivery-id-owner',
        'event' => 'dispatch.assigned',
        'status' => PushDelivery::STATUS_ACCEPTED,
        'sent_at' => now()->subMinute(),
        'provider' => 'expo',
    ]);

    $this->withToken($token)
        ->postJson('/api/v1/push-deliveries/opened', [
            'delivery_id' => $delivery->id,
        ])
        ->assertStatus(200)
        ->assertJson([
            'status' => 'acknowledged',
        ]);

    expect($delivery->fresh()->opened_at)->not()->toBeNull()
        ->and($delivery->fresh()->status)->toBe(PushDelivery::STATUS_OPENED);
});

it('returns 404 when recording push opened for non-existent ticket or delivery', function (): void {
    ['user' => $user, 'token' => $token] = createDeviceTestUser();

    $this->withToken($token)
        ->postJson('/api/v1/push-deliveries/opened', [
            'ticket_id' => 'ticket-does-not-exist',
        ])
        ->assertStatus(404);
});

it('protects active registration when delayed revocation has older registered_before cutoff', function (): void {
    ['user' => $user, 'token' => $token] = createDeviceTestUser();
    $installationId = 'rugged-tablet-race-test';

    // Current registration timestamp
    $this->withToken($token)
        ->postJson('/api/v1/auth/device-tokens', [
            'token' => 'ExponentPushToken[fresh-active-token]',
            'installation_id' => $installationId,
            'platform' => 'android',
        ])
        ->assertStatus(200);

    // Stale delayed revocation arrives from offline queue with cutoff older than registration
    $this->withToken($token)
        ->deleteJson('/api/v1/auth/device-tokens', [
            'installation_id' => $installationId,
            'registered_before' => now()->subMinutes(5)->toIso8601String(),
        ])
        ->assertStatus(200);

    $deviceRecord = UserDeviceToken::query()
        ->where('user_id', $user->id)
        ->where('installation_id', $installationId)
        ->first();

    expect($deviceRecord)->not()->toBeNull()
        ->and($deviceRecord->is_active)->toBeTrue();
});

it('allows authorized responder to view SOS incident details via GET /api/v1/sos-incidents/{id}', function (): void {
    ['user' => $worker] = createDeviceTestUser(RoleName::CraneOperator);
    ['user' => $dispatcher, 'token' => $dispatcherToken] = createDeviceTestUser(RoleName::OperationsManager);

    $incident = SosIncident::query()->create([
        'command_id' => (string) Str::uuid(),
        'reporter_id' => $worker->id,
        'category' => SosIncidentCategory::CriticalAssetMalfunction,
        'status' => SosIncidentStatus::Active,
        'device_activated_at' => now()->subMinutes(2),
        'received_at' => now()->subMinutes(2),
        'escalation_due_at' => now()->addMinutes(3),
        'worker_note' => 'Hydraulic line pressure drop on crane CRN-101',
    ]);

    $response = $this->withToken($dispatcherToken)
        ->getJson("/api/v1/sos-incidents/{$incident->id}")
        ->assertStatus(200);

    $response->assertJsonPath('data.id', $incident->id)
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.category', 'critical_asset_malfunction')
        ->assertJsonPath('data.reporter.id', $worker->id)
        ->assertJsonPath('data.reporter.name', $worker->name);
});

it('rejects unauthorized user from viewing SOS incident via GET /api/v1/sos-incidents/{id}', function (): void {
    ['user' => $worker] = createDeviceTestUser(RoleName::CraneOperator);
    ['user' => $unrelatedWorker, 'token' => $unrelatedToken] = createDeviceTestUser(RoleName::CraneOperator);

    $incident = SosIncident::query()->create([
        'command_id' => (string) Str::uuid(),
        'reporter_id' => $worker->id,
        'category' => SosIncidentCategory::OtherImmediateDanger,
        'status' => SosIncidentStatus::Active,
        'device_activated_at' => now()->subMinutes(2),
        'received_at' => now()->subMinutes(2),
        'escalation_due_at' => now()->addMinutes(3),
    ]);

    $this->withToken($unrelatedToken)
        ->getJson("/api/v1/sos-incidents/{$incident->id}")
        ->assertStatus(403);
});

it('returns 404 for non-existent SOS incident via GET /api/v1/sos-incidents/{id}', function (): void {
    ['token' => $dispatcherToken] = createDeviceTestUser(RoleName::OperationsManager);

    $this->withToken($dispatcherToken)
        ->getJson('/api/v1/sos-incidents/non-existent-incident-uuid')
        ->assertStatus(404);
});
