import {
    AlertTriangle,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock,
    SearchX,
} from 'lucide-react';
import { useMemo } from 'react';
import { EmptyState, Panel } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    DispatchJobViewModel,
    WorkspaceUserViewModel,
} from '@/types/workspace';

export type ScheduleBoardWeekCategory =
    'all' | 'cranes' | 'trucks' | 'equipment' | 'personnel';

/**
 * The week board only needs the job relationship and a human-readable reason.
 * Richer conflict records from the parent remain structurally assignable.
 */
export interface ScheduleBoardConflict {
    jobId?: number;
    description: string;
}

export interface ScheduleBoardWeekViewProps {
    jobs: DispatchJobViewModel[];
    selectedDate: string;
    onSelectDate: (date: string) => void;
    onSelectJob: (jobId: number) => void;
    category: ScheduleBoardWeekCategory;
    conflictsOnly: boolean;
    derivedConflicts: readonly ScheduleBoardConflict[];
    assets?: AssetViewModel[];
    users?: WorkspaceUserViewModel[];
}

export type ScheduleBoardResourceCategory =
    'cranes' | 'trucks' | 'equipment' | 'personnel';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export function dateFromLocalKey(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
        return null;
    }

    const date = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
    );

    return date.getFullYear() === Number(match[1]) &&
        date.getMonth() === Number(match[2]) - 1 &&
        date.getDate() === Number(match[3])
        ? date
        : null;
}

export function shiftLocalDate(value: string, days: number): string {
    const date = dateFromLocalKey(value) ?? new Date();
    date.setDate(date.getDate() + days);

    return localDateKey(date);
}

export function startOfWeekLocalDate(value: string): string {
    const date = dateFromLocalKey(value) ?? new Date();
    const mondayOffset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - mondayOffset);

    return localDateKey(date);
}

export function weekDateKeys(value: string): string[] {
    const weekStart = startOfWeekLocalDate(value);

    return Array.from({ length: 7 }, (_, index) =>
        shiftLocalDate(weekStart, index),
    );
}

function parseScheduleDate(value: string | null): Date | null {
    if (!value) {
        return null;
    }

    if (dateOnlyPattern.test(value)) {
        return dateFromLocalKey(value);
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

interface NormalizedJobWindow {
    start: Date;
    end: Date;
    isDateOnly: boolean;
}

function normalizedJobWindow(
    job: Pick<DispatchJobViewModel, 'scheduled_start' | 'scheduled_end'>,
): NormalizedJobWindow | null {
    if (!job.scheduled_start || !job.scheduled_end) {
        return null;
    }

    const start = parseScheduleDate(job.scheduled_start);
    const end = parseScheduleDate(job.scheduled_end);

    if (!start || !end) {
        return null;
    }

    const isDateOnly =
        dateOnlyPattern.test(job.scheduled_start) &&
        dateOnlyPattern.test(job.scheduled_end);

    // Date-only records commonly represent all-day work. Treat an equal pair
    // as one local day while still rejecting reversed timestamp ranges.
    if (
        end <= start &&
        isDateOnly &&
        localDateKey(start) === localDateKey(end)
    ) {
        end.setDate(end.getDate() + 1);
    }

    if (end <= start) {
        return null;
    }

    return { start, end, isDateOnly };
}

export function jobOverlapsLocalDate(
    job: Pick<DispatchJobViewModel, 'scheduled_start' | 'scheduled_end'>,
    selectedDate: string,
): boolean {
    const window = normalizedJobWindow(job);
    const date = dateFromLocalKey(selectedDate);

    if (!window || !date) {
        return false;
    }

    const dayStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
    );
    const dayEnd = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1,
    );

    return window.start < dayEnd && window.end > dayStart;
}

