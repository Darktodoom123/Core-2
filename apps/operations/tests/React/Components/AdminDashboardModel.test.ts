import { describe, expect, it } from 'vitest';
import {
    buildAttentionItems,
    healthCauses,
    roleDistribution,
    subsystems,
    summarizeAccounts,
    summarizeCredentials,
} from '@/components/dashboards/admin/admin-dashboard-model';
import type {
    AiGovernance,
    SystemHealth,
} from '@/components/dashboards/admin/admin-dashboard-model';
import type { WorkspaceUserViewModel } from '@/types/workspace';

function user(
    overrides: Partial<WorkspaceUserViewModel> = {},
): WorkspaceUserViewModel {
    return {
        id: 1,
        name: 'Ana Operator',
        email: 'ana@example.test',
        is_active: true,
        suspended_at: null,
        role: 'crane_operator',
        role_label: 'Operator',
        credentials: [],
        ...overrides,
    };
}

function credential(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        kind: 'operator_certification',
        credential_number: 'OC-1',
        credential_type: 'TESDA NC II',
        issued_at: '2024-01-01',
        expires_at: '2027-01-01',
        status: 'active',
        is_expired: false,
        expires_soon: false,
        ...overrides,
    } as WorkspaceUserViewModel['credentials'] extends (infer T)[] | undefined
        ? T
        : never;
}

const healthy: SystemHealth = {
    status: 'healthy',
    timestamp: '2026-09-29T00:00:00Z',
    services: {
        database: { status: 'operational', latency_ms: 0.4 },
        cache: { status: 'operational', latency_ms: 0.2 },
        outbox: { status: 'operational', pending: 0, failed: 0, delivered: 4 },
        queues: { status: 'operational', failed_jobs: 0 },
        websockets: { driver: 'reverb', status: 'configured' },
        tracking: { status: 'operational', latency_ms: 12 },
    },
};

const ai: AiGovernance = {
    monthly_spend_usd: 10,
    monthly_budget_ceiling_usd: 250,
    total_tokens: 1000,
    avg_latency_ms: 800,
    acceptance_rate: 50,
    accepted_count: 1,
    rejected_count: 1,
    circuit_breaker_active: false,
};

describe('admin dashboard model', () => {
    it('ignores superseded and revoked credentials and flags operators with none current', () => {
        const summary = summarizeCredentials([
            user({
                id: 1,
                name: 'Old Cert Only',
                credentials: [
                    credential({ status: 'superseded', is_expired: true }),
                ],
            }),
            user({
                id: 2,
                name: 'Expired',
                credentials: [credential({ is_expired: true })],
            }),
            user({
                id: 3,
                name: 'Manager',
                role: 'operations_manager',
                credentials: [],
            }),
            user({
                id: 4,
                name: 'Suspended',
                is_active: false,
                credentials: [],
            }),
        ]);

        expect(summary.expired.map((item) => item.user.name)).toEqual([
            'Expired',
        ]);
        expect(summary.missing.map((item) => item.name)).toEqual([
            'Old Cert Only',
        ]);
    });

    it('counts suspended accounts and marks the list partial at the server cap', () => {
        const accounts = summarizeAccounts([
            user({ id: 1 }),
            user({ id: 2, suspended_at: '2026-09-01T00:00:00Z' }),
        ]);

        expect(accounts).toMatchObject({ total: 2, active: 1, partial: false });
        expect(accounts.suspended).toHaveLength(1);
        expect(
            summarizeAccounts(
                Array.from({ length: 200 }, (_, id) => user({ id })),
            ).partial,
        ).toBe(true);
    });

    it('groups active accounts by their real role labels', () => {
        expect(
            roleDistribution([
                user({ id: 1 }),
                user({ id: 2 }),
                user({
                    id: 3,
                    role: 'system_administrator',
                    role_label: 'System Administrator',
                }),
                user({ id: 4, is_active: false }),
            ]),
        ).toEqual([
            { role: 'crane_operator', label: 'Operator', count: 2 },
            {
                role: 'system_administrator',
                label: 'System Administrator',
                count: 1,
            },
        ]);
    });

    it('names each reason the platform is degraded', () => {
        expect(
            healthCauses({
                ...healthy,
                status: 'degraded',
                services: {
                    ...healthy.services,
                    tracking: { status: 'offline', latency_ms: null },
                    queues: { status: 'failed', failed_jobs: 2 },
                },
            }),
        ).toEqual(['Tracking service offline', '2 background jobs failed']);
        expect(healthCauses(healthy)).toEqual([]);
    });

    it('never reports a subsystem as operational before it is checked', () => {
        const rows = subsystems(null, false);

        expect(
            rows
                .filter((row) => row.key !== 'realtime')
                .every((row) => row.state === 'unknown'),
        ).toBe(true);
        expect(
            subsystems(
                {
                    ...healthy,
                    services: {
                        ...healthy.services,
                        websockets: { driver: 'null', status: 'disabled' },
                    },
                },
                false,
            ).find((row) => row.key === 'realtime'),
        ).toMatchObject({ state: 'off', status: 'Turned off' });
    });

    it('puts danger items first and links credential work to the credentials tab', () => {
        const items = buildAttentionItems({
            health: { ...healthy, status: 'degraded' },
            healthError: null,
            credentials: {
                expired: [
                    {
                        user: user(),
                        credential: credential({ is_expired: true }),
                    },
                ],
                expiring: [],
                missing: [],
            },
            accounts: { total: 1, active: 1, suspended: [], partial: false },
            ai: {
                ...ai,
                monthly_spend_usd: 260,
                circuit_breaker_active: true,
            },
        });

        expect(items.map((item) => item.id)).toEqual([
            'credentials-expired',
            'ai-budget',
            'health',
            'ai-paused',
        ]);
        expect(items[0].action).toEqual({
            label: 'Review credentials',
            section: 'users',
            tab: 'credentials',
        });
        expect(items[1].title).toBe('AI budget exceeded this month');
    });

    it('reports nothing when the platform is healthy and access is clean', () => {
        expect(
            buildAttentionItems({
                health: healthy,
                healthError: null,
                credentials: { expired: [], expiring: [], missing: [] },
                accounts: {
                    total: 1,
                    active: 1,
                    suspended: [],
                    partial: false,
                },
                ai,
            }),
        ).toEqual([]);
    });
});
