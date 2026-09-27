import assert from 'node:assert/strict';
import test from 'node:test';
import {
    activeJobs,
    currentJobFor,
    finishedJobs,
    isFinishedJob,
} from '../components/cards/job-card/job-lifecycle.js';
import type { DispatchJob, DispatchStatus } from '../types/index.js';

const job = (id: number, status?: DispatchStatus): DispatchJob =>
    ({
        id,
        reference: `JOB-${id}`,
        status: status ? { value: status, label: status } : undefined,
    }) as unknown as DispatchJob;

test('only completed and cancelled jobs are finished', () => {
    assert.equal(isFinishedJob(job(1, 'completed')), true);
    assert.equal(isFinishedJob(job(2, 'cancelled')), true);

    for (const status of [
        'scheduled',
        'dispatched',
        'accepted',
        'en_route',
        'arrived',
        'working',
    ] as const) {
        assert.equal(isFinishedJob(job(3, status)), false, status);
    }
});

test('a job with no status is treated as live, never silently finished', () => {
    assert.equal(isFinishedJob(job(4)), false);
});

test('splits live and finished jobs without reordering them', () => {
    const jobs = [
        job(1, 'completed'),
        job(2, 'accepted'),
        job(3, 'cancelled'),
        job(4, 'en_route'),
    ];

    assert.deepEqual(
        activeJobs(jobs).map((j) => j.id),
        [2, 4],
    );
    assert.deepEqual(
        finishedJobs(jobs).map((j) => j.id),
        [1, 3],
    );
});

test('the current job is the selected live job, else the first live job', () => {
    const jobs = [job(1, 'completed'), job(2, 'accepted'), job(3, 'working')];

    assert.equal(currentJobFor(jobs, 3)?.id, 3);
    assert.equal(currentJobFor(jobs, null)?.id, 2);
    assert.equal(
        currentJobFor(jobs, 1)?.id,
        2,
        'a finished selection is skipped',
    );
});

test('there is no current job when every job is finished', () => {
    assert.equal(
        currentJobFor([job(1, 'completed'), job(2, 'cancelled')], 1),
        null,
    );
    assert.equal(currentJobFor([], null), null);
});
