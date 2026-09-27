import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ALL_DEFECTS,
    COMMON_DEFECT_IDS,
    defectGroupsFor,
    defectSeverity,
    groupDisplayTitle,
} from '../components/inspection/defects/defect-sets.js';
import { resolveDesignatedEquipmentType } from '../utils/equipmentClassification.js';

const itemIds = (type: 'mobile_crane' | 'tower_crane' | 'carrier') =>
    defectGroupsFor(type).flatMap((group) => group.items.map((i) => i.id));

test('a tower crane never lists truck parts like tyres, brakes or lights', () => {
    const keys = defectGroupsFor('tower_crane').map((g) => g.key);

    for (const truckOnly of [
        'tires_wheels',
        'brakes_suspension',
        'exterior_front',
        'exterior_rear',
    ]) {
        assert.ok(!keys.includes(truckOnly), truckOnly);
    }
});

test('a tower crane covers its cab, electrics and slewing ring', () => {
    const keys = defectGroupsFor('tower_crane').map((g) => g.key);

    for (const needed of [
        'tower_crane_mast',
        'tower_crane_jib',
        'tower_crane_trolley',
        'tower_crane_slewing',
        'tower_crane_cab',
        'tower_crane_electrical',
        'crane_hoist_rigging',
        'crane_lmi_safety',
    ]) {
        assert.ok(keys.includes(needed), needed);
    }
});

test('a mobile crane lists crane parts and its carrier, but no tower-only items', () => {
    const ids = itemIds('mobile_crane');

    assert.ok(ids.includes('crane_telescopic_boom'));
    assert.ok(ids.includes('crane_outriggers_jacks'));
    assert.ok(ids.includes('tire_tread_depth'));
    assert.ok(!ids.includes('crane_trolley_limit_switches'));
    assert.ok(!ids.includes('crane_anti_collision_system'));
    assert.ok(!ids.some((id) => id.startsWith('tower_')));
});

test('a truck lists only road-vehicle groups', () => {
    const ids = itemIds('carrier');

    assert.ok(ids.includes('brake_service_brakes'));
    assert.ok(
        !ids.some((id) => id.startsWith('crane_') || id.startsWith('tower_')),
    );
});

test('existing defect ids are kept so saved inspections still match', () => {
    const all = new Set(ALL_DEFECTS.map((d) => d.id));

    for (const id of [
        'crane_telescopic_boom',
        'tower_trolley_winch',
        'tower_weather_vaning_brake',
        'crane_hoist_wire_rope',
        'front_fluid_levels',
        'tire_hub_oil_seals',
    ]) {
        assert.ok(all.has(id), id);
    }

    assert.equal(all.size, ALL_DEFECTS.length, 'ids are unique');
});

test('every common pick exists in that unit type’s list', () => {
    for (const type of ['mobile_crane', 'tower_crane', 'carrier'] as const) {
        const ids = itemIds(type);

        assert.ok(COMMON_DEFECT_IDS[type].length >= 4, type);

        for (const id of COMMON_DEFECT_IDS[type]) {
            assert.ok(ids.includes(id), `${type}: ${id}`);
        }
    }
});

test('critical defects lock the unit; the rest need attention', () => {
    const boom = ALL_DEFECTS.find((d) => d.id === 'crane_telescopic_boom')!;
    const floats = ALL_DEFECTS.find((d) => d.id === 'crane_outrigger_floats')!;

    assert.equal(defectSeverity(boom), 'critical');
    assert.equal(defectSeverity(floats), 'attention');
});

test('group titles drop the unit type once the type is fixed', () => {
    assert.equal(
        groupDisplayTitle({ title: 'Tower Crane: Jib & Weather-Vaning' }),
        'Jib & Weather-Vaning',
    );
    assert.equal(
        groupDisplayTitle({ title: 'Tires & Wheels' }),
        'Tires & Wheels',
    );
});

test('an unrecognised unit is unknown, never assumed to be a mobile crane', () => {
    assert.equal(resolveDesignatedEquipmentType(null), null);
    assert.equal(resolveDesignatedEquipmentType({}), null);
    assert.equal(
        resolveDesignatedEquipmentType({
            assetKind: 'equipment',
            assetName: 'Crawler Excavator',
            assetCode: 'EQP-3',
        }),
        null,
    );
    assert.equal(
        resolveDesignatedEquipmentType({ assetKind: 'crane' }),
        'mobile_crane',
    );
    assert.equal(
        resolveDesignatedEquipmentType({ assetKind: 'tower_crane' }),
        'tower_crane',
    );
});
