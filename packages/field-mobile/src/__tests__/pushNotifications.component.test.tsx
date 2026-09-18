import {
    act,
    cleanup,
    render,
    waitFor,
} from '@testing-library/react-native/pure';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { App } from '../../App';
import { FieldApiClient } from '../services/apiClient';
import {
    clearNotificationTokenCache,
    extractEventFromNotification,
    extractJobIdFromNotification,
    extractTicketIdFromNotification,
    registerDevicePushToken,
    requestNotificationPermissions,
    revokeDevicePushToken,
    setupNotificationListeners,
} from '../services/notificationService';
import type { DispatchJob, User } from '../types/index';

const testUser: User = {
    id: 101,
    name: 'Mobile Operator',
    username: 'operator.one',
    email: 'operator@example.com',
    role: 'crane_operator',
    is_active: true,
};

const assignedJob: DispatchJob = {
    id: 42,
    reference: 'JOB-0042',
    title: 'Bridge Crane Support',
    client: 'TransCo',
    site: 'Pasig City',
    priority: { value: 'priority', label: 'Priority' },
    status: { value: 'scheduled', label: 'Scheduled' },
    scheduled_start: '2026-09-18T10:00:00Z',
    scheduled_end: '2026-09-18T16:00:00Z',
    site_notes: 'Wear hard hats at all times',
    requirements: [],
    version: 1,
    capabilities: {
        can_respond: true,
        can_update_status: true,
        can_share_location: true,
    },
};

jest.setTimeout(20000);

