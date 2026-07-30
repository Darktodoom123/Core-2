import {
    AlertTriangle,
    ArrowRight,
    CalendarClock,
    CircleCheck,
    Fuel,
    MapPin,
    ShieldCheck,
    Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
    const actions = buildDashboardActions({
        assets,
        fuelRequests,
        locations,
        approvals,
        capabilities,
    });
    const upcomingJobs = jobs
        .filter((job) => !['completed', 'cancelled'].includes(job.status.value))
        .slice(0, 5);
    const dispatchableAssets = assets.filter(
        (asset) => asset.is_dispatchable,
    ).length;
    const blockingAssets = assets.filter(
        (asset) => asset.blocking_work_orders_count > 0,
    ).length;
    const canOpenDispatch = availableSections.includes('dispatch');
    const canOpenAssets = availableSections.includes('assets');

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
                <section aria-labelledby="decision-queue-heading">
                    <div className="mb-3 flex items-end justify-between gap-4">
                        <div>
                            <h2
                                id="decision-queue-heading"
                                className="text-lg font-semibold tracking-[-0.02em]"
                            >
                                Decision queue
                            </h2>
                            <p className="mt-1 text-sm text-ink-soft">
                                Items requiring review are kept separate from
                                completed operational context.
                            </p>
                        </div>
                        <span className="text-sm font-medium text-ink-soft">
                            {actions.length} open
                        </span>
                    </div>

                    <Panel className="overflow-hidden">
                        {actions.length === 0 ? (
                            <EmptyState
                                compact
                                icon={CircleCheck}
                                title="No decision blockers in this workspace"
                                message="There are no pending approvals, blocking assets, actionable fuel requests, or stale locations in the records available to you."
                            />
                        ) : (
                            <ul className="divide-y divide-line">
                                {actions.map((action) => (
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

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
                    <section aria-labelledby="scheduled-work-heading">
                        <div className="mb-3">
                            <h2
                                id="scheduled-work-heading"
                                className="text-lg font-semibold tracking-[-0.02em]"
                            >
                                Upcoming work
                            </h2>
                            <p className="mt-1 text-sm text-ink-soft">
                                The next visible jobs, ordered by their
                                server-provided schedule.
                            </p>
                        </div>
                        <Panel className="overflow-hidden">
                            {upcomingJobs.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={CalendarClock}
                                    title="No upcoming work is available"
                                    message="Jobs visible to your account will appear here when they are scheduled or awaiting review."
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
                                        <li key={job.id}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onSectionChange('dispatch')
                                                }
                                                className="flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                                            >
                                                <CalendarClock
                                                    className="h-5 w-5 shrink-0 text-ink-soft"
                                                    aria-hidden="true"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <span className="font-semibold text-ink">
                                                            {job.reference}
                                                        </span>
                                                        <CanonicalStatusBadge
                                                            status={job.status}
                                                        />
                                                    </span>
                                                    <span className="mt-1 block truncate text-sm text-ink-soft">
                                                        {job.title} · {job.site}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 text-right text-xs leading-5 text-ink-soft">
                                                    {formatSchedule(
                                                        job.scheduled_start,
                                                    )}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    </section>

                    <section aria-labelledby="readiness-heading">
                        <div className="mb-3">
                            <h2
                                id="readiness-heading"
                                className="text-lg font-semibold tracking-[-0.02em]"
                            >
                                Resource readiness
                            </h2>
                            <p className="mt-1 text-sm text-ink-soft">
                                A concise readiness check before opening the
                                assignment workflow.
                            </p>
                        </div>
                        <Panel className="divide-y divide-line">
                            <ReadinessRow
                                label="Visible jobs"
                                value={String(jobs.length)}
                                detail="Current scoped workload"
                                icon={CalendarClock}
                            />
                            <ReadinessRow
                                label="Dispatchable assets"
                                value={String(dispatchableAssets)}
                                detail="Ready in the records available to you"
                                icon={Truck}
                            />
                            <ReadinessRow
                                label="Blocking work orders"
                                value={String(blockingAssets)}
                                detail={
                                    blockingAssets === 1
                                        ? 'Asset requires safety review'
                                        : 'Assets require safety review'
                                }
                                icon={ShieldCheck}
                                tone={
                                    blockingAssets > 0 ? 'warning' : 'default'
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
                </div>
            </div>
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
                className="flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
                <span
                    className={
                        action.tone === 'danger'
                            ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger'
                            : action.tone === 'warning'
                              ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-strong'
                              : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info-strong'
                    }
                >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">
                        {action.title}
                    </span>
                    <span className="mt-0.5 block text-sm leading-5 text-ink-soft">
                        {action.description}
                    </span>
                </span>
                <ArrowRight
                    className="h-4 w-4 shrink-0 text-ink-soft"
                    aria-hidden="true"
                />
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
        });
    }

    return actions;
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
