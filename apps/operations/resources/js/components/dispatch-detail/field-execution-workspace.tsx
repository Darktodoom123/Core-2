import { router } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    Clock3,
    MapPin,
    RefreshCw,
    Route,
} from 'lucide-react';
import React, { useState } from 'react';
import { MapLibreMap, useMapLibre } from '@/components/maplibre/maplibre-map';
import { Button, DataPair, EmptyState, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { formatDateTime } from '@/lib/formatters';
import { usePreciseLocation } from '@/services/reverse-geocoder';
import type {
    AssetCandidateViewModel,
    CandidatePageViewModel,
    DispatchDetailPageProps,
    PersonnelCandidateViewModel,
} from '@/types/workspace';
import { CurrentAssignments } from './current-assignments';

export function FieldExecutionWorkspace({
    job,
    execution,
    capabilities,
    personnelCandidates,
    assetCandidates,
    personnelPage,
    assetPage,
}: {
    job: DispatchDetailPageProps['job'];
    execution: NonNullable<DispatchDetailPageProps['execution']>;
    capabilities: DispatchDetailPageProps['capabilities'];
    personnelCandidates: PersonnelCandidateViewModel[];
    assetCandidates: AssetCandidateViewModel[];
    personnelPage?: CandidatePageViewModel<PersonnelCandidateViewModel>;
    assetPage?: CandidatePageViewModel<AssetCandidateViewModel>;
}) {
    const [refreshing, setRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState(false);
    const assignmentCount =
        job.personnel_assignments.length + job.asset_assignments.length;

    const refresh = () => {
        setRefreshing(true);
        setRefreshError(false);
        router.reload({
            only: [
                'job',
                'execution',
                'capabilities',
                'progression',
                'personnel_candidates',
                'asset_candidates',
            ],
            onError: () => setRefreshError(true),
            onFinish: () => setRefreshing(false),
        });
    };

    return (
        <div className="space-y-5">
            <nav
                aria-label="Execution view sections"
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3 text-sm"
            >
                <a
                    href="#field-execution"
                    className="rounded px-1.5 py-0.5 font-semibold text-brand-strong underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                >
                    Execution
                </a>
                {execution.activity.length > 0 && (
                    <a
                        href="#execution-activity"
                        className="rounded px-1.5 py-0.5 text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                    >
                        Activity
                    </a>
                )}
                {(assignmentCount > 0 || capabilities.reassign_resources) && (
                    <a
                        href="#assignment-summary"
                        className="rounded px-1.5 py-0.5 text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                    >
                        Resources
                    </a>
                )}
                <Button
                    type="button"
                    variant="quiet"
                    size="sm"
                    className="ml-auto"
                    onClick={refresh}
                    disabled={refreshing}
                    aria-busy={refreshing}
                >
                    <RefreshCw
                        className={
                            refreshing ? 'size-3.5 animate-spin' : 'size-3.5'
                        }
                        aria-hidden="true"
                    />
                    {refreshing ? 'Refreshing…' : 'Refresh record'}
                </Button>
            </nav>

            {refreshError && (
                <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning-strong"
                    role="status"
                >
                    <span>
                        Refresh failed. Showing the last recorded execution
                        snapshot.
                    </span>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={refresh}
                    >
                        Try again
                    </Button>
                </div>
            )}

            <div
                id="field-execution"
                className="grid scroll-mt-24 gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.85fr)]"
            >
                <div className="min-w-0 space-y-5">
                    <Panel className="overflow-hidden">
                        <div className="border-b border-line px-4 py-4 sm:px-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="text-xl font-semibold text-ink">
                                        Execution overview
                                    </h2>
                                    <p className="mt-1 text-sm text-ink-soft">
                                        Recorded dispatch state and field
                                        evidence for {job.client}.
                                    </p>
                                </div>
                                <CanonicalStatusBadge
                                    status={execution.status}
                                />
                            </div>
                        </div>
                        <dl className="grid gap-0 divide-y divide-line px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-5">
                            <DataPair
                                label="Schedule"
                                value={
                                    <span className="inline-flex items-start gap-2">
                                        <CalendarDays
                                            className="mt-0.5 size-4 shrink-0 text-brand"
                                            aria-hidden="true"
                                        />
                                        <span>
                                            {formatDateTime(
                                                job.scheduled_start,
                                            )}{' '}
                                            –{' '}
                                            {formatDateTime(job.scheduled_end)}
                                        </span>
                                    </span>
                                }
                            />
                            <DataPair
                                label="Job record updated"
                                value={formatDateTime(execution.updated_at)}
                            />
                        </dl>
                    </Panel>

                    {execution.issues.length > 0 && (
                        <Panel className="overflow-hidden">
                            <div className="border-b border-line px-4 py-3 sm:px-5">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle
                                        className="size-4 text-warning-strong"
                                        aria-hidden="true"
                                    />
                                    <h2 className="font-semibold">
                                        Execution issues
                                    </h2>
                                </div>
                                <p className="mt-0.5 text-xs text-ink-soft">
                                    Recorded follow-up items associated with
                                    field evidence.
                                </p>
                            </div>
                            <ul className="divide-y divide-line">
                                {execution.issues.map((issue, index) => (
                                    <li
                                        key={`${issue.kind}-${index}`}
                                        className="px-4 py-3 sm:px-5"
                                    >
                                        <p className="text-sm font-semibold text-ink">
                                            {issue.title}
                                        </p>
                                        <p className="mt-1 text-sm leading-6 text-ink-soft">
                                            {issue.detail}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    )}

                    <RecordedProgress execution={execution} />
                </div>

                <aside className="min-w-0 space-y-5 lg:row-span-2">
                    <ExecutionContext job={job} />
                    <div id="assignment-summary">
                        <CurrentAssignments
                            job={job}
                            capabilities={capabilities}
                            personnelCandidates={personnelCandidates}
                            assetCandidates={assetCandidates}
                            personnelPage={personnelPage}
                            assetPage={assetPage}
                        />
                    </div>
                </aside>

                <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-2">
                    <SiteEvidence execution={execution} />
                    <ExecutionActivity activity={execution.activity} />
                </div>
            </div>
        </div>
    );
}

function RecordedProgress({
    execution,
}: {
    execution: NonNullable<DispatchDetailPageProps['execution']>;
}) {
    return (
        <Panel className="overflow-hidden">
            <div className="border-b border-line px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold">Recorded progress</h2>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Milestones appear when a field status update is
                            recorded.
                        </p>
                    </div>
                    <Route
                        className="size-5 text-ink-soft"
                        aria-hidden="true"
                    />
                </div>
            </div>
            {execution.milestones.length === 0 ? (
                <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
                    <Clock3
                        className="mt-0.5 size-4 shrink-0 text-ink-soft"
                        aria-hidden="true"
                    />
                    <p className="text-sm leading-6 text-ink-soft">
                        Current status:{' '}
                        <span className="font-semibold text-ink">
                            {execution.status.label}
                        </span>
                        . No field milestone timestamps are available for this
                        dispatch yet.
                    </p>
                </div>
            ) : (
                <ol
                    className="divide-y divide-line"
                    aria-label="Recorded field milestones"
                >
                    {execution.milestones.map((milestone) => (
                        <li
                            key={milestone.id}
                            className="flex items-start gap-3 px-4 py-3 sm:px-5"
                        >
                            <CheckCircle2
                                className="mt-0.5 size-4 shrink-0 text-success-strong"
                                aria-hidden="true"
                            />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-ink">
                                    {milestone.status.label}
                                </p>
                                <p className="mt-0.5 text-xs text-ink-soft">
                                    {milestone.recorded_at
                                        ? `Recorded ${formatDateTime(milestone.recorded_at)}`
                                        : 'Recorded time unavailable'}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </Panel>
    );
}

function SiteEvidence({
    execution,
}: {
    execution: NonNullable<DispatchDetailPageProps['execution']>;
}) {
    const { site } = execution;
    const location = site.latest_location;
    const plannedLocationName = usePreciseLocation(
        site.planned_coordinates
            ? {
                  ...site.planned_coordinates,
                  job: { site: site.name },
              }
            : { job: { site: site.name } },
    );
    const sharedLocationName = usePreciseLocation(
        location
            ? {
                  latitude: location.latitude,
                  longitude: location.longitude,
                  job: { site: site.name },
                  asset: location.asset,
              }
            : null,
    );
    const markerPositions = React.useMemo(
        () => [
            ...(site.planned_coordinates
                ? [
                      [
                          site.planned_coordinates.longitude,
                          site.planned_coordinates.latitude,
                      ] as [number, number],
                  ]
                : []),
            ...(location
                ? [[location.longitude, location.latitude] as [number, number]]
                : []),
        ],
        [location, site.planned_coordinates],
    );
    const mapCenter = location
        ? ([location.longitude, location.latitude] as [number, number])
        : site.planned_coordinates
          ? ([
                site.planned_coordinates.longitude,
                site.planned_coordinates.latitude,
            ] as [number, number])
          : null;

    return (
        <Panel className="overflow-hidden">
            <div className="border-b border-line px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold">
                            Site and location evidence
                        </h2>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Planned site details and authorized shared location
                            records.
                        </p>
                    </div>
                    <MapPin
                        className="size-5 text-ink-soft"
                        aria-hidden="true"
                    />
                </div>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5">
                {mapCenter && (
                    <div className="overflow-hidden rounded-lg border border-line bg-surface-subtle">
                        <MapLibreMap
                            center={mapCenter}
                            zoom={14}
                            ariaLabel="Recorded dispatch site and authorized shared location map"
                            className="h-56"
                        >
                            <SiteEvidenceViewport positions={markerPositions} />
                            {site.planned_coordinates && (
                                <SiteEvidenceMarker
                                    position={[
                                        site.planned_coordinates.longitude,
                                        site.planned_coordinates.latitude,
                                    ]}
                                    color="#64748b"
                                    label="Planned site"
                                />
                            )}
                            {location && (
                                <SiteEvidenceMarker
                                    position={[
                                        location.longitude,
                                        location.latitude,
                                    ]}
                                    color="#e6a719"
                                    label="Latest shared location"
                                />
                            )}
                        </MapLibreMap>
                        <p className="border-t border-line px-3 py-2 text-xs text-ink-soft">
                            {location && site.planned_coordinates
                                ? 'Map shows the planned site and latest authorized shared location.'
                                : site.planned_coordinates
                                  ? 'Map shows the planned site coordinates.'
                                  : 'Map shows the latest authorized shared location.'}
                        </p>
                    </div>
                )}
                <div>
                    <h3 className="text-xs font-semibold text-ink-soft">
                        Planned site
                    </h3>
                    <p className="mt-1 font-medium text-ink">{site.name}</p>
                    <p className="mt-1 text-sm leading-6 text-ink-soft">
                        {site.notes?.trim() ||
                            'No additional site instructions were recorded.'}
                    </p>
                    <p
                        data-testid="planned-location-name"
                        className="mt-2 text-sm text-ink-soft"
                    >
                        {plannedLocationName}
                    </p>
                </div>
                <div className="border-t border-line pt-4">
                    <h3 className="text-xs font-semibold text-ink-soft">
                        Shared location
                    </h3>
                    {location ? (
                        <div className="mt-2 space-y-1 text-sm">
                            <p className="font-medium text-ink">
                                {sharedLocationName}
                            </p>
                            <p className="text-xs text-ink-soft">
                                Source:{' '}
                                {location.asset?.code ??
                                    location.user?.name ??
                                    location.source}
                            </p>
                            {location.accuracy_metres !== null && (
                                <p className="text-xs text-ink-soft">
                                    Accuracy recorded: ±
                                    {location.accuracy_metres.toFixed(0)} m
                                </p>
                            )}
                            <p className="text-xs text-ink-soft">
                                Captured on device:{' '}
                                {formatDateTime(location.captured_at)}
                            </p>
                            <p className="text-xs text-ink-soft">
                                Received by operations:{' '}
                                {formatDateTime(location.received_at)}
                            </p>
                        </div>
                    ) : (
                        <p className="mt-1 text-sm leading-6 text-ink-soft">
                            No shared location is available to you for this
                            dispatch.
                        </p>
                    )}
                </div>
            </div>
        </Panel>
    );
}

function SiteEvidenceViewport({
    positions,
}: {
    positions: [number, number][];
}) {
    const { map, maplibregl, prefersReducedMotion } = useMapLibre();

    React.useEffect(() => {
        if (positions.length < 2) {
            return;
        }

        const bounds = new maplibregl.LngLatBounds(positions[0], positions[0]);

        positions.slice(1).forEach((position) => bounds.extend(position));
        map.fitBounds(bounds, {
            padding: 48,
            maxZoom: 14,
            duration: prefersReducedMotion ? 0 : 350,
        });
    }, [map, maplibregl, positions, prefersReducedMotion]);

    return null;
}

function ExecutionActivity({
    activity,
}: {
    activity: NonNullable<DispatchDetailPageProps['execution']>['activity'];
}) {
    return (
        <Panel id="execution-activity" className="overflow-hidden">
            <div className="border-b border-line px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold">
                            Recent recorded activity
                        </h2>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Status, report, and location records available to
                            you.
                        </p>
                    </div>
                    <Activity
                        className="size-5 text-ink-soft"
                        aria-hidden="true"
                    />
                </div>
            </div>
            {activity.length === 0 ? (
                <EmptyState
                    compact
                    icon={Activity}
                    title="No field activity recorded"
                    message="Recorded updates will appear here as they arrive."
                />
            ) : (
                <ol
                    className="divide-y divide-line"
                    aria-label="Recent recorded activity"
                >
                    {activity.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-start gap-3 px-4 py-3 sm:px-5"
                        >
                            <Activity
                                className="mt-0.5 size-4 shrink-0 text-brand"
                                aria-hidden="true"
                            />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-ink">
                                    {item.title}
                                </p>
                                <p className="mt-0.5 text-sm leading-6 text-ink-soft">
                                    {item.detail}
                                </p>
                                <p className="mt-1 text-xs text-ink-soft">
                                    {formatDateTime(item.recorded_at)}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </Panel>
    );
}

function ExecutionContext({ job }: { job: DispatchDetailPageProps['job'] }) {
    return (
        <Panel className="overflow-hidden">
            <div className="border-b border-line px-4 py-3">
                <h2 className="font-semibold">Execution context</h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                    Resource scope for this dispatch.
                </p>
            </div>
            <dl className="divide-y divide-line px-4">
                <DataPair
                    label="Resources"
                    value={`${job.personnel_assignments.length + job.asset_assignments.length} assigned`}
                />
            </dl>
        </Panel>
    );
}

function SiteEvidenceMarker({
    position,
    color,
    label,
}: {
    position: [number, number];
    color: string;
    label: string;
}) {
    const { map, maplibregl } = useMapLibre();

    React.useEffect(() => {
        const element = document.createElement('div');
        element.setAttribute('aria-label', label);
        element.style.width = '16px';
        element.style.height = '16px';
        element.style.borderRadius = '999px';
        element.style.backgroundColor = color;
        element.style.border = '2px solid white';
        element.style.boxShadow = '0 1px 4px rgba(15, 23, 42, 0.35)';

        const marker = new maplibregl.Marker({ element })
            .setLngLat(position)
            .addTo(map);

        return () => {
            marker.remove();
        };
    }, [color, label, map, maplibregl, position]);

    return null;
}
