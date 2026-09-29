import { act, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemAdminDashboard } from '@/components/dashboards/admin/admin-dashboard';
import type {
    WorkspaceSection,
    WorkspaceUserViewModel,
} from '@/types/workspace';

vi.mock('@/components/dashboards/live-tracking-preview', () => ({
    LiveTrackingPreview: () => <div data-testid="live-tracking-preview" />,
}));

const sections: WorkspaceSection[] = [
    'overview',
    'dispatch',
    'assets',
    'users',
    'audit',
    'gpt-recommendations',
];

const users = [
    {
        id: 1,
        name: 'Ada Admin',
        email: 'ada@example.test',
        is_active: true,
        role: 'system_administrator',
        role_label: 'System Administrator',
        credentials: [],
    },
    {
        id: 2,
        name: 'Oscar Operator',
        email: 'oscar@example.test',
        is_active: true,
        role: 'crane_operator',
        role_label: 'Operator',
        credentials: [
            {
                id: 9,
                kind: 'operator_certification',
                credential_number: 'OC-9',
                credential_type: 'TESDA NC II',
                issued_at: '2020-01-01',
                expires_at: '2026-01-01',
                status: 'active',
                is_expired: true,
                expires_soon: false,
            },
        ],
    },
    {
        id: 3,
        name: 'Nina New',
        email: 'nina@example.test',
        is_active: true,
        role: 'crane_operator',
        role_label: 'Operator',
        credentials: [],
    },
] as WorkspaceUserViewModel[];

const degradedHealth = {
    status: 'degraded',
    timestamp: '2026-09-29T00:00:00Z',
    services: {
        database: { status: 'operational', latency_ms: 0.4 },
        cache: { status: 'operational', latency_ms: 0.3 },
        outbox: { status: 'operational', pending: 0, failed: 0, delivered: 3 },
        queues: { status: 'operational', failed_jobs: 0 },
        websockets: { driver: 'reverb', status: 'configured' },
        tracking: { status: 'offline', latency_ms: null },
    },
};

const governance = {
    monthly_spend_usd: 12.5,
    monthly_budget_ceiling_usd: 250,
    total_tokens: 4200,
    avg_latency_ms: 900,
    acceptance_rate: 50,
    accepted_count: 1,
    rejected_count: 1,
    circuit_breaker_active: false,
};

const auditPage = {
    events: [
        {
            id: 7,
            action: 'user.login',
            actor: { id: 1, name: 'Ada Admin' },
            occurred_at: new Date().toISOString(),
            reason: null,
        },
    ],
    total: 140,
    current_page: 1,
    last_page: 28,
    per_page: 5,
    counts: {},
    actors: [],
    last_24h_total: 12,
};

function json(body: unknown, status = 200) {
    return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    });
}

let fetchMock: ReturnType<typeof vi.fn>;

function renderDashboard(onSectionChange = vi.fn()) {
    render(
        <SystemAdminDashboard
            users={users}
            availableSections={sections}
            onSectionChange={onSectionChange}
        />,
    );

    return onSectionChange;
}

describe('SystemAdminDashboard', () => {
    beforeEach(() => {
        fetchMock = vi.fn((url: string, init?: RequestInit) => {
            if (url.startsWith('/operations/admin/health')) {
                return json(degradedHealth);
            }

            if (url.startsWith('/operations/gpt-governance/telemetry')) {
                return json(governance);
            }

            if (url.startsWith('/operations/audit-events')) {
                return json(auditPage);
            }

            if (url === '/operations/gpt-circuit-breaker') {
                const body = JSON.parse(String(init?.body)) as {
                    paused: boolean;
                };

                return json({ circuit_breaker_active: body.paused });
            }

            return json({}, 404);
        });
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('explains why the platform is degraded instead of showing a generic status', async () => {
        renderDashboard();

        const health = await screen.findByRole('region', {
            name: 'Platform at a glance',
        });
        expect(await within(health).findByText('Degraded')).toBeInTheDocument();
        expect(
            within(health).getByText('Tracking service offline'),
        ).toBeInTheDocument();
        expect(screen.getByText('Platform is degraded')).toBeInTheDocument();
    });

    it('shows real AI spend against the configured budget and today’s audit volume', async () => {
        renderDashboard();

        expect(
            await screen.findByText('of $250.00 budget'),
        ).toBeInTheDocument();
        expect(screen.getAllByText('$12.50').length).toBeGreaterThan(0);
        expect(await screen.findByText('events in 24 h')).toBeInTheDocument();
        expect(
            screen.getByText('140 events recorded in total'),
        ).toBeInTheDocument();
        expect(screen.getAllByText('Signed in').length).toBeGreaterThan(0);
    });

    it('lists expired and missing operator credentials and links to the credentials tab', async () => {
        const onSectionChange = renderDashboard();

        const attention = await screen.findByRole('region', {
            name: 'Needs your attention',
        });
        expect(
            within(attention).getByText('1 credential expired'),
        ).toBeInTheDocument();
        expect(
            within(attention).getByText('1 operator without credentials'),
        ).toBeInTheDocument();

        fireEvent.click(
            within(attention).getAllByRole('button', {
                name: /review credentials/i,
            })[0],
        );
        expect(onSectionChange).toHaveBeenCalledWith('users', {
            tab: 'credentials',
        });

        const access = screen.getByRole('region', {
            name: 'Access and credentials',
        });
        expect(
            within(access).getByRole('button', { name: 'Review Nina New' }),
        ).toBeInTheDocument();
        expect(
            within(access).getByRole('button', {
                name: 'Review Oscar Operator',
            }),
        ).toBeInTheDocument();
    });

    it('requires a reason before pausing AI advice and sends an explicit state', async () => {
        renderDashboard();

        fireEvent.click(
            await screen.findByRole('button', { name: 'Pause AI advice' }),
        );
        const dialog = await screen.findByRole('dialog');
        const confirm = within(dialog).getByRole('button', {
            name: 'Pause AI advice',
        });
        expect(confirm).toBeDisabled();

        fireEvent.change(
            within(dialog).getByLabelText('Reason for pausing AI advice'),
            { target: { value: 'Spend spike' } },
        );
        await act(async () => {
            fireEvent.click(confirm);
        });

        expect(fetchMock).toHaveBeenCalledWith(
            '/operations/gpt-circuit-breaker',
            expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify({ paused: true, reason: 'Spend spike' }),
            }),
        );
        expect(
            await screen.findByRole('button', { name: 'Resume AI advice' }),
        ).toBeInTheDocument();
        expect(screen.getByText('AI advice is paused')).toBeInTheDocument();
    });

    it('reports a failed health probe honestly without inventing subsystem results', async () => {
        fetchMock.mockImplementation((url: string) =>
            url.startsWith('/operations/admin/health')
                ? json({}, 500)
                : url.startsWith('/operations/gpt-governance/telemetry')
                  ? json(governance)
                  : json(auditPage),
        );

        renderDashboard();

        expect(await screen.findByText('Not reporting')).toBeInTheDocument();
        expect(
            screen.getByText('Health checks are not reporting'),
        ).toBeInTheDocument();
        expect(screen.queryByText('Operational')).not.toBeInTheDocument();
        expect(screen.getAllByText('Not checked').length).toBeGreaterThan(0);
    });
});
