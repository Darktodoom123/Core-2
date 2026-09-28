import type { FleetAssetCategory } from '@/components/workspace/fleet/fleet-asset-classification';
import type {
    LocationUpdateViewModel,
    SosIncidentStatusValue,
    SosIncidentViewModel,
} from '@/types/workspace';
import { getFleetAssetCategorySvgMarkup } from '../workspace/fleet/fleet-asset-category-icon-paths.js';

export type SosMarkerStatus = SosIncidentStatusValue;

export interface SosMarkerOptions {
    status: SosMarkerStatus;
    label: string;
    prefersReducedMotion?: boolean;
}

export function getSosMarkerPosition(
    incident: SosIncidentViewModel,
    liveLocation?: LocationUpdateViewModel,
    assetLocation?: LocationUpdateViewModel,
): [number, number] | null {
    if (
        liveLocation?.latitude !== null &&
        liveLocation?.latitude !== undefined &&
        liveLocation?.longitude !== null &&
        liveLocation?.longitude !== undefined
    ) {
        return [liveLocation.longitude, liveLocation.latitude];
    }

    const snapshot = incident.location;

    if (
        snapshot?.latitude !== null &&
        snapshot?.latitude !== undefined &&
        snapshot.longitude !== null &&
        snapshot.longitude !== undefined
    ) {
        return [snapshot.longitude, snapshot.latitude];
    }

    if (
        assetLocation?.latitude !== null &&
        assetLocation?.latitude !== undefined &&
        assetLocation?.longitude !== null &&
        assetLocation?.longitude !== undefined
    ) {
        return [assetLocation.longitude, assetLocation.latitude];
    }

    return null;
}

const WAREHOUSE_SVG_ICON =
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-6 9 6"/><path d="M5 9v10h14V9"/><path d="M8 19v-6h8v6"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>';

export function createAssetMarker({
    category,
    freshness,
    isSelected,
    label,
}: {
    category: FleetAssetCategory;
    freshness: string;
    isSelected: boolean;
    label: string;
}): HTMLButtonElement {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'maplibre-asset-marker';
    marker.dataset.category = category;
    marker.dataset.freshness = freshness.toLowerCase();
    marker.dataset.selected = String(isSelected);
    marker.setAttribute('aria-label', label);
    marker.setAttribute('aria-pressed', String(isSelected));

    const surface = document.createElement('span');
    surface.className = 'maplibre-asset-marker__surface';
    surface.innerHTML = getFleetAssetCategorySvgMarkup(category);
    marker.appendChild(surface);

    return marker;
}

export function createWarehouseMarker({
    label,
    address,
}: {
    label: string;
    address: string;
}): HTMLButtonElement {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'maplibre-warehouse-marker';
    marker.dataset.markerType = 'warehouse';
    marker.setAttribute('aria-label', `${label}. ${address}`);
    marker.title = address;

    const surface = document.createElement('span');
    surface.className = 'maplibre-warehouse-marker__surface';
    surface.setAttribute('aria-hidden', 'true');
    surface.innerHTML = WAREHOUSE_SVG_ICON;
    marker.appendChild(surface);

    return marker;
}

export function createSosMarker({
    status,
    label,
    prefersReducedMotion,
}: SosMarkerOptions): HTMLButtonElement {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'maplibre-sos-marker';
    marker.dataset.sosStatus = status;
    marker.setAttribute('aria-label', label);

    appendSosMarkerTreatment(marker, {
        status,
        label,
        prefersReducedMotion,
    });

    const surface = document.createElement('span');
    surface.className = 'maplibre-sos-marker__surface';
    surface.setAttribute('aria-hidden', 'true');
    surface.innerHTML = SOS_ICON;
    marker.appendChild(surface);

    return marker;
}

