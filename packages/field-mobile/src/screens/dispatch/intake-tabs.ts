import { activeJobs } from '../../components/cards/job-card/job-lifecycle';
import type { DispatchJob, DispatchStatus } from '../../types/index';

export type DispatchTab = 'pending' | 'scheduled' | 'active' | 'history';

/** Booked but not started: the crew has not set off yet. */
const NOT_STARTED_STATUSES: readonly DispatchStatus[] = [
    'draft',
    'pending_approval',
    'scheduled',
    'dispatched',
    'accepted',
];

export interface IntakeJobs {
    /** The operator has not answered the assignment yet. */
    pending: DispatchJob[];
    /** Accepted, not started yet; soonest start first. */
    scheduled: DispatchJob[];
    /** Under way: en route, on site or working. */
    active: DispatchJob[];
}

const startTime = (job: DispatchJob): number => {
    const time = job.scheduled_start ? Date.parse(job.scheduled_start) : NaN;

    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

/**
 * Splits live jobs into the intake tabs; each job is in exactly one. Finished
 * jobs are left out (History loads them). A job with an unknown status is
 * shown as active, so live work is never tucked away.
 */
export function splitIntakeJobs(jobs: DispatchJob[]): IntakeJobs {
    const live = activeJobs(jobs);
    const answered = live.filter(
        (job) => job.my_assignment?.response_status !== 'pending',
    );
    const notStarted = (job: DispatchJob) =>
        NOT_STARTED_STATUSES.includes(job.status?.value as DispatchStatus);

    return {
        pending: live.filter(
            (job) => job.my_assignment?.response_status === 'pending',
        ),
        scheduled: answered
            .filter(notStarted)
            .sort((a, b) => startTime(a) - startTime(b)),
        active: answered.filter((job) => !notStarted(job)),
    };
}

/** Opens on what needs the operator first: a reply, then live work. */
export function defaultIntakeTab({
    pending,
    scheduled,
    active,
}: IntakeJobs): DispatchTab {
    if (pending.length > 0) {
        return 'pending';
    }

    return active.length === 0 && scheduled.length > 0 ? 'scheduled' : 'active';
}
