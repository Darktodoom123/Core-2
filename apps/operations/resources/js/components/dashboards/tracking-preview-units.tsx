import {
    CheckCircle2,
    CircleAlert,
    Clock3,
    Construction,
    MapPin,
    Siren,
    Truck,
    UserRoundCog,
    WifiOff,
    Wrench,
    X,
} from 'lucide-react';
import { useId } from 'react';
import { formatLocationSource } from '@/components/maplibre/tracking-map-popups';
import { Button } from '@/components/ui';
import { getAssetKind, getAssetKindLabel } from '@/lib/asset-kind';
import { cn } from '@/lib/utils';
import { usePreciseLocation } from '@/services/reverse-geocoder';
import type { LocationUpdateViewModel } from '@/types/workspace';
import {
    assignedJobsite,
    formatReportAge,
    formatReportTimestamp,
    hasCoordinates,
} from './use-tracking-preview';

export const FRESHNESS_META = {
    fresh: {
        label: 'Fresh',
        Icon: CheckCircle2,
        textClassName: 'text-success-strong',
    },
    delayed: {
        label: 'Delayed',
        Icon: Clock3,
        textClassName: 'text-warning-strong',
    },
    stale: { label: 'Stale', Icon: CircleAlert, textClassName: 'text-danger' },
    offline: {
        label: 'Offline',
        Icon: WifiOff,
        textClassName: 'text-ink-soft',
    },
};

export function TrackingUnitRow({
    location,
    selected,
    hasSos,
    onSelect,
}: {
    location: LocationUpdateViewModel;
    selected: boolean;
    hasSos: boolean;
    onSelect: () => void;
}) {
    const site = assignedJobsite(location);
    const descriptionId = useId();
    const availabilityLabel = location.asset?.status_label ?? 'Available';
    const isAssigned =
        location.is_assigned ?? Boolean(location.job || location.user?.name);
    const assignmentText = isAssigned
        ? location.job?.reference
            ? `Assigned · Job ${location.job.reference}`
            : 'Assigned'
        : 'Unassigned';

    return (
        <li>
            <button
                type="button"
                aria-label={`Inspect ${location.asset?.code ?? location.asset?.name ?? 'Asset'}`}
                aria-describedby={descriptionId}
                aria-pressed={selected}
                onClick={onSelect}
                className={cn(
                    'flex min-h-24 w-full gap-3 px-4 py-3 text-left transition-colors duration-150 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
                    selected ? 'bg-brand-soft' : 'hover:bg-surface-subtle',
                )}
            >
                <span
                    className={cn(
                        'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
                        hasSos
                            ? 'bg-danger-soft text-danger'
                            : 'bg-surface-subtle text-ink-soft',
                    )}
                >
                    <AssetIcon location={location} />
                </span>
                <span id={descriptionId} className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <span className="min-w-0 truncate text-sm font-semibold text-ink">
                            {location.asset?.code ??
                                location.asset?.name ??
                                'Unknown Asset'}
                        </span>
                        {hasSos && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
                                <Siren
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                                SOS active
                            </span>
                        )}
                    </span>
                    <span
                        className="mt-0.5 block truncate text-xs text-ink-soft"
                        title={`${location.asset?.name ?? getAssetKindLabel(getAssetKind(location))} · ${availabilityLabel} · ${assignmentText}`}
                    >
                        {location.asset?.name ??
                            getAssetKindLabel(getAssetKind(location))}{' '}
                        · {availabilityLabel} · {assignmentText}
                    </span>
                    {location.user?.name && (
                        <span
                            className="mt-0.5 block truncate text-xs text-ink-soft"
                            title={`Operator: ${location.user.name}${location.reported_via_phone ? " (via operator's phone)" : ''}`}
                        >
                            Operator: {location.user.name}
                            {location.reported_via_phone && (
                                <span className="text-ink-muted ml-1 text-[11px]">
                                    (via operator’s phone)
                                </span>
                            )}
                        </span>
                    )}
                    {site && (
                        <span
                            className="mt-1 block truncate text-xs text-ink-soft"
                            title={`Assigned jobsite: ${site}`}
                        >
                            Assigned: {site}
                        </span>
                    )}
                    <span className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <FreshnessStatus
                            status={location.freshness_status}
                            location={location}
                        />
                        <span
                            className="text-xs text-ink-soft"
                            title={formatReportTimestamp(
                                location.received_at ?? location.captured_at,
                            )}
                        >
                            {location.has_gps_report === false
                                ? 'No report'
                                : `Updated ${formatReportAge(
                                      location.received_at ??
                                          location.captured_at,
                                  ).toLowerCase()}`}
                        </span>
                    </span>
                    {!hasCoordinates(location) && (
                        <span className="mt-1 block text-xs text-ink-soft">
                            {location.recorded_location
                                ? `Recorded location: ${location.recorded_location}`
                                : 'Location unavailable'}
                        </span>
                    )}
                </span>
            </button>
        </li>
    );
}

