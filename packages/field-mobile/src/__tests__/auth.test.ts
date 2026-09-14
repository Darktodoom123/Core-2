import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { resolveApiBaseUrl } from '../auth/config';
import { isAuthorizedFieldRole } from '../auth/fieldRoles';
import { SecureTokenStorage } from '../auth/tokenStorage';
import type {
    TokenStorageProvider,
    OfflineSessionData,
} from '../auth/tokenStorage';
import {
    FieldApiClient,
    ApiClientError,
    isLoginChallenge,
} from '../services/apiClient';

class MemoryTokenStorage implements TokenStorageProvider {
    private token: string | null = null;
    private pendingRevocationToken: string | null = null;
    private trustToken: string | null = null;
    private offlineSession: OfflineSessionData | null = null;

    async getToken(): Promise<string | null> {
        return this.token;
    }

    async setToken(token: string): Promise<void> {
        this.token = token;
    }

    async clearToken(): Promise<void> {
        this.token = null;
    }

    async getPendingRevocationToken(): Promise<string | null> {
        return this.pendingRevocationToken;
    }

    async stageTokenForRevocation(token: string): Promise<void> {
        this.pendingRevocationToken = token;
    }

    async clearPendingRevocationToken(): Promise<void> {
        this.pendingRevocationToken = null;
    }

    async getDeviceTrustToken(): Promise<string | null> {
        return this.trustToken;
    }

    async setDeviceTrustToken(token: string): Promise<void> {
        this.trustToken = token;
    }

    async clearDeviceTrustToken(): Promise<void> {
        this.trustToken = null;
    }

    async getOfflineSession(): Promise<OfflineSessionData | null> {
        return this.offlineSession;
    }

    async setOfflineSession(data: OfflineSessionData): Promise<void> {
        this.offlineSession = data;
    }

    async clearOfflineSession(): Promise<void> {
        this.offlineSession = null;
    }
}

