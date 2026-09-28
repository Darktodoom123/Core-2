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

const submit = (
    declaredUnsafe: boolean,
    defectIds: string[],
    completedAt?: string,
) => {
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

    if (completedAt) {
        record.completedAt = completedAt;
    }

    return buildDvirSubmitPayload({
        attested: true,
        currentAssetName: 'Potain MDT 219',
        dispatchJobId: 42,
        inspectorName: 'Operator',
        localAssetCode: 'TWR-12',
        operationalAssetId: 12,
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
    const payload = submit(false, [], '2026-09-28T01:30:00.000Z');

    assert.equal(payload.has_defects, false);
    assert.equal(payload.dispatch_job_id, 42);
    assert.equal(payload.operational_asset_id, 12);
    assert.equal(payload.completed_at, '2026-09-28T01:30:00.000Z');
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
