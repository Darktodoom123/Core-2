import {
    act,
    cleanup,
    fireEvent,
    render,
    waitFor,
    within,
} from '@testing-library/react-native/pure';
import '@testing-library/react-native/matchers';
import React from 'react';
import { App } from '../../App';
import type { TokenStorageProvider } from '../auth/tokenStorage';
import type { NetworkMonitor } from '../connectivity/networkMonitor';
import { AssignedJobsListScreen } from '../screens/AssignedJobsListScreen';
import { MemoryOutboxRepository } from '../storage/outboxRepository';
import type { PayloadHasher } from '../storage/outboxRepository';
import type { DispatchJob, OutboxCommand, User } from '../types/index';

const apiBaseUrl = 'https://field.example.test';
const rawToken = '1|raw-bearer-token-must-never-render';
const testPayloadHasher: PayloadHasher = {
    hash: async (envelope) => 'test-hash:' + JSON.stringify(envelope),
};
type NativeRender = Awaited<ReturnType<typeof render>>;

let screen: NativeRender;

async function renderScreen(
    element: React.ReactElement,
): Promise<NativeRender> {
    if (element.type === App) {
        const appElement = element as React.ReactElement<
            React.ComponentProps<typeof App>
        >;
        const networkMonitor: NetworkMonitor = {
            fetchIsOnline: async () => true,
            subscribe: (listener) => {
                listener(true);

                return () => undefined;
            },
        };
        element = React.cloneElement(appElement, {
            networkMonitor: appElement.props.networkMonitor ?? networkMonitor,
            outboxHasher: appElement.props.outboxHasher ?? testPayloadHasher,
            outboxRepository:
                appElement.props.outboxRepository ??
                new MemoryOutboxRepository(),
        });
    }

    screen = await render(element);

    return screen;
}

class ControlledNetworkMonitor implements NetworkMonitor {
    private listeners = new Set<(isOnline: boolean) => void>();

    public constructor(private online: boolean) {}

    public async fetchIsOnline(): Promise<boolean> {
        return this.online;
    }

    public subscribe(listener: (isOnline: boolean) => void): () => void {
        this.listeners.add(listener);
        listener(this.online);

        return () => this.listeners.delete(listener);
    }

    public setOnline(online: boolean): void {
        this.online = online;

        for (const listener of this.listeners) {
            listener(online);
        }
    }
}

const driver: User = {
    id: 11,
    name: 'Jane Operator',
    username: 'operator',
    email: 'operator@example.test',
    role: 'crane_operator',
    is_active: true,
};

const dispatcher: User = {
    id: 22,
    name: 'Dana Dispatcher',
    username: 'dispatcher',
    email: 'dispatcher@example.test',
    role: 'dispatcher',
    is_active: true,
};

const secondDriver: User = {
    id: 12,
    name: 'John Operator',
    username: 'second-operator',
    email: 'second-operator@example.test',
    role: 'crane_operator',
    is_active: true,
};

const driverJob: DispatchJob = {
    id: 101,
    reference: 'DISP-DRIVER-101',
    client: 'North Harbor',
    title: 'Deliver lifting equipment',
    site: 'Pier 7',
    priority: { value: 'routine', label: 'Routine' },
    status: { value: 'dispatched', label: 'Dispatched' },
    version: 3,
    my_assignment: {
        id: 501,
        response_status: 'accepted',
        response_status_label: 'Accepted',
    },
    progression: {
        current: { value: 'dispatched', label: 'Dispatched' },
        steps: [
            {
                status: { value: 'dispatched', label: 'Dispatched' },
                state: 'current',
            },
            {
                status: { value: 'accepted', label: 'Accepted' },
                state: 'upcoming',
            },
        ],
        next: {
            status: { value: 'accepted', label: 'Accepted' },
            action_label: 'Accept job responsibility',
            confirmation_title: 'Accept this job?',
            confirmation_message:
                'Confirm that you are ready to take responsibility.',
        },
        message: 'Advance only when ready.',
    },
    capabilities: {
        can_respond: false,
        can_update_status: true,
        can_share_location: false,
    },
};

const secondDriverJob: DispatchJob = {
    ...driverJob,
    id: 202,
    reference: 'DISP-DRIVER-202',
    title: 'Inspect mobile crane',
};

interface JsonResponseOptions {
    status?: number;
}

function jsonResponse(
    body: unknown,
    options: JsonResponseOptions = {},
): Response {
    const status = options.status ?? 200;

    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(body),
    } as Response;
}

class TestTokenStorage implements TokenStorageProvider {
    public clearCalls = 0;
    public clearPendingCalls = 0;
    public getCalls = 0;
    public getPendingCalls = 0;
    public setCalls: string[] = [];
    public stageCalls: string[] = [];

