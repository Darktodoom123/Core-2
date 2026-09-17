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
                {(execution.handoff_evidence ||
                    job.source?.type === 'rental_reservation' ||
                    job.source?.type === 'sales_order') && (
                    <a
                        href="#handoff-evidence"
                        className="rounded px-1.5 py-0.5 text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                    >
                        Evidence
                    </a>
                )}
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

                    {execution.handoff_evidence ? (
                        <HandoffEvidencePanel
                            evidence={execution.handoff_evidence}
                        />
                    ) : job.source?.type === 'rental_reservation' ||
                      job.source?.type === 'sales_order' ? (
                        <Panel
                            id="handoff-evidence"
                            className="overflow-hidden border-line"
                        >
                            <div className="border-b border-line bg-surface-subtle/40 px-4 py-3 sm:px-5">
                                <div className="flex items-center justify-between">
                                    <h2 className="font-semibold text-ink">
                                        Field Delivery &amp; Handover Evidence
                                    </h2>
                                    <span className="inline-flex items-center rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs text-ink-soft">
                                        Awaiting field submission
                                    </span>
                                </div>
                            </div>
                            <div className="p-4 text-xs text-ink-soft sm:p-5">
                                <p>
                                    Physical handover and customer sign-off
                                    evidence has not yet been submitted by the
                                    assigned operator.
                                </p>
                                <p className="mt-1">
                                    Evidence stored on an offline field device
                                    will synchronize and appear here
                                    automatically once connectivity is restored.
                                </p>
                            </div>
                        </Panel>
                    ) : null}

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

