import { usePage } from '@inertiajs/react';
import {
    Activity,
    AlertCircle,
    ArrowRight,
    Building2,
    CalendarClock,
    CheckCircle2,
    Clock,
    Cpu,
    Database,
    FileText,
    Fuel,
    Layers,
    Lock,
    MapPin,
    Power,
    Radio,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Truck,
    Users,
    Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LiveTrackingPreview } from '@/components/dashboards/live-tracking-preview';
import { OperationsManagerDashboard } from '@/components/dashboards/manager/manager-dashboard';
import { Button, EmptyState, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { cn } from '@/lib/utils';
import type {
    ApprovalViewModel,
    AssetViewModel,
    AuditEventViewModel,
    ClientViewModel,
    DispatchJobViewModel,
    FuelRequestViewModel,
    GptRecommendationViewModel,
    LocationUpdateViewModel,
    ScopeRefreshState,
    ServiceRequestViewModel,
    SosIncidentViewModel,
    WorkspaceCapabilities,
    WorkspaceSection,
    WorkspaceUserViewModel,
} from '@/types/workspace';

function isFreshLocation(location: LocationUpdateViewModel): boolean {
    return location.freshness_status === 'fresh';
}

export interface OperationsOverviewDashboardProps {
    jobs: DispatchJobViewModel[];
    clients?: ClientViewModel[];
    serviceRequests?: ServiceRequestViewModel[];
    assets: AssetViewModel[];
    fuelRequests: FuelRequestViewModel[];
    locations: LocationUpdateViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    approvals: ApprovalViewModel[];
    users?: WorkspaceUserViewModel[];
    auditEvents?: AuditEventViewModel[];
    gptRecommendations?: GptRecommendationViewModel[];
    capabilities: WorkspaceCapabilities;
    availableSections: WorkspaceSection[];
    /** Full count of visible assets; `assets` may be a bounded sample. */
    assetsTotal?: number;
    refresh?: ScopeRefreshState;
    /** Workspace-level refresh state, used for the data freshness line. */
    workspaceRefresh?: ScopeRefreshState;
    realtimeConnected?: boolean;
    onSectionChange: (
        section: WorkspaceSection,
        options?: { serviceRequestId?: number },
    ) => void;
}

export function OperationsOverviewDashboard(
    props: OperationsOverviewDashboardProps,
) {
    const { auth } = usePage<{
        auth?: {
            user?: { id: number; name: string };
            role?: string;
            role_label?: string;
            prototype_role?: string;
        };
    }>().props;

    const canonicalRole = auth?.role ?? 'operations_manager';
    const isSystemAdmin = canonicalRole === 'system_administrator';
    const isFieldRole = FIELD_ROLES.includes(canonicalRole);

    if (!isSystemAdmin && !isFieldRole) {
        // Operations managers and other office roles share the manager view;
        // it renders its own heading, freshness state, and action queue.
        return (
            <div className="workspace-width-contained p-4 md:p-6">
                <OperationsManagerDashboard {...props} />
            </div>
        );
    }

    return (
        <div className="workspace-width-contained">
            {/* Perspective Header */}
            <DashboardHeader
                role={canonicalRole}
                onSectionChange={props.onSectionChange}
                availableSections={props.availableSections}
            />

            <div className="space-y-6 p-4 md:p-6">
                {isSystemAdmin ? (
                    <SystemAdminDashboardView {...props} />
                ) : (
                    <FieldWorkerDashboardView {...props} />
                )}
            </div>
        </div>
    );
}

const FIELD_ROLES = ['driver', 'crane_operator', 'field_worker'];

/* =========================================================================
   HEADER
   ========================================================================= */

function DashboardHeader({
    role,
    onSectionChange,
    availableSections,
}: {
    role: string;
    onSectionChange: (section: WorkspaceSection) => void;
    availableSections: WorkspaceSection[];
}) {
    const isSystemAdmin = role === 'system_administrator';
    const canOpenDispatch = availableSections.includes('dispatch');
    const canOpenUsers = availableSections.includes('users');

    return (
        <div className="border-b border-line bg-surface px-5 py-5 lg:px-7">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
                        Operation Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-ink-soft">
                        {isSystemAdmin
                            ? 'System infrastructure, user access governance, and telemetry health.'
                            : 'Assigned jobs, equipment status, and active field tasks.'}
                    </p>
                </div>

                <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto">
                    {/* Dynamic Context-Aware Action Button */}
                    {isSystemAdmin && canOpenUsers ? (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onSectionChange('users')}
                            className="gap-1.5 text-xs"
                        >
                            Manage users
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    ) : canOpenDispatch ? (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onSectionChange('dispatch')}
                            className="gap-1.5 text-xs"
                        >
                            Open today's work
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

/* =========================================================================
   2. SYSTEM ADMINISTRATOR DASHBOARD VIEW
   ========================================================================= */

function SystemAdminDashboardView({
    users = [],
    auditEvents = [],
    locations = [],
    activeSosIncidents = [],
    gptRecommendations = [],
    assets = [],
    refresh,
    realtimeConnected,
    availableSections,
    onSectionChange,
}: OperationsOverviewDashboardProps) {
    const [health, setHealth] = useState<{
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
            websockets: { driver: string; status: string };
        };
    } | null>(null);
    const [healthLoading, setHealthLoading] = useState(false);
    const [healthError, setHealthError] = useState<string | null>(null);

    const fetchHealth = () => {
        setHealthLoading(true);
        setHealthError(null);

        return fetch('/operations/admin/health', {
            headers: { Accept: 'application/json' },
        })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error(
                        `Health probe returned status ${res.status}`,
                    );
                }

                return res.json();
            })
            .then((data) => {
                if (data) {
                    setHealth(data);
                    setHealthError(null);
                }
            })
            .catch((err) => {
                setHealthError(
                    err instanceof Error
                        ? err.message
                        : 'Unable to connect to system health probe.',
                );
            })
            .finally(() => setHealthLoading(false));
    };

    useEffect(() => {
        let isMounted = true;

        const load = () => {
            fetch('/operations/admin/health', {
                headers: { Accept: 'application/json' },
            })
                .then(async (res) => {
                    if (!res.ok) {
                        throw new Error(
                            `Health probe returned status ${res.status}`,
                        );
                    }

                    return res.json();
                })
                .then((data) => {
                    if (data && isMounted) {
                        setHealth(data);
                        setHealthError(null);
                    }
                })
                .catch((err) => {
                    if (isMounted) {
                        setHealthError(
                            err instanceof Error
                                ? err.message
                                : 'Unable to connect to system health probe.',
                        );
                    }
                });
        };

        load();
        const interval = setInterval(load, 30_000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const freshLocationsCount = locations.filter(isFreshLocation).length;
    const activeUsersCount = users.filter((u) => u.is_active).length;
    const suspendedUsers = users.filter((u) => !u.is_active || u.suspended_at);

    // Credential Compliance Radar
    const allUserCredentials = useMemo(() => {
        return users.flatMap((u) =>
            (u.credentials || []).map((c) => ({
                user: u,
                credential: c,
            })),
        );
    }, [users]);

    const expiredCredentials = useMemo(() => {
        return allUserCredentials.filter((x) => x.credential.is_expired);
    }, [allUserCredentials]);

    const expiringSoonCredentials = useMemo(() => {
        return allUserCredentials.filter(
            (x) => x.credential.expires_soon && !x.credential.is_expired,
        );
    }, [allUserCredentials]);

    // Compliance radar filter state
    const [radarFilter, setRadarFilter] = useState<
        'all' | 'expired' | 'expiring' | 'suspended'
    >('all');

    const totalComplianceIssues =
        expiredCredentials.length +
        expiringSoonCredentials.length +
        suspendedUsers.length;

    // GPT AI Circuit Breaker Killswitch
    const [circuitBreakerActive, setCircuitBreakerActive] = useState(false);
    const [togglingCircuitBreaker, setTogglingCircuitBreaker] = useState(false);
    const [circuitBreakerError, setCircuitBreakerError] = useState<
        string | null
    >(null);

    const toggleCircuitBreaker = async () => {
        setTogglingCircuitBreaker(true);
        setCircuitBreakerError(null);

        try {
            const token = (
                document.querySelector(
                    'meta[name="csrf-token"]',
                ) as HTMLMetaElement
            )?.content;
            const res = await fetch('/operations/gpt-circuit-breaker/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);

                throw new Error(
                    errData?.message ||
                        `Circuit breaker toggle failed (HTTP ${res.status}).`,
                );
            }

            const data = await res.json();
            setCircuitBreakerActive(Boolean(data.circuit_breaker_active));
        } catch (err) {
            setCircuitBreakerError(
                err instanceof Error
                    ? err.message
                    : 'Failed to toggle GPT advisory circuit breaker.',
            );
        } finally {
            setTogglingCircuitBreaker(false);
        }
    };

    // GPT AI Advisory Telemetry
    const gptStats = useMemo(() => {
        const approved = gptRecommendations.filter(
            (r) => r.status === 'approved' || r.status === 'accepted',
        ).length;
        const rejected = gptRecommendations.filter(
            (r) => r.status === 'rejected' || r.status === 'dismissed',
        ).length;
        const pending = gptRecommendations.filter(
            (r) => r.status === 'pending',
        ).length;
        const totalActualCost = gptRecommendations.reduce(
            (sum, r) => sum + (r.cost_usd ?? 0.0045),
            0,
        );
        const estimatedCost = Number(totalActualCost.toFixed(2));
        const monthlyLimit = 50.0;
        const limitPercentage = Math.min(
            100,
            Math.round((estimatedCost / monthlyLimit) * 100),
        );

        return {
            total: gptRecommendations.length,
            approved,
            rejected,
            pending,
            estimatedCost,
            monthlyLimit,
            limitPercentage,
        };
    }, [gptRecommendations]);

    // Fleet & Safety Governance
    const assetsNeedingAttention = useMemo(() => {
        return assets.filter(
            (a) =>
                a.status.value === 'maintenance' ||
                a.status.value === 'unavailable' ||
                a.blocking_work_orders_count > 0,
        );
    }, [assets]);

    const canOpenUsers = availableSections.includes('users');
    const canOpenAudit = availableSections.includes('audit');
    const canOpenTracking = availableSections.includes('assets');
    const canOpenGpt = availableSections.includes('gpt-recommendations');
    const canOpenDispatch = availableSections.includes('dispatch');

    // Role Distribution Summary
    const rolesDistribution = users.reduce(
        (acc, user) => {
            const roleKey = user.role ?? 'unassigned';
            acc[roleKey] = (acc[roleKey] ?? 0) + 1;

            return acc;
        },
        {} as Record<string, number>,
    );

    return (
        <div className="space-y-6">
            {/* Modern Streamlined Command Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface p-1.5 shadow-2xs">
                {canOpenUsers && (
                    <button
                        type="button"
                        onClick={() => onSectionChange('users')}
                        className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                    >
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Users &amp; Credentials</span>
                        {expiredCredentials.length > 0 && (
                            <span className="ml-1 inline-flex items-center rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-danger-strong">
                                {expiredCredentials.length} expired
                            </span>
                        )}
                    </button>
                )}
                {canOpenAudit && (
                    <button
                        type="button"
                        onClick={() => onSectionChange('audit')}
                        className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                    >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Audit Trail &amp; Diffs</span>
                    </button>
                )}
                {canOpenGpt && (
                    <button
                        type="button"
                        onClick={() => onSectionChange('gpt-recommendations')}
                        className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                    >
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>AI Advisory Governance</span>
                    </button>
                )}
                {canOpenDispatch && (
                    <button
                        type="button"
                        onClick={() => onSectionChange('dispatch')}
                        className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                    >
                        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Dispatch Workspace</span>
                    </button>
                )}
                {canOpenTracking && (
                    <button
                        type="button"
                        onClick={() => onSectionChange('assets')}
                        className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                    >
                        <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Fleet &amp; Telemetry</span>
                        {locations.length > 0 && (
                            <span className="ml-1 inline-flex items-center rounded-full bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                                {freshLocationsCount}/{locations.length} live
                            </span>
                        )}
                        {assetsNeedingAttention.length > 0 && (
                            <span className="ml-1 inline-flex items-center rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning-strong">
                                {assetsNeedingAttention.length} attention
                            </span>
                        )}
                    </button>
                )}
            </div>

            {/* System Admin Primary KPIs */}
            <MetricStrip>
                <KpiCard
                    label="Platform Health"
                    value={
                        healthLoading && !health
                            ? 'Checking…'
                            : healthError
                              ? 'Unavailable'
                              : health?.status === 'healthy'
                                ? 'Healthy'
                                : health?.status === 'degraded'
                                  ? 'Degraded'
                                  : health?.status === 'unhealthy'
                                    ? 'Unhealthy'
                                    : 'Operational'
                    }
                    subtext={
                        healthError
                            ? healthError
                            : health?.services.database.latency_ms !== null &&
                                health?.services.database.latency_ms !==
                                    undefined
                              ? `${health.services.database.latency_ms} ms query latency`
                              : healthLoading
                                ? 'Connecting to health probes…'
                                : 'Probes and synthetic health active'
                    }
                    icon={Cpu}
                    tone={
                        healthError || health?.status === 'unhealthy'
                            ? 'danger'
                            : health?.status === 'degraded'
                              ? 'warning'
                              : 'success'
                    }
                    liveIndicator={health?.status === 'healthy' && !healthError}
                    onClick={() => void fetchHealth()}
                />

                <KpiCard
                    label="Active User Accounts"
                    value={`${activeUsersCount} / ${users.length}`}
                    subtext={
                        suspendedUsers.length > 0
                            ? `${suspendedUsers.length} account(s) suspended`
                            : 'All accounts verified'
                    }
                    icon={Users}
                    tone={suspendedUsers.length > 0 ? 'warning' : 'default'}
                    onClick={
                        canOpenUsers
                            ? () => onSectionChange('users')
                            : undefined
                    }
                />

                <KpiCard
                    label="AI Governance & Spend"
                    value={`$${gptStats.estimatedCost.toFixed(2)}`}
                    subtext={`$${gptStats.monthlyLimit.toFixed(2)} ceiling · ${gptStats.total} items`}
                    icon={Sparkles}
                    tone="default"
                    onClick={
                        canOpenGpt
                            ? () => onSectionChange('gpt-recommendations')
                            : undefined
                    }
                />

                <KpiCard
                    label="Audit Trail Events"
                    value={`${auditEvents.length}`}
                    subtext="Real-time access log"
                    icon={FileText}
                    tone="default"
                    onClick={
                        canOpenAudit
                            ? () => onSectionChange('audit')
                            : undefined
                    }
                />
            </MetricStrip>

            {/* Infrastructure Health & Outbox Diagnostics Panel */}
            <Panel className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-base font-semibold tracking-tight text-ink">
                            Infrastructure &amp; Telemetry Subsystems
                        </h2>
                        <span
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                                health?.status === 'healthy'
                                    ? 'bg-success-soft text-success-strong'
                                    : health?.status === 'degraded'
                                      ? 'bg-warning-soft text-warning-strong'
                                      : health?.status === 'unhealthy'
                                        ? 'bg-danger-soft text-danger-strong'
                                        : 'bg-surface-subtle text-ink-soft',
                            )}
                        >
                            <span
                                className={cn(
                                    'h-1.5 w-1.5 rounded-full',
                                    health?.status === 'healthy'
                                        ? 'bg-success'
                                        : health?.status === 'degraded'
                                          ? 'bg-warning'
                                          : health?.status === 'unhealthy'
                                            ? 'bg-danger'
                                            : 'bg-muted',
                                )}
                            />
                            {health?.status
                                ? health.status.toUpperCase()
                                : 'CHECKING'}
                        </span>
                    </div>

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void fetchHealth()}
                        disabled={healthLoading}
                        className="gap-1.5 text-xs"
                    >
                        <RefreshCw
                            className={cn(
                                'h-3.5 w-3.5',
                                healthLoading && 'animate-spin',
                            )}
                            aria-hidden="true"
                        />
                        {healthLoading ? 'Pinging…' : 'Refresh Health'}
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-px overflow-hidden bg-line sm:grid-cols-2 lg:grid-cols-4">
                    {/* Database */}
                    <div className="bg-surface p-4 sm:p-5">
                        <div className="flex items-center justify-between text-xs font-medium text-ink-soft">
                            <span className="flex items-center gap-1.5">
                                <Database
                                    className="h-4 w-4 text-muted"
                                    aria-hidden="true"
                                />
                                Relational Database
                            </span>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1 text-[11px] font-medium',
                                    healthLoading && !health
                                        ? 'text-ink-soft'
                                        : health?.services.database.status ===
                                            'operational'
                                          ? 'text-success-strong'
                                          : health?.services.database.status ===
                                              'offline'
                                            ? 'text-danger-strong'
                                            : healthError
                                              ? 'text-warning-strong'
                                              : 'text-success-strong',
                                )}
                            >
                                <span
                                    className={cn(
                                        'h-1.5 w-1.5 rounded-full',
                                        healthLoading && !health
                                            ? 'bg-muted'
                                            : health?.services.database
                                                    .status === 'operational'
                                              ? 'bg-success'
                                              : health?.services.database
                                                      .status === 'offline'
                                                ? 'bg-danger'
                                                : healthError
                                                  ? 'bg-warning'
                                                  : 'bg-success',
                                    )}
                                />
                                {healthLoading && !health
                                    ? 'Checking…'
                                    : health?.services.database.status ===
                                        'operational'
                                      ? 'Operational'
                                      : health?.services.database.status ===
                                          'offline'
                                        ? 'Offline'
                                        : healthError
                                          ? 'Unavailable'
                                          : 'Operational'}
                            </span>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-xl font-semibold tracking-tight text-ink tabular-nums">
                                {health?.services.database.latency_ms !==
                                    null &&
                                health?.services.database.latency_ms !==
                                    undefined
                                    ? `${health.services.database.latency_ms} ms`
                                    : healthLoading && !health
                                      ? 'Checking…'
                                      : '—'}
                            </span>
                            <span className="text-xs text-ink-soft">
                                Query Latency
                            </span>
                        </div>
                    </div>

                    {/* Cache & Redis */}
                    <div className="bg-surface p-4 sm:p-5">
                        <div className="flex items-center justify-between text-xs font-medium text-ink-soft">
                            <span className="flex items-center gap-1.5">
                                <Zap
                                    className="h-4 w-4 text-muted"
                                    aria-hidden="true"
                                />
                                Distributed Cache
                            </span>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1 text-[11px] font-medium',
                                    healthLoading && !health
                                        ? 'text-ink-soft'
                                        : health?.services.cache.status ===
                                            'operational'
                                          ? 'text-success-strong'
                                          : health?.services.cache.status ===
                                              'offline'
                                            ? 'text-danger-strong'
                                            : healthError
                                              ? 'text-warning-strong'
                                              : 'text-success-strong',
                                )}
                            >
                                <span
                                    className={cn(
                                        'h-1.5 w-1.5 rounded-full',
                                        healthLoading && !health
                                            ? 'bg-muted'
                                            : health?.services.cache.status ===
                                                'operational'
                                              ? 'bg-success'
                                              : health?.services.cache
                                                      .status === 'offline'
                                                ? 'bg-danger'
                                                : healthError
                                                  ? 'bg-warning'
                                                  : 'bg-success',
                                    )}
                                />
                                {healthLoading && !health
                                    ? 'Checking…'
                                    : health?.services.cache.status ===
                                        'operational'
                                      ? 'Operational'
                                      : health?.services.cache.status ===
                                          'offline'
                                        ? 'Offline'
                                        : healthError
                                          ? 'Unavailable'
                                          : 'Operational'}
                            </span>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-xl font-semibold tracking-tight text-ink tabular-nums">
                                {health?.services.cache.latency_ms !== null &&
                                health?.services.cache.latency_ms !== undefined
                                    ? `${health.services.cache.latency_ms} ms`
                                    : healthLoading && !health
                                      ? 'Checking…'
                                      : '—'}
                            </span>
                            <span className="text-xs text-ink-soft">
                                Cache Ping
                            </span>
                        </div>
                    </div>

                    {/* Transactional Outbox & DLQ */}
                    <div className="bg-surface p-4 sm:p-5">
                        <div className="flex items-center justify-between text-xs font-medium text-ink-soft">
                            <span className="flex items-center gap-1.5">
                                <Layers
                                    className="h-4 w-4 text-muted"
                                    aria-hidden="true"
                                />
                                Outbox / DLQ
                            </span>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1 text-[11px] font-medium',
                                    healthLoading && !health
                                        ? 'text-ink-soft'
                                        : (health?.services.outbox.failed ??
                                                0) > 0
                                          ? 'text-danger-strong'
                                          : healthError
                                            ? 'text-warning-strong'
                                            : 'text-success-strong',
                                )}
                            >
                                <span
                                    className={cn(
                                        'h-1.5 w-1.5 rounded-full',
                                        healthLoading && !health
                                            ? 'bg-muted'
                                            : (health?.services.outbox.failed ??
                                                    0) > 0
                                              ? 'bg-danger'
                                              : healthError
                                                ? 'bg-warning'
                                                : 'bg-success',
                                    )}
                                />
                                {healthLoading && !health
                                    ? 'Checking…'
                                    : (health?.services.outbox.failed ?? 0) > 0
                                      ? 'Dead-Letters'
                                      : healthError
                                        ? 'Unknown'
                                        : 'Clean'}
                            </span>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-xl font-semibold tracking-tight text-ink tabular-nums">
                                {healthLoading && !health
                                    ? 'Checking…'
                                    : typeof health?.services.outbox.failed ===
                                        'number'
                                      ? `${health.services.outbox.failed} Failed`
                                      : '—'}
                            </span>
                            <span className="text-xs text-ink-soft">
                                {typeof health?.services.outbox.pending ===
                                'number'
                                    ? `${health.services.outbox.pending} pending · ${health.services.outbox.delivered} delivered`
                                    : 'Outbox queue telemetry'}
                            </span>
                        </div>
                    </div>

                    {/* Queues & Background Workers */}
                    <div className="bg-surface p-4 sm:p-5">
                        <div className="flex items-center justify-between text-xs font-medium text-ink-soft">
                            <span className="flex items-center gap-1.5">
                                <Activity
                                    className="h-4 w-4 text-muted"
                                    aria-hidden="true"
                                />
                                Async Workers
                            </span>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1 text-[11px] font-medium',
                                    healthLoading && !health
                                        ? 'text-ink-soft'
                                        : (health?.services.queues
                                                .failed_jobs ?? 0) > 0
                                          ? 'text-danger-strong'
                                          : healthError
                                            ? 'text-warning-strong'
                                            : 'text-success-strong',
                                )}
                            >
                                <span
                                    className={cn(
                                        'h-1.5 w-1.5 rounded-full',
                                        healthLoading && !health
                                            ? 'bg-muted'
                                            : (health?.services.queues
                                                    .failed_jobs ?? 0) > 0
                                              ? 'bg-danger'
                                              : healthError
                                                ? 'bg-warning'
                                                : 'bg-success',
                                    )}
                                />
                                {healthLoading && !health
                                    ? 'Checking…'
                                    : (health?.services.queues.failed_jobs ??
                                            0) > 0
                                      ? 'Jobs Failed'
                                      : healthError
                                        ? 'Unknown'
                                        : 'Healthy'}
                            </span>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-xl font-semibold tracking-tight text-ink tabular-nums">
                                {healthLoading && !health
                                    ? 'Checking…'
                                    : typeof health?.services.queues
                                            .failed_jobs === 'number'
                                      ? `${health.services.queues.failed_jobs} Failed`
                                      : '—'}
                            </span>
                            <span className="text-xs text-ink-soft">
                                Background Queue
                            </span>
                        </div>
                    </div>
                </div>
            </Panel>

            {/* Live GPS Telemetry & Fleet Tracking Map Preview */}
            {canOpenTracking && (
                <LiveTrackingPreview
                    locations={locations}
                    activeSosIncidents={activeSosIncidents}
                    refresh={refresh}
                    realtimeConnected={realtimeConnected}
                    onOpenTracking={() => onSectionChange('assets')}
                />
            )}

            {/* Governance, Security Radar & Role Distribution Grid */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.85fr)]">
                {/* Left Column: Security & Credentials + GPT Governance */}
                <div className="space-y-6">
                    {/* Security & Personnel Qualification Radar */}
                    <section aria-labelledby="admin-security-heading">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2
                                    id="admin-security-heading"
                                    className="text-base font-semibold tracking-tight text-ink"
                                >
                                    Security &amp; Qualification Compliance
                                    Radar
                                </h2>
                                <p className="mt-0.5 text-xs text-ink-soft">
                                    Operator licensing, safety certifications,
                                    and account status governance.
                                </p>
                            </div>
                            {totalComplianceIssues > 0 && (
                                <div
                                    className="flex flex-wrap gap-1 rounded-lg bg-surface-subtle p-1 text-xs"
                                    role="group"
                                    aria-label="Filter credentials"
                                >
                                    <button
                                        type="button"
                                        aria-pressed={radarFilter === 'all'}
                                        onClick={() => setRadarFilter('all')}
                                        className={cn(
                                            'min-h-7 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                                            radarFilter === 'all'
                                                ? 'bg-surface font-semibold text-ink shadow-xs'
                                                : 'text-ink-soft hover:text-ink',
                                        )}
                                    >
                                        All ({totalComplianceIssues})
                                    </button>
                                    {expiredCredentials.length > 0 && (
                                        <button
                                            type="button"
                                            aria-pressed={
                                                radarFilter === 'expired'
                                            }
                                            onClick={() =>
                                                setRadarFilter('expired')
                                            }
                                            className={cn(
                                                'min-h-7 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                                                radarFilter === 'expired'
                                                    ? 'bg-surface font-semibold text-danger shadow-xs'
                                                    : 'text-danger hover:text-danger-strong',
                                            )}
                                        >
                                            Expired ({expiredCredentials.length}
                                            )
                                        </button>
                                    )}
                                    {expiringSoonCredentials.length > 0 && (
                                        <button
                                            type="button"
                                            aria-pressed={
                                                radarFilter === 'expiring'
                                            }
                                            onClick={() =>
                                                setRadarFilter('expiring')
                                            }
                                            className={cn(
                                                'min-h-7 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                                                radarFilter === 'expiring'
                                                    ? 'bg-surface font-semibold text-warning-strong shadow-xs'
                                                    : 'text-warning-strong hover:text-ink',
                                            )}
                                        >
                                            Expiring (
                                            {expiringSoonCredentials.length})
                                        </button>
                                    )}
                                    {suspendedUsers.length > 0 && (
                                        <button
                                            type="button"
                                            aria-pressed={
                                                radarFilter === 'suspended'
                                            }
                                            onClick={() =>
                                                setRadarFilter('suspended')
                                            }
                                            className={cn(
                                                'min-h-7 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                                                radarFilter === 'suspended'
                                                    ? 'bg-surface font-semibold text-ink shadow-xs'
                                                    : 'text-ink-soft hover:text-ink',
                                            )}
                                        >
                                            Suspended ({suspendedUsers.length})
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <Panel className="overflow-hidden">
                            {totalComplianceIssues === 0 ? (
                                <div className="flex items-center gap-3 p-4 text-xs text-ink-soft">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success-strong">
                                        <CheckCircle2
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-ink">
                                            100% Qualification &amp; Account
                                            Compliance
                                        </p>
                                        <p>
                                            All registered operators possess
                                            verified, non-expired credentials.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-line">
                                    {(radarFilter === 'all' ||
                                        radarFilter === 'expired') &&
                                        expiredCredentials.map(
                                            ({ user, credential }) => (
                                                <div
                                                    key={`exp-${user.id}-${credential.id}`}
                                                    className="flex items-center justify-between gap-3 p-3.5 text-xs transition-colors hover:bg-surface-subtle/50"
                                                >
                                                    <div className="flex min-w-0 items-center gap-2.5">
                                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-danger-soft text-danger-strong">
                                                            <AlertCircle
                                                                className="h-3.5 w-3.5"
                                                                aria-hidden="true"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="inline-flex items-center rounded-md bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-danger-strong">
                                                                    Expired
                                                                </span>
                                                                <p className="truncate font-semibold text-ink">
                                                                    {
                                                                        credential.kind
                                                                    }{' '}
                                                                    (
                                                                    {
                                                                        credential.credential_type
                                                                    }
                                                                    )
                                                                </p>
                                                            </div>
                                                            <p className="mt-0.5 truncate text-[11px] text-ink-soft">
                                                                Assigned to{' '}
                                                                {user.name} (
                                                                {user.role_label ??
                                                                    user.role}
                                                                ) · Expired on{' '}
                                                                {
                                                                    credential.expires_at
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {canOpenUsers && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                onSectionChange(
                                                                    'users',
                                                                )
                                                            }
                                                            className="shrink-0 text-xs font-semibold text-brand-strong transition-colors hover:text-ink"
                                                        >
                                                            Renew / Verify →
                                                        </button>
                                                    )}
                                                </div>
                                            ),
                                        )}

                                    {(radarFilter === 'all' ||
                                        radarFilter === 'expiring') &&
                                        expiringSoonCredentials.map(
                                            ({ user, credential }) => (
                                                <div
                                                    key={`soon-${user.id}-${credential.id}`}
                                                    className="flex items-center justify-between gap-3 p-3.5 text-xs transition-colors hover:bg-surface-subtle/50"
                                                >
                                                    <div className="flex min-w-0 items-center gap-2.5">
                                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning-strong">
                                                            <Clock
                                                                className="h-3.5 w-3.5"
                                                                aria-hidden="true"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="inline-flex items-center rounded-md bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning-strong">
                                                                    Expiring
                                                                    Soon
                                                                </span>
                                                                <p className="truncate font-semibold text-ink">
                                                                    {
                                                                        credential.kind
                                                                    }{' '}
                                                                    (
                                                                    {
                                                                        credential.credential_type
                                                                    }
                                                                    )
                                                                </p>
                                                            </div>
                                                            <p className="mt-0.5 truncate text-[11px] text-ink-soft">
                                                                Assigned to{' '}
                                                                {user.name} ·
                                                                Expires on{' '}
                                                                {
                                                                    credential.expires_at
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {canOpenUsers && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                onSectionChange(
                                                                    'users',
                                                                )
                                                            }
                                                            className="shrink-0 text-xs font-semibold text-brand-strong transition-colors hover:text-ink"
                                                        >
                                                            Inspect →
                                                        </button>
                                                    )}
                                                </div>
                                            ),
                                        )}

                                    {(radarFilter === 'all' ||
                                        radarFilter === 'suspended') &&
                                        suspendedUsers.map((user) => (
                                            <div
                                                key={`susp-${user.id}`}
                                                className="flex items-center justify-between gap-3 p-3.5 text-xs transition-colors hover:bg-surface-subtle/50"
                                            >
                                                <div className="flex min-w-0 items-center gap-2.5">
                                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-ink-soft">
                                                        <Lock
                                                            className="h-3.5 w-3.5"
                                                            aria-hidden="true"
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="inline-flex items-center rounded-md bg-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                                                                Suspended
                                                            </span>
                                                            <p className="truncate font-semibold text-ink">
                                                                {user.name}
                                                            </p>
                                                        </div>
                                                        <p className="mt-0.5 truncate text-[11px] text-ink-soft">
                                                            {user.email} ·
                                                            Suspended on{' '}
                                                            {user.suspended_at ??
                                                                'deactivated'}
                                                        </p>
                                                    </div>
                                                </div>
                                                {canOpenUsers && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onSectionChange(
                                                                'users',
                                                            )
                                                        }
                                                        className="shrink-0 text-xs font-semibold text-brand-strong transition-colors hover:text-ink"
                                                    >
                                                        Manage Access →
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            )}
                        </Panel>
                    </section>

                    {/* GPT AI Advisory Governance Panel */}
                    <section aria-labelledby="admin-gpt-heading">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <h2
                                    id="admin-gpt-heading"
                                    className="text-base font-semibold tracking-tight text-ink"
                                >
                                    AI Advisory &amp; Spend Governance
                                </h2>
                                <p className="mt-0.5 text-xs text-ink-soft">
                                    Token budget tracking, circuit breaker, and
                                    recommendation throughput.
                                </p>
                            </div>
                            {canOpenGpt && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                        onSectionChange('gpt-recommendations')
                                    }
                                    className="text-xs"
                                >
                                    Open Governance →
                                </Button>
                            )}
                        </div>

                        <Panel className="space-y-4 p-4">
                            {/* Circuit Breaker Killswitch Banner */}
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-subtle p-3">
                                <div className="flex items-center gap-2.5">
                                    <span
                                        className={cn(
                                            'flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold',
                                            circuitBreakerActive
                                                ? 'bg-danger-soft text-danger-strong'
                                                : 'bg-success-soft text-success-strong',
                                        )}
                                    >
                                        <Power className="h-3.5 w-3.5" />
                                    </span>
                                    <div>
                                        <p className="text-xs font-semibold text-ink">
                                            Circuit Breaker:{' '}
                                            <span
                                                className={
                                                    circuitBreakerActive
                                                        ? 'font-bold text-danger-strong'
                                                        : 'font-semibold text-success-strong'
                                                }
                                            >
                                                {circuitBreakerActive
                                                    ? 'Paused / Tripped'
                                                    : 'Active / Operational'}
                                            </span>
                                        </p>
                                        <p className="text-[11px] text-ink-soft">
                                            {circuitBreakerActive
                                                ? 'Advisory generation halted to prevent token budget overruns.'
                                                : 'Real-time telemetry advisory active.'}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant={
                                        circuitBreakerActive
                                            ? 'primary'
                                            : 'secondary'
                                    }
                                    size="sm"
                                    onClick={toggleCircuitBreaker}
                                    disabled={togglingCircuitBreaker}
                                    className="gap-1.5 text-xs"
                                >
                                    <Power className="h-3 w-3" />
                                    {circuitBreakerActive
                                        ? 'Resume AI Generation'
                                        : 'Emergency Killswitch'}
                                </Button>
                            </div>

                            {circuitBreakerError && (
                                <div className="rounded-lg border border-danger/30 bg-danger-soft/60 p-2.5 text-xs text-danger-strong">
                                    {circuitBreakerError}
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-ink">
                                        Monthly Token Budget Spend
                                    </span>
                                    <span className="font-semibold text-ink tabular-nums">
                                        ${gptStats.estimatedCost.toFixed(2)} / $
                                        {gptStats.monthlyLimit.toFixed(2)} (
                                        {gptStats.limitPercentage}%)
                                    </span>
                                </div>
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                                    <div
                                        className={cn(
                                            'h-full rounded-full transition-all',
                                            gptStats.limitPercentage > 85
                                                ? 'bg-danger'
                                                : gptStats.limitPercentage > 60
                                                  ? 'bg-warning'
                                                  : 'bg-brand',
                                        )}
                                        style={{
                                            width: `${Math.max(2, gptStats.limitPercentage)}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-surface-subtle/30 text-center text-xs">
                                <div className="p-2.5">
                                    <p className="text-[11px] font-medium text-ink-soft">
                                        Accepted
                                    </p>
                                    <p className="mt-0.5 text-base font-semibold text-success-strong tabular-nums">
                                        {gptStats.approved}
                                    </p>
                                </div>
                                <div className="p-2.5">
                                    <p className="text-[11px] font-medium text-ink-soft">
                                        Pending
                                    </p>
                                    <p className="mt-0.5 text-base font-semibold text-ink tabular-nums">
                                        {gptStats.pending}
                                    </p>
                                </div>
                                <div className="p-2.5">
                                    <p className="text-[11px] font-medium text-ink-soft">
                                        Rejected
                                    </p>
                                    <p className="mt-0.5 text-base font-semibold text-ink-soft tabular-nums">
                                        {gptStats.rejected}
                                    </p>
                                </div>
                            </div>
                        </Panel>
                    </section>
                </div>

                {/* Right Column: Forensic Audit Stream & Role Distribution */}
                <div className="space-y-6">
                    {/* Role Distribution Panel */}
                    <section aria-labelledby="admin-users-heading">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <h2
                                    id="admin-users-heading"
                                    className="text-base font-semibold tracking-tight text-ink"
                                >
                                    Operational Role Distribution
                                </h2>
                                <p className="mt-0.5 text-xs text-ink-soft">
                                    Active accounts partitioned by RBAC role.
                                </p>
                            </div>
                            {canOpenUsers && (
                                <button
                                    type="button"
                                    onClick={() => onSectionChange('users')}
                                    className="text-xs font-semibold text-brand-strong transition-colors hover:text-ink"
                                >
                                    Manage →
                                </button>
                            )}
                        </div>

                        <Panel className="divide-y divide-line">
                            <ReadinessRow
                                label="Operations Managers"
                                value={String(
                                    rolesDistribution['operations_manager'] ??
                                        0,
                                )}
                                detail="Dispatch, scheduling & operational control"
                                icon={ShieldCheck}
                                onClick={
                                    canOpenUsers
                                        ? () => onSectionChange('users')
                                        : undefined
                                }
                            />
                            <ReadinessRow
                                label="System Administrators"
                                value={String(
                                    rolesDistribution['system_administrator'] ??
                                        0,
                                )}
                                detail="Platform health & security governance"
                                icon={Cpu}
                                onClick={
                                    canOpenUsers
                                        ? () => onSectionChange('users')
                                        : undefined
                                }
                            />
                            <ReadinessRow
                                label="Operators"
                                value={String(
                                    (rolesDistribution['crane_operator'] ?? 0) +
                                        (rolesDistribution['operator'] ?? 0),
                                )}
                                detail="Field crane & heavy equipment execution"
                                icon={Truck}
                                onClick={
                                    canOpenUsers
                                        ? () => onSectionChange('users')
                                        : undefined
                                }
                            />
                            {((rolesDistribution['rigger'] ?? 0) > 0 ||
                                (rolesDistribution['driver'] ?? 0) > 0 ||
                                (rolesDistribution['field_worker'] ?? 0) >
                                    0) && (
                                <ReadinessRow
                                    label="Riggers & Support Crew"
                                    value={String(
                                        (rolesDistribution['rigger'] ?? 0) +
                                            (rolesDistribution['driver'] ?? 0) +
                                            (rolesDistribution[
                                                'field_worker'
                                            ] ?? 0),
                                    )}
                                    detail="Field rigging, signaling & transport support"
                                    icon={Users}
                                    onClick={
                                        canOpenUsers
                                            ? () => onSectionChange('users')
                                            : undefined
                                    }
                                />
                            )}
                        </Panel>
                    </section>

                    {/* Audit Trail Stream */}
                    <section
                        className="min-w-0"
                        aria-labelledby="admin-audit-heading"
                    >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2
                                    id="admin-audit-heading"
                                    className="text-base font-semibold tracking-tight text-ink"
                                >
                                    Forensic Audit Activity Log
                                </h2>
                                <p className="mt-0.5 text-xs text-ink-soft">
                                    Real-time platform overrides, credential
                                    edits, and access changes.
                                </p>
                            </div>
                            {canOpenAudit && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onSectionChange('audit')}
                                    className="text-xs"
                                >
                                    Full Audit Explorer →
                                </Button>
                            )}
                        </div>

                        <Panel className="overflow-hidden">
                            {auditEvents.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={FileText}
                                    title="No audit events recorded"
                                    message="Audit log records will appear here as system actions take place."
                                />
                            ) : (
                                <ul className="divide-y divide-line">
                                    {auditEvents.slice(0, 5).map((event) => {
                                        const act = event.action.toLowerCase();
                                        const isHighRisk =
                                            act.includes('abort') ||
                                            act.includes('lockdown') ||
                                            act.includes('emergency') ||
                                            act.includes('delete');
                                        const isMediumRisk =
                                            act.includes('suspend') ||
                                            act.includes('role') ||
                                            act.includes('permission') ||
                                            act.includes('credential');

                                        return (
                                            <li
                                                key={event.id}
                                                className="flex items-start justify-between gap-3 p-3.5 text-xs"
                                            >
                                                <div className="min-w-0 space-y-0.5">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span
                                                            className={cn(
                                                                'font-bold',
                                                                isHighRisk
                                                                    ? 'text-danger'
                                                                    : isMediumRisk
                                                                      ? 'text-warning-strong'
                                                                      : 'text-ink',
                                                            )}
                                                        >
                                                            {event.action}
                                                        </span>
                                                        {event.actor && (
                                                            <span className="rounded bg-surface-subtle px-1.5 py-0.5 text-[11px] text-ink-soft">
                                                                by{' '}
                                                                {
                                                                    event.actor
                                                                        .name
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                    {event.reason && (
                                                        <p className="truncate text-ink-soft">
                                                            {event.reason}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="shrink-0 text-[11px] font-medium text-muted">
                                                    {formatSchedule(
                                                        event.occurred_at,
                                                    )}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </Panel>
                    </section>
                </div>
            </div>
        </div>
    );
}

/* =========================================================================
   4. OPERATOR DASHBOARD VIEW
   ========================================================================= */

function FieldWorkerDashboardView({
    jobs,
    assets,
    fuelRequests,
    locations,
    capabilities,
    availableSections,
    onSectionChange,
}: OperationsOverviewDashboardProps) {
    const activeJobs = jobs.filter((job) =>
        ['dispatched', 'accepted', 'en_route', 'arrived', 'working'].includes(
            job.status.value,
        ),
    );

    const canOpenDispatch = availableSections.includes('dispatch');
    const canOpenFuel = availableSections.includes('fuel');
    const canOpenTracking = availableSections.includes('assets');

    const freshLocations = locations.filter(isFreshLocation).length;

    return (
        <div className="space-y-6">
            {/* Operator KPIs */}
            <MetricStrip>
                <KpiCard
                    label="Today's Work"
                    value={`${jobs.length}`}
                    subtext={`${activeJobs.length} active in field`}
                    icon={CalendarClock}
                    tone="brand"
                    onClick={
                        canOpenDispatch
                            ? () => onSectionChange('dispatch')
                            : undefined
                    }
                />

                <KpiCard
                    label="Assigned Vehicles & Assets"
                    value={`${assets.length}`}
                    subtext="Shift equipment & vehicles"
                    icon={Truck}
                    tone="default"
                    onClick={
                        availableSections.includes('assets')
                            ? () => onSectionChange('assets')
                            : undefined
                    }
                />

                <KpiCard
                    label="Fuel Requests"
                    value={`${fuelRequests.length}`}
                    subtext="Logged requests"
                    icon={Fuel}
                    tone="default"
                    onClick={
                        canOpenFuel ? () => onSectionChange('fuel') : undefined
                    }
                />

                <KpiCard
                    label="GPS Telemetry Sharing"
                    value={capabilities.share_location ? 'Active' : 'Disabled'}
                    subtext={`${freshLocations} location pings transmitted`}
                    icon={Radio}
                    tone={capabilities.share_location ? 'success' : 'default'}
                    liveIndicator={capabilities.share_location}
                    onClick={
                        canOpenTracking
                            ? () => onSectionChange('assets')
                            : undefined
                    }
                />
            </MetricStrip>

            {/* Field Schedule */}
            <section aria-labelledby="field-schedule-heading">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <h2
                            id="field-schedule-heading"
                            className="text-lg font-semibold tracking-tight text-ink"
                        >
                            Assigned Work Schedule
                        </h2>
                        <p className="mt-1 text-sm text-ink-soft">
                            Your assigned jobs for today.
                        </p>
                    </div>
                    {canOpenDispatch && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onSectionChange('dispatch')}
                        >
                            Open Today's Work →
                        </Button>
                    )}
                </div>

                <Panel className="overflow-hidden">
                    {jobs.length === 0 ? (
                        <EmptyState
                            compact
                            icon={CalendarClock}
                            title="No assigned jobs for today"
                            message="When you are assigned to a dispatch job, it will appear here."
                        />
                    ) : (
                        <ul className="divide-y divide-line">
                            {jobs.slice(0, 5).map((job) => (
                                <JobOverviewRow
                                    key={job.id}
                                    job={job}
                                    onClick={() => onSectionChange('dispatch')}
                                />
                            ))}
                        </ul>
                    )}
                </Panel>
            </section>
        </div>
    );
}

/* =========================================================================
   HELPER COMPONENTS & FUNCTIONS
   ========================================================================= */

function MetricStrip({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line shadow-2xs sm:grid-cols-2 lg:grid-cols-4">
            {children}
        </div>
    );
}

function KpiCard({
    label,
    value,
    subtext,
    icon: Icon,
    tone = 'default',
    liveIndicator = false,
    onClick,
}: {
    label: string;
    value: string;
    subtext: string;
    icon?: LucideIcon;
    tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
    liveIndicator?: boolean;
    onClick?: () => void;
}) {
    const Component = onClick ? 'button' : 'div';

    return (
        <Component
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={cn(
                'group relative flex flex-col justify-between bg-surface p-4 text-left transition-colors sm:p-5',
                onClick &&
                    'cursor-pointer hover:bg-surface-subtle/70 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden focus-visible:ring-inset',
            )}
        >
            <div>
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-soft">
                        {label}
                    </span>
                    <div className="flex items-center gap-1.5">
                        {liveIndicator && (
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                            </span>
                        )}
                        {Icon && (
                            <Icon
                                className="h-4 w-4 text-muted/70 transition-colors group-hover:text-ink-soft"
                                aria-hidden="true"
                            />
                        )}
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span
                        className={cn(
                            'text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl',
                            tone === 'danger'
                                ? 'text-danger-strong'
                                : tone === 'warning'
                                  ? 'text-warning-strong'
                                  : 'text-ink',
                        )}
                    >
                        {value}
                    </span>
                </div>
            </div>
            <p className="mt-2 truncate text-xs text-ink-soft">{subtext}</p>
        </Component>
    );
}

function JobOverviewRow({
    job,
    onClick,
}: {
    job: DispatchJobViewModel;
    onClick: () => void;
}) {
    const personnelCount = job.personnel_assignments?.length ?? 0;
    const assetCount = job.asset_assignments?.length ?? 0;
    const leadOperator = job.personnel_assignments?.find(
        (p) =>
            p.type === 'crane_operator' ||
            p.type === 'lead_operator' ||
            p.type === 'driver',
    );
    const primaryAsset = job.asset_assignments?.[0];

    const sourceLabel =
        job.source?.label ??
        (job.source?.type === 'service_request'
            ? 'Service'
            : job.source?.type === 'rental_reservation'
              ? 'Rental'
              : job.source?.type === 'manual'
                ? 'Manual'
                : null);

    return (
        <li>
            <button
                type="button"
                onClick={onClick}
                className="group flex min-h-16 w-full flex-col justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden sm:flex-row sm:items-center"
            >
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                    <CalendarClock
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-ink-soft sm:mt-0"
                        aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold text-ink">
                                {job.reference}
                            </span>
                            {job.client && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-surface-subtle px-1.5 py-0.5 text-xs font-medium text-ink-soft">
                                    <Building2 className="h-3 w-3" />
                                    {job.client}
                                </span>
                            )}
                            {sourceLabel && (
                                <span
                                    className={cn(
                                        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                                        job.source?.type ===
                                            'rental_reservation'
                                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                            : 'bg-amber-500/10 text-amber-800 dark:text-brand',
                                    )}
                                >
                                    {sourceLabel}
                                </span>
                            )}
                            <CanonicalStatusBadge status={job.status} />
                            {job.priority.value !== 'routine' && (
                                <span
                                    className={cn(
                                        'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold',
                                        job.priority.value === 'emergency'
                                            ? 'bg-danger-soft text-danger-strong'
                                            : 'bg-warning-soft text-warning-strong',
                                    )}
                                >
                                    {job.priority.label}
                                </span>
                            )}
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-ink">
                            {job.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                            <span className="flex items-center gap-1 truncate">
                                <MapPin className="h-3 w-3 shrink-0 text-muted" />
                                {job.site}
                            </span>
                            {leadOperator && (
                                <span className="flex items-center gap-1 text-muted">
                                    <Users className="h-3 w-3 shrink-0" />
                                    {leadOperator.name}
                                    {personnelCount > 1 &&
                                        ` (+${personnelCount - 1})`}
                                </span>
                            )}
                            {primaryAsset && (
                                <span className="flex items-center gap-1 text-muted">
                                    <Truck className="h-3 w-3 shrink-0" />
                                    {primaryAsset.code} - {primaryAsset.name}
                                    {assetCount > 1 && ` (+${assetCount - 1})`}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="shrink-0 text-left sm:text-right">
                    <span className="block text-xs font-medium text-ink">
                        {formatSchedule(job.scheduled_start)}
                    </span>
                    {job.scheduled_end && (
                        <span className="mt-0.5 block text-xs text-muted">
                            until {formatTimeOnly(job.scheduled_end)}
                        </span>
                    )}
                </div>
            </button>
        </li>
    );
}

function ReadinessRow({
    label,
    value,
    detail,
    icon: Icon,
    tone = 'default',
    onClick,
}: {
    label: string;
    value: string;
    detail: string;
    icon: LucideIcon;
    tone?: 'default' | 'warning' | 'success';
    onClick?: () => void;
}) {
    const Component = onClick ? 'button' : 'div';

    return (
        <Component
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                onClick &&
                    'cursor-pointer hover:bg-surface-subtle/70 focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
            )}
        >
            <span
                className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                    tone === 'warning'
                        ? 'bg-warning-soft text-warning-strong'
                        : tone === 'success'
                          ? 'bg-success-soft text-success-strong'
                          : 'bg-surface-subtle text-ink-soft',
                )}
            >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">
                    {label}
                </span>
                <span className="mt-0.5 block text-xs leading-normal text-ink-soft">
                    {detail}
                </span>
            </span>
            <span className="text-lg font-semibold tracking-tight text-ink tabular-nums">
                {value}
            </span>
        </Component>
    );
}

function formatSchedule(value: string | null | undefined) {
    if (!value) {
        return 'Schedule pending';
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return 'Schedule pending';
    }

    return new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

function formatTimeOnly(value: string | null | undefined) {
    if (!value) {
        return '';
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}
