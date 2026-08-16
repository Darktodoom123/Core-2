import { Link, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock,
    ClipboardList,
    MapPin,
    Plus,
    RefreshCw,
    Search,
    SearchX,
    ShieldCheck,
    Sparkles,
    Truck,
    User,
    UserRound,
    X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Button,
    DataPair,
    EmptyState,
    PageHeading,
    Panel,
    Skeleton,
} from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import {
    AcceptGptModal,
    RecommendationDetails,
    RejectGptModal,
} from '@/components/workspace/gpt-workspace-section';
import { LiveDispatchIntake } from '@/components/workspace/live-dispatch-intake';
import { ScheduleBoardMonthView } from '@/components/workspace/schedule-board-month-view';
import { ScheduleBoardWeekView } from '@/components/workspace/schedule-board-week-view';
import { localDateKey } from '@/lib/date-utils';
import { formatCurrency, formatDateTime, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    ApprovalViewModel,
    AssetViewModel,
    ClientViewModel,
    DispatchJobViewModel,
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
    | 'unassigned';

interface DerivedConflict {
    id: string;
    type: 'overlap' | 'maintenance' | 'approval' | 'response' | 'unassigned';
    severity: 'danger' | 'warning' | 'info';
    title: string;
    description: string;
    actionRequired: string;
    jobId?: number;
    jobReference?: string;
    approvalId?: number;
    canDecide?: boolean;
    decisionBlocker?: string | null;
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
    const { url: currentWorkspaceUrl } = usePage();
    const returnTo = currentWorkspaceUrl || '/?view=dispatch';
    const [query, setQuery] = useState('');
    const [sourceFilter, setSourceFilter] = useState<
        | 'all'
        | 'service_request'
        | 'rental_reservation'
        | 'sales_order'
        | 'manual'
    >('all');
    const [selectedJobId, setSelectedJobId] = useState<number | null>(
        jobs[0]?.id ?? null,
    );
    const incomingHandoffKey = useMemo(
        () =>
            [
                initialServiceRequestId
                    ? `service:${initialServiceRequestId}`
                    : null,
                ...serviceRequests
                    .filter((request) => request.dispatch_jobs_count === 0)
                    .map((request) => `service:${request.id}`),
                ...rentalHandoffs
                    .filter((handoff) => !handoff.dispatch_job_id)
                    .map((handoff) => `rental:${handoff.id}`),
                ...salesHandoffs
                    .filter((handoff) => !handoff.dispatch_job_id)
                    .map((handoff) => `sale:${handoff.id}`),
            ]
                .filter(Boolean)
                .filter(
                    (value, index, values) => values.indexOf(value) === index,
                )
                .sort()
                .join('|'),
        [
            initialServiceRequestId,
            rentalHandoffs,
            salesHandoffs,
            serviceRequests,
        ],
    );
    const incomingWorkCount = incomingHandoffKey
        ? incomingHandoffKey.split('|').length
        : 0;
    const [showIntake, setShowIntake] = useState(
        Boolean(initialServiceRequestId),
    );
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

    useEffect(() => {
        if (!showIntake) {
            return;
        }

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowIntake(false);
            }
        };

        document.addEventListener('keydown', closeOnEscape);

        return () => document.removeEventListener('keydown', closeOnEscape);
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

    const fieldMode = capabilities.update_assigned_dispatch_status;

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
                    description: `Exceptional request for ${approval.subject.reference} (${approval.subject.title ?? 'Dispatch'}) submitted by ${approval.requester.name}.`,
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
                    severity: 'info',
                    title: 'Missing Resource Assignments',
                    description: `Job ${job.reference} (${job.title}) has no personnel or assets assigned yet.`,
                    actionRequired: `Open assignment workspace to select qualified candidates.`,
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
                    type: 'unassigned',
                    severity: 'info',
                    title: 'GPT Recommendation Advisory Note',
                    description: `AI dispatch recommendation #${rec.id} reported ${rec.conflicts.length} potential constraint note(s).`,
                    actionRequired:
                        'Review advisory recommendation notes in dispatch workflow.',
                    jobId: rec.subject_id,
                });
            }
        }

        return conflicts;
    }, [jobs, assets, approvals, gptRecommendations]);

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
            const matchesQuery =
                normalized === '' ||
                `${job.reference} ${job.client} ${job.title} ${job.site} ${job.source?.reference ?? ''}`
                    .toLowerCase()
                    .includes(normalized);

            return matchesSource && matchesQuery;
        });
    }, [jobs, query, sourceFilter]);

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
        <div>
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
                                className="inline-flex rounded-lg border border-line bg-surface p-1"
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
                                            ? 'bg-brand text-ink shadow-xs'
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
                                            ? 'bg-brand text-ink shadow-xs'
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
                                            ? 'bg-brand text-ink shadow-xs'
                                            : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    <AlertTriangle
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                    Conflicts
                                    {derivedConflicts.length > 0 && (
                                        <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                                            {derivedConflicts.length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        )}

                        {canCreate && !fieldMode && (
                            <Button
                                variant={showIntake ? 'secondary' : 'primary'}
                                onClick={() => setShowIntake((value) => !value)}
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
                            onClose={() => setShowIntake(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* VIEW MODE: BOARD */}
            {viewMode === 'board' && !fieldMode && (
                <section
                    className="p-4 md:p-6"
                    aria-label="Schedule board section"
                >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
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
                                className="flex min-h-11 items-center gap-1"
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
                                            'inline-flex min-h-11 items-center justify-center rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
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
                                    className="h-11 w-64 rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-xs placeholder:text-ink-soft"
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
                                            'inline-flex min-h-11 items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
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

                        <div className="flex items-center gap-2">
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
                            users={users}
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
                    className="p-4 md:p-6"
                    aria-label="Conflict review section"
                >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                        <div>
                            <h2 className="text-lg font-semibold tracking-[-0.02em]">
                                Operational conflict review
                            </h2>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                Server-derived schedule overlaps, maintenance
                                blockers, and required manager approvals.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
                            {(
                                [
                                    'all',
                                    'overlaps',
                                    'maintenance',
                                    'approvals',
                                    'responses',
                                    'unassigned',
                                ] as ConflictTypeFilter[]
                            ).map((filter) => (
                                <button
                                    key={filter}
                                    type="button"
                                    onClick={() => setConflictFilter(filter)}
                                    className={cn(
                                        'inline-flex min-h-11 items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                                        conflictFilter === filter
                                            ? 'bg-brand-soft font-semibold text-brand-strong'
                                            : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>

                    <ConflictReviewList
                        conflicts={derivedConflicts}
                        filter={conflictFilter}
                        returnTo={returnTo}
                    />
                </section>
            )}

            {/* VIEW MODE: LIST (DEFAULT) */}
            {(viewMode === 'list' || fieldMode) && (
                <div
                    className={cn(
                        'min-h-[calc(100vh-9rem)]',
                        !fieldMode &&
                            'grid lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]',
                    )}
                >
                    <aside
                        className={cn(
                            'border-b border-line bg-surface',
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
                                        className="h-10 w-full rounded-lg border border-line-strong bg-surface-subtle px-3 text-xs font-medium text-ink"
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
                                            Manual intake (manual_intake)
                                        </option>
                                    </select>
                                </label>
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

                        {refreshing ? (
                            <DispatchListSkeleton />
                        ) : filteredJobs.length === 0 ? (
                            query.trim() === '' && sourceFilter === 'all' ? (
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
                                    message="Try another reference, client, site, or operational source."
                                    primaryAction={
                                        <Button
                                            variant="secondary"
                                            onClick={() => {
                                                setQuery('');
                                                setSourceFilter('all');
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
                                    const hasConflict = jobConflicts.length > 0;

                                    return (
                                        <li key={job.id}>
                                            {fieldMode && (
                                                <Link
                                                    href={`/operations/dispatch-jobs/${job.id}`}
                                                    className="flex min-h-24 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex min-w-0 items-center gap-1.5">
                                                                <p className="font-semibold">
                                                                    {
                                                                        job.reference
                                                                    }
                                                                </p>
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
                                                                    job.priority
                                                                }
                                                            />
                                                        </div>
                                                        <p className="mt-1 truncate text-sm">
                                                            {job.title}
                                                        </p>
                                                        <p className="mt-1 truncate text-xs text-ink-soft">
                                                            {job.client} —{' '}
                                                            {formatDateTime(
                                                                job.scheduled_start,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <ChevronRight
                                                        className="mt-1 h-4 w-4 shrink-0 text-ink-soft"
                                                        aria-hidden="true"
                                                    />
                                                </Link>
                                            )}
                                            {!fieldMode && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedJobId(job.id)
                                                    }
                                                    className={cn(
                                                        'flex min-h-24 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle',
                                                        job.id ===
                                                            selectedJob?.id &&
                                                            'bg-brand-soft',
                                                    )}
                                                    aria-current={
                                                        job.id ===
                                                        selectedJob?.id
                                                            ? 'true'
                                                            : undefined
                                                    }
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="font-semibold">
                                                                    {
                                                                        job.reference
                                                                    }
                                                                </p>
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
                                                                    job.priority
                                                                }
                                                            />
                                                        </div>
                                                        <p className="mt-1 truncate text-sm">
                                                            {job.title}
                                                        </p>
                                                        <p className="mt-1 truncate text-xs text-ink-soft">
                                                            {job.client} ·{' '}
                                                            {formatDateTime(
                                                                job.scheduled_start,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <ChevronRight
                                                        className="mt-1 h-4 w-4 shrink-0 text-ink-soft"
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
                                        (c) => c.jobId === selectedJob.id,
                                    )}
                                    recommendations={selectedJobRecommendations}
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
            <div className="overflow-x-auto">
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
                                            ({ job, startCol, colSpan }) => (
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
                                                        job.priority.value ===
                                                            'emergency'
                                                            ? 'border-danger bg-danger-soft text-danger'
                                                            : job.priority
                                                                    .value ===
                                                                'priority'
                                                              ? 'border-warning bg-warning-soft text-warning-strong'
                                                              : 'border-brand bg-brand-soft text-brand-strong',
                                                    )}
                                                    title={`${job.reference}: ${job.title} (${job.client})`}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="text-[11px] font-bold tracking-tight">
                                                            {job.reference}
                                                        </span>
                                                        <CanonicalStatusBadge
                                                            status={
                                                                job.priority
                                                            }
                                                        />
                                                    </div>
                                                    <p className="truncate text-[10px] leading-tight font-medium">
                                                        {job.title}
                                                    </p>
                                                </button>
                                            ),
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
}: {
    conflicts: DerivedConflict[];
    filter: ConflictTypeFilter;
    returnTo: string;
}) {
    const filtered = useMemo(() => {
        if (filter === 'all') {
            return conflicts;
        }

        if (filter === 'overlaps') {
            return conflicts.filter((c) => c.type === 'overlap');
        }

        if (filter === 'maintenance') {
            return conflicts.filter((c) => c.type === 'maintenance');
        }

        if (filter === 'approvals') {
            return conflicts.filter((c) => c.type === 'approval');
        }

        if (filter === 'responses') {
            return conflicts.filter((c) => c.type === 'response');
        }

        if (filter === 'unassigned') {
            return conflicts.filter((c) => c.type === 'unassigned');
        }

        return conflicts;
    }, [conflicts, filter]);

    if (filtered.length === 0) {
        return (
            <Panel className="p-6">
                <EmptyState
                    icon={ShieldCheck}
                    title="All schedule and resource checks clear"
                    message="No active schedule overlaps, maintenance blockers, or pending manager approvals were found."
                />
            </Panel>
        );
    }

    return (
        <div className="space-y-4">
            {filtered.map((conflict) => (
                <Panel key={conflict.id} className="p-4 md:p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 items-start gap-3.5">
                            <div
                                className={cn(
                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                                    conflict.severity === 'danger' &&
                                        'bg-danger-soft text-danger',
                                    conflict.severity === 'warning' &&
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
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-semibold text-ink">
                                        {conflict.title}
                                    </h3>
                                    <span
                                        className={cn(
                                            'rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                                            conflict.severity === 'danger' &&
                                                'bg-danger-soft text-danger',
                                            conflict.severity === 'warning' &&
                                                'bg-warning-soft text-warning-strong',
                                            conflict.severity === 'info' &&
                                                'bg-info-soft text-info-strong',
                                        )}
                                    >
                                        {conflict.severity}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                                    {conflict.description}
                                </p>
                                <div className="mt-3 rounded-lg bg-surface-subtle px-3 py-2 text-xs font-medium text-ink">
                                    <span className="font-bold text-ink-soft">
                                        Required action:{' '}
                                    </span>
                                    {conflict.actionRequired}
                                </div>
                            </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2 self-end md:self-start">
                            {conflict.type === 'approval' &&
                                conflict.approvalId &&
                                (conflict.canDecide ? (
                                    <ApprovalConflictActions
                                        approvalId={conflict.approvalId}
                                    />
                                ) : (
                                    <p className="rounded-md bg-danger-soft px-3 py-1.5 text-xs font-medium text-danger">
                                        {conflict.decisionBlocker}
                                    </p>
                                ))}

                            {conflict.jobId && (
                                <Link
                                    href={assignmentWorkspaceUrl(
                                        conflict.jobId,
                                        returnTo,
                                    )}
                                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:bg-surface-subtle"
                                >
                                    Assign resources
                                    <ChevronRight
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                </Link>
                            )}
                        </div>
                    </div>
                </Panel>
            ))}
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
                            <ul className="mt-1.5 space-y-1 text-ink-soft">
                                <li className="flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success-strong" />
                                    <span>
                                        Pre-delivery mechanical &amp; safety
                                        inspection passed
                                    </span>
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success-strong" />
                                    <span>
                                        Fuel level verified at 100% full before
                                        release
                                    </span>
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success-strong" />
                                    <span>
                                        Maintenance &amp; test certificates
                                        attached to job
                                    </span>
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
                            <ul className="mt-1.5 space-y-1 text-ink-soft">
                                <li className="flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success-strong" />
                                    <span>
                                        Item packaging, serial numbers, and
                                        warranty documentation verified
                                    </span>
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success-strong" />
                                    <span>
                                        Client site delivery coordinates
                                        confirmed with transport team
                                    </span>
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
                                    className="flex items-center gap-2 rounded-md bg-surface-subtle p-2 text-ink"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success-strong" />
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

    return (
        <div className="mx-auto max-w-6xl space-y-5">
            {/* Header with Title, Badges, and Primary Assign Action */}
            <div className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">
                            {job.title}
                        </h2>
                        <CanonicalStatusBadge status={job.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                        <span className="font-medium text-ink">
                            {job.reference}
                        </span>
                        <span>·</span>
                        <span>{job.client}</span>
                        <span>·</span>
                        <DispatchSourceBadge source={job.source} detailed />
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <CanonicalStatusBadge status={job.priority} />
                    <span className="inline-flex min-h-6 items-center rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                        Version {job.version}
                    </span>
                    <Link
                        href={assignmentWorkspaceUrl(job.id, returnTo)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink shadow-2xs hover:bg-surface-subtle"
                    >
                        Assign resources
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
            </div>

            {/* Actionable Conflict Banner */}
            {conflicts.length > 0 && (
                <div className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <AlertTriangle
                            className="mt-0.5 h-5 w-5 shrink-0 text-danger"
                            aria-hidden="true"
                        />
                        <div>
                            <p className="text-sm font-semibold text-danger">
                                {conflicts.length} active operational conflict
                                {conflicts.length === 1 ? '' : 's'} on this job
                            </p>
                            <ul className="mt-1 space-y-0.5 text-xs text-danger">
                                {conflicts.map((c) => (
                                    <li key={c.id}>• {c.description}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <Link
                        href={assignmentWorkspaceUrl(job.id, returnTo)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-danger/40 bg-surface px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-soft"
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
                                value={`${formatDateTime(job.scheduled_start)} – ${formatDateTime(job.scheduled_end)}`}
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
                        </dl>
                        <div className="mt-4 rounded-lg bg-surface-subtle p-3">
                            <p className="text-xs font-semibold text-ink">
                                Site note
                            </p>
                            <p className="mt-1 text-sm leading-6 text-ink-soft">
                                {job.site_notes?.trim() ||
                                    'No additional site instructions were recorded.'}
                            </p>
                        </div>
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
                            <Link
                                href={assignmentWorkspaceUrl(job.id, returnTo)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline"
                            >
                                Manage assignments →
                            </Link>
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
                                    Assignments will appear after the authorized
                                    scheduling workflow completes.
                                </p>
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
                                            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success-strong">
                                                <ShieldCheck className="h-3 w-3" />
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
    if (
        !source ||
        source.type === 'direct' ||
        source.type === 'manual' ||
        source.manual_intake
    ) {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-1 rounded-full border border-line bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-ink-soft',
                    className,
                )}
                title="Direct operational draft (manual_intake)"
            >
                <span className="bg-ink-muted h-1.5 w-1.5 rounded-full" />
                <span>Manual</span>
                {detailed && (
                    <span className="text-ink-muted rounded bg-black/5 px-1 py-0.5 font-mono text-[9px]">
                        manual_intake
                    </span>
                )}
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
    const hasOpenRecommendation = activeRecommendations.length > 0;

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
            <div className="flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-start sm:justify-between">
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

                <div className="flex flex-wrap items-center gap-2">
                    {capabilities.request_gpt_assistance &&
                        !hasOpenRecommendation && (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={requestRecommendation}
                                disabled={requesting}
                            >
                                <Sparkles
                                    className="mr-1.5 h-3.5 w-3.5"
                                    aria-hidden="true"
                                />
                                {requesting
                                    ? 'Requesting…'
                                    : 'Request AI assistance'}
                            </Button>
                        )}
                    <Link
                        href="/?view=gpt-recommendations"
                        className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-medium text-brand-strong hover:bg-brand-soft"
                    >
                        View full advisory
                    </Link>
                </div>
            </div>

            {visibleRecommendations.length === 0 ? (
                <div className="mt-3 rounded-lg bg-surface-subtle p-4 text-center">
                    <p className="text-xs text-ink-soft">
                        No GPT recommendation has been requested for this
                        dispatch.
                    </p>
                    {capabilities.request_gpt_assistance && (
                        <Button
                            size="sm"
                            variant="secondary"
                            className="mt-2.5"
                            onClick={requestRecommendation}
                            disabled={requesting}
                        >
                            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-brand-strong" />
                            {requesting
                                ? 'Generating…'
                                : 'Generate AI Proposal'}
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
                            <div key={recommendation.id} className="space-y-3">
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

                                {recommendation.response_summary && (
                                    <p className="text-xs leading-relaxed text-ink">
                                        {recommendation.response_summary}
                                    </p>
                                )}

                                {/* Proposed Resources */}
                                {(personnel.length > 0 ||
                                    assets.length > 0) && (
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
                                    <p className="text-xs text-ink-soft">
                                        Requested by{' '}
                                        <span className="font-medium text-ink">
                                            {recommendation.requested_by.name}
                                        </span>
                                    </p>
                                    <div className="flex flex-wrap gap-2">
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
                                                    variant="secondary"
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
                                                        ? 'Retrying…'
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
        <div className="space-y-px" aria-label="Loading dispatch jobs">
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

/* Legacy duplicate commercial cards retired; intake orchestration owns these workflows.
type CommercialHandoffCardProps = {
    kind: 'rental' | 'sale';
    handoff: RentalDispatchHandoffViewModel | SalesDispatchHandoffViewModel;
    pending: boolean;
    canCreate: boolean;
    onCreate: () => void;
};

function CommercialHandoffCard({
    kind,
    handoff,
    pending,
    canCreate,
    onCreate,
}: CommercialHandoffCardProps) {
    const isRental = kind === 'rental';
    const rental = isRental
        ? (handoff as RentalDispatchHandoffViewModel)
        : null;

    return (
        <article className="rounded-xl border border-line bg-surface p-4 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={cn(
                                'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase',
                                isRental
                                    ? 'bg-warning-soft text-warning-strong'
                                    : 'bg-success-soft text-success-strong',
                            )}
                        >
                            {isRental ? 'Rental delivery' : 'Sale delivery'}
                        </span>
                        <span className="text-xs font-medium text-ink-soft">
                            {handoff.status.label}
                        </span>
                    </div>
                    <h3 className="mt-2 truncate text-sm font-semibold text-ink">
                        {handoff.reference}
                    </h3>
                    <p className="mt-1 truncate text-sm text-ink-soft">
                        {handoff.client.company_name} · {handoff.client.code}
                    </p>
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-soft">
                        <span className="font-semibold text-ink">
                            Deliver to:
                        </span>
                        <span className="min-w-0 break-words">
                            {handoff.location || 'Location required'}
                        </span>
                    </p>
                    {rental && (
                        <p className="mt-1 text-xs text-ink-soft">
                            Rental window: {rental.start_date || '—'} to{' '}
                            {rental.end_date || '—'}
                        </p>
                    )}
                </div>
                <Button
                    size="sm"
                    variant="primary"
                    type="button"
                    disabled={!canCreate || pending}
                    onClick={onCreate}
                >
                    {pending
                        ? 'Creating…'
                        : isRental
                          ? 'Create rental dispatch'
                          : 'Create sale dispatch'}
                </Button>
            </div>
        </article>
    );
}

function HandoffDateInput({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="text-xs font-semibold text-ink-soft">
            {label}
            <input
                type="datetime-local"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm font-normal text-ink focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
            />
        </label>
    );
}

function localDateTimeInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}
*/

function dateFromLocalKey(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);

    return new Date(year, month - 1, day);
}

function shiftLocalDate(value: string, days: number): string {
    const date = dateFromLocalKey(value);
    date.setDate(date.getDate() + days);

    return localDateKey(date);
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
