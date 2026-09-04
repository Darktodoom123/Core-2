import type { DerivedConflict } from '@/components/workspace/live-dispatch-workspace';
import {
    dateFromLocalKey,
    parseScheduleDate,
    shiftLocalDate,
    shiftLocalMonth,
    startOfMonthLocalDate,
    startOfWeekLocalDate,
} from '@/lib/date-utils';
import { humanize } from '@/lib/formatters';
import type {
    ApprovalViewModel,
    AssetViewModel,
    DispatchJobViewModel,
    DispatchPriorityValue,
    DispatchSourceViewModel,
    GptRecommendationViewModel,
    RentalDispatchHandoffViewModel,
    SalesDispatchHandoffViewModel,
    ServiceRequestViewModel,
} from '@/types/workspace';

export type DispatchDeskJobGroup = 'preparation' | 'execution' | 'history';

export interface IncomingWorkItem {
    key: string;
    mode: 'service' | 'rental' | 'sale';
    sourceLabel: string;
    reference: string;
    client: string;
    detail: string;
    status: string;
    sourceId: number;
    linkedJobId: number | null;
}

export interface NextDispatchAction {
    label: string;
    detail: string;
    group: DispatchDeskJobGroup;
}

export const PREPARATION_STATUSES = [
    'draft',
    'pending_approval',
    'scheduled',
] as const;

export const EXECUTION_STATUSES = [
    'dispatched',
    'accepted',
    'en_route',
    'arrived',
    'working',
] as const;

export const HISTORY_STATUSES = ['completed', 'cancelled'] as const;

export function jobGroup(job: DispatchJobViewModel): DispatchDeskJobGroup {
    if (
        PREPARATION_STATUSES.includes(
            job.status.value as (typeof PREPARATION_STATUSES)[number],
        )
    ) {
        return 'preparation';
    }

    if (
        EXECUTION_STATUSES.includes(
            job.status.value as (typeof EXECUTION_STATUSES)[number],
        )
    ) {
        return 'execution';
    }

    return 'history';
}

export function sourceMatches(
    source: DispatchSourceViewModel | null,
    filter: string,
): boolean {
    if (filter === 'all') {
        return true;
    }

    if (filter === 'manual') {
        return (
            source === null ||
            source.type === 'direct' ||
            source.type === 'manual' ||
            source.manual_intake === true
        );
    }

    return source?.type === filter;
}

export function jobOverlapsDate(
    job: Pick<DispatchJobViewModel, 'scheduled_start' | 'scheduled_end'>,
    dateKey: string,
): boolean {
    return jobOverlapsPeriod(job, dateKey, 'day');
}

export type DispatchDeskPeriod = 'day' | 'week' | 'month';

function scheduleInterval(
    job: Pick<DispatchJobViewModel, 'scheduled_start' | 'scheduled_end'>,
) {
    if (!job.scheduled_start || !job.scheduled_end) {
        return null;
    }

    const start = parseScheduleDate(job.scheduled_start);
    const end = parseScheduleDate(job.scheduled_end);

    if (start === null || end === null) {
        return null;
    }

    if (
        end <= start &&
        /^\d{4}-\d{2}-\d{2}$/.test(job.scheduled_start) &&
        /^\d{4}-\d{2}-\d{2}$/.test(job.scheduled_end) &&
        job.scheduled_start === job.scheduled_end
    ) {
        end.setDate(end.getDate() + 1);
    }

    return end > start ? { start, end } : null;
}

