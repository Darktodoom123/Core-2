import { Link, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarDays,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    ClipboardList,
    FileText,
    MapPin,
    Plus,
    Search,
    SearchX,
    ShieldCheck,
    UserRound,
    X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
    Button,
    DataPair,
    DateTimePicker,
    EmptyState,
    PageHeading,
    Panel,
    Skeleton,
} from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { LiveDispatchIntake } from '@/components/workspace/live-dispatch-intake';
import { cn } from '@/lib/utils';
import type {
    ApprovalViewModel,
    AssetViewModel,
    ClientViewModel,
    DispatchJobViewModel,
    GptRecommendationViewModel,
    ServiceRequestViewModel,
    WorkspaceCapabilities,
    WorkspaceUserViewModel,
} from '@/types/workspace';

type ViewMode = 'list' | 'board' | 'conflicts';
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
    assets?: AssetViewModel[];
    approvals?: ApprovalViewModel[];
    users?: WorkspaceUserViewModel[];
    gptRecommendations?: GptRecommendationViewModel[];
    capabilities: WorkspaceCapabilities;
    canCreate: boolean;
    refreshing: boolean;
    initialServiceRequestId?: number | null;
}) {
    const [query, setQuery] = useState('');
    const [selectedJobId, setSelectedJobId] = useState<number | null>(
        jobs[0]?.id ?? null,
    );
    const [showCreate, setShowCreate] = useState(false);
    const [showIntake, setShowIntake] = useState(
        Boolean(initialServiceRequestId),
    );
    const [prevInitialRequestId, setPrevInitialRequestId] = useState(
        initialServiceRequestId,
    );

    if (initialServiceRequestId !== prevInitialRequestId) {
        setPrevInitialRequestId(initialServiceRequestId);

        if (initialServiceRequestId) {
            setShowIntake(true);
            setShowCreate(false);
        }
    }

    useEffect(() => {
        if (initialServiceRequestId && showIntake) {
            const timer = setTimeout(() => {
                const el = document.getElementById(
                    'service-request-intake-panel',
                );

                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [initialServiceRequestId, showIntake]);

    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [conflictsOnly, setConflictsOnly] = useState(false);
    const [boardCategory, setBoardCategory] = useState<BoardCategory>('all');
    const [conflictFilter, setConflictFilter] =
        useState<ConflictTypeFilter>('all');

    const fieldMode = capabilities.update_assigned_dispatch_status;
    const form = useForm({
        reference: '',
        client: '',
        title: '',
        site: '',
        scheduled_start: '',
        scheduled_end: '',
        priority: 'routine',
        requirements: [] as string[],
    });

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
                });
            }
        }

        return conflicts;
    }, [jobs, assets, approvals, gptRecommendations]);

    const filteredJobs = useMemo(() => {
        const normalized = query.trim().toLowerCase();

        if (normalized === '') {
            return jobs;
        }

        return jobs.filter((job) =>
            `${job.reference} ${job.client} ${job.title} ${job.site}`
                .toLowerCase()
                .includes(normalized),
        );
    }, [jobs, query]);

    const selectedJob =
        jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;

    const formComplete = [
        form.data.reference,
        form.data.client,
        form.data.title,
        form.data.site,
        form.data.scheduled_start,
        form.data.scheduled_end,
    ].every((value) => value.trim() !== '');

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/operations/dispatch-jobs', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setShowCreate(false);
            },
        });
    };

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
                                            ? 'bg-brand text-white shadow-xs'
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
                                            ? 'bg-brand text-white shadow-xs'
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
                                            ? 'bg-brand text-white shadow-xs'
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

                        {!fieldMode &&
                            (capabilities.create_client ||
                                capabilities.create_service_request ||
                                capabilities.convert_service_request) && (
                                <Button
                                    variant={showIntake ? 'secondary' : 'quiet'}
                                    onClick={() => {
                                        setShowIntake((value) => !value);

                                        if (!showIntake) {
                                            setShowCreate(false);
                                        }
                                    }}
                                    aria-expanded={showIntake}
                                    aria-controls="service-request-intake-panel"
                                >
                                    <FileText
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                    {showIntake
                                        ? 'Close intake'
                                        : 'Client & intake'}
                                    {showIntake ? (
                                        <ChevronUp
                                            className="h-3.5 w-3.5"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <ChevronDown
                                            className="h-3.5 w-3.5"
                                            aria-hidden="true"
                                        />
                                    )}
                                </Button>
                            )}

                        {canCreate && (
                            <Button
                                variant={showCreate ? 'secondary' : 'primary'}
                                onClick={() => {
                                    setShowCreate((value) => !value);

                                    if (!showCreate) {
                                        setShowIntake(false);
                                    }
                                }}
                                aria-expanded={showCreate}
                                aria-controls="create-dispatch-panel"
                            >
                                {showCreate ? (
                                    <X className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                    <Plus
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                )}
                                {showCreate ? 'Close form' : 'Create dispatch'}
                            </Button>
                        )}
                    </div>
                }
            />

            <AnimatePresence>
                {showIntake &&
                    !fieldMode &&
                    (capabilities.create_client ||
                        capabilities.create_service_request ||
                        capabilities.convert_service_request) && (
                        <motion.div
                            id="service-request-intake-panel"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="overflow-hidden"
                        >
                            <LiveDispatchIntake
                                clients={clients}
                                serviceRequests={serviceRequests}
                                capabilities={capabilities}
                                initialRequestId={initialServiceRequestId}
                            />
                        </motion.div>
                    )}
            </AnimatePresence>

            <AnimatePresence>
                {showCreate && canCreate && (
                    <motion.section
                        id="create-dispatch-panel"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden border-b border-line bg-surface px-4 py-5 md:px-6"
                        aria-labelledby="create-dispatch-title"
                    >
                        <div className="mx-auto mb-4 max-w-6xl">
                            <h2
                                id="create-dispatch-title"
                                className="text-lg font-semibold"
                            >
                                New dispatch
                            </h2>
                            <p className="mt-1 text-sm text-ink-soft">
                                Create the live draft first. Assignment and
                                activation stay in their existing authorized
                                workflows.
                            </p>
                        </div>
                        <form
                            onSubmit={submit}
                            className="mx-auto max-w-6xl space-y-4"
                            noValidate
                        >
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <DispatchInput
                                    label="Reference"
                                    value={form.data.reference}
                                    error={form.errors.reference}
                                    onChange={(value) =>
                                        form.setData('reference', value)
                                    }
                                />
                                <DispatchInput
                                    label="Client"
                                    value={form.data.client}
                                    error={form.errors.client}
                                    onChange={(value) =>
                                        form.setData('client', value)
                                    }
                                />
                                <DispatchInput
                                    label="Job title"
                                    value={form.data.title}
                                    error={form.errors.title}
                                    onChange={(value) =>
                                        form.setData('title', value)
                                    }
                                />
                                <DispatchInput
                                    label="Site"
                                    value={form.data.site}
                                    error={form.errors.site}
                                    onChange={(value) =>
                                        form.setData('site', value)
                                    }
                                />
                                <DateTimePicker
                                    label="Start"
                                    value={form.data.scheduled_start}
                                    error={form.errors.scheduled_start}
                                    onChange={(value) =>
                                        form.setData('scheduled_start', value)
                                    }
                                    required
                                />
                                <DateTimePicker
                                    label="End"
                                    value={form.data.scheduled_end}
                                    error={form.errors.scheduled_end}
                                    onChange={(value) =>
                                        form.setData('scheduled_end', value)
                                    }
                                    required
                                />
                                <label className="text-sm font-medium text-ink">
                                    Priority
                                    <select
                                        value={form.data.priority}
                                        onChange={(event) =>
                                            form.setData(
                                                'priority',
                                                event.target.value,
                                            )
                                        }
                                        aria-invalid={
                                            form.errors.priority
                                                ? 'true'
                                                : undefined
                                        }
                                        className={cn(
                                            'mt-1 h-11 w-full rounded-lg border bg-surface px-3 text-sm transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none',
                                            form.errors.priority
                                                ? 'border-danger'
                                                : 'border-line-strong hover:border-ink-soft',
                                        )}
                                    >
                                        <option value="routine">Routine</option>
                                        <option value="priority">
                                            Priority
                                        </option>
                                        <option value="emergency">
                                            Emergency
                                        </option>
                                    </select>
                                    {form.errors.priority && (
                                        <span className="mt-1 block text-xs text-danger">
                                            {form.errors.priority}
                                        </span>
                                    )}
                                </label>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                                {!formComplete && !form.processing ? (
                                    <p className="text-xs text-ink-soft">
                                        Complete every required field to
                                        continue.
                                    </p>
                                ) : (
                                    <div />
                                )}
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={form.processing || !formComplete}
                                >
                                    {form.processing
                                        ? 'Creating dispatch…'
                                        : 'Create live draft'}
                                </Button>
                            </div>
                        </form>
                    </motion.section>
                )}
            </AnimatePresence>

            {/* VIEW MODE: BOARD */}
            {viewMode === 'board' && !fieldMode && (
                <section
                    className="p-4 md:p-6"
                    aria-label="Schedule board section"
                >
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
                                            'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
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

                    <ScheduleBoardTable
                        jobs={filteredJobs}
                        assets={assets}
                        users={users}
                        derivedConflicts={derivedConflicts}
                        category={boardCategory}
                        conflictsOnly={conflictsOnly}
                        onSelectJob={(id) => {
                            setSelectedJobId(id);
                            setViewMode('list');
                        }}
                    />
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
                                        'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
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
                            query.trim() === '' ? (
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
                                                    setShowCreate(true)
                                                }
                                            >
                                                Create dispatch
                                            </Button>
                                        ) : undefined
                                    }
                                />
                            ) : (
                                <EmptyState
                                    compact
                                    icon={SearchX}
                                    title="No matching dispatches"
                                    message="Try a reference, client, title, or site."
                                    primaryAction={
                                        <Button
                                            variant="secondary"
                                            onClick={() => setQuery('')}
                                        >
                                            Clear search
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
                                                            <p className="font-semibold">
                                                                {job.reference}
                                                            </p>
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
    onSelectJob,
}: {
    jobs: DispatchJobViewModel[];
    assets: AssetViewModel[];
    users: WorkspaceUserViewModel[];
    derivedConflicts: DerivedConflict[];
    category: BoardCategory;
    conflictsOnly: boolean;
    onSelectJob: (jobId: number) => void;
}) {
    const hours = Array.from({ length: 11 }, (_, i) => i + 7); // 7 AM to 5 PM

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
                    );
                    assignedJobsForAsset.push({ job, ...span });
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
                        );
                        assignedJobsForUser.push({ job, ...span });
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
    }, [assets, users, jobs, category, conflictsOnly, derivedConflicts]);

    return (
        <Panel className="overflow-hidden">
            <div className="overflow-x-auto">
                <div className="min-w-[64rem]">
                    {/* Header */}
                    <div className="grid grid-cols-[16rem_minmax(48rem,1fr)] border-b border-line bg-surface-subtle text-xs font-semibold">
                        <div className="border-r border-line px-4 py-3 text-ink">
                            Resource & Status
                        </div>
                        <div className="grid grid-cols-11 divide-x divide-line">
                            {hours.map((h) => (
                                <div
                                    key={h}
                                    className="px-2 py-3 text-center text-ink-soft"
                                >
                                    {h > 12
                                        ? `${h - 12} PM`
                                        : h === 12
                                          ? '12 PM'
                                          : `${h} AM`}
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
                                    className="grid grid-cols-[16rem_minmax(48rem,1fr)] items-stretch hover:bg-surface-subtle/50"
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

                                    <div className="relative grid grid-cols-11 divide-x divide-line bg-canvas/30 p-1">
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
}: {
    conflicts: DerivedConflict[];
    filter: ConflictTypeFilter;
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
                                    href={`/operations/dispatch-jobs/${conflict.jobId}`}
                                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:bg-surface-subtle"
                                >
                                    Open assignment workspace
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

function DispatchDetails({
    job,
    conflicts = [],
}: {
    job: DispatchJobViewModel;
    conflicts?: DerivedConflict[];
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
        <div className="mx-auto max-w-5xl space-y-4">
            <div className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold tracking-[-0.02em]">
                            {job.title}
                        </h2>
                        <CanonicalStatusBadge status={job.status} />
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                        {job.reference} · {job.client}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <CanonicalStatusBadge status={job.priority} />
                    <span className="inline-flex min-h-6 items-center rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                        Version {job.version}
                    </span>
                    <Link
                        href={`/operations/dispatch-jobs/${job.id}`}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-subtle"
                    >
                        Open assignment workspace
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
            </div>

            {conflicts.length > 0 && (
                <div className="rounded-lg border border-danger/30 bg-danger-soft p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-danger">
                        <AlertTriangle
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                        />
                        {conflicts.length} active operational conflict
                        {conflicts.length === 1 ? '' : 's'} on this job
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-danger">
                        {conflicts.map((c) => (
                            <li key={c.id}>• {c.description}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
                <Panel className="p-4">
                    <h3 className="font-semibold">Dispatch context</h3>
                    <dl className="mt-3 divide-y divide-line">
                        <DataPair
                            label="Schedule"
                            value={`${formatDateTime(job.scheduled_start)} – ${formatDateTime(job.scheduled_end)}`}
                        />
                        <DataPair
                            label="Site"
                            value={
                                <span className="inline-flex items-start gap-2">
                                    <MapPin
                                        className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft"
                                        aria-hidden="true"
                                    />
                                    {job.site}
                                </span>
                            }
                        />
                        <DataPair
                            label="Last updated"
                            value={formatDateTime(job.updated_at)}
                        />
                    </dl>
                    <div className="mt-4 rounded-lg bg-surface-subtle p-3">
                        <p className="text-xs font-semibold">Site note</p>
                        <p className="mt-1 text-sm leading-6 text-ink-soft">
                            {job.site_notes?.trim() ||
                                'No additional site instructions were recorded.'}
                        </p>
                    </div>
                </Panel>

                <Panel className="overflow-hidden">
                    <div className="border-b border-line px-4 py-3">
                        <h3 className="font-semibold">Assigned resources</h3>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Current server-backed personnel and assets
                        </p>
                    </div>
                    {assignments.length === 0 ? (
                        <EmptyState
                            compact
                            icon={UserRound}
                            title="No resources assigned"
                            message="Assignments will appear after the authorized scheduling workflow completes."
                        />
                    ) : (
                        <ul className="divide-y divide-line">
                            {assignments.map((assignment) => {
                                const Icon = assignment.icon;

                                return (
                                    <li
                                        key={assignment.id}
                                        className="flex items-start gap-3 px-4 py-3"
                                    >
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft">
                                            <Icon
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">
                                                {assignment.primary}
                                            </p>
                                            <p className="mt-0.5 text-xs text-ink-soft">
                                                {assignment.secondary}
                                            </p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Panel>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
                <CalendarDays
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong"
                    aria-hidden="true"
                />
                <p className="leading-6 text-ink-soft">
                    Open the assignment workspace to review server-authoritative
                    availability, credentials, maintenance blocks, readiness,
                    and schedule conflicts before confirming resources.
                </p>
            </div>
        </div>
    );
}

function DispatchInput({
    label,
    value,
    onChange,
    error,
    type = 'text',
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
}) {
    const errorId = `dispatch-${label.toLowerCase().replaceAll(' ', '-')}-error`;

    return (
        <label className="text-sm font-medium text-ink">
            {label}
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? errorId : undefined}
                className={cn(
                    'mt-1 h-11 w-full rounded-lg border bg-surface px-3 text-sm transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none',
                    error
                        ? 'border-danger'
                        : 'border-line-strong hover:border-ink-soft',
                )}
            />
            {error && (
                <span id={errorId} className="mt-1 block text-xs text-danger">
                    {error}
                </span>
            )}
        </label>
    );
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

function calculateTimeSpan(startIso: string | null, endIso: string | null) {
    if (!startIso || !endIso) {
        return { startCol: 1, colSpan: 3 };
    }

    const start = new Date(startIso);
    const end = new Date(endIso);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;

    let startCol = Math.max(1, Math.floor(startHour - 7) + 1);
    let endCol = Math.min(12, Math.ceil(endHour - 7) + 1);

    if (startCol >= 12) {
        startCol = 11;
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

function formatDateTime(value: string | null) {
    if (value === null) {
        return 'Not scheduled';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function humanize(value: string) {
    return value.replaceAll('_', ' ');
}
