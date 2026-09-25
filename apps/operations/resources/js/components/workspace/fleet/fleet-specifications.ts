export interface FleetSpecificationItem {
    key: string;
    label: string;
    value: string;
}

export interface FleetSpecificationGroup {
    key: string;
    label: string;
    items: FleetSpecificationItem[];
}

export interface FleetReferenceSource {
    key: string;
    label: string;
    url: string;
    reviewedOn: string | null;
}

export interface FleetSpecificationPresentation {
    groups: FleetSpecificationGroup[];
    sources: FleetReferenceSource[];
    notes: string[];
}

const HIDDEN_REFERENCE_KEYS = new Set([
    'availability_note',
    'alibaton_reference_url',
    'alibaton_supported_brand',
    'capacity_note',
    'data_scope',
    'location_note',
    'location_type',
    'source_reviewed_on',
    'source_url',
]);

const LABEL_OVERRIDES: Record<string, string> = {
    axles: 'Axles',
    boom_length_meters: 'Boom length',
    bucket_capacity_range_m3: 'Bucket capacity range',
    capacity_type: 'Capacity basis',
    counterweight_tonnes: 'Counterweight',
    drive_configuration: 'Drive configuration',
    ground_clearance_meters: 'Ground clearance',
    height_meters: 'Overall height',
    huh_meters: 'H.U.H. height',
    jib_length_meters: 'Jib length',
    max_load_moment_kn_m: 'Maximum load moment',
    max_load_tonnes: 'Maximum load',
    max_radius_meters: 'Maximum radius',
    maximum_lift_height_meters: 'Maximum lift height',
    operating_weight_kg: 'Operating weight',
    power_kw: 'Power output',
    reach_meters: 'Reach',
    standard_bucket_capacity_m3: 'Standard bucket capacity',
    source_height_label: 'Height reference',
    travel_speed_kph: 'Travel speed',
};

const PROJECT_KEYS = new Set([
    'huh_meters',
    'jib_length_meters',
    'project_name',
    'source_height_label',
]);

function titleCase(value: string): string {
    return value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function labelForKey(key: string): string {
    return LABEL_OVERRIDES[key] ?? titleCase(key);
}

function unitForKey(key: string): string | null {
    if (key.endsWith('_m3')) {
        return 'm³';
    }

    if (key.endsWith('_kg')) {
        return 'kg';
    }

    if (key.endsWith('_kn_m')) {
        return 'kN·m';
    }

    if (key.endsWith('_meters') || key.endsWith('_metres')) {
        return 'm';
    }

    if (key.endsWith('_tonnes')) {
        return 't';
    }

    if (key.endsWith('_kw')) {
        return 'kW';
    }

    if (key.endsWith('_kph')) {
        return 'km/h';
    }

    return null;
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatFleetSpecificationValue(
    key: string,
    value: unknown,
): string {
    if (value === null || value === undefined || value === '') {
        return 'Not recorded';
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => formatFleetSpecificationValue(key, item))
            .join(', ');
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    if (typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>)
            .map(
                ([entryKey, entryValue]) =>
                    `${labelForKey(entryKey)}: ${formatFleetSpecificationValue(entryKey, entryValue)}`,
            )
            .join(' · ');
    }

    const formatted =
        typeof value === 'number' ? formatNumber(value) : String(value);
    const unit = unitForKey(key);

    return unit && !formatted.endsWith(unit)
        ? `${formatted} ${unit}`
        : formatted;
}

function groupForKey(key: string): string {
    if (PROJECT_KEYS.has(key)) {
        return 'project_reference';
    }

    if (
        /capacity|load|bucket|operating_weight|counterweight|axles|power|speed|drive_configuration/i.test(
            key,
        )
    ) {
        return 'capacity_performance';
    }

    if (/radius|length|height|width|boom|jib|reach|span|clearance/i.test(key)) {
        return 'dimensions_reach';
    }

    return 'machine_details';
}

const GROUPS: Array<{ key: string; label: string }> = [
    { key: 'capacity_performance', label: 'Capacity & performance' },
    { key: 'dimensions_reach', label: 'Dimensions & reach' },
    { key: 'machine_details', label: 'Machine details' },
    { key: 'project_reference', label: 'Project reference' },
];

function safeExternalUrl(value: unknown): string | null {
    if (typeof value !== 'string' || value.trim() === '') {
        return null;
    }

    try {
        const url = new URL(value);

        return url.protocol === 'https:' ? url.toString() : null;
    } catch {
        return null;
    }
}

function sourceLabel(url: string, key: string): string {
    if (key === 'alibaton_reference_url' || url.includes('alibaton.com.ph')) {
        return url.includes('/projects')
            ? 'Alibaton project reference'
            : 'Alibaton equipment catalogue';
    }

    return 'Manufacturer specification';
}

function formatReviewedOn(value: unknown): string | null {
    if (typeof value !== 'string' || value.trim() === '') {
        return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('en-PH', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
        year: 'numeric',
    }).format(parsed);
}

export function presentFleetSpecifications(
    specifications: Record<string, unknown> | null | undefined,
): FleetSpecificationPresentation {
    const entries = Object.entries(specifications ?? {});
    const grouped = new Map<string, FleetSpecificationItem[]>();
    const sources: FleetReferenceSource[] = [];
    const sourceKeys = new Set<string>();
    const notes: string[] = [];

    for (const [key, value] of entries) {
        if (key === 'source_url' || key === 'alibaton_reference_url') {
            const url = safeExternalUrl(value);

            if (url && !sourceKeys.has(url)) {
                sourceKeys.add(url);
                sources.push({
                    key,
                    label: sourceLabel(url, key),
                    url,
                    reviewedOn: formatReviewedOn(
                        specifications?.source_reviewed_on,
                    ),
                });
            }

            continue;
        }

        if (key === 'capacity_note' || key === 'availability_note') {
            if (typeof value === 'string' && value.trim() !== '') {
                notes.push(value);
            }

            continue;
        }

        if (HIDDEN_REFERENCE_KEYS.has(key)) {
            continue;
        }

        const groupKey = groupForKey(key);
        const items = grouped.get(groupKey) ?? [];
        items.push({
            key,
            label: labelForKey(key),
            value: formatFleetSpecificationValue(key, value),
        });
        grouped.set(groupKey, items);
    }

    return {
        groups: GROUPS.flatMap(({ key, label }) => {
            const items = grouped.get(key);

            return items && items.length > 0 ? [{ key, label, items }] : [];
        }),
        sources,
        notes: Array.from(new Set(notes)),
    };
}
