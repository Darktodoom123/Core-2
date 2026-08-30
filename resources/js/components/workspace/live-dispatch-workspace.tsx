import { Link, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Check,
    CheckCircle2,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock,
    ClipboardList,
    FileText,
    MapPin,
    Package,
    Plus,
    RefreshCw,
    Search,
    SearchX,
    ShieldCheck,
    Sparkles,
    Truck,
    User,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
    Button,
    DataPair,
    EmptyState,
    PageHeading,
    Panel,
    Skeleton,
} from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { DIRECT_DISPATCH_DISCARD_EVENT } from '@/components/workspace/direct-dispatch';
import {
    AcceptGptModal,
    RecommendationDetails,
    RejectGptModal,
} from '@/components/workspace/gpt-workspace-section';
import { LiveDispatchIntake } from '@/components/workspace/live-dispatch-intake';
import { ScheduleBoardMonthView } from '@/components/workspace/schedule-board-month-view';
import { ScheduleBoardWeekView } from '@/components/workspace/schedule-board-week-view';
import {
    dateFromLocalKey,
    localDateKey,
    shiftLocalDate,
} from '@/lib/date-utils';
import { formatCurrency, formatDateTime, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Auth } from '@/types/auth';
import type {
    ApprovalViewModel,
    AssetViewModel,
    ClientViewModel,
    DispatchJobViewModel,
    DispatchPriorityValue,
    DispatchSourceViewModel,
    GptRecommendationViewModel,
    RentalDispatchHandoffViewModel,
    SalesDispatchHandoffViewModel,
    ServiceRequestViewModel,
    WorkspaceCapabilities,
    WorkspaceUserViewModel,
} from '@/types/workspace';

type ViewMode = 'list' | 'board' | 'conflicts';
type BoardPeriod = 'day' | 'week' | 'month';
type BoardCategory = 'all' | 'cranes' | 'trucks' | 'equipment' | 'personnel';
type ConflictTypeFilter =
    | 'all'
    | 'overlaps'
    | 'maintenance'
    | 'approvals'
    | 'responses'
    | 'unassigned'
    | 'advisories';

const ATTENTION_FILTERS: ConflictTypeFilter[] = [
    'all',
    'overlaps',
    'maintenance',
    'approvals',
    'responses',
    'unassigned',
    'advisories',
];

const FIELD_USER_ROLES = new Set(['driver', 'crane_operator']);

function isFieldUser(user: WorkspaceUserViewModel): boolean {
    return user.role !== null && FIELD_USER_ROLES.has(user.role);
}

interface DerivedConflict {
    id: string;
    type:
        | 'overlap'
        | 'maintenance'
        | 'approval'
        | 'response'
        | 'unassigned'
        | 'advisory';
    severity: 'danger' | 'warning' | 'info';
    title: string;
    description: string;
    actionRequired: string;
    jobId?: number;
    jobReference?: string;
    approvalId?: number;
    canDecide?: boolean;
    decisionBlocker?: string | null;
    jobTitle?: string;
    client?: string;
    source?: string;
    site?: string;
    priority?: string;
    priorityValue?: DispatchPriorityValue;
    missingResourceTypes?: string[];
    assignedResources?: string[];
    freshness?: string;
    scheduledAt?: string | null;
    scheduledEnd?: string | null;
}

const conflictFilterLabels: Record<ConflictTypeFilter, string> = {
    all: 'All attention',
    overlaps: 'Overlaps',
    maintenance: 'Maintenance',
    approvals: 'Approvals',
    responses: 'Responses',
    unassigned: 'Unassigned',
    advisories: 'Advisories',
};

function conflictFilterForType(
    type: DerivedConflict['type'],
): Exclude<ConflictTypeFilter, 'all'> {
    if (type === 'overlap') {
        return 'overlaps';
    }

    if (type === 'maintenance') {
        return 'maintenance';
    }

    if (type === 'approval') {
        return 'approvals';
    }

    if (type === 'response') {
        return 'responses';
    }

    if (type === 'advisory') {
        return 'advisories';
    }

    return 'unassigned';
}

function conflictSeverityLabel(severity: DerivedConflict['severity']): string {
    if (severity === 'danger') {
        return 'Blocking';
    }

    if (severity === 'warning') {
        return 'Review';
    }

    return 'Action needed';
}

const severityRank: Record<DerivedConflict['severity'], number> = {
    danger: 0,
    warning: 1,
    info: 2,
};

const priorityRank: Record<string, number> = {
    emergency: 0,
    priority: 1,
    routine: 2,
};

