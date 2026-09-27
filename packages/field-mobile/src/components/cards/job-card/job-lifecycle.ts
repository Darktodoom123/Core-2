import type { DispatchJob, DispatchStatus } from '../../../types/index';

/**
 * Terminal states. Only the server moves a job here; a queued local
 * "Complete" keeps the job live until the server confirms it.
 */
export const FINISHED_JOB_STATUSES: readonly DispatchStatus[] = [
    'completed',
    'cancelled',
];

/** A job with no status is treated as live, never silently finished. */
export const isFinishedJob = (job: DispatchJob): boolean =>
    FINISHED_JOB_STATUSES.includes(job.status?.value as DispatchStatus);

export const activeJobs = (jobs: DispatchJob[]): DispatchJob[] =>
    jobs.filter((job) => !isFinishedJob(job));

export const finishedJobs = (jobs: DispatchJob[]): DispatchJob[] =>
    jobs.filter(isFinishedJob);

/**
 * The job the phone works against right now: the selected job while it is
 * live, otherwise the first live job, otherwise none. Never a finished job.
 */
export function currentJobFor(
    jobs: DispatchJob[],
    selectedJobId: number | null | undefined,
): DispatchJob | null {
    const live = activeJobs(jobs);

    return live.find((job) => job.id === selectedJobId) ?? live[0] ?? null;
}