export function TrackingUnitDetails({
    location,
    hasSos,
    onClose,
}: {
    location: LocationUpdateViewModel;
    hasSos: boolean;
    onClose: () => void;
}) {
    const site = assignedJobsite(location);
    const locationName = usePreciseLocation(location);
    const availabilityLabel = location.asset?.status_label ?? 'Available';
    const isAssigned =
        location.is_assigned ?? Boolean(location.job || location.user?.name);
    const assignmentText = isAssigned
        ? location.job?.reference
            ? `Assigned · Job ${location.job.reference}`
            : 'Assigned'
        : 'Unassigned';

    return (
        <section
            aria-label="Selected unit details"
            className="relative border-t border-line px-4 py-4 sm:px-5"
        >
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-ink">
                        {location.asset?.code ??
                            location.asset?.name ??
                            'Unknown Asset'}
                        <FreshnessStatus
                            status={location.freshness_status}
                            location={location}
                        />
                        {hasSos && (
                            <span className="inline-flex items-center gap-1 text-xs text-danger">
                                <Siren
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                                SOS active
                            </span>
                        )}
                    </h3>
                    <p className="mt-1 text-xs text-ink-soft">
                        {location.asset?.name ??
                            getAssetKindLabel(getAssetKind(location))}{' '}
                        · {availabilityLabel} · {assignmentText}
                        {location.user?.name
                            ? ` · Operator: ${location.user.name}`
                            : ''}
                    </p>
                </div>
                <Button
                    variant="quiet"
                    size="icon"
                    aria-label="Close unit details"
                    className="-mt-2 -mr-2 shrink-0"
                    onClick={onClose}
                >
                    <X className="size-4" aria-hidden="true" />
                </Button>
            </div>
            <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
                <div>
                    <dt className="text-ink-soft">Assigned operator</dt>
                    <dd className="mt-1 font-medium break-words text-ink">
                        {location.user?.name || 'Unassigned'}
                    </dd>
                </div>
                <div>
                    <dt className="text-ink-soft">Equipment type</dt>
                    <dd className="mt-1 font-medium break-words text-ink">
                        {getAssetKindLabel(getAssetKind(location))}
                    </dd>
                </div>
                <div>
                    <dt className="text-ink-soft">Operational status</dt>
                    <dd className="mt-1 font-medium break-words text-ink">
                        {availabilityLabel}
                    </dd>
                </div>
                <div>
                    <dt className="text-ink-soft">Assignment status</dt>
                    <dd className="mt-1 font-medium break-words text-ink">
                        {assignmentText}
                    </dd>
                </div>
                <div>
                    <dt className="text-ink-soft">Location source</dt>
                    <dd className="mt-1 font-medium break-words text-ink">
                        {formatLocationSource(
                            location.source,
                            location.reported_via_phone,
                        )}
                    </dd>
                </div>
                <div>
                    <dt className="text-ink-soft">Assigned jobsite</dt>
                    <dd className="mt-1 font-medium break-words text-ink">
                        {site || 'No assigned jobsite'}
                        {location.job && (
                            <span className="mt-1 block font-normal text-ink-soft">
                                {location.job.reference}
                            </span>
                        )}
                    </dd>
                </div>
                <div>
                    <dt className="text-ink-soft">Last reported location</dt>
                    <dd className="mt-1 font-medium text-ink">
                        {hasCoordinates(location) ? (
                            <span
                                className="flex items-center gap-1.5"
                                title={
                                    location.latitude !== null &&
                                    location.longitude !== null
                                        ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                                        : undefined
                                }
                            >
                                <MapPin
                                    className="size-3.5 shrink-0 text-brand-strong"
                                    aria-hidden="true"
                                />
                                <span className="break-words">
                                    {locationName}
                                </span>
                            </span>
                        ) : location.recorded_location ? (
                            <span>
                                Recorded location: {location.recorded_location}
                            </span>
                        ) : (
                            'Coordinates unavailable'
                        )}
                        {location.accuracy_metres !== null &&
                            hasCoordinates(location) && (
                                <span className="mt-1 block font-normal text-ink-soft">
                                    Accuracy ±
                                    {Math.round(location.accuracy_metres)} m
                                </span>
                            )}
                    </dd>
                </div>
                <ReportTime label="Captured" value={location.captured_at} />
                <ReportTime label="Received" value={location.received_at} />
            </dl>
            {location.freshness_status !== 'fresh' && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-soft">
                    <CircleAlert
                        className={cn(
                            'mt-px size-3.5 shrink-0',
                            location.has_gps_report === false
                                ? 'text-ink-soft'
                                : 'text-warning-strong',
                        )}
                        aria-hidden="true"
                    />
                    {location.has_gps_report === false
                        ? 'No GPS reports have been received for this asset.'
                        : "No recent location updates. This is the last reported location. The asset's current position is unconfirmed."}
                </p>
            )}
        </section>
    );
}

