import { router, useForm } from '@inertiajs/react';
import {
    Clock,
    Download,
    DownloadCloud,
    FileSpreadsheet,
    FileText,
    Loader2,
    RefreshCw,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    ReportExportViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

export function ExportsSurface({
    exports = [],
    capabilities,
}: {
    exports?: ReportExportViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const [showExportModal, setShowExportModal] = useState(false);
    const [retryingId, setRetryingId] = useState<string | null>(null);

    const stats = useMemo(() => {
        const total = exports.length;
        const completed = exports.filter(
            (e) => e.status.value === 'completed' && !e.is_expired,
        ).length;
        const processing = exports.filter((e) =>
            ['queued', 'processing'].includes(e.status.value),
        ).length;
        const failed = exports.filter(
            (e) => e.status.value === 'failed' || e.is_expired,
        ).length;

        return { total, completed, processing, failed };
    }, [exports]);

    // Auto-refresh when exports are queued or processing
    useEffect(() => {
        if (stats.processing === 0) {
            return;
        }

        const interval = window.setInterval(() => {
            router.reload({ only: ['reportExports'] });
        }, 4000);

        return () => window.clearInterval(interval);
    }, [stats.processing]);

    if (!capabilities.export_reports) {
        return null;
    }

    const handleRetry = (exp: ReportExportViewModel) => {
        setRetryingId(exp.id);
        router.post(
            exp.retry_url,
            {},
            {
                preserveScroll: true,
                onFinish: () => setRetryingId(null),
            },
        );
    };

    return (
        <div className="workspace-width-contained mt-8 space-y-6">
            {/* Heading & Trigger */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-ink">
                        Asynchronous Data Exports
                    </h3>
                    <p className="text-sm text-ink-soft">
                        Generate and download background CSV and PDF exports
                        across dispatches, assets, fuel logs, maintenance, and
                        audit trails.
                    </p>
                </div>
                <Button
                    variant={showExportModal ? 'secondary' : 'primary'}
                    onClick={() => setShowExportModal(!showExportModal)}
                >
                    <DownloadCloud className="mr-2 h-4 w-4" />
                    {showExportModal
                        ? 'Close export form'
                        : 'Request data export'}
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
                    <span className="text-xs font-medium text-ink-soft">
                        Total Export Requests
                    </span>
                    <p className="mt-1 text-xl font-bold text-ink">
                        {stats.total}
                    </p>
                </div>
                <div className="rounded-xl border border-success/30 bg-success-soft/30 p-3 shadow-xs">
                    <span className="text-xs font-medium text-success-strong">
                        Ready for Download
                    </span>
                    <p className="mt-1 text-xl font-bold text-success-strong">
                        {stats.completed}
                    </p>
                </div>
                <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
                    <span className="text-xs font-medium text-ink-soft">
                        In-Flight Processing
                    </span>
                    <p className="mt-1 text-xl font-bold text-ink">
                        {stats.processing}
                    </p>
                </div>
                <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
                    <span className="text-xs font-medium text-ink-soft">
                        Failed / Expired
                    </span>
                    <p className="mt-1 text-xl font-bold text-ink-soft">
                        {stats.failed}
                    </p>
                </div>
            </div>

            {/* Export Request Modal */}
            {showExportModal && (
                <RequestExportForm onDone={() => setShowExportModal(false)} />
            )}

            {/* Exports Table */}
            {exports.length === 0 ? (
                <Panel>
                    <EmptyState
                        icon={FileSpreadsheet}
                        title="No export history found"
                        message="Requested background CSV and PDF data exports will appear here with live progress, file sizes, and 24-hour secure download links."
                    />
                </Panel>
            ) : (
                <Panel className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 font-semibold text-ink">
                        <span>Export Tasks & Downloads ({exports.length})</span>
                        {stats.processing > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-brand-strong">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                {stats.processing} processing…
                            </span>
                        )}
                    </div>
                    <div
                        className="workspace-scroll-region"
                        role="region"
                        aria-label="Export tasks table scroll region"
                        tabIndex={0}
                    >
                        <table className="w-full text-left text-sm">
                            <thead className="bg-surface-subtle text-xs tracking-wider text-ink-soft uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        Dataset Type
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Format
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Rows
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        File Size
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Expiry (24h Window)
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Requested At
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {exports.map((exp) => {
                                    const isProcessing = [
                                        'queued',
                                        'processing',
                                    ].includes(exp.status.value);
                                    const isRetrying = retryingId === exp.id;

                                    return (
                                        <tr
                                            key={exp.id}
                                            className="hover:bg-surface-subtle/50"
                                        >
                                            <td className="px-4 py-3 font-medium text-ink">
                                                <div className="flex items-center gap-2">
                                                    {exp.format === 'PDF' ? (
                                                        <FileText className="h-4 w-4 text-brand-strong" />
                                                    ) : (
                                                        <FileSpreadsheet className="h-4 w-4 text-success-strong" />
                                                    )}
                                                    <span>
                                                        {exp.export_type.label}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center rounded-md bg-surface-subtle px-2 py-0.5 font-mono text-xs font-semibold text-ink">
                                                    {exp.format}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    {isProcessing && (
                                                        <Loader2 className="h-3 w-3 animate-spin text-brand-strong" />
                                                    )}
                                                    <CanonicalStatusBadge
                                                        status={exp.status}
                                                    />
                                                </div>
                                                {exp.error_message && (
                                                    <p className="mt-0.5 max-w-xs text-xs text-danger">
                                                        {exp.error_message}
                                                    </p>
                                                )}
                                            </td>

                                            <td className="px-4 py-3 text-ink-soft">
                                                {exp.row_count !== null
                                                    ? exp.row_count.toLocaleString()
                                                    : '—'}
                                            </td>

                                            <td className="px-4 py-3 text-ink-soft">
                                                {exp.file_size_bytes !== null
                                                    ? `${(exp.file_size_bytes / 1024).toFixed(1)} KB`
                                                    : '—'}
                                            </td>

                                            <td className="px-4 py-3 text-xs">
                                                <ExpiryCountdown
                                                    expiresAt={exp.expires_at}
                                                    isExpired={exp.is_expired}
                                                />
                                            </td>

                                            <td className="px-4 py-3 text-xs text-ink-soft">
                                                {exp.created_at
                                                    ? formatDateTime(
                                                          exp.created_at,
                                                      )
                                                    : '—'}
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {exp.is_downloadable && (
                                                        <a
                                                            href={
                                                                exp.download_url
                                                            }
                                                            download
                                                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line-strong bg-brand px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-brand-strong"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                            Download
                                                        </a>
                                                    )}

                                                    {(exp.status.value ===
                                                        'failed' ||
                                                        exp.is_expired) && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleRetry(exp)
                                                            }
                                                            disabled={
                                                                isRetrying
                                                            }
                                                            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface-subtle disabled:opacity-60"
                                                        >
                                                            <RefreshCw
                                                                className={cn(
                                                                    'h-3.5 w-3.5',
                                                                    isRetrying &&
                                                                        'animate-spin',
                                                                )}
                                                            />
                                                            {isRetrying
                                                                ? 'Retrying…'
                                                                : 'Retry'}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            )}
        </div>
    );
}

function RequestExportForm({ onDone }: { onDone: () => void }) {
    const form = useForm({
        export_type: 'job_reports',
        format: 'csv',
        date_from: '',
        date_to: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/operations/reports/exports', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onDone();
            },
        });
    };

    return (
        <Panel className="p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                <div>
                    <h4 className="text-base font-semibold text-ink">
                        New Asynchronous Data Export Request
                    </h4>
                    <p className="text-xs text-ink-soft">
                        Exports process in background jobs. Once ready, files
                        remain downloadable for 24 hours.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onDone}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-subtle hover:text-ink"
                    aria-label="Close export form"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Export Dataset *
                        </label>
                        <select
                            value={form.data.export_type}
                            onChange={(e) =>
                                form.setData('export_type', e.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                            required
                        >
                            <option value="job_reports">Job Reports</option>
                            <option value="dispatches">
                                Dispatch Lifecycle
                            </option>
                            <option value="assets">Fleet & Assets</option>
                            <option value="fuel_logs">Fuel Receipts</option>
                            <option value="weekly_fuel_consumption">
                                Weekly Fuel Consumption Summary
                            </option>
                            <option value="maintenance_logs">
                                Fleet Maintenance
                            </option>
                            <option value="location_audit">
                                Location Audit
                            </option>
                            <option value="system_audit">System Audit</option>
                        </select>
                        {form.errors.export_type && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.export_type}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-ink uppercase">
                            File Format *
                        </label>
                        <select
                            value={form.data.format}
                            onChange={(e) =>
                                form.setData('format', e.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                            required
                        >
                            <option value="csv">
                                CSV (Comma Separated Values)
                            </option>
                            <option value="pdf">
                                PDF (Printable Document)
                            </option>
                        </select>
                        {form.errors.format && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.format}
                            </p>
                        )}
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Date From (Optional)
                        </label>
                        <input
                            type="date"
                            value={form.data.date_from}
                            onChange={(e) =>
                                form.setData('date_from', e.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Date To (Optional)
                        </label>
                        <input
                            type="date"
                            value={form.data.date_to}
                            onChange={(e) =>
                                form.setData('date_to', e.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-line pt-4">
                    <Button type="button" variant="secondary" onClick={onDone}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={form.processing}
                    >
                        {form.processing
                            ? 'Queuing Export…'
                            : 'Generate Export'}
                    </Button>
                </div>
            </form>
        </Panel>
    );
}

function ExpiryCountdown({
    expiresAt,
    isExpired,
}: {
    expiresAt: string | null;
    isExpired: boolean;
}) {
    const [remainingSec, setRemainingSec] = useState<number | null>(() => {
        if (!expiresAt) {
            return null;
        }

        const diff = Math.floor(
            (new Date(expiresAt).getTime() - Date.now()) / 1000,
        );

        return Math.max(0, diff);
    });

    useEffect(() => {
        if (remainingSec === null || remainingSec <= 0) {
            return;
        }

        const interval = window.setInterval(() => {
            setRemainingSec((prev) =>
                prev !== null ? Math.max(0, prev - 1) : null,
            );
        }, 1000);

        return () => window.clearInterval(interval);
    }, [remainingSec]);

    if (!expiresAt) {
        return <span className="text-ink-soft">24h upon completion</span>;
    }

    if (isExpired || (remainingSec !== null && remainingSec <= 0)) {
        return (
            <span className="inline-flex items-center gap-1 font-medium text-danger">
                <Clock className="h-3 w-3" />
                Expired
            </span>
        );
    }

    const remainingHours = Math.floor((remainingSec ?? 0) / 3600);
    const remainingMins = Math.floor(((remainingSec ?? 0) % 3600) / 60);

    return (
        <span
            className="inline-flex items-center gap-1 font-medium text-ink-soft"
            title={`Exact Expiry: ${new Date(expiresAt).toLocaleString()}`}
        >
            <Clock className="h-3 w-3 text-warning-strong" />
            {remainingHours > 0
                ? `${remainingHours}h ${remainingMins}m left`
                : `${remainingMins}m left`}
        </span>
    );
}
