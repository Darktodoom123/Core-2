/** @typedef {import('./fleet-asset-classification').FleetAssetCategory} FleetAssetCategory */

/** @type {Record<FleetAssetCategory, readonly string[]>} */
export const FLEET_ASSET_CATEGORY_ICON_PATHS = {
    tower_cranes: [
        'M11 22V4h3v18M8 22h9M2 4h20M5 4l4 3m10-3-3 3M18 4v5m0 0h2m-2 0v2',
        'm11 8 3 2m-3 3 3 2m-3 3 3 2',
    ],
    mobile_cranes: [
        'M2 15h11l4 2h5v3H2zM5 20a2 2 0 1 0 4 0m8 0a2 2 0 1 0 4 0M10 15l3-8 7-4M13 7l3 2M19 3l1-1m-1 1 2 1',
        'M4 15v-3h5l2 3',
    ],
    heavy_equipment: [
        'M3 18h9l3 2h5v-3l-4-3-2-6H8l-2 5H3zM8 13h5m-6 5v-4m9 0-2-5m4 6 3-3 2 2-3 4m-15 3a1.5 1.5 0 1 0 3 0m8 0a1.5 1.5 0 1 0 3 0',
    ],
    transport: [
        'M2 6h12v11H2zM14 10h4l4 4v3h-8zM5 20a2 2 0 1 0 4 0m8 0a2 2 0 1 0 4 0M16 10v4h5',
    ],
    other: [
        'M3 8h18v12H3zM2 8l10-5 10 5M9 20v-6h6v6M7 11h.01M12 11h.01M17 11h.01',
    ],
};

/** @param {FleetAssetCategory} category */
export function getFleetAssetCategorySvgMarkup(category) {
    const paths = FLEET_ASSET_CATEGORY_ICON_PATHS[category]
        .map((path) => `<path d="${path}"/>`)
        .join('');

    return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