export function jobOverlapsPeriod(
    job: Pick<DispatchJobViewModel, 'scheduled_start' | 'scheduled_end'>,
    dateKey: string,
    period: DispatchDeskPeriod,
): boolean {
    const interval = scheduleInterval(job);
    const date = dateFromLocalKey(dateKey);

    if (!interval || Number.isNaN(date.getTime())) {
        return false;
    }

    let periodStartKey = dateKey;
    let periodEndKey = shiftLocalDate(dateKey, 1);

    if (period === 'week') {
        periodStartKey = startOfWeekLocalDate(dateKey);
        periodEndKey = shiftLocalDate(periodStartKey, 7);
    } else if (period === 'month') {
        const monthStart = startOfMonthLocalDate(dateKey);
        periodStartKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`;
        periodEndKey = shiftLocalMonth(periodStartKey, 1);
    }

    const periodStart = dateFromLocalKey(periodStartKey);
    const periodEnd = dateFromLocalKey(periodEndKey);

    if (
        Number.isNaN(periodStart.getTime()) ||
        Number.isNaN(periodEnd.getTime())
    ) {
        return false;
    }

    return interval.start < periodEnd && interval.end > periodStart;
}

export function resourceLabel(job: DispatchJobViewModel): string {
    const resources = [
        ...job.personnel_assignments.map((assignment) => assignment.name),
        ...job.asset_assignments.map((assignment) => assignment.code),
    ];

    if (resources.length === 0) {
        return 'No assigned resources shown';
    }

    if (resources.length <= 2) {
        return resources.join(' · ');
    }

    return `${resources.slice(0, 2).join(' · ')} +${resources.length - 2} shown`;
}

export function nextActionForJob(
    job: DispatchJobViewModel,
    conflicts: readonly DerivedConflict[],
): NextDispatchAction {
    const jobConflicts = conflicts.filter(
        (conflict) => conflict.jobId === job.id,
    );
    const hasPendingApproval = jobConflicts.some(
        (conflict) => conflict.type === 'approval',
    );

    if (job.status.value === 'pending_approval' || hasPendingApproval) {
        return {
            label: 'Review approval',
            detail: 'An approval decision is required before activation.',
            group: 'preparation',
        };
    }

    if (job.status.value === 'draft') {
        return {
            label: 'Review schedule and resources',
            detail:
                jobConflicts.length > 0
                    ? `${jobConflicts.length} issue${jobConflicts.length === 1 ? '' : 's'} need review before activation.`
                    : 'Confirm the schedule and select eligible resources.',
            group: 'preparation',
        };
    }

    if (job.status.value === 'scheduled') {
        return {
            label: 'Review readiness before activation',
            detail:
                jobConflicts.length > 0
                    ? `${jobConflicts.length} recorded blocker${jobConflicts.length === 1 ? '' : 's'} need review.`
                    : 'Open the authoritative readiness review to confirm activation.',
            group: 'preparation',
        };
    }

    const execution: Record<string, string> = {
        dispatched: 'Confirm field acceptance',
        accepted: 'Monitor en route progress',
        en_route: 'Monitor arrival',
        arrived: 'Confirm work start',
        working: 'Monitor field execution',
    };

    if (job.status.value in execution) {
        return {
            label: execution[job.status.value],
            detail: 'Field execution follows the assigned dispatch lifecycle.',
            group: 'execution',
        };
    }

    return {
        label:
            job.status.value === 'cancelled'
                ? 'Review cancellation record'
                : 'Review completion record',
        detail: 'Open the dispatch history and audit context.',
        group: 'history',
    };
}

export function incomingWorkItems({
    serviceRequests,
    rentalHandoffs,
    salesHandoffs,
}: {
    serviceRequests: ServiceRequestViewModel[];
    rentalHandoffs: RentalDispatchHandoffViewModel[];
    salesHandoffs: SalesDispatchHandoffViewModel[];
}): IncomingWorkItem[] {
    return [
        ...serviceRequests
            .filter((request) => request.dispatch_jobs_count === 0)
            .map((request): IncomingWorkItem => ({
                key: `service-${request.id}`,
                mode: 'service',
                sourceLabel: 'Service request',
                reference: request.reference,
                client: request.client.company_name,
                detail:
                    request.project_name ||
                    request.service_type ||
                    request.location ||
                    'Service demand awaiting dispatch',
                status: request.status.label,
                sourceId: request.id,
                linkedJobId: null,
            })),
        ...rentalHandoffs
            .filter((handoff) => !handoff.dispatch_job_id)
            .map((handoff): IncomingWorkItem => ({
                key: `rental-${handoff.id}`,
                mode: 'rental',
                sourceLabel: 'Rental delivery',
                reference: handoff.reference,
                client: handoff.client.company_name,
                detail: handoff.location || 'Delivery location needs review',
                status: handoff.status.label,
                sourceId: handoff.id,
                linkedJobId: handoff.dispatch_job_id,
            })),
        ...salesHandoffs
            .filter((handoff) => !handoff.dispatch_job_id)
            .map((handoff): IncomingWorkItem => ({
                key: `sale-${handoff.id}`,
                mode: 'sale',
                sourceLabel: 'Sales delivery',
                reference: handoff.reference,
                client: handoff.client.company_name,
                detail: handoff.location || 'Delivery location needs review',
                status: handoff.status.label,
                sourceId: handoff.id,
                linkedJobId: handoff.dispatch_job_id,
            })),
    ];
}

function isOverlapping(
    first: DispatchJobViewModel,
    second: DispatchJobViewModel,
): boolean {
    const firstInterval = scheduleInterval(first);
    const secondInterval = scheduleInterval(second);

    if (!firstInterval || !secondInterval) {
        return false;
    }

    return (
        firstInterval.start < secondInterval.end &&
        secondInterval.start < firstInterval.end
    );
}

function severityRank(value: DerivedConflict['severity']): number {
    return value === 'danger' ? 0 : value === 'warning' ? 1 : 2;
}

function unassignedSeverity(
    job: DispatchJobViewModel,
): DerivedConflict['severity'] {
    if (
        job.priority.value === 'emergency' ||
        job.status.value === 'pending_approval'
    ) {
        return 'danger';
    }

    if (job.priority.value === 'priority') {
        return 'warning';
    }

    return 'info';
}

export function deriveDispatchDeskConflicts({
    jobs,
    assets,
    approvals,
    gptRecommendations,
}: {
    jobs: DispatchJobViewModel[];
    assets: AssetViewModel[];
    approvals: ApprovalViewModel[];
    gptRecommendations: GptRecommendationViewModel[];
}): DerivedConflict[] {
    const conflicts: DerivedConflict[] = [];
    const liveJobs = jobs.filter(
        (job) =>
            !HISTORY_STATUSES.includes(
                job.status.value as (typeof HISTORY_STATUSES)[number],
            ),
    );
    const byJob = new Map(liveJobs.map((job) => [job.id, job]));

    const personnel = new Map<
        number,
        Array<{ job: DispatchJobViewModel; name: string }>
    >();
    liveJobs.forEach((job) =>
        job.personnel_assignments.forEach((assignment) => {
            const list = personnel.get(assignment.user_id) ?? [];
            list.push({ job, name: assignment.name });
            personnel.set(assignment.user_id, list);
        }),
    );

    personnel.forEach((assignments, userId) => {
        for (let index = 0; index < assignments.length; index += 1) {
            for (let next = index + 1; next < assignments.length; next += 1) {
                const first = assignments[index];
                const second = assignments[next];

                if (!isOverlapping(first.job, second.job)) {
                    continue;
                }

                conflicts.push({
                    id: `desk-overlap-user-${userId}-${first.job.id}-${second.job.id}`,
                    type: 'overlap',
                    severity: 'danger',
                    title: 'Personnel schedule overlap',
                    description: `${first.name} is assigned to overlapping schedules: ${first.job.reference} and ${second.job.reference}.`,
                    actionRequired:
                        'Adjust the schedule or reassign personnel in the dispatch detail.',
                    jobId: first.job.id,
                    jobReference: first.job.reference,
                });
                conflicts.push({
                    id: `desk-overlap-user-${userId}-${second.job.id}-${first.job.id}`,
                    type: 'overlap',
                    severity: 'danger',
                    title: 'Personnel schedule overlap',
                    description: `${second.name} is assigned to overlapping schedules: ${first.job.reference} and ${second.job.reference}.`,
                    actionRequired:
                        'Adjust the schedule or reassign personnel in the dispatch detail.',
                    jobId: second.job.id,
                    jobReference: second.job.reference,
                });
            }
        }
    });

    const assetAssignments = new Map<
        number,
        Array<{ job: DispatchJobViewModel; code: string }>
    >();
    liveJobs.forEach((job) =>
        job.asset_assignments.forEach((assignment) => {
            const list =
                assetAssignments.get(assignment.operational_asset_id) ?? [];
            list.push({ job, code: assignment.code });
            assetAssignments.set(assignment.operational_asset_id, list);
        }),
    );

    assetAssignments.forEach((assignments, assetId) => {
        for (let index = 0; index < assignments.length; index += 1) {
            for (let next = index + 1; next < assignments.length; next += 1) {
                const first = assignments[index];
                const second = assignments[next];

                if (!isOverlapping(first.job, second.job)) {
                    continue;
                }

                conflicts.push({
                    id: `desk-overlap-asset-${assetId}-${first.job.id}-${second.job.id}`,
                    type: 'overlap',
                    severity: 'danger',
                    title: 'Asset schedule overlap',
                    description: `${first.code} is assigned to overlapping schedules: ${first.job.reference} and ${second.job.reference}.`,
                    actionRequired:
                        'Adjust the schedule or replace the asset in the dispatch detail.',
                    jobId: first.job.id,
                    jobReference: first.job.reference,
                });
                conflicts.push({
                    id: `desk-overlap-asset-${assetId}-${second.job.id}-${first.job.id}`,
                    type: 'overlap',
                    severity: 'danger',
                    title: 'Asset schedule overlap',
                    description: `${second.code} is assigned to overlapping schedules: ${first.job.reference} and ${second.job.reference}.`,
                    actionRequired:
                        'Adjust the schedule or replace the asset in the dispatch detail.',
                    jobId: second.job.id,
                    jobReference: second.job.reference,
                });
            }
        }
    });

    liveJobs.forEach((job) => {
        job.asset_assignments.forEach((assignment) => {
            const asset = assets.find(
                (candidate) =>
                    candidate.id === assignment.operational_asset_id ||
                    candidate.code === assignment.code,
            );

            if (
                !asset ||
                (asset.is_dispatchable &&
                    asset.blocking_work_orders_count === 0 &&
                    !['under_maintenance', 'under_inspection'].includes(
                        asset.status.value,
                    ))
            ) {
                return;
            }

            conflicts.push({
                id: `desk-maintenance-${job.id}-${assignment.code}`,
                type: 'maintenance',
                severity: 'danger',
                title: 'Asset has a dispatch blocker',
                description: `${assignment.code} is recorded as unavailable for dispatch on ${job.reference}.`,
                actionRequired:
                    'Review asset evidence or choose another eligible asset.',
                jobId: job.id,
                jobReference: job.reference,
            });
        });
    });

    approvals.forEach((approval) => {
        if (approval.status.value !== 'pending') {
            return;
        }

        conflicts.push({
            id: `desk-approval-${approval.id}`,
            type: 'approval',
            severity: 'warning',
            title: `Pending approval: ${humanize(approval.kind)}`,
            description: `Approval is pending for ${approval.subject.reference}.`,
            actionRequired: approval.can_decide
                ? 'Review the requested changes in the dispatch detail.'
                : approval.decision_blocker ||
                  'Your role cannot decide this approval.',
            approvalId: approval.id,
            canDecide: approval.can_decide,
            decisionBlocker: approval.decision_blocker,
            jobId:
                approval.subject.status !== null &&
                byJob.has(approval.subject.id)
                    ? approval.subject.id
                    : undefined,
            jobReference: approval.subject.reference,
        });
    });

    liveJobs.forEach((job) => {
        job.personnel_assignments.forEach((assignment) => {
            if (assignment.response_status.value !== 'rejected') {
                return;
            }

            conflicts.push({
                id: `desk-rejected-${job.id}-${assignment.id}`,
                type: 'response',
                severity: 'danger',
                title: 'Assignment response rejected',
                description: `${assignment.name} rejected the assignment on ${job.reference}.`,
                actionRequired: 'Reassign the role in the dispatch detail.',
                jobId: job.id,
                jobReference: job.reference,
            });
        });

        if (
            (job.status.value === 'draft' ||
                job.status.value === 'pending_approval') &&
            job.personnel_assignments.length === 0 &&
            job.asset_assignments.length === 0
        ) {
            conflicts.push({
                id: `desk-unassigned-${job.id}`,
                type: 'unassigned',
                severity: unassignedSeverity(job),
                title: 'Resource assignment needed',
                description: `${job.reference} has no personnel or assets assigned yet.`,
                actionRequired: 'Assign qualified resources before activation.',
                jobId: job.id,
                jobReference: job.reference,
            });
        }
    });

    gptRecommendations.forEach((recommendation) => {
        if (
            recommendation.subject_type !== 'dispatch_job' ||
            recommendation.purpose !== 'dispatch_assignment' ||
            recommendation.status !== 'pending_review' ||
            recommendation.is_expired ||
            recommendation.conflicts.length === 0
        ) {
            return;
        }

        conflicts.push({
            id: `desk-advisory-${recommendation.id}`,
            type: 'advisory',
            severity: 'info',
            title: 'Recommendation needs review',
            description: `Recommendation ${recommendation.id} contains recorded constraint notes.`,
            actionRequired: 'Review the advisory in the dispatch detail.',
            jobId:
                recommendation.subject_type === 'dispatch_job'
                    ? recommendation.subject_id
                    : undefined,
        });
    });

    return conflicts
        .map((conflict) => {
            const job = conflict.jobId ? byJob.get(conflict.jobId) : undefined;

            return {
                ...conflict,
                jobTitle: job?.title,
                client: job?.client,
                source:
                    job?.source?.label ?? (job ? 'Direct intake' : undefined),
                site: job?.site,
                priority: job?.priority.label,
                priorityValue: job?.priority.value as
                    DispatchPriorityValue | undefined,
                assignedResources: job
                    ? [
                          ...job.personnel_assignments.map(
                              (assignment) => assignment.name,
                          ),
                          ...job.asset_assignments.map(
                              (assignment) => assignment.code,
                          ),
                      ]
                    : [],
                missingResourceTypes: job
                    ? [
                          job.personnel_assignments.length === 0
                              ? 'Personnel'
                              : null,
                          job.asset_assignments.length === 0 ? 'Assets' : null,
                      ].filter((value): value is string => value !== null)
                    : [],
                freshness: job?.updated_at ?? undefined,
                scheduledAt: job?.scheduled_start,
                scheduledEnd: job?.scheduled_end,
            };
        })
        .sort(
            (first, second) =>
                severityRank(first.severity) - severityRank(second.severity),
        );
}
