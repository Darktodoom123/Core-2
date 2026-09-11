export interface ProjectedMarker<T> {
    value: T;
    x: number;
    y: number;
    /** Higher-priority markers become anchors before grouping nearby points. */
    priority?: number;
}

/** Group around a real marker anchor, without inventing geographic positions. */
export function groupOverlappingMarkers<T>(
    markers: ProjectedMarker<T>[],
    radius = 44,
): T[][] {
    const groups: { x: number; y: number; values: T[] }[] = [];
    const buckets = new Map<string, number[]>();

    const orderedMarkers = [...markers].sort(
        (left, right) => (right.priority ?? 0) - (left.priority ?? 0),
    );

    for (const marker of orderedMarkers) {
        const column = Math.floor(marker.x / radius);
        const row = Math.floor(marker.y / radius);
        let match: number | undefined;

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (const index of buckets.get(`${column + dx}:${row + dy}`) ??
                    []) {
                    const group = groups[index];

                    if (
                        Math.hypot(marker.x - group.x, marker.y - group.y) <
                            radius &&
                        (match === undefined || index < match)
                    ) {
                        match = index;
                    }
                }
            }
        }

        if (match !== undefined) {
            groups[match].values.push(marker.value);
            continue;
        }

        const key = `${column}:${row}`;
        buckets.set(key, [...(buckets.get(key) ?? []), groups.length]);
        groups.push({ x: marker.x, y: marker.y, values: [marker.value] });
    }

    return groups.map((group) => group.values);
}
