import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    BadgeCheck,
    CalendarClock,
    CircleAlert,
    Clock3,
    PlayCircle,
    RefreshCw,
    Siren,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { cn } from '@/lib/utils';
import type { DispatchJobViewModel } from '@/types/workspace';
import type {
    ScheduleSourceFilter,
    ScheduleState,
    TimelineWindow,
} from './manager-dashboard-model';
import {
    SCHEDULE_STATE_LABELS,
    SCHEDULE_STATE_ORDER,
    countBySource,
    dispatchDetailHref,
    formatClockTime,
    jobInterval,
    localDayBounds,
    matchesScheduleSource,
    nowMarkerPercent,
    partitionTodayJobs,
    scheduleState,
    sortScheduleJobs,
    sourceLabel,
    summarizeSchedule,
    timelineBar,
    timelineWindow,
    upcomingJobs,
} from './manager-dashboard-model';
import { SCHEDULE_STATE_TONES } from './manager-metric-strip';
import {
    FilterButton,
    FilterGroup,
    LegendSwatch,
    SourceChip,
    swatchFill,
} from './manager-ui';
import type { TodayDispatches } from './use-today-dispatches';

const SCHEDULE_PREVIEW_LIMIT = 6;
const SCHEDULE_ROWS_ID = 'manager-schedule-rows';
const LABEL_COLUMN = '11.5rem';

const SOURCE_FILTERS: Array<{ value: ScheduleSourceFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'service', label: 'Service' },
    { value: 'rental', label: 'Rental' },
    { value: 'manual', label: 'Manual intake' },
];

const BAR_STYLES: Record<
    ScheduleState,
    { icon: LucideIcon; className: string }
> = {
    in_progress: {
        icon: PlayCircle,
        className: 'border-success/45 bg-success-soft text-success-strong',
    },
    scheduled: {
        icon: Clock3,
        className: 'border-info/40 bg-info-soft text-info-strong',
    },
    awaiting_approval: {
        icon: BadgeCheck,
        className:
            'border-dashed border-warning bg-warning-soft text-warning-strong',
    },
    needs_resources: {
        icon: AlertTriangle,
        className: 'border-warning/50 text-warning-strong',
    },
};

const hourFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});
const upcomingFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

export interface ManagerSchedulePanelProps {
    today: TodayDispatches;
    now: number;
    sourceFilter: ScheduleSourceFilter;
    onSourceFilterChange: (filter: ScheduleSourceFilter) => void;
    /** Server-ranked active and upcoming jobs from the overview props. */
    fallbackJobs: DispatchJobViewModel[];
    sosDispatchIds: ReadonlySet<number>;
    canOpenDispatch: boolean;
    onOpenDispatch: () => void;
}

