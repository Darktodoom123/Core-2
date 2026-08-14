import {
    AlertTriangle,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { localDateKey } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    DispatchJobViewModel,
    WorkspaceUserViewModel,
} from '@/types/workspace';

/** Categories shared by the day, week, and month schedule-board surfaces. */
export type ScheduleBoardCategory =
    'all' | 'cranes' | 'trucks' | 'equipment' | 'personnel';

/** The minimum conflict shape needed to mark a scheduled day. */
export interface ScheduleBoardConflict {
    description: string;
    jobId?: number;
}

export interface ScheduleBoardMonthViewProps {
    jobs: DispatchJobViewModel[];
    selectedDate: string;
    onSelectDate: (date: string) => void;
    onSelectJob: (jobId: number) => void;
    category: ScheduleBoardCategory;
    conflictsOnly: boolean;
    derivedConflicts: readonly ScheduleBoardConflict[];
    assets?: AssetViewModel[];
    users?: WorkspaceUserViewModel[];
}

interface LocalDateSpan {
    start: string;
    end: string;
}

interface CalendarDay {
    date: Date;
    key: string;
}

/**
 * Month planning surface for the live dispatch board.
 *
 * The calendar is intentionally a planning surface rather than a replacement
 * for the hourly day board: it answers where work lands in a month, surfaces
 * conflicts, and hands the selected date/job back to the parent for detail.
 */