function ReportTime({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <dt className="text-ink-soft">{label}</dt>
            <dd className="mt-1 font-medium text-ink">
                <time dateTime={value ?? undefined}>
                    {formatReportTimestamp(value)}
                </time>
                <span className="mt-1 block font-normal text-ink-soft">
                    {formatReportAge(value)}
                </span>
            </dd>
        </div>
    );
}

export function FreshnessStatus({
    status,
    location,
}: {
    status: LocationUpdateViewModel['freshness_status'];
    location?: LocationUpdateViewModel;
}) {
    const isNoReport =
        location?.has_gps_report === false ||
        location?.freshness_label === 'No GPS report';
    const isInterrupted =
        location?.freshness_label === 'Location not current' ||
        (!isNoReport && (status === 'delayed' || status === 'stale'));

    if (isNoReport) {
        return (
            <span className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-xs font-medium text-ink-soft">
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                No GPS report
            </span>
        );
    }

    if (isInterrupted) {
        return (
            <span className="inline-flex items-center gap-1 rounded border border-dashed border-warning-strong/40 bg-warning-soft/30 px-1.5 py-0.5 text-xs font-medium text-warning-strong">
                <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
                Location not current
            </span>
        );
    }

    const { Icon, label, textClassName } =
        FRESHNESS_META[status] ?? FRESHNESS_META.offline;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 text-xs font-medium',
                textClassName,
            )}
        >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            {label}
        </span>
    );
}

function AssetIcon({ location }: { location: LocationUpdateViewModel }) {
    const kind = getAssetKind(location);
    const Icon =
        kind === 'truck'
            ? Truck
            : kind === 'equipment'
              ? Wrench
              : kind === 'personnel'
                ? UserRoundCog
                : Construction;

    return <Icon className="size-4" aria-hidden="true" />;
}
