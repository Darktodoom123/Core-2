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
});
