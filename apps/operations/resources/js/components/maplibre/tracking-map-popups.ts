import {
    getAssetKind,
    getAssetKindLabel,
    resolveLocationName,
} from '@/lib/asset-kind';
import {
    getCoordinatesCacheKey,
    onLocationResolved,
} from '@/services/reverse-geocoder';
import type {
    LocationUpdateViewModel,
    SosIncidentViewModel,
} from '@/types/workspace';
import { createPopupCard } from './markers';

export function formatReportAge(
    value: string | null,
    now = Date.now(),
): string {
    if (!value || !Number.isFinite(Date.parse(value))) {
        return 'Time unavailable';
    }

    const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60_000));

    if (minutes < 1) {
        return 'Less than a minute ago';
    }

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    if (minutes < 1440) {
        return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
    }

    return `${Math.floor(minutes / 1440)}d ago`;
}

function timestamp(value: string | null): string {
    return value && Number.isFinite(Date.parse(value))
        ? new Date(value).toLocaleString()
        : 'Unavailable';
}

export function formatLocationSource(
    source: string | null | undefined,
    reportedViaPhone?: boolean,
): string {
    if (!source) {
        return 'Unavailable';
    }

    if (reportedViaPhone || source === 'mobile' || source === 'field-mobile') {
        return "via operator's phone";
    }

    if (source === 'browser') {
        return 'Browser GPS';
    }

    return source;
}

export function trackingUnitLabel(location: LocationUpdateViewModel): string {
    return location.asset?.code ?? location.asset?.name ?? 'Unknown Asset';
}

export function createTrackingLocationPopup(
    location: LocationUpdateViewModel,
    incident?: SosIncidentViewModel,
    onCopyCoordinates?: (button: HTMLButtonElement) => void,
): HTMLDivElement {
    const freshnessText =
        location.freshness_label ??
        (location.freshness_status === 'fresh'
            ? 'Fresh'
            : location.has_gps_report === false
              ? 'No GPS report'
              : 'Location not current');
    const kind = getAssetKind(location);

    const card = createPopupCard({
        title: trackingUnitLabel(location),
        subtitle: location.asset?.name ?? getAssetKindLabel(kind),
        status: freshnessText,
        statusTone:
            location.freshness_status === 'fresh'
                ? 'success'
                : location.has_gps_report === false
                  ? 'neutral'
                  : 'warning',
        badge: incident
            ? `SOS: ${incident.status.label} · ${incident.category.label}`
            : undefined,
        badgeTone: 'danger',
        details:
            location.freshness_status !== 'fresh'
                ? [
                      location.has_gps_report === false
                          ? 'No GPS report received for this asset.'
                          : 'No recent location updates. Last reported position; current position is unknown.',
                  ]
                : [],
        fields: [
            {
                label: 'Last received',
                value: formatReportAge(location.received_at),
            },
            { label: 'Captured', value: timestamp(location.captured_at) },
            { label: 'Received', value: timestamp(location.received_at) },
            { label: 'Equipment type', value: getAssetKindLabel(kind) },
            {
                label: 'Operational status',
                value: location.asset?.status_label ?? 'Available',
            },
            {
                label: 'Assignment',
                value: location.is_assigned
                    ? location.job?.reference
                        ? `Assigned (${location.job.reference})`
                        : 'Assigned'
                    : 'Unassigned',
            },
            {
                label: 'Assigned operator',
                value: location.user?.name ? location.user.name : 'Unassigned',
            },
            {
                label: 'Dispatch',
                value: location.job?.reference ?? 'Unassigned',
            },
            {
                label: 'Assigned site',
                value: location.job?.site ?? 'Unassigned',
            },
            {
                label: 'Location source',
                value: formatLocationSource(
                    location.source,
                    location.reported_via_phone,
                ),
            },
            ...(location.recorded_location
                ? [
                      {
                          label: 'Recorded location',
                          value: location.recorded_location,
                      },
                  ]
                : []),
            {
                label: 'Reported speed',
                value:
                    location.speed === null
                        ? 'Unavailable'
                        : `${location.speed.toFixed(1)} km/h`,
            },
            { label: 'Note', value: location.remarks ?? '' },
        ],
        locationName: resolveLocationName(location),
        coordinateText:
            location.latitude !== null && location.longitude !== null
                ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                : undefined,
        onCopyCoordinates,
    });

    if (location.latitude !== null && location.longitude !== null) {
        const lat = location.latitude;
        const lon = location.longitude;
        const key = getCoordinatesCacheKey(lat, lon);
        const unsubscribe = onLocationResolved((resolvedKey, name) => {
            if (resolvedKey === key) {
                const textEl = card.querySelector(
                    '.maplibre-popup-card__location-text',
                );

                if (textEl) {
                    textEl.textContent = name;
                }

                unsubscribe();
            }
        });
    }

    return card;
}

