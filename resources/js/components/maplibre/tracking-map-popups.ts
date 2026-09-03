import { getAssetKind, getAssetKindLabel } from '@/lib/asset-kind';
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

export function trackingUnitLabel(location: LocationUpdateViewModel): string {
    return location.asset?.code ?? location.user.name;
}

export function createTrackingLocationPopup(
    location: LocationUpdateViewModel,
    incident?: SosIncidentViewModel,
    onCopyCoordinates?: (button: HTMLButtonElement) => void,
): HTMLDivElement {
    const freshness = location.freshness_status;

    return createPopupCard({
        title: trackingUnitLabel(location),
        subtitle:
            location.asset?.name ?? getAssetKindLabel(getAssetKind(location)),
        status: freshness.charAt(0).toUpperCase() + freshness.slice(1),
        statusTone:
            freshness === 'fresh'
                ? 'success'
                : freshness === 'offline'
                  ? 'neutral'
                  : 'warning',
        badge: incident
            ? `SOS: ${incident.status.label} · ${incident.category.label}`
            : undefined,
        badgeTone: 'danger',
        details:
            freshness !== 'fresh'
                ? ['Last reported position; current position is unknown.']
                : [],
        fields: [
            {
                label: 'Last received',
                value: formatReportAge(location.received_at),
            },
            { label: 'Captured', value: timestamp(location.captured_at) },
            { label: 'Received', value: timestamp(location.received_at) },
            { label: 'Personnel', value: location.user.name },
            {
                label: 'Dispatch',
                value: location.job?.reference ?? 'Unassigned',
            },
            {
                label: 'Assigned site',
                value: location.job?.site ?? 'Unassigned',
            },
            {
                label: 'Reported speed',
                value:
                    location.speed === null
                        ? 'Unavailable'
                        : `${location.speed.toFixed(1)} km/h`,
            },
            { label: 'Note', value: location.remarks ?? '' },
        ],
        coordinateText:
            location.latitude !== null && location.longitude !== null
                ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                : undefined,
        onCopyCoordinates,
    });
}

export function createTrackingSosPopup(
    incident: SosIncidentViewModel,
): HTMLDivElement {
    return createPopupCard({
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
    });
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
