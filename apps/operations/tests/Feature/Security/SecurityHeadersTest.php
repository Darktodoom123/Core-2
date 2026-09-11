<?php

use App\Platform\Identity\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('sets required security headers and strips information disclosure headers on web requests', function (): void {
    $response = $this->get(route('login'));

    $response->assertOk();
    $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
    $response->assertHeader('X-Content-Type-Options', 'nosniff');
    $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    $response->assertHeaderMissing('X-Powered-By');
    $response->assertHeaderMissing('Server');
});

it('enforces security headers on authenticated web requests', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('home'));

    $response->assertOk();
    $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
    $response->assertHeader('X-Content-Type-Options', 'nosniff');
    $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    $response->assertHeaderMissing('X-Powered-By');
});

it('enforces security headers on error and 404 responses', function (): void {
    $response = $this->get('/non-existent-page-for-security-test');

    $response->assertNotFound();
    $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
    $response->assertHeader('X-Content-Type-Options', 'nosniff');
    $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    $response->assertHeaderMissing('X-Powered-By');
});

it('enforces security headers and strips information disclosure headers on api requests', function (): void {
    $response = $this->postJson(route('api.v1.auth.login'), [
        'email' => 'invalid@example.com',
        'password' => 'invalid-password',
    ]);

    $response->assertUnprocessable();
    $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
    $response->assertHeader('X-Content-Type-Options', 'nosniff');
    $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    $response->assertHeaderMissing('X-Powered-By');
    $response->assertHeaderMissing('Server');
});

it('applies Strict-Transport-Security header when request is served over HTTPS', function (): void {
    $response = $this->get('https://localhost/login');

    $response->assertOk();
    $response->assertHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

it('attaches Content-Security-Policy when enabled in configuration', function (): void {
    config(['security.csp.enabled' => true]);

    $response = $this->get(route('login'));

    $response->assertOk();
    $csp = (string) $response->headers->get('Content-Security-Policy');
    expect($csp)->not->toBeEmpty()
        ->and($csp)->toContain("default-src 'self'")
        ->and($csp)->toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
        ->and($csp)->toContain("style-src 'self' 'unsafe-inline' https://fonts.bunny.net")
        ->and($csp)->toContain("font-src 'self' data: https://fonts.bunny.net")
        ->and($csp)->toContain("img-src 'self' data: blob: https://*.stadiamaps.com")
        ->and($csp)->toContain("connect-src 'self' ws: wss: http: https: data: blob:")
        ->and($csp)->toContain("worker-src 'self' blob:")
        ->and($csp)->toContain("object-src 'none'")
        ->and($csp)->toContain("frame-ancestors 'self'")
        ->and($csp)->toContain("base-uri 'self'")
        ->and($csp)->toContain("form-action 'self'");
});

it('allows custom Content-Security-Policy overrides via configuration', function (): void {
    $customCsp = "default-src 'self'; script-src 'self' 'nonce-12345'; frame-ancestors 'none';";
    config(['security.headers.content_security_policy' => $customCsp]);

    $response = $this->get(route('login'));

    $response->assertOk();
    $response->assertHeader('Content-Security-Policy', $customCsp);
});

it('allows custom security header value overrides via configuration', function (): void {
    config([
        'security.headers.x_frame_options' => 'DENY',
        'security.headers.referrer_policy' => 'no-referrer',
        'security.headers.permissions_policy' => 'camera=(), microphone=()',
    ]);

    $response = $this->get(route('login'));

    $response->assertOk();
    $response->assertHeader('X-Frame-Options', 'DENY');
    $response->assertHeader('Referrer-Policy', 'no-referrer');
    $response->assertHeader('Permissions-Policy', 'camera=(), microphone=()');
});
