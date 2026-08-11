import {
    AlertTriangle,
    ArrowRight,
    Bot,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronDown,
    ClipboardList,
    Filter,
    MessageSquareText,
    Route,
    SearchX,
    ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { LocalOperationsMap } from '@/components/local-operations-map';
import {
    Button,
    DataPair,
    EmptyState,
    InlineNotice,
    PageHeading,
    Panel,
    StatusBadge,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
    DispatchJob,
    GptProposal,
    Resource,
    TelemetryPoint,
} from '@/types/operations';

export function GuidedDispatch({
    jobs,
    resources,
    proposal,
    selectedJobId,
    query,
    onClearQuery,
    onSelectJob,
    onResolveConflict,
    onConfirmDispatch,
}: {
    jobs: DispatchJob[];
    resources: Resource[];
    proposal: GptProposal;
    selectedJobId: string;
    query: string;
    onClearQuery: () => void;
    onSelectJob: (jobId: string) => void;
    onResolveConflict: (conflictId: string) => void;
    onConfirmDispatch: (jobId: string) => void;
}) {
    const filteredJobs = jobs.filter((job) =>
        `${job.reference} ${job.client} ${job.title} ${job.site}`
            .toLowerCase()
            .includes(query.toLowerCase()),
    );
    const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
    const assignedCrane = resources.find(
        (resource) => resource.id === proposal.proposedAssignment.craneId,
    );
    const assignedOperator = resources.find(
        (resource) => resource.id === proposal.proposedAssignment.operatorId,
    );
    const unresolvedCount = proposal.conflicts.filter(
        (conflict) => !conflict.resolved,
    ).length;

    const pageActions = (
        <>
            <Button variant="secondary">
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                Contact field team
            </Button>
            <Button variant="primary">Create service request</Button>
        </>
    );

    if (!selectedJob) {
        return (
            <div>
                <PageHeading
                    title="Dispatch workspace"
                    description="Review the request, resolve operational conflicts, and confirm the prepared resource plan."
                    actions={pageActions}
                />
                <div className="p-4 md:p-6">
                    <Panel>
                        <EmptyState
                            icon={ClipboardList}
                            title="No dispatch requests available"
                            message="New service requests and jobs will appear here when they are ready for dispatch review."
                        />
                    </Panel>
                </div>
            </div>
        );
    }

    return (
        <div>
            <PageHeading
                title="Dispatch workspace"
                description="Review the request, resolve operational conflicts, and confirm the prepared resource plan."
                actions={pageActions}
            />

            <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 min-[1400px]:grid-cols-[18rem_minmax(0,1fr)_22rem] lg:grid-cols-[16rem_minmax(0,1fr)]">
                <aside className="border-b border-line bg-surface min-[1400px]:row-span-1 lg:row-span-2 lg:border-r lg:border-b-0">
                    <div className="flex items-center justify-between border-b border-line px-4 py-3">
                        <div>
                            <h2 className="text-sm font-semibold text-ink">
                                Request inbox
                            </h2>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                {filteredJobs.length} requests and jobs
                            </p>
                        </div>
                        <Button
                            size="icon"
                            variant="quiet"
                            aria-label="Filter request inbox"
                        >
                            <Filter className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </div>
                    {filteredJobs.length === 0 ? (
                        <EmptyState
                            compact
                            announce
                            icon={SearchX}
                            title="No matching requests"
                            message="Try a job reference, client, or site name."
                            primaryAction={
                                <Button
                                    variant="secondary"
                                    onClick={onClearQuery}
                                >
                                    Clear workspace search
                                </Button>
                            }
                        />
                    ) : (
                        <ul className="divide-y divide-line">
                            {filteredJobs.map((job) => (
                                <li key={job.id}>
                                    <button
                                        type="button"
                                        onClick={() => onSelectJob(job.id)}
                                        className={cn(
                                            'w-full px-4 py-4 text-left hover:bg-surface-subtle',
                                            job.id === selectedJob.id &&
                                                'bg-brand-soft',
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-ink">
                                                    {job.reference}
                                                </p>
                                                <p className="mt-1 text-sm leading-5 text-ink">
                                                    {job.title}
                                                </p>
                                            </div>
                                            <StatusBadge
                                                status={job.priority}
                                            />
                                        </div>
                                        <p className="mt-2 text-xs text-ink-soft">
                                            {job.client}
                                        </p>
                                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-soft">
                                            <span>{job.startTime}</span>
                                            <StatusBadge status={job.status} />
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>

                <div className="min-w-0 bg-canvas p-4 md:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">
                                {selectedJob.title}
                            </h2>
                            <StatusBadge status={selectedJob.status} />
                        </div>
                        <span className="text-xs text-ink-soft">
                            Updated two minutes ago
                        </span>
                    </div>

                    <div className="grid gap-4 2xl:grid-cols-[minmax(16rem,0.72fr)_minmax(24rem,1.28fr)]">
                        <Panel className="p-4">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="font-semibold text-ink">
                                    Request details
                                </h3>
                                <Button size="sm" variant="quiet">
                                    Edit request
                                </Button>
                            </div>
                            <dl className="mt-2 divide-y divide-line">
                                <DataPair
                                    label="Request"
                                    value={selectedJob.reference}
                                />
                                <DataPair
                                    label="Client"
                                    value={selectedJob.client}
                                />
                                <DataPair
                                    label="Contact"
                                    value={selectedJob.contact}
                                />
                                <DataPair
                                    label="Site"
                                    value={selectedJob.site}
                                />
                                <DataPair
                                    label="Work type"
                                    value={selectedJob.workType}
                                />
                                <DataPair
                                    label="Schedule"
                                    value={`${selectedJob.scheduledDate} · ${selectedJob.startTime}–${selectedJob.endTime}`}
                                />
                            </dl>
                            <div className="mt-4 rounded-lg bg-surface-subtle p-3">
                                <p className="text-xs font-semibold text-ink">
                                    Site note
                                </p>
                                <p className="mt-1 text-sm leading-5 text-ink-soft">
                                    {selectedJob.siteNote}
                                </p>
                            </div>
                        </Panel>

                        <div className="space-y-4">
                            <Panel className="p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-ink">
                                            Suggested assignment
                                        </h3>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-1 text-xs font-medium text-brand-strong">
                                            <Bot
                                                className="h-3.5 w-3.5"
                                                aria-hidden="true"
                                            />
                                            {proposal.state === 'Confirmed'
                                                ? 'Human-confirmed · Applied'
                                                : 'GPT draft · Not applied'}
                                        </span>
                                    </div>
                                    <span className="text-xs text-ink-soft">
                                        {proposal.generatedAt}
                                    </span>
                                </div>

                                <div className="mt-4 grid divide-y divide-line rounded-lg border border-line md:grid-cols-2 md:divide-x md:divide-y-0">
                                    <div className="p-4">
                                        <p className="text-xs font-medium text-success">
                                            Best equipment match
                                        </p>
                                        <p className="mt-1 font-semibold text-ink">
                                            {assignedCrane?.code} ·{' '}
                                            {assignedCrane?.name}
                                        </p>
                                        <p className="mt-1 text-sm text-ink-soft">
                                            Available at North Yard · 6.8 km
                                        </p>
                                    </div>
                                    <div className="p-4">
                                        <p className="text-xs font-medium text-success">
                                            Qualified operator
                                        </p>
                                        <p className="mt-1 font-semibold text-ink">
                                            {assignedOperator?.name}
                                        </p>
                                        <p className="mt-1 text-sm text-ink-soft">
                                            18 comparable lifts · Certification
                                            valid
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="quiet"
                                    size="sm"
                                    className="mt-3"
                                >
                                    Compare 2 alternative matches
                                    <ChevronDown
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                </Button>
                            </Panel>

                            <Panel className="overflow-hidden">
                                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                                    <div>
                                        <h3 className="font-semibold text-ink">
                                            Schedule and conflict check
                                        </h3>
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            {unresolvedCount === 0
                                                ? 'All required conflicts are resolved'
                                                : `${unresolvedCount} conflict requires review`}
                                        </p>
                                    </div>
                                    {unresolvedCount === 0 ? (
                                        <CheckCircle2
                                            className="h-5 w-5 text-success"
                                            aria-label="All conflicts resolved"
                                        />
                                    ) : (
                                        <AlertTriangle
                                            className="h-5 w-5 text-warning"
                                            aria-label="Conflict requires review"
                                        />
                                    )}
                                </div>
                                <div className="divide-y divide-line">
                                    {proposal.conflicts.map((conflict) => (
                                        <div
                                            key={conflict.id}
                                            className="grid gap-3 px-4 py-3 md:grid-cols-[10rem_1fr_auto] md:items-center"
                                        >
                                            <div className="flex items-center gap-2">
                                                {conflict.resolved ? (
                                                    <Check
                                                        className="h-4 w-4 text-success"
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <AlertTriangle
                                                        className="h-4 w-4 text-warning"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                <span className="text-sm font-semibold text-ink">
                                                    {conflict.title}
                                                </span>
                                            </div>
                                            <p className="text-sm leading-5 text-ink-soft">
                                                {conflict.detail}
                                            </p>
                                            {conflict.resolved ? (
                                                <StatusBadge status="Resolved" />
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        onResolveConflict(
                                                            conflict.id,
                                                        )
                                                    }
                                                >
                                                    Use 07:30 start
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </Panel>

                            <Panel className="p-4">
                                <h3 className="font-semibold text-ink">
                                    Why this match
                                </h3>
                                <ul className="mt-3 space-y-2.5">
                                    {proposal.reasons.map((reason) => (
                                        <li
                                            key={reason}
                                            className="flex items-start gap-2 text-sm leading-5 text-ink-soft"
                                        >
                                            <Check
                                                className="mt-0.5 h-4 w-4 shrink-0 text-success"
                                                aria-hidden="true"
                                            />
                                            {reason}
                                        </li>
                                    ))}
                                </ul>
                            </Panel>
                        </div>
                    </div>
                </div>

                <aside className="border-t border-line bg-surface p-4 min-[1400px]:col-start-auto min-[1400px]:border-t-0 min-[1400px]:border-l lg:col-start-2">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Bot
                                className="h-5 w-5 text-brand"
                                aria-hidden="true"
                            />
                            <h2 className="font-semibold text-ink">
                                Dispatch assistant
                            </h2>
                        </div>
                        <StatusBadge status={proposal.state} />
                    </div>
                    <InlineNotice
                        tone={
                            proposal.state === 'Confirmed' ? 'success' : 'info'
                        }
                        title={
                            proposal.state === 'Confirmed'
                                ? 'Human confirmation recorded'
                                : 'This is a draft plan'
                        }
                    >
                        {proposal.state === 'Confirmed'
                            ? 'The reviewed resource plan is now scheduled and visible to the field team.'
                            : 'Review the recommendation and confirm before any dispatch is scheduled.'}
                    </InlineNotice>

                    <div className="mt-5">
                        <h3 className="text-sm font-semibold text-ink">
                            Recommended plan
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-ink-soft">
                            {proposal.summary}
                        </p>
                    </div>

                    <div className="mt-5">
                        <h3 className="text-sm font-semibold text-ink">
                            Proposed schedule
                        </h3>
                        <ol className="mt-3 space-y-0">
                            {[
                                ['06:15', 'Crane clears North Yard'],
                                ['06:30', 'Crew arrival and setup'],
                                ['07:30', 'Start lift operation'],
                                ['15:30', 'Complete work'],
                                ['16:00', 'Depart site'],
                            ].map(([time, event], index, events) => (
                                <li
                                    key={time}
                                    className="grid grid-cols-[3.25rem_1rem_1fr] gap-2 text-xs"
                                >
                                    <span className="py-2 font-medium text-ink">
                                        {time}
                                    </span>
                                    <span className="relative flex justify-center">
                                        {index < events.length - 1 && (
                                            <span className="absolute top-3 bottom-0 w-px bg-line-strong" />
                                        )}
                                        <span className="relative mt-2.5 h-2 w-2 rounded-full bg-ink" />
                                    </span>
                                    <span className="py-2 text-ink-soft">
                                        {event}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="mt-5 border-t border-line pt-4">
                        <h3 className="text-sm font-semibold text-ink">
                            Assumptions
                        </h3>
                        <ul className="mt-2 space-y-2 text-xs leading-5 text-ink-soft">
                            {proposal.assumptions.map((assumption) => (
                                <li key={assumption}>• {assumption}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="mt-5 space-y-2">
                        <Button className="w-full" variant="secondary">
                            Review change summary
                        </Button>
                        <Button
                            className="w-full"
                            variant="primary"
                            onClick={() => onConfirmDispatch(selectedJob.id)}
                            disabled={proposal.state === 'Confirmed'}
                        >
                            {proposal.state === 'Confirmed' ? (
                                <>
                                    <Check
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                    Dispatch confirmed
                                </>
                            ) : (
                                <>
                                    Confirm dispatch
                                    <ArrowRight
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                </>
                            )}
                        </Button>
                        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-soft">
                            <ShieldCheck
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                            />
                            {proposal.state === 'Confirmed'
                                ? 'Human confirmation recorded'
                                : 'Human confirmation required'}
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}

const boardRows = [
    { resourceId: 'cr-220-01', category: 'Cranes' },
    { resourceId: 'cr-250-04', category: 'Cranes' },
    { resourceId: 'cr-160-02', category: 'Cranes' },
    { resourceId: 'cr-110-03', category: 'Cranes' },
    { resourceId: 'tr-01', category: 'Trucks' },
    { resourceId: 'tr-02', category: 'Trucks' },
    { resourceId: 'tr-03', category: 'Trucks' },
    { resourceId: 'eq-ml-01', category: 'Support equipment' },
];

function boardPosition(job: DispatchJob) {
    const [hour = 7, minutes = 0] = job.startTime.split(':').map(Number);
    const [endHour = hour + 2, endMinutes = 0] = job.endTime
        .split(':')
        .map(Number);
    const start = Math.max(0, (hour - 7) * 60 + minutes);
    const duration = Math.max(90, (endHour - hour) * 60 + endMinutes - minutes);

    return {
        left: `${(start / 660) * 100}%`,
        width: `${Math.min((duration / 660) * 100, 100 - (start / 660) * 100)}%`,
    };
}

export function DispatchBoard({
    jobs,
    resources,
    selectedJobId,
    query,
    onClearQuery,
    onSelectJob,
}: {
    jobs: DispatchJob[];
    resources: Resource[];
    selectedJobId: string;
    query: string;
    onClearQuery: () => void;
    onSelectJob: (jobId: string) => void;
}) {
    const [conflictsOnly, setConflictsOnly] = useState(false);
    const filteredJobs = jobs.filter((job) =>
        `${job.reference} ${job.title} ${job.client}`
            .toLowerCase()
            .includes(query.toLowerCase()),
    );
    const categories = Array.from(
        new Set(boardRows.map((row) => row.category)),
    );
    const boardResourceIds = new Set(boardRows.map((row) => row.resourceId));
    const hasVisibleJobs = filteredJobs.some(
        (job) =>
            (!conflictsOnly || job.reference === 'CON-1256') &&
            Object.values(job.assignment).some((value) =>
                Array.isArray(value)
                    ? value.some((resourceId) =>
                          boardResourceIds.has(resourceId),
                      )
                    : boardResourceIds.has(value),
            ),
    );
    const clearBoardFilters = () => {
        setConflictsOnly(false);
        onClearQuery();
    };

    return (
        <div>
            <PageHeading
                title="Dispatch board"
                description="Coordinate cranes, trucks, and support equipment against today’s operating windows."
                actions={
                    <>
                        <Button variant="secondary">
                            <CalendarDays
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                            July 17, 2026
                        </Button>
                        <Button
                            variant={conflictsOnly ? 'primary' : 'secondary'}
                            onClick={() => setConflictsOnly((value) => !value)}
                            aria-pressed={conflictsOnly}
                        >
                            <AlertTriangle
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                            Conflicts only
                        </Button>
                    </>
                }
            />

            <div className="overflow-x-auto p-4 md:p-6">
                <Panel className="min-w-[68rem] overflow-hidden">
                    {(query || conflictsOnly) && !hasVisibleJobs && (
                        <EmptyState
                            compact
                            announce
                            icon={SearchX}
                            className="border-b border-line"
                            title="No jobs match the board filters"
                            message="Clear the workspace search and conflict filter to restore scheduled work."
                            primaryAction={
                                <Button
                                    variant="secondary"
                                    onClick={clearBoardFilters}
                                >
                                    Clear board filters
                                </Button>
                            }
                        />
                    )}
                    <div className="grid grid-cols-[15rem_minmax(52rem,1fr)] border-b border-line bg-surface-subtle">
                        <div className="border-r border-line px-4 py-3 text-sm font-semibold text-ink">
                            Resources
                        </div>
                        <div className="grid grid-cols-11">
                            {Array.from({ length: 11 }, (_, index) => (
                                <div
                                    key={index}
                                    className="border-r border-line px-2 py-3 text-center text-xs text-ink-soft last:border-r-0"
                                >
                                    {index + 7 > 12
                                        ? `${index - 5} PM`
                                        : `${index + 7} AM`}
                                </div>
                            ))}
                        </div>
                    </div>

                    {categories.map((category) => (
                        <div key={category}>
                            <div className="grid grid-cols-[15rem_minmax(52rem,1fr)] border-b border-line bg-canvas">
                                <div className="px-4 py-2 text-xs font-semibold text-ink-soft">
                                    {category}
                                </div>
                                <div />
                            </div>
                            {boardRows
                                .filter((row) => row.category === category)
                                .map((row) => {
                                    const resource = resources.find(
                                        (item) => item.id === row.resourceId,
                                    );
                                    const rowJobs = filteredJobs.filter((job) =>
                                        Object.values(job.assignment).some(
                                            (value) =>
                                                Array.isArray(value)
                                                    ? value.includes(
                                                          row.resourceId,
                                                      )
                                                    : value === row.resourceId,
                                        ),
                                    );

                                    return (
                                        <div
                                            key={row.resourceId}
                                            className="grid min-h-[4.75rem] grid-cols-[15rem_minmax(52rem,1fr)] border-b border-line last:border-b-0"
                                        >
                                            <div className="flex items-center justify-between gap-3 border-r border-line px-4 py-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-ink">
                                                        {resource?.code}
                                                    </p>
                                                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                                                        {resource?.name}
                                                    </p>
                                                </div>
                                                {resource && (
                                                    <StatusBadge
                                                        status={resource.status}
                                                    />
                                                )}
                                            </div>
                                            <div className="relative bg-[linear-gradient(to_right,var(--color-line)_1px,transparent_1px)] bg-[length:9.09%_100%]">
                                                {rowJobs.map((job) => {
                                                    const conflict =
                                                        job.reference ===
                                                        'CON-1256';

                                                    if (
                                                        conflictsOnly &&
                                                        !conflict
                                                    ) {
                                                        return null;
                                                    }

                                                    return (
                                                        <button
                                                            key={job.id}
                                                            type="button"
                                                            style={boardPosition(
                                                                job,
                                                            )}
                                                            onClick={() =>
                                                                onSelectJob(
                                                                    job.id,
                                                                )
                                                            }
                                                            className={cn(
                                                                'absolute top-2 bottom-2 min-w-24 overflow-hidden rounded-lg border px-2 py-1.5 text-left',
                                                                job.id ===
                                                                    selectedJobId
                                                                    ? 'border-brand bg-brand-soft ring-2 ring-brand/20'
                                                                    : 'border-blue-200 bg-blue-50 hover:border-brand',
                                                                conflict &&
                                                                    'border-warning bg-warning-soft',
                                                            )}
                                                            aria-label={`${job.reference}, ${job.title}, ${job.startTime} to ${job.endTime}`}
                                                        >
                                                            <span className="block truncate text-xs font-semibold text-ink">
                                                                {job.reference}
                                                            </span>
                                                            <span className="mt-0.5 block truncate text-[0.6875rem] text-ink-soft">
                                                                {job.startTime}–
                                                                {job.endTime}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-4 border-t border-line bg-surface-subtle px-4 py-3 text-xs text-ink-soft">
                        <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-sm border border-blue-300 bg-blue-50" />
                            Assigned
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-sm border border-warning bg-warning-soft" />
                            Conflict
                        </span>
                        <span className="ml-auto">
                            Select a job to open its assignment workspace
                        </span>
                    </div>
                </Panel>
            </div>
        </div>
    );
}

export function LiveOperations({
    telemetry,
    selectedAssetId,
    onSelectAsset,
}: {
    telemetry: TelemetryPoint[];
    selectedAssetId: string;
    onSelectAsset: (assetId: string) => void;
}) {
    const exceptionCount = telemetry.filter(
        (point) => point.freshness !== 'Live',
    ).length;

    return (
        <div>
            <PageHeading
                title="Live operations"
                description="Monitor routes, job-site geofences, signal freshness, and field exceptions from one operational view."
                actions={
                    <>
                        <Button variant="secondary">
                            <Route className="h-4 w-4" aria-hidden="true" />
                            Route options
                        </Button>
                        <Button variant="primary">
                            <AlertTriangle
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                            Review {exceptionCount} exceptions
                        </Button>
                    </>
                }
            />
            <div className="p-4 md:p-6">
                <Panel className="overflow-hidden">
                    {telemetry.length === 0 ? (
                        <EmptyState
                            icon={Route}
                            title="No live telemetry available"
                            message="Asset positions and signal freshness will appear after telemetry is received."
                        />
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-success" />
                                    <span className="text-sm font-semibold text-ink">
                                        Prototype telemetry is updating
                                    </span>
                                </div>
                                <p className="text-xs text-ink-soft">
                                    Last simulation tick · 10:14:32
                                </p>
                            </div>
                            <LocalOperationsMap
                                points={telemetry}
                                selectedId={selectedAssetId}
                                onSelect={onSelectAsset}
                            />
                        </>
                    )}
                </Panel>
            </div>
        </div>
    );
}