export function createMarkerGroup({
    count,
    sos,
}: {
    count: number;
    sos?: SosMarkerOptions;
}): HTMLButtonElement {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'maplibre-marker-group';
    marker.setAttribute(
        'aria-label',
        `${count} units in this area${sos ? '. Includes SOS incidents' : ''}. Select a unit`,
    );
    marker.setAttribute('aria-haspopup', 'dialog');

    if (sos) {
        appendSosMarkerTreatment(marker, sos);
    }

    const countElement = document.createElement('span');
    countElement.className = 'maplibre-marker-group__count';
    countElement.textContent = String(count);
    marker.appendChild(countElement);

    return marker;
}

const SOS_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

const ACTIVE_SOS_STATUSES = new Set<SosMarkerStatus>([
    'active',
    'escalated',
    'acknowledged',
]);

function appendSosMarkerTreatment(
    marker: HTMLButtonElement,
    sos: SosMarkerOptions,
): void {
    marker.dataset.sosStatus = sos.status;
    marker.dataset.sosActive = String(ACTIVE_SOS_STATUSES.has(sos.status));
    marker.title = sos.label;

    const indicator = document.createElement('span');
    indicator.className = 'maplibre-sos-marker__indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.innerHTML = `${SOS_ICON}<span>SOS</span>`;

    if (ACTIVE_SOS_STATUSES.has(sos.status)) {
        const halo = document.createElement('span');
        halo.className = 'maplibre-sos-marker__halo';
        halo.dataset.sosStatus = sos.status;
        halo.setAttribute('aria-hidden', 'true');

        const reducedMotion =
            sos.prefersReducedMotion ?? detectReducedMotionPreference();

        if (reducedMotion) {
            // No scaling or travel: only a slow opacity fade, which stays
            // motion-safe while still signalling a live emergency.
            halo.style.animation =
                'maplibre-sos-halo-fade 1.8s ease-in-out infinite';
            halo.style.boxShadow =
                '0 0 0 6px rgba(220, 38, 38, 0.38), 0 0 20px rgba(220, 38, 38, 0.5)';
        } else {
            // Two staggered radar rings radiate from the pin so an active
            // emergency reads as live even at a glance.
            for (let index = 0; index < 2; index += 1) {
                const ping = document.createElement('span');
                ping.className = 'maplibre-sos-marker__ping';
                ping.dataset.sosStatus = sos.status;
                ping.dataset.pingIndex = String(index);
                ping.setAttribute('aria-hidden', 'true');
                marker.appendChild(ping);
            }
        }

        marker.appendChild(halo);
    }

    marker.appendChild(indicator);
}

