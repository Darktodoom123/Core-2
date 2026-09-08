import { Link, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Clock3,
    FileText,
    Inbox,
    MapPin,
    Plus,
    RefreshCw,
    Search,
    Truck,
    Users,
    X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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
import { DispatchGptAdvisory } from '@/components/workspace/dispatch-gpt-advisory';
import { LiveDispatchIntake } from '@/components/workspace/live-dispatch-intake';
import { ScheduleBoardTable } from '@/components/workspace/live-dispatch-workspace';
import type { DerivedConflict } from '@/components/workspace/live-dispatch-workspace';
import { ScheduleBoardMonthView } from '@/components/workspace/schedule-board-month-view';
import { ScheduleBoardWeekView } from '@/components/workspace/schedule-board-week-view';
import {
    dateFromLocalKey,
    localDateKey,
    shiftLocalDate,
} from '@/lib/date-utils';
import { formatDateTime, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Auth } from '@/types/auth';
import type {
    DispatchJobViewModel,
    GptRecommendationViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';
import {
    deriveDispatchDeskConflicts,
    EXECUTION_STATUSES,
    HISTORY_STATUSES,
    incomingWorkItems,
    jobGroup,
    jobNeedsAssignment,
    jobOverlapsDate,
    jobOverlapsPeriod,
    nextActionForJob,
    PREPARATION_STATUSES,
    resourceLabel,
    sourceMatches,
} from './dispatch-desk-helpers';
import { DispatchResources } from './dispatch-resources';
import type {
    DispatchDeskMode,
    DispatchDeskPeriod,
    DispatchDeskProps,
    DispatchDeskView,
    DispatchSourceFilter,
} from './types';
import { useDispatchDeskState } from './use-dispatch-desk-state';
import { useDispatchSearch } from './use-dispatch-search';

const SOURCE_FILTERS: Array<{ value: DispatchSourceFilter; label: string }> = [
    { value: 'all', label: 'All sources' },
    { value: 'service_request', label: 'Service request' },
    { value: 'rental_reservation', label: 'Rental delivery' },
    { value: 'sales_order', label: 'Sales delivery' },
    { value: 'manual', label: 'Manual intake' },
];

const VIEW_ITEMS: Array<{
    value: DispatchDeskView;
    label: string;
    icon: typeof Inbox;
}> = [
    { value: 'incoming', label: 'Incoming work', icon: Inbox },
    { value: 'schedule', label: 'Schedule', icon: CalendarDays },
    { value: 'in-progress', label: 'In progress', icon: Truck },
    { value: 'history', label: 'History', icon: FileText },
];

function formatDateLabel(dateKey: string): string {
    const date = dateFromLocalKey(dateKey);

    return date
        ? new Intl.DateTimeFormat(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
          }).format(date)
        : 'Selected date';
}

function displayStatusFilter(view: DispatchDeskView): string {
    if (view === 'incoming') {
        return 'all';
    }

    if (view === 'in-progress') {
        return 'active';
    }

    if (view === 'history') {
        return 'completed';
    }

    return 'all';
}

function detailHash(
    job: DispatchJobViewModel,
    conflicts: readonly DerivedConflict[] = [],
): string {
    if (
        job.status.value === 'pending_approval' ||
        conflicts.some(
            (conflict) =>
                conflict.jobId === job.id && conflict.type === 'approval',
        )
    ) {
        return '#dispatch-activation';
    }

    if (job.status.value === 'scheduled') {
        return '#dispatch-activation';
    }

    if (job.status.value === 'draft') {
        return '#assignment-summary';
    }

    return EXECUTION_STATUSES.includes(
        job.status.value as (typeof EXECUTION_STATUSES)[number],
    )
        ? '#field-execution'
        : '#dispatch-context';
}

function dispatchDetailUrl(
    job: DispatchJobViewModel,
    returnTo: string,
    conflicts: readonly DerivedConflict[] = [],
): string {
    const params = new URLSearchParams({ return_to: returnTo });

    return `/operations/dispatch-jobs/${job.id}?${params.toString()}${detailHash(job, conflicts)}`;
}

function formatSchedule(job: DispatchJobViewModel): string {
    if (!job.scheduled_start) {
        return 'Schedule not recorded';
    }

    if (!job.scheduled_end) {
        return formatDateTime(job.scheduled_start);
    }

    return `${formatDateTime(job.scheduled_start)} – ${formatDateTime(job.scheduled_end)}`;
}

function matchesStatus(
    job: DispatchJobViewModel,
    view: DispatchDeskView,
): boolean {
    if (view === 'incoming') {
        return false;
    }

    if (view === 'in-progress') {
        return EXECUTION_STATUSES.includes(
            job.status.value as (typeof EXECUTION_STATUSES)[number],
        );
    }

    if (view === 'history') {
        return HISTORY_STATUSES.includes(
            job.status.value as (typeof HISTORY_STATUSES)[number],
        );
    }

    return (
        PREPARATION_STATUSES.includes(
            job.status.value as (typeof PREPARATION_STATUSES)[number],
        ) ||
        EXECUTION_STATUSES.includes(
            job.status.value as (typeof EXECUTION_STATUSES)[number],
        )
    );
}

function isUndatedPreparation(job: DispatchJobViewModel): boolean {
    return (
        PREPARATION_STATUSES.includes(
            job.status.value as (typeof PREPARATION_STATUSES)[number],
        ) &&
        job.scheduled_start === null &&
        job.scheduled_end === null
    );
}

function priorityClasses(value: string): string {
    if (value === 'emergency') {
        return 'bg-danger-soft text-danger-strong';
    }

    if (value === 'priority') {
        return 'bg-warning-soft text-warning-strong';
    }

    return 'bg-surface-subtle text-ink-soft';
}

export function DispatchDesk({
    jobs: initialJobs,
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
    resourceCoverage,
}: DispatchDeskProps) {
    const { url: currentWorkspaceUrl, props } = usePage<{ auth?: Auth }>();
    const returnTo =
        typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}${window.location.hash}`
            : currentWorkspaceUrl || '/?view=dispatch';
    const {
        state,
        setView,
        setMode,
        setPeriod,
        setDate,
        setQuery,
        setSource,
        setAttentionOnly,
        setSelectedJobId,
        setShowIntake,
        setIntakeMode,
        setPage,
    } = useDispatchDeskState(initialServiceRequestId, currentWorkspaceUrl);
    const search = useDispatchSearch(state, initialJobs, refreshing);
    const { jobs, contextJobs } = search;
    const [directIntakeDirty, setDirectIntakeDirty] = useState(false);
    const [needsAssignmentOnly, setNeedsAssignmentOnly] = useState(false);
    const [showResources, setShowResources] = useState(false);
    const [mobileReview, setMobileReview] = useState(
        state.selectedJobId !== null,
    );
    const assignmentCount = useMemo(
        () => jobs.filter((job) => jobNeedsAssignment(job)).length,
        [jobs],
    );
    const listPosition = useRef(0);
    const selectedRow = useRef<HTMLElement | null>(null);
    const reviewRef = useRef<HTMLDivElement>(null);
    const resourceRef = useRef<HTMLDivElement>(null);
    const resourceTrigger = useRef<HTMLButtonElement>(null);
    const listStorageKey = `dispatch-list:${state.view}:${state.mode}:${state.period}:${state.date}:${state.query}:${state.source}:${state.attentionOnly}:${state.page}`;
    const intakeRequestId = useMemo(() => {
        if (initialServiceRequestId) {
            return initialServiceRequestId;
        }

        const params = new URLSearchParams(
            typeof window !== 'undefined'
                ? window.location.search
                : (currentWorkspaceUrl?.split('?')[1]?.split('#')[0] ?? ''),
        );
        const value = Number.parseInt(params.get('serviceRequestId') ?? '', 10);

        return Number.isFinite(value) && value > 0 ? value : null;
    }, [currentWorkspaceUrl, initialServiceRequestId]);

    const conflicts = useMemo(
        () =>
            deriveDispatchDeskConflicts({
                jobs: contextJobs,
                assets,
                approvals,
                gptRecommendations,
            }),
        [approvals, assets, gptRecommendations, contextJobs],
    );
    const incoming = useMemo(
        () =>
            incomingWorkItems({
                serviceRequests,
                rentalHandoffs,
                salesHandoffs,
            }),
        [rentalHandoffs, salesHandoffs, serviceRequests],
    );
    const incomingByCapability = useMemo(
        () =>
            incoming.filter((item) =>
                item.mode === 'service'
                    ? capabilities.convert_service_request
                    : item.mode === 'rental'
                      ? capabilities.create_rental_dispatch
                      : capabilities.create_sales_dispatch,
            ),
        [capabilities, incoming],
    );

    const filteredJobs = useMemo(() => {
        const normalizedQuery = state.query.trim().toLowerCase();
        const activeStatusFilter = displayStatusFilter(state.view);

        return jobs.filter((job) => {
            if (!matchesStatus(job, state.view)) {
                return false;
            }

            const isUndatedScheduleJob =
                state.view === 'schedule' && isUndatedPreparation(job);
            const schedulePeriod = state.mode === 'list' ? 'day' : state.period;

            if (
                state.view === 'schedule' &&
                !jobOverlapsPeriod(job, state.date, schedulePeriod) &&
                !isUndatedScheduleJob
            ) {
                return false;
            }

            if (!search.page && !sourceMatches(job.source, state.source)) {
                return false;
            }

            if (
                activeStatusFilter !== 'all' &&
                state.view === 'schedule' &&
                activeStatusFilter === 'active' &&
                !EXECUTION_STATUSES.includes(
                    job.status.value as (typeof EXECUTION_STATUSES)[number],
                )
            ) {
                return false;
            }

            if (
                activeStatusFilter !== 'all' &&
                state.view === 'schedule' &&
                activeStatusFilter === 'draft' &&
                !PREPARATION_STATUSES.includes(
                    job.status.value as (typeof PREPARATION_STATUSES)[number],
                )
            ) {
                return false;
            }

            if (
                activeStatusFilter !== 'all' &&
                state.view === 'schedule' &&
                activeStatusFilter === 'completed' &&
                job.status.value !== 'completed'
            ) {
                return false;
            }

            if (
                state.attentionOnly &&
                !conflicts.some((conflict) => conflict.jobId === job.id)
            ) {
                return false;
            }

            if (needsAssignmentOnly && !jobNeedsAssignment(job)) {
                return false;
            }

            return (
                Boolean(search.page) ||
                normalizedQuery === '' ||
                `${job.reference} ${job.title} ${job.client} ${job.site} ${job.source?.reference ?? ''}`
                    .toLowerCase()
                    .includes(normalizedQuery)
            );
        });
    }, [conflicts, jobs, state, search.page, needsAssignmentOnly]);

    const selectedJob = useMemo(
        () =>
            filteredJobs.find((job) => job.id === state.selectedJobId) ??
            filteredJobs[0] ??
            null,
        [filteredJobs, state.selectedJobId],
    );
    const selectedConflicts = useMemo(
        () =>
            selectedJob
                ? conflicts.filter(
                      (conflict) => conflict.jobId === selectedJob.id,
                  )
                : [],
        [conflicts, selectedJob],
    );
    const jobCounts = useMemo(
        () => ({
            incoming: incomingByCapability.length,
            schedule: jobs.filter(
                (job) =>
                    matchesStatus(job, 'schedule') &&
                    (jobOverlapsDate(job, state.date) ||
                        isUndatedPreparation(job)),
            ).length,
            'in-progress': jobs.filter((job) =>
                matchesStatus(job, 'in-progress'),
            ).length,
            history: jobs.filter((job) => matchesStatus(job, 'history')).length,
        }),
        [incomingByCapability.length, jobs, state.date],
    );

    const changeDesk = (patch: () => void) => {
        if (directIntakeDirty) {
            const shouldDiscard = window.confirm(
                'Discard this direct dispatch draft? Unsaved details will be lost.',
            );

            if (!shouldDiscard) {
                return false;
            }

            window.dispatchEvent(new Event(DIRECT_DISPATCH_DISCARD_EVENT));
            setDirectIntakeDirty(false);
        }

        patch();

        return true;
    };

    const selectJob = (jobId: number) => {
        listPosition.current = window.scrollY;

        try {
            sessionStorage.setItem(listStorageKey, String(window.scrollY));
        } catch {
            // In-memory restoration still works when browser storage is disabled.
        }

        selectedRow.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        setSelectedJobId(jobId);
        setMobileReview(true);

        if (window.innerWidth < 1024) {
            requestAnimationFrame(() => {
                reviewRef.current?.focus({ preventScroll: true });
                reviewRef.current?.scrollIntoView({ block: 'start' });
            });
        }
    };

    const backToResults = () => {
        setMobileReview(false);

        try {
            const saved = sessionStorage.getItem(listStorageKey);

            if (saved !== null && Number.isFinite(Number(saved))) {
                listPosition.current = Math.max(0, Number(saved));
            }
        } catch {
            // Use the position captured in this mounted desk.
        }

        requestAnimationFrame(() => {
            const row = selectedRow.current?.isConnected
                ? selectedRow.current
                : document.getElementById(
                      `dispatch-row-${state.selectedJobId}`,
                  );
            row?.focus({ preventScroll: true });
            window.scrollTo({ top: listPosition.current, behavior: 'instant' });
        });
    };

    const toggleIntake = () => {
        if (state.view === 'incoming') {
            if (
                !changeDesk(() => {
                    setShowIntake(false);
                    setIntakeMode(null);
                    setView('schedule');
                })
            ) {
                return;
            }

            return;
        }

        changeDesk(() => {
            setView('incoming');
            setShowIntake(true);
            setIntakeMode(null);
        });
    };

    const showScheduleControls = state.view === 'schedule';
    const isResourceCoverageMode =
        state.view === 'schedule' && state.mode === 'resources';
    const scheduleJobs = filteredJobs;
    const isFieldRole =
        props.auth?.role === 'driver' || props.auth?.role === 'crane_operator';

    return (
        <div className="workspace-width-contained">
            <PageHeading
                title="Dispatch desk"
                description="Schedule incoming work, assign resources, and follow dispatches through completion."
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            ref={resourceTrigger}
                            variant="secondary"
                            onClick={() => {
                                setShowResources((open) => !open);

                                if (!showResources) {
                                    requestAnimationFrame(() =>
                                        resourceRef.current?.focus({
                                            preventScroll:
                                                window.innerWidth >= 1280,
                                        }),
                                    );
                                }
                            }}
                            aria-expanded={showResources}
                            aria-controls={
                                showResources ? 'dispatch-resources' : undefined
                            }
                        >
                            <Users className="h-4 w-4" aria-hidden="true" />
                            People &amp; assets
                        </Button>
                        {(canCreate || incomingByCapability.length > 0) &&
                            !isFieldRole && (
                                <Button
                                    id="new-dispatch-trigger"
                                    variant={
                                        state.view === 'incoming'
                                            ? 'secondary'
                                            : 'primary'
                                    }
                                    onClick={toggleIntake}
                                    aria-expanded={state.view === 'incoming'}
                                    aria-controls={
                                        state.view === 'incoming'
                                            ? 'incoming-work-panel'
                                            : undefined
                                    }
                                >
                                    {state.view === 'incoming' ? (
                                        <X
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <Plus
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                    )}
                                    {state.view === 'incoming'
                                        ? 'Back to schedule'
                                        : 'New dispatch'}
                                    {incomingByCapability.length > 0 &&
                                        state.view !== 'incoming' && (
                                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold">
                                                {incomingByCapability.length}
                                            </span>
                                        )}
                                </Button>
                            )}
                    </div>
                }
            />

            <div
                className={cn(
                    'grid min-w-0 items-start',
                    showResources && 'xl:grid-cols-[minmax(0,1fr)_22rem]',
                )}
            >
                <div
                    className={cn(
                        'min-w-0',
                        showResources && 'hidden xl:block',
                    )}
                >
                    <div className="border-b border-line bg-surface px-5 py-3 lg:px-7">
                        <nav
                            className="grid min-w-0 grid-cols-2 gap-1 sm:flex sm:flex-wrap"
                            aria-label="Dispatch work views"
                        >
                            {VIEW_ITEMS.map(({ value, label, icon: Icon }) => (
                                <button
                                    key={value}
                                    type="button"
                                    className={cn(
                                        'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                                        state.view === value
                                            ? 'bg-brand-soft text-ink'
                                            : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                    aria-current={
                                        state.view === value
                                            ? 'page'
                                            : undefined
                                    }
                                    onClick={() =>
                                        changeDesk(() => {
                                            setMobileReview(false);
                                            setView(value);

                                            if (value === 'incoming') {
                                                setShowIntake(true);
                                                setIntakeMode(null);
                                            } else {
                                                setShowIntake(false);
                                                setIntakeMode(null);
                                            }
                                        })
                                    }
                                >
                                    <Icon
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                    <span>{label}</span>
                                    {value === 'incoming' && (
                                        <span className="rounded-full bg-surface-subtle px-1.5 text-xs text-ink-soft tabular-nums">
                                            {jobCounts[value]}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-subtle px-5 py-3 lg:px-7">
                        <div className="flex min-w-0 items-center gap-2 text-xs text-ink-soft">
                            <span>
                                {state.view === 'incoming' ||
                                isResourceCoverageMode
                                    ? 'Resource context uses loaded, permitted records'
                                    : search.page
                                      ? `${search.page.total} dispatch${search.page.total === 1 ? '' : 'es'} found · Page ${search.page.current_page} of ${search.page.last_page}`
                                      : search.error
                                        ? 'Showing a limited snapshot; complete search is unavailable'
                                        : 'Showing the loaded snapshot while complete results load'}
                            </span>
                            {(refreshing || search.pending) && (
                                <span
                                    className="inline-flex items-center gap-1 text-info-strong"
                                    role="status"
                                >
                                    <RefreshCw
                                        className="h-3.5 w-3.5 animate-spin"
                                        aria-hidden="true"
                                    />
                                    Refreshing
                                </span>
                            )}
                        </div>
                        {state.view !== 'incoming' && (
                            <span
                                className="text-xs text-ink-soft"
                                role="status"
                                aria-live="polite"
                            >
                                {filteredJobs.length} shown on this page
                            </span>
                        )}
                    </div>
                    {search.error && (
                        <div
                            role="alert"
                            className="flex flex-wrap items-center gap-3 border-b border-line bg-warning-soft p-4 text-sm text-ink"
                        >
                            {search.error}
                            <Button variant="secondary" onClick={search.retry}>
                                Retry search
                            </Button>
                        </div>
                    )}
                    {search.page && search.page.last_page > 1 && (
                        <nav
                            aria-label="Dispatch result pages"
                            className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3"
                        >
                            <Button
                                variant="secondary"
                                disabled={search.pending || state.page <= 1}
                                onClick={() => {
                                    setMobileReview(false);
                                    setPage(state.page - 1);
                                }}
                            >
                                Previous page
                            </Button>
                            <span className="text-xs text-ink-soft">
                                Search covers all permitted dispatches.
                                Attention checks use this page and loaded
                                resource records.
                            </span>
                            <Button
                                variant="secondary"
                                disabled={
                                    search.pending ||
                                    state.page >= search.page.last_page
                                }
                                onClick={() => {
                                    setMobileReview(false);
                                    setPage(state.page + 1);
                                }}
                            >
                                Next page
                            </Button>
                        </nav>
                    )}

                    {search.page && state.page > search.page.last_page && (
                        <Button
                            variant="secondary"
                            className="m-3"
                            onClick={() => {
                                setMobileReview(false);
                                setPage(1);
                            }}
                        >
                            Back to first page
                        </Button>
                    )}
                    {state.view === 'incoming' ? (
                        <section
                            id="incoming-work-panel"
                            className="bg-canvas p-4 lg:p-6"
                            aria-labelledby="incoming-work-heading"
                        >
                            <div className="mx-auto max-w-6xl">
                                <div className="border-b border-line pb-4">
                                    <h2
                                        id="incoming-work-heading"
                                        className="text-lg font-semibold tracking-[-0.02em] text-ink"
                                    >
                                        Incoming work
                                    </h2>
                                    <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
                                        Review source-aware handoffs and decide
                                        whether to convert, reconcile, or create
                                        a manual operational draft.
                                    </p>
                                </div>
                                <LiveDispatchIntake
                                    clients={clients}
                                    serviceRequests={serviceRequests}
                                    rentalHandoffs={rentalHandoffs}
                                    salesHandoffs={salesHandoffs}
                                    jobs={jobs}
                                    capabilities={capabilities}
                                    initialRequestId={intakeRequestId}
                                    initialMode={state.intakeMode}
                                    showQueueWhenEmpty
                                    onDirtyChange={setDirectIntakeDirty}
                                    onClose={() => {
                                        setDirectIntakeDirty(false);
                                        setShowIntake(false);
                                        setIntakeMode(null);
                                        setView('schedule');
                                    }}
                                />
                            </div>
                        </section>
                    ) : (
                        <>
                            <div
                                className={cn(
                                    mobileReview && 'hidden lg:block',
                                )}
                            >
                                {!isResourceCoverageMode && (
                                    <DeskFilters
                                        query={state.query}
                                        source={state.source}
                                        attentionOnly={state.attentionOnly}
                                        needsAssignmentOnly={
                                            needsAssignmentOnly
                                        }
                                        assignmentCount={assignmentCount}
                                        onQuery={(value) =>
                                            changeDesk(() => setQuery(value))
                                        }
                                        onSource={(value) =>
                                            changeDesk(() => setSource(value))
                                        }
                                        onAttention={(value) =>
                                            changeDesk(() =>
                                                setAttentionOnly(value),
                                            )
                                        }
                                        onNeedsAssignment={(value) =>
                                            setNeedsAssignmentOnly(value)
                                        }
                                        onReset={() =>
                                            changeDesk(() => {
                                                setQuery('');
                                                setSource('all');
                                                setAttentionOnly(false);
                                                setNeedsAssignmentOnly(false);
                                            })
                                        }
                                    />
                                )}

                                {showScheduleControls && (
                                    <ScheduleControls
                                        date={state.date}
                                        mode={state.mode}
                                        period={state.period}
                                        onDate={(value) =>
                                            changeDesk(() => setDate(value))
                                        }
                                        onMode={(value) =>
                                            changeDesk(() => setMode(value))
                                        }
                                        onPeriod={(value) =>
                                            changeDesk(() => setPeriod(value))
                                        }
                                    />
                                )}
                            </div>

                            {showScheduleControls && state.mode !== 'list' && (
                                <>
                                    <div
                                        className={cn(
                                            mobileReview && 'hidden lg:block',
                                        )}
                                    >
                                        <ScheduleSurface
                                            mode={state.mode}
                                            jobs={scheduleJobs}
                                            assets={assets}
                                            users={users.filter(
                                                (user) =>
                                                    user.role === 'driver' ||
                                                    user.role ===
                                                        'crane_operator',
                                            )}
                                            conflicts={conflicts}
                                            date={state.date}
                                            period={state.period}
                                            resourceCoverage={resourceCoverage}
                                            onDate={(value) =>
                                                changeDesk(() => setDate(value))
                                            }
                                            onSelectJob={selectJob}
                                        />
                                    </div>
                                    {state.mode === 'calendar' && (
                                        <div
                                            ref={reviewRef}
                                            tabIndex={-1}
                                            className={cn(
                                                'scroll-mt-20 outline-none',
                                                !mobileReview &&
                                                    'hidden lg:block',
                                            )}
                                        >
                                            <Button
                                                variant="secondary"
                                                className="m-4 lg:hidden"
                                                onClick={backToResults}
                                            >
                                                <ChevronLeft
                                                    className="h-4 w-4"
                                                    aria-hidden="true"
                                                />
                                                Back to results
                                            </Button>
                                            <DispatchReviewPanel
                                                job={selectedJob}
                                                conflicts={selectedConflicts}
                                                returnTo={returnTo}
                                                recommendations={
                                                    gptRecommendations
                                                }
                                                capabilities={capabilities}
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {(state.mode === 'list' ||
                                !showScheduleControls) && (
                                <div className="grid min-w-0 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
                                    <div
                                        className={cn(
                                            'min-w-0',
                                            mobileReview && 'hidden lg:block',
                                        )}
                                    >
                                        <DeskJobList
                                            jobs={filteredJobs}
                                            conflicts={conflicts}
                                            selectedJobId={
                                                selectedJob?.id ?? null
                                            }
                                            refreshing={refreshing}
                                            onSelectJob={selectJob}
                                        />
                                    </div>
                                    <div
                                        ref={reviewRef}
                                        tabIndex={-1}
                                        className={cn(
                                            'min-w-0 scroll-mt-20 outline-none',
                                            !mobileReview && 'hidden lg:block',
                                        )}
                                    >
                                        <Button
                                            variant="secondary"
                                            className="m-4 lg:hidden"
                                            onClick={backToResults}
                                        >
                                            <ChevronLeft
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                            />
                                            Back to results
                                        </Button>
                                        <DispatchReviewPanel
                                            job={selectedJob}
                                            conflicts={selectedConflicts}
                                            returnTo={returnTo}
                                            recommendations={gptRecommendations}
                                            capabilities={capabilities}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                {showResources && (
                    <div
                        ref={resourceRef}
                        tabIndex={-1}
                        className="min-w-0 border-line bg-surface outline-none xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:border-l"
                    >
                        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-ink">
                                    {selectedJob
                                        ? `${selectedJob.reference} · ${selectedJob.title}`
                                        : 'Resource overview'}
                                </p>
                                {selectedJob && (
                                    <p className="mt-1 text-xs text-ink-soft">
                                        {formatSchedule(selectedJob)}
                                    </p>
                                )}
                                {selectedJob && (
                                    <Link
                                        href={dispatchDetailUrl(
                                            selectedJob,
                                            returnTo,
                                            selectedConflicts,
                                        )}
                                        className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline decoration-brand underline-offset-2"
                                    >
                                        {jobGroup(selectedJob) === 'preparation'
                                            ? 'Check eligibility & assign'
                                            : 'View dispatch resources'}
                                    </Link>
                                )}
                            </div>
                            <Button
                                variant="secondary"
                                aria-label="Close people and assets"
                                onClick={() => {
                                    setShowResources(false);
                                    requestAnimationFrame(() =>
                                        resourceTrigger.current?.focus(),
                                    );
                                }}
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        </div>
                        <DispatchResources
                            users={users}
                            assets={assets}
                            jobs={contextJobs}
                            initialDate={state.date}
                            returnTo={returnTo}
                            refreshing={refreshing}
                            selectedJob={selectedJob}
                            onSelectJob={selectJob}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function DeskFilters({
    query,
    source,
    attentionOnly,
    needsAssignmentOnly,
    assignmentCount,
    onQuery,
    onSource,
    onAttention,
    onNeedsAssignment,
    onReset,
}: {
    query: string;
    source: DispatchSourceFilter;
    attentionOnly: boolean;
    needsAssignmentOnly: boolean;
    assignmentCount: number;
    onQuery: (value: string) => void;
    onSource: (value: DispatchSourceFilter) => void;
    onAttention: (value: boolean) => void;
    onNeedsAssignment: (value: boolean) => void;
    onReset: () => void;
}) {
    const hasFilters =
        query !== '' ||
        source !== 'all' ||
        attentionOnly ||
        needsAssignmentOnly;

    return (
        <section
            className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-3 lg:px-7"
            aria-label="Dispatch filters"
        >
            <label className="relative min-w-[14rem] flex-1 sm:max-w-sm">
                <span className="sr-only">Search dispatches</span>
                <Search
                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
                    aria-hidden="true"
                />
                <input
                    type="search"
                    maxLength={200}
                    value={query}
                    onChange={(event) => onQuery(event.target.value)}
                    placeholder="Search job, site, client"
                    className="h-11 w-full rounded-lg border border-line-strong bg-surface pl-9 text-sm text-ink placeholder:text-ink-soft focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                />
            </label>
            <label className="min-w-[11rem]">
                <span className="sr-only">Filter by source</span>
                <select
                    value={source}
                    onChange={(event) =>
                        onSource(event.target.value as DispatchSourceFilter)
                    }
                    className="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                    {SOURCE_FILTERS.map((item) => (
                        <option key={item.value} value={item.value}>
                            {item.label}
                        </option>
                    ))}
                </select>
            </label>
            <Button
                size="sm"
                variant={attentionOnly ? 'primary' : 'secondary'}
                aria-pressed={attentionOnly}
                onClick={() => onAttention(!attentionOnly)}
            >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                Needs attention on this page
            </Button>
            {assignmentCount > 0 && (
                <Button
                    size="sm"
                    variant={needsAssignmentOnly ? 'primary' : 'secondary'}
                    aria-pressed={needsAssignmentOnly}
                    onClick={() => onNeedsAssignment(!needsAssignmentOnly)}
                >
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    Needs assignment ({assignmentCount})
                </Button>
            )}
            {hasFilters && (
                <Button size="sm" variant="quiet" onClick={onReset}>
                    Clear filters
                </Button>
            )}
        </section>
    );
}

function ScheduleControls({
    date,
    mode,
    period,
    onDate,
    onMode,
    onPeriod,
}: {
    date: string;
    mode: DispatchDeskMode;
    period: DispatchDeskPeriod;
    onDate: (value: string) => void;
    onMode: (value: DispatchDeskMode) => void;
    onPeriod: (value: DispatchDeskPeriod) => void;
}) {
    const showDateAndPeriod = mode !== 'resources';

    return (
        <section
            className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas px-5 py-3 lg:px-7"
            aria-label="Schedule controls"
        >
            <div className="flex flex-wrap items-center gap-2">
                <div
                    className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-1"
                    role="group"
                    aria-label="Schedule display"
                >
                    {(
                        [
                            ['list', 'List'],
                            ['calendar', 'Calendar'],
                            ['resources', 'Resource coverage'],
                        ] as Array<[DispatchDeskMode, string]>
                    ).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={mode === value}
                            onClick={() => onMode(value)}
                            className={cn(
                                'min-h-11 rounded-md px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                                mode === value
                                    ? 'bg-brand-soft text-ink'
                                    : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {showDateAndPeriod && mode !== 'list' && (
                    <div
                        className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1"
                        role="group"
                        aria-label="Schedule period"
                    >
                        {(['day', 'week', 'month'] as DispatchDeskPeriod[]).map(
                            (value) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={period === value}
                                    onClick={() => onPeriod(value)}
                                    className={cn(
                                        'min-h-11 rounded-md px-3 text-xs font-semibold capitalize focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                                        period === value
                                            ? 'bg-brand-soft text-ink'
                                            : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    {value}
                                </button>
                            ),
                        )}
                    </div>
                )}
            </div>
            {showDateAndPeriod && (
                <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
                    <span className="sr-only">Selected schedule date</span>
                    <CalendarDays
                        className="h-4 w-4 text-ink-soft"
                        aria-hidden="true"
                    />
                    <input
                        type="date"
                        value={date}
                        onChange={(event) => onDate(event.target.value)}
                        className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                    />
                </label>
            )}
        </section>
    );
}

function ScheduleSurface({
    mode,
    jobs,
    assets,
    users,
    conflicts,
    date,
    period,
    resourceCoverage,
    onDate,
    onSelectJob,
}: {
    mode: DispatchDeskMode;
    jobs: DispatchJobViewModel[];
    assets: DispatchDeskProps['assets'];
    users: DispatchDeskProps['users'];
    conflicts: DerivedConflict[];
    date: string;
    period: DispatchDeskPeriod;
    resourceCoverage?: ReactNode;
    onDate: (value: string) => void;
    onSelectJob: (id: number) => void;
}) {
    const safeAssets = assets ?? [];
    const safeUsers = users ?? [];

    if (mode === 'resources') {
        return (
            <>
                {resourceCoverage ?? (
                    <EmptyState
                        icon={Users}
                        title="Resource coverage unavailable"
                        message="This workspace did not provide an operational coverage surface for the selected planning context."
                    />
                )}
            </>
        );
    }

    return (
        <div className="space-y-3 border-b border-line bg-canvas p-4 lg:p-6">
            {period === 'day' ? (
                <div className="overflow-hidden rounded-xl border border-line bg-surface">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 md:px-5">
                        <div>
                            <h2 className="text-base font-semibold text-ink">
                                {formatDateLabel(date)}
                            </h2>
                            <p className="mt-1 text-xs text-ink-soft">
                                Calendar planning uses recorded schedule
                                intervals.
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                size="iconSm"
                                variant="secondary"
                                aria-label="Previous day"
                                onClick={() => onDate(shiftLocalDate(date, -1))}
                            >
                                <ChevronLeft
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => onDate(localDateKey(new Date()))}
                            >
                                Today
                            </Button>
                            <Button
                                size="iconSm"
                                variant="secondary"
                                aria-label="Next day"
                                onClick={() => onDate(shiftLocalDate(date, 1))}
                            >
                                <ChevronRight
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                            </Button>
                        </div>
                    </div>
                    <ScheduleBoardTable
                        jobs={jobs}
                        assets={safeAssets}
                        users={safeUsers}
                        derivedConflicts={conflicts}
                        category="all"
                        conflictsOnly={false}
                        selectedDate={date}
                        onSelectJob={onSelectJob}
                    />
                </div>
            ) : period === 'week' ? (
                <ScheduleBoardWeekView
                    jobs={jobs}
                    assets={safeAssets}
                    users={safeUsers}
                    selectedDate={date}
                    onSelectDate={onDate}
                    onSelectJob={onSelectJob}
                    category="all"
                    conflictsOnly={false}
                    derivedConflicts={conflicts}
                />
            ) : (
                <ScheduleBoardMonthView
                    jobs={jobs}
                    assets={safeAssets}
                    selectedDate={date}
                    onSelectDate={onDate}
                    onSelectJob={onSelectJob}
                    category="all"
                    conflictsOnly={false}
                    derivedConflicts={conflicts}
                    users={safeUsers}
                />
            )}
        </div>
    );
}
function DeskJobList({
    jobs,
    conflicts,
    selectedJobId,
    refreshing,
    onSelectJob,
}: {
    jobs: DispatchJobViewModel[];
    conflicts: DerivedConflict[];
    selectedJobId: number | null;
    refreshing: boolean;
    onSelectJob: (id: number) => void;
}) {
    return (
        <aside
            className="min-w-0 border-b border-line bg-surface lg:border-r lg:border-b-0"
            aria-label="Dispatch list"
        >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">Dispatches</h2>
                <span className="text-xs text-ink-soft">{jobs.length}</span>
            </div>
            {refreshing && jobs.length === 0 ? (
                <DeskListSkeleton />
            ) : jobs.length === 0 ? (
                <EmptyState
                    compact
                    icon={ClipboardList}
                    title="No dispatches match"
                    message="Clear a filter, choose another schedule date, or check another results page."
                />
            ) : (
                <ul className="divide-y divide-line">
                    {jobs.map((job) => {
                        const hasAttention = conflicts.some(
                            (conflict) => conflict.jobId === job.id,
                        );
                        const resources = resourceLabel(job);
                        const nextAction = nextActionForJob(job, conflicts);

                        return (
                            <li key={job.id}>
                                <button
                                    type="button"
                                    id={`dispatch-row-${job.id}`}
                                    onClick={() => onSelectJob(job.id)}
                                    aria-current={
                                        selectedJobId === job.id
                                            ? 'true'
                                            : undefined
                                    }
                                    className={cn(
                                        'flex min-h-[104px] w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none focus-visible:ring-inset',
                                        selectedJobId === job.id &&
                                            'bg-brand-soft/60',
                                    )}
                                >
                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-ink-soft">
                                        {jobGroup(job) === 'execution' ? (
                                            <Truck
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                            />
                                        ) : jobGroup(job) === 'history' ? (
                                            <FileText
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <ClipboardList
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-xs font-bold text-ink">
                                                {job.reference}
                                            </span>
                                            <CanonicalStatusBadge
                                                status={job.status}
                                            />
                                            {job.priority.value !==
                                                'routine' && (
                                                <span
                                                    className={cn(
                                                        'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                                                        priorityClasses(
                                                            job.priority.value,
                                                        ),
                                                    )}
                                                >
                                                    {job.priority.label}
                                                </span>
                                            )}
                                            {hasAttention && (
                                                <AlertTriangle
                                                    className="h-3.5 w-3.5 text-danger"
                                                    aria-label="Needs attention"
                                                />
                                            )}
                                        </span>
                                        <span className="mt-1 block truncate text-sm font-semibold text-ink">
                                            {job.title}
                                        </span>
                                        <span className="mt-1 flex items-center gap-1 truncate text-xs text-ink-soft">
                                            <MapPin
                                                className="h-3 w-3 shrink-0"
                                                aria-hidden="true"
                                            />
                                            {job.site || 'Site not recorded'}
                                        </span>
                                        <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-ink-soft">
                                            <span className="flex min-w-0 items-center gap-1 truncate">
                                                <Users
                                                    className="h-3 w-3 shrink-0"
                                                    aria-hidden="true"
                                                />
                                                {resources}
                                            </span>
                                            <span className="shrink-0">
                                                {formatDateTime(
                                                    job.scheduled_start,
                                                )}
                                            </span>
                                        </span>
                                        <span className="mt-1 block truncate text-[11px] font-semibold text-ink-soft">
                                            Next: {nextAction.label}
                                        </span>
                                    </span>
                                    <ChevronRight
                                        className="mt-2 h-4 w-4 shrink-0 text-ink-soft"
                                        aria-hidden="true"
                                    />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </aside>
    );
}

function DispatchReviewPanel({
    job,
    conflicts,
    returnTo,
    recommendations,
    capabilities,
}: {
    job: DispatchJobViewModel | null;
    conflicts: DerivedConflict[];
    returnTo: string;
    recommendations: GptRecommendationViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const [expandedJobId, setExpandedJobId] = useState<number | null>(null);

    if (!job) {
        return (
            <section
                className="min-w-0 bg-canvas p-4 md:p-6"
                aria-label="Dispatch review"
            >
                <Panel>
                    <EmptyState
                        icon={ClipboardList}
                        title="Select a dispatch"
                        message="Choose a dispatch to review its schedule, site, recorded resources, and next permitted action."
                    />
                </Panel>
            </section>
        );
    }

    const nextAction = nextActionForJob(job, conflicts);
    const href = dispatchDetailUrl(job, returnTo, conflicts);
    const contextHref = EXECUTION_STATUSES.includes(
        job.status.value as (typeof EXECUTION_STATUSES)[number],
    )
        ? href
        : href.replace(/#.*$/, '#dispatch-context');
    const assignmentHref = `/operations/dispatch-jobs/${job.id}?${new URLSearchParams({ return_to: returnTo }).toString()}#assignment-summary`;

    return (
        <section
            className="@container min-w-0 bg-canvas p-4 md:p-6"
            aria-labelledby="dispatch-review-heading"
        >
            <div className="grid min-w-0 items-start gap-5 @2xl:grid-cols-[minmax(0,1fr)_20rem] @5xl:grid-cols-[minmax(0,1fr)_22rem]">
                <Panel className="min-w-0 overflow-hidden">
                    <div className="border-b border-line px-4 py-4 md:px-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold tracking-wide text-ink-soft">
                                        {job.reference}
                                    </span>
                                    <CanonicalStatusBadge status={job.status} />
                                    {job.priority.value !== 'routine' && (
                                        <span
                                            className={cn(
                                                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                                priorityClasses(
                                                    job.priority.value,
                                                ),
                                            )}
                                        >
                                            {job.priority.label}
                                        </span>
                                    )}
                                </div>
                                <h2
                                    id="dispatch-review-heading"
                                    className="mt-2 text-xl font-semibold tracking-[-0.02em] text-ink"
                                >
                                    {job.title}
                                </h2>
                                <p className="mt-1 text-sm text-ink-soft">
                                    {job.client}
                                </p>
                            </div>
                            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-ink">
                                {nextAction.group === 'execution'
                                    ? 'Field execution'
                                    : nextAction.group === 'history'
                                      ? 'History'
                                      : 'Preparation'}
                            </span>
                        </div>
                        {job.status.value === 'draft' && (
                            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-brand-strong">
                                <Users
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                />
                                <span>
                                    Module 2 · Ready for driver/operator &amp;
                                    equipment assignment
                                </span>
                            </div>
                        )}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Link
                                href={href}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-contrast shadow-xs transition-colors hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
                            >
                                {nextAction.label}
                                <ChevronRight
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                            </Link>
                            <a
                                href="#dispatch-ai-assistance"
                                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-ink underline decoration-brand underline-offset-2"
                            >
                                AI assistance
                            </a>
                            <span className="text-xs text-ink-soft">
                                {nextAction.group === 'preparation'
                                    ? 'Review the remaining requirements before activation.'
                                    : nextAction.group === 'execution'
                                      ? 'Review the latest field updates.'
                                      : 'Review the outcome and dispatch history.'}
                            </span>
                        </div>
                    </div>

                    <div className="grid gap-x-8 px-4 py-4 md:px-5 @lg:grid-cols-2">
                        <dl className="divide-y divide-line">
                            <DataPair
                                label="Site"
                                value={
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin
                                            className="h-3.5 w-3.5 text-ink-soft"
                                            aria-hidden="true"
                                        />
                                        {job.site || 'Site not recorded'}
                                    </span>
                                }
                            />
                            <DataPair
                                label="Schedule"
                                value={
                                    <span className="inline-flex items-center gap-1.5">
                                        <Clock3
                                            className="h-3.5 w-3.5 text-ink-soft"
                                            aria-hidden="true"
                                        />
                                        {formatSchedule(job)}
                                    </span>
                                }
                            />
                            <DataPair
                                label="Source"
                                value={job.source?.label ?? 'Direct intake'}
                            />
                        </dl>
                        <div className="border-t border-line pt-3 @lg:border-t-0 @lg:pt-0">
                            <h3 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                Requirements
                            </h3>
                            {job.requirements.length > 0 ? (
                                <ul className="mt-2 space-y-2 text-sm text-ink">
                                    {job.requirements.map((requirement) => (
                                        <li
                                            key={requirement}
                                            className="flex items-start gap-2"
                                        >
                                            <span
                                                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                                                aria-hidden="true"
                                            />
                                            {requirement}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-2 text-sm text-ink-soft">
                                    No requirements recorded.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-5 border-t border-line px-4 py-4 md:px-5 @lg:grid-cols-2">
                        <section aria-labelledby="assigned-personnel-heading">
                            <div className="flex items-center justify-between">
                                <h3
                                    id="assigned-personnel-heading"
                                    className="text-sm font-semibold text-ink"
                                >
                                    Assigned personnel
                                </h3>
                                <Link
                                    href={assignmentHref}
                                    className="text-xs font-semibold text-ink underline decoration-brand underline-offset-2 hover:text-brand-strong"
                                >
                                    {job.personnel_assignments.length === 0
                                        ? '+ Assign crew'
                                        : 'Manage crew'}
                                </Link>
                            </div>
                            {job.personnel_assignments.length === 0 ? (
                                <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-line p-3 text-xs text-ink-soft">
                                    <span>No personnel assigned.</span>
                                    <Link
                                        href={assignmentHref}
                                        className="font-semibold text-ink underline decoration-brand underline-offset-2 hover:text-brand-strong"
                                    >
                                        + Assign crew
                                    </Link>
                                </div>
                            ) : (
                                <ul className="mt-2 space-y-3">
                                    {job.personnel_assignments.map(
                                        (assignment) => (
                                            <li
                                                key={assignment.id}
                                                className="text-sm text-ink"
                                            >
                                                <p className="font-medium">
                                                    {assignment.name}
                                                </p>
                                                <p className="text-xs text-ink-soft">
                                                    {humanize(assignment.type)}{' '}
                                                    ·{' '}
                                                    {
                                                        assignment
                                                            .response_status
                                                            .label
                                                    }
                                                </p>
                                            </li>
                                        ),
                                    )}
                                </ul>
                            )}
                        </section>
                        <section aria-labelledby="assigned-equipment-heading">
                            <div className="flex items-center justify-between">
                                <h3
                                    id="assigned-equipment-heading"
                                    className="text-sm font-semibold text-ink"
                                >
                                    Assigned equipment
                                </h3>
                                <Link
                                    href={assignmentHref}
                                    className="text-xs font-semibold text-ink underline decoration-brand underline-offset-2 hover:text-brand-strong"
                                >
                                    {job.asset_assignments.length === 0
                                        ? '+ Assign equipment'
                                        : 'Change / Reassign'}
                                </Link>
                            </div>
                            {job.asset_assignments.length === 0 ? (
                                <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-line p-3 text-xs text-ink-soft">
                                    <span>No equipment assigned.</span>
                                    <Link
                                        href={assignmentHref}
                                        className="font-semibold text-ink underline decoration-brand underline-offset-2 hover:text-brand-strong"
                                    >
                                        + Assign equipment
                                    </Link>
                                </div>
                            ) : (
                                <ul className="mt-2 space-y-3">
                                    {job.asset_assignments.map((assignment) => (
                                        <li
                                            key={assignment.id}
                                            className="text-sm text-ink"
                                        >
                                            <p className="font-medium">
                                                {assignment.code} ·{' '}
                                                {assignment.name}
                                            </p>
                                            <p className="text-xs text-ink-soft">
                                                {humanize(
                                                    assignment.subtype ??
                                                        assignment.kind ??
                                                        assignment.type,
                                                )}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>

                    {conflicts.length > 0 && (
                        <div
                            className="border-t border-line bg-warning-soft/40 px-4 py-4 md:px-5"
                            aria-label="Dispatch blockers and approvals"
                        >
                            <div className="flex items-start gap-2">
                                <AlertTriangle
                                    className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong"
                                    aria-hidden="true"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h3 className="text-sm font-semibold text-warning-strong">
                                            Review before the next action
                                        </h3>
                                        <Link
                                            href={assignmentHref}
                                            className="text-xs font-semibold text-warning-strong underline underline-offset-2 hover:text-ink"
                                        >
                                            Resolve / Reassign in workspace →
                                        </Link>
                                    </div>
                                    <ul className="mt-2 space-y-2 text-sm text-ink">
                                        {(expandedJobId === job.id
                                            ? conflicts
                                            : conflicts.slice(0, 4)
                                        ).map((conflict) => (
                                            <li key={conflict.id}>
                                                <span className="font-semibold">
                                                    {conflict.title}.
                                                </span>{' '}
                                                {conflict.actionRequired}
                                                {conflict.type === 'approval' &&
                                                    conflict.canDecide ===
                                                        false &&
                                                    conflict.decisionBlocker && (
                                                        <span className="block text-xs text-ink-soft">
                                                            {
                                                                conflict.decisionBlocker
                                                            }
                                                        </span>
                                                    )}
                                            </li>
                                        ))}
                                    </ul>
                                    {conflicts.length > 4 && (
                                        <button
                                            type="button"
                                            aria-expanded={
                                                expandedJobId === job.id
                                            }
                                            onClick={() =>
                                                setExpandedJobId(
                                                    expandedJobId === job.id
                                                        ? null
                                                        : job.id,
                                                )
                                            }
                                            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-brand"
                                        >
                                            {expandedJobId === job.id
                                                ? 'Show fewer issues'
                                                : `Show ${conflicts.length - 4} more issues`}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-ink-soft md:px-5">
                        <span>
                            Updated{' '}
                            {job.updated_at
                                ? formatDateTime(job.updated_at)
                                : 'time not recorded'}
                        </span>
                        <Link
                            href={contextHref}
                            className="inline-flex min-h-11 items-center px-1 font-semibold text-ink underline decoration-brand underline-offset-2 hover:decoration-2"
                        >
                            View dispatch context
                        </Link>
                    </div>
                </Panel>
                <div
                    id="dispatch-ai-assistance"
                    className="min-w-0 scroll-mt-4"
                >
                    <DispatchGptAdvisory
                        key={job.id}
                        job={job}
                        recommendations={recommendations}
                        capabilities={capabilities}
                    />
                </div>
            </div>
        </section>
    );
}

function DeskListSkeleton() {
    return (
        <div className="space-y-px" aria-label="Loading dispatches">
            {[1, 2, 3, 4].map((item) => (
                <div key={item} className="border-b border-line px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <Skeleton className="h-3.5 w-20" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="mt-2 h-4 w-40" />
                    <Skeleton className="mt-2 h-3 w-32" />
                    <Skeleton className="mt-2 h-3 w-48" />
                </div>
            ))}
        </div>
    );
}

export { dispatchDetailUrl, formatSchedule, matchesStatus };