export function ManagerSchedulePanel({
    today,
    now,
    sourceFilter,
    onSourceFilterChange,
    fallbackJobs,
    sosDispatchIds,
    canOpenDispatch,
    onOpenDispatch,
}: ManagerSchedulePanelProps) {
    const [expanded, setExpanded] = useState(false);
    const { dated, undated } = partitionTodayJobs(today.jobs, now);
    const sourceCounts = countBySource(dated);
    const filtered = sortScheduleJobs(
        dated.filter((job) => matchesScheduleSource(job, sourceFilter)),
    );
    const summary = summarizeSchedule(filtered);
    const timeline = timelineWindow(dated, now);
    const rows = expanded
        ? filtered
        : filtered.slice(0, SCHEDULE_PREVIEW_LIMIT);
    const upcoming = upcomingJobs(
        fallbackJobs,
        new Set(dated.map((job) => job.id)),
    );
    const filterLabel =
        SOURCE_FILTERS.find((option) => option.value === sourceFilter)?.label ??
        'All';

    const changeSource = (filter: ScheduleSourceFilter) => {
        onSourceFilterChange(filter);
        setExpanded(false);
    };

    return (
        <section
            aria-labelledby="manager-schedule-heading"
            className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface"
        >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
                <div className="min-w-0">
                    <h2
                        id="manager-schedule-heading"
                        className="text-lg font-semibold tracking-tight text-ink"
                    >
                        Dispatch overview &amp; schedule
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-soft tabular-nums">
                        Today · {formatClockTime(timeline.start)}–
                        {formatClockTime(timeline.end)} · your local time
                    </p>
                </div>
                {canOpenDispatch && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onOpenDispatch}
                    >
                        Open schedule
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                )}
            </header>

            {today.status === 'loading' ? (
                <ScheduleSkeleton />
            ) : today.status === 'forbidden' ? (
                <EmptyState
                    compact
                    icon={CalendarClock}
                    title="Schedule not available"
                    message="Your role cannot view the dispatch schedule."
                />
            ) : today.status === 'error' ? (
                <div className="p-4 sm:p-5">
                    <ScheduleError
                        message={today.error}
                        onRetry={today.retry}
                    />
                </div>
            ) : (
                <>
                    {dated.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-line px-4 py-2.5 sm:px-5">
                            <FilterGroup label="Filter schedule by source">
                                {SOURCE_FILTERS.filter(
                                    (option) =>
                                        option.value !== 'manual' ||
                                        sourceCounts.manual > 0 ||
                                        sourceFilter === 'manual',
                                ).map((option) => (
                                    <FilterButton
                                        key={option.value}
                                        label={option.label}
                                        count={sourceCounts[option.value]}
                                        pressed={sourceFilter === option.value}
                                        onClick={() =>
                                            changeSource(option.value)
                                        }
                                    />
                                ))}
                            </FilterGroup>
                            <div
                                role="group"
                                aria-label="Schedule status counts"
                                className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-ink-soft tabular-nums"
                            >
                                {SCHEDULE_STATE_ORDER.map((state) => (
                                    <span
                                        key={state}
                                        className="inline-flex items-center gap-1.5"
                                    >
                                        <LegendSwatch
                                            tone={SCHEDULE_STATE_TONES[state]}
                                        />
                                        <span className="font-semibold text-ink">
                                            {summary.counts[state]}
                                        </span>
                                        {SCHEDULE_STATE_LABELS[
                                            state
                                        ].toLowerCase()}
                                    </span>
                                ))}
                                {summary.delayReported > 0 && (
                                    <span className="inline-flex items-center gap-1.5 border-l border-line pl-3.5 text-danger-strong">
                                        <Clock3
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                        <span className="font-semibold">
                                            {summary.delayReported}
                                        </span>
                                        with a reported delay
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {today.error && (
                        <div className="border-b border-line px-4 py-2.5 sm:px-5">
                            <ScheduleError
                                compact
                                message={`Couldn't refresh the schedule${
                                    today.loadedAt
                                        ? ` · showing data loaded at ${formatClockTime(new Date(today.loadedAt))}`
                                        : ''
                                }.`}
                                onRetry={today.retry}
                            />
                        </div>
                    )}

                    {filtered.length > 0 ? (
                        <ScheduleTimeline
                            jobs={rows}
                            timeline={timeline}
                            now={now}
                            sosDispatchIds={sosDispatchIds}
                        />
                    ) : dated.length > 0 ? (
                        <EmptyState
                            compact
                            icon={CalendarClock}
                            title={`No ${filterLabel.toLowerCase()} dispatches today`}
                            message="Other sources still have work on today's schedule."
                            primaryAction={
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => changeSource('all')}
                                >
                                    Show all dispatches ({dated.length})
                                </Button>
                            }
                        />
                    ) : (
                        <>
                            <EmptyState
                                compact
                                icon={CalendarClock}
                                title="No dispatches on today's schedule"
                                message={
                                    upcoming.length > 0
                                        ? 'Nothing is scheduled for today. Your next active and upcoming work is listed below.'
                                        : 'Service and Rental dispatches appear here once they are scheduled for today.'
                                }
                            />
                            {upcoming.length > 0 && (
                                <UpNextList jobs={upcoming} />
                            )}
                        </>
                    )}

                    {(filtered.length > 0 || undated.length > 0) && (
                        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-sm text-ink-soft sm:px-5">
                            <span className="tabular-nums">
                                {filtered.length > 0
                                    ? `Showing ${rows.length} of ${filtered.length} today`
                                    : 'Unscheduled drafts are not placed on the timeline'}
                                {today.truncated &&
                                    ' · first 100 loaded, open the schedule for the rest'}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                                {undated.length > 0 && canOpenDispatch && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={onOpenDispatch}
                                        aria-label={`Open ${undated.length} unscheduled ${undated.length === 1 ? 'draft' : 'drafts'} in the dispatch workspace`}
                                    >
                                        <CalendarClock
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                        {undated.length} unscheduled{' '}
                                        {undated.length === 1
                                            ? 'draft'
                                            : 'drafts'}
                                    </Button>
                                )}
                                {filtered.length > SCHEDULE_PREVIEW_LIMIT && (
                                    <Button
                                        variant="quiet"
                                        size="sm"
                                        aria-expanded={expanded}
                                        aria-controls={SCHEDULE_ROWS_ID}
                                        onClick={() =>
                                            setExpanded((value) => !value)
                                        }
                                        className="font-semibold text-ink"
                                    >
                                        {expanded
                                            ? 'Show fewer'
                                            : `Show all ${filtered.length}`}
                                    </Button>
                                )}
                            </div>
                        </footer>
                    )}
                </>
            )}
        </section>
    );
}