function detectReducedMotionPreference(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

export interface PopupCardField {
    label: string;
    value: string;
    icon?: string;
}

export interface PopupCardOptions {
    title: string;
    subtitle?: string;
    status?: string;
    statusTone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    badge?: string;
    badgeTone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    fields?: PopupCardField[];
    details?: string[];
    locationName?: string;
    coordinateText?: string;
    onCopyCoordinates?: (button: HTMLButtonElement) => void;
    actionButton?: {
        label: string;
        onClick: () => void;
    };
}

export function createPopupCard({
    title,
    subtitle,
    status,
    statusTone = 'neutral',
    badge,
    badgeTone,
    fields = [],
    details = [],
    locationName,
    coordinateText,
    onCopyCoordinates,
    actionButton,
}: PopupCardOptions): HTMLDivElement {
    const root = document.createElement('div');
    root.className = 'maplibre-popup-card';

    // Header container with Title, Subtitle, and Top-Right Status Badge
    const header = document.createElement('div');
    header.className = 'maplibre-popup-card__header';

    const headerMain = document.createElement('div');
    headerMain.className = 'maplibre-popup-card__heading';

    const titleElement = document.createElement('strong');
    titleElement.className = 'maplibre-popup-card__title';
    titleElement.textContent = title;
    headerMain.appendChild(titleElement);

    if (subtitle) {
        const subtitleElement = document.createElement('span');
        subtitleElement.className = 'maplibre-popup-card__subtitle';
        subtitleElement.textContent = subtitle;
        headerMain.appendChild(subtitleElement);
    }

    header.appendChild(headerMain);

    if (status) {
        const statusElement = document.createElement('span');
        statusElement.className = `maplibre-popup-card__status maplibre-popup-card__status--${statusTone}`;

        const dot = document.createElement('span');
        dot.className = 'maplibre-popup-card__status-dot';
        statusElement.appendChild(dot);

        const statusText = document.createElement('span');
        statusText.textContent = status;
        statusElement.appendChild(statusText);

        header.appendChild(statusElement);
    }

    root.appendChild(header);

    // Optional alert / emergency banner (e.g. SOS active)
    if (badge) {
        const badgeElement = document.createElement('div');
        badgeElement.className = `maplibre-popup-card__alert-badge maplibre-popup-card__alert-badge--${badgeTone ?? 'warning'}`;
        badgeElement.textContent = badge;
        root.appendChild(badgeElement);
    }

    // Body: Key-Value Structured Fields
    if (fields.length > 0) {
        const fieldsList = document.createElement('div');
        fieldsList.className = 'maplibre-popup-card__fields';

        fields.forEach((field) => {
            if (!field.value) {
                return;
            }

            const row = document.createElement('div');
            row.className = 'maplibre-popup-card__field';

            const labelCol = document.createElement('span');
            labelCol.className = 'maplibre-popup-card__field-label';
            labelCol.textContent = field.label;

            const valCol = document.createElement('span');
            valCol.className = 'maplibre-popup-card__field-value';
            valCol.textContent = field.value;

            row.append(labelCol, valCol);
            fieldsList.appendChild(row);
        });

        root.appendChild(fieldsList);
    }

    // Body: Paragraph details (for backward compatibility)
    if (details.length > 0) {
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'maplibre-popup-card__details';
        details.forEach((detail) => {
            const detailElement = document.createElement('p');
            detailElement.className = 'maplibre-popup-card__detail';
            detailElement.textContent = detail;
            detailsContainer.appendChild(detailElement);
        });
        root.appendChild(detailsContainer);
    }

    // Location Name & Coordinates Footer
    if (locationName || (coordinateText && onCopyCoordinates)) {
        const locationSection = document.createElement('div');
        locationSection.className = 'maplibre-popup-card__location-section';

        if (locationName) {
            const nameRow = document.createElement('div');
            nameRow.className = 'maplibre-popup-card__location-name';

            const pinIcon = document.createElement('span');
            pinIcon.className = 'maplibre-popup-card__location-icon';
            pinIcon.textContent = '📍';

            const nameText = document.createElement('span');
            nameText.className = 'maplibre-popup-card__location-text';
            nameText.textContent = locationName;

            nameRow.append(pinIcon, nameText);
            locationSection.appendChild(nameRow);
        }

        if (coordinateText && onCopyCoordinates) {
            const coordinateRow = document.createElement('div');
            coordinateRow.className = 'maplibre-popup-card__coordinates';

            const coordinateElement = document.createElement('span');
            coordinateElement.className = 'maplibre-popup-card__coord-text';
            coordinateElement.textContent = coordinateText;

            const copyButton = document.createElement('button');
            copyButton.type = 'button';
            copyButton.className = 'maplibre-popup-card__copy';
            copyButton.textContent = 'Copy';
            copyButton.setAttribute('aria-label', 'Copy coordinates');
            copyButton.addEventListener('click', () =>
                onCopyCoordinates(copyButton),
            );
            coordinateRow.append(coordinateElement, copyButton);
            locationSection.appendChild(coordinateRow);
        }

        root.appendChild(locationSection);
    }

    // Optional Quick Action button (e.g. Focus Asset / View Details)
    if (actionButton) {
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'maplibre-popup-card__actions';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'maplibre-popup-card__action-btn';
        btn.textContent = actionButton.label;
        btn.addEventListener('click', actionButton.onClick);

        actionsContainer.appendChild(btn);
        root.appendChild(actionsContainer);
    }

    return root;
}
