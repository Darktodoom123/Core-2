export type FleetAssetCategory =
    | 'tower_cranes'
    | 'mobile_cranes'
    | 'heavy_equipment'
    | 'transport'
    | 'other';

export const FLEET_ASSET_CATEGORY_LABELS: Record<FleetAssetCategory, string> = {
    tower_cranes: 'Tower cranes',
    mobile_cranes: 'Mobile cranes',
    heavy_equipment: 'Heavy equipment',
    transport: 'Transport',
    other: 'Other assets',
};

export interface ClassifiableFleetAsset {
    kind: string;
    subtype?: string | null;
    category?: string | null;
    category_label?: string | null;
}

export function isFleetAssetCategory(
    value: unknown,
): value is FleetAssetCategory {
    return (
        value === 'tower_cranes' ||
        value === 'mobile_cranes' ||
        value === 'heavy_equipment' ||
        value === 'transport' ||
        value === 'other'
    );
}

export function classifyFleetAsset(
    asset: ClassifiableFleetAsset,
): FleetAssetCategory {
    if (isFleetAssetCategory(asset.category)) {
        return asset.category;
    }

    const kind = (asset.kind ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
    const subtype = (asset.subtype ?? '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ');

    if (
        kind === 'tower crane' ||
        kind.includes('tower crane') ||
        subtype.includes('tower crane')
    ) {
        return 'tower_cranes';
    }

    const heavyEquipmentTerms = [
        'equipment',
        'excavator',
        'loader',
        'forklift',
        'manlift',
        'backhoe',
        'dozer',
        'grader',
        'skid steer',
    ];

    if (
        heavyEquipmentTerms.some(
            (term) => kind.includes(term) || subtype.includes(term),
        )
    ) {
        return 'heavy_equipment';
    }

    if (kind.includes('crane') || subtype.includes('crane')) {
        return 'mobile_cranes';
    }

    if (
        kind.includes('truck') ||
        kind.includes('vehicle') ||
        kind.includes('trailer') ||
        subtype.includes('truck') ||
        subtype.includes('trailer')
    ) {
        return 'transport';
    }

    return 'other';
}

export function filterFleetLocationsByCategory<
    T extends {
        asset: ClassifiableFleetAsset | null;
    },
>(locations: T[], category: FleetAssetCategory | null): T[] {
    if (category === null) {
        return locations.filter((location) => location.asset !== null);
    }

    return locations.filter(
        (location) =>
            location.asset !== null &&
            classifyFleetAsset(location.asset) === category,
    );
}

export function getFleetAssetCategoryLabel(
    asset: ClassifiableFleetAsset,
): string {
    const category = classifyFleetAsset(asset);

    if (category === 'other' && asset.category_label?.trim()) {
        return asset.category_label;
    }

    return FLEET_ASSET_CATEGORY_LABELS[category];
}