function classifyAsset(value: {
    code?: string | null;
    kind?: string | null;
    name?: string | null;
    subtype?: string | null;
    type?: string | null;
}): ScheduleBoardResourceCategory {
    const descriptor = [
        value.code,
        value.kind,
        value.name,
        value.subtype,
        value.type,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (descriptor.includes('crane')) {
        return 'cranes';
    }

    if (descriptor.includes('truck') || descriptor.includes('vehicle')) {
        return 'trucks';
    }

    return 'equipment';
}

function jobMatchesCategory(
    job: DispatchJobViewModel,
    category: ScheduleBoardWeekCategory,
    assets: AssetViewModel[],
): boolean {
    if (category === 'all') {
        return true;
    }

    if (category === 'personnel' && job.personnel_assignments.length > 0) {
        return true;
    }

    if (category === 'personnel') {
        return false;
    }

    return job.asset_assignments.some((assignment) => {
        const asset = assets.find(
            (candidate) =>
                candidate.id === assignment.operational_asset_id ||
                candidate.code === assignment.code,
        );

        return (
            classifyAsset(asset ?? assignment) === category ||
            classifyAsset(assignment) === category
        );
    });
}

function jobHasConflict(
    job: DispatchJobViewModel,
    conflicts: readonly ScheduleBoardConflict[],
): boolean {
    return conflicts.some(
        (conflict) =>
            conflict.jobId === job.id ||
            (Boolean(job.reference) &&
                conflict.description.includes(job.reference)),
    );
}

function formatDateLabel(value: string, options: Intl.DateTimeFormatOptions) {
    const date = dateFromLocalKey(value) ?? new Date();

    return new Intl.DateTimeFormat(undefined, options).format(date);
}

function formatWeekRange(week: string[]) {
    const start = dateFromLocalKey(week[0]);
    const end = dateFromLocalKey(week[week.length - 1]);

    if (!start || !end) {
        return 'Selected week';
    }

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

function formatJobTime(job: DispatchJobViewModel, dateKey: string) {
    const window = normalizedJobWindow(job);
    const date = dateFromLocalKey(dateKey);

    if (!window || !date) {
        return 'Schedule details unavailable';
    }

    if (window.isDateOnly) {
        return 'All day';
    }

    const dayStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
    );
    const dayEnd = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1,
    );
    const timeFormatter = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    });
    const startLabel =
        window.start <= dayStart
            ? 'Earlier'
            : timeFormatter.format(window.start);
    const endLabel =
        window.end >= dayEnd ? 'Later' : timeFormatter.format(window.end);

    return `${startLabel} – ${endLabel}`;
}

function jobTone(job: DispatchJobViewModel, hasConflict: boolean) {
    if (hasConflict || job.priority.value === 'emergency') {
        return 'border-danger bg-danger-soft text-danger-strong';
    }

    if (job.priority.value === 'priority') {
        return 'border-warning bg-warning-soft text-warning-strong';
    }

    return 'border-brand bg-brand-soft text-brand-strong';
}

interface WeekResourceRow {
    id: string;
    name: string;
    code: string;
    category: ScheduleBoardResourceCategory | 'unassigned';
    statusLabel: string;
    statusTone: 'success' | 'warning' | 'error' | 'info';
    jobs: DispatchJobViewModel[];
    hasConflict: boolean;
}