export function ScheduleBoardMonthView({
    jobs,
    selectedDate,
    onSelectDate,
    onSelectJob,
    category,
    conflictsOnly,
    derivedConflicts,
    assets = [],
}: ScheduleBoardMonthViewProps) {
    const todayKey = localDateKey(new Date());
    const safeSelectedDate = isValidLocalDateKey(selectedDate)
        ? selectedDate
        : todayKey;
    const monthStart = startOfMonthLocalDate(safeSelectedDate);
    const gridDays = buildMonthGrid(monthStart);
    const gridStart = gridDays[0]?.key ?? safeSelectedDate;
    const gridEnd = gridDays.at(-1)?.key ?? safeSelectedDate;

    const visibleJobs = jobs.filter((job) => {
        if (!jobMatchesCategory(job, category, assets)) {
            return false;
        }

        return (
            !conflictsOnly ||
            derivedConflicts.some((conflict) =>
                conflictAppliesToJob(conflict, job),
            )
        );
    });

    const jobsByDate = indexJobsByDate(visibleJobs, gridStart, gridEnd);
    const monthJobs = visibleJobs.filter((job) => {
        const span = localDateSpanForJob(job);

        return Boolean(span && span.start <= gridEnd && span.end >= gridStart);
    });
    const monthConflictCount = monthJobs.reduce(
        (count, job) =>
            count +
            derivedConflicts.filter((conflict) =>
                conflictAppliesToJob(conflict, job),
            ).length,
        0,
    );

    const monthHeading = new Intl.DateTimeFormat(undefined, {
        month: 'long',
        year: 'numeric',
    }).format(monthStart);

    const goToMonth = (offset: number) => {
        onSelectDate(shiftLocalMonth(safeSelectedDate, offset));
    };

    return (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-subtle px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                        <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-ink">
                            {monthHeading}
                        </h3>
                        <p
                            className="text-xs text-ink-soft"
                            role="status"
                            aria-live="polite"
                        >
                            {monthJobs.length}{' '}
                            {monthJobs.length === 1
                                ? 'scheduled job'
                                : 'scheduled jobs'}
                            {monthConflictCount > 0 && (
                                <>
                                    <span aria-hidden="true"> · </span>
                                    {monthConflictCount}{' '}
                                    {monthConflictCount === 1
                                        ? 'conflict'
                                        : 'conflicts'}
                                </>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => goToMonth(-1)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line-strong bg-surface px-2.5 text-xs font-semibold text-ink transition-colors hover:bg-brand-soft hover:text-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                        aria-label="Show previous month"
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Previous</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onSelectDate(todayKey)}
                        className="inline-flex min-h-11 items-center rounded-lg border border-line-strong bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:bg-brand-soft hover:text-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                        aria-label="Show current month"
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => goToMonth(1)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line-strong bg-surface px-2.5 text-xs font-semibold text-ink transition-colors hover:bg-brand-soft hover:text-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                        aria-label="Show next month"
                    >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[44rem]">
                    <div
                        className="grid grid-cols-7 border-b border-line bg-surface-subtle"
                        role="row"
                    >
                        {WEEKDAY_LABELS.map((label) => (
                            <div
                                key={label.short}
                                className="border-r border-line px-2 py-2 text-center text-[11px] font-semibold tracking-wide text-ink-soft last:border-r-0"
                                role="columnheader"
                                aria-label={label.long}
                            >
                                <span className="sm:hidden">{label.short}</span>
                                <span className="hidden sm:inline">
                                    {label.long}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div
                        role="grid"
                        aria-label={`${monthHeading} dispatch schedule`}
                    >
                        {Array.from({ length: 6 }, (_, weekIndex) => (
                            <div
                                key={`week-${weekIndex}`}
                                className="grid grid-cols-7"
                                role="row"
                            >
                                {gridDays
                                    .slice(weekIndex * 7, weekIndex * 7 + 7)
                                    .map((day) => {
                                        const dayJobs =
                                            jobsByDate.get(day.key) ?? [];
                                        const dayConflicts =
                                            countConflictsForJobs(
                                                dayJobs,
                                                derivedConflicts,
                                            );
                                        const isCurrentMonth =
                                            day.date.getMonth() ===
                                            monthStart.getMonth();
                                        const isToday = day.key === todayKey;
                                        const isSelected =
                                            day.key === safeSelectedDate;

                                        return (
                                            <div
                                                key={day.key}
                                                className={cn(
                                                    'flex min-h-32 min-w-0 flex-col border-r border-b border-line p-1.5 last:border-r-0 sm:min-h-36 sm:p-2',
                                                    !isCurrentMonth &&
                                                        'bg-surface-subtle/45',
                                                    isSelected &&
                                                        'bg-brand-soft/30',
                                                )}
                                                role="gridcell"
                                                aria-selected={isSelected}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onSelectDate(day.key)
                                                    }
                                                    className={cn(
                                                        'flex min-h-10 w-full items-start justify-between gap-1 rounded-md px-1.5 py-1 text-left text-xs transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                                                        !isCurrentMonth &&
                                                            'text-ink-soft/70',
                                                        isSelected &&
                                                            'bg-brand-soft font-semibold text-brand-strong',
                                                    )}
                                                    aria-current={
                                                        isToday
                                                            ? 'date'
                                                            : undefined
                                                    }
                                                    aria-pressed={isSelected}
                                                    aria-label={formatDayLabel(
                                                        day.date,
                                                        dayJobs.length,
                                                        dayConflicts,
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1',
                                                            isToday &&
                                                                'bg-brand text-white',
                                                            isToday &&
                                                                isSelected &&
                                                                'bg-brand-strong',
                                                        )}
                                                    >
                                                        {day.date.getDate()}
                                                    </span>
                                                    {dayJobs.length > 0 && (
                                                        <span className="pt-1 text-[10px] font-medium text-ink-soft">
                                                            {dayJobs.length}{' '}
                                                            {dayJobs.length ===
                                                            1
                                                                ? 'job'
                                                                : 'jobs'}
                                                        </span>
                                                    )}
                                                </button>

                                                {dayConflicts > 0 && (
                                                    <div className="mt-1 inline-flex w-fit max-w-full items-center gap-1 rounded bg-warning-soft px-1.5 py-1 text-[10px] font-semibold text-warning-strong">
                                                        <AlertTriangle
                                                            className="h-3 w-3 shrink-0"
                                                            aria-hidden="true"
                                                        />
                                                        <span>
                                                            {dayConflicts}{' '}
                                                            {dayConflicts === 1
                                                                ? 'conflict'
                                                                : 'conflicts'}
                                                        </span>
                                                    </div>
                                                )}

                                                {dayJobs.length > 0 && (
                                                    <div className="mt-1.5 max-h-28 space-y-1 overflow-y-auto pr-0.5 sm:max-h-32">
                                                        {dayJobs.map((job) => (
                                                            <button
                                                                key={job.id}
                                                                type="button"
                                                                onClick={() =>
                                                                    onSelectJob(
                                                                        job.id,
                                                                    )
                                                                }
                                                                className="block min-h-9 w-full rounded-md border border-line bg-surface px-1.5 py-1 text-left transition-colors hover:border-brand-strong hover:bg-brand-soft/60 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                                                                title={`${job.reference}: ${job.title}`}
                                                                aria-label={`Open dispatch ${job.reference}: ${job.title}`}
                                                            >
                                                                <span className="block truncate text-[10px] font-bold text-brand-strong">
                                                                    {
                                                                        job.reference
                                                                    }
                                                                </span>
                                                                <span className="block truncate text-[10px] leading-tight text-ink">
                                                                    {job.title}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

const WEEKDAY_LABELS = [
    { short: 'Sun', long: 'Sunday' },
    { short: 'Mon', long: 'Monday' },
    { short: 'Tue', long: 'Tuesday' },
    { short: 'Wed', long: 'Wednesday' },
    { short: 'Thu', long: 'Thursday' },
    { short: 'Fri', long: 'Friday' },
    { short: 'Sat', long: 'Saturday' },
] as const;

export function dateFromLocalKey(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (
        !Number.isFinite(year) ||
        !Number.isFinite(month) ||
        !Number.isFinite(day) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return new Date(Number.NaN);
    }

    return date;
}

export function shiftLocalDate(value: string, days: number): string {
    const date = dateFromLocalKey(value);

    if (Number.isNaN(date.getTime())) {
        return localDateKey(new Date());
    }

    date.setDate(date.getDate() + days);

    return localDateKey(date);
}

export function shiftLocalMonth(value: string, months: number): string {
    const date = dateFromLocalKey(value);

    if (Number.isNaN(date.getTime())) {
        return localDateKey(new Date());
    }

    date.setDate(1);
    date.setMonth(date.getMonth() + months);

    return localDateKey(date);
}

export function startOfMonthLocalDate(value: string): Date {
    const date = dateFromLocalKey(value);

    if (Number.isNaN(date.getTime())) {
        const today = new Date();

        return new Date(today.getFullYear(), today.getMonth(), 1);
    }

    return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function buildMonthGrid(monthStart: Date): CalendarDay[] {
    const firstGridDate = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        1 - monthStart.getDay(),
    );

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(firstGridDate);
        date.setDate(firstGridDate.getDate() + index);

        return { date, key: localDateKey(date) };
    });
}

export function jobOverlapsLocalDate(
    job: DispatchJobViewModel,
    selectedDate: string,
): boolean {
    const span = localDateSpanForJob(job);

    return Boolean(
        span && span.start <= selectedDate && span.end >= selectedDate,
    );
}

function indexJobsByDate(
    jobs: DispatchJobViewModel[],
    gridStart: string,
    gridEnd: string,
): Map<string, DispatchJobViewModel[]> {
    const jobsByDate = new Map<string, DispatchJobViewModel[]>();

    for (const job of jobs) {
        const span = localDateSpanForJob(job);

        if (!span || span.end < gridStart || span.start > gridEnd) {
            continue;
        }

        let dateKey = span.start < gridStart ? gridStart : span.start;
        const lastDate = span.end > gridEnd ? gridEnd : span.end;

        while (dateKey <= lastDate) {
            const dayJobs = jobsByDate.get(dateKey) ?? [];
            dayJobs.push(job);
            jobsByDate.set(dateKey, dayJobs);
            dateKey = shiftLocalDate(dateKey, 1);
        }
    }

    return jobsByDate;
}

function localDateSpanForJob(job: DispatchJobViewModel): LocalDateSpan | null {
    const start = parseScheduleDate(job.scheduled_start);

    if (!start) {
        return null;
    }

    const end = job.scheduled_end
        ? parseScheduleDate(job.scheduled_end)
        : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);

    if (!end || end <= start) {
        // A date-only same-day range is a valid all-day single-day record.
        if (
            isDateOnlyValue(job.scheduled_start) &&
            isDateOnlyValue(job.scheduled_end) &&
            localDateKey(start) === localDateKey(end ?? new Date(Number.NaN))
        ) {
            return { start: localDateKey(start), end: localDateKey(start) };
        }

        return null;
    }

    const lastCoveredInstant = new Date(end.getTime() - 1);

    return {
        start: localDateKey(start),
        end: localDateKey(lastCoveredInstant),
    };
}

function parseScheduleDate(value: string | null): Date | null {
    if (!value) {
        return null;
    }

    if (isDateOnlyValue(value)) {
        const date = dateFromLocalKey(value);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

function isDateOnlyValue(value: string | null): value is string {
    return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isValidLocalDateKey(value: string): boolean {
    return (
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(dateFromLocalKey(value).getTime())
    );
}

function jobMatchesCategory(
    job: DispatchJobViewModel,
    category: ScheduleBoardCategory,
    assets: AssetViewModel[],
): boolean {
    if (category === 'all') {
        return true;
    }

    if (category === 'personnel') {
        return job.personnel_assignments.length > 0;
    }

    return job.asset_assignments.some((assignment) => {
        const asset = assets.find(
            (candidate) =>
                candidate.id === assignment.operational_asset_id ||
                candidate.code === assignment.code,
        );
        const kind = (asset?.kind || assignment.type || '').toLowerCase();

        if (category === 'cranes') {
            return kind.includes('crane');
        }

        if (category === 'trucks') {
            return kind.includes('truck') || kind.includes('vehicle');
        }

        return (
            !kind.includes('crane') &&
            !kind.includes('truck') &&
            !kind.includes('vehicle')
        );
    });
}

function conflictAppliesToJob(
    conflict: ScheduleBoardConflict,
    job: DispatchJobViewModel,
): boolean {
    if (conflict.jobId !== undefined) {
        return conflict.jobId === job.id;
    }

    const description = conflict.description.toLowerCase();

    return (
        description.includes(job.reference.toLowerCase()) ||
        description.includes(job.title.toLowerCase())
    );
}

function countConflictsForJobs(
    jobs: DispatchJobViewModel[],
    conflicts: readonly ScheduleBoardConflict[],
): number {
    return conflicts.filter((conflict) =>
        jobs.some((job) => conflictAppliesToJob(conflict, job)),
    ).length;
}

function formatDayLabel(
    date: Date,
    jobCount: number,
    conflictCount: number,
): string {
    const dayLabel = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
    const jobLabel = `${jobCount} ${jobCount === 1 ? 'scheduled job' : 'scheduled jobs'}`;
    const conflictLabel =
        conflictCount > 0
            ? `, ${conflictCount} ${conflictCount === 1 ? 'conflict' : 'conflicts'}`
            : '';

    return `${dayLabel}, ${jobLabel}${conflictLabel}`;
}
