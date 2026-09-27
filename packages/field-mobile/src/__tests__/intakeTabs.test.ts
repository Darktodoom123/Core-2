import assert from 'node:assert/strict';
import test from 'node:test';
import {
    defaultIntakeTab,
    splitIntakeJobs,
} from '../screens/dispatch/intake-tabs.js';
import type {
    AssignmentResponse,
    DispatchJob,
    DispatchStatus,
} from '../types/index';

const job = (
    id: number,
    status: DispatchStatus | null,
    response: AssignmentResponse = 'accepted',
    scheduledStart = '2026-09-28T08:00:00Z',
): DispatchJob =>
    ({
        id,
        reference: `JOB-${id}`,
        title: `Lift ${id}`,
        scheduled_start: scheduledStart,
        status: status ? { value: status, label: status } : undefined,
        my_assignment: {
            id: id * 10,
            response_status: response,
            response_status_label: response,
        },
    }) as DispatchJob;

const ids = (jobs: DispatchJob[]) => jobs.map((item) => item.id);

test('each live job lands in exactly one tab', () => {
    const tabs = splitIntakeJobs([
        job(1, 'dispatched', 'pending'),
        job(2, 'scheduled'),
        job(3, 'accepted'),
        job(4, 'en_route'),
        job(5, 'arrived'),
        job(6, 'working'),
        job(7, 'completed'),
        job(8, 'cancelled'),
    ]);

    assert.deepEqual(ids(tabs.pending), [1]);
    assert.deepEqual(ids(tabs.scheduled), [2, 3]);
    assert.deepEqual(ids(tabs.active), [4, 5, 6]);
});

test('scheduled jobs are listed soonest first, undated ones last', () => {
    const tabs = splitIntakeJobs([
        job(1, 'scheduled', 'accepted', '2026-10-02T08:00:00Z'),
        job(2, 'dispatched', 'accepted', ''),
        job(3, 'accepted', 'accepted', '2026-09-29T08:00:00Z'),
    ]);

    assert.deepEqual(ids(tabs.scheduled), [3, 1, 2]);
});

test('a job with an unknown status stays visible under Active', () => {
    assert.deepEqual(ids(splitIntakeJobs([job(1, null)]).active), [1]);
});

test('opens on replies first, then live work, then the schedule', () => {
    const open = (jobs: DispatchJob[]) =>
        defaultIntakeTab(splitIntakeJobs(jobs));

    assert.equal(
        open([job(1, 'dispatched', 'pending'), job(2, 'working')]),
        'pending',
    );
    assert.equal(open([job(1, 'scheduled'), job(2, 'working')]), 'active');
    assert.equal(open([job(1, 'scheduled')]), 'scheduled');
    assert.equal(open([]), 'active');
});
