import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { FieldApiClient, ApiClientError } from '../services/apiClient';
import type { DispatchJob } from '../types/index';

describe('FieldApiClient', () => {
    test('includes Bearer token and Idempotency-Key in headers', async () => {
        let capturedHeaders: Record<string, string> = {};

        const mockFetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            capturedHeaders = Object.fromEntries(
                new Headers(init?.headers).entries(),
            );

            return new Response(
                JSON.stringify({
                    data: {
                        id: 1,
                        reference: 'DISP-001',
                        status: { value: 'dispatched', label: 'Dispatched' },
                        version: 1,
                    },
                }),
                { status: 200 },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'test-bearer-token-123',
            fetchFn: mockFetch as any,
        });

        const job = await client.fetchJobDetail(1);
        assert.equal(job.id, 1);
        assert.equal(
            capturedHeaders['authorization'],
            'Bearer test-bearer-token-123',
        );
    });

    test('parses 409 Conflict with stale_version error and server snapshot', async () => {
        const mockServerSnapshot: Partial<DispatchJob> = {
            id: 42,
            reference: 'DISP-042',
            version: 5,
            status: { value: 'working', label: 'Working' },
        };

        const mockFetch = async () => {
            return new Response(
                JSON.stringify({
                    message: 'This dispatch changed on another device.',
                    error: 'stale_version',
                    current_version: 5,
                    data: mockServerSnapshot,
                }),
                { status: 409 },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        try {
            await client.transitionStatus(42, 'working', 4, 'cmd-uuid-1');
            assert.fail('Expected ApiClientError to be thrown');
        } catch (err) {
            assert.ok(err instanceof ApiClientError);
            assert.equal(err.status, 409);
            assert.equal(err.errorCode, 'stale_version');
            assert.equal(err.currentVersion, 5);
            assert.equal((err.serverSnapshot as any).version, 5);
        }
    });

    test('sends the typed SOS activation contract with idempotency headers', async () => {
        let captured: {
            body?: Record<string, unknown>;
            headers?: Headers;
            method?: string;
            url?: string;
        } = {};
        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000/',
            getToken: () => 'token',
            fetchFn: async (input, init) => {
                captured = {
                    body: JSON.parse(String(init?.body)),
                    headers: new Headers(init?.headers),
                    method: init?.method,
                    url: input.toString(),
                };

                return new Response(
                    JSON.stringify({
                        data: {
                            id: 'sos-123',
                            category: 'unclassified',
                            status: 'active',
                            delivery_state: 'delivered',
                            device_activated_at: '2026-08-01T00:00:00.000Z',
                        },
                    }),
                    { status: 201 },
                );
            },
        });

        const incident = await client.activateSosIncident(
            {
                category: 'unclassified',
                device_activated_at: '2026-08-01T00:00:00.000Z',
                dispatch_job_id: 9,
                operational_asset_id: 44,
                location: null,
            },
            'sos-command-123',
        );

        assert.equal(incident.id, 'sos-123');
        assert.equal(captured.method, 'POST');
        assert.equal(
            captured.url,
            'http://localhost:8000/api/v1/sos-incidents',
        );
        assert.equal(captured.body?.command_id, 'sos-command-123');
        assert.equal(captured.body?.dispatch_job_id, 9);
        assert.equal(
            captured.headers?.get('idempotency-key'),
            'sos-command-123',
        );
    });

    test('parses 422 validation failure with errors and request_id', async () => {
        const mockFetch = async () => {
            return new Response(
                JSON.stringify({
                    message: 'The given data was invalid.',
                    error: 'validation_failed',
                    request_id: 'req-uuid-422',
                    errors: {
                        status: ['Status transition is invalid.'],
                    },
                }),
                {
                    status: 422,
                    headers: { 'X-Request-Id': 'req-uuid-422' },
                },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        try {
            await client.transitionStatus(1, 'completed', 1, 'cmd-uuid-422');
            assert.fail('Expected ApiClientError');
        } catch (err) {
            assert.ok(err instanceof ApiClientError);
            assert.equal(err.status, 422);
            assert.equal(err.errorCode, 'validation_failed');
            assert.equal(err.requestId, 'req-uuid-422');
            assert.deepEqual(err.validationErrors, {
                status: ['Status transition is invalid.'],
            });
        }
    });

    test('parses 500 server error and extracts X-Request-Id header when body lacks request_id', async () => {
        const mockFetch = async () => {
            return new Response(
                JSON.stringify({
                    message: 'An unexpected server error occurred.',
                    error: 'internal_server_error',
                }),
                {
                    status: 500,
                    headers: { 'X-Request-Id': 'req-header-fallback' },
                },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        try {
            await client.fetchMe();
            assert.fail('Expected ApiClientError');
        } catch (err) {
            assert.ok(err instanceof ApiClientError);
            assert.equal(err.status, 500);
            assert.equal(err.errorCode, 'internal_server_error');
            assert.equal(err.requestId, 'req-header-fallback');
        }
    });

    test('parses 429 Rate Limited with Retry-After header', async () => {
        const mockFetch = async () => {
            return new Response(
                JSON.stringify({
                    message: 'Too many requests.',
                    error: 'rate_limited',
                }),
                {
                    status: 429,
                    headers: {
                        'Retry-After': '60',
                    },
                },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        try {
            await client.fetchMe();
            assert.fail('Expected ApiClientError');
        } catch (err) {
            assert.ok(err instanceof ApiClientError);
            assert.equal(err.status, 429);
            assert.equal(err.isRateLimited, true);
            assert.equal(err.retryAfter, 60);
            assert.equal(err.errorCode, 'rate_limited');
        }
    });

    test('parses 429 Rate Limited with retry_after in response body', async () => {
        const mockFetch = async () => {
            return new Response(
                JSON.stringify({
                    message: 'Rate limit exceeded.',
                    error: 'rate_limited',
                    retry_after: 45,
                }),
                {
                    status: 429,
                },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        try {
            await client.fetchMe();
            assert.fail('Expected ApiClientError');
        } catch (err) {
            assert.ok(err instanceof ApiClientError);
            assert.equal(err.status, 429);
            assert.equal(err.isRateLimited, true);
            assert.equal(err.retryAfter, 45);
        }
    });

    test('parses 429 Rate Limited when retryAfter is missing or invalid', async () => {
        const mockFetch = async () => {
            return new Response(
                JSON.stringify({
                    message: 'Rate limit exceeded.',
                }),
                {
                    status: 429,
                    headers: {
                        'Retry-After': 'invalid-seconds',
                    },
                },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        try {
            await client.fetchMe();
            assert.fail('Expected ApiClientError');
        } catch (err) {
            assert.ok(err instanceof ApiClientError);
            assert.equal(err.status, 429);
            assert.equal(err.isRateLimited, true);
            assert.equal(err.retryAfter, undefined);
        }
    });

    test('ApiClientError constructor sets isRateLimited for 429 status', () => {
        const rateLimitErr = new ApiClientError('Rate limited', 429);
        assert.equal(rateLimitErr.status, 429);
        assert.equal(rateLimitErr.isRateLimited, true);
        assert.equal(rateLimitErr.retryAfter, undefined);

        const customRetryErr = new ApiClientError('Rate limited', 429, {
            retryAfter: 30,
        });
        assert.equal(customRetryErr.status, 429);
        assert.equal(customRetryErr.isRateLimited, true);
        assert.equal(customRetryErr.retryAfter, 30);

        const serverErr = new ApiClientError('Server error', 500);
        assert.equal(serverErr.status, 500);
        assert.equal(serverErr.isRateLimited, false);
        assert.equal(serverErr.retryAfter, undefined);
    });

    test('fetchLocationWeather returns telemetry from local backend server when available', async () => {
        const mockBackendTelemetry = {
            latitude: 14.5995,
            longitude: 120.9842,
            location_name: 'Manila',
            temperature_celsius: 28.5,
            wind_speed_kmh: 15.2,
            wind_gusts_kmh: 22.1,
            rain_intensity_mmh: 0.0,
            humidity_percent: 75,
            weather_description: 'Clear Sky',
            safety_level: 'safe_normal',
            safety_message: 'Normal Wind: Standard hoisting permitted (< 36 km/h).',
            source: 'open_meteo',
            fetched_at: '2026-09-05T19:00:00Z',
        };

        const mockFetch = async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/api/v1/telemetry/weather')) {
                return new Response(
                    JSON.stringify({ data: mockBackendTelemetry }),
                    { status: 200 },
                );
            }
            throw new Error('Not found');
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        const weather = await client.fetchLocationWeather(14.5995, 120.9842);
        assert.equal(weather.temperature_celsius, 28.5);
        assert.equal(weather.wind_speed_kmh, 15.2);
        assert.equal(weather.safety_level, 'safe_normal');
    });

    test('fetchLocationWeather falls back to direct Open-Meteo when backend is down or times out', async () => {
        const mockOpenMeteoResponse = {
            current: {
                temperature_2m: 29.1,
                relative_humidity_2m: 80,
                precipitation: 0.0,
                weather_code: 0,
                wind_speed_10m: 18.5,
                wind_gusts_10m: 25.0,
            },
        };

        const mockFetch = async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('api.open-meteo.com')) {
                return new Response(
                    JSON.stringify(mockOpenMeteoResponse),
                    { status: 200 },
                );
            }
            // Backend server fails/times out
            throw new Error('Network request failed: Connection refused');
        };

        const client = new FieldApiClient({
            baseUrl: 'http://192.168.254.110:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        const weather = await client.fetchLocationWeather(14.5995, 120.9842);
        assert.equal(weather.temperature_celsius, 29.1);
        assert.equal(weather.wind_speed_kmh, 18.5);
        assert.equal(weather.source, 'open_meteo_direct');
        assert.equal(weather.safety_level, 'safe_normal');
    });
});
