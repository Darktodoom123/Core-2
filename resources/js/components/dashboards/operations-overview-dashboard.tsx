import {
    Activity,
    AlertTriangle,
    ArrowRight,
    Building2,
    CalendarClock,
    CircleCheck,
    Fuel,
    MapPin,
    Radio,
    ShieldCheck,
    Truck,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import type {
    ApprovalViewModel,
    AssetViewModel,
    DispatchJobViewModel,
    FuelRequestViewModel,
    LocationUpdateViewModel,
    WorkspaceCapabilities,
    WorkspaceSection,
} from '@/types/workspace';

type DashboardAction = {
    title: string;
    description: string;
    section: WorkspaceSection;
    icon: LucideIcon;
    tone: 'warning' | 'danger' | 'info';
    category: 'approvals' | 'assets' | 'fuel' | 'tracking';
};

export function OperationsOverviewDashboard({
    jobs,
    assets,
    fuelRequests,
    locations,
    approvals,
    capabilities,
    availableSections,
    onSectionChange,
}: {
    jobs: DispatchJobViewModel[];
    assets: AssetViewModel[];
    fuelRequests: FuelRequestViewModel[];
    locations: LocationUpdateViewModel[];
    approvals: ApprovalViewModel[];
    capabilities: WorkspaceCapabilities;
    availableSections: WorkspaceSection[];
    onSectionChange: (section: WorkspaceSection) => void;
}) {
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

    const categoriesInActions = Array.from(
        new Set(actions.map((a) => a.category)),
    );

    const filteredActions =
        actionFilter === 'all'
            ? actions
            : actions.filter((a) => a.category === actionFilter);

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
    const dispatchableAssets = assets.filter(
        (asset) => asset.is_dispatchable,
    ).length;
    const readinessPercentage =
        totalAssets > 0
            ? Math.round((dispatchableAssets / totalAssets) * 100)
            : 100;

    const blockingAssets = assets.filter(
        (asset) => asset.blocking_work_orders_count > 0,
    ).length;

    const freshLocations = locations.filter((l) =>
        ['live', 'recent'].includes(l.freshness_status),
    ).length;

    const canOpenDispatch = availableSections.includes('dispatch');
    const canOpenAssets = availableSections.includes('assets');
    const canOpenTracking = availableSections.includes('tracking');

    return (
        <div>
            <PageHeading
                title="Operations overview"
                description="Start with the decisions that affect safe dispatch, then move directly into the authorized workflow."
                actions={
                    canOpenDispatch ? (
                        <Button
                            variant="primary"
                            onClick={() => onSectionChange('dispatch')}
                        >
                            Review dispatches
                            <ArrowRight
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                        </Button>
                    ) : undefined
                }
            />

            <div className="space-y-6 p-4 md:p-6">
                {/* Executive KPI Stats Bar */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard
                        label="Active Workloads"
                        value={`${activeJobs.length}`}
                        subtext={`of ${jobs.length} visible jobs active`}
                        icon={Activity}
                        tone={activeJobs.length > 0 ? 'brand' : 'default'}
                        onClick={() => onSectionChange('dispatch')}
                    />

                    <KpiCard
                        label="Fleet Readiness"
                        value={`${readinessPercentage}%`}
                        subtext={`${dispatchableAssets} of ${totalAssets} assets ready`}
                        icon={Truck}
                        tone={
                            readinessPercentage >= 80
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
                        label="Decision Blockers"
                        value={`${actions.length}`}
                        subtext={
                            actions.length === 0
                                ? 'All reviews clear'
                                : `${actions.length} require action`
                        }
                        icon={ShieldCheck}
                        tone={actions.length > 0 ? 'warning' : 'success'}
                    />

                    <KpiCard
                        label="GPS Telemetry"
                        value={`${locations.length}`}
                        subtext={
                            locations.length === 0
                                ? 'No active pings'
                                : `${freshLocations} fresh location pings`
                        }
                        icon={Radio}
                        tone={freshLocations > 0 ? 'brand' : 'default'}
                        liveIndicator={freshLocations > 0}
                        onClick={
                            canOpenTracking
                                ? () => onSectionChange('tracking')
                                : undefined
                        }
                    />
                </div>

                {/* Decision Queue Section */}
                <section aria-labelledby="decision-queue-heading">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2
                                    id="decision-queue-heading"
                                    className="text-lg font-semibold tracking-[-0.02em] text-ink"
                                >
                                    Decision queue
                                </h2>
                                {actions.length > 0 && (
                                    <span className="inline-flex items-center rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-strong">
                                        {actions.length} action
                                        {actions.length === 1 ? '' : 's'}{' '}
                                        required
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-sm text-ink-soft">
                                Items requiring review are kept separate from
                                completed operational context.
                            </p>
                        </div>

                        {/* Filter Pills - Only show if there are multiple action categories */}
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
                                        onClick={() =>
                                            setActionFilter('approvals')
                                        }
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
                                        onClick={() =>
                                            setActionFilter('assets')
                                        }
                                        className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                                            actionFilter === 'assets'
                                                ? 'bg-surface text-ink shadow-xs'
                                                : 'text-ink-soft hover:text-ink'
                                        }`}
                                    >
                                        Assets (
                                        {countByCategory(actions, 'assets')})
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
                                        Fuel ({countByCategory(actions, 'fuel')}
                                        )
                                    </button>
                                )}
                                {categoriesInActions.includes('tracking') && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setActionFilter('tracking')
                                        }
                                        className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                                            actionFilter === 'tracking'
                                                ? 'bg-surface text-ink shadow-xs'
                                                : 'text-ink-soft hover:text-ink'
                                        }`}
                                    >
                                        Tracking (
                                        {countByCategory(actions, 'tracking')})
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
                                title={
                                    actions.length === 0
                                        ? 'No decision blockers in this workspace'
                                        : 'No matching items in this filter'
                                }
                                message={
                                    actions.length === 0
                                        ? 'There are no pending approvals, blocking assets, actionable fuel requests, or stale locations in the records available to you.'
                                        : 'Select another filter tab above to view other pending operational decisions.'
                                }
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

                {/* Main Content Grid */}
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
                    {/* Work Schedule / Work in Motion */}
                    <section aria-labelledby="scheduled-work-heading">
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2
                                    id="scheduled-work-heading"
                                    className="text-lg font-semibold tracking-[-0.02em] text-ink"
                                >
                                    Work in motion & schedule
                                </h2>
                                <p className="mt-1 text-sm text-ink-soft">
                                    Track operational progress across active and
                                    scheduled dispatch jobs.
                                </p>
                            </div>
                            <div className="flex shrink-0 gap-1 rounded-lg bg-surface-subtle p-1 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setJobView('all')}
                                    className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                                        jobView === 'all'
                                            ? 'bg-surface text-ink shadow-xs'
                                            : 'text-ink-soft hover:text-ink'
                                    }`}
                                >
                                    All Visible ({jobs.length})
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
                                    In Motion ({activeJobs.length})
                                </button>
                            </div>
                        </div>

                        <Panel className="overflow-hidden">
                            {upcomingJobs.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={CalendarClock}
                                    title="No matching work available"
                                    message="Jobs visible to your account will appear here when they are scheduled or active."
                                    primaryAction={
                                        canOpenDispatch ? (
                                            <Button
                                                size="sm"
                                                onClick={() =>
                                                    onSectionChange('dispatch')
                                                }
                                            >
                                                Open dispatch workspace
                                            </Button>
                                        ) : undefined
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

                    {/* Resource Readiness & Quick Telemetry */}
                    <div className="space-y-6">
                        <section aria-labelledby="readiness-heading">
                            <div className="mb-3">
                                <h2
                                    id="readiness-heading"
                                    className="text-lg font-semibold tracking-[-0.02em] text-ink"
                                >
                                    Resource readiness
                                </h2>
                                <p className="mt-1 text-sm text-ink-soft">
                                    Readiness breakdown before initiating
                                    assignments.
                                </p>
                            </div>
                            <Panel className="divide-y divide-line">
                                <ReadinessRow
                                    label="Scoped workload"
                                    value={String(jobs.length)}
                                    detail={`${activeJobs.length} active in field`}
                                    icon={CalendarClock}
                                />
                                <ReadinessRow
                                    label="Dispatchable assets"
                                    value={`${dispatchableAssets} / ${totalAssets}`}
                                    detail={`${readinessPercentage}% fleet available`}
                                    icon={Truck}
                                />
                                <ReadinessRow
                                    label="Blocking work orders"
                                    value={String(blockingAssets)}
                                    detail={
                                        blockingAssets === 0
                                            ? 'No maintenance blocks'
                                            : blockingAssets === 1
                                              ? '1 asset needs safety clearance'
                                              : `${blockingAssets} assets need safety clearance`
                                    }
                                    icon={ShieldCheck}
                                    tone={
                                        blockingAssets > 0
                                            ? 'warning'
                                            : 'default'
                                    }
                                />
                                {canOpenAssets && (
                                    <div className="p-3">
                                        <Button
                                            variant="secondary"
                                            className="w-full"
                                            onClick={() =>
                                                onSectionChange('assets')
                                            }
                                        >
                                            Review fleet and equipment
                                        </Button>
                                    </div>
                                )}
                            </Panel>
                        </section>

                        {/* Telemetry Status Summary Widget */}
                        <section aria-labelledby="telemetry-summary-heading">
                            <div className="mb-3 flex items-center justify-between">
                                <h2
                                    id="telemetry-summary-heading"
                                    className="text-sm font-semibold tracking-wide text-ink uppercase"
                                >
                                    Field Telemetry
                                </h2>
                                {canOpenTracking && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onSectionChange('tracking')
                                        }
                                        className="text-xs font-semibold text-brand hover:underline"
                                    >
                                        View map →
                                    </button>
                                )}
                            </div>
                            <Panel className="p-4">
                                {locations.length === 0 ? (
                                    <div className="flex items-center gap-3 text-sm text-ink-soft">
                                        <Radio
                                            className="h-4 w-4 shrink-0 text-muted"
                                            aria-hidden="true"
                                        />
                                        <span>
                                            No location updates recorded
                                        </span>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="flex items-center gap-1.5 font-medium text-ink">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                                                </span>
                                                Live Pings
                                            </span>
                                            <span className="font-semibold text-ink">
                                                {freshLocations} /{' '}
                                                {locations.length}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                                            <div
                                                className="h-full rounded-full bg-success transition-all duration-500"
                                                style={{
                                                    width: `${locations.length > 0 ? (freshLocations / locations.length) * 100 : 0}%`,
                                                }}
                                            />
                                        </div>
                                        <p className="text-xs text-ink-soft">
                                            {freshLocations === locations.length
                                                ? 'All registered device locations are active and transmitting.'
                                                : `${locations.length - freshLocations} position updates marked stale or offline.`}
                                        </p>
                                    </div>
                                )}
                            </Panel>
                        </section>
                    </div>
                </div>
            </div>
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
    icon: LucideIcon;
    tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger';
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
            <span className="text-xl font-semibold tracking-[-0.02em] tabular-nums">
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
    const decisionReadyApprovals = approvals.filter(
        (approval) => approval.can_decide,
    );
    const blockedAssets = assets.filter(
        (asset) => asset.blocking_work_orders_count > 0,
    );
    const actionableFuelRequests = fuelRequests.filter((request) =>
        canActOnFuelRequest(request, capabilities),
    );
    const staleLocations = locations.filter((location) =>
        ['stale', 'offline'].includes(location.freshness_status),
    );

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
