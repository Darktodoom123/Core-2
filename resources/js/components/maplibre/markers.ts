import type { AssetKind } from '@/lib/asset-kind';

const ASSET_SVG_ICONS: Record<AssetKind, string> = {
    truck: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
    crane: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14v7"/><path d="M14 14v7"/></svg>',
    mobile_crane:
        '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14v7"/><path d="M14 14v7"/></svg>',
    equipment:
        '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="16" width="13" height="4" rx="2"/><path d="M4 16V10a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"/><path d="M6 10h4v3H6z"/><path d="M10 11l4-5 5 4"/><path d="M19 10l2 3h-3.5"/></svg>',
    personnel:
        '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
};

export function createAssetMarker({
    kind,
    freshness,
    isSelected,
    label,
}: {
    kind: AssetKind;
    freshness: string;
    isSelected: boolean;
    label: string;
}): HTMLButtonElement {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'maplibre-asset-marker';
    marker.dataset.kind = kind;
    marker.dataset.freshness = freshness.toLowerCase();
    marker.dataset.selected = String(isSelected);
    marker.setAttribute('aria-label', label);
    marker.setAttribute('aria-pressed', String(isSelected));

    const surface = document.createElement('span');
    surface.className = 'maplibre-asset-marker__surface';
    surface.innerHTML = ASSET_SVG_ICONS[kind];
    marker.appendChild(surface);

    return marker;
}

export function createPopupCard({
    title,
    subtitle,
    status,
    coordinateText,
    details,
    onCopyCoordinates,
}: {
    title: string;
    subtitle: string;
    status: string;
    coordinateText?: string;
    details: string[];
    onCopyCoordinates?: (button: HTMLButtonElement) => void;
}): HTMLDivElement {
    const root = document.createElement('div');
    root.className = 'maplibre-popup-card';

    const heading = document.createElement('div');
    heading.className = 'maplibre-popup-card__heading';
    const titleElement = document.createElement('strong');
    titleElement.textContent = title;
    const subtitleElement = document.createElement('span');
    subtitleElement.textContent = subtitle;
    heading.append(titleElement, subtitleElement);
    root.appendChild(heading);

    const statusElement = document.createElement('span');
    statusElement.className = 'maplibre-popup-card__status';
    statusElement.textContent = status;
    root.appendChild(statusElement);

    details.forEach((detail) => {
        const detailElement = document.createElement('p');
        detailElement.textContent = detail;
        root.appendChild(detailElement);
    });

    if (coordinateText && onCopyCoordinates) {
        const coordinateRow = document.createElement('div');
        coordinateRow.className = 'maplibre-popup-card__coordinates';
        const coordinateElement = document.createElement('span');
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
        root.appendChild(coordinateRow);
    }

    return root;
}