function HandoffEvidencePanel({
    evidence,
}: {
    evidence: NonNullable<
        NonNullable<DispatchDetailPageProps['execution']>['handoff_evidence']
    >;
}) {
    const [actionPending, setActionPending] = useState(false);

    const handleAuthoritativeAction = (
        action: 'checkout' | 'return' | 'fulfill',
    ) => {
        setActionPending(true);
        let url = '';

        if (action === 'checkout') {
            url = `/operations/rental-reservations/${evidence.source_id}/checkout`;
        } else if (action === 'return') {
            url = `/operations/rental-reservations/${evidence.source_id}/return`;
        } else {
            url = `/operations/sales/orders/${evidence.source_id}/fulfill`;
        }

        router.post(
            url,
            action === 'checkout'
                ? {
                      condition: [evidence.condition_assessment || 'good'],
                      notes: evidence.condition_notes || undefined,
                      damage_notes: evidence.damage_notes || undefined,
                  }
                : action === 'return'
                  ? {
                        condition: [evidence.damage_noted ? 'damaged' : 'good'],
                        notes: evidence.condition_notes || undefined,
                        damage_notes: evidence.damage_notes || undefined,
                    }
                  : {},
            {
                preserveScroll: true,
                onFinish: () => setActionPending(false),
            },
        );
    };

    const isRental = evidence.type === 'rental';

    return (
        <Panel
            id="handoff-evidence"
            className="scroll-mt-24 overflow-hidden border-brand/30"
        >
            <div className="border-b border-line bg-surface-subtle/50 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-strong">
                                <CheckCircle2
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                                {isRental
                                    ? `Rental Handover Evidence (${evidence.handover_type === 'return' ? 'Return' : 'Checkout'})`
                                    : 'Sales Delivery Evidence'}
                            </span>
                            <a
                                href={
                                    isRental
                                        ? '/operations/rental-reservations'
                                        : '/operations/sales/orders'
                                }
                                className="font-mono text-xs text-ink-soft underline decoration-dotted hover:text-brand"
                                title={`Open commercial ${isRental ? 'rental' : 'sales'} orders workspace`}
                            >
                                {evidence.source_reference}{' '}
                                <span aria-hidden="true">↗</span>
                            </a>
                        </div>
                        <h2 className="mt-1 text-lg font-semibold text-ink">
                            Field evidence &amp; customer sign-off
                        </h2>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Submitted by{' '}
                            <span className="font-medium text-ink">
                                {evidence.submitted_by?.name ||
                                    'Assigned Operator'}
                            </span>
                            {evidence.submitted_at
                                ? ` · Captured: ${formatDateTime(evidence.submitted_at)}`
                                : ''}
                            {evidence.received_at
                                ? ` · Received: ${formatDateTime(evidence.received_at)}`
                                : ''}
                        </p>
                        {evidence.asset && (
                            <p className="mt-0.5 text-xs text-ink-soft">
                                Assigned Equipment:{' '}
                                <span className="font-medium text-ink">
                                    {evidence.asset.name} ({evidence.asset.code}
                                    )
                                </span>
                            </p>
                        )}
                    </div>
                    <div className="text-right">
                        <span className="inline-flex items-center rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-soft">
                            Commercial Status:{' '}
                            {evidence.managerial_status_label}
                        </span>
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
                {/* Signee Information */}
                <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
                    <h3 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                        Customer Acceptance &amp; Sign-off
                    </h3>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <DataPair
                            label="Received & Signed By"
                            value={`${evidence.signee_name} (${evidence.signee_role})`}
                        />
                        <DataPair
                            label="Digital Signature"
                            value={
                                evidence.signature_url ? (
                                    <div className="mt-1">
                                        <img
                                            src={evidence.signature_url}
                                            alt={`Customer signature by ${evidence.signee_name}`}
                                            className="h-16 max-w-xs rounded border border-line bg-white object-contain p-1 dark:bg-zinc-900"
                                        />
                                    </div>
                                ) : evidence.signature_path ? (
                                    <span className="font-mono text-xs text-ink-soft">
                                        Stored at {evidence.signature_path}
                                    </span>
                                ) : (
                                    <span className="text-xs text-ink-soft">
                                        Captured electronically
                                    </span>
                                )
                            }
                        />
                    </div>
                </div>

                {/* Rental Metrics */}
                {isRental && (
                    <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
                        <h3 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                            Asset Condition &amp; Telemetry at Handover
                        </h3>
                        <dl className="mt-2 grid gap-3 sm:grid-cols-3">
                            <DataPair
                                label="Hour Meter"
                                value={
                                    evidence.hour_meter !== undefined
                                        ? `${evidence.hour_meter} hrs`
                                        : 'Not recorded'
                                }
                            />
                            <DataPair
                                label="Fuel Level"
                                value={
                                    evidence.fuel_percent !== undefined
                                        ? `${evidence.fuel_percent}%`
                                        : 'Not recorded'
                                }
                            />
                            <DataPair
                                label="Condition Assessment"
                                value={
                                    evidence.condition_assessment ? (
                                        <span className="font-medium text-ink capitalize">
                                            {evidence.condition_assessment}
                                        </span>
                                    ) : (
                                        'Standard'
                                    )
                                }
                            />
                        </dl>
                        {evidence.condition_notes && (
                            <div className="mt-3 text-xs">
                                <span className="font-semibold text-ink-soft">
                                    Condition Notes:{' '}
                                </span>
                                <span className="text-ink">
                                    {evidence.condition_notes}
                                </span>
                            </div>
                        )}

                        {evidence.damage_noted && (
                            <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-xs text-warning-strong">
                                <AlertTriangle
                                    className="mt-0.5 size-4 shrink-0"
                                    aria-hidden="true"
                                />
                                <div>
                                    <p className="font-semibold">
                                        Damage Noted During Handover
                                    </p>
                                    <p className="mt-0.5">
                                        {evidence.damage_notes ||
                                            'No specific damage description provided.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Sales Metrics */}
                {!isRental && (
                    <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
                        <h3 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                            Delivery Verification &amp; Handover Details
                        </h3>
                        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                            <DataPair
                                label="Verified Serial / VIN"
                                value={evidence.verified_vin || 'Pending'}
                            />
                            <DataPair
                                label="Accessories Verified"
                                value={
                                    evidence.accessories_checked &&
                                    evidence.accessories_checked.length > 0
                                        ? evidence.accessories_checked.join(
                                              ', ',
                                          )
                                        : 'None recorded'
                                }
                            />
                        </dl>
                        {evidence.delivery_notes && (
                            <div className="mt-3 text-xs">
                                <span className="font-semibold text-ink-soft">
                                    Delivery Notes:{' '}
                                </span>
                                <span className="text-ink">
                                    {evidence.delivery_notes}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Photos */}
                {evidence.photos && evidence.photos.length > 0 && (
                    <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
                        <h3 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                            Inspection &amp; Handover Photos (
                            {evidence.photos.length})
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {evidence.photos.map((photo, index) => (
                                <div
                                    key={index}
                                    className="overflow-hidden rounded-md border border-line"
                                >
                                    {photo.url ? (
                                        <img
                                            src={photo.url}
                                            alt={
                                                photo.label ||
                                                `Photo ${index + 1}`
                                            }
                                            className="h-20 w-24 object-cover"
                                            onError={(e) => {
                                                const img = e.currentTarget;

                                                img.style.display = 'none';
                                                const fallback =
                                                    img.parentElement?.querySelector(
                                                        '.photo-fallback',
                                                    ) as HTMLElement | null;

                                                if (fallback) {
                                                    fallback.style.display =
                                                        'flex';
                                                }
                                            }}
                                        />
                                    ) : null}
                                    <div
                                        className="photo-fallback flex h-20 w-24 items-center justify-center bg-surface-subtle p-1 text-center text-[10px] text-ink-soft"
                                        style={{
                                            display: photo.url
                                                ? 'none'
                                                : 'flex',
                                        }}
                                    >
                                        {photo.label || `Photo ${index + 1}`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Managerial Authoritative Action Box */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/20 bg-brand-soft/30 p-3 sm:p-4">
                    <div className="max-w-xl text-xs">
                        <p className="font-semibold text-ink">
                            Commercial Order State &amp; Managerial Control
                        </p>
                        <p className="mt-0.5 text-ink-soft">
                            Operator mobile submission marks the dispatch
                            attempt completed. Official commercial status
                            remains{' '}
                            <span className="font-medium text-ink">
                                {evidence.managerial_status_label}
                            </span>{' '}
                            until processed by an authorized operations desk
                            manager.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {evidence.can_checkout && (
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                disabled={actionPending}
                                onClick={() =>
                                    handleAuthoritativeAction('checkout')
                                }
                            >
                                {actionPending
                                    ? 'Processing…'
                                    : 'Process Authoritative Checkout'}
                            </Button>
                        )}
                        {evidence.can_return && (
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                disabled={actionPending}
                                onClick={() =>
                                    handleAuthoritativeAction('return')
                                }
                            >
                                {actionPending
                                    ? 'Processing…'
                                    : 'Process Authoritative Return'}
                            </Button>
                        )}
                        {evidence.can_fulfill && (
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                disabled={actionPending}
                                onClick={() =>
                                    handleAuthoritativeAction('fulfill')
                                }
                            >
                                {actionPending
                                    ? 'Processing…'
                                    : 'Process Authoritative Fulfillment'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Panel>
    );
}
