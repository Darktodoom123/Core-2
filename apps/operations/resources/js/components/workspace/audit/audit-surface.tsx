import { Download, FileText, RefreshCw, Search, X } from 'lucide-react';
import { useState } from 'react';
import {
    Button,
    EmptyState,
    Input,
    PageHeading,
    Select,
    Skeleton,
} from '@/components/ui';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AuditEventViewModel,
    ReportExportViewModel,
} from '@/types/workspace';
import { FilterButton, FilterGroup } from '../../dashboards/manager/manager-ui';
import { AUDIT_CATEGORIES } from './audit-api';
import type { AuditCategoryFilter } from './audit-api';
import { AuditEventDetail } from './audit-event-detail';
import { AuditExportDialog } from './audit-export-dialog';
import { AuditExportsPanel } from './audit-exports-panel';
import {
    AUDIT_CATEGORY_LABELS,
    auditActionLabel,
    auditSubjectLabel,
    auditTone,
} from './audit-labels';
import { useAuditEvents } from './use-audit-events';

const PER_PAGE = 25;

type RangePreset = 'all' | 'today' | '7d' | '30d' | 'custom';

const RANGE_LABELS: Record<Exclude<RangePreset, 'custom'>, string> = {
    all: 'All time',
    today: 'Today',
    '7d': '7 days',
    '30d': '30 days',
};

