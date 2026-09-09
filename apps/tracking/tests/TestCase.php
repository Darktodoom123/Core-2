<?php

namespace Tracking\Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Testing\TestResponse;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    public function createApplication(): Application
    {
        /** @var Application $app */
        $app = require __DIR__.'/../bootstrap/app.php';

        $app->make(Kernel::class)->bootstrap();

        return $app;
    }

    /**
     * Disable automatic service signature generation for the next request.
     */
    public function withoutServiceSignature(): static
    {
        return $this->withHeader('X-No-Service-Signature', 'true');
    }

    /**
     * Generate canonical HMAC-SHA256 signature headers for service-to-service calls.
     *
     * @param  array<string, mixed>|string  $payload
     * @return array<string, string>
     */
    public function generateSignatureHeaders(
        string $method,
        string $uri,
        array|string $payload = '',
        ?int $timestamp = null,
        ?string $serviceName = 'operations',
        ?string $secret = null,
    ): array {
        $timestamp = $timestamp ?? time();
        $secret = $secret ?? (string) (config('services.tracking.secret') ?: env('TRACKING_SERVICE_SECRET', 'test-tracking-service-secret'));
        $rawBody = is_array($payload) ? (string) json_encode($payload) : (string) $payload;
        $digest = hash('sha256', $rawBody);
        $path = '/'.ltrim((string) parse_url($uri, PHP_URL_PATH), '/');

        $signatureString = strtoupper($method)."\n".$path."\n".$timestamp."\n".$digest;
        $signature = hash_hmac('sha256', $signatureString, $secret);

        $headers = [
            'X-Timestamp' => (string) $timestamp,
            'X-Payload-Digest' => $digest,
            'X-Signature' => $signature,
        ];

        if ($serviceName !== null) {
            $headers['X-Service-Name'] = $serviceName;
        }

        return $headers;
    }

    /**
     * Hook into call() to auto-sign internal microservice requests when headers are omitted.
     *
     * @param  string  $method
     * @param  string  $uri
     * @param  array<string, mixed>  $parameters
     * @param  array<string, mixed>  $cookies
     * @param  array<string, mixed>  $files
     * @param  array<string, mixed>  $server
     * @param  string|null  $content
     */
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null): TestResponse
    {
        $hasCustomSig = isset($server['HTTP_X_SIGNATURE'])
            || isset($this->defaultHeaders['X-Signature'])
            || isset($this->defaultHeaders['HTTP_X_SIGNATURE']);

        $optOut = isset($server['HTTP_X_NO_SERVICE_SIGNATURE'])
            || isset($this->defaultHeaders['X-No-Service-Signature'])
            || isset($this->defaultHeaders['HTTP_X_NO_SERVICE_SIGNATURE']);

        $path = parse_url($uri, PHP_URL_PATH) ?? '';
        $isInternal = str_contains($path, 'internal/v1');

        if ($isInternal && ! $hasCustomSig && ! $optOut) {
            $rawBody = (string) ($content ?? '');
            $signedHeaders = $this->generateSignatureHeaders($method, $uri, $rawBody);

            foreach ($signedHeaders as $headerName => $headerValue) {
                $serverKey = 'HTTP_'.str_replace('-', '_', strtoupper($headerName));
                if (! isset($server[$serverKey]) && ! isset($this->defaultHeaders[$headerName])) {
                    $server[$serverKey] = $headerValue;
                }
            }
        }

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }
}
