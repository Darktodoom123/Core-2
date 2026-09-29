import { router } from '@inertiajs/react';
import { Download, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { ReportExportViewModel } from '@/types/workspace';

const STATUS_TONE: Record<string, string> = {
    completed: 'bg-success-soft text-success-strong',
    failed: 'bg-danger-soft text-danger-strong',
    expired: 'bg-surface-subtle text-ink-soft',
    queued: 'bg-warning-soft text-warning-strong',
    processing: 'bg-warning-soft text-warning-strong',
};

/** Where administrators collect the exports they queued from this page. */
export function AuditExportsPanel({
    exports,
}: {
    exports: ReportExportViewModel[];
}) {
    const [refreshing, setRefreshing] = useState(false);
    const auditExports = exports.filter(
        (item) => item.export_type.value === 'system_audit',
    );

    const refresh = () => {
        setRefreshing(true);
        router.reload({
            only: ['reportExports'],
            onFinish: () => setRefreshing(false),
        });
    };

    return (
        <section
            aria-labelledby="audit-exports-heading"
            className="overflow-hidden rounded-xl border border-line bg-surface shadow-2xs"
        >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <h2
                    id="audit-exports-heading"
                    className="text-sm font-semibold text-ink"
                >
                    Your audit exports
                </h2>
                <Button
                    variant="quiet"
                    size="sm"
                    className="gap-1.5"
                    onClick={refresh}
                    disabled={refreshing}
                >
                    <RefreshCw
                        className={cn(
                            'size-3.5',
                            refreshing &&
                                'animate-spin motion-reduce:animate-none',
                        )}
                        aria-hidden="true"
                    />
                    Check status
                </Button>
            </div>

            {auditExports.length === 0 ? (
                <p className="px-4 py-3 text-sm text-ink-soft">
                    Exports you queue appear here with a download link when they
                    are ready.
                </p>
            ) : (
                <ul className="divide-y divide-line">
                    {auditExports.map((item) => (
                        <li
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                        >
                            <div className="min-w-0">
                                <p className="font-medium text-ink">
                                    {item.format} ·{' '}
                                    {item.created_at
                                        ? formatDateTime(item.created_at)
                                        : 'Queued'}
                                    <span
                                        className={cn(
                                            'ml-2 rounded px-1.5 py-0.5 align-middle text-[11px] font-semibold',
                                            STATUS_TONE[item.status.value] ??
                                                STATUS_TONE.expired,
                                        )}
                                    >
                                        {item.status.label}
                                    </span>
                                </p>
                                <p className="text-xs text-ink-soft">
                                    {item.error_message ??
                                        (item.row_count !== null
                                            ? `${item.row_count.toLocaleString()} events`
                                            : 'Preparing in the background')}
                                </p>
                            </div>
                            {item.can_download && item.download_url && (
                                <a
                                    href={item.download_url}
                                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line-strong px-3 text-xs font-semibold text-ink hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden md:min-h-9"
                                >
                                    <Download
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    Download
                                </a>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
