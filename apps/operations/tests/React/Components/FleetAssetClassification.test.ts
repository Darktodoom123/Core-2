import { describe, expect, it } from 'vitest';
import {
    classifyFleetAsset,
    filterFleetLocationsByCategory,
} from '@/components/workspace/fleet/fleet-asset-classification';

describe('fleet asset categories', () => {
    it.each([
        [{ kind: 'tower_crane', subtype: null }, 'tower_cranes'],
        [{ kind: 'crane', subtype: 'Tower_Crane' }, 'tower_cranes'],
        [{ kind: 'mobile_crane', subtype: null }, 'mobile_cranes'],
        [
            { kind: 'crane', subtype: 'All-terrain Mobile Crane' },
            'mobile_cranes',
        ],
        [{ kind: 'equipment', subtype: 'Wheel loader' }, 'heavy_equipment'],
        [{ kind: 'forklift', subtype: null }, 'heavy_equipment'],
        [{ kind: 'truck', subtype: null }, 'transport'],
        [{ kind: 'vehicle', subtype: 'Flatbed trailer' }, 'transport'],
        [{ kind: 'unclassified', subtype: 'special purpose asset' }, 'other'],
    ] as const)('resolves legacy kind/subtype %o to %s', (asset, category) => {
        expect(classifyFleetAsset({ ...asset, category: null })).toBe(category);
    });

    it('uses the canonical category when present and keeps asset rows in sync with a category filter', () => {
        const locations = [
            {
                id: 1,
                asset: {
                    id: 1,
                    code: 'TC-01',
                    name: 'Tower crane',
                    kind: 'crane',
                    subtype: 'Tower crane',
                    category: 'tower_cranes',
                },
            },
            {
                id: 2,
                asset: {
                    id: 2,
                    code: 'TR-01',
                    name: 'Truck',
                    kind: 'truck',
                    subtype: null,
                    category: 'transport',
                },
            },
            { id: 3, asset: null },
        ];

        expect(
            classifyFleetAsset({
                kind: 'truck',
                subtype: null,
                category: 'tower_cranes',
            }),
        ).toBe('tower_cranes');
        expect(
            filterFleetLocationsByCategory(locations, 'tower_cranes').map(
                ({ id }) => id,
            ),
        ).toEqual([1]);
        expect(
            filterFleetLocationsByCategory(locations, null).map(({ id }) => id),
        ).toEqual([1, 2]);
    });
});
