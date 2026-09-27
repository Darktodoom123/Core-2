import assert from 'node:assert/strict';
import test from 'node:test';
import { findDefects } from '../components/inspection/defects/defect-sets.js';
import {
    buildDvirChecks,
    buildDvirRecord,
    buildDvirSubmitPayload,
} from '../screens/dvir/dvir-record-builder.js';

const baseChecks = {
    designatedEquipment: 'tower_crane' as const,
    mode: 'pre_trip' as const,
    postTripChecks: [],
};

const submit = (declaredUnsafe: boolean, defectIds: string[]) => {
    const selectedDefects = findDefects(defectIds);
    const checksList = buildDvirChecks({
        ...baseChecks,
        declaredUnsafe,
        selectedDefects,
    });
    const record = buildDvirRecord({
        attested: true,
        checksList,
        currentAssetName: 'Potain MDT 219',
        engineHours: '1520',
        inspectorName: 'Operator',
        isUnsafe: declaredUnsafe,
        localAssetCode: 'TWR-12',
        mode: 'pre_trip',
        odometerKm: '',
        photosPayload: [],
        remarks: 'Grinding from the slew drive',
        selectedDefects,
    });

    return buildDvirSubmitPayload({
        attested: true,
        currentAssetName: 'Potain MDT 219',
        inspectorName: 'Operator',
        localAssetCode: 'TWR-12',
        photosPayload: [],
        record,
    });
};

test('marking the unit unsafe with no defect sends a critical check the server locks on', () => {
    const payload = submit(true, []);
    const unsafe = payload.checks.find(
        (c) => c.id === 'operator-declared-unsafe',
    );

    assert.equal(payload.has_defects, true);
    assert.ok(unsafe, 'an unsafe declaration check is sent');
    assert.equal(unsafe.status, 'critical');
    assert.equal(unsafe.category, 'safety_devices');
});

test('an unsafe declaration with picked defects sends only the defects', () => {
    const payload = submit(true, ['tower_catwalk_lifeline']);

    assert.ok(!payload.checks.some((c) => c.id === 'operator-declared-unsafe'));
    assert.ok(payload.checks.some((c) => c.id === 'tower_catwalk_lifeline'));
});

test('a clean pass sends no defect checks and no defects flag', () => {
    const payload = submit(false, []);

    assert.equal(payload.has_defects, false);
    assert.ok(
        payload.checks.every(
            (c) => c.status !== 'critical' && c.status !== 'attention',
        ),
    );
});

test('tower crane defects are filed under the right check category', () => {
    const categoryOf = (group: string) => {
        const picked = buildDvirChecks({
            ...baseChecks,
            declaredUnsafe: false,
            selectedDefects: [
                {
                    id: `x-${group}`,
                    label: 'x',
                    critical: false,
                    categoryKey: group,
                    categoryTitle: group,
                },
            ],
        });

        return picked.find((c) => c.id === `x-${group}`)?.category;
    };

    assert.equal(categoryOf('tower_crane_electrical'), 'electrical');
    assert.equal(categoryOf('tower_crane_trolley'), 'electrical');
    assert.equal(categoryOf('tower_crane_cab'), 'safety_devices');
    assert.equal(categoryOf('tower_crane_slewing'), 'structural');
});