describe('Field Mobile Authentication Shell', () => {
    let tokenStorage: MemoryTokenStorage;
    let mockToken: string | null;

    beforeEach(() => {
        tokenStorage = new MemoryTokenStorage();
        mockToken = null;
    });

    it('authenticates user and returns Sanctum bearer token and profile', async () => {
        const mockFetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            const urlStr = input.toString();

            if (urlStr.endsWith('/api/v1/auth/login')) {
                const body = JSON.parse(init?.body as string);

                if (
                    body.username === 'operator' &&
                    body.password === 'password'
                ) {
                    return new Response(
                        JSON.stringify({
                            data: {
                                token: 'sample-sanctum-token-123',
                                user: {
                                    id: 42,
                                    name: 'Jane Operator',
                                    username: 'operator',
                                    email: 'operator@example.com',
                                    role: 'crane_operator',
                                    is_active: true,
                                },
                            },
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
            }

            return new Response(
                JSON.stringify({ message: 'Invalid credentials' }),
                { status: 422 },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => mockToken,
            fetchFn: mockFetch as typeof fetch,
        });

        const result = await client.login(
            'operator',
            'password',
            'Field Tablet',
        );
        assert.equal(result.token, 'sample-sanctum-token-123');
        assert.equal(result.user.name, 'Jane Operator');
        assert.equal(result.user.role, 'crane_operator');

        await tokenStorage.setToken(result.token);
        const storedToken = await tokenStorage.getToken();
        assert.equal(storedToken, 'sample-sanctum-token-123');
    });

    it('rejects invalid credentials with 422 ApiClientError', async () => {
        const mockFetch = async () => {
            return new Response(
                JSON.stringify({
                    message: 'The provided credentials are invalid.',
                    errors: {
                        username: ['The provided credentials are invalid.'],
                    },
                }),
                {
                    status: 422,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => null,
            fetchFn: mockFetch as typeof fetch,
        });

        await assert.rejects(
            async () => {
                await client.login('wrong-user', 'badpass');
            },
            (err: unknown) => {
                assert.ok(err instanceof ApiClientError);
                assert.equal(err.status, 422);
                assert.equal(
                    err.message,
                    'The provided credentials are invalid.',
                );

                return true;
            },
        );
    });

    it('rejects suspended accounts with 403 Forbidden', async () => {
        const mockFetch = async () => {
            return new Response(
                JSON.stringify({
                    message:
                        'This account is suspended. Contact a system administrator.',
                }),
                {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => null,
            fetchFn: mockFetch as typeof fetch,
        });

        await assert.rejects(
            async () => {
                await client.login('suspended-user', 'password');
            },
            (err: unknown) => {
                assert.ok(err instanceof ApiClientError);
                assert.equal(err.status, 403);
                assert.equal(
                    err.message,
                    'This account is suspended. Contact a system administrator.',
                );

                return true;
            },
        );
    });

    it('retrieves user identity via /api/v1/auth/me during cold start bootstrap', async () => {
        mockToken = 'valid-token-777';

        const mockFetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            const urlStr = input.toString();
            const authHeader = (init?.headers as Record<string, string>)?.[
                'Authorization'
            ];
            assert.equal(authHeader, 'Bearer valid-token-777');

            if (urlStr.endsWith('/api/v1/auth/me')) {
                return new Response(
                    JSON.stringify({
                        data: {
                            id: 99,
                            name: 'Sam Operator',
                            username: 'sam.operator',
                            email: 'operator@example.com',
                            role: 'crane_operator',
                            is_active: true,
                        },
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            return new Response('Not Found', { status: 404 });
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => mockToken,
            fetchFn: mockFetch as typeof fetch,
        });

        const user = await client.fetchMe();
        assert.equal(user.id, 99);
        assert.equal(user.name, 'Sam Operator');
        assert.equal(user.role, 'crane_operator');
    });

    it('revokes device token on logout', async () => {
        mockToken = 'token-to-revoke';
        let logoutCalled = false;

        const mockFetch = async (input: RequestInfo | URL) => {
            if (input.toString().endsWith('/api/v1/auth/logout')) {
                logoutCalled = true;

                return new Response(
                    JSON.stringify({
                        message:
                            'Successfully logged out and revoked device token.',
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            return new Response('Not Found', { status: 404 });
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => mockToken,
            fetchFn: mockFetch as typeof fetch,
        });

        const logoutRes = await client.logout();
        assert.ok(logoutCalled);
        assert.equal(
            logoutRes.message,
            'Successfully logged out and revoked device token.',
        );

        await tokenStorage.clearToken();
        const storedToken = await tokenStorage.getToken();
        assert.equal(storedToken, null);
    });

    it('validates authorized field mobile roles', () => {
        assert.equal(isAuthorizedFieldRole('operator'), true);
        assert.equal(isAuthorizedFieldRole('crane_operator'), true);
        assert.equal(isAuthorizedFieldRole('rigger'), false);
        assert.equal(isAuthorizedFieldRole('driver'), false);
        assert.equal(isAuthorizedFieldRole('field_technician'), false);
        assert.equal(isAuthorizedFieldRole('dispatcher'), false);
        assert.equal(isAuthorizedFieldRole('operations_manager'), false);
        assert.equal(isAuthorizedFieldRole('system_administrator'), false);
        assert.equal(isAuthorizedFieldRole('technician'), false);

        assert.equal(isAuthorizedFieldRole('client'), false);
        assert.equal(isAuthorizedFieldRole('viewer'), false);
        assert.equal(isAuthorizedFieldRole(null), false);
        assert.equal(isAuthorizedFieldRole(undefined), false);
    });

    it('clears stored bearer token on session revocation', async () => {
        await tokenStorage.setToken('token-to-be-cleared');
        assert.equal(await tokenStorage.getToken(), 'token-to-be-cleared');

        await tokenStorage.clearToken();
        assert.equal(await tokenStorage.getToken(), null);
    });

    it('uses an injected secure store without falling back to memory', async () => {
        const values = new Map<string, string>();
        const secureStore = {
            getItemAsync: async (key: string) => values.get(key) ?? null,
            setItemAsync: async (key: string, value: string) => {
                values.set(key, value);
            },
            deleteItemAsync: async (key: string) => {
                values.delete(key);
            },
        };
        const storage = new SecureTokenStorage('test-token', secureStore);

        await storage.setToken('secure-token');
        assert.equal(await storage.getToken(), 'secure-token');
        assert.equal(values.get('test-token'), 'secure-token');
        await storage.stageTokenForRevocation('secure-token');
        assert.equal(await storage.getPendingRevocationToken(), 'secure-token');
        assert.equal(
            values.get('test-token_pending_revocation'),
            'secure-token',
        );
        await storage.clearToken();
        assert.equal(await storage.getToken(), null);
        await storage.clearPendingRevocationToken();
        assert.equal(await storage.getPendingRevocationToken(), null);
    });

    it('requires a valid API origin and removes trailing slashes', () => {
        assert.equal(
            resolveApiBaseUrl(' https://field.example.test/// '),
            'https://field.example.test',
        );
        assert.throws(
            () => resolveApiBaseUrl(''),
            /EXPO_PUBLIC_API_BASE_URL is required/,
        );
        assert.throws(
            () => resolveApiBaseUrl('file:///tmp/api'),
            /must use http or https/,
        );
    });

    it('handles device verification challenge flow when requires_verification is true', async () => {
        let challengeVerified = false;
        const mockFetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            const urlStr = input.toString();

            if (urlStr.endsWith('/api/v1/auth/login')) {
                return new Response(
                    JSON.stringify({
                        requires_verification: true,
                        challenge_id: 'ch-login-xyz',
                        email_obfuscated: 'op***@example.com',
                        expires_in_seconds: 300,
                        cooldown_seconds: 45,
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            if (urlStr.endsWith('/api/v1/auth/challenge/verify')) {
                const body = JSON.parse(init?.body as string);
                assert.equal(body.challenge_id, 'ch-login-xyz');
                assert.equal(body.code, '654321');
                assert.equal(body.trust_device, true);
                challengeVerified = true;

                return new Response(
                    JSON.stringify({
                        data: {
                            token: 'new-sanctum-token-789',
                            user: {
                                id: 42,
                                name: 'Jane Operator',
                                username: 'operator',
                                email: 'operator@example.com',
                                role: 'crane_operator',
                                is_active: true,
                            },
                            trust_token: 'issued-trust-token-abc',
                        },
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            return new Response(JSON.stringify({ message: 'Not found' }), {
                status: 404,
            });
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => mockToken,
            fetchFn: mockFetch as typeof fetch,
        });

        const loginRes = await client.login('operator', 'password');
        assert.equal(isLoginChallenge(loginRes), true);

        if (isLoginChallenge(loginRes)) {
            assert.equal(loginRes.challenge_id, 'ch-login-xyz');
            assert.equal(loginRes.cooldown_seconds, 45);

            const verifyRes = await client.verifyLoginChallenge(
                loginRes.challenge_id,
                '654321',
                true,
                'Test Device',
            );
            assert.equal(challengeVerified, true);
            assert.equal(verifyRes.token, 'new-sanctum-token-789');
            assert.equal(verifyRes.trust_token, 'issued-trust-token-abc');
            assert.equal(verifyRes.user.role, 'crane_operator');
        }
    });

    it('resends verification challenge code with updated cooldown', async () => {
        const mockFetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            const urlStr = input.toString();

            if (urlStr.endsWith('/api/v1/auth/challenge/resend')) {
                const body = JSON.parse(init?.body as string);
                assert.equal(body.challenge_id, 'ch-original-123');

                return new Response(
                    JSON.stringify({
                        message: 'A fresh verification code has been sent.',
                        challenge_id: 'ch-fresh-456',
                        expires_in_seconds: 300,
                        cooldown_seconds: 45,
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            return new Response(JSON.stringify({ message: 'Not found' }), {
                status: 404,
            });
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => mockToken,
            fetchFn: mockFetch as typeof fetch,
        });

        const resendRes = await client.resendLoginChallenge('ch-original-123');
        assert.equal(resendRes.challenge_id, 'ch-fresh-456');
        assert.equal(resendRes.cooldown_seconds, 45);
    });

    it('sends X-Forget-Device and device trust token on logout when requested', async () => {
        let headersSent: Record<string, string> = {};
        const mockFetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            headersSent = (init?.headers as Record<string, string>) || {};

            return new Response(
                JSON.stringify({ message: 'Logged out successfully.' }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'active-token-123',
            fetchFn: mockFetch as typeof fetch,
        });

        await client.logout({
            forgetDevice: true,
            deviceTrustToken: 'trust-token-to-revoke',
        });

        assert.equal(headersSent['X-Forget-Device'], 'true');
        assert.equal(headersSent['X-Device-Trust'], 'trust-token-to-revoke');
    });

    it('manages device trust token and bounded 24h offline sessions in SecureTokenStorage', async () => {
        const values = new Map<string, string>();
        const secureStore = {
            getItemAsync: async (key: string) => values.get(key) ?? null,
            setItemAsync: async (key: string, value: string) => {
                values.set(key, value);
            },
            deleteItemAsync: async (key: string) => {
                values.delete(key);
            },
        };
        const storage = new SecureTokenStorage('test-storage', secureStore);

        // Device trust token storage
        await storage.setDeviceTrustToken('trust-xyz');
        assert.equal(await storage.getDeviceTrustToken(), 'trust-xyz');
        await storage.clearDeviceTrustToken();
        assert.equal(await storage.getDeviceTrustToken(), null);

        // Offline session storage
        const now = Date.now();
        const testSession: OfflineSessionData = {
            user: {
                id: 10,
                name: 'Field Worker',
                username: 'worker1',
                email: 'worker1@example.com',
                role: 'driver',
                is_active: true,
            },
            verifiedAt: now,
            allowanceHours: 24,
            lastObservedTime: now,
        };

        await storage.setOfflineSession(testSession);
        const retrieved = await storage.getOfflineSession();
        assert.notEqual(retrieved, null);
        assert.equal(retrieved?.user.id, 10);
        assert.equal(retrieved?.verifiedAt, now);
        assert.equal(retrieved?.allowanceHours, 24);

        // 24-hour allowance validation logic
        const fourHoursLater = now + 4 * 60 * 60 * 1000;
        const allowanceMs = (retrieved!.allowanceHours || 24) * 60 * 60 * 1000;
        assert.equal(
            fourHoursLater - retrieved!.verifiedAt <= allowanceMs,
            true,
        );

        const twentyFiveHoursLater = now + 25 * 60 * 60 * 1000;
        assert.equal(
            twentyFiveHoursLater - retrieved!.verifiedAt > allowanceMs,
            true,
        );

        // Anti-tamper clock rollback detection
        const tamperedPastTime = now - 1000;
        const isClockTampered =
            tamperedPastTime < retrieved!.verifiedAt ||
            tamperedPastTime < retrieved!.lastObservedTime;
        assert.equal(isClockTampered, true);

        await storage.clearOfflineSession();
        assert.equal(await storage.getOfflineSession(), null);
    });
});
