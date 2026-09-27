import assert from 'node:assert/strict';
import test from 'node:test';
import {
    failedPostTripChecks,
    postTripChecksFor,
    postTripInspectionChecks,
    unansweredPostTripChecks,
} from '../screens/dvir/post-trip-checks.js';

const ids = (type: Parameters<typeof postTripChecksFor>[0]) =>
    postTripChecksFor(type).map((check) => check.id);

test('a tower crane is never asked about brakes, chocks or outriggers', () => {
    const tower = ids('tower_crane');

    for (const truckOnly of [
        'post-trip-parking-brake',
        'post-trip-wheel-chocks',
        'post-trip-outriggers',
    ]) {
        assert.ok(!tower.includes(truckOnly), truckOnly);
    }

    assert.ok(tower.includes('post-trip-slew-free'));
});

test('a truck is not asked about outriggers or the hook', () => {
    const truck = ids('carrier');

    assert.ok(truck.includes('post-trip-parking-brake'));
    assert.ok(!truck.includes('post-trip-outriggers'));
    assert.ok(!truck.includes('post-trip-hook-secured'));
});

test('an unknown unit gets only checks that fit any machine', () => {
    assert.deepEqual(ids(null), [
        'post-trip-parked-level',
        'post-trip-power-isolated',
    ]);
});

test('every check starts unanswered, and nothing is sent for it', () => {
    const checks = postTripChecksFor('mobile_crane');

    assert.equal(unansweredPostTripChecks(checks, {}).length, checks.length);
    assert.deepEqual(postTripInspectionChecks(checks, {}), []);
});

test('a "no" is a reported defect with its own severity', () => {
    const checks = postTripChecksFor('mobile_crane');
    const answers = {
        'post-trip-parking-brake': 'yes',
        'post-trip-wheel-chocks': 'no',
        'post-trip-outriggers': 'no',
    } as const;

    const sent = postTripInspectionChecks(checks, answers);

    assert.deepEqual(
        sent.map((check) => [check.id, check.status]),
        [
            ['post-trip-parking-brake', 'good'],
            ['post-trip-wheel-chocks', 'attention'],
            ['post-trip-outriggers', 'critical'],
        ],
    );
    assert.deepEqual(
        failedPostTripChecks(checks, answers).map((check) => check.id),
        ['post-trip-wheel-chocks', 'post-trip-outriggers'],
    );
    assert.equal(unansweredPostTripChecks(checks, answers).length, 2);
});
