import { router, useForm } from '@inertiajs/react';
import {
    Download,
    DownloadCloud,
    FileSpreadsheet,
    RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
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

    if (!capabilities.export_reports) {
        return null;
    }

    return (
        <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-ink">
                        Asynchronous Data Exports
                    </h3>
                    <p className="text-sm text-ink-soft">
                        Generate and download background CSV/Excel exports for
                        operational reports, dispatches, fuel, and fleet
                        maintenance records.
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

            {showExportModal && (
                <RequestExportForm onDone={() => setShowExportModal(false)} />
            )}

            {exports.length === 0 ? (
                <Panel>
                    <EmptyState
                        icon={FileSpreadsheet}
                        title="No export history found"
                        message="Requested background CSV/Excel data exports will appear here with live progress, file sizes, and download links."
                    />
                </Panel>
            ) : (
                <Panel className="overflow-hidden">
                    <div className="border-b border-line px-4 py-3 font-semibold text-ink">
                        Export Tasks ({exports.length})
                    </div>
                    <div className="overflow-x-auto">
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
                                        Size
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Created
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {exports.map((exp) => (
                                    <tr
                                        key={exp.id}
                                        className="hover:bg-surface-subtle/50"
                                    >
                                        <td className="px-4 py-3 font-medium text-ink">
                                            {exp.export_type.label}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center rounded-md bg-surface-subtle px-2 py-1 font-mono text-xs font-semibold text-ink">
                                                {exp.format}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <CanonicalStatusBadge
                                                status={exp.status}
                                            />
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
                                        <td className="px-4 py-3 text-xs text-ink-soft">
                                            {exp.created_at
                                                ? new Date(
                                                      exp.created_at,
                                                  ).toLocaleString()
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {exp.is_downloadable && (
                                                <a
                                                    href={exp.download_url}
                                                    download
                                                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface-subtle"
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                    Download
                                                </a>
                                            )}
                                            {(exp.status.value === 'failed' ||
                                                exp.is_expired) && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.post(
                                                            exp.retry_url,
                                                            {},
                                                            {
                                                                preserveScroll: true,
                                                            },
                                                        )
                                                    }
                                                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface-subtle"
                                                >
                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                    Retry
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
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
            <h4 className="text-base font-semibold text-ink">
                New Asynchronous Data Export Request
            </h4>
            <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className="block text-sm font-medium text-ink">
                            Export Dataset *
                        </label>
                        <select
                            value={form.data.export_type}
                            onChange={(e) =>
                                form.setData('export_type', e.target.value)
                            }
                            className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
                            required
                        >
                            <option value="job_reports">Job Reports</option>
                            <option value="dispatches">
                                Dispatch Lifecycle
                            </option>
                            <option value="fuel_logs">Fuel Logs</option>
                            <option value="maintenance_logs">
                                Fleet Maintenance
                            </option>
                        </select>
                        {form.errors.export_type && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.export_type}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-ink">
                            File Format *
                        </label>
                        <select
                            value={form.data.format}
                            onChange={(e) =>
                                form.setData('format', e.target.value)
                            }
                            className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
                            required
                        >
                            <option value="csv">
                                CSV (Comma Separated Values)
                            </option>
                            <option value="xlsx">Excel (.xlsx format)</option>
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
                        <label className="block text-sm font-medium text-ink">
                            Date From (Optional)
                        </label>
                        <input
                            type="date"
                            value={form.data.date_from}
                            onChange={(e) =>
                                form.setData('date_from', e.target.value)
                            }
                            className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-ink">
                            Date To (Optional)
                        </label>
                        <input
                            type="date"
                            value={form.data.date_to}
                            onChange={(e) =>
                                form.setData('date_to', e.target.value)
                            }
                            className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
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
                        {form.processing ? 'Requesting…' : 'Generate Export'}
                    </Button>
                </div>
            </form>
        </Panel>
    );
}