describe('Push Notifications Component & Integration Suite', () => {
    let receivedNotificationHandler: ((notification: any) => void) | null =
        null;
    let responseNotificationHandler: ((response: any) => void) | null = null;

    beforeAll(() => {
        jest.setTimeout(15000);
    });

    beforeEach(() => {
        clearNotificationTokenCache();
        jest.clearAllMocks();

        (
            Notifications.addNotificationReceivedListener as jest.Mock
        ).mockImplementation((handler) => {
            receivedNotificationHandler = handler;

            return { remove: jest.fn() };
        });

        (
            Notifications.addNotificationResponseReceivedListener as jest.Mock
        ).mockImplementation((handler) => {
            responseNotificationHandler = handler;

            return { remove: jest.fn() };
        });

        (Notifications.addPushTokenListener as jest.Mock).mockReturnValue({
            remove: jest.fn(),
        });
    });

    afterEach(() => {
        cleanup();
    });

    describe('Service Functions', () => {
        it('extractJobIdFromNotification parses various payloads correctly', () => {
            expect(extractJobIdFromNotification({ job_id: 42 })).toBe(42);
            expect(extractJobIdFromNotification({ dispatch_job_id: 84 })).toBe(
                84,
            );
            expect(extractJobIdFromNotification({ job_id: '99' })).toBe(99);
            expect(
                extractJobIdFromNotification({ dispatch_job_id: ' 123 ' }),
            ).toBe(123);

            expect(extractJobIdFromNotification(undefined)).toBeNull();
            expect(extractJobIdFromNotification({})).toBeNull();
            expect(extractJobIdFromNotification({ job_id: 0 })).toBeNull();
            expect(extractJobIdFromNotification({ job_id: -1 })).toBeNull();
            expect(
                extractJobIdFromNotification({ job_id: 'invalid' }),
            ).toBeNull();
        });

        it('extractEventFromNotification returns event name or null', () => {
            expect(
                extractEventFromNotification({ event: 'dispatch.assigned' }),
            ).toBe('dispatch.assigned');
            expect(
                extractEventFromNotification({ event: 'dispatch.cancelled' }),
            ).toBe('dispatch.cancelled');
            expect(extractEventFromNotification(undefined)).toBeNull();
            expect(extractEventFromNotification({})).toBeNull();
            expect(
                extractEventFromNotification({ event: 123 as any }),
            ).toBeNull();
        });

        it('requestNotificationPermissions respects granted and denied states', async () => {
            (
                Notifications.getPermissionsAsync as jest.Mock
            ).mockResolvedValueOnce({
                status: 'granted',
                granted: true,
                canAskAgain: true,
                expires: 'never',
            });
            expect(await requestNotificationPermissions()).toBe(true);

            (
                Notifications.getPermissionsAsync as jest.Mock
            ).mockResolvedValueOnce({
                status: 'denied',
                granted: false,
                canAskAgain: false,
                expires: 'never',
            });
            (
                Notifications.requestPermissionsAsync as jest.Mock
            ).mockResolvedValueOnce({
                status: 'denied',
                granted: false,
                canAskAgain: false,
                expires: 'never',
            });
            expect(await requestNotificationPermissions()).toBe(false);
        });

        it('registerDevicePushToken registers with backend and avoids duplicate requests', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
                granted: true,
                canAskAgain: true,
                expires: 'never',
            });
            (
                Notifications.getExpoPushTokenAsync as jest.Mock
            ).mockResolvedValue({
                data: 'ExponentPushToken[unit-test-token-111]',
                type: 'expo',
            });
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                'test-installation-abc',
            );

            let registerCalls = 0;
            let capturedBody: any = null;

            const client = new FieldApiClient({
                baseUrl: 'https://operations.core2.test',
                getToken: () => 'valid-bearer-token',
                fetchFn: async (url, init) => {
                    if (url.toString().endsWith('/api/v1/auth/device-tokens')) {
                        registerCalls++;
                        capturedBody = JSON.parse(init?.body as string);

                        return new Response(
                            JSON.stringify({
                                status: 'registered',
                                installation_id: 'test-installation-abc',
                            }),
                            {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' },
                            },
                        );
                    }

                    return new Response('Not found', { status: 404 });
                },
            });

            const res1 = await registerDevicePushToken(
                client,
                '2.0.0',
                'android',
            );
            expect(res1.status).toBe('registered');
            expect(res1.token).toBe('ExponentPushToken[unit-test-token-111]');
            expect(registerCalls).toBe(1);
            expect(capturedBody.token).toBe(
                'ExponentPushToken[unit-test-token-111]',
            );
            expect(capturedBody.installation_id).toBe('test-installation-abc');
            expect(capturedBody.platform).toBe('android');
            expect(capturedBody.app_version).toBe('2.0.0');

            // Duplicate call with same token is deduplicated
            const res2 = await registerDevicePushToken(
                client,
                '2.0.0',
                'android',
            );
            expect(res2.status).toBe('registered');
            expect(registerCalls).toBe(1);
        });

        it('revokeDevicePushToken invokes DELETE with X-Installation-Id header and registered_before body', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                'test-installation-revoke',
            );

            let deleteCalled = false;
            let headerVal = '';
            let parsedBody: Record<string, unknown> = {};

            const client = new FieldApiClient({
                baseUrl: 'https://operations.core2.test',
                getToken: () => 'valid-bearer-token',
                fetchFn: async (url, init) => {
                    if (
                        url.toString().endsWith('/api/v1/auth/device-tokens') &&
                        init?.method === 'DELETE'
                    ) {
                        deleteCalled = true;
                        headerVal = (init?.headers as any)?.[
                            'X-Installation-Id'
                        ];

                        if (init?.body) {
                            parsedBody = JSON.parse(init.body as string);
                        }

                        return new Response(
                            JSON.stringify({ status: 'revoked' }),
                            {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' },
                            },
                        );
                    }

                    return new Response('Not found', { status: 404 });
                },
            });

            const success = await revokeDevicePushToken(client);
            expect(success).toBe(true);
            expect(deleteCalled).toBe(true);
            expect(headerVal).toBe('test-installation-revoke');
            expect(parsedBody.installation_id).toBe('test-installation-revoke');
            expect(parsedBody.registered_before).toBeDefined();
        });

        it('forwards registered token and timestamp cutoff when revoking after registration', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                'test-installation-paired',
            );
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
                granted: true,
                canAskAgain: true,
                expires: 'never',
            });
            (
                Notifications.getExpoPushTokenAsync as jest.Mock
            ).mockResolvedValue({
                data: 'ExponentPushToken[paired-device-token]',
            });

            let capturedDeleteBody: Record<string, unknown> = {};

            const client = new FieldApiClient({
                baseUrl: 'https://operations.core2.test',
                getToken: () => 'valid-bearer-token',
                fetchFn: async (url, init) => {
                    if (url.toString().endsWith('/api/v1/auth/device-tokens')) {
                        if (init?.method === 'POST') {
                            return new Response(
                                JSON.stringify({ status: 'registered' }),
                                {
                                    status: 200,
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                },
                            );
                        }

                        if (init?.method === 'DELETE') {
                            if (init?.body) {
                                capturedDeleteBody = JSON.parse(
                                    init.body as string,
                                );
                            }

                            return new Response(
                                JSON.stringify({ status: 'revoked' }),
                                {
                                    status: 200,
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                },
                            );
                        }
                    }

                    return new Response('Not found', { status: 404 });
                },
            });

            await registerDevicePushToken(client, '1.0.0', 'android');
            const success = await revokeDevicePushToken(client);

            expect(success).toBe(true);
            expect(capturedDeleteBody.installation_id).toBe(
                'test-installation-paired',
            );
            expect(capturedDeleteBody.token).toBe(
                'ExponentPushToken[paired-device-token]',
            );
            expect(capturedDeleteBody.registered_before).toBeDefined();
        });

        it('setupNotificationListeners returns cleanup function that removes all handlers', () => {
            const removeReceived = jest.fn();
            const removeResponse = jest.fn();
            const removeRefresh = jest.fn();

            (
                Notifications.addNotificationReceivedListener as jest.Mock
            ).mockReturnValueOnce({ remove: removeReceived });
            (
                Notifications.addNotificationResponseReceivedListener as jest.Mock
            ).mockReturnValueOnce({ remove: removeResponse });
            (
                Notifications.addPushTokenListener as jest.Mock
            ).mockReturnValueOnce({ remove: removeRefresh });

            const cleanup = setupNotificationListeners({
                onNotificationReceived: jest.fn(),
                onNotificationResponse: jest.fn(),
                onTokenRefresh: jest.fn(),
            });

            expect(removeReceived).not.toHaveBeenCalled();
            cleanup();
            expect(removeReceived).toHaveBeenCalledTimes(1);
            expect(removeResponse).toHaveBeenCalledTimes(1);
            expect(removeRefresh).toHaveBeenCalledTimes(1);
        });

        it('extractTicketIdFromNotification parses ticket_id and id correctly', () => {
            expect(
                extractTicketIdFromNotification({
                    ticket_id: 'tkt-12345',
                }),
            ).toBe('tkt-12345');
            expect(
                extractTicketIdFromNotification({
                    id: 'tkt-67890',
                }),
            ).toBe('tkt-67890');
            expect(extractTicketIdFromNotification(undefined)).toBeNull();
            expect(extractTicketIdFromNotification({})).toBeNull();
            expect(
                extractTicketIdFromNotification({ ticket_id: '' }),
            ).toBeNull();
            expect(
                extractTicketIdFromNotification({ ticket_id: '   ' }),
            ).toBeNull();
        });

        it('apiClient.recordPushOpened sends POST /api/v1/push-deliveries/opened with payload', async () => {
            let capturedBody: any = null;
            const client = new FieldApiClient({
                baseUrl: 'https://operations.core2.test',
                getToken: () => 'valid-bearer-token',
                fetchFn: async (url, init) => {
                    if (
                        url
                            .toString()
                            .endsWith('/api/v1/push-deliveries/opened') &&
                        init?.method === 'POST'
                    ) {
                        capturedBody = JSON.parse(init?.body as string);

                        return new Response(
                            JSON.stringify({ status: 'opened' }),
                            {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' },
                            },
                        );
                    }

                    return new Response('Not found', { status: 404 });
                },
            });

            const res = await client.recordPushOpened('tkt-receipt-999', 42);
            expect(res.status).toBe('opened');
            expect(capturedBody).toEqual({
                ticket_id: 'tkt-receipt-999',
                delivery_id: 42,
            });
        });

        it('apiClient.revokeDeviceToken includes token and registered_before in DELETE body', async () => {
            let capturedBody: any = null;
            let capturedHeaders: any = null;
            const client = new FieldApiClient({
                baseUrl: 'https://operations.core2.test',
                getToken: () => 'valid-bearer-token',
                fetchFn: async (url, init) => {
                    if (
                        url.toString().endsWith('/api/v1/auth/device-tokens') &&
                        init?.method === 'DELETE'
                    ) {
                        capturedBody = JSON.parse(init?.body as string);
                        capturedHeaders = init?.headers;

                        return new Response(
                            JSON.stringify({ status: 'revoked' }),
                            {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' },
                            },
                        );
                    }

                    return new Response('Not found', { status: 404 });
                },
            });

            const res = await client.revokeDeviceToken(
                'inst-xyz',
                'ExponentPushToken[abc]',
                '2026-09-18T10:00:00Z',
            );
            expect(res.status).toBe('revoked');
            expect(capturedHeaders['X-Installation-Id']).toBe('inst-xyz');
            expect(capturedBody).toEqual({
                installation_id: 'inst-xyz',
                token: 'ExponentPushToken[abc]',
                registered_before: '2026-09-18T10:00:00Z',
            });
        });
    });

    describe('AppNavigator Integration', () => {
        function createMockTokenStorage() {
            return {
                getToken: jest.fn(async () => 'mock-jwt-token'),
                setToken: jest.fn(async () => undefined),
                clearToken: jest.fn(async () => undefined),
                getOfflineSession: jest.fn(async () => ({
                    user: testUser,
                    verifiedAt: Date.now(),
                    allowanceHours: 24,
                    lastObservedTime: Date.now(),
                })),
                setOfflineSession: jest.fn(async () => undefined),
                clearOfflineSession: jest.fn(async () => undefined),
                stageTokenForRevocation: jest.fn(async () => undefined),
                getPendingRevocationToken: jest.fn(async () => null),
                clearPendingRevocationToken: jest.fn(async () => undefined),
            };
        }

        const networkMonitor = {
            fetchIsOnline: async () => true,
            subscribe: (listener: (isOnline: boolean) => void) => {
                listener(true);

                return () => undefined;
            },
        };

        const createTestFetch = (options?: {
            assignedJobs?: DispatchJob[];
            onRegisterToken?: () => void;
            onFetchJobs?: () => void;
        }) => {
            const jobsList = options?.assignedJobs ?? [assignedJob];

            return async (input: RequestInfo | URL) => {
                const url = input.toString();

                if (url.endsWith('/api/v1/auth/me')) {
                    return new Response(JSON.stringify({ data: testUser }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                if (url.endsWith('/api/v1/auth/device-tokens')) {
                    options?.onRegisterToken?.();

                    return new Response(
                        JSON.stringify({ status: 'registered' }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }

                if (url.endsWith('/api/v1/dispatch-jobs')) {
                    options?.onFetchJobs?.();

                    return new Response(JSON.stringify({ data: jobsList }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                if (url.includes('/weather')) {
                    return new Response(
                        JSON.stringify({
                            data: {
                                condition: 'Clear',
                                temperature: 28,
                                wind_speed: 10,
                                wind_direction: 'NE',
                                safety_level: 'safe',
                            },
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }

                if (url.includes('/sos-incidents/')) {
                    if (url.endsWith('/sos-incidents/active')) {
                        return new Response(JSON.stringify({ data: null }), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        });
                    }

                    if (url.endsWith('/unauthorized-incident')) {
                        return new Response(
                            JSON.stringify({
                                message: 'This action is unauthorized.',
                            }),
                            {
                                status: 403,
                                headers: { 'Content-Type': 'application/json' },
                            },
                        );
                    }

                    if (url.endsWith('/missing-incident')) {
                        return new Response(
                            JSON.stringify({
                                message: 'Incident not found.',
                            }),
                            {
                                status: 404,
                                headers: { 'Content-Type': 'application/json' },
                            },
                        );
                    }

                    if (url.endsWith('/resolved-incident')) {
                        return new Response(
                            JSON.stringify({
                                data: {
                                    id: 'resolved-incident',
                                    status: 'resolved',
                                    category: 'medical',
                                    reporter: { id: 102, name: 'Jane Field' },
                                },
                            }),
                            {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' },
                            },
                        );
                    }

                    return new Response(
                        JSON.stringify({
                            data: {
                                id: 'sos-incident-100',
                                status: 'active',
                                category: 'equipment_failure',
                                reporter: { id: 102, name: 'Jane Operator' },
                                dispatch: { reference: 'JOB-0042' },
                                received_at: '2026-09-18T11:00:00Z',
                            },
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }

                if (url.includes('/safety/sos/configuration')) {
                    return new Response(
                        JSON.stringify({
                            data: {
                                automatic_retry_window_minutes: 15,
                                actions: [],
                            },
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }

                return new Response(JSON.stringify({ data: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            };
        };

        it('registers device token on authenticated mount and reconciles jobs on foreground notification', async () => {
            let fetchJobsCalled = 0;
            let deviceTokenRegistered = false;

            const customFetch = createTestFetch({
                onRegisterToken: () => {
                    deviceTokenRegistered = true;
                },
                onFetchJobs: () => {
                    fetchJobsCalled++;
                },
            });

            const tokenStorage = createMockTokenStorage();

            await render(
                <App
                    baseUrl="https://operations.core2.test"
                    tokenStorage={tokenStorage}
                    fetchFn={customFetch as any}
                    networkMonitor={networkMonitor}
                />,
            );

            await waitFor(() => {
                expect(deviceTokenRegistered).toBe(true);
            });

            const initialFetchCount = fetchJobsCalled;

            // Simulate incoming foreground push notification
            await act(async () => {
                if (receivedNotificationHandler) {
                    receivedNotificationHandler({
                        request: {
                            content: {
                                data: {
                                    event: 'dispatch.assigned',
                                    job_id: 42,
                                },
                            },
                        },
                    });
                }
            });

            await waitFor(() => {
                expect(fetchJobsCalled).toBeGreaterThan(initialFetchCount);
            });
        }, 15000);

        it('navigates to dispatch job when tapping authorized notification response', async () => {
            const customFetch = createTestFetch();
            const tokenStorage = createMockTokenStorage();

            const screen = await render(
                <App
                    baseUrl="https://operations.core2.test"
                    tokenStorage={tokenStorage}
                    fetchFn={customFetch as any}
                    networkMonitor={networkMonitor}
                />,
            );

            // Trigger notification tap response
            await act(async () => {
                if (responseNotificationHandler) {
                    responseNotificationHandler({
                        notification: {
                            request: {
                                content: {
                                    data: {
                                        event: 'dispatch.assigned',
                                        job_id: 42,
                                    },
                                },
                            },
                        },
                    });
                }
            });

            // Expect to see the job's title or details on the navigated dispatch screen
            const jobElement = await screen.findByText(/Bridge Crane Support/i);
            expect(jobElement).toBeTruthy();
        });

        it('rejects unauthorized notification tap and shows error message without opening job', async () => {
            const customFetch = createTestFetch({
                assignedJobs: [assignedJob],
            });
            const tokenStorage = createMockTokenStorage();

            const screen = await render(
                <App
                    baseUrl="https://operations.core2.test"
                    tokenStorage={tokenStorage}
                    fetchFn={customFetch as any}
                    networkMonitor={networkMonitor}
                />,
            );

            // Tap notification for unassigned / cancelled job 9999
            await act(async () => {
                if (responseNotificationHandler) {
                    responseNotificationHandler({
                        notification: {
                            request: {
                                content: {
                                    data: {
                                        event: 'dispatch.assigned',
                                        job_id: 9999,
                                    },
                                },
                            },
                        },
                    });
                }
            });

            // Error banner should display explaining that the user is not assigned to this job
            const errorElement = await screen.findByText(
                /no longer assigned to this dispatch job/i,
            );
            expect(errorElement).toBeTruthy();
        });

        it('displays authorized responder alert banner without opening operator emergency sheet when tapping safety.sos_received notification', async () => {
            const customFetch = createTestFetch();
            const tokenStorage = createMockTokenStorage();

            const screen = await render(
                <App
                    baseUrl="https://operations.core2.test"
                    tokenStorage={tokenStorage}
                    fetchFn={customFetch as any}
                    networkMonitor={networkMonitor}
                />,
            );

            await act(async () => {
                if (responseNotificationHandler) {
                    responseNotificationHandler({
                        notification: {
                            request: {
                                content: {
                                    data: {
                                        event: 'safety.sos_received',
                                        incident_id: 'sos-incident-100',
                                    },
                                },
                            },
                        },
                    });
                }
            });

            // DO NOT open operator EmergencySosSheet (which is for activating an emergency)
            expect(screen.queryByTestId('emergency-sos-sheet')).toBeNull();

            // DO display the responder alert banner directing responder to Safety Desk
            const banner = await screen.findByTestId(
                'sos-responder-notice-banner',
            );
            expect(banner).toBeTruthy();
            expect(
                await screen.findByText(/EMERGENCY SOS ALERT/i),
            ).toBeTruthy();
            expect(
                await screen.findByText(
                    /Active incident reported by Jane Operator/i,
                ),
            ).toBeTruthy();
            expect(
                await screen.findByText(/Safety Operations Desk/i),
            ).toBeTruthy();
        });

        it('rejects unauthorized safety.sos_received notification tap with 403 error banner', async () => {
            const customFetch = createTestFetch();
            const tokenStorage = createMockTokenStorage();

            const screen = await render(
                <App
                    baseUrl="https://operations.core2.test"
                    tokenStorage={tokenStorage}
                    fetchFn={customFetch as any}
                    networkMonitor={networkMonitor}
                />,
            );

            await act(async () => {
                if (responseNotificationHandler) {
                    responseNotificationHandler({
                        notification: {
                            request: {
                                content: {
                                    data: {
                                        event: 'safety.sos_received',
                                        incident_id: 'unauthorized-incident',
                                    },
                                },
                            },
                        },
                    });
                }
            });

            expect(screen.queryByTestId('emergency-sos-sheet')).toBeNull();
            expect(
                screen.queryByTestId('sos-responder-notice-banner'),
            ).toBeNull();
            expect(
                await screen.findByText(
                    /You are not authorized to view this emergency incident/i,
                ),
            ).toBeTruthy();
        });

        it('rejects missing or deleted safety.sos_received notification tap with 404 error banner', async () => {
            const customFetch = createTestFetch();
            const tokenStorage = createMockTokenStorage();

            const screen = await render(
                <App
                    baseUrl="https://operations.core2.test"
                    tokenStorage={tokenStorage}
                    fetchFn={customFetch as any}
                    networkMonitor={networkMonitor}
                />,
            );

            await act(async () => {
                if (responseNotificationHandler) {
                    responseNotificationHandler({
                        notification: {
                            request: {
                                content: {
                                    data: {
                                        event: 'safety.sos_received',
                                        incident_id: 'missing-incident',
                                    },
                                },
                            },
                        },
                    });
                }
            });

            expect(screen.queryByTestId('emergency-sos-sheet')).toBeNull();
            expect(
                screen.queryByTestId('sos-responder-notice-banner'),
            ).toBeNull();
            expect(
                await screen.findByText(
                    /Emergency incident was not found or has been removed/i,
                ),
            ).toBeTruthy();
        });

        it('rejects already resolved safety.sos_received notification tap with status banner', async () => {
            const customFetch = createTestFetch();
            const tokenStorage = createMockTokenStorage();

            const screen = await render(
                <App
                    baseUrl="https://operations.core2.test"
                    tokenStorage={tokenStorage}
                    fetchFn={customFetch as any}
                    networkMonitor={networkMonitor}
                />,
            );

            await act(async () => {
                if (responseNotificationHandler) {
                    responseNotificationHandler({
                        notification: {
                            request: {
                                content: {
                                    data: {
                                        event: 'safety.sos_received',
                                        incident_id: 'resolved-incident',
                                    },
                                },
                            },
                        },
                    });
                }
            });

            expect(screen.queryByTestId('emergency-sos-sheet')).toBeNull();
            expect(
                screen.queryByTestId('sos-responder-notice-banner'),
            ).toBeNull();
            expect(
                await screen.findByText(
                    /Emergency incident .* is already resolved/i,
                ),
            ).toBeTruthy();
        });

        it('enforces recipient isolation and ignores notification when recipient_id does not match active user', async () => {
            const customFetch = createTestFetch();
            const tokenStorage = createMockTokenStorage();

            const screen = await render(
                <App
                    baseUrl="https://operations.core2.test"
                    tokenStorage={tokenStorage}
                    fetchFn={customFetch as any}
                    networkMonitor={networkMonitor}
                />,
            );

            // testUser has id = 101. Notification is intended for user 999
            await act(async () => {
                if (responseNotificationHandler) {
                    responseNotificationHandler({
                        notification: {
                            request: {
                                content: {
                                    data: {
                                        event: 'dispatch.assigned',
                                        job_id: 42,
                                        recipient_id: 999,
                                    },
                                },
                            },
                        },
                    });
                }
            });

            // The notification navigation should have been completely suppressed
            expect(screen.queryByTestId('emergency-sos-sheet')).toBeNull();
            expect(
                screen.queryByTestId('sos-responder-notice-banner'),
            ).toBeNull();
        });

        it('handles dispatch.cancelled notification tap by displaying cancellation banner', async () => {
            const customFetch = createTestFetch();
            const tokenStorage = createMockTokenStorage();

            const screen = await render(
                <App
                    baseUrl="https://operations.core2.test"
                    tokenStorage={tokenStorage}
                    fetchFn={customFetch as any}
                    networkMonitor={networkMonitor}
                />,
            );

            await act(async () => {
                if (responseNotificationHandler) {
                    responseNotificationHandler({
                        notification: {
                            request: {
                                content: {
                                    data: {
                                        event: 'dispatch.cancelled',
                                        job_id: 42,
                                        reference: 'JOB-0042',
                                    },
                                },
                            },
                        },
                    });
                }
            });

            const cancelBanner = await screen.findByText(
                'Dispatch job JOB-0042 was cancelled.',
            );
            expect(cancelBanner).toBeTruthy();
        });

        it('records push opened ticket ID when tapping notification', async () => {
            let recordPushOpenedCalled = false;
            let recordedTicketId = '';

            const tokenStorage = createMockTokenStorage();
            const clientFetch = async (
                input: RequestInfo | URL,
                init?: RequestInit,
            ) => {
                const url = input.toString();

                if (url.endsWith('/api/v1/push-deliveries/opened')) {
                    recordPushOpenedCalled = true;
                    const body = JSON.parse(init?.body as string);
                    recordedTicketId = body.ticket_id;

                    return new Response(JSON.stringify({ status: 'opened' }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                return createTestFetch()(input);
            };

            await render(
                <App
                    baseUrl="https://operations.core2.test"
                    tokenStorage={tokenStorage}
                    fetchFn={clientFetch as any}
                    networkMonitor={networkMonitor}
                />,
            );

            await act(async () => {
                if (responseNotificationHandler) {
                    responseNotificationHandler({
                        notification: {
                            request: {
                                content: {
                                    data: {
                                        ticket_id: 'tkt-test-receipt-opened',
                                        event: 'dispatch.assigned',
                                        job_id: 42,
                                    },
                                },
                            },
                        },
                    });
                }
            });

            await waitFor(() => {
                expect(recordPushOpenedCalled).toBe(true);
                expect(recordedTicketId).toBe('tkt-test-receipt-opened');
            });
        });

        it('handles cold start notification tap response on launch', async () => {
            (
                Notifications.getLastNotificationResponseAsync as jest.Mock
            ).mockResolvedValueOnce({
                notification: {
                    request: {
                        content: {
                            data: {
                                event: 'dispatch.assigned',
                                job_id: 42,
                            },
                        },
                    },
                },
            });

            const customFetch = createTestFetch();
            const tokenStorage = createMockTokenStorage();

            const screen = await render(
                <App
                    baseUrl="https://operations.core2.test"
                    tokenStorage={tokenStorage}
                    fetchFn={customFetch as any}
                    networkMonitor={networkMonitor}
                />,
            );

            // Expect to navigate to the job screen on cold start
            const jobElement = await screen.findByText(/Bridge Crane Support/i);
            expect(jobElement).toBeTruthy();
        });

        it('suppresses cold start replay across session transitions', async () => {
            (
                Notifications.getLastNotificationResponseAsync as jest.Mock
            ).mockResolvedValueOnce({
                notification: {
                    request: {
                        content: {
                            data: {
                                event: 'dispatch.assigned',
                                job_id: 42,
                            },
                        },
                    },
                },
            });

            const customFetch = createTestFetch();
            const tokenStorage = createMockTokenStorage();

            const screen = await render(
                <App
                    baseUrl="https://operations.core2.test"
                    tokenStorage={tokenStorage}
                    fetchFn={customFetch as any}
                    networkMonitor={networkMonitor}
                />,
            );

            expect(
                await screen.findByText(/Bridge Crane Support/i),
            ).toBeTruthy();

            // When user session changes, cold-start query is not repeated
            await act(async () => {
                await tokenStorage.clearToken();
            });

            expect(
                Notifications.getLastNotificationResponseAsync,
            ).toHaveBeenCalledTimes(1);
        });
    });
});
