<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Http\Exceptions\VersionConflictException;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('returns standardized 401 unauthenticated error with request_id for API requests', function (): void {
    $customRequestId = (string) Str::uuid();

    $response = $this->withHeader('X-Request-Id', $customRequestId)
        ->getJson('/api/v2/dispatch-jobs');

    $response->assertStatus(401)
        ->assertHeader('X-Request-Id', $customRequestId)
        ->assertJson([
            'message' => 'Unauthenticated.',
            'error' => 'unauthenticated',
            'request_id' => $customRequestId,
        ]);
});

it('returns standardized 403 forbidden error with request_id for unauthorized API requests', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('test-token')->plainTextToken;

    // Operator cannot view admin health or access unassigned routes
    Route::middleware(['api', 'auth:sanctum'])->get('/api/test-forbidden', function () {
        abort(403, 'You are not permitted to perform this action.');
    });

    $response = $this->withToken($token)
        ->getJson('/api/test-forbidden');

    $response->assertStatus(403)
        ->assertJson([
            'message' => 'You are not permitted to perform this action.',
            'error' => 'forbidden',
        ])
        ->assertJsonStructure(['request_id']);

    expect($response->headers->get('X-Request-Id'))->toBe($response->json('request_id'));
});

it('returns standardized 404 not found error with request_id for missing API resources', function (): void {
    /** @var User $admin */
    $admin = User::factory()->create(['is_active' => true]);
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $token = $admin->createToken('test-token')->plainTextToken;

    $response = $this->withToken($token)
        ->getJson('/api/v2/dispatch-jobs/999999');

    $response->assertStatus(404)
        ->assertJson([
            'error' => 'not_found',
        ])
        ->assertJsonStructure(['message', 'request_id']);

    expect($response->headers->get('X-Request-Id'))->toBe($response->json('request_id'));
});

it('returns standardized 422 validation failure with error code, errors bag, and request_id', function (): void {
    $response = $this->postJson('/api/v1/auth/login', [
        'password' => '',
    ]);

    $response->assertStatus(422)
        ->assertJson([
            'error' => 'validation_failed',
        ])
        ->assertJsonStructure([
            'message',
            'error',
            'errors',
            'request_id',
        ]);

    expect($response->headers->get('X-Request-Id'))->toBe($response->json('request_id'));
});

it('preserves client-supplied X-Request-Id across errors and responses', function (): void {
    $clientTraceId = 'mobile-trace-'.Str::uuid();

    $response = $this->withHeader('X-Request-Id', $clientTraceId)
        ->getJson('/api/v1/unknown-endpoint');

    $response->assertStatus(404)
        ->assertHeader('X-Request-Id', $clientTraceId)
        ->assertJsonPath('request_id', $clientTraceId);
});

it('catches uncaught 500 exceptions, logs structured context, and masks details in production', function (): void {
    Route::middleware(['api'])->get('/api/test-server-crash', function () {
        throw new RuntimeException('Simulated internal server crash for testing error pipeline.');
    });

    config(['app.debug' => false]);
    Log::spy();

    $response = $this->getJson('/api/test-server-crash');

    $response->assertStatus(500)
        ->assertJson([
            'message' => 'An unexpected server error occurred.',
            'error' => 'internal_server_error',
        ])
        ->assertJsonMissing(['debug'])
        ->assertJsonStructure(['request_id']);

    expect($response->headers->get('X-Request-Id'))->toBe($response->json('request_id'));

    Log::shouldHaveReceived('error')
        ->withArgs(function ($message, $context): bool {
            return str_contains($message, 'Simulated internal server crash')
                && isset($context['request_id'])
                && isset($context['url'])
                && isset($context['method']);
        });
});

it('includes debug diagnostics for 500 errors when app.debug is enabled', function (): void {
    Route::middleware(['api'])->get('/api/test-server-crash-debug', function () {
        throw new RuntimeException('Simulated debug crash.');
    });

    config(['app.debug' => true]);
    Log::spy();

    $response = $this->getJson('/api/test-server-crash-debug');

    $response->assertStatus(500)
        ->assertJson([
            'message' => 'Simulated debug crash.',
            'error' => 'internal_server_error',
        ])
        ->assertJsonStructure([
            'request_id',
            'debug' => ['exception', 'file', 'line'],
        ]);

    Log::shouldHaveReceived('error');
});

it('redirects expired web sessions back with a warning flash message', function (): void {
    Route::middleware(['web'])->post('/test-web-expired', function () {
        throw new TokenMismatchException('CSRF token mismatch.');
    });

    $this->from('/login');

    $response = $this->post('/test-web-expired', [], [
        'X-Inertia' => 'true',
    ]);

    $response->assertRedirect('/login')
        ->assertSessionHas('flash.tone', 'warning')
        ->assertSessionHas('flash.message', 'Your session expired due to inactivity. Please try again.');
});

it('returns standardized 409 conflict error when VersionConflictException is thrown', function (): void {
    Route::middleware(['api'])->get('/api/test-version-conflict', function () {
        throw new VersionConflictException(
            message: 'Stale version detected on resource.',
            currentVersion: 7,
            snapshot: ['id' => 123, 'status' => 'completed'],
        );
    });

    $response = $this->getJson('/api/test-version-conflict');

    $response->assertStatus(409)
        ->assertJson([
            'message' => 'Stale version detected on resource.',
            'error' => 'stale_version',
            'current_version' => 7,
            'data' => ['id' => 123, 'status' => 'completed'],
        ])
        ->assertJsonStructure(['request_id']);

    expect($response->headers->get('X-Request-Id'))->toBe($response->json('request_id'));
});

it('returns standardized 409 conflict error when validation fails on version with positive integer', function (): void {
    Route::middleware(['api'])->post('/api/test-validation-version', function (Request $request) {
        throw ValidationException::withMessages([
            'version' => ['The version is outdated.'],
        ]);
    });

    $response = $this->postJson('/api/test-validation-version', [
        'version' => 4,
    ]);

    $response->assertStatus(409)
        ->assertJson([
            'message' => 'The version is outdated.',
            'error' => 'stale_version',
            'errors' => ['version' => ['The version is outdated.']],
        ])
        ->assertJsonStructure(['request_id']);
});

it('returns standardized 429 rate limit error when throttle exception is thrown', function (): void {
    Route::middleware(['api'])->get('/api/test-throttle', function () {
        throw new TooManyRequestsHttpException(
            retryAfter: 60,
            message: 'Rate limit exceeded for client.',
        );
    });

    $response = $this->getJson('/api/test-throttle');

    $response->assertStatus(429)
        ->assertJson([
            'message' => 'Rate limit exceeded for client.',
            'error' => 'rate_limited',
            'retry_after' => 60,
        ])
        ->assertJsonStructure(['request_id']);
});