function hourLabel(start: Date, hour: number): string {
    const date = new Date(start);
    date.setHours(hour, 0, 0, 0);

    return hourFormatter.format(date);
}

function ScheduleTimeline({
    jobs,
    timeline,
    now,
    sosDispatchIds,
}: {
    jobs: DispatchJobViewModel[];
    timeline: TimelineWindow;
    now: number;
    sosDispatchIds: ReadonlySet<number>;
}) {
    const nowPercent = nowMarkerPercent(timeline, now);
    const gridStyle: CSSProperties = {
        backgroundImage:
            'linear-gradient(to right, var(--color-line) 1px, transparent 1px)',
        backgroundSize: `${100 / timeline.hours.length}% 100%`,
    };

    return (
        <div className="relative px-4 pt-1 pb-3 sm:px-5 md:pb-8">
            <div
                aria-hidden="true"
                className="hidden text-[11px] font-medium text-muted tabular-nums md:grid"
                style={{
                    gridTemplateColumns: `${LABEL_COLUMN} minmax(0, 1fr)`,
                }}
            >
                <span />
                <div
                    className="grid"
                    style={{
                        gridTemplateColumns: `repeat(${timeline.hours.length}, minmax(0, 1fr))`,
                    }}
                >
                    {timeline.hours.map((hour) => (
                        <span
                            key={hour}
                            className="truncate border-l border-line py-1.5 pl-1"
                        >
                            {hourLabel(timeline.start, hour)}
                        </span>
                    ))}
                </div>
            </div>
            <div className="relative">
                {nowPercent !== null && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute top-0 -bottom-2 z-[1] hidden w-0.5 bg-ink md:block"
                        style={{
                            left: `calc(${LABEL_COLUMN} + (100% - ${LABEL_COLUMN}) * ${nowPercent / 100})`,
                        }}
                    >
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-surface tabular-nums">
                            {formatClockTime(new Date(now))}
                        </span>
                    </div>
                )}
                <ul
                    id={SCHEDULE_ROWS_ID}
                    className="divide-y divide-line border-t border-line"
                >
                    {jobs.map((job) => (
                        <ScheduleRow
                            key={job.id}
                            job={job}
                            timeline={timeline}
                            now={now}
                            hasSos={sosDispatchIds.has(job.id)}
                            gridStyle={gridStyle}
                        />
                    ))}
                </ul>
            </div>
        </div>
    );
}

