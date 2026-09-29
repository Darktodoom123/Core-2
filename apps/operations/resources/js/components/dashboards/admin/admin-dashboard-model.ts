import type {
    PersonnelCredentialViewModel,
    WorkspaceSection,
    WorkspaceUserViewModel,
} from '@/types/workspace';

/** The server sends at most this many accounts to the dashboard. */
export const USER_SAMPLE_LIMIT = 200;

/** Spend share at which the AI budget needs attention. */
export const BUDGET_WARNING_SHARE = 0.8;

const OPERATOR_ROLES = new Set(['crane_operator', 'operator']);
const INACTIVE_CREDENTIAL_STATUSES = new Set(['superseded', 'revoked']);

export type ServiceState = 'ok' | 'warning' | 'danger' | 'unknown' | 'off';

export interface SystemHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    services: {
        database: { status: string; latency_ms: number | null };
        cache: { status: string; latency_ms: number | null };
        outbox: {
            status: string;
            pending: number;
            failed: number;
            delivered: number;
        };
        queues: { status: string; failed_jobs: number };
        websockets?: { driver: string | null; status: string };
        tracking?: { status: string; latency_ms: number | null };
    };
}

export interface AiGovernance {
    monthly_spend_usd: number;
    monthly_budget_ceiling_usd: number;
    total_tokens: number;
    avg_latency_ms: number;
    acceptance_rate: number | null;
    accepted_count: number;
    rejected_count: number;
    circuit_breaker_active: boolean;
}

export interface AccountSummary {
    total: number;
    active: number;
    suspended: WorkspaceUserViewModel[];
    /** The server capped the list, so totals are a minimum. */
    partial: boolean;
}

export interface CredentialIssue {
    user: WorkspaceUserViewModel;
    credential: PersonnelCredentialViewModel;
}

export interface CredentialSummary {
    expired: CredentialIssue[];
    expiring: CredentialIssue[];
    /** Active operators with no current credential on file. */
    missing: WorkspaceUserViewModel[];
}

export interface RoleCount {
    role: string;
    label: string;
    count: number;
}

export interface Subsystem {
    key: string;
    label: string;
    state: ServiceState;
    status: string;
    value: string;
    detail: string;
}

export interface AttentionItem {
    id: string;
    tone: 'danger' | 'warning';
    title: string;
    detail: string;
    action?: {
        label: string;
        section: WorkspaceSection;
        tab?: string;
    };
}

export function isSuspended(user: WorkspaceUserViewModel): boolean {
    return !user.is_active || Boolean(user.suspended_at);
}

export function summarizeAccounts(
    users: WorkspaceUserViewModel[],
): AccountSummary {
    const suspended = users.filter(isSuspended);

    return {
        total: users.length,
        active: users.length - suspended.length,
        suspended,
        partial: users.length >= USER_SAMPLE_LIMIT,
    };
}

function isCurrentCredential(credential: PersonnelCredentialViewModel) {
    return !INACTIVE_CREDENTIAL_STATUSES.has(credential.status);
}

export function summarizeCredentials(
    users: WorkspaceUserViewModel[],
): CredentialSummary {
    const expired: CredentialIssue[] = [];
    const expiring: CredentialIssue[] = [];
    const missing: WorkspaceUserViewModel[] = [];

    for (const user of users) {
        const current = (user.credentials ?? []).filter(isCurrentCredential);

        for (const credential of current) {
            if (credential.is_expired) {
                expired.push({ user, credential });
            } else if (credential.expires_soon) {
                expiring.push({ user, credential });
            }
        }

        if (
            !isSuspended(user) &&
            OPERATOR_ROLES.has(user.role ?? '') &&
            current.length === 0
        ) {
            missing.push(user);
        }
    }

    const byExpiry = (a: CredentialIssue, b: CredentialIssue) =>
        (a.credential.expires_at ?? '').localeCompare(
            b.credential.expires_at ?? '',
        );

    return {
        expired: expired.sort(byExpiry),
        expiring: expiring.sort(byExpiry),
        missing,
    };
}

/** Active accounts per role, largest group first. */
export function roleDistribution(users: WorkspaceUserViewModel[]): RoleCount[] {
    const counts = new Map<string, RoleCount>();

    for (const user of users) {
        if (isSuspended(user)) {
            continue;
        }

        const role = user.role ?? 'unassigned';
        const existing = counts.get(role);

        counts.set(role, {
            role,
            label: user.role_label ?? (user.role ? role : 'No role'),
            count: (existing?.count ?? 0) + 1,
        });
    }

    return [...counts.values()].sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    );
}

