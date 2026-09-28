import { router, useForm, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowDownUp,
    Check,
    CheckCircle2,
    ChevronLeft,
    Clock,
    Copy,
    Download,
    Edit3,
    ExternalLink,
    FileCheck,
    FileImage,
    FileSpreadsheet,
    FileText,
    FileX,
    Filter,
    Gauge,
    MapPin,
    Paperclip,
    Plus,
    RotateCcw,
    Save,
    Search,
    ShieldAlert,
    ShieldCheck,
    Timer,
    Trash2,
    Truck,
    UploadCloud,
    UserCheck,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { LocationLabel } from '@/components/location/location-label';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import { buttonVariants } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { ExportsSurface } from '@/components/workspace/exports-workspace-section';
import {
    JobReportCrossReferences,
    JobReportDelayLogsTable,
    JobReportSignatureCard,
} from '@/components/workspace/reports';
import { AssetWeeklyReportView } from '@/components/workspace/reports/asset-weekly-report';
import {
    downloadJobReportsCsv,
    formatDurationMinutes,
    jobReportsExportFilename,
    meterUnit,
    JOB_REPORT_PACKET_LIMIT,
    jobReportPdfUrl,
    jobReportsPacketUrl,
    reportDurationMinutes,
} from '@/components/workspace/reports/job-report-export';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AttachmentViewModel,
    DispatchJobViewModel,
    JobReportStatsViewModel,
    JobReportViewModel,
    PaginationMeta,
    ReportExportViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

type ReportFilterStatus =
    'all' | 'draft' | 'submitted' | 'approved' | 'rejected';

type ReportSortOrder = 'newest' | 'oldest' | 'pending_first' | 'reference';

const inputClass =
    'mt-1.5 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-soft focus:border-brand-strong focus:ring-2 focus:ring-brand/20 focus:outline-none';
const textareaClass =
    'mt-1.5 w-full rounded-lg border border-line-strong bg-surface p-3 text-sm text-ink placeholder:text-ink-soft focus:border-brand-strong focus:ring-2 focus:ring-brand/20 focus:outline-none';
const labelClass = 'block text-xs font-semibold text-ink';

function reportActivityTime(report: JobReportViewModel): number {
    const value = report.submitted_at ?? report.ended_at ?? report.started_at;
    const time = value ? new Date(value).getTime() : Number.NaN;

    return Number.isNaN(time) ? report.id : time;
}

function sortReports(
    reports: JobReportViewModel[],
    order: ReportSortOrder,
): JobReportViewModel[] {
    // Server order is already newest first.
    if (order === 'newest') {
        return reports;
    }

    const sorted = [...reports];

    if (order === 'oldest') {
        sorted.sort((a, b) => reportActivityTime(a) - reportActivityTime(b));
    } else if (order === 'pending_first') {
        const rank = (r: JobReportViewModel) =>
            r.status.value === 'submitted'
                ? 0
                : r.status.value === 'rejected'
                  ? 1
                  : r.status.value === 'draft'
                    ? 2
                    : 3;
        sorted.sort((a, b) => rank(a) - rank(b));
    } else {
        sorted.sort((a, b) =>
            (a.job?.reference ?? '').localeCompare(
                b.job?.reference ?? '',
                undefined,
                { numeric: true },
            ),
        );
    }

    return sorted;
}

export function ReportsSurface({
    reports = [],
    exports = [],
    jobs = [],
    capabilities,
    total,
    serverStats,
}: {
    reports?: JobReportViewModel[];
    exports?: ReportExportViewModel[];
    jobs?: DispatchJobViewModel[];
    capabilities: WorkspaceCapabilities;
    total?: number;
    serverStats?: JobReportStatsViewModel;
    pagination?: PaginationMeta;
}) {
    const initialJobIdFromUrl = useMemo(() => {
        if (typeof window === 'undefined') {
            return null;
        }

        const params = new URLSearchParams(window.location.search);

        return params.get('job_id') || params.get('dispatch_id') || null;
    }, []);

    const [modalDismissed, setModalDismissed] = useState(false);
    const [userOpenedModal, setUserOpenedModal] = useState(
        () => initialJobIdFromUrl !== null,
    );
    const [showExportModal, setShowExportModal] = useState(false);

    const showSubmitModal =
        (userOpenedModal || initialJobIdFromUrl !== null) && !modalDismissed;

    const [prefilledJobId] = useState<string | number | null>(
        initialJobIdFromUrl,
    );
    const [statusFilter, setStatusFilter] = useState<ReportFilterStatus>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<ReportSortOrder>('newest');
    const [selectedReportId, setSelectedReportId] = useState<number | null>(
        reports.length > 0 ? reports[0].id : null,
    );
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

    // Managers (fleet/reporting access) also get per-asset weekly reports;
    // the server enforces the actual permission.
    const canViewAssetReports =
        capabilities.export_reports || capabilities.review_job_report;
    const [initialAssetIdFromUrl] = useState<number | null>(() => {
        if (typeof window === 'undefined') {
            return null;
        }

        const id = Number(
            new URLSearchParams(window.location.search).get('asset_id'),
        );

        return Number.isInteger(id) && id > 0 ? id : null;
    });
    const [reportView, setReportView] = useState<'jobs' | 'asset'>(() =>
        canViewAssetReports &&
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('report') === 'asset'
            ? 'asset'
            : 'jobs',
    );

    const stats = useMemo(() => {
        const totalCount = serverStats?.total ?? total ?? reports.length;
        const drafts =
            serverStats?.draft ??
            reports.filter((r) => r.status.value === 'draft').length;
        const submitted =
            serverStats?.submitted ??
            reports.filter((r) => r.status.value === 'submitted').length;
        const approved =
            serverStats?.approved ??
            reports.filter((r) => r.status.value === 'approved').length;
        const rejected =
            serverStats?.rejected ??
            reports.filter((r) => r.status.value === 'rejected').length;
        const totalAttachments = reports.reduce(
            (acc, r) => acc + (r.attachments?.length ?? 0),
            0,
        );

        return {
            total: totalCount,
            drafts,
            submitted,
            approved,
            rejected,
            totalAttachments,
        };
    }, [reports, serverStats, total]);

    const completedExportsCount = useMemo(
        () =>
            exports.filter(
                (e) => e.status.value === 'completed' && !e.is_expired,
            ).length,
        [exports],
    );

    const filteredReports = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();

        const matches = reports.filter((report) => {
            if (
                statusFilter !== 'all' &&
                report.status.value !== statusFilter
            ) {
                return false;
            }

            if (query === '') {
                return true;
            }

            return [
                report.job?.reference,
                report.job?.title,
                report.author?.name,
                report.work_summary,
                report.remarks,
                report.signer_name,
                String(report.dispatch_job_id),
                String(report.id),
            ].some((field) => field?.toLowerCase().includes(query));
        });

        return sortReports(matches, sortOrder);
    }, [reports, statusFilter, searchQuery, sortOrder]);

    const selectedReport = useMemo(() => {
        if (filteredReports.length === 0) {
            return null;
        }

        return (
            filteredReports.find((r) => r.id === selectedReportId) ??
            filteredReports[0]
        );
    }, [filteredReports, selectedReportId]);

    const openSubmitForm = () => {
        setModalDismissed(false);
        setUserOpenedModal(true);
    };

    const closeSubmitForm = () => {
        setModalDismissed(true);
        setUserOpenedModal(false);
    };

    const filtersActive = statusFilter !== 'all' || searchQuery.trim() !== '';

    const filterTabs: Array<{
        id: ReportFilterStatus;
        label: string;
        ariaLabel: string;
        count: number;
        dot?: string;
    }> = [
        {
            id: 'all',
            label: 'All',
            ariaLabel: `All reports (${stats.total})`,
            count: stats.total,
        },
        ...(stats.drafts > 0
            ? [
                  {
                      id: 'draft' as const,
                      label: 'Drafts',
                      ariaLabel: `Draft reports (${stats.drafts})`,
                      count: stats.drafts,
                      dot: 'bg-ink-soft',
                  },
              ]
            : []),
        {
            id: 'submitted',
            label: 'Pending Review',
            ariaLabel: `Pending Sign-Off reports Pending Review (${stats.submitted})`,
            count: stats.submitted,
            dot: 'bg-warning',
        },
        {
            id: 'approved',
            label: 'Approved',
            ariaLabel: `Approved reports (${stats.approved})`,
            count: stats.approved,
            dot: 'bg-success',
        },
        {
            id: 'rejected',
            label: 'Needs Rework',
            ariaLabel: `Needs rework reports (${stats.rejected})`,
            count: stats.rejected,
            dot: 'bg-danger',
        },
    ];

    const handleQueueKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
            return;
        }

        const currentIndex = filteredReports.findIndex(
            (r) => r.id === selectedReport?.id,
        );
        const nextIndex =
            event.key === 'ArrowDown'
                ? Math.min(filteredReports.length - 1, currentIndex + 1)
                : Math.max(0, currentIndex - 1);
        const next = filteredReports[nextIndex];

        if (!next) {
            return;
        }

        event.preventDefault();
        setSelectedReportId(next.id);
        event.currentTarget
            .querySelector<HTMLButtonElement>(`[data-report-id="${next.id}"]`)
            ?.focus();
    };

    return (
        <div className="workspace-width-contained">
            <PageHeading
                title={reportView === 'asset' ? 'Asset reports' : 'Job reports'}
                description={
                    reportView === 'asset'
                        ? 'One asset, one week: fuel and cost, who operated it, jobs, reports and condition — downloadable as PDF or CSV.'
                        : 'Review field work, meter readings, and customer sign-offs, then approve or export.'
                }
                actions={
                    reportView === 'jobs' && (
                        <>
                            {capabilities.export_reports && (
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowExportModal(true)}
                                >
                                    <Download className="h-4 w-4" />
                                    Export Records
                                    {completedExportsCount > 0 && (
                                        <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success-strong">
                                            {completedExportsCount} ready
                                        </span>
                                    )}
                                </Button>
                            )}
                            {capabilities.create_job_report && (
                                <Button
                                    id="report-submit-toggle"
                                    className="scroll-mt-24"
                                    variant={
                                        showSubmitModal
                                            ? 'secondary'
                                            : 'primary'
                                    }
                                    aria-expanded={showSubmitModal}
                                    aria-controls="report-submit-form"
                                    onClick={() =>
                                        showSubmitModal
                                            ? closeSubmitForm()
                                            : openSubmitForm()
                                    }
                                >
                                    {showSubmitModal ? (
                                        <X className="h-4 w-4" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
                                    {showSubmitModal
                                        ? 'Close report form'
                                        : 'File job report'}
                                </Button>
                            )}
                        </>
                    )
                }
            />

            <div className="space-y-5 p-4 md:p-6">
                {canViewAssetReports && (
                    <div
                        className="inline-flex rounded-lg border border-line bg-surface-subtle p-1"
                        role="tablist"
                        aria-label="Report type"
                    >
                        {(
                            [
                                ['jobs', 'Job reports', FileText],
                                ['asset', 'Asset weekly report', Truck],
                            ] as const
                        ).map(([id, label, Icon]) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={reportView === id}
                                onClick={() => setReportView(id)}
                                className={cn(
                                    'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors lg:min-h-9',
                                    reportView === id
                                        ? 'bg-surface text-ink shadow-xs'
                                        : 'text-ink-soft hover:text-ink',
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>
                )}

                {reportView === 'asset' ? (
                    <AssetWeeklyReportView
                        initialAssetId={initialAssetIdFromUrl}
                    />
                ) : (
                    <>
                        {showSubmitModal && capabilities.create_job_report && (
                            <SubmitJobReportForm
                                jobs={jobs}
                                initialJobId={prefilledJobId ?? ''}
                                capabilities={capabilities}
                                onDone={() => {
                                    closeSubmitForm();
                                    const focusToggle = () => {
                                        document
                                            .getElementById(
                                                'report-submit-toggle',
                                            )
                                            ?.focus({ preventScroll: true });
                                    };
                                    focusToggle();
                                    requestAnimationFrame(focusToggle);
                                    window.setTimeout(focusToggle, 50);
                                }}
                            />
                        )}

                        {/* Toolbar: status segments, search, sort */}
                        <div className="space-y-3 rounded-xl border border-line bg-surface p-3 shadow-2xs">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                <div
                                    className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5"
                                    role="group"
                                    aria-label="Filter reports by status"
                                >
                                    {filterTabs.map((tab) => {
                                        const active = statusFilter === tab.id;

                                        return (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                aria-label={tab.ariaLabel}
                                                aria-pressed={active}
                                                onClick={() =>
                                                    setStatusFilter(tab.id)
                                                }
                                                className={cn(
                                                    'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-colors lg:min-h-9',
                                                    active
                                                        ? 'bg-ink text-surface shadow-xs'
                                                        : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                                )}
                                            >
                                                {tab.dot && (
                                                    <span
                                                        aria-hidden="true"
                                                        className={cn(
                                                            'h-1.5 w-1.5 rounded-full',
                                                            tab.dot,
                                                        )}
                                                    />
                                                )}
                                                <span>{tab.label}</span>
                                                <span
                                                    className={cn(
                                                        'rounded-full px-1.5 py-px text-[10px] tabular-nums',
                                                        active
                                                            ? 'bg-surface/20'
                                                            : 'bg-surface-subtle',
                                                    )}
                                                >
                                                    {tab.count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <div className="relative w-full sm:w-80">
                                        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                                        <input
                                            type="search"
                                            value={searchQuery}
                                            onChange={(e) =>
                                                setSearchQuery(e.target.value)
                                            }
                                            placeholder="Search by job reference, title, author, or report text…"
                                            aria-label="Search job reports"
                                            className="h-11 w-full rounded-lg border border-line bg-surface-subtle pr-11 pl-9 text-sm text-ink placeholder:text-xs placeholder:text-ink-soft focus:border-brand-strong focus:bg-surface focus:outline-none lg:h-9 [&::-webkit-search-cancel-button]:hidden"
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSearchQuery('')
                                                }
                                                className="absolute top-1/2 right-0 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-ink-soft hover:text-ink lg:h-9 lg:w-9"
                                                aria-label="Clear search"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    <label className="relative flex items-center">
                                        <span className="sr-only">
                                            Sort reports
                                        </span>
                                        <ArrowDownUp className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-ink-soft" />
                                        <select
                                            value={sortOrder}
                                            onChange={(e) =>
                                                setSortOrder(
                                                    e.target
                                                        .value as ReportSortOrder,
                                                )
                                            }
                                            className="h-11 w-full appearance-none rounded-lg border border-line bg-surface-subtle pr-8 pl-8 text-xs font-medium text-ink focus:border-brand-strong focus:outline-none sm:w-auto lg:h-9"
                                        >
                                            <option value="newest">
                                                Newest first
                                            </option>
                                            <option value="oldest">
                                                Oldest first
                                            </option>
                                            <option value="pending_first">
                                                Needs action first
                                            </option>
                                            <option value="reference">
                                                Job reference
                                            </option>
                                        </select>
                                    </label>
                                </div>
                            </div>

                            <div
                                className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-xs text-ink-soft"
                                aria-label="Loaded reports scope summary"
                            >
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                    <span className="flex items-center gap-1.5">
                                        <Paperclip className="h-3.5 w-3.5" />
                                        <span>
                                            {stats.totalAttachments > 0
                                                ? `${stats.totalAttachments} attachments`
                                                : 'Loaded in current scope'}
                                        </span>
                                    </span>
                                    <span
                                        className={cn(
                                            'flex items-center gap-1.5',
                                            stats.submitted > 0 &&
                                                'font-medium text-warning-strong',
                                        )}
                                    >
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>
                                            {stats.submitted === 0
                                                ? 'No pending submissions in loaded scope'
                                                : `${stats.submitted} awaiting manager review`}
                                        </span>
                                    </span>
                                    <span className="hidden items-center gap-1.5 md:flex">
                                        <FileCheck className="h-3.5 w-3.5 text-success-strong" />
                                        <span>
                                            Approved by operations review
                                        </span>
                                    </span>
                                    {stats.rejected > 0 && (
                                        <span className="flex items-center gap-1.5 text-danger-strong">
                                            <FileX className="h-3.5 w-3.5" />
                                            <span>
                                                Returned to operator for
                                                revision ({stats.rejected})
                                            </span>
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {filtersActive && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStatusFilter('all');
                                                setSearchQuery('');
                                            }}
                                            className="font-semibold text-brand-strong hover:underline"
                                        >
                                            Reset filters
                                        </button>
                                    )}
                                    <span className="text-[11px] tabular-nums">
                                        Showing {filteredReports.length} of{' '}
                                        {stats.total} loaded
                                    </span>
                                </div>
                            </div>
                        </div>

                        {reports.length === 0 ? (
                            <Panel className="p-8 text-center sm:p-12">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong shadow-xs">
                                    <FileCheck
                                        className="h-7 w-7"
                                        aria-hidden="true"
                                    />
                                </div>
                                <h3 className="mt-4 text-base font-bold text-ink">
                                    No job reports in loaded scope
                                </h3>
                                <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
                                    When crane operators and drivers complete
                                    dispatches and submit digital work tickets
                                    or photos from the mobile app, they will
                                    appear here for manager review and sign-off.
                                </p>
                                {capabilities.create_job_report && (
                                    <div className="mt-6 flex justify-center">
                                        <Button
                                            variant="primary"
                                            onClick={openSubmitForm}
                                        >
                                            <Plus className="h-4 w-4" />
                                            File job report for past dispatch
                                        </Button>
                                    </div>
                                )}
                            </Panel>
                        ) : filteredReports.length === 0 ? (
                            <Panel className="p-8 text-center sm:p-12">
                                <EmptyState
                                    icon={Filter}
                                    title="No matching reports"
                                    message="No job reports match the active filter or search query."
                                />
                            </Panel>
                        ) : (
                            <div className="grid gap-5 lg:grid-cols-12">
                                {/* Report queue */}
                                <div
                                    className={cn(
                                        'lg:col-span-5 xl:col-span-4',
                                        mobileDetailOpen && 'hidden lg:block',
                                    )}
                                >
                                    <Panel className="overflow-hidden lg:sticky lg:top-4">
                                        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                                            <span className="text-sm font-semibold text-ink">
                                                Report Queue (
                                                {filteredReports.length})
                                            </span>
                                            <span className="hidden text-[11px] text-ink-soft lg:inline">
                                                ↑ ↓ to browse
                                            </span>
                                        </div>
                                        <ul
                                            className="max-h-[calc(100vh-14rem)] min-h-[320px] divide-y divide-line overflow-y-auto"
                                            onKeyDown={handleQueueKeyDown}
                                        >
                                            {filteredReports.map((report) => (
                                                <li key={report.id}>
                                                    <ReportQueueItem
                                                        report={report}
                                                        selected={
                                                            selectedReport?.id ===
                                                            report.id
                                                        }
                                                        onSelect={() => {
                                                            setSelectedReportId(
                                                                report.id,
                                                            );
                                                            setMobileDetailOpen(
                                                                true,
                                                            );
                                                        }}
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    </Panel>
                                </div>

                                {/* Report detail */}
                                <div
                                    className={cn(
                                        'lg:col-span-7 xl:col-span-8',
                                        !mobileDetailOpen && 'hidden lg:block',
                                    )}
                                >
                                    {selectedReport ? (
                                        <ReportDetailPane
                                            key={selectedReport.id}
                                            report={selectedReport}
                                            capabilities={capabilities}
                                            onBackToQueue={() =>
                                                setMobileDetailOpen(false)
                                            }
                                        />
                                    ) : (
                                        <Panel>
                                            <EmptyState
                                                icon={FileText}
                                                title="Select a job report"
                                                message="Choose a report from the queue to review operator telemetry, hours, and customer sign-off."
                                            />
                                        </Panel>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {showExportModal && capabilities.export_reports && (
                <ExportDialog
                    exports={exports}
                    capabilities={capabilities}
                    visibleReports={filteredReports}
                    statusFilter={statusFilter}
                    onClose={() => setShowExportModal(false)}
                />
            )}
        </div>
    );
}

function ReportQueueItem({
    report,
    selected,
    onSelect,
}: {
    report: JobReportViewModel;
    selected: boolean;
    onSelect: () => void;
}) {
    const minutes = reportDurationMinutes(report);
    // Compact list form (e.g. "6.5 h"); the detail pane shows the exact value.
    const duration =
        minutes === null
            ? ''
            : minutes < 60
              ? `${minutes} min`
              : `${Math.round(minutes / 6) / 10} h`;
    const signed = Boolean(report.signer_name?.trim());

    return (
        <button
            type="button"
            data-report-id={report.id}
            aria-current={selected ? 'true' : undefined}
            onClick={onSelect}
            className={cn(
                'relative w-full px-4 py-3.5 text-left transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none',
                selected && 'bg-brand-soft/50 hover:bg-brand-soft/60',
            )}
        >
            {selected && (
                <span
                    aria-hidden="true"
                    className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-strong"
                />
            )}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                        {report.job?.reference ??
                            `Job #${report.dispatch_job_id}`}
                    </span>
                    {report.job?.title && (
                        <span className="block truncate text-xs text-ink-soft">
                            {report.job.title}
                        </span>
                    )}
                </div>
                <CanonicalStatusBadge status={report.status} />
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink">
                {report.work_summary}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-soft">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                    <span
                        aria-hidden="true"
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-[9px] font-bold text-ink"
                    >
                        {(report.author?.name ?? '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">
                        By{' '}
                        <strong className="font-medium text-ink">
                            {report.author?.name ?? 'Unknown'}
                        </strong>
                    </span>
                </span>
                <span>
                    {report.submitted_at
                        ? formatDateTime(report.submitted_at)
                        : 'Unsubmitted Draft'}
                </span>
                <span className="ml-auto flex items-center gap-2.5">
                    {duration && (
                        <span className="inline-flex items-center gap-0.5 tabular-nums">
                            <Timer className="h-3 w-3" />
                            <span className="sr-only">Duration </span>
                            {duration}
                        </span>
                    )}
                    {signed && (
                        <span
                            className="inline-flex items-center text-success-strong"
                            title="Client sign-off recorded"
                        >
                            <UserCheck className="h-3 w-3" />
                            <span className="sr-only">Signed off</span>
                        </span>
                    )}
                    <span className="inline-flex items-center gap-0.5 tabular-nums">
                        <Paperclip className="h-3 w-3" />
                        {report.attachments.length}
                        <span className="sr-only"> files</span>
                    </span>
                </span>
            </div>
        </button>
    );
}

function ExportDialog({
    exports,
    capabilities,
    visibleReports,
    statusFilter,
    onClose,
}: {
    exports: ReportExportViewModel[];
    capabilities: WorkspaceCapabilities;
    visibleReports: JobReportViewModel[];
    statusFilter: ReportFilterStatus;
    onClose: () => void;
}) {
    const [notice, setNotice] = useState<string | null>(null);
    const count = visibleReports.length;

    useEffect(() => {
        const onKey = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const suffix = statusFilter === 'all' ? 'view' : statusFilter;

    return (
        <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 backdrop-blur-xs sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-dialog-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
                    <div>
                        <h2
                            id="export-dialog-title"
                            className="text-lg font-bold text-ink"
                        >
                            Export Operational Records
                        </h2>
                        <p className="text-xs text-ink-soft">
                            Grab what you see instantly, or queue a full
                            background export for any date range.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-none"
                        aria-label="Close export dialog"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-6 p-5">
                    <section aria-labelledby="instant-export-title">
                        <div className="flex items-baseline justify-between gap-2">
                            <h3
                                id="instant-export-title"
                                className="text-sm font-semibold text-ink"
                            >
                                Instant export
                            </h3>
                            <span className="text-xs text-ink-soft">
                                {count} report{count === 1 ? '' : 's'} in the
                                current view
                            </span>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <InstantExportCard
                                icon={
                                    <FileSpreadsheet className="h-5 w-5 text-success-strong" />
                                }
                                title="Spreadsheet (CSV)"
                                description="One row per report with times, duration, meter, sign-off, and attachment counts. Opens in Excel or Sheets."
                                actionLabel={`Download CSV (${count})`}
                                disabled={count === 0}
                                onAction={() => {
                                    downloadJobReportsCsv(
                                        visibleReports,
                                        jobReportsExportFilename(suffix, 'csv'),
                                    );
                                    setNotice(
                                        `Downloaded ${count} report${count === 1 ? '' : 's'} as CSV.`,
                                    );
                                }}
                            />
                            <InstantExportCard
                                icon={
                                    <FileText className="h-5 w-5 text-brand-strong" />
                                }
                                title="Report packet (PDF)"
                                description={`A PDF file with one formatted page per report, including attachments list and sign-off lines.${count > JOB_REPORT_PACKET_LIMIT ? ` Limited to the first ${JOB_REPORT_PACKET_LIMIT}.` : ''}`}
                                actionLabel={`Download PDF (${Math.min(count, JOB_REPORT_PACKET_LIMIT)})`}
                                disabled={count === 0}
                                href={jobReportsPacketUrl(
                                    visibleReports.map((r) => r.id),
                                )}
                                onAction={() =>
                                    setNotice(
                                        'Generating PDF — your download will start in a moment.',
                                    )
                                }
                            />
                        </div>
                        {notice && (
                            <p
                                className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft"
                                role="status"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 text-success-strong" />
                                {notice}
                            </p>
                        )}
                    </section>

                    <div className="border-t border-line pt-2">
                        <ExportsSurface
                            exports={exports}
                            capabilities={capabilities}
                            embedded
                            defaultStatus={
                                statusFilter === 'all' ? '' : statusFilter
                            }
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function InstantExportCard({
    icon,
    title,
    description,
    actionLabel,
    disabled,
    href,
    onAction,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    actionLabel: string;
    disabled: boolean;
    /** Server download URL; renders a real link instead of a button. */
    href?: string;
    onAction: () => void;
}) {
    return (
        <div className="flex flex-col rounded-xl border border-line bg-surface-subtle/60 p-4">
            <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface shadow-2xs">
                    {icon}
                </span>
                <span className="text-sm font-semibold text-ink">{title}</span>
            </div>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-ink-soft">
                {description}
            </p>
            {href && !disabled ? (
                <a
                    href={href}
                    download
                    onClick={onAction}
                    className={buttonVariants({
                        size: 'sm',
                        variant: 'secondary',
                        className: 'mt-3 self-start',
                    })}
                >
                    <Download className="h-3.5 w-3.5" />
                    {actionLabel}
                </a>
            ) : (
                <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3 self-start"
                    onClick={onAction}
                    disabled={disabled}
                >
                    <Download className="h-3.5 w-3.5" />
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}

function FormSection({
    step,
    title,
    hint,
    children,
}: {
    step: number;
    title: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <fieldset className="grid gap-4 border-t border-line pt-5 first:border-t-0 first:pt-0 md:grid-cols-[200px_1fr] md:gap-6">
            <legend className="sr-only">{title}</legend>
            <div aria-hidden="true">
                <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-strong">
                        {step}
                    </span>
                    <span className="text-sm font-semibold text-ink">
                        {title}
                    </span>
                </div>
                {hint && (
                    <p className="mt-1 pl-8 text-xs leading-relaxed text-ink-soft">
                        {hint}
                    </p>
                )}
            </div>
            <div className="min-w-0 space-y-4">{children}</div>
        </fieldset>
    );
}

function AttachmentDropzone({
    inputId,
    files,
    maxCount,
    maxBytes,
    acceptedMimeTypes,
    error,
    label,
    onAdd,
    onRemove,
}: {
    inputId: string;
    files: File[];
    maxCount: number;
    maxBytes: number;
    acceptedMimeTypes: string[];
    error: string | null;
    label: string;
    onAdd: (files: File[]) => void;
    onRemove: (index: number) => void;
}) {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div>
            <label
                htmlFor={inputId}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    onAdd(Array.from(e.dataTransfer.files ?? []));
                }}
                className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
                    dragging
                        ? 'border-brand-strong bg-brand-soft/40'
                        : 'border-line-strong bg-surface-subtle/60 hover:border-brand-strong/60 hover:bg-surface-subtle',
                )}
            >
                <UploadCloud className="h-6 w-6 text-brand-strong" />
                <span className="text-sm font-semibold text-ink">{label}</span>
                <span className="text-xs text-ink-soft">
                    Drop files here or{' '}
                    <span className="font-semibold text-brand-strong underline">
                        browse
                    </span>{' '}
                    · JPEG, PNG, HEIC, PDF · up to {maxCount} files,{' '}
                    {Math.round(maxBytes / 1024 / 1024)} MiB each
                </span>
            </label>
            <input
                ref={inputRef}
                id={inputId}
                type="file"
                multiple
                accept={acceptedMimeTypes.join(',')}
                onChange={(e) => {
                    onAdd(Array.from(e.target.files ?? []));
                    // Allow re-selecting the same file after removal.
                    e.target.value = '';
                }}
                className="sr-only"
            />

            {error && (
                <div
                    className="mt-2 flex items-center gap-1.5 text-xs text-danger"
                    role="alert"
                >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {files.length > 0 && (
                <ul
                    className="mt-3 grid gap-2 sm:grid-cols-2"
                    aria-label="Selected attachments"
                >
                    {files.map((file, idx) => {
                        const tooLarge = file.size > maxBytes;
                        const Icon = file.type.startsWith('image/')
                            ? FileImage
                            : FileText;

                        return (
                            <li
                                key={`${file.name}-${file.size}-${idx}`}
                                className={cn(
                                    'flex items-center gap-2.5 rounded-lg border bg-surface px-3 py-2 text-xs',
                                    tooLarge || idx >= maxCount
                                        ? 'border-danger/40'
                                        : 'border-line',
                                )}
                            >
                                <Icon className="h-4 w-4 shrink-0 text-brand-strong" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium text-ink">
                                        {file.name}
                                    </span>
                                    <span className="text-[11px] text-ink-soft">
                                        {(file.size / 1024 / 1024).toFixed(2)}{' '}
                                        MB
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onRemove(idx)}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-danger-soft/50 hover:text-danger-strong"
                                    aria-label={`Remove ${file.name}`}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
            {files.length > 0 && (
                <p className="mt-1.5 text-[11px] text-ink-soft">
                    {files.length}/{maxCount} files staged
                </p>
            )}
        </div>
    );
}

function validateStagedFiles(
    files: File[],
    maxCount: number,
    maxBytes: number,
): string | null {
    if (files.length > maxCount) {
        return `You cannot attach more than ${maxCount} files per job report.`;
    }

    const oversized = files.find((file) => file.size > maxBytes);

    if (oversized) {
        return `File "${oversized.name}" exceeds the maximum allowed size of ${(maxBytes / 1024 / 1024).toFixed(0)} MiB.`;
    }

    return null;
}

function mergeFiles(existing: File[], incoming: File[]): File[] {
    const seen = new Set(existing.map((f) => `${f.name}:${f.size}`));

    return [
        ...existing,
        ...incoming.filter((f) => !seen.has(`${f.name}:${f.size}`)),
    ];
}

function durationPreview(started: string, ended: string): string | null {
    if (!started || !ended) {
        return null;
    }

    const minutes = reportDurationMinutes({
        started_at: started,
        ended_at: ended,
    });

    return minutes === null
        ? 'End is before start'
        : formatDurationMinutes(minutes);
}

function SubmitJobReportForm({
    jobs = [],
    initialJobId = '',
    capabilities,
    onDone,
}: {
    jobs?: DispatchJobViewModel[];
    initialJobId?: string | number;
    capabilities: WorkspaceCapabilities;
    onDone: () => void;
}) {
    const maxBytes = capabilities.attachment_policy?.max_bytes || 15728640; // 15 MiB default
    const maxCount = capabilities.attachment_policy?.max_count || 10;
    const acceptedMimeTypes = capabilities.attachment_policy
        ?.accepted_mime_types || [
        'image/jpeg',
        'image/png',
        'image/heic',
        'image/heif',
        'application/pdf',
    ];

    const [fileValidationError, setFileValidationError] = useState<
        string | null
    >(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [gpsCapturing, setGpsCapturing] = useState(false);
    const [gpsError, setGpsError] = useState<string | null>(null);

    const { errors: pageErrors = {} } = usePage().props as {
        errors?: Record<string, string>;
    };

    const form = useForm({
        dispatch_job_id: initialJobId ? String(initialJobId) : '',
        work_summary: '',
        remarks: '',
        started_at: '',
        ended_at: '',
        ending_meter_value: '',
        meter_type: 'odometer_km',
        latitude: '',
        longitude: '',
        is_draft: false,
        attachments: [] as File[],
    });

    const selectedJob = jobs.find(
        (j) => String(j.id) === String(form.data.dispatch_job_id),
    );
    const duration = durationPreview(form.data.started_at, form.data.ended_at);

    const combinedErrors = {
        ...pageErrors,
        ...form.errors,
        ...(fileValidationError ? { file: fileValidationError } : {}),
        ...(submitError ? { submit: submitError } : {}),
    };
    const hasErrors = Object.keys(combinedErrors).length > 0;

    const captureLocation = () => {
        setGpsError(null);

        if (typeof window === 'undefined' || !navigator.geolocation) {
            setGpsError('Geolocation is not supported by your browser.');

            return;
        }

        setGpsCapturing(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                form.setData((data) => ({
                    ...data,
                    latitude: pos.coords.latitude.toFixed(6),
                    longitude: pos.coords.longitude.toFixed(6),
                }));
                setGpsCapturing(false);
            },
            (err) => {
                setGpsError(`GPS location capture failed: ${err.message}`);
                setGpsCapturing(false);
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    const setAttachments = (files: File[]) => {
        setFileValidationError(validateStagedFiles(files, maxCount, maxBytes));
        form.setData('attachments', files);
    };

    const send = (isDraft: boolean) => {
        form.transform((data) => ({
            ...data,
            is_draft: isDraft,
        }));

        form.post('/operations/job-reports', {
            preserveState: true,
            preserveScroll: true,
            forceFormData: true,
            onError: (errors) => {
                setSubmitError(
                    'Unable to submit job report. Please check the highlighted fields and try again.',
                );

                if (
                    errors.attachments ||
                    Object.keys(errors).some((k) =>
                        k.startsWith('attachments.'),
                    )
                ) {
                    setFileValidationError(
                        errors.attachments ||
                            Object.entries(errors).find(([k]) =>
                                k.startsWith('attachments.'),
                            )?.[1] ||
                            'One or more attachments are invalid.',
                    );
                }
            },
            onSuccess: () => {
                setSubmitError(null);
                setFileValidationError(null);
                form.reset();
                onDone();
            },
        });
    };

    const submitAsFinal = (e: FormEvent) => {
        e.preventDefault();
        send(false);
    };

    return (
        <Panel
            id="report-submit-form"
            className="scroll-mt-24 overflow-hidden p-0"
        >
            <div className="flex items-start justify-between gap-3 border-b border-line bg-surface-subtle/60 px-4 py-4 md:px-6">
                <div>
                    <h3 className="text-base font-semibold text-ink">
                        Submit Job Completion Report
                    </h3>
                    <p className="text-xs text-ink-soft">
                        Only the job and a short summary are required — save a
                        draft anytime and finish later.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onDone}
                    className="flex h-11 w-11 shrink-0 scroll-mt-24 items-center justify-center rounded-lg text-ink-soft hover:bg-surface hover:text-ink"
                    aria-label="Close form"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <form
                onSubmit={submitAsFinal}
                className="space-y-5 px-4 py-5 md:px-6"
                noValidate
                aria-busy={form.processing}
            >
                <FormSection
                    step={1}
                    title="Job & work done"
                    hint="Pick the dispatch and describe what was completed."
                >
                    <div>
                        <label
                            htmlFor="report-dispatch-select"
                            className={labelClass}
                        >
                            Dispatch Job *
                        </label>
                        {jobs.length > 0 ? (
                            <select
                                id="report-dispatch-select"
                                value={form.data.dispatch_job_id}
                                onChange={(e) =>
                                    form.setData(
                                        'dispatch_job_id',
                                        e.target.value,
                                    )
                                }
                                className={inputClass}
                                required
                            >
                                <option value="">
                                    Select an operational dispatch…
                                </option>
                                {jobs.map((j) => (
                                    <option key={j.id} value={j.id}>
                                        {j.reference} —{' '}
                                        {j.title || j.client || 'Dispatch'} (
                                        {j.status.label})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                id="report-dispatch-select"
                                type="number"
                                value={form.data.dispatch_job_id}
                                onChange={(e) =>
                                    form.setData(
                                        'dispatch_job_id',
                                        e.target.value,
                                    )
                                }
                                className={inputClass}
                                placeholder="e.g. 101"
                                required
                            />
                        )}
                        {selectedJob?.client && (
                            <p className="mt-1 text-xs text-ink-soft">
                                Client:{' '}
                                <span className="font-medium text-ink">
                                    {selectedJob.client}
                                </span>
                            </p>
                        )}
                        {form.errors.dispatch_job_id && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.dispatch_job_id}
                            </p>
                        )}
                    </div>

                    <div>
                        <div className="flex items-baseline justify-between">
                            <label
                                htmlFor="report-work-summary"
                                className={labelClass}
                            >
                                Work Summary *
                            </label>
                            <span className="text-[11px] text-ink-soft tabular-nums">
                                {form.data.work_summary.length} chars
                            </span>
                        </div>
                        <textarea
                            id="report-work-summary"
                            rows={3}
                            value={form.data.work_summary}
                            onChange={(e) =>
                                form.setData('work_summary', e.target.value)
                            }
                            className={textareaClass}
                            placeholder="Brief description of work executed"
                            required
                        />
                        {form.errors.work_summary && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.work_summary}
                            </p>
                        )}
                    </div>
                </FormSection>

                <FormSection
                    step={2}
                    title="Time & meter"
                    hint="Optional, but needed for billing and utilization."
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <DateTimePicker
                            id="report-started-at"
                            label="Started At"
                            optional
                            value={form.data.started_at}
                            onChange={(value) =>
                                form.setData('started_at', value)
                            }
                            error={form.errors.started_at}
                            placeholder="Select start date & time…"
                        />
                        <DateTimePicker
                            id="report-ended-at"
                            label="Ended At"
                            optional
                            value={form.data.ended_at}
                            onChange={(value) =>
                                form.setData('ended_at', value)
                            }
                            error={form.errors.ended_at}
                            placeholder="Select end date & time…"
                        />
                    </div>
                    {duration && (
                        <p
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
                                duration === 'End is before start'
                                    ? 'bg-danger-soft/50 text-danger-strong'
                                    : 'bg-brand-soft/60 text-brand-strong',
                            )}
                        >
                            <Timer className="h-3.5 w-3.5" />
                            {duration === 'End is before start'
                                ? duration
                                : `Elapsed ${duration}`}
                        </p>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label
                                htmlFor="report-meter-type"
                                className={labelClass}
                            >
                                Meter Type
                            </label>
                            <select
                                id="report-meter-type"
                                value={form.data.meter_type}
                                onChange={(e) =>
                                    form.setData('meter_type', e.target.value)
                                }
                                className={inputClass}
                            >
                                <option value="odometer_km">
                                    Odometer (km)
                                </option>
                                <option value="engine_hours">
                                    Engine Hours (hrs)
                                </option>
                                <option value="none">
                                    None / Not Applicable
                                </option>
                            </select>
                        </div>
                        {form.data.meter_type !== 'none' && (
                            <div>
                                <label
                                    htmlFor="report-meter-value"
                                    className={labelClass}
                                >
                                    Ending Meter Value
                                </label>
                                <div className="relative mt-1.5">
                                    <input
                                        id="report-meter-value"
                                        type="number"
                                        inputMode="decimal"
                                        step="0.1"
                                        value={form.data.ending_meter_value}
                                        onChange={(e) =>
                                            form.setData(
                                                'ending_meter_value',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="e.g. 50120.5"
                                        className={cn(inputClass, 'mt-0 pr-12')}
                                    />
                                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-soft">
                                        {meterUnit(form.data.meter_type)}
                                    </span>
                                </div>
                                {form.errors.ending_meter_value && (
                                    <p className="mt-1 text-xs text-danger">
                                        {form.errors.ending_meter_value}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </FormSection>

                <FormSection
                    step={3}
                    title="Site & notes"
                    hint="Stamp your location and note delays or conditions."
                >
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-subtle/60 p-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0 text-brand-strong" />
                            <div className="min-w-0 text-xs">
                                <span className="font-semibold text-ink">
                                    Geofence Stamp:
                                </span>{' '}
                                {form.data.latitude && form.data.longitude ? (
                                    <LocationLabel
                                        latitude={Number(form.data.latitude)}
                                        longitude={Number(form.data.longitude)}
                                        variant="inline"
                                        showIcon={false}
                                        className="text-xs"
                                    />
                                ) : (
                                    <span className="text-ink-soft">
                                        No coordinates stamped
                                    </span>
                                )}
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={captureLocation}
                            disabled={gpsCapturing}
                        >
                            <MapPin className="h-3.5 w-3.5" />
                            {gpsCapturing
                                ? 'Locating…'
                                : form.data.latitude
                                  ? 'Re-stamp GPS'
                                  : 'Stamp Current GPS'}
                        </Button>
                        {gpsError && (
                            <p
                                className="w-full text-xs text-danger"
                                role="alert"
                            >
                                {gpsError}
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="report-remarks" className={labelClass}>
                            Remarks / Operational Notes
                        </label>
                        <textarea
                            id="report-remarks"
                            rows={3}
                            value={form.data.remarks}
                            onChange={(e) =>
                                form.setData('remarks', e.target.value)
                            }
                            className={textareaClass}
                            placeholder="Additional operational observations, delays, equipment condition, or site notes"
                        />
                    </div>
                </FormSection>

                {capabilities.attachment_upload && (
                    <FormSection
                        step={4}
                        title="Evidence"
                        hint="Photos of work, delivery slips, or signed tickets. Stored privately with SHA-256 integrity checks."
                    >
                        <AttachmentDropzone
                            inputId="report-attachments"
                            label="Add photos or documents"
                            files={form.data.attachments}
                            maxCount={maxCount}
                            maxBytes={maxBytes}
                            acceptedMimeTypes={acceptedMimeTypes}
                            error={fileValidationError}
                            onAdd={(incoming) =>
                                setAttachments(
                                    mergeFiles(form.data.attachments, incoming),
                                )
                            }
                            onRemove={(idx) =>
                                setAttachments(
                                    form.data.attachments.filter(
                                        (_, i) => i !== idx,
                                    ),
                                )
                            }
                        />
                        {form.errors.attachments && (
                            <p
                                className="mt-1 text-xs text-danger"
                                role="alert"
                            >
                                {form.errors.attachments}
                            </p>
                        )}
                    </FormSection>
                )}

                {form.progress && (
                    <div aria-live="polite" className="space-y-1">
                        <div className="flex justify-between text-xs text-ink-soft">
                            <span>Uploading securely…</span>
                            <span>{form.progress.percentage}%</span>
                        </div>
                        <progress
                            className="h-2 w-full accent-brand"
                            value={form.progress.percentage}
                            max="100"
                            aria-label="Upload progress"
                        />
                    </div>
                )}

                {(hasErrors || Boolean(submitError)) && (
                    <div
                        className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger"
                        role="alert"
                    >
                        <AlertCircle className="mt-px h-4 w-4 shrink-0" />
                        <p className="font-semibold">
                            {submitError ||
                                'Unable to submit job report. Please check the highlighted fields and try again.'}
                        </p>
                    </div>
                )}

                <div className="-mx-4 -mb-5 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-subtle/60 px-4 py-3 md:-mx-6 md:px-6">
                    <Button type="button" variant="quiet" onClick={onDone}>
                        Cancel
                    </Button>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={(e) => {
                                e.preventDefault();
                                send(true);
                            }}
                            disabled={form.processing}
                        >
                            <Save className="h-4 w-4" />
                            Save as Draft
                        </Button>
                        <Button
                            id="submit-job-report-btn"
                            data-testid="submit-job-report-btn"
                            type="submit"
                            variant="primary"
                            disabled={form.processing}
                        >
                            <Check className="h-4 w-4" />
                            {form.processing
                                ? 'Submitting…'
                                : 'Submit Job Report'}
                        </Button>
                    </div>
                </div>
            </form>
        </Panel>
    );
}

/** ISO timestamp → value for a datetime-local input in the viewer's timezone. */
function toLocalInputValue(value: string | null): string {
    if (!value) {
        return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const pad = (n: number) => String(n).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ResubmitJobReportModal({
    report,
    capabilities,
    onDone,
}: {
    report: JobReportViewModel;
    capabilities: WorkspaceCapabilities;
    onDone: () => void;
}) {
    const maxBytes = capabilities.attachment_policy?.max_bytes || 15728640;
    const maxCount = capabilities.attachment_policy?.max_count || 10;
    const acceptedMimeTypes = capabilities.attachment_policy
        ?.accepted_mime_types || [
        'image/jpeg',
        'image/png',
        'image/heic',
        'image/heif',
        'application/pdf',
    ];
    const remainingSlots = Math.max(0, maxCount - report.attachments.length);

    const [fileValidationError, setFileValidationError] = useState<
        string | null
    >(null);

    const form = useForm({
        work_summary: report.work_summary || '',
        remarks: report.remarks || '',
        started_at: toLocalInputValue(report.started_at),
        ended_at: toLocalInputValue(report.ended_at),
        ending_meter_value:
            report.ending_meter_value !== null &&
            report.ending_meter_value !== undefined
                ? String(report.ending_meter_value)
                : '',
        meter_type: report.meter_type || 'odometer_km',
        latitude:
            report.latitude !== null && report.latitude !== undefined
                ? String(report.latitude)
                : '',
        longitude:
            report.longitude !== null && report.longitude !== undefined
                ? String(report.longitude)
                : '',
        attachments: [] as File[],
    });

    const duration = durationPreview(form.data.started_at, form.data.ended_at);

    const setAttachments = (files: File[]) => {
        setFileValidationError(
            validateStagedFiles(files, remainingSlots, maxBytes),
        );
        form.setData('attachments', files);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        setFileValidationError(null);

        form.post(`/operations/job-reports/${report.id}/resubmit`, {
            preserveState: true,
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                onDone();
            },
        });
    };

    const isDraft = report.status.value === 'draft';

    return (
        <Panel className="overflow-hidden p-0">
            <div className="flex items-start justify-between gap-3 border-b border-line bg-surface-subtle/60 px-4 py-4 md:px-6">
                <div>
                    <h3 className="text-base font-semibold text-ink">
                        {isDraft ? 'Finish Draft' : 'Edit & Resubmit'} Job
                        Report #{report.id}
                    </h3>
                    <p className="text-xs text-ink-soft">
                        {report.job?.reference ??
                            `Dispatch #${report.dispatch_job_id}`}
                        {report.job?.title ? ` · ${report.job.title}` : ''}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onDone}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-surface hover:text-ink"
                    aria-label="Close modal"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <form
                onSubmit={submit}
                className="space-y-5 px-4 py-5 md:px-6"
                noValidate
                aria-busy={form.processing}
            >
                {report.rejection_reason && (
                    <div className="rounded-lg border border-danger/30 bg-danger-soft/40 p-3.5 text-xs text-danger-strong">
                        <div className="flex items-center gap-1.5 font-bold">
                            <AlertCircle className="h-4 w-4" />
                            <span>Manager Feedback / Reason for Return:</span>
                        </div>
                        <p className="mt-1 text-sm whitespace-pre-line text-ink">
                            {report.rejection_reason}
                        </p>
                    </div>
                )}

                <div>
                    <label
                        htmlFor={`resubmit-summary-${report.id}`}
                        className={labelClass}
                    >
                        Work Summary *
                    </label>
                    <textarea
                        id={`resubmit-summary-${report.id}`}
                        rows={4}
                        value={form.data.work_summary}
                        onChange={(e) =>
                            form.setData('work_summary', e.target.value)
                        }
                        className={textareaClass}
                        required
                    />
                    {form.errors.work_summary && (
                        <p className="mt-1 text-xs text-danger">
                            {form.errors.work_summary}
                        </p>
                    )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <label
                            htmlFor={`resubmit-start-${report.id}`}
                            className={labelClass}
                        >
                            Started At
                        </label>
                        <input
                            id={`resubmit-start-${report.id}`}
                            type="datetime-local"
                            value={form.data.started_at}
                            onChange={(e) =>
                                form.setData('started_at', e.target.value)
                            }
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label
                            htmlFor={`resubmit-end-${report.id}`}
                            className={labelClass}
                        >
                            Ended At
                        </label>
                        <input
                            id={`resubmit-end-${report.id}`}
                            type="datetime-local"
                            value={form.data.ended_at}
                            onChange={(e) =>
                                form.setData('ended_at', e.target.value)
                            }
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label
                            htmlFor={`resubmit-meter-type-${report.id}`}
                            className={labelClass}
                        >
                            Meter Type
                        </label>
                        <select
                            id={`resubmit-meter-type-${report.id}`}
                            value={form.data.meter_type}
                            onChange={(e) =>
                                form.setData('meter_type', e.target.value)
                            }
                            className={inputClass}
                        >
                            <option value="odometer_km">Odometer (km)</option>
                            <option value="engine_hours">
                                Engine Hours (hrs)
                            </option>
                            <option value="none">None</option>
                        </select>
                    </div>
                    <div>
                        <label
                            htmlFor={`resubmit-meter-${report.id}`}
                            className={labelClass}
                        >
                            Ending Meter Reading
                        </label>
                        <input
                            id={`resubmit-meter-${report.id}`}
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            value={form.data.ending_meter_value}
                            disabled={form.data.meter_type === 'none'}
                            onChange={(e) =>
                                form.setData(
                                    'ending_meter_value',
                                    e.target.value,
                                )
                            }
                            className={cn(inputClass, 'disabled:opacity-50')}
                        />
                    </div>
                </div>
                {duration && (
                    <p className="text-xs text-ink-soft">
                        <Timer className="mr-1 inline h-3.5 w-3.5" />
                        {duration === 'End is before start'
                            ? duration
                            : `Elapsed ${duration}`}
                    </p>
                )}

                <div>
                    <label
                        htmlFor={`resubmit-remarks-${report.id}`}
                        className={labelClass}
                    >
                        Remarks & Action Taken
                    </label>
                    <textarea
                        id={`resubmit-remarks-${report.id}`}
                        rows={3}
                        value={form.data.remarks}
                        onChange={(e) =>
                            form.setData('remarks', e.target.value)
                        }
                        placeholder="Explain adjustments made to address reviewer notes"
                        className={textareaClass}
                    />
                </div>

                {capabilities.attachment_upload && remainingSlots > 0 && (
                    <AttachmentDropzone
                        inputId={`resubmit-attachments-${report.id}`}
                        label="Add Additional Attachments"
                        files={form.data.attachments}
                        maxCount={remainingSlots}
                        maxBytes={maxBytes}
                        acceptedMimeTypes={acceptedMimeTypes}
                        error={fileValidationError}
                        onAdd={(incoming) =>
                            setAttachments(
                                mergeFiles(form.data.attachments, incoming),
                            )
                        }
                        onRemove={(idx) =>
                            setAttachments(
                                form.data.attachments.filter(
                                    (_, i) => i !== idx,
                                ),
                            )
                        }
                    />
                )}

                <div className="-mx-4 -mb-5 flex justify-end gap-2 border-t border-line bg-surface-subtle/60 px-4 py-3 md:-mx-6 md:px-6">
                    <Button type="button" variant="quiet" onClick={onDone}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={
                            form.processing || !form.data.work_summary.trim()
                        }
                    >
                        <RotateCcw className="h-4 w-4" />
                        {form.processing
                            ? 'Resubmitting…'
                            : isDraft
                              ? 'Submit Report'
                              : 'Resubmit Report'}
                    </Button>
                </div>
            </form>
        </Panel>
    );
}

function ReportProgress({ report }: { report: JobReportViewModel }) {
    const status = report.status.value;
    const steps: Array<{
        label: string;
        state: 'done' | 'current' | 'upcoming' | 'returned';
    }> = [
        {
            label: 'Drafted',
            state: status === 'draft' ? 'current' : 'done',
        },
        {
            label: 'Submitted',
            state:
                status === 'draft'
                    ? 'upcoming'
                    : status === 'submitted'
                      ? 'current'
                      : 'done',
        },
        {
            label:
                status === 'approved'
                    ? 'Signed off'
                    : status === 'rejected'
                      ? 'Returned'
                      : 'Manager review',
            state:
                status === 'approved'
                    ? 'done'
                    : status === 'rejected'
                      ? 'returned'
                      : 'upcoming',
        },
    ];

    return (
        <ol
            className="flex items-center gap-1.5 text-[11px] font-medium"
            aria-label="Report progress"
        >
            {steps.map((step, index) => (
                <li key={step.label} className="flex items-center gap-1.5">
                    {index > 0 && (
                        <span
                            aria-hidden="true"
                            className={cn(
                                'h-px w-4 sm:w-8',
                                step.state === 'upcoming'
                                    ? 'bg-line-strong'
                                    : 'bg-ink-soft',
                            )}
                        />
                    )}
                    <span
                        className={cn(
                            'inline-flex items-center gap-1',
                            step.state === 'done' && 'text-success-strong',
                            step.state === 'current' && 'text-ink',
                            step.state === 'upcoming' && 'text-ink-soft',
                            step.state === 'returned' && 'text-danger-strong',
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                'flex h-4 w-4 items-center justify-center rounded-full border',
                                step.state === 'done' &&
                                    'border-success-strong bg-success-strong text-surface',
                                step.state === 'current' &&
                                    'border-ink bg-surface',
                                step.state === 'upcoming' &&
                                    'border-line-strong',
                                step.state === 'returned' &&
                                    'border-danger-strong bg-danger-strong text-surface',
                            )}
                        >
                            {step.state === 'done' && (
                                <Check className="h-2.5 w-2.5" />
                            )}
                            {step.state === 'returned' && (
                                <X className="h-2.5 w-2.5" />
                            )}
                            {step.state === 'current' && (
                                <span className="h-1.5 w-1.5 rounded-full bg-ink" />
                            )}
                        </span>
                        {step.label}
                    </span>
                </li>
            ))}
        </ol>
    );
}

function FactTile({
    icon,
    label,
    children,
}: {
    icon?: ReactNode;
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="min-w-0 rounded-lg border border-line bg-surface px-3 py-2.5">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-soft">
                {icon}
                {label}
            </span>
            <div className="mt-0.5 truncate text-sm font-semibold text-ink tabular-nums">
                {children}
            </div>
        </div>
    );
}

function SectionHeading({
    children,
    aside,
}: {
    children: ReactNode;
    aside?: ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-ink-soft uppercase">
                {children}
            </h3>
            {aside}
        </div>
    );
}

function ReportDetailPane({
    report,
    capabilities,
    onBackToQueue,
}: {
    report: JobReportViewModel;
    capabilities: WorkspaceCapabilities;
    onBackToQueue?: () => void;
}) {
    const { auth } = usePage<{ auth?: { user?: { id: number } } }>().props;
    const isAuthor =
        auth?.user?.id !== undefined && auth.user.id === report.author?.id;
    const [copiedChecksumId, setCopiedChecksumId] = useState<number | null>(
        null,
    );
    const [reviewStatus, setReviewStatus] = useState<
        'approved' | 'rejected' | null
    >(null);
    const [showResubmitModal, setShowResubmitModal] = useState(false);

    const reviewForm = useForm({
        status: 'approved',
        reason: '',
    });

    const canReview =
        capabilities.review_job_report &&
        !isAuthor &&
        report.status.value === 'submitted';

    const handleReview = (status: 'approved' | 'rejected') => {
        if (status === 'rejected' && reviewForm.data.reason.trim() === '') {
            reviewForm.setError(
                'reason',
                'A reason is required when rejecting a report.',
            );

            return;
        }

        setReviewStatus(status);
        reviewForm.clearErrors();
        reviewForm.setData('status', status);
        router.post(
            `/operations/job-reports/${report.id}/review`,
            {
                status,
                reason: reviewForm.data.reason.trim() || undefined,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    reviewForm.reset();
                    setReviewStatus(null);
                },
                onError: (errors) => {
                    setReviewStatus(null);

                    if (errors.reason) {
                        reviewForm.setError('reason', errors.reason);
                    }
                },
                onFinish: () => setReviewStatus(null),
            },
        );
    };

    const copyChecksum = (attachment: AttachmentViewModel) => {
        navigator.clipboard?.writeText(attachment.checksum_sha256);
        setCopiedChecksumId(attachment.id);
        setTimeout(() => setCopiedChecksumId(null), 2000);
    };

    const elapsedTime = useMemo(() => {
        if (!report.started_at) {
            return 'Not recorded';
        }

        const start = new Date(report.started_at).getTime();

        if (Number.isNaN(start)) {
            return 'Not recorded';
        }

        if (!report.ended_at) {
            return 'In progress';
        }

        const minutes = reportDurationMinutes(report);

        return minutes === null
            ? 'Not recorded'
            : formatDurationMinutes(minutes);
    }, [report]);

    const reference =
        report.job?.reference ?? `Dispatch #${report.dispatch_job_id}`;

    if (showResubmitModal) {
        return (
            <ResubmitJobReportModal
                report={report}
                capabilities={capabilities}
                onDone={() => setShowResubmitModal(false)}
            />
        );
    }

    return (
        <Panel className="overflow-hidden p-0">
            {/* Header */}
            <div className="border-b border-line px-4 pt-4 pb-4 md:px-6">
                {onBackToQueue && (
                    <button
                        type="button"
                        onClick={onBackToQueue}
                        className="mb-2 -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-soft hover:bg-surface-subtle hover:text-ink lg:hidden"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Back to reports queue
                    </button>
                )}

                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <a
                                href={`/operations/dispatch-jobs/${report.dispatch_job_id}`}
                                className="group inline-flex items-center gap-1.5 text-xl font-bold text-ink hover:text-brand-strong"
                                title="View dispatch details"
                            >
                                <span>{reference}</span>
                                <ExternalLink className="h-4 w-4 text-ink-soft transition-colors group-hover:text-brand-strong" />
                            </a>
                            <CanonicalStatusBadge status={report.status} />
                            {report.resubmitted_count !== undefined &&
                                report.resubmitted_count > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                                        <RotateCcw className="h-3 w-3" />
                                        Amended {report.resubmitted_count}x
                                    </span>
                                )}
                        </div>
                        {report.job?.title && (
                            <p className="mt-0.5 text-sm font-medium text-ink-soft">
                                {report.job.title}
                            </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                            <span>
                                Filed by:{' '}
                                <strong className="font-semibold text-ink">
                                    {report.author?.name ?? 'Unknown Author'}
                                </strong>
                            </span>
                            <span aria-hidden="true">·</span>
                            {report.submitted_at ? (
                                <span>
                                    Submitted:{' '}
                                    {formatDateTime(report.submitted_at)}
                                </span>
                            ) : (
                                <span className="font-medium text-warning-strong">
                                    Unsubmitted Draft
                                </span>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">
                                Report #{report.id}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {report.can_be_resubmitted && isAuthor && (
                            <Button
                                type="button"
                                size="sm"
                                variant="primary"
                                onClick={() => setShowResubmitModal(true)}
                            >
                                <Edit3 className="h-3.5 w-3.5" />
                                {report.status.value === 'draft'
                                    ? 'Resume Draft'
                                    : 'Edit & Resubmit'}
                            </Button>
                        )}
                        <a
                            href={jobReportPdfUrl(report.id)}
                            download
                            className={buttonVariants({
                                size: 'sm',
                                variant: 'secondary',
                            })}
                            title="Download this report as a PDF file"
                        >
                            <FileText className="h-3.5 w-3.5" />
                            PDF
                        </a>
                        {capabilities.export_reports && (
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                    downloadJobReportsCsv(
                                        [report],
                                        jobReportsExportFilename(
                                            `report-${report.id}`,
                                            'csv',
                                        ),
                                    )
                                }
                            >
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                                CSV
                            </Button>
                        )}
                    </div>
                </div>

                <div className="mt-3">
                    <ReportProgress report={report} />
                </div>
            </div>

            <div className="space-y-6 px-4 py-5 md:px-6">
                {/* Review decision — first thing a manager needs */}
                {canReview && (
                    <section
                        aria-label="Manager review decision"
                        className="rounded-xl border border-warning/40 bg-warning-soft/20 p-4"
                    >
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-warning-strong" />
                            <h3 className="text-sm font-semibold text-ink">
                                Manager Review Decision
                            </h3>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Check the details below, then approve to close the
                            review cycle or return it with a reason.
                        </p>

                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={reviewForm.data.reason}
                                    onChange={(e) => {
                                        reviewForm.setData(
                                            'reason',
                                            e.target.value,
                                        );

                                        if (reviewForm.errors.reason) {
                                            reviewForm.clearErrors('reason');
                                        }
                                    }}
                                    aria-label="Review notes"
                                    placeholder="Review decision notes, quality checks, or rejection reason"
                                    className={cn(
                                        'h-11 w-full rounded-lg border bg-surface px-3 text-sm focus:outline-none',
                                        reviewForm.errors.reason
                                            ? 'border-danger focus:border-danger'
                                            : 'border-line-strong focus:border-brand-strong',
                                    )}
                                />
                                {reviewForm.errors.reason && (
                                    <p className="mt-1 text-xs font-medium text-danger-strong">
                                        {reviewForm.errors.reason}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="primary"
                                    onClick={() => handleReview('approved')}
                                    disabled={
                                        reviewForm.processing ||
                                        reviewStatus !== null
                                    }
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    {reviewStatus === 'approved'
                                        ? 'Approving…'
                                        : 'Approve Report'}
                                </Button>
                                <Button
                                    variant="secondary"
                                    className="border-danger/30 text-danger-strong hover:bg-danger-soft/50"
                                    onClick={() => handleReview('rejected')}
                                    disabled={
                                        reviewForm.processing ||
                                        reviewStatus !== null
                                    }
                                >
                                    <FileX className="h-4 w-4" />
                                    {reviewStatus === 'rejected'
                                        ? 'Rejecting…'
                                        : 'Reject Report'}
                                </Button>
                            </div>
                        </div>
                    </section>
                )}

                {report.rejection_reason &&
                    report.status.value === 'rejected' && (
                        <div className="rounded-xl border border-danger/30 bg-danger-soft/40 p-4 text-xs">
                            <div className="flex items-center gap-2 font-bold text-danger-strong">
                                <ShieldAlert className="h-4 w-4" />
                                <span>Reviewer Note / Return Reason:</span>
                            </div>
                            <p className="mt-1.5 text-sm font-medium whitespace-pre-line text-ink">
                                {report.rejection_reason}
                            </p>
                        </div>
                    )}

                {/* Key facts */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
                    <FactTile label="Started Work">
                        {report.started_at
                            ? formatDateTime(report.started_at)
                            : 'Not recorded'}
                    </FactTile>
                    <FactTile label="Ended Work">
                        {report.ended_at
                            ? formatDateTime(report.ended_at)
                            : 'Not recorded'}
                    </FactTile>
                    <FactTile
                        icon={<Clock className="h-3 w-3" />}
                        label="Elapsed Time:"
                    >
                        <span className="font-mono">{elapsedTime}</span>
                    </FactTile>
                    <FactTile
                        icon={<Gauge className="h-3 w-3" />}
                        label="Ending Meter"
                    >
                        <span className="font-mono">
                            {report.ending_meter_value !== null &&
                            report.ending_meter_value !== undefined
                                ? `${report.ending_meter_value.toLocaleString()} ${report.meter_type === 'engine_hours' ? 'hrs' : 'km'}`
                                : 'Not recorded'}
                        </span>
                    </FactTile>
                    <div className="col-span-2 min-w-0 rounded-lg border border-line bg-surface px-3 py-2.5 sm:col-span-2 xl:col-span-1">
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-soft">
                            <MapPin className="h-3 w-3" />
                            Geofence Stamp
                        </span>
                        <LocationLabel
                            latitude={report.latitude}
                            longitude={report.longitude}
                            place={report.place}
                            emptyLabel="Location not recorded"
                            showIcon={false}
                            className="mt-0.5 text-sm"
                        />
                    </div>
                </div>

                <section className="space-y-2">
                    <SectionHeading>Work Summary & Progress</SectionHeading>
                    <p className="text-sm leading-relaxed whitespace-pre-line text-ink">
                        {report.work_summary}
                    </p>
                </section>

                {report.remarks && (
                    <section className="space-y-2">
                        <SectionHeading>
                            Remarks & Site Observations
                        </SectionHeading>
                        <p className="rounded-lg border-l-2 border-line-strong bg-surface-subtle/60 px-3.5 py-2.5 text-sm whitespace-pre-line text-ink">
                            {report.remarks}
                        </p>
                    </section>
                )}

                <JobReportSignatureCard
                    signerName={report.signer_name}
                    signerRole={report.signer_role}
                    signedAt={report.signed_at}
                    latitude={report.latitude}
                    longitude={report.longitude}
                    place={report.place}
                />

                <JobReportDelayLogsTable delayLogs={report.delay_logs} />

                {/* Attachments */}
                <section className="space-y-3 border-t border-line pt-5">
                    <SectionHeading
                        aside={
                            <span className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
                                <ShieldCheck className="h-3 w-3 text-success-strong" />
                                SHA-256 Checksums Recorded
                            </span>
                        }
                    >
                        <Paperclip className="h-3.5 w-3.5 text-brand-strong" />
                        Private Attachments ({report.attachments.length})
                    </SectionHeading>

                    {report.attachments.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-soft">
                            No files or evidence documents attached to this
                            report.
                        </p>
                    ) : (
                        <ul className="grid gap-2.5 sm:grid-cols-2">
                            {report.attachments.map((file) => {
                                const isPdf =
                                    file.mime_type === 'application/pdf';
                                const isImage =
                                    file.mime_type.startsWith('image/');
                                const FileIcon = isPdf
                                    ? FileText
                                    : isImage
                                      ? FileImage
                                      : Paperclip;
                                const isCopied = copiedChecksumId === file.id;

                                return (
                                    <li
                                        key={file.id}
                                        className="flex min-w-0 items-center gap-3 rounded-lg border border-line bg-surface p-2.5"
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                                            <FileIcon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p
                                                className="truncate text-sm font-medium text-ink"
                                                title={file.original_filename}
                                            >
                                                {file.original_filename}
                                            </p>
                                            <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                                                <span>
                                                    {(
                                                        file.size_bytes / 1024
                                                    ).toFixed(1)}{' '}
                                                    KB
                                                </span>
                                                {file.checksum_sha256 && (
                                                    <>
                                                        <span aria-hidden="true">
                                                            ·
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                copyChecksum(
                                                                    file,
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-1 font-mono hover:text-brand-strong"
                                                            title={`Copy full SHA-256: ${file.checksum_sha256}`}
                                                        >
                                                            {isCopied ? (
                                                                <>
                                                                    <Check className="h-3 w-3 text-success-strong" />
                                                                    Copied
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {file.checksum_sha256.substring(
                                                                        0,
                                                                        10,
                                                                    )}
                                                                    …
                                                                    <Copy className="h-3 w-3" />
                                                                </>
                                                            )}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <a
                                            href={file.download_url}
                                            download
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink"
                                            aria-label={`Download ${file.original_filename}`}
                                        >
                                            <Download className="h-4 w-4" />
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                <JobReportCrossReferences
                    crossReferences={report.cross_references}
                />
            </div>
        </Panel>
    );
}
