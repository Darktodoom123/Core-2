<?php

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tracking\Models\LatestLocation;
use Tracking\Models\LocationSample;

uses(RefreshDatabase::class);

it('accepts valid HMAC-SHA256 signed requests on internal endpoints', function (): void {
    $payload = [
        'command_id' => '00000000-0000-0000-0000-000000000001',
        'user_id' => 101,
        'operational_asset_id' => 202,
        'dispatch_job_id' => 303,
        'latitude' => 14.5995123,
        'longitude' => 120.9842456,
        'accuracy_metres' => 4.5,
        'speed' => 12.8,
        'remarks' => 'Signed test position',
        'source' => 'mobile',
        'sharing_enabled' => true,
        'captured_at' => CarbonImmutable::now()->toIso8601String(),
    ];

    $headers = $this->generateSignatureHeaders('POST', '/internal/v1/locations', $payload);

    $response = $this->withHeaders($headers)
        ->postJson('/internal/v1/locations', $payload);

    $response->assertStatus(201)
        ->assertJsonPath('data.user_id', 101)
        ->assertJsonPath('data.operational_asset_id', 202);

    expect(LocationSample::count())->toBe(1)
        ->and(LatestLocation::count())->toBe(1);
});

it('accepts valid HMAC-SHA256 signed GET requests on internal endpoints', function (): void {
    $headers = $this->generateSignatureHeaders('GET', '/internal/v1/locations/latest', '');

    $response = $this->withHeaders($headers)
        ->getJson('/internal/v1/locations/latest');

    $response->assertOk()
        ->assertJsonStructure(['data']);
});

it('rejects requests with missing X-Service-Name header', function (): void {
    $headers = $this->generateSignatureHeaders('POST', '/internal/v1/locations', ['test' => 'data']);
    unset($headers['X-Service-Name']);

    $response = $this->withHeaders($headers)
        ->postJson('/internal/v1/locations', ['test' => 'data']);

    $response->assertStatus(401)
        ->assertJsonPath('error', 'unauthorized');
});

it('rejects requests with unauthorized X-Service-Name header', function (): void {
    $headers = $this->generateSignatureHeaders(
        'POST',
        '/internal/v1/locations',
        ['test' => 'data'],
        serviceName: 'untrusted-external-service'
    );

    $response = $this->withHeaders($headers)
        ->postJson('/internal/v1/locations', ['test' => 'data']);

    $response->assertStatus(403)
        ->assertJsonPath('error', 'forbidden');
});

it('rejects requests with missing X-Timestamp header', function (): void {
    $headers = $this->generateSignatureHeaders('POST', '/internal/v1/locations', ['test' => 'data']);
    unset($headers['X-Timestamp']);

    $response = $this->withHeaders($headers)
        ->postJson('/internal/v1/locations', ['test' => 'data']);

    $response->assertStatus(401)
        ->assertJsonPath('error', 'unauthorized');
});

it('rejects requests with expired timestamp exceeding 300-second tolerance window', function (): void {
    $expiredTimestamp = time() - 301;
    $headers = $this->generateSignatureHeaders(
        'POST',
        '/internal/v1/locations',
        ['test' => 'data'],
        timestamp: $expiredTimestamp
    );

    $response = $this->withHeaders($headers)
        ->postJson('/internal/v1/locations', ['test' => 'data']);

    $response->assertStatus(401)
        ->assertJsonPath('error', 'unauthorized');
});

it('rejects requests with future timestamp exceeding 300-second tolerance window', function (): void {
    $futureTimestamp = time() + 305;
    $headers = $this->generateSignatureHeaders(
        'POST',
        '/internal/v1/locations',
        ['test' => 'data'],
        timestamp: $futureTimestamp
    );

    $response = $this->withHeaders($headers)
        ->postJson('/internal/v1/locations', ['test' => 'data']);

    $response->assertStatus(401)
        ->assertJsonPath('error', 'unauthorized');
});

it('rejects requests with missing X-Payload-Digest header', function (): void {
    $headers = $this->generateSignatureHeaders('POST', '/internal/v1/locations', ['test' => 'data']);
    unset($headers['X-Payload-Digest']);

    $response = $this->withHeaders($headers)
        ->postJson('/internal/v1/locations', ['test' => 'data']);

    $response->assertStatus(401)
        ->assertJsonPath('error', 'unauthorized');
});

it('rejects requests where payload digest does not match raw request body', function (): void {
    $headers = $this->generateSignatureHeaders('POST', '/internal/v1/locations', ['original' => 'payload']);
    // Tamper the digest to mismatch the body
    $headers['X-Payload-Digest'] = hash('sha256', 'tampered-content');

    $response = $this->withHeaders($headers)
        ->postJson('/internal/v1/locations', ['original' => 'payload']);

    $response->assertStatus(401)
        ->assertJsonPath('error', 'unauthorized');
});

it('rejects requests with missing X-Signature header', function (): void {
    $headers = $this->generateSignatureHeaders('POST', '/internal/v1/locations', ['test' => 'data']);
    unset($headers['X-Signature']);

    $response = $this->withHeaders($headers)
        ->withoutServiceSignature()
        ->postJson('/internal/v1/locations', ['test' => 'data']);

    $response->assertStatus(401)
        ->assertJsonPath('error', 'unauthorized');
});

it('rejects requests with invalid or forged HMAC signature', function (): void {
    $headers = $this->generateSignatureHeaders(
        'POST',
        '/internal/v1/locations',
        ['test' => 'data'],
        secret: 'wrong-secret-key'
    );

    $response = $this->withHeaders($headers)
        ->postJson('/internal/v1/locations', ['test' => 'data']);

    $response->assertStatus(401)
        ->assertJsonPath('error', 'unauthorized');
});

it('rejects requests when payload was altered after signature computation', function (): void {
    $originalPayload = ['user_id' => 101, 'sharing_enabled' => true];
    $headers = $this->generateSignatureHeaders('POST', '/internal/v1/locations', $originalPayload);

    // Send altered payload with the original signature and digest
    $alteredPayload = ['user_id' => 999, 'sharing_enabled' => true];

    $response = $this->withHeaders($headers)
        ->postJson('/internal/v1/locations', $alteredPayload);

    $response->assertStatus(401)
        ->assertJsonPath('error', 'unauthorized');
});

it('rejects completely unsigned requests with no authentication headers', function (): void {
    $response = $this->withoutServiceSignature()
        ->postJson('/internal/v1/locations', ['test' => 'data']);

    $response->assertStatus(401)
        ->assertJsonPath('error', 'unauthorized');
});

it('accepts signed requests with trailing slash normalization', function (): void {
    $headers = $this->generateSignatureHeaders('GET', '/internal/v1/locations/latest', '');

    $response = $this->withHeaders($headers)
        ->getJson('/internal/v1/locations/latest/');

    $response->assertOk()
        ->assertJsonStructure(['data']);
});

it('accepts signed requests routed through api prefix', function (): void {
    $headers = $this->generateSignatureHeaders('GET', '/internal/v1/locations/latest', '');

    $response = $this->withHeaders($headers)
        ->getJson('/api/internal/v1/locations/latest');

    $response->assertOk()
        ->assertJsonStructure(['data']);
});

it('accepts signed GET requests with query parameters', function (): void {
    $headers = $this->generateSignatureHeaders('GET', '/internal/v1/locations', '');

    $response = $this->withHeaders($headers)
        ->getJson('/internal/v1/locations?user_id=101&limit=5');

    $response->assertOk()
        ->assertJsonStructure(['data']);
});
