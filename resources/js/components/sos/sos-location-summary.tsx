import { ExternalLink, MapPin, ShieldAlert } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { EmptyState, Panel, StatusBadge } from '@/components/ui';
import type { LocationUpdateViewModel } from '@/types/workspace';
import type { SosIncidentViewModel } from '@/types/workspace';
import { formatSosTimestamp, humanizeSosValue } from './sos-helpers';

const LiveTrackingMap = lazy(() =>
    import('@/components/live-tracking-map').then(
        ({ LiveTrackingMap: Map }) => ({
            default: Map,
        }),
    ),
);

interface SosLocationSummaryProps {
    incident: SosIncidentViewModel;
}

export function SosLocationSummary({ incident }: SosLocationSummaryProps) {
    const location = incident.location;

    if (!location) {
        return (
            <Panel>
                <EmptyState
                    compact
                    icon={ShieldAlert}
                    title="No location captured"
                    message="GPS is optional for SOS. The alert was not blocked because a location was unavailable."
                />
            </Panel>
        );
    }

    const mapLocation = toMapLocation(incident);
    const openMapUrl =
        location.latitude === null || location.longitude === null
            ? null
            : `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-base font-semibold text-ink">
                        Emergency location
                    </h3>
                    <p className="mt-1 text-sm text-ink-soft">
                        The map and text alternative use the same server
                        snapshot.
                    </p>
                </div>
                {openMapUrl && (
                    <a
                        href={openMapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-subtle"
                    >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        Open map
                    </a>
                )}
            </div>

            <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <Suspense
                    fallback={
                        <div
                            className="flex h-64 items-center justify-center bg-surface-subtle text-sm text-ink-soft"
                            role="status"
                        >
                            Loading location map…
                        </div>
                    }
                >
                    <LiveTrackingMap
                        locations={[mapLocation]}
                        compact
                        showLocationList={false}
                    />
                </Suspense>
            </div>

            <div
                className="rounded-lg border border-line bg-surface-subtle p-4"
                aria-label="Synchronized text alternative for emergency location"
            >
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <MapPin
                        className="h-4 w-4 text-brand-strong"
                        aria-hidden="true"
                    />
                    Text location alternative
                </div>
                <dl className="mt-2 divide-y divide-line">
                    <div className="grid gap-1 py-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
                        <dt className="text-ink-soft">Coordinates</dt>
                        <dd className="font-medium break-all text-ink">
                            {location.latitude}, {location.longitude}
                        </dd>
                    </div>
                    <div className="grid gap-1 py-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
                        <dt className="text-ink-soft">Location freshness</dt>
                        <dd>
                            <StatusBadge
                                status={humanizeSosValue(
                                    location.freshness_status,
                                )}
                            />
                        </dd>
                    </div>
                    <div className="grid gap-1 py-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
                        <dt className="text-ink-soft">Captured at</dt>
                        <dd className="font-medium text-ink">
                            {formatSosTimestamp(location.captured_at)}
                        </dd>
                    </div>
                    <div className="grid gap-1 py-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
                        <dt className="text-ink-soft">Accuracy</dt>
                        <dd className="font-medium text-ink">
                            {location.accuracy_metres === null
                                ? 'Not recorded'
                                : `Within ${Math.round(location.accuracy_metres)} metres`}
                        </dd>
                    </div>
                    {location.context && (
                        <div className="grid gap-1 py-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
                            <dt className="text-ink-soft">Context</dt>
                            <dd className="font-medium text-ink">
                                {location.context}
                            </dd>
                        </div>
                    )}
                </dl>
            </div>
        </div>
    );
}

function toMapLocation(
    incident: SosIncidentViewModel,
): LocationUpdateViewModel {
    const location = incident.location;
    const numericId = [...incident.id].reduce(
        (hash, character) => (hash * 31 + character.charCodeAt(0)) | 0,
        0,
    );

    return {
        id: Math.abs(numericId),
        user: { id: incident.worker.id, name: incident.worker.name },
        asset: incident.asset ? { ...incident.asset, kind: 'equipment' } : null,
        job: incident.dispatch
            ? {
                  id: incident.dispatch.id,
                  reference: incident.dispatch.reference,
                  title: incident.dispatch.title,
              }
            : null,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        accuracy_metres: location?.accuracy_metres ?? null,
        speed: null,
        remarks: location?.context ?? null,
        source: 'sos',
        sharing_enabled: true,
        captured_at: location?.captured_at ?? null,
        received_at: incident.received_at,
        freshness_status: location?.freshness_status ?? 'offline',
    };
}
