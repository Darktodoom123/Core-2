import { router, useForm, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    Download,
    Edit3,
    ExternalLink,
    FileCheck,
    FileImage,
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
    Trash2,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { ExportsSurface } from '@/components/workspace/exports-workspace-section';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AttachmentViewModel,
    DispatchJobViewModel,
    JobReportViewModel,
    ReportExportViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

type ReportFilterStatus =
    'all' | 'draft' | 'submitted' | 'approved' | 'rejected';

export function ReportsSurface({
    reports = [],
    exports = [],
    jobs = [],
    capabilities,
}: {
    reports?: JobReportViewModel[];
    exports?: ReportExportViewModel[];
    jobs?: DispatchJobViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const initialJobIdFromUrl = useMemo(() => {
        if (typeof window === 'undefined') {
            return null;
        }

        const params = new URLSearchParams(window.location.search);

        return params.get('job_id') || params.get('dispatch_id') || null;
    }, []);

    const { errors: pageErrors = {} } = usePage<{
        errors?: Record<string, string>;
    }>().props;

    const [modalDismissed, setModalDismissed] = useState(false);
    const [userOpenedModal, setUserOpenedModal] = useState(
        () => initialJobIdFromUrl !== null,
    );

    const showSubmitModal =
        (userOpenedModal ||
            initialJobIdFromUrl !== null ||
            Object.keys(pageErrors).length > 0) &&
        !modalDismissed;

    const [prefilledJobId] = useState<string | number | null>(
        initialJobIdFromUrl,
    );
    const [statusFilter, setStatusFilter] = useState<ReportFilterStatus>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReportId, setSelectedReportId] = useState<number | null>(
        reports.length > 0 ? reports[0].id : null,
    );

    // Summary statistics
    const stats = useMemo(() => {
        const total = reports.length;
        const drafts = reports.filter((r) => r.status.value === 'draft').length;
        const submitted = reports.filter(
            (r) => r.status.value === 'submitted',
        ).length;
        const approved = reports.filter(
            (r) => r.status.value === 'approved',
        ).length;
        const rejected = reports.filter(
            (r) => r.status.value === 'rejected',
        ).length;
        const totalAttachments = reports.reduce(
            (acc, r) => acc + (r.attachments?.length ?? 0),
            0,
        );

        return {
            total,
            drafts,
            submitted,
            approved,
            rejected,
            totalAttachments,
        };
    }, [reports]);

    // Filtered reports
    const filteredReports = useMemo(() => {
        return reports.filter((report) => {
            if (
                statusFilter !== 'all' &&
                report.status.value !== statusFilter
            ) {
                return false;
            }

            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase().trim();
                const reference = report.job?.reference?.toLowerCase() ?? '';
                const title = report.job?.title?.toLowerCase() ?? '';
                const author = report.author?.name?.toLowerCase() ?? '';
                const summary = report.work_summary?.toLowerCase() ?? '';
                const remarks = report.remarks?.toLowerCase() ?? '';
                const jobId = String(report.dispatch_job_id);

                return (
                    reference.includes(query) ||
                    title.includes(query) ||
                    author.includes(query) ||
                    summary.includes(query) ||
                    remarks.includes(query) ||
                    jobId.includes(query)
                );
            }

            return true;
        });
    }, [reports, statusFilter, searchQuery]);

    const selectedReport = useMemo(() => {
        if (selectedReportId === null) {
            return filteredReports.length > 0 ? filteredReports[0] : null;
        }

        return (
            reports.find((r) => r.id === selectedReportId) ??
            (filteredReports.length > 0 ? filteredReports[0] : null)
        );
    }, [reports, filteredReports, selectedReportId]);

    return (
        <div className="workspace-width-contained">
            <PageHeading
                title="Job reports & attachments"
                description="Review field progress, submitted completion summaries, work logs, SHA-256 validated attachments, and operational records."
            />
            <div className="space-y-6 p-4 md:p-6">
                {/* Operational Summary Statistics Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-ink-soft">
                                Total Reports
                            </span>
                            <FileText className="h-4 w-4 text-brand-strong" />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-ink">
                            {stats.total}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Logged across fleet
                        </p>
                    </div>

                    <div className="rounded-xl border border-warning/30 bg-warning-soft/30 p-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-warning-strong">
                                Pending Review
                            </span>
                            <Clock className="h-4 w-4 text-warning-strong" />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-warning-strong">
                            {stats.submitted}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Requires manager review
                        </p>
                    </div>

                    <div className="rounded-xl border border-success/30 bg-success-soft/30 p-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-success-strong">
                                Approved
                            </span>
                            <FileCheck className="h-4 w-4 text-success-strong" />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-success-strong">
                            {stats.approved}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Verified & closed
                        </p>
                    </div>

                    <div className="rounded-xl border border-danger/30 bg-danger-soft/30 p-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-danger-strong">
                                Rejected
                            </span>
                            <FileX className="h-4 w-4 text-danger-strong" />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-danger-strong">
                            {stats.rejected}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Returned for rework
                        </p>
                    </div>

                    <div className="col-span-2 rounded-xl border border-line bg-surface p-3.5 shadow-sm sm:col-span-2 lg:col-span-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-ink-soft">
                                Attachments
                            </span>
                            <Paperclip className="h-4 w-4 text-brand-strong" />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-ink">
                            {stats.totalAttachments}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            SHA-256 secure files
                        </p>
                    </div>
                </div>

                {/* Submit Action Bar */}
                {capabilities.create_job_report && (
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-ink-soft">
                            Submit field completion reports and evidence
                            attachments for active or completed dispatches.
                        </p>
                        <Button
                            id="report-submit-toggle"
                            variant={showSubmitModal ? 'secondary' : 'primary'}
                            aria-expanded={showSubmitModal}
                            aria-controls="report-submit-form"
                            onClick={() => {
                                if (showSubmitModal) {
                                    setModalDismissed(true);
                                    setUserOpenedModal(false);
                                } else {
                                    setModalDismissed(false);
                                    setUserOpenedModal(true);
                                }
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {showSubmitModal
                                ? 'Close report form'
                                : 'Submit job report'}
                        </Button>
                    </div>
                )}

                {/* Submit Job Report Modal / Drawer Form */}
                {showSubmitModal && capabilities.create_job_report && (
                    <SubmitJobReportForm
                        jobs={jobs}
                        initialJobId={prefilledJobId ?? ''}
                        capabilities={capabilities}
                        onDone={() => {
                            setModalDismissed(true);
                            setUserOpenedModal(false);
                            window.setTimeout(() => {
                                document
                                    .getElementById('report-submit-toggle')
                                    ?.focus();
                            }, 0);
                        }}
                    />
                )}

                {/* Filter and Search Bar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 flex items-center text-xs font-medium text-ink-soft">
                            <Filter className="mr-1 h-3.5 w-3.5" />
                            Filter:
                        </span>
                        {(
                            [
                                { id: 'all', label: 'All', count: stats.total },
                                ...(stats.drafts > 0
                                    ? [
                                          {
                                              id: 'draft' as const,
                                              label: 'Drafts',
                                              count: stats.drafts,
                                          },
                                      ]
                                    : []),
                                {
                                    id: 'submitted',
                                    label: 'Pending Review',
                                    count: stats.submitted,
                                },
                                {
                                    id: 'approved',
                                    label: 'Approved',
                                    count: stats.approved,
                                },
                                {
                                    id: 'rejected',
                                    label: 'Rejected',
                                    count: stats.rejected,
                                },
                            ] as const
                        ).map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setStatusFilter(tab.id)}
                                className={cn(
                                    'inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                                    statusFilter === tab.id
                                        ? 'bg-brand-strong text-white shadow-sm'
                                        : 'bg-surface-subtle text-ink-soft hover:bg-surface-subtle/80 hover:text-ink',
                                )}
                            >
                                <span>{tab.label}</span>
                                <span
                                    className={cn(
                                        'py-0.2 rounded-full px-1.5 text-[10px] font-semibold',
                                        statusFilter === tab.id
                                            ? 'bg-white/20 text-white'
                                            : 'bg-surface text-ink-soft',
                                    )}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                        <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search reports or author…"
                            className="h-11 w-full rounded-lg border border-line bg-surface pr-14 pl-8 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-ink-soft hover:text-ink"
                                aria-label="Clear search"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {reports.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={FileText}
                            title="No job reports found"
                            message="Submitted job reports and attached documents will appear here once filed by field operators or dispatchers."
                        />
                    </Panel>
                ) : filteredReports.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Filter}
                            title="No matching reports"
                            message="No job reports match the active filter or search query. Try clearing your filters."
                        />
                    </Panel>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-12">
                        {/* Reports List Column */}
                        <div className="lg:col-span-5 xl:col-span-4">
                            <Panel className="overflow-hidden">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 font-semibold text-ink">
                                    <span>
                                        Reports ({filteredReports.length})
                                    </span>
                                    {statusFilter !== 'all' && (
                                        <span className="text-xs font-normal text-ink-soft capitalize">
                                            {statusFilter}
                                        </span>
                                    )}
                                </div>
                                <ul className="max-h-[640px] divide-y divide-line overflow-y-auto">
                                    {filteredReports.map((report) => {
                                        const isSelected =
                                            selectedReport?.id === report.id;

                                        return (
                                            <li key={report.id}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedReportId(
                                                            report.id,
                                                        )
                                                    }
                                                    className={cn(
                                                        'w-full px-4 py-3.5 text-left transition-colors hover:bg-surface-subtle',
                                                        isSelected &&
                                                            'border-l-4 border-brand-strong bg-brand-soft/60 pl-3',
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-semibold text-ink">
                                                            {report.job
                                                                ?.reference ??
                                                                `Job #${report.dispatch_job_id}`}
                                                        </span>
                                                        <CanonicalStatusBadge
                                                            status={
                                                                report.status
                                                            }
                                                        />
                                                    </div>
                                                    {report.job?.title && (
                                                        <p className="mt-0.5 truncate text-xs font-medium text-ink-soft">
                                                            {report.job.title}
                                                        </p>
                                                    )}
                                                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink">
                                                        {report.work_summary}
                                                    </p>
                                                    <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
                                                        <span>
                                                            By{' '}
                                                            <strong className="font-medium text-ink">
                                                                {report.author
                                                                    ?.name ??
                                                                    'Unknown'}
                                                            </strong>
                                                        </span>
                                                        <span className="inline-flex items-center gap-1">
                                                            <Paperclip className="h-3 w-3" />
                                                            {
                                                                report
                                                                    .attachments
                                                                    .length
                                                            }{' '}
                                                            files
                                                        </span>
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Panel>
                        </div>

                        {/* Report Details Column */}
                        <div className="lg:col-span-7 xl:col-span-8">
                            {selectedReport && (
                                <ReportDetailPane
                                    report={selectedReport}
                                    capabilities={capabilities}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Asynchronous Data Exports Surface */}
                <ExportsSurface exports={exports} capabilities={capabilities} />
            </div>
        </div>
    );
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
    const [gpsCapturing, setGpsCapturing] = useState(false);
    const { errors: pageErrors = {} } = usePage<{
        errors?: Record<string, string>;
    }>().props;

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

    const hasErrors =
        Object.keys(form.errors).length > 0 ||
        Object.keys(pageErrors).length > 0;

    const captureLocation = () => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
            setFileValidationError(
                'Geolocation is not supported by your browser.',
            );

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
                setFileValidationError(
                    `GPS location capture failed: ${err.message}`,
                );
                setGpsCapturing(false);
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFileValidationError(null);
        const incomingFiles = Array.from(e.target.files ?? []);

        if (incomingFiles.length + form.data.attachments.length > maxCount) {
            setFileValidationError(
                `You cannot attach more than ${maxCount} files per job report.`,
            );
        }

        for (const file of incomingFiles) {
            if (file.size > maxBytes) {
                setFileValidationError(
                    `File "${file.name}" exceeds the maximum allowed size of ${(maxBytes / 1024 / 1024).toFixed(0)} MiB.`,
                );
            }
        }

        form.setData('attachments', [
            ...form.data.attachments,
            ...incomingFiles,
        ]);
    };

    const removeAttachment = (idx: number) => {
        form.setData(
            'attachments',
            form.data.attachments.filter((_, i) => i !== idx),
        );
    };

    const submitAsFinal = (e: FormEvent) => {
        e.preventDefault();
        setFileValidationError(null);
        form.transform((data) => ({
            ...data,
            is_draft: false,
        }));

        form.post('/operations/job-reports', {
            preserveState: true,
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                form.reset();
                onDone();
            },
        });
    };

    const submitAsDraft = (e: FormEvent) => {
        e.preventDefault();
        setFileValidationError(null);
        form.transform((data) => ({
            ...data,
            is_draft: true,
        }));

        form.post('/operations/job-reports', {
            preserveState: true,
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                form.reset();
                onDone();
            },
        });
    };

    return (
        <Panel id="report-submit-form" className="p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                <div>
                    <h3 className="text-base font-semibold text-ink">
                        Submit Job Completion Report
                    </h3>
                    <p className="text-xs text-ink-soft">
                        Record field progress, telemetry readings, and attach
                        verified proof documents.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onDone}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-subtle hover:text-ink"
                    aria-label="Close form"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <form
                onSubmit={submitAsFinal}
                className="mt-4 space-y-4"
                noValidate
                aria-busy={form.processing}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label
                            htmlFor="report-dispatch-select"
                            className="block text-xs font-semibold text-ink uppercase"
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
                                className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
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
                                className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                                placeholder="e.g. 101"
                                required
                            />
                        )}
                        {form.errors.dispatch_job_id && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.dispatch_job_id}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Work Summary *
                        </label>
                        <input
                            type="text"
                            value={form.data.work_summary}
                            onChange={(e) =>
                                form.setData('work_summary', e.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                            placeholder="Brief description of work executed"
                            required
                        />
                        {form.errors.work_summary && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.work_summary}
                            </p>
                        )}
                    </div>
                </div>

                {/* Timing & Telemetry Readings */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Started At (Optional)
                        </label>
                        <input
                            type="datetime-local"
                            value={form.data.started_at}
                            onChange={(e) =>
                                form.setData('started_at', e.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Ended At (Optional)
                        </label>
                        <input
                            type="datetime-local"
                            value={form.data.ended_at}
                            onChange={(e) =>
                                form.setData('ended_at', e.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Ending Meter Value
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={form.data.ending_meter_value}
                            onChange={(e) =>
                                form.setData(
                                    'ending_meter_value',
                                    e.target.value,
                                )
                            }
                            placeholder="e.g. 50120.5"
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Meter Type
                        </label>
                        <select
                            value={form.data.meter_type}
                            onChange={(e) =>
                                form.setData('meter_type', e.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                        >
                            <option value="odometer_km">Odometer (km)</option>
                            <option value="engine_hours">
                                Engine Hours (hrs)
                            </option>
                            <option value="none">None / Not Applicable</option>
                        </select>
                    </div>
                </div>

                {/* Geolocation Stamp */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-subtle p-3">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-brand-strong" />
                        <div>
                            <span className="text-xs font-semibold text-ink">
                                Geofence Stamp:
                            </span>{' '}
                            <span className="text-xs text-ink-soft">
                                {form.data.latitude && form.data.longitude
                                    ? `Lat: ${form.data.latitude}, Lon: ${form.data.longitude}`
                                    : 'No coordinates stamped'}
                            </span>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        className="text-xs"
                        onClick={captureLocation}
                        disabled={gpsCapturing}
                    >
                        {gpsCapturing ? 'Locating…' : 'Stamp Current GPS'}
                    </Button>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-ink uppercase">
                        Remarks / Operational Notes
                    </label>
                    <textarea
                        value={form.data.remarks}
                        onChange={(e) =>
                            form.setData('remarks', e.target.value)
                        }
                        className="mt-1 h-20 w-full rounded-lg border border-line-strong bg-surface p-3 text-sm focus:border-brand focus:outline-none"
                        placeholder="Additional operational observations, delays, equipment condition, or site notes"
                    />
                </div>

                {capabilities.attachment_upload && (
                    <div className="rounded-lg border border-line bg-surface-subtle p-3.5">
                        <label
                            htmlFor="report-attachments"
                            className="block text-xs font-semibold text-ink uppercase"
                        >
                            Validated Proof Attachments (Max {maxCount} files,{' '}
                            {Math.round(maxBytes / 1024 / 1024)} MiB each)
                        </label>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Accepted formats: JPEG, PNG, HEIC/HEIF, PDF. Files
                            are stored privately with SHA-256 integrity
                            validation.
                        </p>

                        <input
                            id="report-attachments"
                            type="file"
                            multiple
                            accept={acceptedMimeTypes.join(',')}
                            onChange={handleFileChange}
                            className="mt-2 block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs text-ink file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:font-semibold file:text-ink"
                        />

                        {fileValidationError && (
                            <div
                                className="mt-2 flex items-center gap-1.5 text-xs text-danger"
                                role="alert"
                            >
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>{fileValidationError}</span>
                            </div>
                        )}

                        {form.data.attachments.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                                <span className="text-xs font-medium text-ink">
                                    Staged Files ({form.data.attachments.length}
                                    /{maxCount}):
                                </span>
                                <ul
                                    className="space-y-1 text-xs"
                                    aria-label="Selected attachments"
                                >
                                    {form.data.attachments.map((file, idx) => (
                                        <li
                                            key={`${file.name}-${idx}`}
                                            className="flex items-center justify-between rounded border border-line bg-surface px-3 py-1.5"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <FileText className="h-3.5 w-3.5 text-brand-strong" />
                                                <span className="truncate font-medium text-ink">
                                                    {file.name}
                                                </span>
                                                <span className="text-[11px] text-ink-soft">
                                                    (
                                                    {(
                                                        file.size /
                                                        1024 /
                                                        1024
                                                    ).toFixed(2)}{' '}
                                                    MB)
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeAttachment(idx)
                                                }
                                                className="ml-2 text-danger hover:text-danger-strong"
                                                aria-label={`Remove ${file.name}`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {form.errors.attachments && (
                            <p
                                className="mt-1 text-xs text-danger"
                                role="alert"
                            >
                                {form.errors.attachments}
                            </p>
                        )}
                    </div>
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

                {hasErrors && (
                    <div
                        className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger"
                        role="alert"
                    >
                        <p className="font-semibold">
                            Unable to submit job report. Please check the
                            highlighted fields and try again.
                        </p>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                    <Button type="button" variant="secondary" onClick={onDone}>
                        Cancel
                    </Button>
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={submitAsDraft}
                            disabled={form.processing}
                        >
                            <Save className="mr-1.5 h-4 w-4" />
                            Save as Draft
                        </Button>
                        <Button
                            id="submit-job-report-btn"
                            data-testid="submit-job-report-btn"
                            type="submit"
                            variant="primary"
                            disabled={form.processing}
                        >
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

    const [fileValidationError, setFileValidationError] = useState<
        string | null
    >(null);

    const form = useForm({
        work_summary: report.work_summary || '',
        remarks: report.remarks || '',
        started_at: report.started_at ? report.started_at.substring(0, 16) : '',
        ended_at: report.ended_at ? report.ended_at.substring(0, 16) : '',
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFileValidationError(null);
        const incomingFiles = Array.from(e.target.files ?? []);

        if (incomingFiles.length + form.data.attachments.length > maxCount) {
            setFileValidationError(
                `You cannot attach more than ${maxCount} files per report.`,
            );

            return;
        }

        for (const file of incomingFiles) {
            if (file.size > maxBytes) {
                setFileValidationError(
                    `File "${file.name}" exceeds ${Math.round(maxBytes / 1024 / 1024)} MiB.`,
                );

                return;
            }
        }

        form.setData('attachments', [
            ...form.data.attachments,
            ...incomingFiles,
        ]);
    };

    const removeAttachment = (idx: number) => {
        form.setData(
            'attachments',
            form.data.attachments.filter((_, i) => i !== idx),
        );
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

    return (
        <Panel className="p-4 md:p-6">
            <div className="flex items-start justify-between border-b border-line pb-3">
                <div>
                    <h3 className="text-base font-semibold text-ink">
                        Edit & Resubmit Job Report #{report.id}
                    </h3>
                    <p className="text-xs text-ink-soft">
                        Amend report details per reviewer feedback and resubmit
                        for verification.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onDone}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-subtle hover:text-ink"
                    aria-label="Close modal"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {report.rejection_reason && (
                <div className="mt-4 rounded-lg border border-danger/30 bg-danger-soft/40 p-3.5 text-xs text-danger-strong">
                    <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle className="h-4 w-4" />
                        <span>Manager Feedback / Reason for Return:</span>
                    </div>
                    <p className="mt-1 text-sm text-ink">
                        {report.rejection_reason}
                    </p>
                </div>
            )}

            <form
                onSubmit={submit}
                className="mt-4 space-y-4"
                noValidate
                aria-busy={form.processing}
            >
                <div>
                    <label className="block text-xs font-semibold text-ink uppercase">
                        Work Summary *
                    </label>
                    <textarea
                        value={form.data.work_summary}
                        onChange={(e) =>
                            form.setData('work_summary', e.target.value)
                        }
                        className="mt-1 h-28 w-full rounded-lg border border-line-strong bg-surface p-3 text-sm focus:border-brand focus:outline-none"
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
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Started At
                        </label>
                        <input
                            type="datetime-local"
                            value={form.data.started_at}
                            onChange={(e) =>
                                form.setData('started_at', e.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Ended At
                        </label>
                        <input
                            type="datetime-local"
                            value={form.data.ended_at}
                            onChange={(e) =>
                                form.setData('ended_at', e.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Ending Meter Reading
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={form.data.ending_meter_value}
                            onChange={(e) =>
                                form.setData(
                                    'ending_meter_value',
                                    e.target.value,
                                )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Meter Type
                        </label>
                        <select
                            value={form.data.meter_type}
                            onChange={(e) =>
                                form.setData('meter_type', e.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                        >
                            <option value="odometer_km">Odometer (km)</option>
                            <option value="engine_hours">
                                Engine Hours (hrs)
                            </option>
                            <option value="none">None</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-ink uppercase">
                        Remarks & Action Taken
                    </label>
                    <textarea
                        value={form.data.remarks}
                        onChange={(e) =>
                            form.setData('remarks', e.target.value)
                        }
                        placeholder="Explain adjustments made to address reviewer notes"
                        className="mt-1 h-20 w-full rounded-lg border border-line-strong bg-surface p-3 text-sm focus:border-brand focus:outline-none"
                    />
                </div>

                {capabilities.attachment_upload && (
                    <div className="rounded-lg border border-line bg-surface-subtle p-3.5">
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Add Additional Proof Attachments
                        </label>
                        <input
                            type="file"
                            multiple
                            accept={acceptedMimeTypes.join(',')}
                            onChange={handleFileChange}
                            className="mt-2 block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs text-ink file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:font-semibold file:text-ink"
                        />

                        {fileValidationError && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-danger">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>{fileValidationError}</span>
                            </div>
                        )}

                        {form.data.attachments.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                                <span className="text-xs font-medium text-ink">
                                    Newly Attached Files (
                                    {form.data.attachments.length}):
                                </span>
                                <ul className="space-y-1 text-xs">
                                    {form.data.attachments.map((file, idx) => (
                                        <li
                                            key={`${file.name}-${idx}`}
                                            className="flex items-center justify-between rounded border border-line bg-surface px-3 py-1.5"
                                        >
                                            <span className="truncate font-medium text-ink">
                                                {file.name}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeAttachment(idx)
                                                }
                                                className="ml-2 text-danger hover:text-danger-strong"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-3 border-t border-line pt-4">
                    <Button type="button" variant="secondary" onClick={onDone}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={
                            form.processing || !form.data.work_summary.trim()
                        }
                    >
                        <RotateCcw className="mr-1.5 h-4 w-4" />
                        {form.processing ? 'Resubmitting…' : 'Resubmit Report'}
                    </Button>
                </div>
            </form>
        </Panel>
    );
}

function ReportDetailPane({
    report,
    capabilities,
}: {
    report: JobReportViewModel;
    capabilities: WorkspaceCapabilities;
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

    const handleReview = (status: 'approved' | 'rejected') => {
        setReviewStatus(status);
        reviewForm.setData('status', status);
        router.post(
            `/operations/job-reports/${report.id}/review`,
            {
                status,
                reason: reviewForm.data.reason.trim() || undefined,
            },
            {
                preserveScroll: true,
                onFinish: () => setReviewStatus(null),
            },
        );
    };

    const copyChecksum = (attachment: AttachmentViewModel) => {
        navigator.clipboard?.writeText(attachment.checksum_sha256);
        setCopiedChecksumId(attachment.id);
        setTimeout(() => setCopiedChecksumId(null), 2000);
    };

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
        <Panel className="space-y-6 p-4 md:p-6">
            {/* Header / Meta */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <a
                            href={`/operations/dispatch-jobs/${report.dispatch_job_id}`}
                            className="group inline-flex items-center gap-1.5 text-xl font-bold text-ink hover:text-brand-strong hover:underline"
                            title="View dispatch details"
                        >
                            <span>
                                {report.job?.reference ??
                                    `Dispatch #${report.dispatch_job_id}`}
                            </span>
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
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                        <span>
                            Filed by:{' '}
                            <strong className="font-semibold text-ink">
                                {report.author?.name ?? 'Unknown Author'}
                            </strong>
                        </span>
                        {report.submitted_at ? (
                            <>
                                <span>•</span>
                                <span>
                                    Submitted:{' '}
                                    {formatDateTime(report.submitted_at)}
                                </span>
                            </>
                        ) : (
                            <>
                                <span>•</span>
                                <span className="font-medium text-warning-strong">
                                    Unsubmitted Draft
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-ink-soft">
                    {report.can_be_resubmitted && isAuthor && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setShowResubmitModal(true)}
                            className="border-brand/40 text-xs text-brand-strong hover:bg-brand-soft"
                        >
                            <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                            {report.status.value === 'draft'
                                ? 'Resume Draft'
                                : 'Edit & Resubmit'}
                        </Button>
                    )}
                    <span className="rounded bg-surface-subtle px-2 py-1 font-mono">
                        Report #{report.id}
                    </span>
                </div>
            </div>

            {/* Rejection Alert Banner if report was returned */}
            {report.rejection_reason && report.status.value === 'rejected' && (
                <div className="rounded-lg border border-danger/30 bg-danger-soft/40 p-4 text-xs">
                    <div className="flex items-center gap-2 font-bold text-danger-strong">
                        <ShieldAlert className="h-4 w-4" />
                        <span>Reviewer Note / Return Reason:</span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-ink">
                        {report.rejection_reason}
                    </p>
                </div>
            )}

            {/* Execution Timing & Telemetry Readings */}
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-subtle p-3 text-xs sm:grid-cols-4">
                <div>
                    <span className="font-semibold text-ink">
                        Started Work:
                    </span>{' '}
                    <span className="block text-ink-soft">
                        {report.started_at
                            ? formatDateTime(report.started_at)
                            : 'Not recorded'}
                    </span>
                </div>
                <div>
                    <span className="font-semibold text-ink">Ended Work:</span>{' '}
                    <span className="block text-ink-soft">
                        {report.ended_at
                            ? formatDateTime(report.ended_at)
                            : 'Not recorded'}
                    </span>
                </div>
                <div>
                    <span className="flex items-center gap-1 font-semibold text-ink">
                        <Gauge className="h-3.5 w-3.5 text-brand-strong" />
                        Ending Meter:
                    </span>
                    <span className="block font-mono text-ink-soft">
                        {report.ending_meter_value !== null &&
                        report.ending_meter_value !== undefined
                            ? `${report.ending_meter_value.toLocaleString()} ${report.meter_type === 'engine_hours' ? 'hrs' : 'km'}`
                            : 'Not recorded'}
                    </span>
                </div>
                <div>
                    <span className="flex items-center gap-1 font-semibold text-ink">
                        <MapPin className="h-3.5 w-3.5 text-brand-strong" />
                        Geofence Stamp:
                    </span>
                    <span className="block font-mono text-ink-soft">
                        {report.latitude !== null &&
                        report.latitude !== undefined &&
                        report.longitude !== null &&
                        report.longitude !== undefined
                            ? `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`
                            : 'Not stamped'}
                    </span>
                </div>
            </div>

            {/* Work Summary */}
            <div>
                <h2 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                    Work Summary & Progress
                </h2>
                <div className="mt-2 rounded-lg border border-line bg-surface p-3.5 text-sm leading-relaxed text-ink">
                    {report.work_summary}
                </div>
            </div>

            {/* Remarks */}
            {report.remarks && (
                <div>
                    <h2 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                        Remarks & Site Observations
                    </h2>
                    <div className="mt-2 rounded-lg bg-surface-subtle p-3.5 text-sm text-ink">
                        {report.remarks}
                    </div>
                </div>
            )}

            {/* Verified Attachments Section */}
            <div className="border-t border-line pt-4">
                <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-ink-soft uppercase">
                        <Paperclip className="h-3.5 w-3.5 text-brand-strong" />
                        Private Attachments ({report.attachments.length})
                    </h3>
                    <span className="text-[11px] text-ink-soft">
                        SHA-256 Checksums Validated
                    </span>
                </div>

                {report.attachments.length === 0 ? (
                    <p className="mt-2 text-xs text-ink-soft italic">
                        No files or evidence documents attached to this report.
                    </p>
                ) : (
                    <ul className="mt-3 space-y-2.5">
                        {report.attachments.map((file) => {
                            const isPdf = file.mime_type === 'application/pdf';
                            const isImage = file.mime_type.startsWith('image/');
                            const FileIcon = isPdf
                                ? FileText
                                : isImage
                                  ? FileImage
                                  : Paperclip;
                            const isCopied = copiedChecksumId === file.id;

                            return (
                                <li
                                    key={file.id}
                                    className="flex flex-col justify-between gap-3 rounded-lg border border-line bg-surface p-3 sm:flex-row sm:items-center"
                                >
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                                            <FileIcon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-ink">
                                                {file.original_filename}
                                            </p>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                                                <span>
                                                    {(
                                                        file.size_bytes / 1024
                                                    ).toFixed(1)}{' '}
                                                    KB
                                                </span>
                                                <span>•</span>
                                                <span className="font-mono text-[11px]">
                                                    {file.mime_type}
                                                </span>
                                            </div>
                                            {file.checksum_sha256 && (
                                                <div className="mt-1.5 flex items-center gap-1.5">
                                                    <span
                                                        className="inline-flex items-center gap-1 rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-soft"
                                                        title={`Full SHA-256: ${file.checksum_sha256}`}
                                                    >
                                                        <ShieldCheck className="h-3 w-3 text-success-strong" />
                                                        SHA-256:{' '}
                                                        {file.checksum_sha256.substring(
                                                            0,
                                                            12,
                                                        )}
                                                        …
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            copyChecksum(file)
                                                        }
                                                        className="flex h-11 w-11 shrink-0 items-center justify-center text-[10px] text-ink-soft hover:text-brand-strong"
                                                        title="Copy full SHA-256 hash"
                                                    >
                                                        {isCopied ? (
                                                            <span className="flex items-center gap-0.5 text-success-strong">
                                                                <Check className="h-3 w-3" />{' '}
                                                                Copied
                                                            </span>
                                                        ) : (
                                                            <Copy className="h-3 w-3" />
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 sm:self-center">
                                        <a
                                            href={file.download_url}
                                            download
                                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-subtle"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                            Download
                                        </a>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Review Controls (Manager Authorization) */}
            {capabilities.review_job_report &&
                !isAuthor &&
                report.status.value === 'submitted' && (
                    <div className="border-t border-line pt-4">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-warning-strong" />
                            <h3 className="text-xs font-semibold tracking-wider text-ink uppercase">
                                Manager Review Decision
                            </h3>
                        </div>
                        <p className="mt-1 text-xs text-ink-soft">
                            Record an authoritative decision on this report.
                            Approved reports complete the operational validation
                            cycle.
                        </p>

                        <div className="mt-3 space-y-3">
                            <input
                                type="text"
                                value={reviewForm.data.reason}
                                onChange={(e) =>
                                    reviewForm.setData('reason', e.target.value)
                                }
                                placeholder="Optional decision notes, quality checks, or rejection reason"
                                className="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                            />
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    variant="primary"
                                    onClick={() => handleReview('approved')}
                                    disabled={reviewForm.processing}
                                >
                                    <CheckCircle2 className="mr-1.5 h-4 w-4 text-success-strong" />
                                    {reviewStatus === 'approved'
                                        ? 'Approving…'
                                        : 'Approve Report'}
                                </Button>
                                <Button
                                    variant="secondary"
                                    className="border-danger/30 text-danger-strong hover:bg-danger-soft/50"
                                    onClick={() => handleReview('rejected')}
                                    disabled={reviewForm.processing}
                                >
                                    <FileX className="mr-1.5 h-4 w-4 text-danger-strong" />
                                    {reviewStatus === 'rejected'
                                        ? 'Rejecting…'
                                        : 'Reject Report'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
        </Panel>
    );
}
