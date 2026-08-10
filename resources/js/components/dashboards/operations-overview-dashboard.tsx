import { usePage } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    Building2,
    CalendarClock,
    CircleCheck,
    Cpu,
    FileText,
    Fuel,
    Layers,
    Lightbulb,
    MapPin,
    Radio,
    ShieldCheck,
    Sparkles,
    Truck,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { LiveTrackingPreview } from '@/components/dashboards/live-tracking-preview';
import { Button, EmptyState, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
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
    WorkspaceCapabilities,
    WorkspaceSection,
    WorkspaceUserViewModel,
} from '@/types/workspace';

type DashboardAction = {
    title: string;
    description: string;
    section: WorkspaceSection;
    icon: LucideIcon;
    tone: 'warning' | 'danger' | 'info';
    category: 'approvals' | 'assets' | 'fuel' | 'tracking';
};

type LocationFreshnessStatus = LocationUpdateViewModel['freshness_status'];

const LOCATION_REVIEW_STATUSES: ReadonlyArray<LocationFreshnessStatus> = [
    'stale',
    'offline',
];

function isFreshLocation(location: LocationUpdateViewModel): boolean {
    return location.freshness_status === 'fresh';
}

function needsLocationReview(location: LocationUpdateViewModel): boolean {
    return LOCATION_REVIEW_STATUSES.includes(location.freshness_status);
}

export interface OperationsOverviewDashboardProps {
    jobs: DispatchJobViewModel[];
    clients?: ClientViewModel[];
    serviceRequests?: ServiceRequestViewModel[];
    assets: AssetViewModel[];
    fuelRequests: FuelRequestViewModel[];
    locations: LocationUpdateViewModel[];
    approvals: ApprovalViewModel[];
    users?: WorkspaceUserViewModel[];
    auditEvents?: AuditEventViewModel[];
    gptRecommendations?: GptRecommendationViewModel[];
    capabilities: WorkspaceCapabilities;
    availableSections: WorkspaceSection[];
    refresh?: ScopeRefreshState;
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

    return (
        <div>
            {/* Perspective Header */}
            <DashboardHeader
                role={canonicalRole}
                roleLabel={auth?.role_label}
                onSectionChange={props.onSectionChange}
                availableSections={props.availableSections}
            />

            <div className="space-y-6 p-4 md:p-6">
                {canonicalRole === 'operations_manager' && (
                    <OperationsManagerDashboardView {...props} />
                )}
                {canonicalRole === 'dispatcher' && (
                    <DispatcherDashboardView {...props} />
                )}
                {canonicalRole === 'system_administrator' && (
                    <SystemAdminDashboardView {...props} />
                )}
                {[
                    'driver',
                    'crane_operator',
                    'field_technician',
                    'field_worker',
                ].includes(canonicalRole) && (
                    <FieldWorkerDashboardView {...props} />
                )}
                {![
                    'operations_manager',
                    'dispatcher',
                    'system_administrator',
                    'driver',
                    'crane_operator',
                    'field_technician',
                    'field_worker',
                ].includes(canonicalRole) && (
                    <OperationsManagerDashboardView {...props} />
                )}
            </div>
        </div>
    );
}

/* =========================================================================
   HEADER
   ========================================================================= */

