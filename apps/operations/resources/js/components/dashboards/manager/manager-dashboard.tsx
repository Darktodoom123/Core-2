import { useMemo, useRef, useState } from 'react';
import { LiveTrackingPreview } from '@/components/dashboards/live-tracking-preview';
import type {
    ApprovalViewModel,
    AssetViewModel,
    DispatchJobViewModel,
    FuelRequestViewModel,
    LocationUpdateViewModel,
    ScopeRefreshState,
    SosIncidentViewModel,
    WorkspaceCapabilities,
    WorkspaceSection,
} from '@/types/workspace';
import { FleetBreakdownPanel } from './fleet-breakdown-panel';
import { ManagerActionQueue } from './manager-action-queue';
import { ManagerDashboardHeader } from './manager-dashboard-header';
import type {
    QueueCategory,
    QueueFilter,
    ScheduleSourceFilter,
} from './manager-dashboard-model';
import {
    buildManagerQueue,
    isUnresolvedSos,
    localDayBounds,
    partitionTodayJobs,
    summarizeAuthorizations,
    summarizeFleet,
    summarizeSafety,
    summarizeSchedule,
} from './manager-dashboard-model';
import { ManagerMetricStrip } from './manager-metric-strip';
import { ManagerSchedulePanel } from './manager-schedule-panel';
import { useNow } from './use-now';
import { useTodayDispatches } from './use-today-dispatches';

const CLOCK_INTERVAL_MS = 15_000;

export interface OperationsManagerDashboardProps {
    jobs: DispatchJobViewModel[];
    assets: AssetViewModel[];
    assetsTotal?: number;
    fuelRequests: FuelRequestViewModel[];
    locations: LocationUpdateViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    approvals: ApprovalViewModel[];
    capabilities: WorkspaceCapabilities;
    availableSections: WorkspaceSection[];
    refresh?: ScopeRefreshState;
    workspaceRefresh?: ScopeRefreshState;
    realtimeConnected?: boolean;
    onSectionChange: (
        section: WorkspaceSection,
        options?: { serviceRequestId?: number },
    ) => void;
}

const EMPTY_INCIDENTS: SosIncidentViewModel[] = [];

export function OperationsManagerDashboard({
    jobs,
    assets,
    assetsTotal,
    fuelRequests,
    locations,
    activeSosIncidents = EMPTY_INCIDENTS,
    approvals,
    capabilities,
    availableSections,
    refresh,
    workspaceRefresh,
    realtimeConnected = false,
    onSectionChange,
}: OperationsManagerDashboardProps) {
    const now = useNow(CLOCK_INTERVAL_MS);
    const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
    const [queueExpanded, setQueueExpanded] = useState(false);
    const [sourceFilter, setSourceFilter] =
        useState<ScheduleSourceFilter>('all');
    const queueHeadingRef = useRef<HTMLHeadingElement>(null);

    const dayStart = localDayBounds(now).start.getTime();
    const today = useTodayDispatches({
        dayStart,
        enabled: true,
        refreshKey: workspaceRefresh?.refreshed_at,
    });

    const queue = useMemo(
        () =>
            buildManagerQueue(
                {
                    activeSosIncidents,
                    assets,
                    approvals,
                    fuelRequests,
                    capabilities,
                },
                now,
            ),
        [
            activeSosIncidents,
            approvals,
            assets,
            capabilities,
            fuelRequests,
            now,
        ],
    );
    const fleet = useMemo(
        () => summarizeFleet(assets, assetsTotal, now),
        [assets, assetsTotal, now],
    );
    const todaySummary = useMemo(
        () => summarizeSchedule(partitionTodayJobs(today.jobs, now).dated),
        [today.jobs, now],
    );
    const authorizations = summarizeAuthorizations(queue);
    const safety = summarizeSafety(activeSosIncidents, assets, now);
    const sosDispatchIds = useMemo(
        () =>
            new Set(
                activeSosIncidents
                    .filter(isUnresolvedSos)
                    .flatMap((incident) =>
                        incident.dispatch ? [incident.dispatch.id] : [],
                    ),
            ),
        [activeSosIncidents],
    );

    const canOpenDispatch = availableSections.includes('dispatch');
    const canOpenAssets = availableSections.includes('assets');

    const focusQueue = (category: QueueCategory) => {
        setQueueFilter(category);
        const heading = queueHeadingRef.current;

        if (heading) {
            const reduceMotion = window.matchMedia?.(
                '(prefers-reduced-motion: reduce)',
            ).matches;
            heading.scrollIntoView?.({
                behavior: reduceMotion ? 'auto' : 'smooth',
                block: 'start',
            });
            heading.focus({ preventScroll: true });
        }
    };

    return (
        <div className="space-y-5">
            <ManagerDashboardHeader
                actionCount={queue.length}
                todayTotal={
                    today.status === 'ready' ? todaySummary.total : null
                }
                inService={fleet.inService}
                loadedUnits={fleet.loaded}
                realtimeConnected={realtimeConnected}
                workspaceRefresh={workspaceRefresh}
                now={now}
            />

            <ManagerMetricStrip
                schedule={todaySummary}
                scheduleStatus={today.status}
                fleet={fleet}
                authorizations={authorizations}
                safety={safety}
                now={now}
                canOpenDispatch={canOpenDispatch}
                canOpenAssets={canOpenAssets}
                onOpenSection={onSectionChange}
                onFilterQueue={focusQueue}
            />

            <ManagerActionQueue
                items={queue}
                filter={queueFilter}
                expanded={queueExpanded}
                now={now}
                headingRef={queueHeadingRef}
                availableSections={availableSections}
                onFilterChange={setQueueFilter}
                onExpandedChange={setQueueExpanded}
                onSectionChange={onSectionChange}
            />

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)] xl:items-start">
                <ManagerSchedulePanel
                    today={today}
                    now={now}
                    sourceFilter={sourceFilter}
                    onSourceFilterChange={setSourceFilter}
                    fallbackJobs={jobs}
                    sosDispatchIds={sosDispatchIds}
                    canOpenDispatch={canOpenDispatch}
                    onOpenDispatch={() => onSectionChange('dispatch')}
                />
                <FleetBreakdownPanel
                    fleet={fleet}
                    canOpenAssets={canOpenAssets}
                    onOpenAssets={() => onSectionChange('assets')}
                />
            </div>

            {canOpenAssets && (
                <LiveTrackingPreview
                    locations={locations}
                    activeSosIncidents={activeSosIncidents}
                    refresh={refresh}
                    realtimeConnected={realtimeConnected}
                    onOpenTracking={() => onSectionChange('assets')}
                />
            )}
        </div>
    );
}