function latency(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : `${value} ms`;
}

function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? one : many}`;
}

/**
 * One row per subsystem. Realtime reflects this browser's own connection,
 * because the server can only say whether broadcasting is configured.
 */
export function subsystems(
    health: SystemHealth | null,
    realtimeConnected: boolean,
): Subsystem[] {
    const services = health?.services;
    const probe = (
        status: string | undefined,
    ): { state: ServiceState; status: string } =>
        status === undefined
            ? { state: 'unknown', status: 'Not checked' }
            : status === 'operational'
              ? { state: 'ok', status: 'Operational' }
              : { state: 'danger', status: 'Offline' };

    const database = probe(services?.database.status);
    const cache = probe(services?.cache.status);
    const outboxFailed = services?.outbox.failed ?? 0;
    const failedJobs = services?.queues.failed_jobs ?? 0;
    const tracking = services?.tracking?.status;
    const broadcasting = services?.websockets?.status;

    return [
        {
            key: 'database',
            label: 'Database',
            ...database,
            value: latency(services?.database.latency_ms),
            detail: 'Query round trip',
        },
        {
            key: 'cache',
            label: 'Cache',
            ...cache,
            value: latency(services?.cache.latency_ms),
            detail: 'Write and read back',
        },
        {
            key: 'outbox',
            label: 'Dispatch outbox',
            state: !services ? 'unknown' : outboxFailed > 0 ? 'danger' : 'ok',
            status: !services
                ? 'Not checked'
                : outboxFailed > 0
                  ? 'Messages failed'
                  : 'Clear',
            value: services ? `${outboxFailed} failed` : '—',
            detail: services
                ? `${services.outbox.pending} waiting · ${services.outbox.delivered} delivered`
                : 'Message delivery',
        },
        {
            key: 'queues',
            label: 'Background jobs',
            state: !services ? 'unknown' : failedJobs > 0 ? 'danger' : 'ok',
            status: !services
                ? 'Not checked'
                : failedJobs > 0
                  ? 'Jobs failed'
                  : 'No failures',
            value: services ? plural(failedJobs, 'failed job') : '—',
            detail: 'Failed jobs waiting for a retry',
        },
        {
            key: 'tracking',
            label: 'Tracking service',
            state:
                tracking === undefined
                    ? 'unknown'
                    : tracking === 'not_applicable'
                      ? 'off'
                      : tracking === 'operational'
                        ? 'ok'
                        : 'danger',
            status:
                tracking === undefined
                    ? 'Not checked'
                    : tracking === 'not_applicable'
                      ? 'Built in'
                      : tracking === 'operational'
                        ? 'Operational'
                        : 'Offline',
            value:
                tracking === 'not_applicable'
                    ? 'In-app'
                    : latency(services?.tracking?.latency_ms),
            detail:
                tracking === 'not_applicable'
                    ? 'Runs inside Operations'
                    : 'Readiness probe',
        },
        {
            key: 'realtime',
            label: 'Live updates',
            state:
                broadcasting === 'disabled'
                    ? 'off'
                    : realtimeConnected
                      ? 'ok'
                      : 'warning',
            status:
                broadcasting === 'disabled'
                    ? 'Turned off'
                    : realtimeConnected
                      ? 'Connected'
                      : 'Disconnected',
            value:
                broadcasting === 'disabled'
                    ? 'Off'
                    : realtimeConnected
                      ? 'Live'
                      : 'Polling',
            detail:
                broadcasting === 'disabled'
                    ? 'Broadcasting is not configured'
                    : realtimeConnected
                      ? 'This browser is receiving updates'
                      : 'This browser refreshes every 15 s',
        },
    ];
}

/** Why the platform is not healthy, in the order an admin should fix it. */
export function healthCauses(health: SystemHealth | null): string[] {
    if (!health) {
        return [];
    }

    const { services } = health;
    const causes: string[] = [];

    if (services.database.status !== 'operational') {
        causes.push('Database offline');
    }

    if (services.cache.status !== 'operational') {
        causes.push('Cache offline');
    }

    if (
        services.tracking &&
        services.tracking.status !== 'operational' &&
        services.tracking.status !== 'not_applicable'
    ) {
        causes.push('Tracking service offline');
    }

    if (services.outbox.failed > 0) {
        causes.push(
            `${plural(services.outbox.failed, 'dispatch message')} failed`,
        );
    }

    if (services.queues.failed_jobs > 0) {
        causes.push(
            `${plural(services.queues.failed_jobs, 'background job')} failed`,
        );
    }

    return causes;
}

export function budgetShare(ai: AiGovernance | null): number | null {
    if (!ai || ai.monthly_budget_ceiling_usd <= 0) {
        return null;
    }

    return ai.monthly_spend_usd / ai.monthly_budget_ceiling_usd;
}

export function formatUsd(value: number): string {
    return value < 1 && value > 0
        ? `$${value.toFixed(4)}`
        : `$${value.toFixed(2)}`;
}

/** Everything that needs an admin decision, most urgent first. */
export function buildAttentionItems({
    health,
    healthError,
    credentials,
    accounts,
    ai,
}: {
    health: SystemHealth | null;
    healthError: string | null;
    credentials: CredentialSummary;
    accounts: AccountSummary;
    ai: AiGovernance | null;
}): AttentionItem[] {
    const items: AttentionItem[] = [];
    const causes = healthCauses(health);

    if (healthError) {
        items.push({
            id: 'health-error',
            tone: 'warning',
            title: 'Health checks are not reporting',
            detail: healthError,
        });
    } else if (health && health.status !== 'healthy') {
        items.push({
            id: 'health',
            tone: health.status === 'unhealthy' ? 'danger' : 'warning',
            title:
                health.status === 'unhealthy'
                    ? 'Platform is unhealthy'
                    : 'Platform is degraded',
            detail: causes.join(' · ') || 'A subsystem is not reporting.',
        });
    }

    if (credentials.expired.length > 0) {
        const people = new Set(credentials.expired.map((i) => i.user.id)).size;
        items.push({
            id: 'credentials-expired',
            tone: 'danger',
            title: `${plural(credentials.expired.length, 'credential')} expired`,
            detail: `${plural(people, 'person', 'people')} may not be dispatchable until renewed.`,
            action: {
                label: 'Review credentials',
                section: 'users',
                tab: 'credentials',
            },
        });
    }

    if (credentials.missing.length > 0) {
        items.push({
            id: 'credentials-missing',
            tone: 'warning',
            title: `${plural(credentials.missing.length, 'operator')} without credentials`,
            detail: credentials.missing
                .slice(0, 3)
                .map((user) => user.name)
                .join(', ')
                .concat(credentials.missing.length > 3 ? ', …' : ''),
            action: {
                label: 'Add credentials',
                section: 'users',
                tab: 'credentials',
            },
        });
    }

    if (credentials.expiring.length > 0) {
        items.push({
            id: 'credentials-expiring',
            tone: 'warning',
            title: `${plural(credentials.expiring.length, 'credential')} expiring soon`,
            detail: 'Renew before they lapse to keep crews dispatchable.',
            action: {
                label: 'Review credentials',
                section: 'users',
                tab: 'credentials',
            },
        });
    }

    if (ai?.circuit_breaker_active) {
        items.push({
            id: 'ai-paused',
            tone: 'warning',
            title: 'AI advice is paused',
            detail: 'Dispatchers get no AI suggestions until it is resumed.',
            action: {
                label: 'Open AI advisory',
                section: 'gpt-recommendations',
            },
        });
    }

    const share = budgetShare(ai);

    if (ai && share !== null && share >= BUDGET_WARNING_SHARE) {
        items.push({
            id: 'ai-budget',
            tone: share >= 1 ? 'danger' : 'warning',
            title:
                share >= 1
                    ? 'AI budget exceeded this month'
                    : `AI spend at ${Math.round(share * 100)}% of budget`,
            detail: `${formatUsd(ai.monthly_spend_usd)} of ${formatUsd(ai.monthly_budget_ceiling_usd)} this month.`,
            action: {
                label: 'Open AI advisory',
                section: 'gpt-recommendations',
            },
        });
    }

    if (accounts.suspended.length > 0) {
        items.push({
            id: 'accounts-suspended',
            tone: 'warning',
            title: `${plural(accounts.suspended.length, 'account')} suspended`,
            detail: 'Confirm each suspension is still intended.',
            action: { label: 'Review accounts', section: 'users' },
        });
    }

    return items.sort((a, b) =>
        a.tone === b.tone ? 0 : a.tone === 'danger' ? -1 : 1,
    );
}