export function createTrackingSosPopup(
    incident: SosIncidentViewModel,
    onCopyCoordinates?: (button: HTMLButtonElement) => void,
): HTMLDivElement {
    const lat = incident.location?.latitude ?? null;
    const lon = incident.location?.longitude ?? null;
    const hasCoords = lat !== null && lon !== null;

    const locationName = hasCoords
        ? resolveLocationName({
              latitude: lat,
              longitude: lon,
              job: incident.dispatch ? { site: incident.dispatch.site } : null,
              asset: null,
          })
        : (incident.dispatch?.site ?? undefined);

    const card = createPopupCard({
        title: incident.worker.name,
        subtitle: 'Emergency SOS alert',
        status: incident.status.label,
        statusTone: 'danger',
        badge: 'SOS · Urgent attention required',
        badgeTone: 'danger',
        fields: [
            { label: 'Category', value: incident.category.label },
            {
                label: 'Dispatch',
                value:
                    incident.dispatch?.reference ??
                    'No dispatch context attached',
            },
            {
                label: 'Assigned site',
                value: incident.dispatch?.site ?? 'Unassigned',
            },
            {
                label: 'Triggered',
                value: timestamp(incident.device_activated_at),
            },
            { label: 'Received', value: timestamp(incident.received_at) },
        ],
        locationName,
        coordinateText: hasCoords
            ? `${lat.toFixed(5)}, ${lon.toFixed(5)}`
            : undefined,
        onCopyCoordinates,
    });

    if (hasCoords) {
        const key = getCoordinatesCacheKey(lat, lon);
        const unsubscribe = onLocationResolved((resolvedKey, name) => {
            if (resolvedKey === key) {
                const textEl = card.querySelector(
                    '.maplibre-popup-card__location-text',
                );

                if (textEl) {
                    textEl.textContent = name;
                }

                unsubscribe();
            }
        });
    }

    return card;
}

export interface TrackingGroupEntry {
    label: string;
    description: string;
    hasSos: boolean;
    onSelect: () => void;
}

export function createTrackingGroupPopup(
    entries: TrackingGroupEntry[],
): HTMLDivElement {
    const root = document.createElement('div');
    root.className = 'maplibre-tracking-group';
    const title = document.createElement('strong');
    title.className = 'maplibre-tracking-group__title';
    title.textContent = `${entries.length} units in this area`;
    const list = document.createElement('div');
    list.className = 'maplibre-tracking-group__list';
    list.setAttribute('aria-label', 'Select a unit in this area');

    for (const entry of entries) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'maplibre-tracking-group__unit';
        button.dataset.sos = String(entry.hasSos);
        const name = document.createElement('strong');
        name.textContent = `${entry.hasSos ? 'SOS · ' : ''}${entry.label}`;
        const description = document.createElement('span');
        description.textContent = entry.description;
        button.append(name, description);
        button.addEventListener('click', entry.onSelect);
        list.appendChild(button);
    }

    root.append(title, list);

    return root;
}