function DashboardHeader({
    role,
    roleLabel,
    onSectionChange,
    availableSections,
}: {
    role: string;
    roleLabel?: string | null;
    onSectionChange: (section: WorkspaceSection) => void;
    availableSections: WorkspaceSection[];
}) {
    const displayRoleLabel =
        roleLabel ??
        (role === 'system_administrator'
            ? 'System Admin'
            : role === 'dispatcher'
              ? 'Dispatcher'
              : role === 'operations_manager'
                ? 'Operations Manager'
                : 'Field Operations');

    const isSystemAdmin = role === 'system_administrator';
    const isDispatcher = role === 'dispatcher';
    const canOpenDispatch = availableSections.includes('dispatch');
    const canOpenUsers = availableSections.includes('users');
    const canOpenApprovals = availableSections.includes('approvals');

    return (
        <div className="border-b border-line bg-surface px-4 py-5 md:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold tracking-tight text-ink md:text-2xl">
                            Operations overview
                        </h1>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                            {displayRoleLabel}
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                        {isSystemAdmin
                            ? 'System security, user access governance, telemetry health, and audit trail stream.'
                            : isDispatcher
                              ? 'Active dispatch workloads, service request conversion, location telemetry, and resource allocation.'
                              : 'High-level operational governance, decision approvals queue, fleet readiness, and GPT advisory.'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Quick Action Button */}
                    {isSystemAdmin && canOpenUsers ? (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onSectionChange('users')}
                        >
                            Manage users
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    ) : isDispatcher && canOpenDispatch ? (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onSectionChange('dispatch')}
                        >
                            Review dispatches
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    ) : canOpenApprovals ? (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onSectionChange('approvals')}
                        >
                            Review approvals
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

/* =========================================================================
   1. OPERATIONS MANAGER DASHBOARD VIEW
   ========================================================================= */

function OperationsManagerDashboardView({
    jobs,
    assets,
    fuelRequests,
    locations,
    approvals,
    gptRecommendations = [],
    capabilities,
    availableSections,
    refresh,
    realtimeConnected = false,
    onSectionChange,
}: OperationsOverviewDashboardProps) {
    const [actionFilter, setActionFilter] = useState<
        'all' | 'approvals' | 'assets' | 'fuel' | 'tracking'
    >('all');
    const [jobView, setJobView] = useState<'all' | 'active'>('all');

    const actions = buildDashboardActions({
        assets,
        fuelRequests,
        locations,
        approvals,
        capabilities,
    });

    const activeJobs = jobs.filter((job) =>
        ['dispatched', 'accepted', 'en_route', 'arrived', 'working'].includes(
            job.status.value,
        ),
    );

    const upcomingJobs = (
        jobView === 'active'
            ? activeJobs
            : jobs.filter(
                  (job) =>
                      !['completed', 'cancelled'].includes(job.status.value),
              )
    ).slice(0, 6);

    const totalAssets = assets.length;
    const dispatchableAssets = assets.filter((a) => a.is_dispatchable).length;
    const readinessPercentage =
        totalAssets > 0
            ? Math.round((dispatchableAssets / totalAssets) * 100)
            : null;

    const blockingAssets = assets.filter(
        (a) => a.blocking_work_orders_count > 0,
    ).length;
    const freshLocations = locations.filter(isFreshLocation).length;

    const pendingApprovalsCount = approvals.filter((a) => a.can_decide).length;
    const activeGptRecommendations = gptRecommendations.filter(
        (rec) => rec.status === 'pending' || rec.is_advisory,
    );

    const canOpenDispatch = availableSections.includes('dispatch');
    const canOpenAssets = availableSections.includes('assets');
    const canOpenApprovals = availableSections.includes('approvals');
    const canOpenTracking = availableSections.includes('tracking');

    const categoriesInActions = Array.from(
        new Set(actions.map((a) => a.category)),
    );

    const filteredActions =
        actionFilter === 'all'
            ? actions
            : actions.filter((a) => a.category === actionFilter);

    return (
        <div className="space-y-6">
            {/* Manager KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Decision Approvals"
                    value={`${approvals.length}`}
                    subtext={
                        pendingApprovalsCount > 0
                            ? `${pendingApprovalsCount} ready for your decision`
                            : 'All reviews clear'
                    }
                    icon={ShieldCheck}
                    tone={pendingApprovalsCount > 0 ? 'warning' : 'success'}
                    onClick={
                        canOpenApprovals
                            ? () => onSectionChange('approvals')
                            : undefined
                    }
                />

                <KpiCard
                    label="Fleet Readiness"
                    value={
                        readinessPercentage === null
                            ? '—'
                            : `${readinessPercentage}%`
                    }
                    subtext={
                        readinessPercentage === null
                            ? 'No assets available'
                            : `${dispatchableAssets} of ${totalAssets} assets ready`
                    }
                    icon={Truck}
                    tone={
                        readinessPercentage === null
                            ? 'default'
                            : readinessPercentage >= 80
                              ? 'success'
                              : readinessPercentage >= 60
                                ? 'warning'
                                : 'danger'
                    }
                    onClick={
                        canOpenAssets
                            ? () => onSectionChange('assets')
                            : undefined
                    }
                />

                <KpiCard
                    label="Active Workloads"
                    value={`${activeJobs.length}`}
                    subtext={`of ${jobs.length} visible jobs active`}
                    icon={Activity}
                    tone={activeJobs.length > 0 ? 'brand' : 'default'}
                    onClick={
                        canOpenDispatch
                            ? () => onSectionChange('dispatch')
                            : undefined
                    }
                />

                <KpiCard
                    label="GPT Insights & Risk"
                    value={`${activeGptRecommendations.length}`}
                    subtext={
                        blockingAssets > 0
                            ? `${blockingAssets} maintenance blockers`
                            : 'Operational risk normal'
                    }
                    icon={Sparkles}
                    tone={blockingAssets > 0 ? 'warning' : 'brand'}
                />
            </div>

            {/* Manager Decision Queue */}
            <section aria-labelledby="manager-queue-heading">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2
                                id="manager-queue-heading"
                                className="text-lg font-semibold tracking-tight text-ink"
                            >
                                Manager decision queue
                            </h2>
                            {actions.length > 0 && (
                                <span className="inline-flex items-center rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-strong">
                                    {actions.length} action required
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-sm text-ink-soft">
                            Priority dispatches, assignment overrides, and
                            safety clearances requiring manager approval.
                        </p>
                    </div>

                    {categoriesInActions.length > 1 && (
                        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-surface-subtle p-1 text-xs">
                            <button
                                type="button"
                                onClick={() => setActionFilter('all')}
                                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                                    actionFilter === 'all'
                                        ? 'bg-surface text-ink shadow-xs'
                                        : 'text-ink-soft hover:text-ink'
                                }`}
                            >
                                All ({actions.length})
                            </button>
                            {categoriesInActions.includes('approvals') && (
                                <button
                                    type="button"
                                    onClick={() => setActionFilter('approvals')}
                                    className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                                        actionFilter === 'approvals'
                                            ? 'bg-surface text-ink shadow-xs'
                                            : 'text-ink-soft hover:text-ink'
                                    }`}
                                >
                                    Approvals (
                                    {countByCategory(actions, 'approvals')})
                                </button>
                            )}
                            {categoriesInActions.includes('assets') && (
                                <button
                                    type="button"
                                    onClick={() => setActionFilter('assets')}
                                    className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                                        actionFilter === 'assets'
                                            ? 'bg-surface text-ink shadow-xs'
                                            : 'text-ink-soft hover:text-ink'
                                    }`}
                                >
                                    Assets ({countByCategory(actions, 'assets')}
                                    )
                                </button>
                            )}
                            {categoriesInActions.includes('fuel') && (
                                <button
                                    type="button"
                                    onClick={() => setActionFilter('fuel')}
                                    className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                                        actionFilter === 'fuel'
                                            ? 'bg-surface text-ink shadow-xs'
                                            : 'text-ink-soft hover:text-ink'
                                    }`}
                                >
                                    Fuel ({countByCategory(actions, 'fuel')})
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <Panel className="overflow-hidden">
                    {filteredActions.length === 0 ? (
                        <EmptyState
                            compact
                            icon={CircleCheck}
                            title="No decision blockers requiring attention"
                            message="All pending approvals, blocking assets, and fuel workflow reviews are clear."
                        />
                    ) : (
                        <ul className="divide-y divide-line">
                            {filteredActions.map((action) => (
                                <DashboardActionRow
                                    key={`${action.section}-${action.title}`}
                                    action={action}
                                    onClick={() =>
                                        onSectionChange(action.section)
                                    }
                                />
                            ))}
                        </ul>
                    )}
                </Panel>
            </section>

            {canOpenTracking && (
                <LiveTrackingPreview
                    locations={locations}
                    refresh={refresh}
                    realtimeConnected={realtimeConnected}
                    onOpenTracking={() => onSectionChange('tracking')}
                />
            )}

            {/* Grid Layout: Schedule & GPT Recommendations */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
                {/* Work Schedule */}
                <section
                    className="min-w-0"
                    aria-labelledby="manager-schedule-heading"
                >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2
                                id="manager-schedule-heading"
                                className="text-lg font-semibold tracking-tight text-ink"
                            >
                                Dispatch overview & schedule
                            </h2>
                            <p className="mt-1 text-sm text-ink-soft">
                                Active workload tracking across visible jobs.
                            </p>
                        </div>
                        <div className="flex gap-1 rounded-lg bg-surface-subtle p-1 text-xs">
                            <button
                                type="button"
                                onClick={() => setJobView('all')}
                                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                                    jobView === 'all'
                                        ? 'bg-surface text-ink shadow-xs'
                                        : 'text-ink-soft hover:text-ink'
                                }`}
                            >
                                All ({jobs.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setJobView('active')}
                                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                                    jobView === 'active'
                                        ? 'bg-surface text-ink shadow-xs'
                                        : 'text-ink-soft hover:text-ink'
                                }`}
                            >
                                Active ({activeJobs.length})
                            </button>
                        </div>
                    </div>

                    <Panel className="overflow-hidden">
                        {upcomingJobs.length === 0 ? (
                            <EmptyState
                                compact
                                icon={CalendarClock}
                                title="No scheduled work available"
                                message="Jobs visible to your account will appear here."
                            />
                        ) : (
                            <ul className="divide-y divide-line">
                                {upcomingJobs.map((job) => (
                                    <JobOverviewRow
                                        key={job.id}
                                        job={job}
                                        onClick={() =>
                                            onSectionChange('dispatch')
                                        }
                                    />
                                ))}
                            </ul>
                        )}
                    </Panel>
                </section>

                {/* Readiness & GPT Panel */}
                <div className="space-y-6">
                    <section aria-labelledby="manager-readiness-heading">
                        <div className="mb-3">
                            <h2
                                id="manager-readiness-heading"
                                className="text-lg font-semibold tracking-tight text-ink"
                            >
                                Governance & Fleet Readiness
                            </h2>
                            <p className="mt-1 text-sm text-ink-soft">
                                Safety and resource breakdown.
                            </p>
                        </div>
                        <Panel className="divide-y divide-line">
                            <ReadinessRow
                                label="Fleet Available"
                                value={`${dispatchableAssets} / ${totalAssets}`}
                                detail={
                                    readinessPercentage === null
                                        ? 'No assets available'
                                        : `${readinessPercentage}% ready for deployment`
                                }
                                icon={Truck}
                            />
                            <ReadinessRow
                                label="Safety Maintenance Blockers"
                                value={String(blockingAssets)}
                                detail={
                                    blockingAssets === 0
                                        ? 'No active maintenance blocks'
                                        : `${blockingAssets} asset${blockingAssets === 1 ? '' : 's'} require release`
                                }
                                icon={ShieldCheck}
                                tone={
                                    blockingAssets > 0 ? 'warning' : 'default'
                                }
                            />
                            <ReadinessRow
                                label="Telemetry Connection"
                                value={`${freshLocations} fresh pings`}
                                detail={`${locations.length} total active devices`}
                                icon={Radio}
                            />
                        </Panel>
                    </section>

                    {/* GPT Advisory Panel */}
                    {activeGptRecommendations.length > 0 && (
                        <section aria-labelledby="gpt-advisory-heading">
                            <div className="mb-3 flex items-center justify-between">
                                <h2
                                    id="gpt-advisory-heading"
                                    className="flex items-center gap-2 text-sm font-semibold tracking-wide text-ink uppercase"
                                >
                                    <Sparkles className="h-4 w-4 text-brand" />
                                    GPT AI Recommendations
                                </h2>
                            </div>
                            <Panel className="space-y-3 p-4">
                                {activeGptRecommendations
                                    .slice(0, 3)
                                    .map((rec) => (
                                        <div
                                            key={rec.id}
                                            className="space-y-1.5 rounded-lg bg-surface-subtle p-3 text-xs"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-ink">
                                                    {rec.purpose.replace(
                                                        '_',
                                                        ' ',
                                                    )}
                                                </span>
                                                <span className="text-muted">
                                                    Model: {rec.model}
                                                </span>
                                            </div>
                                            <p className="line-clamp-2 text-ink-soft">
                                                {rec.prompt_summary ??
                                                    rec.response_summary ??
                                                    'Recommendation pending review'}
                                            </p>
                                        </div>
                                    ))}
                            </Panel>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}

/* =========================================================================
   2. DISPATCHER DASHBOARD VIEW
   ========================================================================= */

function DispatcherDashboardView({
    jobs,
    serviceRequests = [],
    assets,
    locations,
    gptRecommendations = [],
    capabilities,
    availableSections,
    refresh,
    realtimeConnected = false,
    onSectionChange,
}: OperationsOverviewDashboardProps) {
    const [jobView, setJobView] = useState<'all' | 'active'>('all');

    const activeJobs = jobs.filter((job) =>
        ['dispatched', 'accepted', 'en_route', 'arrived', 'working'].includes(
            job.status.value,
        ),
    );

    // [Improvement 4] Detect dispatched jobs where any assigned worker has rejected or is still pending response
    const needsAttentionJobs = jobs.filter(
        (job) =>
            job.status.value === 'dispatched' &&
            job.personnel_assignments.some(
                (a) => a.response_status.value === 'rejected',
            ),
    );
    const pendingResponseJobs = jobs.filter(
        (job) =>
            job.status.value === 'dispatched' &&
            job.personnel_assignments.length > 0 &&
            job.personnel_assignments.every(
                (a) => a.response_status.value === 'pending',
            ),
    );

    // [Improvement 5] Sort service requests oldest-first so urgent unprocessed ones surface
    const sortedServiceRequests = [...serviceRequests].sort((a, b) => {
        if (!a.scheduled_date && !b.scheduled_date) {
            return 0;
        }

        if (!a.scheduled_date) {
            return 1;
        }

        if (!b.scheduled_date) {
            return -1;
        }

        return (
            new Date(a.scheduled_date).getTime() -
            new Date(b.scheduled_date).getTime()
        );
    });
    const pendingRequests = sortedServiceRequests.filter(
        (sr) => sr.status.value === 'submitted',
    );
    const visibleRequests = sortedServiceRequests.slice(0, 4);
    const hiddenRequestsCount = Math.max(0, sortedServiceRequests.length - 4);

    const upcomingJobs = (
        jobView === 'active'
            ? activeJobs
            : jobs.filter(
                  (job) =>
                      !['completed', 'cancelled'].includes(job.status.value),
              )
    ).slice(0, 6);

    const totalAssets = assets.length;
    const readyAssetsCount = assets.filter((a) => a.is_dispatchable).length;
    // [Improvement 2 & 3] Blocking assets count and readiness %
    const blockingAssetsCount = assets.filter(
        (a) => a.blocking_work_orders_count > 0,
    ).length;
    const readinessPercentage =
        totalAssets > 0
            ? Math.round((readyAssetsCount / totalAssets) * 100)
            : null;

    const freshnessCounts = {
        fresh: locations.filter(
            (location) => location.freshness_status === 'fresh',
        ).length,
        delayed: locations.filter(
            (location) => location.freshness_status === 'delayed',
        ).length,
        stale: locations.filter(
            (location) => location.freshness_status === 'stale',
        ).length,
        offline: locations.filter(
            (location) => location.freshness_status === 'offline',
        ).length,
    };

    // [Improvement 1] GPT pending recommendations for dispatcher
    const pendingGptRecommendations = gptRecommendations.filter(
        (r) => r.status === 'pending_review' && !r.is_expired,
    );

    const canOpenDispatch = availableSections.includes('dispatch');
    const canOpenTracking = availableSections.includes('tracking');
    const canOpenAssets = availableSections.includes('assets');
    const canOpenGpt = availableSections.includes('gpt-recommendations');

    return (
        <div className="space-y-6">
            {/* [Improvement 4] Rejected Assignment Alert Banner */}
            {needsAttentionJobs.length > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">
                            {needsAttentionJobs.length} dispatch
                            {needsAttentionJobs.length === 1 ? '' : 'es'}{' '}
                            require reassignment
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            An assigned worker has rejected their assignment.
                            Review and reassign in the dispatch workspace.
                        </p>
                    </div>
                    {canOpenDispatch && (
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onSectionChange('dispatch')}
                        >
                            Review
                            <ArrowRight
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                        </Button>
                    )}
                </div>
            )}

            {/* [Improvement 2] Blocking Assets Alert Banner */}
            {blockingAssetsCount > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">
                            {blockingAssetsCount} asset
                            {blockingAssetsCount === 1 ? '' : 's'} blocked by
                            maintenance
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            These assets cannot be assigned to dispatches until
                            their maintenance work orders are released.
                        </p>
                    </div>
                    {canOpenAssets && (
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onSectionChange('assets')}
                        >
                            View assets
                            <ArrowRight
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                        </Button>
                    )}
                </div>
            )}

            {/* Dispatcher KPIs */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Active Workloads"
                    value={`${activeJobs.length}`}
                    subtext={`of ${jobs.length} visible dispatches active`}
                    icon={Activity}
                    tone={activeJobs.length > 0 ? 'brand' : 'default'}
                    onClick={
                        canOpenDispatch
                            ? () => onSectionChange('dispatch')
                            : undefined
                    }
                />

                <KpiCard
                    label="Service Requests"
                    value={`${serviceRequests.length}`}
                    subtext={
                        pendingRequests.length > 0
                            ? `${pendingRequests.length} pending conversion to dispatch`
                            : 'All requests processed'
                    }
                    icon={FileText}
                    tone={pendingRequests.length > 0 ? 'warning' : 'success'}
                    onClick={
                        canOpenDispatch
                            ? () => onSectionChange('dispatch')
                            : undefined
                    }
                />

                {/* [Improvement 3] Fleet Readiness shown as % */}
                <KpiCard
                    label="Fleet Readiness"
                    value={
                        readinessPercentage === null
                            ? '—'
                            : `${readinessPercentage}%`
                    }
                    subtext={
                        readinessPercentage === null
                            ? 'No assets available'
                            : blockingAssetsCount > 0
                              ? `${readyAssetsCount} of ${totalAssets} ready Â· ${blockingAssetsCount} blocked`
                              : `${readyAssetsCount} of ${totalAssets} assets ready`
                    }
                    icon={Truck}
                    tone={
                        readinessPercentage === null
                            ? 'default'
                            : readinessPercentage >= 80
                              ? 'success'
                              : readinessPercentage >= 50
                                ? 'warning'
                                : 'danger'
                    }
                    onClick={
                        canOpenAssets
                            ? () => onSectionChange('assets')
                            : undefined
                    }
                />

                {/* [Improvement 4] Rejected/pending assignment KPI */}
                <KpiCard
                    label="Assignment Responses"
                    value={`${needsAttentionJobs.length + pendingResponseJobs.length}`}
                    subtext={
                        needsAttentionJobs.length > 0
                            ? `${needsAttentionJobs.length} rejected Â· needs reassignment`
                            : pendingResponseJobs.length > 0
                              ? `${pendingResponseJobs.length} awaiting worker response`
                              : 'All assignments acknowledged'
                    }
                    icon={Users}
                    tone={
                        needsAttentionJobs.length > 0
                            ? 'danger'
                            : pendingResponseJobs.length > 0
                              ? 'warning'
                              : 'success'
                    }
                    onClick={
                        canOpenDispatch
                            ? () => onSectionChange('dispatch')
                            : undefined
                    }
                />
            </div>

            {/* Service Requests Queue for Dispatchers */}
            {serviceRequests.length > 0 && (
                <section aria-labelledby="service-requests-heading">
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2
                                    id="service-requests-heading"
                                    className="text-lg font-semibold tracking-tight text-ink"
                                >
                                    Client Service Requests
                                </h2>
                                {pendingRequests.length > 0 && (
                                    <span className="inline-flex items-center rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong">
                                        {pendingRequests.length} pending
                                        conversion
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-sm text-ink-soft">
                                Convert client service requests into active
                                draft dispatch jobs. Sorted oldest first.
                            </p>
                        </div>

                        {canOpenDispatch && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onSectionChange('dispatch')}
                            >
                                Convert in workspace
                                <ArrowRight
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                            </Button>
                        )}
                    </div>

                    <Panel className="overflow-hidden">
                        <ul className="divide-y divide-line">
                            {/* [Improvement 5] Sorted oldest-first, slice(0,4) */}
                            {visibleRequests.map((request) => (
                                <li
                                    key={request.id}
                                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-ink">
                                                {request.reference}
                                            </span>
                                            <span className="rounded bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink-soft">
                                                {request.client.company_name}
                                            </span>
                                            <CanonicalStatusBadge
                                                status={request.status}
                                            />
                                        </div>
                                        <p className="mt-1 text-sm font-medium text-ink">
                                            {request.project_name} â€”{' '}
                                            <span className="text-ink-soft">
                                                {request.service_type}
                                            </span>
                                        </p>
                                        <p className="mt-0.5 text-xs text-muted">
                                            Site: {request.location}
                                        </p>
                                    </div>

                                    {canOpenDispatch && (
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={() =>
                                                onSectionChange('dispatch', {
                                                    serviceRequestId:
                                                        request.id,
                                                })
                                            }
                                        >
                                            Create Dispatch
                                        </Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                        {/* [Improvement 5] Overflow count link */}
                        {hiddenRequestsCount > 0 && (
                            <div className="border-t border-line px-4 py-3">
                                <button
                                    type="button"
                                    onClick={
                                        canOpenDispatch
                                            ? () => onSectionChange('dispatch')
                                            : undefined
                                    }
                                    className="text-xs font-semibold text-brand hover:underline"
                                >
                                    + {hiddenRequestsCount} more service request
                                    {hiddenRequestsCount === 1 ? '' : 's'}
                                    <ArrowRight
                                        className="ml-1 inline h-4 w-4 align-text-bottom"
                                        aria-hidden="true"
                                    />
                                </button>
                            </div>
                        )}
                    </Panel>
                </section>
            )}

            {/* Dispatch work and review rail */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
                {/* Dispatch Schedule */}
                <section
                    className="min-w-0"
                    aria-labelledby="dispatcher-jobs-heading"
                >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2
                                id="dispatcher-jobs-heading"
                                className="text-lg font-semibold tracking-tight text-ink"
                            >
                                Dispatch schedule
                            </h2>
                            <p className="mt-1 text-sm text-ink-soft">
                                Build today&apos;s schedule and monitor
                                dispatched work.
                            </p>
                        </div>
                        {jobs.length > 0 && (
                            <div className="flex gap-1 rounded-lg bg-surface-subtle p-1 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setJobView('all')}
                                    className={`min-h-10 rounded-md px-3 py-1.5 font-medium transition-colors ${
                                        jobView === 'all'
                                            ? 'bg-surface text-ink shadow-xs'
                                            : 'text-ink-soft hover:text-ink'
                                    }`}
                                >
                                    All ({jobs.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setJobView('active')}
                                    className={`min-h-10 rounded-md px-3 py-1.5 font-medium transition-colors ${
                                        jobView === 'active'
                                            ? 'bg-surface text-ink shadow-xs'
                                            : 'text-ink-soft hover:text-ink'
                                    }`}
                                >
                                    Active ({activeJobs.length})
                                </button>
                            </div>
                        )}
                    </div>

                    <Panel className="overflow-hidden">
                        {upcomingJobs.length === 0 ? (
                            <DispatchReadinessState
                                pendingRequestsCount={pendingRequests.length}
                                readyAssetsCount={readyAssetsCount}
                                totalAssets={totalAssets}
                                freshLocationsCount={freshnessCounts.fresh}
                                totalLocations={locations.length}
                                canOpenDispatch={canOpenDispatch}
                                onOpenDispatch={() =>
                                    onSectionChange('dispatch')
                                }
                            />
                        ) : (
                            <ul className="divide-y divide-line">
                                {upcomingJobs.map((job) => (
                                    <JobOverviewRow
                                        key={job.id}
                                        job={job}
                                        onClick={() =>
                                            onSectionChange('dispatch')
                                        }
                                    />
                                ))}
                            </ul>
                        )}
                    </Panel>
                </section>

                {/* Review rail: telemetry exceptions + actionable recommendations */}
                <div className="space-y-6">
                    <TelemetryExceptions
                        counts={freshnessCounts}
                        totalLocations={locations.length}
                        canOpenTracking={canOpenTracking}
                        onOpenTracking={() => onSectionChange('tracking')}
                    />

                    {(capabilities.request_gpt_assistance ||
                        pendingGptRecommendations.length > 0) && (
                        <section aria-labelledby="dispatcher-gpt-heading">
                            {pendingGptRecommendations.length > 0 ? (
                                <>
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <h2
                                            id="dispatcher-gpt-heading"
                                            className="flex items-center gap-2 text-sm font-semibold tracking-wide text-ink uppercase"
                                        >
                                            <Lightbulb
                                                className="h-4 w-4 text-brand"
                                                aria-hidden="true"
                                            />
                                            Recommendations awaiting review
                                        </h2>
                                        {canOpenGpt && (
                                            <Button
                                                type="button"
                                                variant="quiet"
                                                size="sm"
                                                onClick={() =>
                                                    onSectionChange(
                                                        'gpt-recommendations',
                                                    )
                                                }
                                            >
                                                Review recommendations
                                                <ArrowRight
                                                    className="h-4 w-4"
                                                    aria-hidden="true"
                                                />
                                            </Button>
                                        )}
                                    </div>

                                    <Panel className="space-y-3 p-4">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium text-ink">
                                                {
                                                    pendingGptRecommendations.length
                                                }{' '}
                                                pending review
                                            </span>
                                            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">
                                                Advisory only
                                            </span>
                                        </div>
                                        <div className="divide-y divide-line">
                                            {pendingGptRecommendations
                                                .slice(0, 2)
                                                .map((rec) => (
                                                    <div
                                                        key={rec.id}
                                                        className="space-y-1 py-3 text-xs first:pt-0 last:pb-0"
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="font-semibold text-ink">
                                                                Dispatch #
                                                                {rec.subject_id}
                                                            </span>
                                                            {rec.expires_in_seconds && (
                                                                <span className="shrink-0 text-muted">
                                                                    {Math.ceil(
                                                                        rec.expires_in_seconds /
                                                                            60,
                                                                    )}
                                                                    m left
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="line-clamp-2 text-ink-soft">
                                                            {rec.prompt_summary ??
                                                                rec.response_summary ??
                                                                'Recommendation pending review'}
                                                        </p>
                                                    </div>
                                                ))}
                                        </div>
                                        {pendingGptRecommendations.length >
                                            2 && (
                                            <p className="text-center text-xs text-ink-soft">
                                                +{' '}
                                                {pendingGptRecommendations.length -
                                                    2}{' '}
                                                more recommendations
                                            </p>
                                        )}
                                    </Panel>
                                </>
                            ) : (
                                <div className="flex items-start gap-3 border-t border-line pt-4">
                                    <Lightbulb
                                        className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                                        aria-hidden="true"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-ink">
                                            No recommendations awaiting review
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-ink-soft">
                                            Advisory guidance becomes available
                                            inside a dispatch job when there is
                                            enough assignment context.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>

            {canOpenTracking && (
                <LiveTrackingPreview
                    locations={locations}
                    refresh={refresh}
                    realtimeConnected={realtimeConnected}
                    onOpenTracking={() => onSectionChange('tracking')}
                />
            )}
        </div>
    );
}

type TelemetryCounts = {
    fresh: number;
    delayed: number;
    stale: number;
    offline: number;
};

function DispatchReadinessState({
    pendingRequestsCount,
    readyAssetsCount,
    totalAssets,
    freshLocationsCount,
    totalLocations,
    canOpenDispatch,
    onOpenDispatch,
}: {
    pendingRequestsCount: number;
    readyAssetsCount: number;
    totalAssets: number;
    freshLocationsCount: number;
    totalLocations: number;
    canOpenDispatch: boolean;
    onOpenDispatch: () => void;
}) {
    return (
        <div className="space-y-5 px-4 py-6 text-left sm:px-6 sm:py-7">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                    <CalendarClock className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <p className="font-semibold text-ink">
                        No dispatches scheduled
                    </p>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-ink-soft">
                        Convert a service request into a dispatch to begin
                        building today&apos;s schedule.
                    </p>
                    {canOpenDispatch && (
                        <div className="mt-5 flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={onOpenDispatch}
                            >
                                {pendingRequestsCount > 0
                                    ? 'Review service requests'
                                    : 'Open dispatch workspace'}
                                <ArrowRight
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                            </Button>
                            {pendingRequestsCount > 0 && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={onOpenDispatch}
                                >
                                    Open dispatch workspace
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-line pt-4">
                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                    Dispatch readiness
                </p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="min-w-0">
                        <dt className="text-xs text-ink-soft">
                            Requests ready
                        </dt>
                        <dd className="mt-1 text-lg font-semibold text-ink tabular-nums">
                            {pendingRequestsCount}
                        </dd>
                        <p className="text-xs text-ink-soft">
                            {pendingRequestsCount > 0
                                ? 'Submitted for conversion'
                                : 'No submitted requests'}
                        </p>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-xs text-ink-soft">Assets ready</dt>
                        <dd className="mt-1 text-lg font-semibold text-ink tabular-nums">
                            {readyAssetsCount}
                        </dd>
                        <p className="text-xs text-ink-soft">
                            {totalAssets > 0
                                ? `of ${totalAssets} dispatchable`
                                : 'No assets available'}
                        </p>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-xs text-ink-soft">
                            Fresh telemetry
                        </dt>
                        <dd className="mt-1 text-lg font-semibold text-ink tabular-nums">
                            {freshLocationsCount}
                        </dd>
                        <p className="text-xs text-ink-soft">
                            {totalLocations > 0
                                ? `of ${totalLocations} field units`
                                : 'No field units configured'}
                        </p>
                    </div>
                </dl>
            </div>
        </div>
    );
}

function TelemetryExceptions({
    counts,
    totalLocations,
    canOpenTracking,
    onOpenTracking,
}: {
    counts: TelemetryCounts;
    totalLocations: number;
    canOpenTracking: boolean;
    onOpenTracking: () => void;
}) {
    const locationsNeedingReview =
        counts.delayed + counts.stale + counts.offline;
    const summary =
        totalLocations === 0
            ? 'No field units configured.'
            : locationsNeedingReview === 0
              ? 'All field units are reporting fresh coordinates.'
              : `${locationsNeedingReview} of ${totalLocations} units need review.`;

    const statusItems: Array<{
        key: keyof TelemetryCounts;
        label: string;
        dotClassName: string;
        valueClassName: string;
    }> = [
        {
            key: 'fresh',
            label: 'Fresh',
            dotClassName: 'bg-success',
            valueClassName: 'text-success-strong',
        },
        {
            key: 'delayed',
            label: 'Delayed',
            dotClassName: 'bg-warning',
            valueClassName: 'text-warning-strong',
        },
        {
            key: 'stale',
            label: 'Stale',
            dotClassName: 'bg-warning-strong',
            valueClassName: 'text-warning-strong',
        },
        {
            key: 'offline',
            label: 'Offline',
            dotClassName: 'bg-danger',
            valueClassName: 'text-danger-strong',
        },
    ];

    return (
        <section aria-labelledby="dispatcher-telemetry-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2
                    id="dispatcher-telemetry-heading"
                    className="text-sm font-semibold tracking-wide text-ink uppercase"
                >
                    Telemetry exceptions
                </h2>
                {canOpenTracking && (
                    <Button
                        type="button"
                        variant="quiet"
                        size="sm"
                        onClick={onOpenTracking}
                    >
                        Review units
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                )}
            </div>

            <Panel className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-ink">
                            {counts.fresh} of {totalLocations} fresh
                        </p>
                        <p className="mt-1 text-xs leading-5 text-ink-soft">
                            {summary}
                        </p>
                    </div>
                    {locationsNeedingReview > 0 && (
                        <AlertTriangle
                            className="h-5 w-5 shrink-0 text-warning-strong"
                            aria-label="Telemetry requires review"
                        />
                    )}
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-3">
                    {statusItems.map((item) => (
                        <div
                            key={item.key}
                            className="flex items-center justify-between gap-2 text-xs"
                        >
                            <dt className="flex items-center gap-1.5 text-ink-soft">
                                <span
                                    className={`h-2 w-2 shrink-0 rounded-full ${item.dotClassName}`}
                                    aria-hidden="true"
                                />
                                {item.label}
                            </dt>
                            <dd
                                className={`font-semibold tabular-nums ${item.valueClassName}`}
                            >
                                {counts[item.key]}
                            </dd>
                        </div>
                    ))}
                </dl>
            </Panel>
        </section>
    );
}

/* =========================================================================
   3. SYSTEM ADMINISTRATOR DASHBOARD VIEW
   ========================================================================= */

function SystemAdminDashboardView({
    users = [],
    auditEvents = [],
    locations = [],
    availableSections,
    onSectionChange,
}: OperationsOverviewDashboardProps) {
    const activeUsersCount = users.filter((u) => u.is_active).length;
    const freshLocationsCount = locations.filter(isFreshLocation).length;
    const hasLocations = locations.length > 0;
    const allLocationsFresh =
        hasLocations && freshLocationsCount === locations.length;

    const canOpenUsers = availableSections.includes('users');
    const canOpenAudit = availableSections.includes('audit');
    const canOpenTracking = availableSections.includes('tracking');

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
            {/* System Admin KPIs */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Registered Accounts"
                    value={`${users.length}`}
                    subtext={`${activeUsersCount} active user sessions`}
                    icon={Users}
                    tone="brand"
                    onClick={
                        canOpenUsers
                            ? () => onSectionChange('users')
                            : undefined
                    }
                />

                <KpiCard
                    label="Audit Trail Events"
                    value={`${auditEvents.length}`}
                    subtext="Recorded system & access logs"
                    icon={FileText}
                    tone="info"
                    onClick={
                        canOpenAudit
                            ? () => onSectionChange('audit')
                            : undefined
                    }
                />

                <KpiCard
                    label="Telemetry Health"
                    value={`${freshLocationsCount} / ${locations.length}`}
                    subtext={
                        !hasLocations
                            ? 'No device location updates recorded'
                            : allLocationsFresh
                              ? 'All device streams report fresh data'
                              : 'Some pings are delayed, stale, or offline'
                    }
                    icon={Radio}
                    tone={
                        !hasLocations
                            ? 'default'
                            : freshLocationsCount > 0
                              ? 'success'
                              : 'warning'
                    }
                    liveIndicator={hasLocations && freshLocationsCount > 0}
                    onClick={
                        canOpenTracking
                            ? () => onSectionChange('tracking')
                            : undefined
                    }
                />

                <KpiCard
                    label="System Security"
                    value="Optimal"
                    subtext="Active session guards intact"
                    icon={ShieldCheck}
                    tone="success"
                />
            </div>

            {/* Audit Log Stream & Role Distribution Grid */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
                {/* Audit Stream */}
                <section
                    className="min-w-0"
                    aria-labelledby="admin-audit-heading"
                >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2
                                id="admin-audit-heading"
                                className="text-lg font-semibold tracking-tight text-ink"
                            >
                                Audit trail event stream
                            </h2>
                            <p className="mt-1 text-sm text-ink-soft">
                                Real-time system actions, access edits, and
                                security log updates.
                            </p>
                        </div>
                        {canOpenAudit && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onSectionChange('audit')}
                            >
                                View full audit →
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
                                {auditEvents.slice(0, 6).map((event) => (
                                    <li
                                        key={event.id}
                                        className="flex items-start justify-between gap-4 p-4 text-xs"
                                    >
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-ink">
                                                    {event.action}
                                                </span>
                                                {event.actor && (
                                                    <span className="rounded bg-surface-subtle px-2 py-0.5 text-ink-soft">
                                                        by {event.actor.name}
                                                    </span>
                                                )}
                                            </div>
                                            {event.reason && (
                                                <p className="text-ink-soft">
                                                    Reason: {event.reason}
                                                </p>
                                            )}
                                        </div>
                                        <span className="shrink-0 font-medium text-muted">
                                            {formatSchedule(event.occurred_at)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </section>

                {/* Role Distribution Panel */}
                <div className="space-y-6">
                    <section aria-labelledby="admin-users-heading">
                        <div className="mb-3 flex items-center justify-between">
                            <h2
                                id="admin-users-heading"
                                className="text-sm font-semibold tracking-wide text-ink uppercase"
                            >
                                Role Distribution
                            </h2>
                            {canOpenUsers && (
                                <button
                                    type="button"
                                    onClick={() => onSectionChange('users')}
                                    className="text-xs font-semibold text-brand hover:underline"
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
                                detail="Governance & decision approval role"
                                icon={ShieldCheck}
                            />
                            <ReadinessRow
                                label="Dispatchers"
                                value={String(
                                    rolesDistribution['dispatcher'] ?? 0,
                                )}
                                detail="Dispatch creation & scheduling role"
                                icon={Layers}
                            />
                            <ReadinessRow
                                label="System Administrators"
                                value={String(
                                    rolesDistribution['system_administrator'] ??
                                        0,
                                )}
                                detail="System health & access control role"
                                icon={Cpu}
                            />
                            <ReadinessRow
                                label="Drivers & Field Workers"
                                value={String(
                                    (rolesDistribution['driver'] ?? 0) +
                                        (rolesDistribution['crane_operator'] ??
                                            0) +
                                        (rolesDistribution[
                                            'field_technician'
                                        ] ?? 0),
                                )}
                                detail="Field execution & assignment role"
                                icon={Truck}
                            />
                        </Panel>
                    </section>
                </div>
            </div>
        </div>
    );
}

/* =========================================================================
   4. FIELD WORKER DASHBOARD VIEW
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
    const canOpenTracking = availableSections.includes('tracking');

    const freshLocations = locations.filter(isFreshLocation).length;

    return (
        <div className="space-y-6">
            {/* Field Worker KPIs */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                    label="Assigned Vehicle / Assets"
                    value={`${assets.length}`}
                    subtext="Assigned equipment & vehicles"
                    icon={Truck}
                    tone="success"
                    onClick={
                        availableSections.includes('assets')
                            ? () => onSectionChange('assets')
                            : undefined
                    }
                />

                <KpiCard
                    label="Fuel Requests"
                    value={`${fuelRequests.length}`}
                    subtext="Submitted fuel requests"
                    icon={Fuel}
                    tone="info"
                    onClick={
                        canOpenFuel ? () => onSectionChange('fuel') : undefined
                    }
                />

                <KpiCard
                    label="GPS Telemetry Sharing"
                    value={capabilities.share_location ? 'Active' : 'Disabled'}
                    subtext={`${freshLocations} fresh location pings transmitted`}
                    icon={Radio}
                    tone={capabilities.share_location ? 'success' : 'default'}
                    liveIndicator={capabilities.share_location}
                    onClick={
                        canOpenTracking
                            ? () => onSectionChange('tracking')
                            : undefined
                    }
                />
            </div>

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
    icon: LucideIcon;
    tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
    liveIndicator?: boolean;
    onClick?: () => void;
}) {
    const Content = (
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                    {label}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-ink tabular-nums sm:text-3xl">
                        {value}
                    </span>
                    {liveIndicator && (
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
                        </span>
                    )}
                </div>
                <p className="mt-1 truncate text-xs text-ink-soft">{subtext}</p>
            </div>
            <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    tone === 'brand'
                        ? 'bg-brand-soft text-brand-strong'
                        : tone === 'success'
                          ? 'bg-success-soft text-success-strong'
                          : tone === 'warning'
                            ? 'bg-warning-soft text-warning-strong'
                            : tone === 'danger'
                              ? 'bg-danger-soft text-danger'
                              : tone === 'info'
                                ? 'bg-info-soft text-info-strong'
                                : 'bg-surface-subtle text-ink-soft'
                }`}
            >
                <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
        </div>
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="rounded-xl border border-line bg-surface p-4 text-left shadow-xs transition-all hover:border-line-strong hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
                {Content}
            </button>
        );
    }

    return (
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
            {Content}
        </div>
    );
}

function DashboardActionRow({
    action,
    onClick,
}: {
    action: DashboardAction;
    onClick: () => void;
}) {
    const Icon = action.icon;

    return (
        <li>
            <button
                type="button"
                onClick={onClick}
                className="group flex min-h-20 w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
                <span
                    className={
                        action.tone === 'danger'
                            ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger transition-transform group-hover:scale-105'
                            : action.tone === 'warning'
                              ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-strong transition-transform group-hover:scale-105'
                              : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info-strong transition-transform group-hover:scale-105'
                    }
                >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                        <span className="block font-semibold text-ink transition-colors group-hover:text-brand">
                            {action.title}
                        </span>
                    </span>
                    <span className="mt-0.5 block text-sm leading-5 text-ink-soft">
                        {action.description}
                    </span>
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-ink-soft group-hover:text-brand">
                    Resolve
                    <ArrowRight
                        className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                    />
                </span>
            </button>
        </li>
    );
}

function JobOverviewRow({
    job,
    onClick,
}: {
    job: DispatchJobViewModel;
    onClick: () => void;
}) {
    const personnelCount = job.personnel_assignments.length;
    const assetCount = job.asset_assignments.length;

    return (
        <li>
            <button
                type="button"
                onClick={onClick}
                className="group flex min-h-20 w-full flex-col justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none sm:flex-row sm:items-center"
            >
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                    <CalendarClock
                        className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft transition-colors group-hover:text-brand sm:mt-0"
                        aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-bold text-ink">
                                {job.reference}
                            </span>
                            {job.client && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-surface-subtle px-1.5 py-0.5 text-xs font-medium text-ink-soft">
                                    <Building2 className="h-3 w-3" />
                                    {job.client}
                                </span>
                            )}
                            <CanonicalStatusBadge status={job.status} />
                            {job.priority.value !== 'routine' && (
                                <span
                                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                                        job.priority.value === 'emergency'
                                            ? 'bg-danger-soft text-danger'
                                            : 'bg-warning-soft text-warning-strong'
                                    }`}
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
                            {personnelCount > 0 && (
                                <span className="flex items-center gap-1 text-muted">
                                    <Users className="h-3 w-3 shrink-0" />
                                    {personnelCount} personnel
                                </span>
                            )}
                            {assetCount > 0 && (
                                <span className="flex items-center gap-1 text-muted">
                                    <Truck className="h-3 w-3 shrink-0" />
                                    {assetCount} assets
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
}: {
    label: string;
    value: string;
    detail: string;
    icon: LucideIcon;
    tone?: 'default' | 'warning';
}) {
    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <span
                className={
                    tone === 'warning'
                        ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-strong'
                        : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft'
                }
            >
                <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">
                    {label}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-ink-soft">
                    {detail}
                </span>
            </span>
            <span className="text-xl font-semibold tracking-tight tabular-nums">
                {value}
            </span>
        </div>
    );
}

function buildDashboardActions({
    assets,
    fuelRequests,
    locations,
    approvals,
    capabilities,
}: {
    assets: AssetViewModel[];
    fuelRequests: FuelRequestViewModel[];
    locations: LocationUpdateViewModel[];
    approvals: ApprovalViewModel[];
    capabilities: WorkspaceCapabilities;
}): DashboardAction[] {
    const actions: DashboardAction[] = [];
    const decisionReadyApprovals = approvals.filter((a) => a.can_decide);
    const blockedAssets = assets.filter(
        (a) => a.blocking_work_orders_count > 0,
    );
    const actionableFuelRequests = fuelRequests.filter((request) =>
        canActOnFuelRequest(request, capabilities),
    );
    const staleLocations = locations.filter(needsLocationReview);

    if (approvals.length > 0) {
        const canDecideApproval = decisionReadyApprovals.length > 0;

        actions.push({
            title: canDecideApproval
                ? `${decisionReadyApprovals.length} approval${decisionReadyApprovals.length === 1 ? '' : 's'} need your decision`
                : `${approvals.length} approval${approvals.length === 1 ? '' : 's'} awaiting independent review`,
            description: canDecideApproval
                ? 'Review the requester, affected work, and consequences before deciding.'
                : (approvals[0]?.decision_blocker ??
                  'An authorized manager must decide this request.'),
            section: 'approvals',
            icon: ShieldCheck,
            tone: canDecideApproval ? 'warning' : 'info',
            category: 'approvals',
        });
    }

    if (blockedAssets.length > 0) {
        actions.push({
            title: `${blockedAssets.length} asset${blockedAssets.length === 1 ? '' : 's'} blocked from dispatch`,
            description:
                'Safety evidence or a maintenance release is still required.',
            section: 'assets',
            icon: AlertTriangle,
            tone: 'danger',
            category: 'assets',
        });
    }

    if (actionableFuelRequests.length > 0) {
        actions.push({
            title: `${actionableFuelRequests.length} fuel request${actionableFuelRequests.length === 1 ? '' : 's'} ready for your step`,
            description:
                'Continue only the next authorized stage in the fuel workflow.',
            section: 'fuel',
            icon: Fuel,
            tone: 'info',
            category: 'fuel',
        });
    }

    if (staleLocations.length > 0) {
        actions.push({
            title: `${staleLocations.length} location update${staleLocations.length === 1 ? '' : 's'} need review`,
            description:
                'These records are stale or offline and must not be treated as live location data.',
            section: 'tracking',
            icon: MapPin,
            tone: 'warning',
            category: 'tracking',
        });
    }

    return actions;
}

function countByCategory(
    actions: DashboardAction[],
    category: DashboardAction['category'],
) {
    return actions.filter((a) => a.category === category).length;
}

function canActOnFuelRequest(
    request: FuelRequestViewModel,
    capabilities: WorkspaceCapabilities,
) {
    return (
        (request.status.value === 'submitted' && capabilities.forward_fuel) ||
        (request.status.value === 'forwarded' && capabilities.approve_fuel) ||
        (request.status.value === 'approved' && capabilities.verify_fuel) ||
        (request.status.value === 'verified' && capabilities.record_fuel)
    );
}

function formatSchedule(value: string | null) {
    if (value === null) {
        return 'Schedule pending';
    }

    return new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

function formatTimeOnly(value: string | null) {
    if (value === null) {
        return '';
    }

    return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}
