import { describe, expect, it } from 'vitest';
import {
    classifyFleetAsset,
    getFleetAssetCategoryLabel,
} from '@/components/workspace/fleet/fleet-asset-classification';
import {
    formatFleetSpecificationValue,
    presentFleetSpecifications,
} from '@/components/workspace/fleet/fleet-specifications';

describe('fleet asset presentation helpers', () => {
    it('classifies the seeded equipment types without collapsing all cranes together', () => {
        expect(
            classifyFleetAsset({
                kind: 'tower_crane',
                subtype: 'Luffing Tower Crane',
                category: null,
            }),
        ).toBe('tower_cranes');
        expect(
            classifyFleetAsset({
                kind: 'crane',
                subtype: 'Truck Crane',
                category: null,
            }),
        ).toBe('mobile_cranes');
        expect(
            classifyFleetAsset({
                kind: 'equipment',
                subtype: 'Wheel Loader',
                category: null,
            }),
        ).toBe('heavy_equipment');
        expect(
            getFleetAssetCategoryLabel({
                kind: 'equipment',
                subtype: 'Crawler Excavator',
                category: null,
            }),
        ).toBe('Heavy equipment');
    });

    it('groups operator specifications and moves raw metadata into clickable sources', () => {
        const presentation = presentFleetSpecifications({
            capacity_note: 'Verify the applicable load chart.',
            data_scope: 'manufacturer_specification_reference',
            source_url: 'https://manufacturer.example/xct25',
            source_reviewed_on: '2026-09-24',
            alibaton_reference_url: 'https://alibaton.com.ph/products/',
            availability_note: 'Reference row only.',
            max_radius_meters: 65,
            bucket_capacity_range_m3: '2.7-5.6',
            project_name: 'Bulacan logistics hub',
        });

        expect(presentation.groups.map((group) => group.label)).toEqual([
            'Capacity & performance',
            'Dimensions & reach',
            'Project reference',
        ]);
        expect(presentation.groups.flatMap((group) => group.items)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    label: 'Maximum radius',
                    value: '65 m',
                }),
                expect.objectContaining({
                    label: 'Bucket capacity range',
                    value: '2.7-5.6 m³',
                }),
            ]),
        );
        expect(
            presentation.groups
                .flatMap((group) => group.items)
                .some((item) => item.key === 'source_url'),
        ).toBe(false);
        expect(presentation.sources.map((source) => source.label)).toEqual([
            'Manufacturer specification',
            'Alibaton equipment catalogue',
        ]);
        expect(presentation.sources[0]?.url).toBe(
            'https://manufacturer.example/xct25',
        );
        expect(presentation.notes).toEqual([
            'Verify the applicable load chart.',
            'Reference row only.',
        ]);
    });

    it('rejects non-HTTPS reference links and formats common engineering units', () => {
        const presentation = presentFleetSpecifications({
            source_url: 'http://unsafe.example/spec',
            max_load_moment_kn_m: 1127,
            operating_weight_kg: 17900,
        });

        expect(presentation.sources).toHaveLength(0);
        expect(
            formatFleetSpecificationValue('max_load_moment_kn_m', 1127),
        ).toBe('1,127 kN·m');
        expect(
            formatFleetSpecificationValue('operating_weight_kg', 17900),
        ).toBe('17,900 kg');
    });
});