export function ScheduleBoardWeekView({
    jobs,
    selectedDate,
    onSelectDate,
    onSelectJob,
    category,
    conflictsOnly,
    derivedConflicts,
    assets = [],
    users = [],
}: ScheduleBoardWeekViewProps) {
    const safeSelectedDate = dateFromLocalKey(selectedDate)
        ? selectedDate
        : localDateKey(new Date());
    const week = useMemo(
        () => weekDateKeys(safeSelectedDate),
        [safeSelectedDate],
    );
    const todayKey = localDateKey(new Date());
    const currentWeekStart = startOfWeekLocalDate(todayKey);
    const weekStart = week[0];

    const visibleJobs = useMemo(
        () =>
            jobs.filter(
                (job) =>
                    jobMatchesCategory(job, category, assets) &&
                    (!conflictsOnly || jobHasConflict(job, derivedConflicts)) &&
                    week.some((date) => jobOverlapsLocalDate(job, date)),
            ),
        [assets, category, conflictsOnly, derivedConflicts, jobs, week],
    );

    const rows = useMemo(() => {
        const resourceRows: WeekResourceRow[] = [];
        const representedJobIds = new Set<number>();
        const addResourceRow = (row: WeekResourceRow) => {
            if (row.jobs.length === 0) {
                return;
            }

            if (conflictsOnly && !row.hasConflict) {
                return;
            }

            row.jobs.forEach((job) => representedJobIds.add(job.id));
            resourceRows.push(row);
        };

        for (const asset of assets) {
            const resourceCategory = classifyAsset(asset);

            if (category !== 'all' && category !== resourceCategory) {
                continue;
            }

            const assignedJobs = visibleJobs.filter((job) =>
                job.asset_assignments.some(
                    (assignment) =>
                        assignment.operational_asset_id === asset.id ||
                        assignment.code === asset.code,
                ),
            );

            addResourceRow({
                id: `asset-${asset.id}`,
                name: asset.name || asset.code,
                code: asset.code,
                category: resourceCategory,
                statusLabel: asset.status.label,
                statusTone:
                    asset.blocking_work_orders_count > 0
                        ? 'error'
                        : asset.is_dispatchable
                          ? 'success'
                          : 'warning',
                jobs: assignedJobs,
                hasConflict: assignedJobs.some((job) =>
                    jobHasConflict(job, derivedConflicts),
                ),
            });
        }

        if (category === 'all' || category === 'personnel') {
            for (const user of users) {
                const assignedJobs = visibleJobs.filter((job) =>
                    job.personnel_assignments.some(
                        (assignment) => assignment.user_id === user.id,
                    ),
                );

                addResourceRow({
                    id: `user-${user.id}`,
                    name: user.name,
                    code: user.role_label ?? 'Personnel',
                    category: 'personnel',
                    statusLabel: user.is_active ? 'Active' : 'Inactive',
                    statusTone: user.is_active ? 'success' : 'error',
                    jobs: assignedJobs,
                    hasConflict: assignedJobs.some((job) =>
                        jobHasConflict(job, derivedConflicts),
                    ),
                });
            }
        }

        const unassignedJobs = visibleJobs.filter(
            (job) => !representedJobIds.has(job.id),
        );

        if (unassignedJobs.length > 0) {
            resourceRows.push({
                id: 'unassigned-jobs',
                name: 'Unassigned work',
                code: 'Needs resource review',
                category: 'unassigned',
                statusLabel: 'Review',
                statusTone: 'warning',
                jobs: unassignedJobs,
                hasConflict: unassignedJobs.some((job) =>
                    jobHasConflict(job, derivedConflicts),
                ),
            });
        }

        // Keep a job-level schedule visible when the parent has not supplied
        // resource catalogs yet. The surface remains useful during loading or
        // partial rollout without inventing resource assignments.
        if (resourceRows.length === 0 && visibleJobs.length > 0) {
            resourceRows.push({
                id: 'scheduled-jobs',
                name: 'Scheduled jobs',
                code: 'Resource details unavailable',
                category: 'unassigned',
                statusLabel: 'Schedule',
                statusTone: 'info',
                jobs: visibleJobs,
                hasConflict: visibleJobs.some((job) =>
                    jobHasConflict(job, derivedConflicts),
                ),
            });
        }

        return resourceRows;
    }, [assets, category, conflictsOnly, derivedConflicts, users, visibleJobs]);

    const weekJobCount = visibleJobs.length;

    return (
        <section aria-label="Weekly schedule board">
            <Panel className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                            <CalendarDays
                                className="h-5 w-5"
                                aria-hidden="true"
                            />
                        </div>
                        <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-ink">
                                Week of {formatWeekRange(week)}
                            </h3>
                            <p
                                className="mt-0.5 text-xs text-ink-soft"
                                role="status"
                                aria-live="polite"
                            >
                                {weekJobCount} scheduled job
                                {weekJobCount === 1 ? '' : 's'} across seven
                                days
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                onSelectDate(shiftLocalDate(weekStart, -7))
                            }
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-semibold text-ink hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                            aria-label="Show previous week"
                        >
                            <ChevronLeft
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                            Previous week
                        </button>
                        <button
                            type="button"
                            onClick={() => onSelectDate(todayKey)}
                            className={cn(
                                'inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                                weekStart === currentWeekStart
                                    ? 'bg-brand-soft text-brand-strong'
                                    : 'border border-line-strong bg-surface text-ink hover:bg-surface-subtle',
                            )}
                            aria-label="Show current week"
                            aria-pressed={weekStart === currentWeekStart}
                        >
                            This week
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                onSelectDate(shiftLocalDate(weekStart, 7))
                            }
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-semibold text-ink hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                            aria-label="Show next week"
                        >
                            Next week
                            <ChevronRight
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                </div>

                {visibleJobs.length === 0 ? (
                    <EmptyState
                        compact
                        icon={SearchX}
                        title={
                            conflictsOnly
                                ? 'No conflicting jobs in this week'
                                : 'No scheduled jobs in this week'
                        }
                        message={
                            conflictsOnly
                                ? 'Turn off Conflicts only or choose another week to review more work.'
                                : 'Choose another week or adjust the resource category to find scheduled work.'
                        }
                        announce
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <div
                            className="min-w-[72rem]"
                            role="grid"
                            aria-label="Weekly resource schedule"
                        >
                            <div
                                className="grid grid-cols-[14rem_repeat(7,minmax(8rem,1fr))] border-b border-line bg-surface-subtle text-xs font-semibold"
                                role="row"
                            >
                                <div
                                    className="border-r border-line px-4 py-3 text-ink"
                                    role="columnheader"
                                >
                                    Resource &amp; status
                                </div>
                                {week.map((date) => {
                                    const dayJobs = visibleJobs.filter((job) =>
                                        jobOverlapsLocalDate(job, date),
                                    );
                                    const isToday = date === todayKey;
                                    const isSelected =
                                        date === safeSelectedDate;

                                    return (
                                        <div
                                            key={date}
                                            className={cn(
                                                'border-r border-line px-2 py-2 last:border-r-0',
                                                isToday && 'bg-brand-soft/50',
                                            )}
                                            role="columnheader"
                                            aria-current={
                                                isToday ? 'date' : undefined
                                            }
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onSelectDate(date)
                                                }
                                                className={cn(
                                                    'flex min-h-11 w-full flex-col items-center justify-center rounded-md px-1 text-center focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                                                    isSelected
                                                        ? 'bg-brand text-ink'
                                                        : 'hover:bg-surface',
                                                )}
                                                aria-label={`Show ${formatDateLabel(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
                                                aria-pressed={isSelected}
                                            >
                                                <span className="text-[11px] tracking-[0.08em] text-ink-soft uppercase">
                                                    {formatDateLabel(date, {
                                                        weekday: 'short',
                                                    })}
                                                </span>
                                                <span className="mt-0.5 text-sm font-bold text-ink">
                                                    {formatDateLabel(date, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </span>
                                                <span className="mt-0.5 text-[10px] font-medium text-ink-soft">
                                                    {dayJobs.length} job
                                                    {dayJobs.length === 1
                                                        ? ''
                                                        : 's'}
                                                    {isToday ? ' · Today' : ''}
                                                </span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="divide-y divide-line">
                                {rows.map((row) => (
                                    <div
                                        key={row.id}
                                        className="grid grid-cols-[14rem_repeat(7,minmax(8rem,1fr))] items-stretch"
                                        role="row"
                                    >
                                        <div
                                            className="flex min-h-28 items-start justify-between gap-2 border-r border-line px-4 py-3"
                                            role="rowheader"
                                        >
                                            <div className="min-w-0">
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
                                                <p className="mt-0.5 truncate text-[11px] text-ink-soft">
                                                    {row.code}
                                                </p>
                                            </div>
                                            <span
                                                className={cn(
                                                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                                                    row.statusTone ===
                                                        'success' &&
                                                        'bg-success-soft text-success-strong',
                                                    row.statusTone ===
                                                        'warning' &&
                                                        'bg-warning-soft text-warning-strong',
                                                    row.statusTone ===
                                                        'error' &&
                                                        'bg-danger-soft text-danger',
                                                    row.statusTone === 'info' &&
                                                        'bg-cobalt-50 text-cobalt-700',
                                                )}
                                            >
                                                {row.statusLabel}
                                            </span>
                                        </div>

                                        {week.map((date) => {
                                            const dayJobs = row.jobs.filter(
                                                (job) =>
                                                    jobOverlapsLocalDate(
                                                        job,
                                                        date,
                                                    ),
                                            );
                                            const isToday = date === todayKey;
                                            const isSelected =
                                                date === safeSelectedDate;

                                            return (
                                                <div
                                                    key={`${row.id}-${date}`}
                                                    className={cn(
                                                        'min-h-28 border-r border-line p-1.5 last:border-r-0',
                                                        isToday &&
                                                            'bg-brand-soft/20',
                                                        isSelected &&
                                                            'ring-1 ring-brand/30 ring-inset',
                                                    )}
                                                    role="gridcell"
                                                    aria-label={`${row.name}, ${formatDateLabel(date, { weekday: 'long', month: 'long', day: 'numeric' })}`}
                                                >
                                                    <div className="space-y-1.5">
                                                        {dayJobs.map((job) => {
                                                            const hasConflict =
                                                                jobHasConflict(
                                                                    job,
                                                                    derivedConflicts,
                                                                );

                                                            return (
                                                                <button
                                                                    key={`${row.id}-${date}-job-${job.id}`}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        onSelectJob(
                                                                            job.id,
                                                                        )
                                                                    }
                                                                    className={cn(
                                                                        'flex min-h-16 w-full flex-col justify-between rounded-lg border px-2 py-1.5 text-left shadow-xs transition-colors hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                                                                        jobTone(
                                                                            job,
                                                                            hasConflict,
                                                                        ),
                                                                    )}
                                                                    title={`${job.reference}: ${job.title} (${job.client})`}
                                                                    aria-label={`${job.reference}, ${job.title}, ${formatJobTime(job, date)}${hasConflict ? ', conflict' : ''}`}
                                                                >
                                                                    <span className="flex items-center justify-between gap-1 text-[11px] font-bold tracking-tight">
                                                                        <span className="truncate">
                                                                            {
                                                                                job.reference
                                                                            }
                                                                        </span>
                                                                        {hasConflict && (
                                                                            <AlertTriangle
                                                                                className="h-3.5 w-3.5 shrink-0"
                                                                                aria-hidden="true"
                                                                            />
                                                                        )}
                                                                    </span>
                                                                    <span className="truncate text-[10px] leading-tight font-medium">
                                                                        {
                                                                            job.title
                                                                        }
                                                                    </span>
                                                                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium opacity-80">
                                                                        <Clock
                                                                            className="h-3 w-3 shrink-0"
                                                                            aria-hidden="true"
                                                                        />
                                                                        {formatJobTime(
                                                                            job,
                                                                            date,
                                                                        )}
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
                            </div>
                        </div>
                    </div>
                )}
            </Panel>
        </section>
    );
}
