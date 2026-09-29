import { usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Building2,
    CalendarClock,
    Fuel,
    MapPin,
    Radio,
    Truck,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { SystemAdminDashboard } from '@/components/dashboards/admin/admin-dashboard';
import { OperationsManagerDashboard } from '@/components/dashboards/manager/manager-dashboard';
import { Button, EmptyState, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { cn } from '@/lib/utils';
import type {
    ApprovalViewModel,
    AssetViewModel,
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
        options?: { serviceRequestId?: number; tab?: string },
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

    if (isSystemAdmin) {
        return (
            <div className="workspace-width-contained p-4 md:p-6">
                <SystemAdminDashboard {...props} />
            </div>
        );
    }

    if (!isFieldRole) {
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
            <DashboardHeader
                onSectionChange={props.onSectionChange}
                availableSections={props.availableSections}
            />

            <div className="space-y-6 p-4 md:p-6">
                <FieldWorkerDashboardView {...props} />
            </div>
        </div>
    );
}

const FIELD_ROLES = ['driver', 'crane_operator', 'field_worker'];

/* =========================================================================
   HEADER
   ========================================================================= */

function DashboardHeader({
    onSectionChange,
    availableSections,
}: {
    onSectionChange: (section: WorkspaceSection) => void;
    availableSections: WorkspaceSection[];
}) {
    const canOpenDispatch = availableSections.includes('dispatch');

    return (
        <div className="border-b border-line bg-surface px-5 py-5 lg:px-7">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
                        Operation Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-ink-soft">
                        Assigned jobs, equipment status, and active field tasks.
                    </p>
                </div>

                <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto">
                    {canOpenDispatch ? (
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