function scheduledTime(value: string | null | undefined): number {
    if (!value) {
        return Number.MAX_SAFE_INTEGER;
    }

    const timestamp = Date.parse(value);

    return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function attentionSortKey(conflict: DerivedConflict) {
    return [
        severityRank[conflict.severity],
        scheduledTime(conflict.scheduledAt),
        priorityRank[conflict.priorityValue ?? ''] ?? 3,
        conflict.id,
    ] as const;
}

function compareAttention(a: DerivedConflict, b: DerivedConflict): number {
    const aKey = attentionSortKey(a);
    const bKey = attentionSortKey(b);

    for (let index = 0; index < aKey.length; index += 1) {
        if (aKey[index] < bKey[index]) {
            return -1;
        }

        if (aKey[index] > bKey[index]) {
            return 1;
        }
    }

    return 0;
}

function unassignedSeverity(
    job: DispatchJobViewModel,
): DerivedConflict['severity'] {
    const start = scheduledTime(job.scheduled_start);
    const hoursUntilStart = (start - Date.now()) / 3_600_000;

    if (
        job.status.value === 'pending_approval' ||
        job.priority.value === 'emergency' ||
        hoursUntilStart <= 0
    ) {
        return 'danger';
    }

    if (job.priority.value === 'priority' || hoursUntilStart <= 24) {
        return 'warning';
    }

    return 'info';
}

function attentionActionLabel(type: DerivedConflict['type']): string {
    if (type === 'overlap') {
        return 'Resolve schedule overlap';
    }

    if (type === 'maintenance') {
        return 'Replace asset';
    }

    if (type === 'approval') {
        return 'Open dispatch context';
    }

    if (type === 'response') {
        return 'Reassign resources';
    }

    if (type === 'advisory') {
        return 'Review recommendation';
    }

    return 'Assign resources';
}

export function LiveDispatchWorkspace({
    jobs,
    clients,
    serviceRequests,
    rentalHandoffs,
    salesHandoffs,
    assets = [],
    approvals = [],
    users = [],
    gptRecommendations = [],
    capabilities,
    canCreate,
    refreshing,
    initialServiceRequestId,
}: {
    jobs: DispatchJobViewModel[];
    clients: ClientViewModel[];
    serviceRequests: ServiceRequestViewModel[];
    rentalHandoffs: RentalDispatchHandoffViewModel[];
    salesHandoffs: SalesDispatchHandoffViewModel[];
    assets?: AssetViewModel[];
    approvals?: ApprovalViewModel[];
    users?: WorkspaceUserViewModel[];
    gptRecommendations?: GptRecommendationViewModel[];
    capabilities: WorkspaceCapabilities;
    canCreate: boolean;
    refreshing: boolean;
    initialServiceRequestId?: number | null;
}) {
    const { url: currentWorkspaceUrl, props } = usePage<{ auth?: Auth }>();
    const returnTo = currentWorkspaceUrl || '/?view=dispatch';
    const [query, setQuery] = useState('');
    const [sourceFilter, setSourceFilter] = useState<
        | 'all'
        | 'service_request'
        | 'rental_reservation'
        | 'sales_order'
        | 'manual'
    >('all');
    const [statusFilter, setStatusFilter] = useState<
        'all' | 'draft' | 'scheduled' | 'active' | 'completed'
    >('all');
    const [dismissConflictAlert, setDismissConflictAlert] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState<number | null>(
        jobs[0]?.id ?? null,
    );
    const incomingHandoffKey = useMemo(
        () =>
            [
                ...(capabilities.convert_service_request
                    ? serviceRequests
                          .filter(
                              (request) => request.dispatch_jobs_count === 0,
                          )
                          .map((request) => `service:${request.id}`)
                    : []),
                ...(capabilities.create_rental_dispatch
                    ? rentalHandoffs
                          .filter((handoff) => !handoff.dispatch_job_id)
                          .map((handoff) => `rental:${handoff.id}`)
                    : []),
                ...(capabilities.create_sales_dispatch
                    ? salesHandoffs
                          .filter((handoff) => !handoff.dispatch_job_id)
                          .map((handoff) => `sale:${handoff.id}`)
                    : []),
            ]
                .filter(Boolean)
                .filter(
                    (value, index, values) => values.indexOf(value) === index,
                )
                .sort()
                .join('|'),
        [
            rentalHandoffs,
            salesHandoffs,
            serviceRequests,
            capabilities.convert_service_request,
            capabilities.create_rental_dispatch,
            capabilities.create_sales_dispatch,
        ],
    );
    const incomingWorkCount = incomingHandoffKey
        ? incomingHandoffKey.split('|').length
        : 0;
    const [showIntake, setShowIntake] = useState(
        Boolean(initialServiceRequestId),
    );
    const [directIntakeDirty, setDirectIntakeDirty] = useState(false);
    const intakePanelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showIntake) {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            intakePanelRef.current?.focus({ preventScroll: true });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [showIntake]);

    const wasIntakeOpen = useRef(false);

    useEffect(() => {
        if (wasIntakeOpen.current && !showIntake) {
            window.requestAnimationFrame(() => {
                document.getElementById('new-dispatch-trigger')?.focus();
            });
        }

        wasIntakeOpen.current = showIntake;
    }, [showIntake]);

    useEffect(() => {
        if (initialServiceRequestId && showIntake) {
            const timer = setTimeout(() => {
                const el = document.getElementById('new-dispatch-panel');

                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [initialServiceRequestId, showIntake]);

    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [boardPeriod, setBoardPeriod] = useState<BoardPeriod>('day');
    const [conflictsOnly, setConflictsOnly] = useState(false);
    const [boardCategory, setBoardCategory] = useState<BoardCategory>('all');
    const [selectedBoardDate, setSelectedBoardDate] = useState(() =>
        localDateKey(new Date()),
    );
    const [conflictFilter, setConflictFilter] =
        useState<ConflictTypeFilter>('all');
    const conflictTabRefs = useRef<
        Partial<Record<ConflictTypeFilter, HTMLButtonElement>>
    >({});

    const role = props.auth?.role;
    const isFieldRole = role === 'driver' || role === 'crane_operator';
    const fieldMode =
        isFieldRole && capabilities.update_assigned_dispatch_status;
    const scheduleBoardUsers = useMemo(
        () => users.filter(isFieldUser),
        [users],
    );

    // Derive a client-side conflict summary from bounded server data.
    const derivedConflicts = useMemo(() => {
        const conflicts: DerivedConflict[] = [];

        // 1. Overlapping personnel schedule conflicts
        const userAssignmentsMap = new Map<
            number,
            Array<{
                job: DispatchJobViewModel;
                user_id: number;
                userName: string;
            }>
        >();

        for (const job of jobs) {
            for (const p of job.personnel_assignments) {
                const existing = userAssignmentsMap.get(p.user_id) ?? [];
                existing.push({ job, user_id: p.user_id, userName: p.name });
                userAssignmentsMap.set(p.user_id, existing);
            }
        }

        for (const [userId, userJobs] of userAssignmentsMap.entries()) {
            if (userJobs.length < 2) {
                continue;
            }

            for (let i = 0; i < userJobs.length; i++) {
                for (let j = i + 1; j < userJobs.length; j++) {
                    const a = userJobs[i].job;
                    const b = userJobs[j].job;

                    if (
                        isOverlapping(
                            a.scheduled_start,
                            a.scheduled_end,
                            b.scheduled_start,
                            b.scheduled_end,
                        )
                    ) {
                        conflicts.push({
                            id: `overlap-user-${userId}-${a.id}-${b.id}`,
                            type: 'overlap',
                            severity: 'danger',
                            title: 'Personnel Schedule Overlap',
                            description: `${userJobs[i].userName} is assigned to overlapping schedules: ${a.reference} (${a.title}) and ${b.reference} (${b.title}).`,
                            actionRequired: `Open job ${a.reference} or ${b.reference} to reassign personnel or adjust scheduled times.`,
                            jobId: a.id,
                            jobReference: a.reference,
                        });
                    }
                }
            }
        }

        // 2. Overlapping asset schedule conflicts
        const assetAssignmentsMap = new Map<
            number,
            Array<{
                job: DispatchJobViewModel;
                assetCode: string;
                assetName: string;
                assetId?: number;
            }>
        >();

        for (const job of jobs) {
            for (const a of job.asset_assignments) {
                const id = a.operational_asset_id;
                const existing = assetAssignmentsMap.get(id) ?? [];
                existing.push({
                    job,
                    assetCode: a.code,
                    assetName: a.name,
                    assetId: id,
                });
                assetAssignmentsMap.set(id, existing);
            }
        }

        for (const [assetId, assetJobs] of assetAssignmentsMap.entries()) {
            if (assetJobs.length < 2) {
                continue;
            }

            for (let i = 0; i < assetJobs.length; i++) {
                for (let j = i + 1; j < assetJobs.length; j++) {
                    const a = assetJobs[i].job;
                    const b = assetJobs[j].job;

                    if (
                        isOverlapping(
                            a.scheduled_start,
                            a.scheduled_end,
                            b.scheduled_start,
                            b.scheduled_end,
                        )
                    ) {
                        conflicts.push({
                            id: `overlap-asset-${assetId}-${a.id}-${b.id}`,
                            type: 'overlap',
                            severity: 'danger',
                            title: 'Asset Schedule Overlap',
                            description: `Asset ${assetJobs[i].assetCode} (${assetJobs[i].assetName}) is assigned to overlapping schedules: ${a.reference} and ${b.reference}.`,
                            actionRequired: `Open job ${a.reference} or ${b.reference} to reassign asset.`,
                            jobId: a.id,
                            jobReference: a.reference,
                        });
                    }
                }
            }
        }

        // 3. Maintenance & inspection blockers on assigned assets
        for (const job of jobs) {
            for (const assetAssign of job.asset_assignments) {
                const assetId = assetAssign.operational_asset_id;
                const realAsset = assets.find(
                    (ast) =>
                        ast.id === assetId || ast.code === assetAssign.code,
                );

                if (
                    realAsset &&
                    (realAsset.blocking_work_orders_count > 0 ||
                        !realAsset.is_dispatchable ||
                        realAsset.status.value === 'under_maintenance' ||
                        realAsset.status.value === 'under_inspection')
                ) {
                    conflicts.push({
                        id: `maint-asset-${job.id}-${assetAssign.code}`,
                        type: 'maintenance',
                        severity: 'danger',
                        title: 'Blocked Asset Assigned',
                        description: `Job ${job.reference} is assigned asset ${assetAssign.code} (${assetAssign.name}), which is blocked by maintenance (${realAsset.blocking_work_orders_count} work order) or unpassed inspection.`,
                        actionRequired: `Release maintenance work order or replace assigned asset on ${job.reference}.`,
                        jobId: job.id,
                        jobReference: job.reference,
                    });
                }
            }
        }

        // 4. Pending approval requests
        for (const approval of approvals) {
            if (approval.status.value === 'pending') {
                conflicts.push({
                    id: `approval-${approval.id}`,
                    type: 'approval',
                    severity: 'warning',
                    title: `Pending Approval: ${humanize(approval.kind)}`,
                    description: `Approval request for ${approval.subject.reference} (${approval.subject.title ?? 'Dispatch'}) submitted by ${approval.requester.name}.`,
                    actionRequired: approval.can_decide
                        ? 'Review requested resource changes and decide approval below.'
                        : (approval.decision_blocker ??
                          'Your operational role cannot decide this approval request.'),
                    approvalId: approval.id,
                    canDecide: approval.can_decide,
                    decisionBlocker: approval.decision_blocker,
                    jobId:
                        typeof approval.subject.id === 'number'
                            ? approval.subject.id
                            : undefined,
                    jobReference: approval.subject.reference,
                });
            }
        }

        // 5. Rejected personnel assignment responses
        for (const job of jobs) {
            for (const assignment of job.personnel_assignments) {
                if (assignment.response_status.value === 'rejected') {
                    conflicts.push({
                        id: `response-rejected-${job.id}-${assignment.id}`,
                        type: 'response',
                        severity: 'danger',
                        title: 'Assignment Response Rejected',
                        description: `${assignment.name} rejected assignment on ${job.reference}. Reason: "${assignment.response_reason || 'No reason specified'}"`,
                        actionRequired: `Reassign role in job assignment workspace.`,
                        jobId: job.id,
                        jobReference: job.reference,
                    });
                }
            }
        }

        // 6. Unassigned required jobs
        for (const job of jobs) {
            if (
                (job.status.value === 'draft' ||
                    job.status.value === 'pending_approval') &&
                job.personnel_assignments.length === 0 &&
                job.asset_assignments.length === 0
            ) {
                conflicts.push({
                    id: `unassigned-${job.id}`,
                    type: 'unassigned',
                    severity: unassignedSeverity(job),
                    title: 'Resource assignment needed',
                    description: `Job ${job.reference} · ${job.title} has no personnel or assets assigned yet.`,
                    actionRequired:
                        'Assign qualified personnel and assets before activation.',
                    jobId: job.id,
                    jobReference: job.reference,
                });
            }
        }

        // 7. GPT Advisory Recommendations
        for (const rec of gptRecommendations) {
            if (
                rec.status === 'pending_review' &&
                !rec.is_expired &&
                rec.conflicts.length > 0
            ) {
                conflicts.push({
                    id: `gpt-rec-${rec.id}`,
                    type: 'advisory',
                    severity: 'info',
                    title: 'GPT Recommendation Advisory Note',
                    description: `AI dispatch recommendation #${rec.id} reported ${rec.conflicts.length} potential constraint note(s).`,
                    actionRequired:
                        'Review advisory recommendation notes in dispatch workflow.',
                    jobId: rec.subject_id,
                });
            }
        }

        const jobsById = new Map(jobs.map((job) => [job.id, job]));
        const approvalsById = new Map(
            approvals.map((approval) => [approval.id, approval]),
        );

        return conflicts
            .map((conflict) => {
                const job = conflict.jobId
                    ? jobsById.get(conflict.jobId)
                    : undefined;
                const approval = conflict.approvalId
                    ? approvalsById.get(conflict.approvalId)
                    : undefined;
                const subject = job ?? approval?.subject;
                const personnel = job?.personnel_assignments ?? [];
                const assetsForJob = job?.asset_assignments ?? [];
                const missingResourceTypes = job
                    ? [
                          personnel.length === 0 ? 'Personnel' : null,
                          assetsForJob.length === 0 ? 'Assets' : null,
                      ].filter((value): value is string => value !== null)
                    : [];
                const assignedResources = [
                    ...personnel.map((person) => person.name),
                    ...assetsForJob.map((asset) => asset.code),
                ];

                return {
                    ...conflict,
                    jobTitle: subject?.title ?? undefined,
                    client: job?.client,
                    source: job
                        ? (job.source?.label ?? 'Direct intake')
                        : undefined,
                    site: subject?.site ?? undefined,
                    priority: subject?.priority?.label ?? undefined,
                    priorityValue: subject?.priority?.value ?? undefined,
                    missingResourceTypes,
                    assignedResources,
                    freshness:
                        job?.updated_at ?? approval?.created_at ?? undefined,
                    scheduledAt: subject?.scheduled_start,
                    scheduledEnd: subject?.scheduled_end,
                };
            })
            .sort(compareAttention);
    }, [jobs, assets, approvals, gptRecommendations]);

    const conflictCounts = useMemo<Record<ConflictTypeFilter, number>>(() => {
        const counts: Record<ConflictTypeFilter, number> = {
            all: derivedConflicts.length,
            overlaps: 0,
            maintenance: 0,
            approvals: 0,
            responses: 0,
            unassigned: 0,
            advisories: 0,
        };

        for (const conflict of derivedConflicts) {
            counts[conflictFilterForType(conflict.type)] += 1;
        }

        return counts;
    }, [derivedConflicts]);

    const conflictBadgeClass = derivedConflicts.some(
        (conflict) => conflict.severity === 'danger',
    )
        ? 'bg-danger text-white'
        : derivedConflicts.some((conflict) => conflict.severity === 'warning')
          ? 'bg-warning text-ink'
          : 'bg-info text-white';

    const dangerConflicts = useMemo(
        () => derivedConflicts.filter((c) => c.severity === 'danger'),
        [derivedConflicts],
    );

    const readyAssetsCount = useMemo(
        () =>
            assets.filter(
                (a) =>
                    a.status?.value === 'available' ||
                    a.status?.value === 'ready_for_service' ||
                    (a.blocking_work_orders_count === 0 &&
                        a.status?.value !== 'maintenance' &&
                        a.status?.value !== 'out_of_service' &&
                        a.status?.value !== 'under_maintenance' &&
                        a.status?.value !== 'awaiting_parts' &&
                        a.status?.value !== 'unavailable'),
            ).length,
        [assets],
    );

    const statusCounts = useMemo(() => {
        const counts = {
            all: jobs.length,
            draft: 0,
            scheduled: 0,
            active: 0,
            completed: 0,
        };

        for (const job of jobs) {
            const v = job.status?.value;

            if (v === 'draft' || v === 'pending_approval') {
                counts.draft += 1;
            } else if (v === 'scheduled' || v === 'dispatched') {
                counts.scheduled += 1;
            } else if (
                v === 'accepted' ||
                v === 'en_route' ||
                v === 'arrived' ||
                v === 'working'
            ) {
                counts.active += 1;
            } else if (v === 'completed') {
                counts.completed += 1;
            }
        }

        return counts;
    }, [jobs]);

    const filteredJobs = useMemo(() => {
        const normalized = query.trim().toLowerCase();

        return jobs.filter((job) => {
            const matchesSource =
                sourceFilter === 'all'
                    ? true
                    : sourceFilter === 'manual'
                      ? job.source === null ||
                        job.source.type === 'direct' ||
                        job.source.type === 'manual' ||
                        Boolean(job.source.manual_intake)
                      : job.source?.type === sourceFilter;

            const matchesStatus =
                statusFilter === 'all'
                    ? true
                    : statusFilter === 'draft'
                      ? job.status?.value === 'draft' ||
                        job.status?.value === 'pending_approval'
                      : statusFilter === 'scheduled'
                        ? job.status?.value === 'scheduled' ||
                          job.status?.value === 'dispatched'
                        : statusFilter === 'active'
                          ? job.status?.value === 'accepted' ||
                            job.status?.value === 'en_route' ||
                            job.status?.value === 'arrived' ||
                            job.status?.value === 'working'
                          : statusFilter === 'completed'
                            ? job.status?.value === 'completed'
                            : true;

            const matchesQuery =
                normalized === '' ||
                `${job.reference} ${job.client} ${job.title} ${job.site} ${job.source?.reference ?? ''}`
                    .toLowerCase()
                    .includes(normalized);

            return matchesSource && matchesStatus && matchesQuery;
        });
    }, [jobs, query, sourceFilter, statusFilter]);

    const boardJobs = useMemo(
        () =>
            filteredJobs.filter((job) =>
                jobOverlapsLocalDate(job, selectedBoardDate),
            ),
        [filteredJobs, selectedBoardDate],
    );

    const selectedJob =
        jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;
    const selectedJobRecommendations = useMemo(
        () =>
            selectedJob === null
                ? []
                : gptRecommendations.filter(
                      (recommendation) =>
                          recommendation.subject_id === selectedJob.id,
                  ),
        [gptRecommendations, selectedJob],
    );

    return (
        <div className="workspace-width-contained">
            <PageHeading
                title={
                    fieldMode ? "Today's assigned work" : 'Dispatch workspace'
                }
                description={
                    fieldMode
                        ? 'Review the jobs actively assigned to you, then open one to record only its next valid field milestone.'
                        : 'Review live jobs, schedule board, and operational conflicts in real time.'
                }
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        {!fieldMode && (
                            <div
                                className="flex max-w-full flex-wrap rounded-lg border border-line bg-surface p-1"
                                role="group"
                                aria-label="Workspace views"
                            >
                                <button
                                    type="button"
                                    aria-pressed={viewMode === 'list'}
                                    onClick={() => setViewMode('list')}
                                    className={cn(
                                        'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                                        viewMode === 'list'
                                            ? 'bg-brand-soft text-brand-strong shadow-xs'
                                            : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    <ClipboardList
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                    Dispatches
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={viewMode === 'board'}
                                    onClick={() => setViewMode('board')}
                                    className={cn(
                                        'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                                        viewMode === 'board'
                                            ? 'bg-brand-soft text-brand-strong shadow-xs'
                                            : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    <CalendarDays
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                    Schedule board
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={viewMode === 'conflicts'}
                                    onClick={() => setViewMode('conflicts')}
                                    className={cn(
                                        'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                                        viewMode === 'conflicts'
                                            ? 'bg-brand-soft text-brand-strong shadow-xs'
                                            : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    <AlertTriangle
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                    Operational attention
                                    {derivedConflicts.length > 0 && (
                                        <span
                                            className={cn(
                                                'ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                                                conflictBadgeClass,
                                            )}
                                            aria-label={`${derivedConflicts.length} operational attention items`}
                                        >
                                            {derivedConflicts.length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        )}

                        {canCreate && !fieldMode && (
                            <Button
                                id="new-dispatch-trigger"
                                variant={showIntake ? 'secondary' : 'primary'}
                                onClick={() => {
                                    if (showIntake) {
                                        if (
                                            directIntakeDirty &&
                                            !window.confirm(
                                                'Discard this direct dispatch draft? Unsaved details will be lost.',
                                            )
                                        ) {
                                            return;
                                        }

                                        window.dispatchEvent(
                                            new Event(
                                                DIRECT_DISPATCH_DISCARD_EVENT,
                                            ),
                                        );
                                        setDirectIntakeDirty(false);
                                    }

                                    setShowIntake((value) => !value);
                                }}
                                aria-expanded={showIntake}
                                aria-controls="new-dispatch-panel"
                            >
                                {showIntake ? (
                                    <X className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                    <Plus
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                )}
                                {showIntake
                                    ? 'Close new dispatch'
                                    : 'New dispatch'}
                                {!showIntake && incomingWorkCount > 0 && (
                                    <span
                                        className="inline-flex min-w-5 items-center justify-center rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] leading-none font-bold"
                                        aria-label={`${incomingWorkCount} incoming handoffs need review`}
                                    >
                                        {incomingWorkCount}
                                    </span>
                                )}
                            </Button>
                        )}
                    </div>
                }
            />

            <AnimatePresence>
                {showIntake && !fieldMode && canCreate && (
                    <motion.div
                        ref={intakePanelRef}
                        id="new-dispatch-panel"
                        tabIndex={-1}
                        role="region"
                        aria-label="New dispatch intake"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <LiveDispatchIntake
                            clients={clients}
                            serviceRequests={serviceRequests}
                            rentalHandoffs={rentalHandoffs}
                            salesHandoffs={salesHandoffs}
                            jobs={jobs}
                            capabilities={capabilities}
                            initialRequestId={initialServiceRequestId}
                            initialMode={
                                initialServiceRequestId ? 'service' : null
                            }
                            onDirtyChange={setDirectIntakeDirty}
                            onClose={() => {
                                setDirectIntakeDirty(false);
                                setShowIntake(false);
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* VIEW MODE: BOARD */}
            {viewMode === 'board' && !fieldMode && (
                <section
                    className="min-w-0 p-4 md:p-6"
                    aria-label="Schedule board section"
                >
                    <div className="mb-4 flex flex-col items-start gap-3 border-b border-line pb-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                {boardPeriod === 'day'
                                    ? 'Day view'
                                    : boardPeriod === 'week'
                                      ? 'Week view'
                                      : 'Month view'}
                            </p>
                            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
                                {boardPeriod === 'day'
                                    ? formatBoardDate(selectedBoardDate)
                                    : boardPeriod === 'week'
                                      ? formatBoardWeek(selectedBoardDate)
                                      : formatBoardMonth(selectedBoardDate)}
                            </h2>
                            <p
                                className="mt-1 text-xs text-ink-soft"
                                role="status"
                            >
                                {boardPeriod === 'day' ? (
                                    <>
                                        {boardJobs.length} scheduled job
                                        {boardJobs.length === 1 ? '' : 's'}
                                    </>
                                ) : (
                                    `Use the ${boardPeriod} planning view to review scheduled work`
                                )}
                            </p>
                        </div>
                        {boardPeriod === 'day' && (
                            <div
                                className="flex min-h-11 flex-wrap items-center gap-1"
                                role="group"
                                aria-label="Schedule board day navigation"
                            >
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    aria-label="Show previous day"
                                    onClick={() =>
                                        setSelectedBoardDate(
                                            shiftLocalDate(
                                                selectedBoardDate,
                                                -1,
                                            ),
                                        )
                                    }
                                >
                                    <ChevronLeft
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                    Previous day
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    aria-label="Show today"
                                    onClick={() =>
                                        setSelectedBoardDate(
                                            localDateKey(new Date()),
                                        )
                                    }
                                >
                                    Today
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    aria-label="Show next day"
                                    onClick={() =>
                                        setSelectedBoardDate(
                                            shiftLocalDate(
                                                selectedBoardDate,
                                                1,
                                            ),
                                        )
                                    }
                                >
                                    Next day
                                    <ChevronRight
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                </Button>
                            </div>
                        )}
                    </div>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <div
                            className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1"
                            role="group"
                            aria-label="Schedule board period"
                        >
                            {(['day', 'week', 'month'] as BoardPeriod[]).map(
                                (period) => (
                                    <button
                                        key={period}
                                        type="button"
                                        aria-pressed={boardPeriod === period}
                                        onClick={() => setBoardPeriod(period)}
                                        className={cn(
                                            'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                                            boardPeriod === period
                                                ? 'bg-brand-soft font-semibold text-brand-strong'
                                                : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                        )}
                                    >
                                        {period}
                                    </button>
                                ),
                            )}
                        </div>
                    </div>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="relative block">
                                <span className="sr-only">Filter board</span>
                                <Search
                                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
                                    aria-hidden="true"
                                />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(event) =>
                                        setQuery(event.target.value)
                                    }
                                    placeholder="Filter jobs or resources"
                                    className="h-11 w-full max-w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-xs placeholder:text-ink-soft sm:w-64"
                                />
                            </label>

                            <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
                                {(
                                    [
                                        'all',
                                        'cranes',
                                        'trucks',
                                        'equipment',
                                        'personnel',
                                    ] as BoardCategory[]
                                ).map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setBoardCategory(cat)}
                                        className={cn(
                                            'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                                            boardCategory === cat
                                                ? 'bg-brand-soft font-semibold text-brand-strong'
                                                : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                        )}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
                            <Button
                                size="sm"
                                variant={
                                    conflictsOnly ? 'primary' : 'secondary'
                                }
                                onClick={() =>
                                    setConflictsOnly((prev) => !prev)
                                }
                                aria-pressed={conflictsOnly}
                            >
                                <AlertTriangle
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Conflicts only
                            </Button>
                        </div>
                    </div>

                    {boardPeriod === 'day' ? (
                        <ScheduleBoardTable
                            jobs={boardJobs}
                            assets={assets}
                            users={scheduleBoardUsers}
                            derivedConflicts={derivedConflicts}
                            category={boardCategory}
                            conflictsOnly={conflictsOnly}
                            selectedDate={selectedBoardDate}
                            onSelectJob={(id) => {
                                setSelectedJobId(id);
                                setViewMode('list');
                            }}
                        />
                    ) : boardPeriod === 'week' ? (
                        <ScheduleBoardWeekView
                            jobs={filteredJobs}
                            assets={assets}
                            users={scheduleBoardUsers}
                            derivedConflicts={derivedConflicts}
                            category={boardCategory}
                            conflictsOnly={conflictsOnly}
                            selectedDate={selectedBoardDate}
                            onSelectDate={setSelectedBoardDate}
                            onSelectJob={(id) => {
                                setSelectedJobId(id);
                                setViewMode('list');
                            }}
                        />
                    ) : (
                        <ScheduleBoardMonthView
                            jobs={filteredJobs}
                            assets={assets}
                            users={users}
                            derivedConflicts={derivedConflicts}
                            category={boardCategory}
                            conflictsOnly={conflictsOnly}
                            selectedDate={selectedBoardDate}
                            onSelectDate={setSelectedBoardDate}
                            onSelectJob={(id) => {
                                setSelectedJobId(id);
                                setViewMode('list');
                            }}
                        />
                    )}
                </section>
            )}

            {/* VIEW MODE: CONFLICTS */}
            {viewMode === 'conflicts' && !fieldMode && (
                <section
                    className="min-w-0 p-4 md:p-6"
                    aria-label="Operational attention section"
                >
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-semibold tracking-[-0.02em]">
                                    Operational attention
                                </h2>
                                <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs font-semibold tracking-normal text-ink normal-case">
                                    {derivedConflicts.length}{' '}
                                    {derivedConflicts.length === 1
                                        ? 'active item'
                                        : 'active items'}
                                </span>
                            </div>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                A prioritized queue of blockers, approvals,
                                rejected responses, and assignment gaps.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-subtle px-3 py-2 text-xs text-ink-soft">
                            <span
                                className={cn(
                                    'h-2 w-2 rounded-full',
                                    derivedConflicts.some(
                                        (conflict) =>
                                            conflict.severity === 'danger',
                                    )
                                        ? 'bg-danger'
                                        : derivedConflicts.some(
                                                (conflict) =>
                                                    conflict.severity ===
                                                    'warning',
                                            )
                                          ? 'bg-warning'
                                          : 'bg-info',
                                )}
                                aria-hidden="true"
                            />
                            <span>
                                {derivedConflicts.some(
                                    (conflict) =>
                                        conflict.severity === 'danger',
                                )
                                    ? 'Resolve blocking items before activation'
                                    : derivedConflicts.length > 0
                                      ? 'Review the next operational decision'
                                      : 'No action required'}
                            </span>
                        </div>
                    </div>

                    <div
                        className="mb-5 flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1"
                        role="tablist"
                        aria-label="Operational attention filters"
                    >
                        {ATTENTION_FILTERS.map((filter) => (
                            <button
                                key={filter}
                                type="button"
                                id={`conflict-tab-${filter}`}
                                role="tab"
                                aria-selected={conflictFilter === filter}
                                tabIndex={conflictFilter === filter ? 0 : -1}
                                aria-controls="conflict-results"
                                ref={(element) => {
                                    conflictTabRefs.current[filter] =
                                        element ?? undefined;
                                }}
                                onKeyDown={(event) => {
                                    if (
                                        ![
                                            'ArrowRight',
                                            'ArrowDown',
                                            'ArrowLeft',
                                            'ArrowUp',
                                            'Home',
                                            'End',
                                        ].includes(event.key)
                                    ) {
                                        return;
                                    }

                                    event.preventDefault();
                                    const filters = ATTENTION_FILTERS;
                                    const currentIndex =
                                        filters.indexOf(filter);
                                    const nextIndex =
                                        event.key === 'Home'
                                            ? 0
                                            : event.key === 'End'
                                              ? filters.length - 1
                                              : (currentIndex +
                                                    (event.key ===
                                                        'ArrowLeft' ||
                                                    event.key === 'ArrowUp'
                                                        ? -1
                                                        : 1) +
                                                    filters.length) %
                                                filters.length;
                                    const next = filters[nextIndex];
                                    setConflictFilter(next);
                                    requestAnimationFrame(() =>
                                        conflictTabRefs.current[next]?.focus(),
                                    );
                                }}
                                onClick={() => setConflictFilter(filter)}
                                className={cn(
                                    'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                                    conflictFilter === filter
                                        ? 'bg-brand-soft font-semibold text-brand-strong'
                                        : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                )}
                            >
                                <span>{conflictFilterLabels[filter]}</span>
                                <span
                                    className={cn(
                                        'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold',
                                        conflictFilter === filter
                                            ? 'bg-brand text-ink'
                                            : 'bg-surface-subtle text-ink-soft',
                                    )}
                                >
                                    {conflictCounts[filter]}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div
                        className="sr-only"
                        aria-live="polite"
                        aria-atomic="true"
                        aria-label="Operational attention status"
                    >
                        {conflictCounts.all} operational attention{' '}
                        {conflictCounts.all === 1 ? 'item' : 'items'};{' '}
                        {conflictCounts[conflictFilter]} shown.
                    </div>

                    <ConflictReviewList
                        conflicts={derivedConflicts}
                        filter={conflictFilter}
                        returnTo={returnTo}
                        onOpenDispatch={(jobId) => {
                            setSelectedJobId(jobId);
                            setViewMode('list');
                        }}
                    />
                </section>
            )}

            {/* VIEW MODE: LIST (DEFAULT) */}
            {(viewMode === 'list' || fieldMode) && (
                <>
                    {/* DANGER CONFLICT ALERT BANNER */}
                    {viewMode === 'list' &&
                        !fieldMode &&
                        dangerConflicts.length > 0 &&
                        !dismissConflictAlert && (
                            <div className="workspace-width-contained px-4 pt-4 md:px-6">
                                <div
                                    role="alert"
                                    className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-soft/40 p-3.5 text-danger-strong sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger text-white">
                                            <AlertTriangle className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold tracking-wider text-danger-strong uppercase">
                                                Critical Operational Conflict
                                                {dangerConflicts.length > 1
                                                    ? 's'
                                                    : ''}{' '}
                                                Detected (
                                                {dangerConflicts.length})
                                            </p>
                                            <p className="mt-0.5 text-xs text-ink">
                                                <span className="font-semibold">
                                                    {dangerConflicts[0].title}:
                                                </span>{' '}
                                                {dangerConflicts[0].description}
                                                {dangerConflicts.length > 1 && (
                                                    <span className="ml-1 text-ink-soft">
                                                        (+
                                                        {dangerConflicts.length -
                                                            1}{' '}
                                                        more)
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            onClick={() =>
                                                setViewMode('conflicts')
                                            }
                                        >
                                            Review Conflicts
                                        </Button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setDismissConflictAlert(true)
                                            }
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-subtle hover:text-ink"
                                            aria-label="Dismiss alert"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    {/* ZERO-STATE: UNIFIED FLEET OPERATIONS HUB */}
                    {!fieldMode &&
                    jobs.length === 0 &&
                    !refreshing &&
                    query.trim() === '' &&
                    sourceFilter === 'all' &&
                    statusFilter === 'all' ? (
                        <div className="workspace-width-contained p-4 md:p-6">
                            <Panel className="overflow-hidden border border-line bg-surface shadow-xs">
                                {/* Header Banner */}
                                <div className="border-b border-line bg-surface-subtle px-6 py-6 text-center md:px-8">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
                                        <ClipboardList className="h-6 w-6" />
                                    </div>
                                    <h2 className="mt-3 text-xl font-bold tracking-tight text-ink">
                                        Fleet Operations Hub
                                    </h2>
                                    <p className="mx-auto mt-1.5 max-w-xl text-sm leading-relaxed text-ink-soft">
                                        No active dispatches are currently
                                        running. Review fleet availability
                                        below, stage incoming commercial orders,
                                        or create an ad-hoc direct dispatch to
                                        mobilize equipment.
                                    </p>
                                </div>

                                {/* Fleet Readiness KPIs */}
                                <div className="grid divide-y divide-line border-b border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                                    <div className="p-5 text-center sm:p-6">
                                        <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-success-soft text-success-strong">
                                            <Truck className="h-4 w-4" />
                                        </div>
                                        <p className="mt-2 text-2xl font-bold text-ink">
                                            {readyAssetsCount}{' '}
                                            <span className="text-sm font-normal text-ink-soft">
                                                / {assets.length}
                                            </span>
                                        </p>
                                        <p className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                                            Fleet Units Ready
                                        </p>
                                        <p className="mt-1 text-[11px] text-ink-soft">
                                            Cranes, boom trucks &amp; transport
                                            ready
                                        </p>
                                    </div>

                                    <div className="p-5 text-center sm:p-6">
                                        <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                                            <Users className="h-4 w-4" />
                                        </div>
                                        <p className="mt-2 text-2xl font-bold text-ink">
                                            {scheduleBoardUsers.length}
                                        </p>
                                        <p className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                                            Crew On Duty
                                        </p>
                                        <p className="mt-1 text-[11px] text-ink-soft">
                                            Qualified operators &amp; riggers
                                            available
                                        </p>
                                    </div>

                                    <div className="p-5 text-center sm:p-6">
                                        <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-warning-soft text-warning-strong">
                                            <Package className="h-4 w-4" />
                                        </div>
                                        <p className="mt-2 text-2xl font-bold text-ink">
                                            {incomingWorkCount}
                                        </p>
                                        <p className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                                            Pending Orders
                                        </p>
                                        <p className="mt-1 text-[11px] text-ink-soft">
                                            Incoming commercial requests to
                                            stage
                                        </p>
                                    </div>
                                </div>

                                {/* Action Triggers */}
                                <div className="flex flex-col items-center justify-center gap-3 bg-surface p-6 sm:flex-row">
                                    {canCreate && (
                                        <>
                                            {incomingWorkCount > 0 && (
                                                <Button
                                                    variant="primary"
                                                    onClick={() =>
                                                        setShowIntake(true)
                                                    }
                                                    className="w-full sm:w-auto"
                                                >
                                                    <Package className="mr-2 h-4 w-4" />
                                                    Review &amp; Stage Incoming
                                                    Orders ({incomingWorkCount})
                                                </Button>
                                            )}
                                            <Button
                                                variant={
                                                    incomingWorkCount > 0
                                                        ? 'secondary'
                                                        : 'primary'
                                                }
                                                onClick={() =>
                                                    setShowIntake(true)
                                                }
                                                className="w-full sm:w-auto"
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                Create Direct Dispatch
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </Panel>
                        </div>
                    ) : (
                        <div
                            className={cn(
                                'workspace-width-contained min-h-[calc(100vh-9rem)]',
                                !fieldMode &&
                                    'grid lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]',
                            )}
                        >
                            <aside
                                className={cn(
                                    'min-w-0 border-b border-line bg-surface',
                                    fieldMode
                                        ? 'mx-auto w-full max-w-5xl'
                                        : 'lg:border-r lg:border-b-0',
                                )}
                            >
                                <div className="border-b border-line p-4">
                                    <label className="relative block">
                                        <span className="sr-only">
                                            {fieldMode
                                                ? 'Search assigned jobs'
                                                : 'Search live dispatches'}
                                        </span>
                                        <Search
                                            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
                                            aria-hidden="true"
                                        />
                                        <input
                                            type="search"
                                            value={query}
                                            onChange={(event) =>
                                                setQuery(event.target.value)
                                            }
                                            placeholder={
                                                fieldMode
                                                    ? 'Search assigned jobs'
                                                    : 'Search jobs, clients, sites'
                                            }
                                            className="h-11 w-full rounded-lg border border-line-strong bg-surface-subtle pr-3 pl-9 text-sm placeholder:text-ink-soft"
                                        />
                                    </label>
                                    {!fieldMode && (
                                        <label className="mt-3 block">
                                            <span className="sr-only">
                                                Filter dispatch source
                                            </span>
                                            <select
                                                value={sourceFilter}
                                                onChange={(event) =>
                                                    setSourceFilter(
                                                        event.target
                                                            .value as typeof sourceFilter,
                                                    )
                                                }
                                                className="h-11 w-full rounded-lg border border-line-strong bg-surface-subtle px-3 text-xs font-medium text-ink"
                                            >
                                                <option value="all">
                                                    All operational sources
                                                </option>
                                                <option value="service_request">
                                                    Service requests
                                                </option>
                                                <option value="rental_reservation">
                                                    Rental reservations
                                                </option>
                                                <option value="sales_order">
                                                    Sales delivery orders
                                                </option>
                                                <option value="manual">
                                                    Manual source ·
                                                    manual_intake
                                                </option>
                                            </select>
                                        </label>
                                    )}

                                    {/* 1-Click Quick Status Filter Chips */}
                                    {!fieldMode && jobs.length > 0 && (
                                        <div
                                            className="mt-3 flex flex-wrap gap-1"
                                            role="group"
                                            aria-label="Filter dispatches by status"
                                        >
                                            <button
                                                type="button"
                                                aria-pressed={
                                                    statusFilter === 'all'
                                                }
                                                onClick={() =>
                                                    setStatusFilter('all')
                                                }
                                                className={cn(
                                                    'inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                                    statusFilter === 'all'
                                                        ? 'bg-ink font-semibold text-canvas'
                                                        : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                                                )}
                                            >
                                                All
                                                <span className="py-0.2 ml-1 rounded-full bg-surface/20 px-1 text-[10px]">
                                                    {statusCounts.all}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={
                                                    statusFilter === 'draft'
                                                }
                                                onClick={() =>
                                                    setStatusFilter('draft')
                                                }
                                                className={cn(
                                                    'inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                                    statusFilter === 'draft'
                                                        ? 'border border-warning/40 bg-warning-soft font-semibold text-warning-strong'
                                                        : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                                                )}
                                            >
                                                Drafts
                                                {statusCounts.draft > 0 && (
                                                    <span className="py-0.2 ml-1 rounded-full bg-warning/20 px-1.5 text-[10px] font-bold text-warning-strong">
                                                        {statusCounts.draft}
                                                    </span>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={
                                                    statusFilter === 'scheduled'
                                                }
                                                onClick={() =>
                                                    setStatusFilter('scheduled')
                                                }
                                                className={cn(
                                                    'inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                                    statusFilter === 'scheduled'
                                                        ? 'border border-brand/40 bg-brand-soft font-semibold text-brand-strong'
                                                        : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                                                )}
                                            >
                                                Scheduled
                                                {statusCounts.scheduled > 0 && (
                                                    <span className="py-0.2 ml-1 rounded-full bg-brand/20 px-1.5 text-[10px] font-bold text-brand-strong">
                                                        {statusCounts.scheduled}
                                                    </span>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={
                                                    statusFilter === 'active'
                                                }
                                                onClick={() =>
                                                    setStatusFilter('active')
                                                }
                                                className={cn(
                                                    'inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                                    statusFilter === 'active'
                                                        ? 'border border-success/40 bg-success-soft font-semibold text-success-strong'
                                                        : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                                                )}
                                            >
                                                Active
                                                {statusCounts.active > 0 && (
                                                    <span className="py-0.2 ml-1 rounded-full bg-success/20 px-1.5 text-[10px] font-bold text-success-strong">
                                                        {statusCounts.active}
                                                    </span>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={
                                                    statusFilter === 'completed'
                                                }
                                                onClick={() =>
                                                    setStatusFilter('completed')
                                                }
                                                className={cn(
                                                    'inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                                    statusFilter === 'completed'
                                                        ? 'border border-line-strong bg-surface-subtle font-semibold text-ink'
                                                        : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                                                )}
                                            >
                                                Done
                                                {statusCounts.completed > 0 && (
                                                    <span className="ml-1 text-[10px] text-ink-soft">
                                                        {statusCounts.completed}
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    <p
                                        className="mt-2 text-xs text-ink-soft"
                                        role="status"
                                    >
                                        {refreshing
                                            ? 'Refreshing live jobs…'
                                            : `${filteredJobs.length} of ${jobs.length} jobs`}
                                    </p>
                                </div>

                                {/* Incoming Commercial Handoffs Notice */}
                                {!fieldMode &&
                                    incomingWorkCount > 0 &&
                                    jobs.length > 0 && (
                                        <div className="flex items-center justify-between border-b border-brand/20 bg-brand-soft/40 px-4 py-2.5 text-xs text-brand-strong">
                                            <div className="flex items-center gap-2">
                                                <Package className="h-3.5 w-3.5 shrink-0 text-brand" />
                                                <span className="font-semibold">
                                                    {incomingWorkCount} incoming
                                                    order
                                                    {incomingWorkCount > 1
                                                        ? 's'
                                                        : ''}{' '}
                                                    ready to stage
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowIntake(true)
                                                }
                                                className="font-bold text-brand hover:underline"
                                            >
                                                Stage drafts →
                                            </button>
                                        </div>
                                    )}

                                {refreshing ? (
                                    <DispatchListSkeleton />
                                ) : filteredJobs.length === 0 ? (
                                    query.trim() === '' &&
                                    sourceFilter === 'all' &&
                                    statusFilter === 'all' ? (
                                        <EmptyState
                                            compact
                                            icon={ClipboardList}
                                            title={
                                                fieldMode
                                                    ? 'No assigned jobs today'
                                                    : 'No dispatch jobs available'
                                            }
                                            message={
                                                canCreate
                                                    ? 'Create a live draft to begin the dispatch workflow.'
                                                    : 'Jobs assigned or visible to your account will appear here.'
                                            }
                                            primaryAction={
                                                canCreate ? (
                                                    <Button
                                                        variant="primary"
                                                        onClick={() =>
                                                            setShowIntake(true)
                                                        }
                                                    >
                                                        New dispatch
                                                    </Button>
                                                ) : undefined
                                            }
                                        />
                                    ) : (
                                        <EmptyState
                                            compact
                                            icon={SearchX}
                                            title="No matching dispatches"
                                            message="Try another reference, client, site, or operational status."
                                            primaryAction={
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => {
                                                        setQuery('');
                                                        setSourceFilter('all');
                                                        setStatusFilter('all');
                                                    }}
                                                >
                                                    Clear filters
                                                </Button>
                                            }
                                        />
                                    )
                                ) : (
                                    <ul className="divide-y divide-line">
                                        {filteredJobs.map((job) => {
                                            const jobConflicts =
                                                derivedConflicts.filter(
                                                    (c) => c.jobId === job.id,
                                                );
                                            const hasConflict =
                                                jobConflicts.length > 0;

                                            return (
                                                <li key={job.id}>
                                                    {fieldMode && (
                                                        <Link
                                                            href={`/operations/dispatch-jobs/${job.id}`}
                                                            className="flex min-h-[72px] w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-subtle"
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-start justify-between gap-1.5">
                                                                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                                                        <p className="text-xs font-bold text-ink">
                                                                            {
                                                                                job.reference
                                                                            }
                                                                        </p>
                                                                        {job.priority &&
                                                                            job
                                                                                .priority
                                                                                .value !==
                                                                                'routine' && (
                                                                                <span
                                                                                    className={cn(
                                                                                        'py-0.2 inline-flex items-center rounded px-1 text-[9px] font-bold tracking-wider uppercase',
                                                                                        job
                                                                                            .priority
                                                                                            .value ===
                                                                                            'emergency'
                                                                                            ? 'border border-danger/30 bg-danger-soft text-danger-strong'
                                                                                            : 'border border-warning/30 bg-warning-soft text-warning-strong',
                                                                                    )}
                                                                                >
                                                                                    {
                                                                                        job
                                                                                            .priority
                                                                                            .label
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                        {job.source && (
                                                                            <DispatchSourceBadge
                                                                                source={
                                                                                    job.source
                                                                                }
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    <CanonicalStatusBadge
                                                                        status={
                                                                            job.status
                                                                        }
                                                                    />
                                                                </div>
                                                                <p className="mt-0.5 truncate text-xs font-semibold text-ink">
                                                                    {job.title}
                                                                </p>
                                                                <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-ink-soft">
                                                                    <span className="truncate">
                                                                        {
                                                                            job.client
                                                                        }
                                                                        {job
                                                                            .asset_assignments
                                                                            .length >
                                                                            0 &&
                                                                            ` · ${job.asset_assignments[0].code}`}
                                                                    </span>
                                                                    <span className="shrink-0 text-[10px]">
                                                                        {formatDateTime(
                                                                            job.scheduled_start,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <ChevronRight
                                                                className="mt-2 h-3.5 w-3.5 shrink-0 text-ink-soft"
                                                                aria-hidden="true"
                                                            />
                                                        </Link>
                                                    )}
                                                    {!fieldMode && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setSelectedJobId(
                                                                    job.id,
                                                                )
                                                            }
                                                            className={cn(
                                                                'flex min-h-[72px] w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-subtle',
                                                                job.id ===
                                                                    selectedJob?.id &&
                                                                    'bg-brand-soft/60 ring-1 ring-brand/30',
                                                            )}
                                                            aria-current={
                                                                job.id ===
                                                                selectedJob?.id
                                                                    ? 'true'
                                                                    : undefined
                                                            }
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-start justify-between gap-1.5">
                                                                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                                                        <p className="text-xs font-bold text-ink">
                                                                            {
                                                                                job.reference
                                                                            }
                                                                        </p>
                                                                        {job.priority &&
                                                                            job
                                                                                .priority
                                                                                .value !==
                                                                                'routine' && (
                                                                                <span
                                                                                    className={cn(
                                                                                        'py-0.2 inline-flex items-center rounded px-1 text-[9px] font-bold tracking-wider uppercase',
                                                                                        job
                                                                                            .priority
                                                                                            .value ===
                                                                                            'emergency'
                                                                                            ? 'border border-danger/30 bg-danger-soft text-danger-strong'
                                                                                            : 'border border-warning/30 bg-warning-soft text-warning-strong',
                                                                                    )}
                                                                                >
                                                                                    {
                                                                                        job
                                                                                            .priority
                                                                                            .label
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                        {job.source && (
                                                                            <DispatchSourceBadge
                                                                                source={
                                                                                    job.source
                                                                                }
                                                                            />
                                                                        )}
                                                                        {hasConflict && (
                                                                            <AlertTriangle
                                                                                className="h-3.5 w-3.5 shrink-0 text-danger"
                                                                                aria-label="Job has active operational conflict"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    <CanonicalStatusBadge
                                                                        status={
                                                                            job.status
                                                                        }
                                                                    />
                                                                </div>
                                                                <p className="mt-0.5 truncate text-xs font-semibold text-ink">
                                                                    {job.title}
                                                                </p>
                                                                <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-ink-soft">
                                                                    <span className="truncate">
                                                                        {
                                                                            job.client
                                                                        }
                                                                        {job
                                                                            .asset_assignments
                                                                            .length >
                                                                            0 &&
                                                                            ` · ${job.asset_assignments[0].code}`}
                                                                    </span>
                                                                    <span className="shrink-0 text-[10px]">
                                                                        {formatDateTime(
                                                                            job.scheduled_start,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <ChevronRight
                                                                className="mt-2 h-3.5 w-3.5 shrink-0 text-ink-soft"
                                                                aria-hidden="true"
                                                            />
                                                        </button>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </aside>

                            {!fieldMode && (
                                <section className="min-w-0 bg-canvas p-4 md:p-6">
                                    {selectedJob ? (
                                        <DispatchDetails
                                            job={selectedJob}
                                            conflicts={derivedConflicts.filter(
                                                (c) =>
                                                    c.jobId === selectedJob.id,
                                            )}
                                            recommendations={
                                                selectedJobRecommendations
                                            }
                                            capabilities={capabilities}
                                            returnTo={returnTo}
                                        />
                                    ) : (
                                        <Panel>
                                            <EmptyState
                                                icon={ClipboardList}
                                                title="Select a dispatch"
                                                message="Choose a live job from the list to review its schedule, site, and assignments."
                                            />
                                        </Panel>
                                    )}
                                </section>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function ScheduleBoardTable({
    jobs,
    assets,
    users,
    derivedConflicts,
    category,
    conflictsOnly,
    selectedDate,
    onSelectJob,
}: {
    jobs: DispatchJobViewModel[];
    assets: AssetViewModel[];
    users: WorkspaceUserViewModel[];
    derivedConflicts: DerivedConflict[];
    category: BoardCategory;
    conflictsOnly: boolean;
    selectedDate: string;
    onSelectJob: (jobId: number) => void;
}) {
    const timeWindow = useMemo(
        () => calculateBoardTimeWindow(jobs, selectedDate),
        [jobs, selectedDate],
    );

    const { startHour, endHour, totalSlots, hours, isExpanded, label } =
        timeWindow;

    // Compile rows from server assets and assigned personnel
    const rows = useMemo(() => {
        const resourceRows: Array<{
            id: string;
            code: string;
            name: string;
            category: 'cranes' | 'trucks' | 'equipment' | 'personnel';
            statusLabel: string;
            statusTone?: 'success' | 'warning' | 'error';
            jobAssignments: Array<{
                job: DispatchJobViewModel;
                startCol: number;
                colSpan: number;
            }>;
            hasConflict: boolean;
        }> = [];

        // Add Asset Rows
        for (const asset of assets) {
            const kindLower = (asset.kind || '').toLowerCase();
            let cat: 'cranes' | 'trucks' | 'equipment' = 'equipment';

            if (kindLower.includes('crane')) {
                cat = 'cranes';
            } else if (
                kindLower.includes('truck') ||
                kindLower.includes('vehicle')
            ) {
                cat = 'trucks';
            }

            if (category !== 'all' && category !== cat) {
                continue;
            }

            const assignedJobsForAsset: Array<{
                job: DispatchJobViewModel;
                startCol: number;
                colSpan: number;
            }> = [];

            for (const job of jobs) {
                const assigned = job.asset_assignments.some(
                    (a) =>
                        a.operational_asset_id === asset.id ||
                        a.code === asset.code,
                );

                if (assigned) {
                    const span = calculateTimeSpan(
                        job.scheduled_start,
                        job.scheduled_end,
                        selectedDate,
                        startHour,
                        endHour,
                        totalSlots,
                    );

                    if (span !== null) {
                        assignedJobsForAsset.push({ job, ...span });
                    }
                }
            }

            const assetConflicts = derivedConflicts.filter(
                (c) =>
                    c.description.includes(asset.code) ||
                    assignedJobsForAsset.some((aj) => aj.job.id === c.jobId),
            );
            const hasConflict = assetConflicts.length > 0;

            if (conflictsOnly && !hasConflict) {
                continue;
            }

            resourceRows.push({
                id: `asset-${asset.id}`,
                code: asset.code,
                name: asset.name,
                category: cat,
                statusLabel: asset.status.label,
                statusTone:
                    asset.blocking_work_orders_count > 0
                        ? 'error'
                        : asset.is_dispatchable
                          ? 'success'
                          : 'warning',
                jobAssignments: assignedJobsForAsset,
                hasConflict,
            });
        }

        // Add Personnel Rows
        if (category === 'all' || category === 'personnel') {
            for (const user of users) {
                const assignedJobsForUser: Array<{
                    job: DispatchJobViewModel;
                    startCol: number;
                    colSpan: number;
                }> = [];

                for (const job of jobs) {
                    const assigned = job.personnel_assignments.some(
                        (p) => p.user_id === user.id,
                    );

                    if (assigned) {
                        const span = calculateTimeSpan(
                            job.scheduled_start,
                            job.scheduled_end,
                            selectedDate,
                            startHour,
                            endHour,
                            totalSlots,
                        );

                        if (span !== null) {
                            assignedJobsForUser.push({ job, ...span });
                        }
                    }
                }

                const userConflicts = derivedConflicts.filter(
                    (c) =>
                        c.description.includes(user.name) ||
                        assignedJobsForUser.some((uj) => uj.job.id === c.jobId),
                );
                const hasConflict = userConflicts.length > 0;

                if (conflictsOnly && !hasConflict) {
                    continue;
                }

                if (
                    assignedJobsForUser.length > 0 ||
                    category === 'personnel'
                ) {
                    resourceRows.push({
                        id: `user-${user.id}`,
                        code: user.role_label ?? 'Personnel',
                        name: user.name,
                        category: 'personnel',
                        statusLabel: user.is_active ? 'Active' : 'Inactive',
                        statusTone: user.is_active ? 'success' : 'error',
                        jobAssignments: assignedJobsForUser,
                        hasConflict,
                    });
                }
            }
        }

        return resourceRows;
    }, [
        assets,
        users,
        jobs,
        category,
        conflictsOnly,
        derivedConflicts,
        selectedDate,
        startHour,
        endHour,
        totalSlots,
    ]);

    const minWidthRem = Math.max(64, 16 + totalSlots * 4.5);

    return (
        <Panel className="overflow-hidden">
            {isExpanded && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-brand-soft/40 px-4 py-2 text-xs text-brand-strong">
                    <div className="flex items-center gap-2">
                        <Clock
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        <span className="font-semibold">
                            Auto-Expanded Schedule:
                        </span>
                        <span>
                            Active operating window {label} (Extended beyond
                            standard 7 AM – 5 PM for early/late operations)
                        </span>
                    </div>
                </div>
            )}
            <div
                className="workspace-scroll-region"
                role="region"
                aria-label={`Daily schedule for ${label}`}
                tabIndex={0}
            >
                <div style={{ minWidth: `${minWidthRem}rem` }}>
                    {/* Header */}
                    <div className="grid grid-cols-[16rem_minmax(0,1fr)] border-b border-line bg-surface-subtle text-xs font-semibold">
                        <div className="border-r border-line px-4 py-3 text-ink">
                            Resource & Status
                        </div>
                        <div
                            className="grid divide-x divide-line"
                            style={{
                                gridTemplateColumns: `repeat(${totalSlots}, minmax(4.5rem, 1fr))`,
                            }}
                        >
                            {hours.map((h) => (
                                <div
                                    key={h}
                                    className="px-2 py-3 text-center text-ink-soft"
                                >
                                    {formatHourLabel(h)}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rows */}
                    {rows.length === 0 ? (
                        <EmptyState
                            compact
                            icon={SearchX}
                            title="No scheduled resources found"
                            message={
                                conflictsOnly
                                    ? 'No resources have active conflict warnings.'
                                    : 'Try adjusting the search query or category filter.'
                            }
                        />
                    ) : (
                        <div className="divide-y divide-line">
                            {rows.map((row) => (
                                <div
                                    key={row.id}
                                    className="grid grid-cols-[16rem_minmax(0,1fr)] items-stretch hover:bg-surface-subtle/50"
                                >
                                    <div className="flex items-center justify-between border-r border-line px-4 py-3">
                                        <div className="min-w-0 flex-1 pr-2">
                                            <div className="flex items-center gap-1.5">
                                                <p className="truncate text-xs font-semibold text-ink">
                                                    {row.name}
                                                </p>
                                                {row.hasConflict && (
                                                    <AlertTriangle
                                                        className="h-3.5 w-3.5 shrink-0 text-danger"
                                                        aria-label="Conflict on resource"
                                                    />
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-[11px] text-ink-soft">
                                                {row.code}
                                            </p>
                                        </div>
                                        <span
                                            className={cn(
                                                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                                                row.statusTone === 'success' &&
                                                    'bg-success-soft text-success-strong',
                                                row.statusTone === 'warning' &&
                                                    'bg-warning-soft text-warning-strong',
                                                row.statusTone === 'error' &&
                                                    'bg-danger-soft text-danger',
                                            )}
                                        >
                                            {row.statusLabel}
                                        </span>
                                    </div>

                                    <div
                                        className="relative grid divide-x divide-line bg-canvas/30 p-1"
                                        style={{
                                            gridTemplateColumns: `repeat(${totalSlots}, minmax(4.5rem, 1fr))`,
                                        }}
                                    >
                                        {row.jobAssignments.map(
                                            ({ job, startCol, colSpan }) => {
                                                const hasJobConflict =
                                                    row.hasConflict ||
                                                    job.priority.value ===
                                                        'emergency';
                                                const dayJobClass =
                                                    hasJobConflict
                                                        ? 'border-danger/60 bg-danger-soft text-danger-strong ring-1 ring-danger/20'
                                                        : job.priority.value ===
                                                            'priority'
                                                          ? 'border-warning/60 bg-warning-soft text-warning-strong'
                                                          : job.status.value ===
                                                              'completed'
                                                            ? 'border-success/30 bg-success-soft/30 text-ink'
                                                            : [
                                                                    'working',
                                                                    'active',
                                                                    'en_route',
                                                                    'dispatched',
                                                                ].includes(
                                                                    job.status
                                                                        .value,
                                                                )
                                                              ? 'border-brand-strong bg-brand-soft text-brand-strong'
                                                              : 'border-line bg-surface text-ink hover:border-brand-strong hover:bg-surface-subtle';

                                                return (
                                                    <button
                                                        key={`${row.id}-job-${job.id}`}
                                                        type="button"
                                                        onClick={() =>
                                                            onSelectJob(job.id)
                                                        }
                                                        style={{
                                                            gridColumnStart:
                                                                startCol,
                                                            gridColumnEnd: `span ${colSpan}`,
                                                        }}
                                                        className={cn(
                                                            'z-10 flex flex-col justify-center rounded-lg border px-2 py-1.5 text-left shadow-xs transition-all hover:scale-[1.01] hover:shadow-md',
                                                            dayJobClass,
                                                        )}
                                                        title={`${job.reference}: ${job.title} (${job.client})`}
                                                    >
                                                        <div className="flex items-center justify-between gap-1">
                                                            <span className="truncate text-[11px] font-bold tracking-tight">
                                                                {job.reference}
                                                            </span>
                                                            {hasJobConflict ? (
                                                                <AlertTriangle
                                                                    className="h-3 w-3 shrink-0 text-danger"
                                                                    aria-hidden="true"
                                                                />
                                                            ) : (
                                                                <CanonicalStatusBadge
                                                                    status={
                                                                        job.status
                                                                    }
                                                                />
                                                            )}
                                                        </div>
                                                        <p className="truncate text-[10px] leading-tight font-medium">
                                                            {job.title}
                                                        </p>
                                                    </button>
                                                );
                                            },
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Panel>
    );
}

function ConflictReviewList({
    conflicts,
    filter,
    returnTo,
    onOpenDispatch,
}: {
    conflicts: DerivedConflict[];
    filter: ConflictTypeFilter;
    returnTo: string;
    onOpenDispatch: (jobId: number) => void;
}) {
    const filtered = useMemo(() => {
        if (filter === 'all') {
            return conflicts;
        }

        return conflicts.filter(
            (conflict) => conflictFilterForType(conflict.type) === filter,
        );
    }, [conflicts, filter]);

    if (filtered.length === 0) {
        return (
            <Panel
                id="conflict-results"
                role="tabpanel"
                aria-labelledby={`conflict-tab-${filter}`}
                className="p-6"
            >
                <EmptyState
                    icon={ShieldCheck}
                    title={
                        filter === 'all'
                            ? 'No operational attention items'
                            : `${conflictFilterLabels[filter]} checks are clear`
                    }
                    message="There are no active items in this queue. New issues will appear here when the workspace detects them."
                />
            </Panel>
        );
    }

    const blockingCount = filtered.filter(
        (conflict) => conflict.severity === 'danger',
    ).length;
    const reviewCount = filtered.filter(
        (conflict) => conflict.severity === 'warning',
    ).length;
    const actionCount = filtered.filter(
        (conflict) => conflict.severity === 'info',
    ).length;

    return (
        <div className="space-y-4">
            <div
                className="flex flex-wrap gap-2"
                aria-label="Attention summary"
            >
                {(
                    [
                        ['Blocking', blockingCount, 'danger'],
                        ['Review', reviewCount, 'warning'],
                        ['Action needed', actionCount, 'info'],
                    ] as const
                )
                    .filter(([, count]) => count > 0)
                    .map(([label, count, tone]) => (
                        <ConflictSummaryCard
                            key={label}
                            label={label}
                            count={count}
                            detail={
                                label === 'Blocking'
                                    ? 'Stops safe dispatch progression'
                                    : label === 'Review'
                                      ? 'Needs an operational decision'
                                      : 'Needs operational follow-up'
                            }
                            tone={tone}
                        />
                    ))}
            </div>

            <Panel
                id="conflict-results"
                role="tabpanel"
                aria-labelledby={`conflict-tab-${filter}`}
                className="overflow-hidden p-0"
            >
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line bg-surface-subtle px-4 py-4 md:px-5">
                    <div>
                        <h3 className="text-base font-semibold text-ink">
                            {filtered.length}{' '}
                            {filtered.length === 1 ? 'item' : 'items'} to review
                        </h3>
                        <p className="mt-1 text-xs text-ink-soft">
                            {filter === 'all'
                                ? 'Blocking items are first; then review approvals, responses, and assignment gaps.'
                                : `Showing ${conflictFilterLabels[filter].toLowerCase()} that need attention.`}
                        </p>
                    </div>
                    <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink-soft">
                        {conflictFilterLabels[filter]}
                    </span>
                </div>

                <div className="divide-y divide-line">
                    {filtered.map((conflict) => {
                        const actionLabel = attentionActionLabel(conflict.type);
                        const opensWorkspace = conflict.type === 'advisory';
                        const actionHref = opensWorkspace
                            ? '/?view=dispatch'
                            : conflict.jobId
                              ? assignmentWorkspaceUrl(conflict.jobId, returnTo)
                              : '/?view=dispatch';

                        return (
                            <article
                                key={conflict.id}
                                data-conflict-row="true"
                                data-attention-severity={conflict.severity}
                                data-attention-scheduled-at={
                                    conflict.scheduledAt ?? ''
                                }
                                data-attention-priority={
                                    conflict.priorityValue ?? ''
                                }
                                data-attention-id={conflict.id}
                                className="p-4 md:p-5"
                            >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="flex min-w-0 items-start gap-3.5">
                                        <div
                                            className={cn(
                                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                                                conflict.severity ===
                                                    'danger' &&
                                                    'bg-danger-soft text-danger',
                                                conflict.severity ===
                                                    'warning' &&
                                                    'bg-warning-soft text-warning-strong',
                                                conflict.severity === 'info' &&
                                                    'bg-info-soft text-info-strong',
                                            )}
                                        >
                                            <AlertTriangle
                                                className="h-5 w-5"
                                                aria-hidden="true"
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[11px] font-semibold tracking-[0.1em] text-ink-soft uppercase">
                                                    {
                                                        conflictFilterLabels[
                                                            conflictFilterForType(
                                                                conflict.type,
                                                            )
                                                        ]
                                                    }
                                                </span>
                                                <span
                                                    className={cn(
                                                        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                                        conflict.severity ===
                                                            'danger' &&
                                                            'bg-danger-soft text-danger',
                                                        conflict.severity ===
                                                            'warning' &&
                                                            'bg-warning-soft text-warning-strong',
                                                        conflict.severity ===
                                                            'info' &&
                                                            'bg-info-soft text-info-strong',
                                                    )}
                                                >
                                                    {conflictSeverityLabel(
                                                        conflict.severity,
                                                    )}
                                                </span>
                                            </div>
                                            <h4 className="mt-1 text-sm font-semibold text-ink">
                                                {conflict.title}
                                            </h4>
                                            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                                                {conflict.description}
                                            </p>
                                            <p className="mt-2 text-xs font-medium text-ink">
                                                Next action:{' '}
                                                <span className="font-normal text-ink-soft">
                                                    {conflict.actionRequired}
                                                </span>
                                            </p>
                                            <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs text-ink-soft sm:grid-cols-2 xl:grid-cols-4">
                                                {conflict.jobReference && (
                                                    <div>
                                                        <dt className="inline font-semibold text-ink">
                                                            Record:
                                                        </dt>{' '}
                                                        <dd className="inline">
                                                            {
                                                                conflict.jobReference
                                                            }
                                                            {conflict.jobTitle
                                                                ? ` · ${conflict.jobTitle}`
                                                                : ''}
                                                        </dd>
                                                    </div>
                                                )}
                                                {conflict.client && (
                                                    <div>
                                                        <dt className="inline font-semibold text-ink">
                                                            Client:
                                                        </dt>{' '}
                                                        <dd className="inline">
                                                            {conflict.client}
                                                        </dd>
                                                    </div>
                                                )}
                                                {conflict.source && (
                                                    <div>
                                                        <dt className="inline font-semibold text-ink">
                                                            Source:
                                                        </dt>{' '}
                                                        <dd className="inline">
                                                            {conflict.source}
                                                        </dd>
                                                    </div>
                                                )}
                                                {conflict.scheduledAt && (
                                                    <div>
                                                        <dt className="inline font-semibold text-ink">
                                                            Schedule:
                                                        </dt>{' '}
                                                        <dd className="inline">
                                                            {formatDateTime(
                                                                conflict.scheduledAt,
                                                            )}
                                                            {conflict.scheduledEnd
                                                                ? ` – ${formatDateTime(conflict.scheduledEnd)}`
                                                                : ''}
                                                        </dd>
                                                    </div>
                                                )}
                                                {conflict.site && (
                                                    <div>
                                                        <dt className="inline font-semibold text-ink">
                                                            Site:
                                                        </dt>{' '}
                                                        <dd className="inline">
                                                            {conflict.site}
                                                        </dd>
                                                    </div>
                                                )}
                                                {conflict.priority && (
                                                    <div>
                                                        <dt className="inline font-semibold text-ink">
                                                            Priority:
                                                        </dt>{' '}
                                                        <dd className="inline">
                                                            {conflict.priority}
                                                        </dd>
                                                    </div>
                                                )}
                                                {conflict.missingResourceTypes &&
                                                    conflict
                                                        .missingResourceTypes
                                                        .length > 0 && (
                                                        <div>
                                                            <dt className="inline font-semibold text-ink">
                                                                Missing:
                                                            </dt>{' '}
                                                            <dd className="inline">
                                                                {conflict.missingResourceTypes.join(
                                                                    ', ',
                                                                )}
                                                            </dd>
                                                        </div>
                                                    )}
                                                {conflict.assignedResources &&
                                                    conflict.assignedResources
                                                        .length > 0 && (
                                                        <div>
                                                            <dt className="inline font-semibold text-ink">
                                                                Assigned:
                                                            </dt>{' '}
                                                            <dd className="inline">
                                                                {conflict.assignedResources.join(
                                                                    ', ',
                                                                )}
                                                            </dd>
                                                        </div>
                                                    )}
                                                {conflict.freshness && (
                                                    <div>
                                                        <dt className="inline font-semibold text-ink">
                                                            Updated:
                                                        </dt>{' '}
                                                        <dd className="inline">
                                                            {formatDateTime(
                                                                conflict.freshness,
                                                            )}
                                                        </dd>
                                                    </div>
                                                )}
                                            </dl>
                                        </div>
                                    </div>

                                    <div className="flex w-full shrink-0 flex-col gap-2 lg:w-auto lg:items-end">
                                        {conflict.type === 'approval' &&
                                            conflict.approvalId &&
                                            (conflict.canDecide ? (
                                                <ApprovalConflictActions
                                                    approvalId={
                                                        conflict.approvalId
                                                    }
                                                />
                                            ) : (
                                                <p className="w-full rounded-md bg-danger-soft px-3 py-2 text-xs font-medium text-danger lg:max-w-xs">
                                                    {conflict.decisionBlocker}
                                                </p>
                                            ))}

                                        {conflict.jobId && (
                                            <Link
                                                href={actionHref}
                                                onClick={
                                                    opensWorkspace
                                                        ? (event) => {
                                                              event.preventDefault();
                                                              onOpenDispatch(
                                                                  conflict.jobId!,
                                                              );
                                                          }
                                                        : undefined
                                                }
                                                aria-label={`${actionLabel} for ${conflict.jobReference ?? conflict.title}`}
                                                className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none lg:w-auto"
                                            >
                                                {actionLabel}
                                                <ChevronRight
                                                    className="h-3.5 w-3.5"
                                                    aria-hidden="true"
                                                />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </Panel>
        </div>
    );
}

function ConflictSummaryCard({
    label,
    count,
    detail,
    tone,
}: {
    label: string;
    count: number;
    detail: string;
    tone: 'danger' | 'warning' | 'info';
}) {
    return (
        <div className="flex min-w-44 items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
            <span
                className={cn(
                    'mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full',
                    tone === 'danger' && 'bg-danger',
                    tone === 'warning' && 'bg-warning',
                    tone === 'info' && 'bg-info',
                )}
                aria-hidden="true"
            />
            <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                    <span className="text-xl font-semibold tracking-[-0.03em] text-ink">
                        {count}
                    </span>
                    <span className="text-xs font-semibold text-ink">
                        {label}
                    </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-4 text-ink-soft">
                    {detail}
                </p>
            </div>
        </div>
    );
}

function ApprovalConflictActions({ approvalId }: { approvalId: number }) {
    const form = useForm<{
        status: 'approved' | 'rejected';
        reason: string;
        approval?: string;
        version?: string;
        personnel?: string;
        assets?: string;
    }>({
        status: 'approved',
        reason: '',
    });
    const [pendingDecision, setPendingDecision] = useState<
        'approved' | 'rejected' | null
    >(null);
    const reasonId = `conflict-approval-${approvalId}-reason`;
    const errorId = `${reasonId}-error`;
    const approvalError =
        form.errors.approval ??
        form.errors.version ??
        form.errors.personnel ??
        form.errors.assets ??
        null;

    const decide = (status: 'approved' | 'rejected') => {
        form.transform((data) => ({ ...data, status }));
        form.post(`/operations/approval-requests/${approvalId}/decision`, {
            preserveScroll: true,
            onStart: () => setPendingDecision(status),
            onFinish: () => setPendingDecision(null),
        });
    };

    return (
        <div className="w-full rounded-lg border border-line bg-surface-subtle p-3 md:max-w-md md:min-w-80">
            {approvalError && (
                <div
                    className="mb-3 rounded-lg border border-danger bg-danger-soft px-3 py-3 text-xs text-danger"
                    role="alert"
                    aria-live="assertive"
                    aria-atomic="true"
                >
                    {approvalError}
                </div>
            )}
            <label
                htmlFor={reasonId}
                className="text-xs font-semibold text-ink"
            >
                Decision reason
            </label>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
                Required for approval or rejection and recorded in the audit
                history.
            </p>
            <textarea
                id={reasonId}
                value={form.data.reason}
                onChange={(event) => form.setData('reason', event.target.value)}
                rows={3}
                required
                maxLength={2000}
                aria-invalid={form.errors.reason ? 'true' : undefined}
                aria-describedby={form.errors.reason ? errorId : undefined}
                className={cn(
                    'mt-2 w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm',
                    form.errors.reason ? 'border-danger' : 'border-line-strong',
                )}
            />
            {form.errors.reason && (
                <p
                    id={errorId}
                    className="mt-1 text-xs text-danger"
                    role="alert"
                    aria-live="assertive"
                    aria-atomic="true"
                >
                    {form.errors.reason}
                </p>
            )}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    disabled={
                        form.processing || form.data.reason.trim().length === 0
                    }
                    onClick={() => decide('rejected')}
                >
                    {form.processing && pendingDecision === 'rejected'
                        ? 'Rejecting…'
                        : 'Reject request'}
                </Button>
                <Button
                    size="sm"
                    variant="primary"
                    type="button"
                    disabled={
                        form.processing || form.data.reason.trim().length === 0
                    }
                    onClick={() => decide('approved')}
                >
                    {form.processing && pendingDecision === 'approved'
                        ? 'Approving…'
                        : 'Approve request'}
                </Button>
            </div>
        </div>
    );
}

function SourceRequirementsPanel({ job }: { job: DispatchJobViewModel }) {
    const source = job.source;
    const isManual =
        !source ||
        source.type === 'direct' ||
        source.type === 'manual' ||
        Boolean(source.manual_intake);
    const isService = source?.type === 'service_request';
    const isRental = source?.type === 'rental_reservation';
    const isSale = source?.type === 'sales_order';

    // Manual direct dispatches have no upstream order requirements; provenance is already in the header & context.
    if (isManual) {
        return null;
    }

    return (
        <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-subtle px-4 py-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">
                        Source context &amp; requirements
                    </h3>
                    <DispatchSourceBadge source={source} detailed />
                </div>
            </div>

            <div className="space-y-4 p-4">
                {/* 1. SERVICE REQUEST SPECIFICS */}
                {isService && (
                    <div className="grid gap-3 text-xs sm:grid-cols-2">
                        <div className="rounded-lg border border-line bg-surface p-3">
                            <p className="text-[10px] font-semibold text-ink-soft uppercase">
                                Project &amp; Service Type
                            </p>
                            <p className="mt-1 text-sm font-semibold text-ink">
                                {source?.project_name || job.title}
                            </p>
                            <p className="mt-0.5 text-ink-soft">
                                {source?.service_type ||
                                    'General crane & transport service'}
                            </p>
                        </div>
                        <div className="rounded-lg border border-line bg-surface p-3">
                            <p className="text-[10px] font-semibold text-ink-soft uppercase">
                                Site Context &amp; Access
                            </p>
                            <p className="mt-1 font-medium text-ink">
                                {source?.location || job.site}
                            </p>
                            <p className="mt-0.5 text-ink-soft">
                                {job.site_notes ||
                                    'No access restrictions recorded.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* 3. RENTAL RESERVATION SPECIFICS */}
                {isRental && (
                    <div className="space-y-3 text-xs">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-line bg-surface p-3">
                                <p className="text-[10px] font-semibold text-ink-soft uppercase">
                                    Reservation Window
                                </p>
                                <p className="mt-1 font-semibold text-ink">
                                    {source?.start_date || 'Start TBD'} →{' '}
                                    {source?.end_date || 'End TBD'}
                                </p>
                                <p className="mt-0.5 text-ink-soft">
                                    Delivery Fulfillment Mode:{' '}
                                    {humanize(
                                        source?.fulfillment_mode || 'delivery',
                                    )}
                                </p>
                            </div>
                            <div className="rounded-lg border border-line bg-surface p-3">
                                <p className="text-[10px] font-semibold text-ink-soft uppercase">
                                    Operator Assignment Context
                                </p>
                                <p className="mt-1 font-semibold text-ink">
                                    {source?.operator_required !== false
                                        ? 'Dedicated Crane Operator Required'
                                        : 'Bare Rental / Customer Operated'}
                                </p>
                                <p className="mt-0.5 text-ink-soft">
                                    Qualified personnel must be verified before
                                    activation.
                                </p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-warning/30 bg-warning-soft/30 p-3">
                            <p className="text-[10px] font-semibold text-warning-strong uppercase">
                                Rental Condition Requirements
                            </p>
                            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-ink-soft">
                                <li>
                                    Pre-delivery mechanical &amp; safety
                                    inspection passed
                                </li>
                                <li>
                                    Fuel level verified at 100% full before
                                    release
                                </li>
                                <li>
                                    Maintenance &amp; test certificates attached
                                    to job
                                </li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* 4. SALES ORDER SPECIFICS */}
                {isSale && (
                    <div className="space-y-3 text-xs">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-line bg-surface p-3">
                                <p className="text-[10px] font-semibold text-ink-soft uppercase">
                                    Sales Delivery Destination
                                </p>
                                <p className="mt-1 font-semibold text-ink">
                                    {source?.location || job.site}
                                </p>
                                <p className="mt-0.5 font-mono text-[11px] text-ink-soft">
                                    Coordinates: 1.290270° N, 103.851959° E
                                </p>
                            </div>
                            <div className="rounded-lg border border-line bg-surface p-3">
                                <p className="text-[10px] font-semibold text-ink-soft uppercase">
                                    Order Value &amp; Fulfillment
                                </p>
                                <p className="mt-1 font-semibold text-ink">
                                    {source?.total_cents
                                        ? formatCurrency(
                                              source.total_cents / 100,
                                          )
                                        : 'Commercial Delivery'}
                                </p>
                                <p className="mt-0.5 text-ink-soft">
                                    Mode:{' '}
                                    {humanize(
                                        source?.fulfillment_mode || 'delivery',
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-success/30 bg-success-soft/30 p-3">
                            <p className="text-[10px] font-semibold text-success-strong uppercase">
                                Order Handover Checklist
                            </p>
                            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-ink-soft">
                                <li>
                                    Item packaging, serial numbers, and warranty
                                    documentation verified
                                </li>
                                <li>
                                    Client site delivery coordinates confirmed
                                    with transport team
                                </li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* Technical Requirements Checklist (all sources) */}
                {job.requirements && job.requirements.length > 0 && (
                    <div className="rounded-lg border border-line bg-surface p-3.5">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-ink">
                                Technical operational checklist
                            </h4>
                            <span className="text-[11px] font-medium text-ink-soft">
                                {job.requirements.length} item
                                {job.requirements.length === 1 ? '' : 's'}{' '}
                                required
                            </span>
                        </div>
                        <ul className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
                            {job.requirements.map((req, index) => (
                                <li
                                    key={index}
                                    className="flex items-center gap-2 rounded-md bg-surface-subtle px-2.5 py-2 text-ink"
                                >
                                    <span
                                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-strong"
                                        aria-hidden="true"
                                    />
                                    <span className="leading-tight">{req}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </Panel>
    );
}

function DispatchLifecycleStepper({
    job,
    hasApprovals,
}: {
    job: DispatchJobViewModel;
    hasApprovals: boolean;
}) {
    const personnelCount = job.personnel_assignments.length;
    const assetCount = job.asset_assignments.length;
    const totalAssigned = personnelCount + assetCount;
    const hasAssignments = totalAssigned > 0;

    const isCancelled = job.status.value === 'cancelled';
    const isCompleted = job.status.value === 'completed';
    const isFieldActive = [
        'dispatched',
        'accepted',
        'en_route',
        'arrived',
        'working',
    ].includes(job.status.value);
    const isPendingApproval = job.status.value === 'pending_approval';
    const isScheduled = job.status.value === 'scheduled';
    const isDraft = job.status.value === 'draft';
    const isPriorityOrEmergency =
        job.priority.value === 'priority' || job.priority.value === 'emergency';

    const approvalNeeded = isPriorityOrEmergency || hasApprovals;

    // Single deterministic active step index (0 to 4)
    const activeStepIndex = useMemo(() => {
        if (isCompleted) {
            return 4;
        }

        if (isFieldActive || isScheduled) {
            return 3;
        }

        if (
            isPendingApproval ||
            (isDraft && hasAssignments && approvalNeeded)
        ) {
            return 2;
        }

        if (isDraft && !hasAssignments) {
            return 1;
        }

        if (isDraft && hasAssignments && !approvalNeeded) {
            return 3;
        }

        return 1;
    }, [
        isCompleted,
        isFieldActive,
        isScheduled,
        isPendingApproval,
        isDraft,
        hasAssignments,
        approvalNeeded,
    ]);

    const assignmentsSub = useMemo(() => {
        if (personnelCount > 0 && assetCount > 0) {
            return `${personnelCount} crew · ${assetCount} asset${assetCount === 1 ? '' : 's'}`;
        }

        if (personnelCount > 0) {
            return `${personnelCount} crew assigned`;
        }

        if (assetCount > 0) {
            return `${assetCount} asset${assetCount === 1 ? '' : 's'} assigned`;
        }

        if (activeStepIndex > 1) {
            return 'Direct dispatch';
        }

        return activeStepIndex === 1
            ? 'Assign crew & fleet'
            : 'Awaiting allocation';
    }, [personnelCount, assetCount, activeStepIndex]);

    const approvalSub = useMemo(() => {
        if (!approvalNeeded) {
            return activeStepIndex > 2
                ? 'Routine · Auto-approved'
                : 'Routine · Standard';
        }

        if (isPendingApproval) {
            return 'Awaiting review';
        }

        if (activeStepIndex > 2) {
            return 'Manager approved';
        }

        return 'Required before dispatch';
    }, [approvalNeeded, isPendingApproval, activeStepIndex]);

    const currentStageLabel = useMemo(() => {
        if (isCompleted) {
            return 'Stage 5 of 5: Completed';
        }

        if (isFieldActive) {
            return `Stage 4 of 5: Live Field Progression (${job.status.label})`;
        }

        if (isScheduled) {
            return 'Stage 4 of 5: Scheduled & Ready';
        }

        if (isPendingApproval) {
            return 'Stage 3 of 5: Pending Manager Approval';
        }

        if (isDraft && hasAssignments && approvalNeeded) {
            return 'Stage 3 of 5: Manager Approval Required';
        }

        if (isDraft && hasAssignments && !approvalNeeded) {
            return 'Stage 4 of 5: Ready for Dispatch';
        }

        return 'Stage 2 of 5: Resource Allocation';
    }, [
        isCompleted,
        isFieldActive,
        isScheduled,
        isPendingApproval,
        isDraft,
        hasAssignments,
        approvalNeeded,
        job.status.label,
    ]);

    if (isCancelled) {
        return (
            <div className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger-soft/40 p-4 text-xs font-medium text-danger-strong shadow-2xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
                <span>
                    This dispatch job has been cancelled. Field execution and
                    assignment lifecycles are terminated.
                </span>
            </div>
        );
    }

    const steps = [
        {
            id: 'scope',
            label: 'Scope & Intake',
            sub: 'Job details defined',
            isDone: true,
            isCurrent: false,
            icon: FileText,
        },
        {
            id: 'assignments',
            label: 'Resource Allocation',
            sub: assignmentsSub,
            isDone: activeStepIndex > 1 || totalAssigned > 0,
            isCurrent: activeStepIndex === 1,
            icon: Users,
        },
        {
            id: 'approval',
            label: 'Approval Gate',
            sub: approvalSub,
            isDone:
                activeStepIndex > 2 ||
                (!approvalNeeded && (activeStepIndex > 1 || totalAssigned > 0)),
            isCurrent: activeStepIndex === 2,
            icon: ShieldCheck,
        },
        {
            id: 'dispatch',
            label: 'Dispatch & Field',
            sub: isCompleted
                ? 'Field execution finished'
                : isFieldActive
                  ? `Live · ${job.status.label}`
                  : isScheduled
                    ? 'Scheduled · Ready'
                    : activeStepIndex === 3
                      ? 'Ready for dispatch'
                      : 'Pending activation',
            isDone: isCompleted,
            isCurrent: activeStepIndex === 3,
            icon: Truck,
        },
        {
            id: 'completed',
            label: 'Completion',
            sub: isCompleted ? 'Finalized & closed' : 'Pending completion',
            isDone: isCompleted,
            isCurrent: activeStepIndex === 4,
            icon: CheckCircle2,
        },
    ];

    return (
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs sm:p-5">
            {/* Header with Title and Current Status */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3.5">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold tracking-wider text-ink-soft uppercase">
                        Lifecycle Progression
                    </span>
                    <span className="text-ink-muted" aria-hidden="true">
                        ·
                    </span>
                    <span className="text-xs font-semibold text-ink">
                        {currentStageLabel}
                    </span>
                </div>
                <CanonicalStatusBadge status={job.status} />
            </div>

            {/* Segmented Linear Progress Visual Track */}
            <div
                className="mt-3.5 hidden grid-cols-5 gap-1.5 sm:grid"
                aria-hidden="true"
            >
                {steps.map((step) => (
                    <div
                        key={`track-${step.id}`}
                        className={cn(
                            'h-1 rounded-full transition-all duration-300',
                            step.isDone && !step.isCurrent
                                ? 'bg-success'
                                : step.isCurrent
                                  ? 'bg-brand'
                                  : 'bg-line',
                        )}
                    />
                ))}
            </div>

            {/* Accessible Interactive Stepper */}
            <nav
                aria-label="Dispatch lifecycle progression"
                className="mt-3.5 sm:mt-3"
            >
                <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                    {steps.map((step, idx) => {
                        const Icon = step.icon;

                        return (
                            <li
                                key={step.id}
                                aria-current={
                                    step.isCurrent ? 'step' : undefined
                                }
                                className={cn(
                                    'relative flex flex-col justify-between rounded-xl border p-3.5 transition-all duration-150',
                                    step.isCurrent
                                        ? 'border-brand/40 bg-brand-soft/30 shadow-xs ring-2 ring-brand/20'
                                        : step.isDone
                                          ? 'border-line bg-surface-subtle/50 text-ink'
                                          : 'border-line/70 bg-surface/50 text-ink-soft',
                                )}
                            >
                                <span className="sr-only">
                                    {step.isDone
                                        ? 'Completed: '
                                        : step.isCurrent
                                          ? 'Current: '
                                          : 'Upcoming: '}
                                    Step {idx + 1} of 5 - {step.label}
                                </span>

                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className={cn(
                                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-transform',
                                            step.isCurrent
                                                ? 'bg-brand text-brand-contrast shadow-2xs'
                                                : step.isDone
                                                  ? 'border border-success/30 bg-success-soft text-success-strong'
                                                  : 'text-ink-muted border border-line bg-surface',
                                        )}
                                        aria-hidden="true"
                                    >
                                        {step.isDone && !step.isCurrent ? (
                                            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                        ) : (
                                            idx + 1
                                        )}
                                    </span>

                                    <div
                                        className={cn(
                                            'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                                            step.isCurrent
                                                ? 'bg-brand/15 text-brand-strong'
                                                : step.isDone
                                                  ? 'bg-success-soft/60 text-success-strong'
                                                  : 'text-ink-muted bg-surface-subtle',
                                        )}
                                        aria-hidden="true"
                                    >
                                        <Icon className="h-4 w-4 shrink-0" />
                                    </div>
                                </div>

                                <div className="mt-3 min-w-0">
                                    <p
                                        className={cn(
                                            'truncate text-xs font-semibold',
                                            step.isCurrent
                                                ? 'font-bold text-ink'
                                                : step.isDone
                                                  ? 'text-ink'
                                                  : 'text-ink-soft',
                                        )}
                                    >
                                        {step.label}
                                    </p>
                                    <p
                                        className={cn(
                                            'mt-0.5 truncate text-[11px]',
                                            step.isCurrent
                                                ? 'font-semibold text-brand-strong'
                                                : step.isDone
                                                  ? 'text-ink-soft'
                                                  : 'text-muted',
                                        )}
                                    >
                                        {step.sub}
                                    </p>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </nav>
        </div>
    );
}

function DispatchDetails({
    job,
    conflicts = [],
    recommendations = [],
    capabilities,
    returnTo,
}: {
    job: DispatchJobViewModel;
    conflicts?: DerivedConflict[];
    recommendations?: GptRecommendationViewModel[];
    capabilities: WorkspaceCapabilities;
    returnTo: string;
}) {
    const assignments = [
        ...job.personnel_assignments.map((assignment) => ({
            id: `person-${assignment.id}`,
            primary: assignment.name,
            secondary: humanize(assignment.type),
            icon: UserRound,
        })),
        ...job.asset_assignments.map((assignment) => ({
            id: `asset-${assignment.id}`,
            primary: `${assignment.code} · ${assignment.name}`,
            secondary: humanize(assignment.type),
            icon: ClipboardList,
        })),
    ];

    const scheduleDuration = useMemo(() => {
        if (!job.scheduled_start || !job.scheduled_end) {
            return null;
        }

        const start = new Date(job.scheduled_start);
        const end = new Date(job.scheduled_end);
        const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

        if (diffHours <= 0 || isNaN(diffHours)) {
            return null;
        }

        return diffHours % 1 === 0
            ? `${diffHours} hrs`
            : `${diffHours.toFixed(1)} hrs`;
    }, [job.scheduled_start, job.scheduled_end]);

    const [showEmergencyAbortModal, setShowEmergencyAbortModal] =
        useState(false);
    const [abortReason, setAbortReason] = useState('');
    const [aborting, setAborting] = useState(false);
    const [abortError, setAbortError] = useState<string | null>(null);

    const isLiveJob = [
        'dispatched',
        'accepted',
        'en_route',
        'arrived',
        'working',
    ].includes(job.status.value);
    const canEmergencyAbort = isLiveJob;

    const blockingConflicts = conflicts.filter((c) => c.severity === 'danger');
    const approvalConflicts = conflicts.filter((c) => c.type === 'approval');
    const unassignedPrereq = conflicts.find((c) => c.type === 'unassigned');

    const handleEmergencyAbort = async (e: FormEvent) => {
        e.preventDefault();
        setAborting(true);
        setAbortError(null);

        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        try {
            const response = await fetch(
                `/operations/admin/dispatch-jobs/${job.id}/emergency-abort`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify({ reason: abortReason }),
                },
            );

            const data = await response.json();

            if (!response.ok) {
                setAbortError(
                    data.message || 'Failed to force-abort dispatch.',
                );
                setAborting(false);

                return;
            }

            setShowEmergencyAbortModal(false);
            setAbortReason('');
            setAborting(false);
            router.reload();
        } catch {
            setAbortError('Network error while processing emergency abort.');
            setAborting(false);
        }
    };

    return (
        <div className="mx-auto max-w-6xl space-y-5">
            {/* Header with record identity and operational state */}
            <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-[0.08em] text-brand-strong uppercase">
                        Dispatch job
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2.5">
                        <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">
                            {job.title}
                        </h2>
                        <CanonicalStatusBadge status={job.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-semibold text-ink">
                            {job.reference}
                        </span>
                        <span className="text-ink-muted" aria-hidden="true">
                            ·
                        </span>
                        <span className="text-ink-soft">{job.client}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-ink-soft">
                            Source
                        </span>
                        <DispatchSourceBadge source={job.source} detailed />
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    <span className="text-xs font-medium text-ink-soft">
                        Priority
                    </span>
                    <CanonicalStatusBadge status={job.priority} />
                    <span
                        className="mx-1 hidden h-4 w-px bg-line sm:block"
                        aria-hidden="true"
                    />
                    <span
                        className="inline-flex min-h-7 items-center rounded-full border border-line bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-soft"
                        aria-label={'Dispatch version ' + job.version}
                    >
                        Version {job.version}
                    </span>

                    {canEmergencyAbort && (
                        <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setShowEmergencyAbortModal(true)}
                            title="Force-abort stuck or hazardous dispatch"
                        >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Emergency Abort
                        </Button>
                    )}
                </div>
            </div>

            {/* Lifecycle Progression Stepper */}
            <DispatchLifecycleStepper
                job={job}
                hasApprovals={approvalConflicts.length > 0}
            />

            {/* Emergency Abort Confirmation Modal */}
            {showEmergencyAbortModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-strong">
                                <AlertTriangle className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-ink">
                                    Emergency Force-Abort
                                </h3>
                                <p className="text-xs text-ink-soft">
                                    Job: {job.reference} ({job.title})
                                </p>
                            </div>
                        </div>

                        {abortError && (
                            <div className="mt-3 rounded-lg bg-danger-soft p-3 text-xs font-medium text-danger-strong">
                                {abortError}
                            </div>
                        )}

                        <p className="mt-3 text-xs leading-5 text-ink-soft">
                            Force-aborting immediately cancels this dispatch
                            job, releases all assigned personnel, and returns
                            all assigned crane & fleet assets to{' '}
                            <strong>Available</strong> status.
                        </p>

                        <form
                            onSubmit={handleEmergencyAbort}
                            className="mt-4 space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Mandatory Operational Justification *
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    minLength={6}
                                    value={abortReason}
                                    onChange={(e) =>
                                        setAbortReason(e.target.value)
                                    }
                                    placeholder="Explain why this dispatch is being force-aborted (e.g. Hazardous weather, mechanical breakdown, site closure)…"
                                    className="mt-1 w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink placeholder:text-ink-soft focus:border-danger focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 border-t border-line pt-2">
                                <Button
                                    variant="quiet"
                                    onClick={() =>
                                        setShowEmergencyAbortModal(false)
                                    }
                                    disabled={aborting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    type="submit"
                                    disabled={aborting}
                                >
                                    {aborting
                                        ? 'Aborting…'
                                        : 'Confirm Force-Abort'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Operational Conflict Alert Banner (Hard Blocking Conflicts) */}
            {blockingConflicts.length > 0 && (
                <div
                    className="flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                    role="alert"
                >
                    <div className="flex items-start gap-3">
                        <AlertTriangle
                            className="mt-0.5 h-5 w-5 shrink-0 text-danger"
                            aria-hidden="true"
                        />
                        <div>
                            <h3 className="font-semibold text-danger">
                                {blockingConflicts.length} active operational{' '}
                                {blockingConflicts.length === 1
                                    ? 'conflict'
                                    : 'conflicts'}{' '}
                                on this job
                            </h3>
                            <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
                                {blockingConflicts.map((c) => (
                                    <li key={c.id}>• {c.description}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <Link
                        href={assignmentWorkspaceUrl(job.id, returnTo)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-danger/40 bg-surface px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-soft"
                    >
                        Resolve in assignment workspace
                        <ChevronRight
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                        />
                    </Link>
                </div>
            )}

            {/* Pending Manager Approval Notice */}
            {approvalConflicts.length > 0 && (
                <div
                    className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                    role="status"
                >
                    <div className="flex items-start gap-3">
                        <Clock
                            className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong"
                            aria-hidden="true"
                        />
                        <div>
                            <h3 className="font-semibold text-warning-strong">
                                Pending Manager Approval
                            </h3>
                            <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
                                {approvalConflicts.map((c) => (
                                    <li key={c.id}>• {c.description}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <Link
                        href="/?view=approvals"
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-warning/50 bg-surface px-3 py-1.5 text-xs font-semibold text-warning-strong hover:bg-warning-soft"
                    >
                        Review approvals
                        <ChevronRight
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                        />
                    </Link>
                </div>
            )}

            {/* Actionable Setup Guidance (Prerequisite on Drafts) */}
            {unassignedPrereq && blockingConflicts.length === 0 && (
                <div className="flex flex-col gap-3 rounded-lg border border-brand/25 bg-brand-soft/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <ClipboardList
                            className="mt-0.5 h-5 w-5 shrink-0 text-brand-strong"
                            aria-hidden="true"
                        />
                        <div>
                            <h3 className="font-semibold text-ink">
                                Prerequisite: Resource assignment needed
                            </h3>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                Assign qualified drivers, crane operators, and
                                operational assets to prepare this draft for
                                dispatch.
                            </p>
                        </div>
                    </div>
                    <Link
                        href={assignmentWorkspaceUrl(job.id, returnTo)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-ink shadow-xs hover:bg-brand-strong hover:text-white"
                    >
                        Assign resources
                        <ChevronRight
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                        />
                    </Link>
                </div>
            )}

            {/* 2-Column Responsive Operational Layout */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
                {/* Left Column: Primary Operational Data */}
                <div className="space-y-5">
                    {/* Dispatch Logistics & Schedule */}
                    <Panel className="p-4">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <h3 className="font-semibold text-ink">
                                Dispatch context
                            </h3>
                            <span className="text-xs text-ink-soft">
                                Last updated: {formatDateTime(job.updated_at)}
                            </span>
                        </div>
                        <dl className="mt-3 divide-y divide-line">
                            <DataPair
                                label="Source"
                                value={
                                    job.source ? (
                                        <span className="inline-flex flex-wrap items-center gap-2">
                                            <DispatchSourceBadge
                                                source={job.source}
                                                detailed
                                            />
                                            {job.source.status && (
                                                <span className="text-xs text-ink-soft">
                                                    {job.source.status.label}
                                                </span>
                                            )}
                                        </span>
                                    ) : (
                                        'Direct dispatch'
                                    )
                                }
                            />
                            {job.source?.fulfillment_mode && (
                                <DataPair
                                    label="Fulfillment"
                                    value={humanize(
                                        job.source.fulfillment_mode,
                                    )}
                                />
                            )}
                            <DataPair
                                label="Schedule"
                                value={
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span>
                                            {formatDateTime(
                                                job.scheduled_start,
                                            )}{' '}
                                            –{' '}
                                            {formatDateTime(job.scheduled_end)}
                                        </span>
                                        {scheduleDuration && (
                                            <span className="inline-flex items-center gap-1 rounded bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand-strong">
                                                <Clock
                                                    className="h-3 w-3"
                                                    aria-hidden="true"
                                                />
                                                {scheduleDuration}
                                            </span>
                                        )}
                                    </div>
                                }
                            />
                            <DataPair
                                label="Site"
                                value={
                                    <span className="inline-flex items-start gap-2">
                                        <MapPin
                                            className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong"
                                            aria-hidden="true"
                                        />
                                        {job.site}
                                    </span>
                                }
                            />
                            {job.requirements &&
                                job.requirements.length > 0 && (
                                    <DataPair
                                        label="Requirements"
                                        value={
                                            <div className="flex flex-wrap gap-1.5">
                                                {job.requirements.map(
                                                    (req, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="inline-flex items-center rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink"
                                                        >
                                                            {req}
                                                        </span>
                                                    ),
                                                )}
                                            </div>
                                        }
                                    />
                                )}
                        </dl>
                        {job.site_notes?.trim() && (
                            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-line bg-surface-subtle p-3 text-xs">
                                <ClipboardList
                                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong"
                                    aria-hidden="true"
                                />
                                <div>
                                    <p className="font-semibold text-ink">
                                        Site Instructions
                                    </p>
                                    <p className="mt-0.5 leading-relaxed whitespace-pre-line text-ink-soft">
                                        {job.site_notes.trim()}
                                    </p>
                                </div>
                            </div>
                        )}
                    </Panel>

                    {/* Assigned Resources Panel */}
                    <Panel className="overflow-hidden">
                        <div className="flex items-center justify-between border-b border-line bg-surface-subtle px-4 py-3">
                            <div>
                                <h3 className="font-semibold text-ink">
                                    Assigned resources
                                </h3>
                                <p className="mt-0.5 text-xs text-ink-soft">
                                    Current server-backed personnel and assets
                                </p>
                            </div>
                            {assignments.length > 0 && (
                                <Link
                                    href={assignmentWorkspaceUrl(
                                        job.id,
                                        returnTo,
                                    )}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline"
                                >
                                    Manage assignments →
                                </Link>
                            )}
                        </div>
                        {assignments.length === 0 ? (
                            <div className="p-6 text-center">
                                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-subtle text-ink-soft">
                                    <UserRound className="h-5 w-5" />
                                </div>
                                <p className="mt-2 text-sm font-semibold text-ink">
                                    No resources assigned
                                </p>
                                <p className="mt-1 text-xs text-ink-soft">
                                    {conflicts.length > 0
                                        ? 'Use Assign resources above to choose qualified personnel and assets.'
                                        : 'Assignments will appear after the authorized scheduling workflow completes.'}
                                </p>
                                {conflicts.length === 0 && (
                                    <Link
                                        href={assignmentWorkspaceUrl(
                                            job.id,
                                            returnTo,
                                        )}
                                        className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-2xs hover:bg-surface-subtle"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Assign resources
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <ul className="divide-y divide-line">
                                {assignments.map((assignment) => {
                                    const Icon = assignment.icon;

                                    return (
                                        <li
                                            key={assignment.id}
                                            className="flex items-center justify-between gap-3 px-4 py-3"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft">
                                                    <Icon
                                                        className="h-4 w-4"
                                                        aria-hidden="true"
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-ink">
                                                        {assignment.primary}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-ink-soft">
                                                        {assignment.secondary}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="inline-flex items-center rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-semibold text-success-strong">
                                                Assigned
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>

                    {/* Source Requirements */}
                    <SourceRequirementsPanel job={job} />
                </div>

                {/* Right Column: AI Advisory & Guidance */}
                <div className="space-y-5">
                    <DispatchGptAdvisory
                        job={job}
                        recommendations={recommendations}
                        capabilities={capabilities}
                    />

                    <div className="flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-xs text-ink-soft">
                        <CalendarDays
                            className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong"
                            aria-hidden="true"
                        />
                        <p className="leading-5">
                            Open the assignment workspace to review
                            server-authoritative availability, credentials,
                            maintenance blocks, readiness, and schedule
                            conflicts before confirming resources.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DispatchSourceBadge({
    source,
    detailed = false,
    className,
}: {
    source: DispatchSourceViewModel | null | undefined;
    detailed?: boolean;
    className?: string;
}) {
    const isManual =
        source?.type === 'manual' ||
        source?.provenance_indicator === 'manual_intake' ||
        Boolean(source?.manual_intake);

    if (!source || source.type === 'direct' || isManual) {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-1 rounded-full border border-line bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-ink-soft',
                    className,
                )}
                title="Direct operational intake"
            >
                <span className="bg-ink-muted h-1.5 w-1.5 rounded-full" />
                <span>
                    {isManual
                        ? 'Manual source · manual_intake'
                        : 'Direct intake'}
                </span>
            </span>
        );
    }

    const isRental = source.type === 'rental_reservation';
    const isSale = source.type === 'sales_order';

    const tone = isRental
        ? 'border-warning/30 bg-warning-soft text-warning-strong'
        : isSale
          ? 'border-success/30 bg-success-soft text-success-strong'
          : 'border-brand/30 bg-brand-soft text-brand-strong';

    const label = isRental ? 'Rental' : isSale ? 'Sale' : 'Service';

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                tone,
                className,
            )}
        >
            <span>{label}</span>
            {detailed && source.reference ? ` · ${source.reference}` : ''}
        </span>
    );
}

function DispatchGptAdvisory({
    job,
    recommendations,
    capabilities,
}: {
    job: DispatchJobViewModel;
    recommendations: GptRecommendationViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const { auth } = usePage<{ auth?: Auth }>().props;
    const isAdmin =
        auth?.role === 'system_administrator' ||
        auth?.role === 'admin' ||
        auth?.prototype_role === 'system_administrator';

    const [selectedForAccept, setSelectedForAccept] =
        useState<GptRecommendationViewModel | null>(null);
    const [selectedForReject, setSelectedForReject] =
        useState<GptRecommendationViewModel | null>(null);
    const [requesting, setRequesting] = useState(false);
    const [retryingId, setRetryingId] = useState<number | null>(null);
    const activeRecommendations = recommendations.filter(
        (recommendation) =>
            ['draft', 'processing'].includes(recommendation.status) ||
            (recommendation.status === 'pending_review' &&
                !recommendation.is_expired),
    );
    const visibleRecommendations =
        activeRecommendations.length > 0
            ? activeRecommendations
            : recommendations.slice(0, 1);

    const requestRecommendation = () => {
        setRequesting(true);
        router.post(
            '/operations/gpt-recommendations',
            {
                subject_type: 'dispatch_job',
                subject_id: job.id,
                purpose: 'dispatch_assignment',
            },
            {
                preserveScroll: true,
                onFinish: () => setRequesting(false),
            },
        );
    };

    return (
        <section
            className="rounded-lg border border-line bg-surface p-4"
            aria-labelledby={`dispatch-gpt-advisory-${job.id}`}
        >
            <div className="flex flex-col gap-2 border-b border-line pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h3
                        id={`dispatch-gpt-advisory-${job.id}`}
                        className="flex items-center gap-2 text-sm font-semibold text-ink"
                    >
                        <Sparkles
                            className="h-4 w-4 text-brand-strong"
                            aria-hidden="true"
                        />
                        GPT dispatch advisory
                    </h3>
                    <p className="mt-0.5 text-xs text-ink-soft">
                        Explainable resource guidance (requires human
                        confirmation).
                    </p>
                </div>

                {(isAdmin || capabilities.request_gpt_assistance) && (
                    <Link
                        href="/?view=gpt-recommendations"
                        className="inline-flex min-h-8 items-center rounded-lg px-2 text-xs font-medium text-brand-strong hover:bg-brand-soft"
                    >
                        View full advisory
                    </Link>
                )}
            </div>

            {visibleRecommendations.length === 0 ? (
                <div className="mt-3 rounded-lg bg-surface-subtle p-5 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                        <Sparkles className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h4 className="mt-2 text-sm font-semibold text-ink">
                        No AI proposal generated
                    </h4>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-ink-soft">
                        Request automated assistance to analyze qualified
                        operators, crane capacity match, and conflict-free
                        schedules.
                    </p>
                    {capabilities.request_gpt_assistance && (
                        <Button
                            size="sm"
                            variant="primary"
                            className="mt-3"
                            onClick={requestRecommendation}
                            disabled={requesting}
                        >
                            <Sparkles
                                className="mr-1.5 h-3.5 w-3.5"
                                aria-hidden="true"
                            />
                            {requesting
                                ? 'Evaluating fleet…'
                                : 'Suggest crew & equipment'}
                        </Button>
                    )}
                </div>
            ) : (
                <div className="mt-3 space-y-4">
                    {visibleRecommendations.map((recommendation) => {
                        const reviewable =
                            recommendation.status === 'pending_review' &&
                            !recommendation.is_expired;
                        const personnel =
                            recommendation.proposed_personnel ?? [];
                        const assets = recommendation.proposed_assets ?? [];

                        return (
                            <div
                                key={recommendation.id}
                                className={cn(
                                    'space-y-3',
                                    recommendation.is_expired && 'opacity-90',
                                )}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-ink">
                                            Recommendation #{recommendation.id}
                                        </p>
                                        <span
                                            className={cn(
                                                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                                                gptRecommendationStatusClass(
                                                    recommendation,
                                                ),
                                            )}
                                        >
                                            {gptRecommendationStatusLabel(
                                                recommendation,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-ink-soft">
                                        <Clock
                                            className="h-3.5 w-3.5"
                                            aria-hidden="true"
                                        />
                                        {recommendation.is_expired
                                            ? 'Expired'
                                            : recommendation.expires_in_seconds
                                              ? `${Math.ceil(recommendation.expires_in_seconds / 60)}m left`
                                              : 'No expiry window'}
                                    </div>
                                </div>

                                {/* Expired Advisory Explanation Banner */}
                                {recommendation.is_expired && (
                                    <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft/30 p-2.5 text-xs">
                                        <Clock
                                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-strong"
                                            aria-hidden="true"
                                        />
                                        <p className="leading-relaxed text-ink-soft">
                                            <span className="font-semibold text-warning-strong">
                                                Proposal Expired:
                                            </span>{' '}
                                            Fleet availability and operator
                                            schedules may have shifted since
                                            this was synthesized. Re-evaluate
                                            live availability to update
                                            suggestions.
                                        </p>
                                    </div>
                                )}

                                {recommendation.response_summary && (
                                    <p className="text-xs leading-relaxed text-ink">
                                        {recommendation.response_summary}
                                    </p>
                                )}

                                {/* Proposed Resources Plan */}
                                {personnel.length > 0 || assets.length > 0 ? (
                                    <div className="space-y-2 rounded-lg border border-line bg-surface-subtle p-3 text-xs">
                                        <p className="font-semibold text-ink">
                                            Proposed Resource Plan
                                        </p>
                                        {personnel.length > 0 && (
                                            <div className="flex items-start gap-2">
                                                <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-strong" />
                                                <div className="min-w-0">
                                                    <span className="font-medium text-ink">
                                                        Personnel:{' '}
                                                    </span>
                                                    <span className="text-ink-soft">
                                                        {personnel
                                                            .map(
                                                                (person) =>
                                                                    `${person.name || `User #${person.user_id}`} (${person.assignment_type})`,
                                                            )
                                                            .join(', ')}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {assets.length > 0 && (
                                            <div className="flex items-start gap-2">
                                                <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-strong" />
                                                <div className="min-w-0">
                                                    <span className="font-medium text-ink">
                                                        Assets:{' '}
                                                    </span>
                                                    <span className="text-ink-soft">
                                                        {assets
                                                            .map(
                                                                (asset) =>
                                                                    `${asset.name || asset.asset_code || `Asset #${asset.operational_asset_id}`} (${asset.assignment_type})`,
                                                            )
                                                            .join(', ')}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-line bg-surface-subtle/50 px-3 py-2 text-xs text-ink-soft">
                                        <span className="font-medium text-ink">
                                            Resource Plan:
                                        </span>{' '}
                                        No specific personnel or equipment were
                                        attached in this proposal draft.
                                    </div>
                                )}

                                {recommendation.conflicts.length > 0 && (
                                    <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger-strong">
                                        <AlertTriangle
                                            className="mt-0.5 h-4 w-4 shrink-0"
                                            aria-hidden="true"
                                        />
                                        <div>
                                            <p className="font-semibold">
                                                Constraint notes
                                            </p>
                                            <ul className="mt-1 list-disc space-y-0.5 pl-4">
                                                {recommendation.conflicts.map(
                                                    (conflict, index) => (
                                                        <li key={index}>
                                                            {String(
                                                                conflict.reason ??
                                                                    conflict.message ??
                                                                    'Constraint note',
                                                            )}
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                <RecommendationDetails rec={recommendation} />

                                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                                    {isAdmin ? (
                                        <p className="text-xs text-ink-soft">
                                            Requested by{' '}
                                            <span className="font-medium text-ink">
                                                {
                                                    recommendation.requested_by
                                                        .name
                                                }
                                            </span>
                                        </p>
                                    ) : (
                                        <span />
                                    )}
                                    <div className="flex flex-wrap items-center gap-2">
                                        {reviewable &&
                                            capabilities.decide_gpt_recommendation && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() =>
                                                            setSelectedForReject(
                                                                recommendation,
                                                            )
                                                        }
                                                    >
                                                        Reject recommendation
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        onClick={() =>
                                                            setSelectedForAccept(
                                                                recommendation,
                                                            )
                                                        }
                                                    >
                                                        Accept recommendation
                                                    </Button>
                                                </>
                                            )}
                                        {recommendation.is_retryable &&
                                            capabilities.retry_gpt_recommendation && (
                                                <Button
                                                    size="sm"
                                                    variant={
                                                        recommendation.is_expired
                                                            ? 'primary'
                                                            : 'secondary'
                                                    }
                                                    disabled={
                                                        retryingId ===
                                                        recommendation.id
                                                    }
                                                    onClick={() => {
                                                        setRetryingId(
                                                            recommendation.id,
                                                        );
                                                        router.post(
                                                            recommendation.retry_url,
                                                            {},
                                                            {
                                                                preserveScroll: true,
                                                                onFinish: () =>
                                                                    setRetryingId(
                                                                        null,
                                                                    ),
                                                            },
                                                        );
                                                    }}
                                                >
                                                    <RefreshCw
                                                        className={cn(
                                                            'mr-1.5 h-3.5 w-3.5',
                                                            retryingId ===
                                                                recommendation.id &&
                                                                'animate-spin',
                                                        )}
                                                        aria-hidden="true"
                                                    />
                                                    {retryingId ===
                                                    recommendation.id
                                                        ? 'Re-evaluating…'
                                                        : 'Retry recommendation'}
                                                </Button>
                                            )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedForAccept && (
                <AcceptGptModal
                    rec={selectedForAccept}
                    onClose={() => setSelectedForAccept(null)}
                />
            )}
            {selectedForReject && (
                <RejectGptModal
                    rec={selectedForReject}
                    onClose={() => setSelectedForReject(null)}
                />
            )}
        </section>
    );
}

function gptRecommendationStatusLabel(
    recommendation: GptRecommendationViewModel,
): string {
    if (recommendation.is_expired) {
        return 'Expired';
    }

    return (
        {
            accepted: 'Accepted',
            rejected: 'Rejected',
            stale: 'Stale context',
            failed: 'Generation failed',
            processing: 'Processing',
            draft: 'Queued',
            pending_review: 'Pending human review',
        }[recommendation.status] ?? recommendation.status
    );
}

function gptRecommendationStatusClass(
    recommendation: GptRecommendationViewModel,
): string {
    if (
        recommendation.is_expired ||
        ['stale', 'rejected', 'failed'].includes(recommendation.status)
    ) {
        return 'bg-warning-soft text-warning-strong';
    }

    if (recommendation.status === 'accepted') {
        return 'bg-success-soft text-success-strong';
    }

    if (recommendation.status === 'pending_review') {
        return 'bg-warning-soft text-warning-strong';
    }

    return 'bg-cobalt-50 text-cobalt-700';
}

function DispatchListSkeleton() {
    return (
        <div
            className="space-y-px"
            role="status"
            aria-label="Loading dispatch jobs"
        >
            {[1, 2, 3, 4].map((item) => (
                <div key={item} className="border-b border-line px-4 py-4">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="mt-2.5 h-3.5 w-44" />
                    <Skeleton className="mt-2 h-3 w-32" />
                </div>
            ))}
        </div>
    );
}

function startOfLocalWeek(value: string): Date {
    const date = dateFromLocalKey(value);
    const day = date.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + offset);

    return date;
}

function formatBoardWeek(value: string): string {
    const start = startOfLocalWeek(value);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startLabel = new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
    }).format(start);
    const endLabel = new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(end);

    return `${startLabel} – ${endLabel}`;
}

function formatBoardMonth(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        month: 'long',
        year: 'numeric',
    }).format(dateFromLocalKey(value));
}

function formatBoardDate(value: string): string {
    const label = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(dateFromLocalKey(value));

    return value === localDateKey(new Date()) ? `Today · ${label}` : label;
}

const DEFAULT_BOARD_START_HOUR = 7;
const DEFAULT_BOARD_END_HOUR = 18; // 11 slots: 7 AM through 5 PM (covers up to 18:00)

interface BoardTimeWindow {
    startHour: number;
    endHour: number;
    totalSlots: number;
    hours: number[];
    isExpanded: boolean;
    label: string;
}

function formatHourLabel(h: number): string {
    const normalized = ((h % 24) + 24) % 24;

    if (normalized === 0) {
        return '12 AM';
    }

    if (normalized === 12) {
        return '12 PM';
    }

    if (normalized > 12) {
        return `${normalized - 12} PM`;
    }

    return `${normalized} AM`;
}

function calculateBoardTimeWindow(
    jobs: DispatchJobViewModel[],
    selectedDate: string,
): BoardTimeWindow {
    let earliestStart = DEFAULT_BOARD_START_HOUR;
    let latestEnd = DEFAULT_BOARD_END_HOUR;

    const date = dateFromLocalKey(selectedDate);
    const dayStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0,
        0,
        0,
    );
    const dayEnd = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1,
        0,
        0,
        0,
    );

    for (const job of jobs) {
        if (!job.scheduled_start || !job.scheduled_end) {
            continue;
        }

        const start = new Date(job.scheduled_start);
        const end = new Date(job.scheduled_end);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            end <= start
        ) {
            continue;
        }

        // Check if job intersects the selected calendar day
        if (start < dayEnd && end > dayStart) {
            const visibleStart = new Date(
                Math.max(start.getTime(), dayStart.getTime()),
            );
            const visibleEnd = new Date(
                Math.min(end.getTime(), dayEnd.getTime()),
            );

            const startHour =
                visibleStart.getHours() + visibleStart.getMinutes() / 60;
            const endHour =
                visibleEnd.getTime() === dayEnd.getTime()
                    ? 24
                    : visibleEnd.getHours() + visibleEnd.getMinutes() / 60;

            const floorStart = Math.floor(startHour);
            const ceilEnd = Math.ceil(endHour);

            if (floorStart < earliestStart) {
                earliestStart = Math.max(0, floorStart);
            }

            if (ceilEnd > latestEnd) {
                latestEnd = Math.min(24, ceilEnd);
            }
        }
    }

    const startHour = Math.max(
        0,
        Math.min(earliestStart, DEFAULT_BOARD_START_HOUR),
    );
    const endHour = Math.min(24, Math.max(latestEnd, DEFAULT_BOARD_END_HOUR));
    const totalSlots = Math.max(1, endHour - startHour);
    const hours = Array.from({ length: totalSlots }, (_, i) => startHour + i);
    const isExpanded =
        startHour < DEFAULT_BOARD_START_HOUR ||
        endHour > DEFAULT_BOARD_END_HOUR;

    const label = `${formatHourLabel(startHour)} – ${formatHourLabel(endHour)}`;

    return {
        startHour,
        endHour,
        totalSlots,
        hours,
        isExpanded,
        label,
    };
}

function localDayWindow(value: string) {
    const date = dateFromLocalKey(value);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    return {
        start,
        end: new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate() + 1,
        ),
        boardStart: new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
            DEFAULT_BOARD_START_HOUR,
        ),
        boardEnd: new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
            DEFAULT_BOARD_END_HOUR,
        ),
    };
}

function jobOverlapsLocalDate(
    job: DispatchJobViewModel,
    selectedDate: string,
): boolean {
    if (!job.scheduled_start || !job.scheduled_end) {
        return false;
    }

    const start = new Date(job.scheduled_start);
    const end = new Date(job.scheduled_end);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return false;
    }

    const { start: dayStart, end: dayEnd } = localDayWindow(selectedDate);

    return start < dayEnd && end > dayStart;
}

function calculateTimeSpan(
    startIso: string | null,
    endIso: string | null,
    selectedDate: string,
    boardStartHour: number = DEFAULT_BOARD_START_HOUR,
    boardEndHour: number = DEFAULT_BOARD_END_HOUR,
    totalSlots?: number,
) {
    if (!startIso || !endIso) {
        return null;
    }

    const start = new Date(startIso);
    const end = new Date(endIso);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
    ) {
        return null;
    }

    const date = dateFromLocalKey(selectedDate);
    const boardStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        boardStartHour,
        0,
        0,
    );
    const boardEnd =
        boardEndHour === 24
            ? new Date(
                  date.getFullYear(),
                  date.getMonth(),
                  date.getDate() + 1,
                  0,
                  0,
                  0,
              )
            : new Date(
                  date.getFullYear(),
                  date.getMonth(),
                  date.getDate(),
                  boardEndHour,
                  0,
                  0,
              );

    const visibleStart = new Date(
        Math.max(start.getTime(), boardStart.getTime()),
    );
    const visibleEnd = new Date(Math.min(end.getTime(), boardEnd.getTime()));

    if (visibleEnd <= visibleStart) {
        return null;
    }

    const startHour = visibleStart.getHours() + visibleStart.getMinutes() / 60;
    const endHour =
        visibleEnd.getTime() === boardEnd.getTime() && boardEndHour === 24
            ? 24
            : visibleEnd.getHours() + visibleEnd.getMinutes() / 60;

    const slots = totalSlots ?? Math.max(1, boardEndHour - boardStartHour);

    let startCol = Math.max(1, Math.floor(startHour - boardStartHour) + 1);
    let endCol = Math.min(slots + 1, Math.ceil(endHour - boardStartHour) + 1);

    if (startCol > slots) {
        startCol = slots;
    }

    if (endCol <= startCol) {
        endCol = startCol + 1;
    }

    const colSpan = Math.max(1, endCol - startCol);

    return { startCol, colSpan };
}

function isOverlapping(
    s1: string | null,
    e1: string | null,
    s2: string | null,
    e2: string | null,
): boolean {
    if (!s1 || !e1 || !s2 || !e2) {
        return false;
    }

    const start1 = new Date(s1).getTime();
    const end1 = new Date(e1).getTime();
    const start2 = new Date(s2).getTime();
    const end2 = new Date(e2).getTime();

    return start1 < end2 && start2 < end1;
}

function assignmentWorkspaceUrl(jobId: number, returnTo: string) {
    const query = new URLSearchParams({ return_to: returnTo }).toString();

    return `/operations/dispatch-jobs/${jobId}?${query}`;
}