function toDateInput(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A local calendar date becomes the exact instant its local day starts or ends. */
function localBound(value: string, end: boolean): string | undefined {
    if (!value) {
        return undefined;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = end
        ? new Date(year, month - 1, day, 23, 59, 59, 999)
        : new Date(year, month - 1, day);

    return date.toISOString().replace('.999Z', 'Z').replace('.000Z', 'Z');
}

function presetRange(preset: RangePreset): { from: string; to: string } {
    if (preset === 'all' || preset === 'custom') {
        return { from: '', to: '' };
    }

    const today = new Date();
    const start = new Date(today);
    start.setDate(
        today.getDate() - (preset === 'today' ? 0 : preset === '7d' ? 6 : 29),
    );

    return { from: toDateInput(start), to: toDateInput(today) };
}

export function AuditSurface({
    exports = [],
}: {
    exports?: ReportExportViewModel[];
}) {
    const [category, setCategory] = useState<AuditCategoryFilter>('all');
    const [actor, setActor] = useState('all');
    const [preset, setPreset] = useState<RangePreset>('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<AuditEventViewModel | null>(null);
    const [exporting, setExporting] = useState(false);

    const audit = useAuditEvents({
        category,
        actor,
        from: localBound(fromDate, false),
        to: localBound(toDate, true),
        q: search,
        page,
        perPage: PER_PAGE,
    });
    const result = audit.page;
    const filtersActive =
        category !== 'all' ||
        actor !== 'all' ||
        fromDate !== '' ||
        toDate !== '' ||
        search.trim() !== '';

    const resetPage =
        <T,>(setter: (value: T) => void) =>
        (value: T) => {
            setter(value);
            setPage(1);
        };

    const choosePreset = (next: RangePreset) => {
        const range = presetRange(next);
        setPreset(next);
        setFromDate(range.from);
        setToDate(range.to);
        setPage(1);
    };

    const clearFilters = () => {
        setCategory('all');
        setActor('all');
        choosePreset('all');
        setSearch('');
    };

    const first =
        result && result.total > 0
            ? (result.current_page - 1) * result.per_page + 1
            : 0;
    const last = result
        ? Math.min(result.total, result.current_page * result.per_page)
        : 0;

    return (
        <div>
            <PageHeading
                title="Audit trail"
                description="Every recorded sign-in, access change, dispatch decision, and override. Records cannot be edited or deleted."
                actions={
                    <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setExporting(true)}
                    >
                        <Download className="size-3.5" aria-hidden="true" />
                        Export
                    </Button>
                }
            />

            <div className="space-y-4 p-4 md:p-6">
                <FilterGroup
                    label="Filter by category"
                    className="w-fit max-w-full"
                >
                    {(
                        ['all', ...AUDIT_CATEGORIES] as AuditCategoryFilter[]
                    ).map((key) => (
                        <FilterButton
                            key={key}
                            label={
                                key === 'all'
                                    ? 'All'
                                    : AUDIT_CATEGORY_LABELS[key]
                            }
                            count={result?.counts[key] ?? 0}
                            pressed={category === key}
                            emphasis={
                                key === 'overrides' ? 'danger' : 'neutral'
                            }
                            onClick={() => resetPage(setCategory)(key)}
                        />
                    ))}
                </FilterGroup>

                <div className="grid gap-3 rounded-xl border border-line bg-surface p-3 shadow-2xs md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-end">
                    <label className="block">
                        <span className="text-xs font-medium text-ink-soft">
                            Search
                        </span>
                        <span className="relative mt-1 block">
                            <Search
                                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft"
                                aria-hidden="true"
                            />
                            <Input
                                type="search"
                                value={search}
                                placeholder="Action, reason, or request ID"
                                className="pl-9"
                                onChange={(event) =>
                                    resetPage(setSearch)(event.target.value)
                                }
                            />
                        </span>
                    </label>
                    <label className="block">
                        <span className="text-xs font-medium text-ink-soft">
                            Person
                        </span>
                        <Select
                            className="mt-1"
                            value={actor}
                            onChange={(event) =>
                                resetPage(setActor)(event.target.value)
                            }
                        >
                            <option value="all">Everyone</option>
                            <option value="system">
                                System (no signed-in user)
                            </option>
                            {result?.actors.map((person) => (
                                <option
                                    key={person.id}
                                    value={String(person.id)}
                                >
                                    {person.name}
                                </option>
                            ))}
                        </Select>
                    </label>
                    <div>
                        <span
                            className="text-xs font-medium text-ink-soft"
                            id="audit-range-label"
                        >
                            Dates
                        </span>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <FilterGroup label="Date range">
                                {(
                                    Object.keys(RANGE_LABELS) as Exclude<
                                        RangePreset,
                                        'custom'
                                    >[]
                                ).map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        aria-pressed={preset === key}
                                        onClick={() => choosePreset(key)}
                                        className={cn(
                                            'min-h-11 rounded-md px-2.5 font-medium transition-colors md:min-h-9',
                                            preset === key
                                                ? 'bg-surface font-semibold text-ink shadow-xs ring-1 ring-line'
                                                : 'text-ink-soft hover:text-ink',
                                        )}
                                    >
                                        {RANGE_LABELS[key]}
                                    </button>
                                ))}
                            </FilterGroup>
                            <Input
                                type="date"
                                aria-label="From date"
                                className="w-auto"
                                value={fromDate}
                                max={toDate || undefined}
                                onChange={(event) => {
                                    setPreset('custom');
                                    resetPage(setFromDate)(event.target.value);
                                }}
                            />
                            <Input
                                type="date"
                                aria-label="To date"
                                className="w-auto"
                                value={toDate}
                                min={fromDate || undefined}
                                onChange={(event) => {
                                    setPreset('custom');
                                    resetPage(setToDate)(event.target.value);
                                }}
                            />
                        </div>
                    </div>
                </div>

                <section
                    aria-labelledby="audit-results-heading"
                    className="overflow-hidden rounded-xl border border-line bg-surface shadow-2xs"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                        <h2
                            id="audit-results-heading"
                            className="text-sm font-semibold text-ink"
                            aria-live="polite"
                        >
                            {result
                                ? result.total === 0
                                    ? 'No matching events'
                                    : `Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${result.total.toLocaleString()} events`
                                : 'Loading events'}
                        </h2>
                        <div className="flex items-center gap-2">
                            {filtersActive && (
                                <Button
                                    variant="quiet"
                                    size="sm"
                                    className="gap-1"
                                    onClick={clearFilters}
                                >
                                    <X
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    Clear filters
                                </Button>
                            )}
                            <Button
                                variant="quiet"
                                size="sm"
                                className="gap-1.5"
                                onClick={audit.reload}
                                disabled={audit.loading}
                            >
                                <RefreshCw
                                    className={cn(
                                        'size-3.5',
                                        audit.loading &&
                                            'animate-spin motion-reduce:animate-none',
                                    )}
                                    aria-hidden="true"
                                />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {audit.error && (
                        <div
                            role="alert"
                            className="flex items-center justify-between gap-3 border-b border-line bg-warning-soft px-4 py-3 text-sm text-warning-strong"
                        >
                            <span>{audit.error}</span>
                            <Button size="sm" onClick={audit.reload}>
                                Try again
                            </Button>
                        </div>
                    )}

                    {!result ? (
                        audit.error ? null : (
                            <div role="status" className="space-y-2 p-4">
                                <span className="sr-only">
                                    Loading audit events
                                </span>
                                {Array.from({ length: 6 }, (_, row) => (
                                    <Skeleton
                                        key={row}
                                        className="h-10 w-full"
                                    />
                                ))}
                            </div>
                        )
                    ) : result.events.length === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title={
                                filtersActive
                                    ? 'Nothing matches these filters'
                                    : 'Nothing recorded yet'
                            }
                            message={
                                filtersActive
                                    ? 'Try a wider date range or clear the filters.'
                                    : 'Sign-ins, access changes, and overrides appear here as they happen.'
                            }
                            primaryAction={
                                filtersActive ? (
                                    <Button onClick={clearFilters}>
                                        Clear filters
                                    </Button>
                                ) : undefined
                            }
                        />
                    ) : (
                        <div
                            className={cn(
                                'overflow-x-auto transition-opacity',
                                audit.loading && 'opacity-60',
                            )}
                        >
                            <table className="w-full min-w-[46rem] text-left text-sm">
                                <thead className="bg-surface-subtle text-xs text-ink-soft">
                                    <tr>
                                        <th
                                            scope="col"
                                            className="px-4 py-2.5 font-medium"
                                        >
                                            When
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-2.5 font-medium"
                                        >
                                            Who
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-2.5 font-medium"
                                        >
                                            What happened
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-2.5 font-medium"
                                        >
                                            Record
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-2.5 font-medium"
                                        >
                                            <span className="sr-only">
                                                Details
                                            </span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {result.events.map((event) => {
                                        const tone = auditTone(event.action);

                                        return (
                                            <tr
                                                key={event.id}
                                                className="align-top hover:bg-surface-subtle/60"
                                            >
                                                <td className="px-4 py-3 whitespace-nowrap text-ink-soft tabular-nums">
                                                    {event.occurred_at
                                                        ? formatDateTime(
                                                              event.occurred_at,
                                                          )
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-ink">
                                                    {event.actor?.name ?? (
                                                        <span className="text-ink-soft">
                                                            System
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p
                                                        className={cn(
                                                            'font-medium',
                                                            tone === 'danger'
                                                                ? 'text-danger-strong'
                                                                : tone ===
                                                                    'warning'
                                                                  ? 'text-warning-strong'
                                                                  : 'text-ink',
                                                        )}
                                                    >
                                                        {auditActionLabel(
                                                            event.action,
                                                        )}
                                                    </p>
                                                    {event.reason && (
                                                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">
                                                            {event.reason}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-ink-soft">
                                                    {auditSubjectLabel(
                                                        event.subject_type,
                                                        event.subject_id,
                                                    ) ?? '—'}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <Button
                                                        variant="quiet"
                                                        size="sm"
                                                        aria-label={`View details: ${auditActionLabel(event.action)}`}
                                                        onClick={() =>
                                                            setSelected(event)
                                                        }
                                                    >
                                                        Details
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {result && result.last_page > 1 && (
                        <nav
                            aria-label="Audit pages"
                            className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-ink-soft"
                        >
                            <Button
                                size="sm"
                                disabled={
                                    result.current_page <= 1 || audit.loading
                                }
                                onClick={() => setPage(result.current_page - 1)}
                            >
                                Previous
                            </Button>
                            <span className="tabular-nums">
                                Page {result.current_page} of {result.last_page}
                            </span>
                            <Button
                                size="sm"
                                disabled={
                                    result.current_page >= result.last_page ||
                                    audit.loading
                                }
                                onClick={() => setPage(result.current_page + 1)}
                            >
                                Next
                            </Button>
                        </nav>
                    )}
                </section>

                <AuditExportsPanel exports={exports} />
            </div>

            <AuditEventDetail
                event={selected}
                onClose={() => setSelected(null)}
                onShowRequest={(requestId) => {
                    setSelected(null);
                    setCategory('all');
                    setActor('all');
                    choosePreset('all');
                    setSearch(requestId);
                }}
            />

            <AuditExportDialog
                open={exporting}
                initialFrom={fromDate}
                initialTo={toDate}
                onClose={() => setExporting(false)}
            />
        </div>
    );
}
