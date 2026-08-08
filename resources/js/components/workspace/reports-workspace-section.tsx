import { router, useForm } from '@inertiajs/react';
import { Download, FileText, Plus, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { ExportsSurface } from '@/components/workspace/exports-workspace-section';
import type {
    JobReportViewModel,
    ReportExportViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

export function ReportsSurface({
    reports = [],
    exports = [],
    capabilities,
}: {
    reports?: JobReportViewModel[];
    exports?: ReportExportViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [selectedReport, setSelectedReport] =
        useState<JobReportViewModel | null>(
            reports.length > 0 ? reports[0] : null,
        );

    return (
        <div>
            <PageHeading
                title="Job reports & attachments"
                description="Review field progress, submitted completion summaries, work logs, and secure attachments."
            />
            <div className="space-y-6 p-4 md:p-6">
                {capabilities.create_job_report && (
                    <div className="flex justify-end">
                        <Button
                            id="report-submit-toggle"
                            variant={showSubmitModal ? 'secondary' : 'primary'}
                            aria-expanded={showSubmitModal}
                            aria-controls="report-submit-form"
                            onClick={() => setShowSubmitModal(!showSubmitModal)}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {showSubmitModal
                                ? 'Close report form'
                                : 'Submit job report'}
                        </Button>
                    </div>
                )}

                {showSubmitModal && capabilities.create_job_report && (
                    <SubmitJobReportForm
                        capabilities={capabilities}
                        onDone={() => {
                            setShowSubmitModal(false);
                            window.setTimeout(() => {
                                document
                                    .getElementById('report-submit-toggle')
                                    ?.focus();
                            }, 0);
                        }}
                    />
                )}

                {reports.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={FileText}
                            title="No job reports found"
                            message="Submitted job reports and attached documents will appear here once filed by field technicians or dispatchers."
                        />
                    </Panel>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-12">
                        <div className="lg:col-span-5 xl:col-span-4">
                            <Panel className="overflow-hidden">
                                <div className="border-b border-line px-4 py-3 font-semibold text-ink">
                                    Reports ({reports.length})
                                </div>
                                <ul className="divide-y divide-line">
                                    {reports.map((report) => {
                                        const isSelected =
                                            selectedReport?.id === report.id;

                                        return (
                                            <li key={report.id}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedReport(
                                                            report,
                                                        )
                                                    }
                                                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-surface-subtle ${
                                                        isSelected
                                                            ? 'bg-brand-soft/60'
                                                            : ''
                                                    }`}
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
                                                    <p className="mt-1 line-clamp-1 text-sm text-ink-soft">
                                                        {report.work_summary}
                                                    </p>
                                                    <div className="mt-1.5 flex items-center justify-between text-xs text-ink-soft">
                                                        <span>
                                                            By{' '}
                                                            {report.author
                                                                ?.name ??
                                                                'Unknown'}
                                                        </span>
                                                        <span>
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

                <ExportsSurface exports={exports} capabilities={capabilities} />
            </div>
        </div>
    );
}

function SubmitJobReportForm({
    capabilities,
    onDone,
}: {
    capabilities: WorkspaceCapabilities;
    onDone: () => void;
}) {
    const form = useForm({
        dispatch_job_id: '',
        work_summary: '',
        remarks: '',
        started_at: '',
        ended_at: '',
        attachments: [] as File[],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/operations/job-reports', {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                form.reset();
                onDone();
            },
        });
    };

    const retry = () => {
        form.post('/operations/job-reports', {
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
            <h3 className="text-base font-semibold text-ink">
                Submit Job Report
            </h3>
            <form
                onSubmit={submit}
                className="mt-4 space-y-4"
                noValidate
                aria-busy={form.processing}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className="block text-sm font-medium text-ink">
                            Dispatch job ID *
                        </label>
                        <input
                            type="number"
                            value={form.data.dispatch_job_id}
                            onChange={(e) =>
                                form.setData('dispatch_job_id', e.target.value)
                            }
                            className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
                            placeholder="e.g. 101"
                            required
                        />
                        {form.errors.dispatch_job_id && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.dispatch_job_id}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-ink">
                            Work summary *
                        </label>
                        <input
                            type="text"
                            value={form.data.work_summary}
                            onChange={(e) =>
                                form.setData('work_summary', e.target.value)
                            }
                            className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
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

                <div>
                    <label className="block text-sm font-medium text-ink">
                        Remarks / Details
                    </label>
                    <textarea
                        value={form.data.remarks}
                        onChange={(e) =>
                            form.setData('remarks', e.target.value)
                        }
                        className="mt-1 h-24 w-full rounded-lg border border-line-strong bg-surface p-3 text-sm"
                        placeholder="Additional operational observations or notes"
                    />
                </div>

                {capabilities.attachment_upload && (
                    <div>
                        <label
                            htmlFor="report-attachments"
                            className="block text-sm font-medium text-ink"
                        >
                            Evidence attachments
                        </label>
                        <input
                            id="report-attachments"
                            type="file"
                            multiple
                            accept={capabilities.attachment_policy.accepted_mime_types.join(
                                ',',
                            )}
                            onChange={(event) =>
                                form.setData(
                                    'attachments',
                                    Array.from(event.target.files ?? []),
                                )
                            }
                            className="mt-1 block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:font-semibold file:text-ink"
                        />
                        <p className="mt-1 text-xs text-ink-soft">
                            Up to {capabilities.attachment_policy.max_count}{' '}
                            files,{' '}
                            {Math.round(
                                capabilities.attachment_policy.max_bytes /
                                    1024 /
                                    1024,
                            )}{' '}
                            MiB each. Files stay private and are checked by
                            content.
                        </p>
                        <p className="mt-1 text-xs text-ink-soft">
                            Files are linked to this report by the server after
                            submission.
                        </p>
                        {form.data.attachments.length > 0 && (
                            <ul
                                className="mt-2 space-y-1 text-xs text-ink-soft"
                                aria-label="Selected attachments"
                            >
                                {form.data.attachments.map((file) => (
                                    <li
                                        key={`${file.name}-${file.lastModified}`}
                                    >
                                        {file.name}
                                    </li>
                                ))}
                            </ul>
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

                {Object.keys(form.errors).length > 0 && (
                    <div
                        className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
                        role="alert"
                    >
                        <p>
                            We could not submit the report. Check the
                            highlighted fields and try again.
                        </p>
                        <button
                            type="button"
                            className="mt-2 font-semibold underline"
                            onClick={retry}
                        >
                            Retry submission
                        </button>
                    </div>
                )}

                <div className="flex justify-end gap-3 border-t border-line pt-4">
                    <Button type="button" variant="secondary" onClick={onDone}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={form.processing}
                    >
                        {form.processing ? 'Submitting…' : 'Submit report'}
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
    const reviewForm = useForm({
        status: 'approved',
        reason: '',
    });

    const handleReview = (status: 'approved' | 'rejected') => {
        reviewForm.setData('status', status);
        router.post(
            `/operations/job-reports/${report.id}/review`,
            {
                status,
                reason: reviewForm.data.reason || undefined,
            },
            {
                preserveScroll: true,
            },
        );
    };

    return (
        <Panel className="space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-ink">
                            {report.job?.reference ?? `Report #${report.id}`}
                        </h2>
                        <CanonicalStatusBadge status={report.status} />
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                        Submitted by{' '}
                        <span className="font-medium text-ink">
                            {report.author?.name ?? 'Unknown'}
                        </span>{' '}
                        {report.submitted_at
                            ? `on ${new Date(report.submitted_at).toLocaleString()}`
                            : ''}
                    </p>
                </div>
            </div>

            <div>
                <h3 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                    Work Summary
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink">
                    {report.work_summary}
                </p>
                {report.remarks && (
                    <div className="mt-4 rounded-lg bg-surface-subtle p-3 text-sm text-ink-soft">
                        <span className="font-semibold text-ink">Remarks:</span>{' '}
                        {report.remarks}
                    </div>
                )}
            </div>

            {report.attachments.length > 0 && (
                <div className="border-t border-line pt-4">
                    <h3 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                        Attachments ({report.attachments.length})
                    </h3>
                    <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
                        {report.attachments.map((file) => (
                            <li
                                key={file.id}
                                className="flex items-center justify-between p-3"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <FileText className="h-5 w-5 shrink-0 text-brand-strong" />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-ink">
                                            {file.original_filename}
                                        </p>
                                        <p className="text-xs text-ink-soft">
                                            {(file.size_bytes / 1024).toFixed(
                                                1,
                                            )}{' '}
                                            KB · {file.mime_type}
                                        </p>
                                    </div>
                                </div>
                                <a
                                    href={file.download_url}
                                    download
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-subtle"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {capabilities.review_job_report &&
                report.status.value === 'submitted' && (
                    <div className="border-t border-line pt-4">
                        <h3 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                            Review Action
                        </h3>
                        <div className="mt-3 space-y-3">
                            <input
                                type="text"
                                value={reviewForm.data.reason}
                                onChange={(e) =>
                                    reviewForm.setData('reason', e.target.value)
                                }
                                placeholder="Optional review notes or decision reason"
                                className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
                            />
                            <div className="flex gap-3">
                                <Button
                                    variant="primary"
                                    onClick={() => handleReview('approved')}
                                    disabled={reviewForm.processing}
                                >
                                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                                    Approve report
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => handleReview('rejected')}
                                    disabled={reviewForm.processing}
                                >
                                    Reject report
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
        </Panel>
    );
}