function ScheduleRow({
    job,
    timeline,
    now,
    hasSos,
    gridStyle,
}: {
    job: DispatchJobViewModel;
    timeline: TimelineWindow;
    now: number;
    hasSos: boolean;
    gridStyle: CSSProperties;
}) {
    const state = scheduleState(job);
    const bar = timelineBar(job, timeline);
    const style = BAR_STYLES[state];
    const BarIcon = style.icon;
    const hatch =
        state === 'needs_resources'
            ? swatchFill('warning-hatched').style
            : undefined;
    const delay = state === 'in_progress' ? job.latest_delay : null;
    const barLabel =
        state === 'in_progress'
            ? job.status.label
            : state === 'scheduled'
              ? `Scheduled ${formatClockTime(job.scheduled_start)}`
              : SCHEDULE_STATE_LABELS[state];
    const timeRange = formatTimeRange(job, now);
    const delayText = delay ? `delay reported: ${delay.reason_label}` : null;
    const description = [
        timeRange,
        state === 'in_progress'
            ? `${SCHEDULE_STATE_LABELS.in_progress} · ${job.status.label}`
            : SCHEDULE_STATE_LABELS[state],
        delayText,
        hasSos ? 'SOS open' : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <li className="min-h-14 py-2 md:py-0">
            <div className="grid items-center gap-y-1 md:grid-cols-[11.5rem_minmax(0,1fr)]">
                <div className="min-w-0 pr-3">
                    <p className="flex items-center gap-1.5">
                        <Link
                            href={dispatchDetailHref(job.id)}
                            className="rounded-sm text-sm font-semibold text-ink hover:underline focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                        >
                            {job.reference}
                        </Link>
                        <SourceChip label={sourceLabel(job)} />
                    </p>
                    <p
                        className="truncate text-xs text-ink-soft"
                        title={`${job.title}${job.site ? ` · ${job.site}` : ''}`}
                    >
                        {job.title}
                        {job.site ? ` · ${job.site}` : ''}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft tabular-nums md:sr-only">
                        <span
                            className={cn(
                                'inline-flex h-5 items-center gap-1 rounded-[5px] border px-1.5 font-semibold',
                                style.className,
                            )}
                            style={hatch}
                        >
                            <BarIcon className="size-3" aria-hidden="true" />
                            {barLabel}
                        </span>
                        {hasSos && (
                            <span className="inline-flex h-5 items-center gap-1 rounded-[5px] bg-danger px-1.5 font-semibold text-danger-contrast">
                                <Siren className="size-3" aria-hidden="true" />
                                SOS open
                            </span>
                        )}
                        <span>
                            {timeRange}
                            {delayText ? ` · ${delayText}` : ''}
                        </span>
                    </p>
                </div>
                <div
                    aria-hidden="true"
                    className="relative hidden h-14 md:block"
                    style={gridStyle}
                >
                    {bar && (
                        <div
                            title={description}
                            className={cn(
                                'absolute top-3.5 z-[2] flex h-7 items-center gap-1.5 overflow-hidden rounded-md border px-2 text-xs font-semibold whitespace-nowrap',
                                style.className,
                                bar.startsBeforeWindow &&
                                    'rounded-l-none border-l-0',
                                bar.endsAfterWindow &&
                                    'rounded-r-none border-r-0',
                            )}
                            style={{
                                ...hatch,
                                left: `${bar.leftPercent}%`,
                                width: `max(${bar.widthPercent}%, 1.75rem)`,
                            }}
                        >
                            {bar.startsBeforeWindow && (
                                <span className="font-normal">◂</span>
                            )}
                            <BarIcon className="size-3.5 shrink-0" />
                            <span className="truncate">{barLabel}</span>
                            {delay && (
                                <span className="inline-flex shrink-0 items-center gap-1 text-danger-strong">
                                    <Clock3 className="size-3" />
                                    delay reported
                                </span>
                            )}
                            {hasSos && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-danger px-1 text-[11px] text-danger-contrast">
                                    <Siren className="size-3" />
                                    SOS
                                </span>
                            )}
                            {bar.endsAfterWindow && (
                                <span className="ml-auto font-normal">▸</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </li>
    );
}

function formatTimeRange(job: DispatchJobViewModel, now: number): string {
    const interval = jobInterval(job);

    if (!interval) {
        return 'Schedule not recorded';
    }

    const day = localDayBounds(now);
    const start =
        interval.start < day.start
            ? `from ${dateTimeFormatter.format(interval.start)}`
            : formatClockTime(interval.start);
    const end =
        interval.end > day.end
            ? `until ${dateTimeFormatter.format(interval.end)}`
            : formatClockTime(interval.end);

    return `${start}–${end}`;
}

function UpNextList({ jobs }: { jobs: DispatchJobViewModel[] }) {
    return (
        <div className="border-t border-line">
            <h3 className="px-4 pt-3 pb-1 text-[11px] font-bold tracking-[0.07em] text-ink-soft uppercase sm:px-5">
                Up next
            </h3>
            <ul className="divide-y divide-line">
                {jobs.map((job) => (
                    <li
                        key={job.id}
                        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5"
                    >
                        <div className="min-w-0">
                            <p className="flex items-center gap-1.5">
                                <Link
                                    href={dispatchDetailHref(job.id)}
                                    className="rounded-sm text-sm font-semibold text-ink hover:underline focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                                >
                                    {job.reference}
                                </Link>
                                <SourceChip label={sourceLabel(job)} />
                            </p>
                            <p className="truncate text-xs text-ink-soft">
                                {job.title}
                                {job.site ? ` · ${job.site}` : ''}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-ink-soft tabular-nums">
                            <span>
                                {formatUpcomingStart(job.scheduled_start)}
                            </span>
                            <CanonicalStatusBadge status={job.status} />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function formatUpcomingStart(value: string | null): string {
    if (!value) {
        return 'Not scheduled';
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? 'Not scheduled'
        : upcomingFormatter.format(date);
}

function ScheduleError({
    message,
    onRetry,
    compact = false,
}: {
    message: string | null;
    onRetry: () => void;
    compact?: boolean;
}) {
    return (
        <div
            role="status"
            className={cn(
                'flex flex-wrap items-center gap-3 rounded-lg text-sm text-warning-strong',
                compact ? 'text-xs' : 'bg-warning-soft p-3',
            )}
        >
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
                {message ?? "Today's schedule could not be loaded."}
            </span>
            <Button variant="secondary" size="sm" onClick={onRetry}>
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Retry
            </Button>
        </div>
    );
}

function ScheduleSkeleton() {
    return (
        <div
            role="status"
            aria-label="Loading today's schedule"
            className="space-y-3 p-4 sm:p-5"
        >
            <Skeleton className="h-8 w-72 max-w-full" />
            {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center gap-4">
                    <Skeleton className="h-9 w-40" />
                    <Skeleton className="h-7 flex-1" />
                </div>
            ))}
        </div>
    );
}
