import {
    Check,
    Copy,
    ExternalLink,
    MapPin,
    Navigation,
    ShieldAlert,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Badge, EmptyState, Panel, StatusBadge } from '@/components/ui';
import type { SosIncidentViewModel } from '@/types/workspace';
import {
    describeSosAccuracy,
    formatSosAge,
    formatSosCoordinates,
    formatSosCoordinatesDms,
    formatSosTimestamp,
    humanizeSosValue,
} from './sos-helpers';
import { useSosPlaceName } from './use-sos-place-name';
import type { SosPlaceName } from './use-sos-place-name';

const SosPreciseMap = lazy(() => import('./sos-precise-map'));

interface SosLocationSummaryProps {
    incident: SosIncidentViewModel;
}

export function SosLocationSummary({ incident }: SosLocationSummaryProps) {
    const location = incident.location;
    const latitude = location?.latitude ?? null;
    const longitude = location?.longitude ?? null;
    const place = useSosPlaceName(latitude, longitude, location?.place);

    if (!location || latitude === null || longitude === null) {
        return (
            <Panel>
                <EmptyState
                    compact
                    icon={ShieldAlert}
                    title="No location captured"
                    message="GPS is optional for SOS. The alert was not blocked because a location was unavailable. Call the worker to confirm where they are."
                />
            </Panel>
        );
    }

    const coordinates = formatSosCoordinates(latitude, longitude);
    const fullLocation =
        place.status === 'ready'
            ? `${[place.primary, place.secondary].filter(Boolean).join(', ')} (${coordinates})`
            : coordinates;
    const accuracy = describeSosAccuracy(location.accuracy_metres);
    const pinUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                        <MapPin
                            className="h-4 w-4 text-danger"
                            aria-hidden="true"
                        />
                        Emergency location
                    </h3>
                    <p className="mt-1 text-sm text-ink-soft">
                        Exact fix reported by the worker&apos;s device.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-danger px-3 text-sm font-semibold text-danger-contrast shadow-xs hover:bg-danger-strong lg:min-h-9"
                    >
                        <Navigation className="h-4 w-4" aria-hidden="true" />
                        Directions
                    </a>
                    <a
                        href={pinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-subtle lg:min-h-9"
                    >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        Open map
                    </a>
                </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-line bg-surface">
                <Suspense
                    fallback={
                        <div
                            className="flex h-72 items-center justify-center bg-surface-subtle text-sm text-ink-soft md:h-80"
                            role="status"
                        >
                            Loading location map…
                        </div>
                    }
                >
                    <SosPreciseMap
                        latitude={latitude}
                        longitude={longitude}
                        accuracyMetres={location.accuracy_metres}
                        status={incident.status.value}
                        workerName={incident.worker.name}
                    />
                </Suspense>
            </div>

            <div
                className="rounded-xl border border-line bg-surface-subtle p-4"
                aria-label="Synchronized text alternative for emergency location"
                role="group"
            >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <PlaceName place={place} />
                        <p className="mt-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                            Coordinates (WGS 84)
                        </p>
                        <p className="mt-1 font-mono text-lg font-semibold break-all text-ink tabular-nums">
                            {coordinates}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-ink-soft tabular-nums">
                            {formatSosCoordinatesDms(latitude, longitude)}
                        </p>
                    </div>
                    <CopyLocationButton value={fullLocation} />
                </div>

                <dl className="mt-3 grid gap-x-6 border-t border-line pt-3 text-sm sm:grid-cols-2">
                    <LocationFact label="Accuracy">
                        <span className="inline-flex flex-wrap items-center gap-2">
                            <span className="font-medium text-ink">
                                {accuracy.label}
                            </span>
                            <Badge variant={accuracy.tone} size="sm">
                                {accuracy.quality}
                            </Badge>
                        </span>
                    </LocationFact>
                    <LocationFact label="Freshness">
                        <StatusBadge
                            status={humanizeSosValue(location.freshness_status)}
                        />
                    </LocationFact>
                    <LocationFact label="Captured at">
                        <span className="font-medium text-ink">
                            {formatSosTimestamp(location.captured_at)}
                            {location.captured_at && (
                                <span className="font-normal text-ink-soft">
                                    {' '}
                                    · {formatSosAge(location.captured_at)}
                                </span>
                            )}
                        </span>
                    </LocationFact>
                    {location.context && (
                        <LocationFact label="Context">
                            <span className="font-medium text-ink">
                                {location.context}
                            </span>
                        </LocationFact>
                    )}
                </dl>

                {accuracy.tone === 'danger' && (
                    <p
                        className="mt-3 rounded-lg bg-warning-soft p-3 text-sm text-warning-strong"
                        role="status"
                    >
                        This fix is imprecise. Confirm the worker&apos;s exact
                        position by phone before sending responders.
                    </p>
                )}
            </div>
        </div>
    );
}

function LocationFact({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 py-1.5">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="min-w-0">{children}</dd>
        </div>
    );
}

function PlaceName({ place }: { place: SosPlaceName }) {
    if (place.status === 'none') {
        return null;
    }

    return (
        <div aria-live="polite">
            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                Nearest address
            </p>
            {place.status === 'loading' ? (
                <div className="mt-1.5 space-y-1.5" role="status">
                    <span className="sr-only">Looking up the address…</span>
                    <div className="h-5 w-56 max-w-full animate-pulse rounded bg-line" />
                    <div className="h-3.5 w-72 max-w-full animate-pulse rounded bg-line" />
                </div>
            ) : place.status === 'failed' ? (
                <p className="mt-1 text-sm text-ink-soft">
                    Address lookup unavailable. Use the coordinates below.
                </p>
            ) : (
                <>
                    <p className="mt-1 text-lg leading-6 font-semibold text-ink">
                        {place.primary}
                    </p>
                    {place.secondary && (
                        <p className="mt-0.5 text-sm leading-5 text-ink-soft">
                            {place.secondary}
                        </p>
                    )}
                    <p className="mt-1 text-xs text-ink-soft">
                        Closest mapped address (OpenStreetMap). The pin and
                        coordinates are the exact fix.
                    </p>
                </>
            )}
        </div>
    );
}

function CopyLocationButton({ value }: { value: string }) {
    const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
    const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (resetRef.current) {
                clearTimeout(resetRef.current);
            }
        },
        [],
    );

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setState('copied');
        } catch {
            setState('failed');
        }

        if (resetRef.current) {
            clearTimeout(resetRef.current);
        }

        resetRef.current = setTimeout(() => setState('idle'), 2000);
    };

    return (
        <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:min-h-9"
            aria-live="polite"
        >
            {state === 'copied' ? (
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
            ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {state === 'copied'
                ? 'Copied'
                : state === 'failed'
                  ? 'Copy failed'
                  : 'Copy location'}
        </button>
    );
}
