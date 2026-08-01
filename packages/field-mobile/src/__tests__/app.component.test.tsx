import {
    cleanup,
    fireEvent,
    render,
    waitFor,
} from '@testing-library/react-native/pure';
import '@testing-library/react-native/matchers';
import React from 'react';
import { App } from '../../App';
import type { TokenStorageProvider } from '../auth/tokenStorage';
import { AssignedJobsListScreen } from '../components/AssignedJobsListScreen';
import type { DispatchJob, OutboxCommand, User } from '../types/index';

const apiBaseUrl = 'https://field.example.test';
const rawToken = '1|raw-bearer-token-must-never-render';
type NativeRender = Awaited<ReturnType<typeof render>>;

let screen: NativeRender;

async function renderScreen(
    element: React.ReactElement,
): Promise<NativeRender> {
    screen = await render(element);

    return screen;
}

const driver: User = {
    id: 11,
    name: 'Jane Driver',
    email: 'driver@example.test',
    role: 'driver',
    is_active: true,
};

const dispatcher: User = {
    id: 22,
    name: 'Dana Dispatcher',
    email: 'dispatcher@example.test',
    role: 'dispatcher',
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
    jobsResponses?: Array<{ body: unknown; status: number }>;
    loginStatus?: number;
    logoutResponses?: Array<'network-error' | { status: number }>;
    meStatus?: number;
    user?: User;
}

function createApi(scenario: ApiScenario = {}) {
    const calls: Array<{
        body?: Record<string, unknown>;
        method: string;
        url: string;
    }> = [];
    let jobsRequestIndex = 0;
    let logoutRequestIndex = 0;

    const fetchFn = jest.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = input.toString();
            const method = init?.method ?? 'GET';
            const body =
                typeof init?.body === 'string'
                    ? (JSON.parse(init.body) as Record<string, unknown>)
                    : undefined;
            calls.push({ body, method, url });

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
                        user: scenario.user ?? driver,
                    },
                });
            }

            if (url.endsWith('/api/v1/auth/me')) {
                const status = scenario.meStatus ?? 200;

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

                return jsonResponse({ data: scenario.user ?? driver });
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

            return jsonResponse({ message: 'Not found.' }, { status: 404 });
        },
    );

    return { calls, fetchFn: fetchFn as typeof fetch };
}

async function signIn(): Promise<void> {
    await screen.findByTestId('login-screen');
    await fireEvent.changeText(
        screen.getByTestId('login-email-input'),
        driver.email,
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
    });

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
        await fireEvent.press(screen.getByTestId('refresh-jobs-btn'));

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

        await fireEvent.press(screen.getByLabelText('Sign out of field app'));
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

        await fireEvent.press(screen.getByLabelText('Sign out of field app'));

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
        expect(screen.getByLabelText('Email address')).toBeVisible();
        expect(screen.getByLabelText('Password')).toBeVisible();

        await fireEvent.changeText(
            screen.getByLabelText('Email address'),
            driver.email,
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
            type: 'transition_status',
            jobId: driverJob.id,
            payload: { status: 'accepted' },
            expectedVersion: 2,
            state: 'conflict',
            error: {
                message: 'This dispatch changed.',
                code: 'stale_version',
                currentVersion: 3,
            },
            createdAt: '2026-07-29T00:00:00.000Z',
            updatedAt: '2026-07-29T00:00:00.000Z',
            retryCount: 1,
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
        expect(screen.getByTestId('refresh-jobs-btn')).toBeDisabled();

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
            expect(
                screen.getByLabelText('Sign out of field app'),
            ).toBeVisible();
        });
    });
});