    public constructor(
        public token: string | null = null,
        public pendingRevocationToken: string | null = null,
    ) {}

    public async getToken(): Promise<string | null> {
        this.getCalls += 1;

        return this.token;
    }

    public async setToken(token: string): Promise<void> {
        this.setCalls.push(token);
        this.token = token;
    }

    public async clearToken(): Promise<void> {
        this.clearCalls += 1;
        this.token = null;
    }

    public async getPendingRevocationToken(): Promise<string | null> {
        this.getPendingCalls += 1;

        return this.pendingRevocationToken;
    }

    public async stageTokenForRevocation(token: string): Promise<void> {
        this.stageCalls.push(token);
        this.pendingRevocationToken = token;
    }

    public async clearPendingRevocationToken(): Promise<void> {
        this.clearPendingCalls += 1;
        this.pendingRevocationToken = null;
    }
}

interface ApiScenario {
    assignedJobs?: DispatchJob[] | (() => DispatchJob[]);
    commandResponses?: Array<
        'network-error' | { body: unknown; status: number }
    >;
    jobsResponses?: Array<{ body: unknown; status: number }>;
    loginStatus?: number;
    logoutResponses?: Array<'network-error' | { status: number }>;
    meResponses?: Array<'network-error' | { status: number }>;
    meStatus?: number;
    user?: User;
    users?: User[];
}

function createApi(scenario: ApiScenario = {}) {
    const calls: Array<{
        body?: Record<string, unknown>;
        headers?: Record<string, string>;
        method: string;
        url: string;
    }> = [];
    let commandRequestIndex = 0;
    let jobsRequestIndex = 0;
    let logoutRequestIndex = 0;
    let meRequestIndex = 0;
    let userRequestIndex = 0;

    const nextUser = (): User => {
        const user = scenario.users?.[userRequestIndex];
        userRequestIndex += 1;

        return user ?? scenario.user ?? driver;
    };

    const fetchFn = jest.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = input.toString();
            const method = init?.method ?? 'GET';
            const body =
                typeof init?.body === 'string'
                    ? (JSON.parse(init.body) as Record<string, unknown>)
                    : undefined;
            const headers = init?.headers as Record<string, string> | undefined;
            calls.push({ body, headers, method, url });

            if (url.endsWith('/api/v1/auth/login')) {
                const status = scenario.loginStatus ?? 200;

                if (status !== 200) {
                    return jsonResponse(
                        {
                            message:
                                status === 403
                                    ? 'This account is suspended. Contact a system administrator.'
                                    : 'The provided credentials are invalid.',
                        },
                        { status },
                    );
                }

                return jsonResponse({
                    data: {
                        token: rawToken,
                        user: nextUser(),
                    },
                });
            }

            if (url.endsWith('/api/v1/auth/me')) {
                const queuedResponse = scenario.meResponses?.[meRequestIndex];
                meRequestIndex += 1;

                if (queuedResponse === 'network-error') {
                    throw new TypeError('Network request failed');
                }

                const status =
                    (queuedResponse === undefined
                        ? scenario.meStatus
                        : queuedResponse.status) ?? 200;

                if (status !== 200) {
                    return jsonResponse(
                        {
                            message:
                                status === 403
                                    ? 'This account is suspended. Contact a system administrator.'
                                    : 'Unauthenticated.',
                        },
                        { status },
                    );
                }

                return jsonResponse({ data: nextUser() });
            }

            if (url.endsWith('/api/v1/auth/logout')) {
                const queuedResponse =
                    scenario.logoutResponses?.[logoutRequestIndex];
                logoutRequestIndex += 1;

                if (queuedResponse === 'network-error') {
                    throw new TypeError('Network request failed');
                }

                if (queuedResponse) {
                    return jsonResponse(
                        {
                            message:
                                queuedResponse.status === 401
                                    ? 'Unauthenticated.'
                                    : 'Revocation failed.',
                        },
                        { status: queuedResponse.status },
                    );
                }

                return jsonResponse({
                    message:
                        'Successfully logged out and revoked device token.',
                });
            }

            if (url.endsWith('/api/v1/dispatch-jobs')) {
                const queuedResponse =
                    scenario.jobsResponses?.[jobsRequestIndex];
                jobsRequestIndex += 1;

                if (queuedResponse) {
                    return jsonResponse(queuedResponse.body, {
                        status: queuedResponse.status,
                    });
                }

                const jobs =
                    typeof scenario.assignedJobs === 'function'
                        ? scenario.assignedJobs()
                        : (scenario.assignedJobs ?? []);

                return jsonResponse({ data: jobs });
            }

            if (
                /\/api\/v1\/dispatch-jobs\/\d+\/(?:status|assignments\/\d+\/response)$/.test(
                    url,
                )
            ) {
                const queuedResponse =
                    scenario.commandResponses?.[commandRequestIndex];
                commandRequestIndex += 1;

                if (queuedResponse === 'network-error') {
                    throw new TypeError('Network request failed');
                }

                if (queuedResponse) {
                    return jsonResponse(queuedResponse.body, {
                        status: queuedResponse.status,
                    });
                }

                return jsonResponse({
                    data: {
                        ...driverJob,
                        status: {
                            value: body?.status ?? driverJob.status.value,
                            label: 'Updated',
                        },
                        version: Number(body?.version ?? driverJob.version) + 1,
                    },
                });
            }

            return jsonResponse({ message: 'Not found.' }, { status: 404 });
        },
    );

    return { calls, fetchFn: fetchFn as typeof fetch };
}

