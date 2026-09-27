import assert from 'node:assert/strict';
import test from 'node:test';
import { standbyReasonsFor } from '../screens/hos/hos-standby-reasons.js';

const codes = (type: Parameters<typeof standbyReasonsFor>[0]) =>
    standbyReasonsFor(type).map((item) => item.reason);

test('before linking to a machine, only general reasons are offered', () => {
    assert.deepEqual(codes(null), [
        'waiting_on_client',
        'site_access_blocked',
        'weather_hold',
        'other',
    ]);
});

test('a truck is never offered rigging, outriggers or a concrete pour', () => {
    const truck = codes('carrier');

    assert.ok(!truck.includes('rigging_recheck'));
    assert.ok(!truck.includes('waiting_on_concrete'));
    assert.ok(truck.includes('inspection_hold'));
});

test('a mobile crane gets its rigging and outrigger re-check', () => {
    const crane = standbyReasonsFor('mobile_crane');

    assert.ok(
        crane.some(
            (item) =>
                item.reason === 'rigging_recheck' &&
                /outrigger/i.test(item.label),
        ),
    );
});

test('a tower crane is not asked about outriggers or road access', () => {
    const tower = standbyReasonsFor('tower_crane');

    assert.ok(!tower.some((item) => /outrigger/i.test(item.label)));
    assert.ok(!codes('tower_crane').includes('site_access_blocked'));
});

test('billable reasons match the server demurrage rule', () => {
    for (const type of [
        null,
        'mobile_crane',
        'tower_crane',
        'carrier',
    ] as const) {
        for (const item of standbyReasonsFor(type)) {
            assert.equal(
                item.billable,
                [
                    'waiting_on_client',
                    'waiting_on_concrete',
                    'site_access_blocked',
                ].includes(item.reason),
                `${type}: ${item.reason}`,
            );
        }
    }
});

test('every list ends with Other so any delay can be recorded', () => {
    for (const type of [
        null,
        'mobile_crane',
        'tower_crane',
        'carrier',
    ] as const) {
        const list = codes(type);
        assert.equal(list[list.length - 1], 'other', String(type));
    }
});