async function signIn(): Promise<void> {
    await screen.findByTestId('login-screen');
    await fireEvent.changeText(
        screen.getByTestId('login-username-input'),
        driver.username!,
    );
    await fireEvent.changeText(
        screen.getByTestId('login-password-input'),
        'password',
    );
    await fireEvent.press(screen.getByTestId('login-submit-button'));
}

describe('native application component tree', () => {
    afterEach(async () => {
        await cleanup();
    });

    it('shows bootstrap loading until secure storage resolves', async () => {
        let resolveToken: ((value: string | null) => void) | undefined;
        const tokenPromise = new Promise<string | null>((resolve) => {
            resolveToken = resolve;
        });
        const tokenStorage: TokenStorageProvider = {
            clearToken: async () => undefined,
            clearPendingRevocationToken: async () => undefined,
            getToken: () => tokenPromise,
            getPendingRevocationToken: async () => null,
            setToken: async () => undefined,
            stageTokenForRevocation: async () => undefined,
        };
        const { fetchFn } = createApi();

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );

        expect(
            screen.getByText('Initializing Core 2 Field Mobile…'),
        ).toBeVisible();

        resolveToken?.(null);

        expect(await screen.findByTestId('login-screen')).toBeVisible();
    }, 15_000);

    it('logs in, stores the token securely, and renders an empty assigned-job state', async () => {
        const tokenStorage = new TestTokenStorage();
        const { fetchFn } = createApi({ assignedJobs: [] });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );
        await signIn();

        expect(
            await screen.findByTestId('empty-assignments-msg'),
        ).toBeVisible();
        expect(screen.getByText('No work assigned yet')).toBeVisible();
        expect(tokenStorage.setCalls).toEqual([rawToken]);
        expect(screen.queryByText(rawToken)).toBeNull();
    });

    it('shows invalid-credential recovery without storing a token', async () => {
        const tokenStorage = new TestTokenStorage();
        const { fetchFn } = createApi({ loginStatus: 422 });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );
        await signIn();

        expect(
            await screen.findByText('The provided credentials are invalid.'),
        ).toBeVisible();
        expect(tokenStorage.setCalls).toHaveLength(0);
    });

    it('turns a device-to-API connection failure into actionable sign-in guidance', async () => {
        const tokenStorage = new TestTokenStorage();
        const fetchFn = jest.fn(async (input: RequestInfo | URL) => {
            if (input.toString().endsWith('/api/v1/auth/login')) {
                throw new TypeError(
                    'fetch failed: java.net.ConnectException: Failed to connect',
                );
            }

            return jsonResponse({ message: 'Not found.' }, { status: 404 });
        }) as typeof fetch;

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );
        await signIn();

        expect(
            await screen.findByText(
                /Unable to reach the field API\. Check that the phone and computer are on the same Wi-Fi network/,
            ),
        ).toBeVisible();
        expect(screen.queryByText(/java\.net\.ConnectException/)).toBeNull();
        expect(tokenStorage.setCalls).toHaveLength(0);
    });

    it('fails closed for a suspended account and clears stored credentials', async () => {
        const tokenStorage = new TestTokenStorage(rawToken);
        const { fetchFn } = createApi({ meStatus: 403 });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );

        expect(await screen.findByTestId('suspended-screen')).toBeVisible();
        expect(tokenStorage.token).toBeNull();
        expect(tokenStorage.clearCalls).toBe(1);
    });

    it('revokes and rejects a non-field-role login before storing its token', async () => {
        const tokenStorage = new TestTokenStorage();
        const { calls, fetchFn } = createApi({ user: dispatcher });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );
        await signIn();

        expect(
            await screen.findByText(
                'This account role cannot use the field mobile application.',
            ),
        ).toBeVisible();
        expect(tokenStorage.setCalls).toHaveLength(0);
        expect(
            calls.some(
                (call) =>
                    call.method === 'POST' &&
                    call.url.endsWith('/api/v1/auth/logout'),
            ),
        ).toBe(true);
    });

    it('restores a SecureStore session after a cold component remount', async () => {
        const tokenStorage = new TestTokenStorage(rawToken);
        const { fetchFn } = createApi({ assignedJobs: [driverJob] });
        const firstMount = await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );

        expect(await screen.findByText(driverJob.reference)).toBeVisible();
        await firstMount.unmount();

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );

        expect(await screen.findByText(driverJob.reference)).toBeVisible();
        expect(tokenStorage.getCalls).toBeGreaterThanOrEqual(2);
    });

    it('shows API failure, retries, and replaces the error with assigned jobs', async () => {
        const tokenStorage = new TestTokenStorage(rawToken);
        const { fetchFn } = createApi({
            jobsResponses: [
                {
                    body: { message: 'Dispatch service unavailable.' },
                    status: 503,
                },
                { body: { data: [driverJob] }, status: 200 },
            ],
        });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );

        expect(
            await screen.findByText('Dispatch service unavailable.'),
        ).toBeVisible();
        await screen
            .getByTestId('refresh-control')
            .props.refreshControl.props.onRefresh();

        expect(await screen.findByText(driverJob.reference)).toBeVisible();
        expect(screen.queryByText('Dispatch service unavailable.')).toBeNull();
    });

    it('logs out, clears identity state, and never shows the previous user jobs', async () => {
        const tokenStorage = new TestTokenStorage();
        let activeJobs = [driverJob];
        const { calls, fetchFn } = createApi({
            assignedJobs: () => activeJobs,
        });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );
        await signIn();
        expect(await screen.findByText(driverJob.reference)).toBeVisible();

        await fireEvent.press(screen.getByLabelText('Open profile'));
        await fireEvent.press(screen.getByLabelText('Start sign out'));
        await fireEvent.press(screen.getByLabelText('Confirm sign out'));
        expect(await screen.findByTestId('login-screen')).toBeVisible();
        activeJobs = [secondDriverJob];
        await signIn();

        expect(
            await screen.findByText(secondDriverJob.reference),
        ).toBeVisible();
        expect(screen.queryByText(driverJob.reference)).toBeNull();
        expect(tokenStorage.clearCalls).toBeGreaterThanOrEqual(1);
        expect(
            calls.filter((call) => call.url.endsWith('/api/v1/auth/logout')),
        ).toHaveLength(1);
    });

    it('fails closed after a revocation failure and retries without restoring the old identity', async () => {
        const tokenStorage = new TestTokenStorage();
        const { calls, fetchFn } = createApi({
            assignedJobs: [driverJob],
            logoutResponses: ['network-error', { status: 200 }],
        });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );
        await signIn();
        expect(await screen.findByText(driverJob.reference)).toBeVisible();

        await fireEvent.press(screen.getByLabelText('Open profile'));
        await fireEvent.press(screen.getByLabelText('Start sign out'));
        await fireEvent.press(screen.getByLabelText('Confirm sign out'));

        expect(await screen.findByTestId('login-screen')).toBeVisible();
        expect(
            await screen.findByText('Secure sign-out pending'),
        ).toBeVisible();
        expect(screen.queryByText(driverJob.reference)).toBeNull();
        expect(tokenStorage.token).toBeNull();
        expect(tokenStorage.pendingRevocationToken).toBe(rawToken);
        expect(tokenStorage.stageCalls).toEqual([rawToken]);
        expect(screen.queryByText(rawToken)).toBeNull();

        await fireEvent.press(screen.getByTestId('retry-logout-button'));

        await waitFor(() => {
            expect(screen.queryByText('Secure sign-out pending')).toBeNull();
        });
        expect(tokenStorage.pendingRevocationToken).toBeNull();
        expect(
            calls.filter((call) => call.url.endsWith('/api/v1/auth/logout')),
        ).toHaveLength(2);
    });

    it('retries a pending revocation on cold start before allowing authentication', async () => {
        const tokenStorage = new TestTokenStorage(null, rawToken);
        const { calls, fetchFn } = createApi();

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );

        expect(await screen.findByTestId('login-screen')).toBeVisible();
        expect(tokenStorage.pendingRevocationToken).toBeNull();
        expect(
            calls.filter((call) => call.url.endsWith('/api/v1/auth/logout')),
        ).toHaveLength(1);
        expect(
            calls.filter((call) => call.url.endsWith('/api/v1/auth/me')),
        ).toHaveLength(0);
    });

    it('clears a pending revocation when the server confirms the token is already rejected', async () => {
        const tokenStorage = new TestTokenStorage(null, rawToken);
        const { fetchFn } = createApi({
            logoutResponses: [{ status: 401 }],
        });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );

        expect(await screen.findByTestId('login-screen')).toBeVisible();
        expect(tokenStorage.pendingRevocationToken).toBeNull();
        expect(screen.queryByText('Secure sign-out pending')).toBeNull();
    });

    it('clears an expired or revoked token and returns to sign in', async () => {
        const tokenStorage = new TestTokenStorage(rawToken);
        const { fetchFn } = createApi({ meStatus: 401 });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );

        expect(
            await screen.findByText(
                'Your session has expired. Please sign in again.',
            ),
        ).toBeVisible();
        expect(await screen.findByTestId('login-screen')).toBeVisible();
        expect(tokenStorage.token).toBeNull();
    });

    it('exposes accessible labels and disabled/busy states for primary actions', async () => {
        const { fetchFn } = createApi();

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={new TestTokenStorage()}
            />,
        );

        const submit = await screen.findByLabelText('Sign in to field app');
        expect(submit).toBeDisabled();
        expect(screen.getByLabelText('Username')).toBeVisible();
        expect(screen.getByLabelText('Password')).toBeVisible();

        await fireEvent.changeText(
            screen.getByLabelText('Username'),
            driver.username!,
        );
        await fireEvent.changeText(
            screen.getByLabelText('Password'),
            'password',
        );
        expect(submit).toBeEnabled();
    });

    it('renders explicit loading, empty, error, retry, queued, and stale states', async () => {
        const staleCommand: OutboxCommand = {
            id: 'stale-command',
            actorId: driver.id,
            type: 'transition_status',
            jobId: driverJob.id,
            payload: { status: 'accepted' },
            payloadHash: 'redacted-test-hash',
            expectedVersion: 2,
            state: 'conflict',
            error: {
                message: 'This dispatch changed.',
                code: 'stale_version',
                currentVersion: 3,
            },
            createdAt: '2026-07-29T00:00:00.000Z',
            updatedAt: '2026-07-29T00:00:00.000Z',
            attempts: 1,
        };

        const { rerender } = await renderScreen(
            <AssignedJobsListScreen
                error="Network unavailable."
                isLoading
                jobs={[]}
                onRefresh={jest.fn()}
                onSelectJob={jest.fn()}
                outboxCommands={[]}
            />,
        );

        expect(screen.getByText('Loading assignments…')).toBeVisible();
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Network unavailable.',
        );
        expect(
            screen.getByTestId('refresh-control').props.refreshControl.props
                .refreshing,
        ).toBe(true);

        await rerender(
            <AssignedJobsListScreen
                error={null}
                isLoading={false}
                jobs={[]}
                onRefresh={jest.fn()}
                onSelectJob={jest.fn()}
                outboxCommands={[
                    { ...staleCommand, id: 'queued-command', state: 'queued' },
                    staleCommand,
                ]}
            />,
        );

        expect(screen.getByTestId('empty-assignments-msg')).toBeVisible();
        expect(screen.getByText('Queued: 1')).toBeVisible();
        expect(screen.getByText('Conflicts: 1')).toBeVisible();
        expect(screen.getByTestId('sync-guidance')).toHaveTextContent(
            '1 saved action need conflict review.',
        );
    });

    it('restores an eight-hour-old command and replays it once after reconnect', async () => {
        const repository = new MemoryOutboxRepository();
        const networkMonitor = new ControlledNetworkMonitor(false);
        const queuedCommand: OutboxCommand = {
            id: '157849b3-e318-4892-88e6-3f705394d201',
            actorId: driver.id,
            type: 'transition_status',
            jobId: driverJob.id,
            assignmentId: null,
            payload: { status: 'accepted' },
            payloadHash: 'eight-hour-offline-command',
            expectedVersion: driverJob.version,
            state: 'queued',
            attempts: 0,
            error: null,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
            lastAttemptAt: null,
            nextAttemptAt: null,
            completedAt: null,
        };
        await repository.save(queuedCommand);
        const { calls, fetchFn } = createApi({ assignedJobs: [driverJob] });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                networkMonitor={networkMonitor}
                outboxRepository={repository}
                tokenStorage={new TestTokenStorage(rawToken)}
            />,
        );

        expect(await screen.findByText('Queued: 1')).toBeVisible();
        expect(
            calls.filter((call) => call.url.endsWith('/status')),
        ).toHaveLength(0);

        await act(() => networkMonitor.setOnline(true));

        await waitFor(() => {
            expect(
                calls.filter((call) => call.url.endsWith('/status')),
            ).toHaveLength(1);
        });
        const [replay] = calls.filter((call) => call.url.endsWith('/status'));
        expect(replay.body?.command_id).toBe(queuedCommand.id);
        expect(replay.headers?.['Idempotency-Key']).toBe(queuedCommand.id);
        expect((await repository.listForActor(driver.id))[0].state).toBe(
            'completed',
        );

        await act(() => networkMonitor.setOnline(false));
        await act(() => networkMonitor.setOnline(true));
        await waitFor(() => {
            expect(
                calls.filter((call) => call.url.endsWith('/status')),
            ).toHaveLength(1);
        });
    });

    it('verifies a preserved session after reconnect and resumes the durable queue', async () => {
        const repository = new MemoryOutboxRepository();
        const networkMonitor = new ControlledNetworkMonitor(false);
        const queuedCommand: OutboxCommand = {
            id: '157849b3-e318-4892-88e6-3f705394d207',
            actorId: driver.id,
            type: 'transition_status',
            jobId: driverJob.id,
            assignmentId: null,
            payload: { status: 'accepted' },
            payloadHash: 'offline-cold-start-command',
            expectedVersion: driverJob.version,
            state: 'queued',
            attempts: 0,
            error: null,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
            lastAttemptAt: null,
            nextAttemptAt: null,
            completedAt: null,
        };
        await repository.save(queuedCommand);
        const tokenStorage = new TestTokenStorage(rawToken);
        const { calls, fetchFn } = createApi({
            assignedJobs: [driverJob],
            meResponses: ['network-error', { status: 200 }],
        });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                networkMonitor={networkMonitor}
                outboxRepository={repository}
                tokenStorage={tokenStorage}
            />,
        );

        expect(
            await screen.findByText(
                'Unable to verify your session. Check your connection and try again.',
            ),
        ).toBeVisible();
        expect(tokenStorage.token).toBe(rawToken);

        await act(() => networkMonitor.setOnline(true));

        expect(await screen.findByText(driverJob.reference)).toBeVisible();
        await waitFor(() => {
            expect(
                calls.filter((call) => call.url.endsWith('/status')),
            ).toHaveLength(1);
        });
        expect((await repository.listForActor(driver.id))[0].state).toBe(
            'completed',
        );
    });

    it('fails closed on a revoked queued command and isolates the next user', async () => {
        const repository = new MemoryOutboxRepository();
        const queuedCommand: OutboxCommand = {
            id: '157849b3-e318-4892-88e6-3f705394d206',
            actorId: driver.id,
            type: 'transition_status',
            jobId: driverJob.id,
            assignmentId: null,
            payload: { status: 'accepted' },
            payloadHash: 'revoked-token-command',
            expectedVersion: driverJob.version,
            state: 'queued',
            attempts: 0,
            error: null,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
            lastAttemptAt: null,
            nextAttemptAt: null,
            completedAt: null,
        };
        await repository.save(queuedCommand);
        const tokenStorage = new TestTokenStorage(rawToken);
        const { fetchFn } = createApi({
            assignedJobs: [secondDriverJob],
            commandResponses: [
                {
                    body: { message: 'Unauthenticated.' },
                    status: 401,
                },
            ],
            users: [driver, secondDriver],
        });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                outboxRepository={repository}
                tokenStorage={tokenStorage}
            />,
        );

        expect(await screen.findByTestId('login-screen')).toBeVisible();
        expect(tokenStorage.token).toBeNull();
        expect((await repository.listForActor(driver.id))[0].error?.code).toBe(
            'AUTHENTICATION_REQUIRED',
        );

        await signIn();
        expect(
            await screen.findByText(secondDriverJob.reference),
        ).toBeVisible();
        expect(await repository.listForActor(secondDriver.id)).toEqual([]);
        expect(screen.queryByText('Queued: 1')).toBeNull();
        expect((await repository.listForActor(driver.id))[0].id).toBe(
            queuedCommand.id,
        );
    });

    it('wires conflict review to accept server state or retry with a new command', async () => {
        const repository = new MemoryOutboxRepository();
        const acceptCommand: OutboxCommand = {
            id: '157849b3-e318-4892-88e6-3f705394d202',
            actorId: driver.id,
            type: 'transition_status',
            jobId: driverJob.id,
            assignmentId: null,
            payload: { status: 'accepted' },
            payloadHash: 'accept-server-state-command',
            expectedVersion: 2,
            state: 'conflict',
            attempts: 1,
            error: {
                code: 'stale_version',
                currentVersion: 4,
                message: 'The server dispatch is newer.',
                retryable: false,
                serverSnapshot: { ...driverJob, version: 4 },
            },
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:01:00.000Z',
            lastAttemptAt: '2026-08-01T00:01:00.000Z',
            nextAttemptAt: null,
            completedAt: null,
        };
        const retryCommand: OutboxCommand = {
            ...acceptCommand,
            id: '157849b3-e318-4892-88e6-3f705394d203',
            payload: { status: 'en_route' },
            payloadHash: 'retry-new-version-command',
            createdAt: '2026-08-01T00:00:01.000Z',
        };
        await repository.save(acceptCommand);
        await repository.save(retryCommand);
        const { calls, fetchFn } = createApi({ assignedJobs: [driverJob] });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                outboxRepository={repository}
                tokenStorage={new TestTokenStorage(rawToken)}
            />,
        );
        await fireEvent.press(
            await screen.findByTestId('job-card-' + driverJob.id),
        );
        expect(
            await screen.findByTestId('conflict-banner-container'),
        ).toBeVisible();

        await fireEvent.press(
            screen.getByTestId('accept-server-btn-' + acceptCommand.id),
        );
        await waitFor(async () => {
            expect(
                (await repository.listForActor(driver.id)).some(
                    (command) => command.id === acceptCommand.id,
                ),
            ).toBe(false);
        });

        await fireEvent.press(
            screen.getByTestId('retry-version-btn-' + retryCommand.id),
        );
        await waitFor(() => {
            expect(screen.queryByTestId('command-error-alert')).toBeNull();
        });
        await waitFor(() => {
            expect(
                calls.filter((call) => call.url.endsWith('/status')),
            ).toHaveLength(1);
        });
        const [retry] = calls.filter((call) => call.url.endsWith('/status'));
        expect(retry.body?.version).toBe(4);
        expect(retry.body?.command_id).not.toBe(retryCommand.id);
        expect(retry.headers?.['Idempotency-Key']).toBe(retry.body?.command_id);
        await waitFor(async () => {
            const commands = await repository.listForActor(driver.id);
            expect(
                commands.some((command) => command.id === retryCommand.id),
            ).toBe(false);
            expect(
                commands.some(
                    (command) =>
                        command.id === retry.body?.command_id &&
                        command.state === 'completed',
                ),
            ).toBe(true);
        });
    });

    it('wires manual retry and discard controls for failed commands', async () => {
        const repository = new MemoryOutboxRepository();
        const retryable: OutboxCommand = {
            id: '157849b3-e318-4892-88e6-3f705394d204',
            actorId: driver.id,
            type: 'transition_status',
            jobId: driverJob.id,
            assignmentId: null,
            payload: { status: 'accepted' },
            payloadHash: 'manual-retry-command',
            expectedVersion: driverJob.version,
            state: 'failed',
            attempts: 5,
            error: {
                code: 'RETRY_EXHAUSTED',
                message: 'Automatic retry limit reached.',
                retryable: true,
            },
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:05:00.000Z',
            lastAttemptAt: '2026-08-01T00:05:00.000Z',
            nextAttemptAt: null,
            completedAt: null,
        };
        const discardable: OutboxCommand = {
            ...retryable,
            id: '157849b3-e318-4892-88e6-3f705394d205',
            payloadHash: 'manual-discard-command',
            error: {
                code: 'VALIDATION_FAILED',
                message: 'The command is no longer valid.',
                retryable: false,
            },
            createdAt: '2026-08-01T00:00:01.000Z',
        };
        await repository.save(retryable);
        await repository.save(discardable);
        const { calls, fetchFn } = createApi({ assignedJobs: [] });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                outboxRepository={repository}
                tokenStorage={new TestTokenStorage(rawToken)}
            />,
        );

        const retryCard = await screen.findByTestId(
            'failed-command-' + retryable.id,
        );
        await fireEvent.press(
            within(retryCard).getByLabelText('Retry failed command'),
        );
        await waitFor(() => {
            expect(
                calls.filter((call) => call.url.endsWith('/status')),
            ).toHaveLength(1);
        });
        expect(
            (await repository.listForActor(driver.id)).find(
                (command) => command.id === retryable.id,
            )?.state,
        ).toBe('completed');

        const discardCard = screen.getByTestId(
            'failed-command-' + discardable.id,
        );
        await fireEvent.press(
            within(discardCard).getByLabelText('Discard failed command'),
        );
        await waitFor(async () => {
            expect(
                (await repository.listForActor(driver.id)).some(
                    (command) => command.id === discardable.id,
                ),
            ).toBe(false);
        });
    });

    it('uses compact and expanded shells without truncating large header text', async () => {
        const tokenStorage = new TestTokenStorage(rawToken);
        const { fetchFn } = createApi({ assignedJobs: [driverJob] });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={tokenStorage}
            />,
        );

        expect(await screen.findByText(driver.name)).not.toHaveProp(
            'numberOfLines',
            1,
        );
        expect(
            screen.queryByTestId('compact-app-shell') ??
                screen.queryByTestId('expanded-app-shell'),
        ).toBeTruthy();

        await waitFor(() => {
            expect(screen.getByLabelText('Open profile')).toBeVisible();
        });
    });

    it('keeps navigation focused on live field work with truthful sync state', async () => {
        const { fetchFn } = createApi({ assignedJobs: [driverJob] });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={new TestTokenStorage(rawToken)}
            />,
        );

        expect(await screen.findByText(driverJob.reference)).toBeVisible();
        expect(screen.getByText('Your assignments')).toBeVisible();
        expect(screen.getByText(/1 active assignment/)).toBeVisible();
        expect(screen.getByText('Synced')).toBeVisible();
        expect(screen.getByTestId('bottom-nav-bar')).toBeVisible();
        expect(
            screen.getByTestId('bottom-nav-today').props.accessibilityState
                .selected,
        ).toBe(true);
        expect(screen.getByLabelText('Route, planned')).toBeVisible();
        expect(screen.queryByText(/synced 2 min ago/i)).toBeNull();
        expect(screen.queryByText('Inspection')).toBeNull();
    });

    it('keeps healthy sync details hidden until an attention state exists', async () => {
        const { fetchFn } = createApi({ assignedJobs: [driverJob] });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={new TestTokenStorage(rawToken)}
            />,
        );

        await screen.findByText(driverJob.reference);
        expect(screen.getByText('Synced')).toBeVisible();
        expect(screen.queryByText('Queued: 0')).toBeNull();
        expect(screen.queryByTestId('sync-details-toggle')).toBeNull();
    });

    it('keeps Profile and planned Route navigation truthful', async () => {
        const { fetchFn } = createApi({ assignedJobs: [driverJob] });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={new TestTokenStorage(rawToken)}
            />,
        );

        await screen.findByText(driverJob.reference);

        expect(screen.queryByTestId('bottom-nav-sync')).toBeNull();

        await fireEvent.press(screen.getByTestId('bottom-nav-route'));
        expect(screen.getByTestId('planned-route-panel')).toBeVisible();
        expect(
            screen.getByText(
                'Route planning is not available for this assignment yet.',
            ),
        ).toBeVisible();
        expect(screen.queryByTestId('route-map')).toBeNull();

        await fireEvent.press(screen.getByTestId('bottom-nav-profile'));
        const profileSheet = screen.getByTestId('profile-sheet');
        expect(profileSheet).toBeVisible();
        expect(within(profileSheet).getByText('Profile')).toBeVisible();
        expect(within(profileSheet).getByText('Sign out')).toBeVisible();

        await fireEvent.press(screen.getByTestId('profile-sheet-close'));
        expect(screen.queryByTestId('profile-sheet')).toBeNull();
        expect(
            screen.getByTestId('bottom-nav-today').props.accessibilityState
                .selected,
        ).toBe(true);
    });

    it('keeps offline status compact when no actions are waiting to sync', async () => {
        await renderScreen(
            <AssignedJobsListScreen
                isLoading={false}
                isOnline={false}
                jobs={[]}
                onRefresh={jest.fn()}
                onSelectJob={jest.fn()}
                outboxCommands={[]}
            />,
        );

        expect(screen.getByText('Offline')).toBeVisible();
        expect(screen.getByText('Reconnect to sync')).toBeVisible();
        expect(screen.queryByTestId('sync-details')).toBeNull();
        expect(screen.queryByText('Queued: 0')).toBeNull();
        expect(
            screen.queryByText(
                'Commands stay on this device until the connection returns.',
            ),
        ).toBeNull();
    });

    it('shows only server-provided job requirements and honest location availability', async () => {
        const fieldJob: DispatchJob = {
            ...driverJob,
            site_notes: 'Check in with the site supervisor at the east gate.',
            requirements: ['Full PPE', 'Inspect outriggers before setup'],
            capabilities: {
                ...driverJob.capabilities,
                can_share_location: true,
            },
        };
        const { fetchFn } = createApi({ assignedJobs: [fieldJob] });

        await renderScreen(
            <App
                baseUrl={apiBaseUrl}
                fetchFn={fetchFn}
                tokenStorage={new TestTokenStorage(rawToken)}
            />,
        );
        await fireEvent.press(
            await screen.findByTestId(`job-card-${fieldJob.id}`),
        );

        expect(screen.getByText('Full PPE')).toBeVisible();
        expect(
            screen.getByText('Inspect outriggers before setup'),
        ).toBeVisible();
        expect(
            screen.getByText(
                'Check in with the site supervisor at the east gate.',
            ),
        ).toBeVisible();
        expect(screen.getByText('Location sharing available')).toBeVisible();
        expect(screen.getByText('Routine')).toBeVisible();
        expect(screen.getByText('Record version 3')).toBeVisible();
        expect(screen.getByText('YOUR NEXT ACTION')).toBeVisible();
        expect(screen.getByText('Server will record: Accepted')).toBeVisible();
        expect(screen.queryByText(/Lift and set HVAC/i)).toBeNull();
        expect(screen.queryByText(/ETA 7:28/i)).toBeNull();
        expect(screen.getByText('Accept job responsibility')).toBeVisible();
        expect(screen.queryByText('Accept job responsibility (v3)')).toBeNull();
    });
});
