import { Clock, DollarSign, PauseCircle } from 'lucide-react';
import { formatDateTime, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface DelayLogEntry {
    id: number;
    duty_status: string;
    standby_reason: string;
    is_demurrage_billable: boolean;
    started_at: string;
    ended_at: string | null;
    duration_minutes?: number | null;
}

interface JobReportDelayLogsTableProps {
    delayLogs?: DelayLogEntry[];
    className?: string;
}

export function JobReportDelayLogsTable({
    delayLogs = [],
    className,
}: JobReportDelayLogsTableProps) {
    if (!delayLogs || delayLogs.length === 0) {
        return (
            <div
                className={cn(
                    'rounded-xl border border-line bg-surface-subtle p-3.5 text-xs text-ink-soft',
                    className,
                )}
            >
                <div className="flex items-center gap-1.5 font-medium text-ink">
                    <Clock className="h-3.5 w-3.5 text-ink-soft" />
                    <span>Standby &amp; Demurrage Logs</span>
                </div>
                <p className="mt-1 text-[11px] text-ink-soft">
                    No operational delays or standby demurrage logged for this
                    dispatch job.
                </p>
            </div>
        );
    }

    const totalMinutes = delayLogs.reduce(
        (acc, l) => acc + (l.duration_minutes || 0),
        0,
    );
    const billableCount = delayLogs.filter(
        (l) => l.is_demurrage_billable,
    ).length;
    const totalHours = (totalMinutes / 60).toFixed(1);

    return (
        <div
            className={cn(
                'overflow-hidden rounded-xl border border-line bg-surface text-xs',
                className,
            )}
        >
            {/* Header / Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-subtle px-4 py-3">
                <div className="flex items-center gap-2">
                    <PauseCircle className="h-4 w-4 text-warning-strong" />
                    <h4 className="font-semibold text-ink">
                        Field Standby &amp; Demurrage Logs ({delayLogs.length})
                    </h4>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                    <span className="rounded border border-line bg-surface px-2 py-0.5 font-semibold text-ink">
                        Total Delay: {totalHours} hrs ({totalMinutes} mins)
                    </span>
                    {billableCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded border border-brand-strong/30 bg-brand-soft px-2 py-0.5 font-semibold text-brand-strong">
                            <DollarSign className="h-3 w-3" />
                            {billableCount} Billable Demurrage
                        </span>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="border-b border-line bg-surface-subtle/50 text-[10px] font-bold tracking-wider text-ink-soft uppercase">
                        <tr>
                            <th className="px-4 py-2.5">
                                Delay Reason / Event
                            </th>
                            <th className="px-3 py-2.5">Classification</th>
                            <th className="px-3 py-2.5">Started</th>
                            <th className="px-3 py-2.5">Ended</th>
                            <th className="px-4 py-2.5 text-right">Duration</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {delayLogs.map((log) => (
                            <tr
                                key={log.id}
                                className="transition-colors hover:bg-surface-subtle/50"
                            >
                                <td className="px-4 py-2.5 font-medium text-ink">
                                    {humanize(
                                        log.standby_reason || log.duty_status,
                                    )}
                                </td>
                                <td className="px-3 py-2.5">
                                    {log.is_demurrage_billable ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-brand-strong/40 bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-strong">
                                            <DollarSign className="h-2.5 w-2.5" />
                                            Billable Demurrage
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center rounded-full border border-line bg-surface-subtle px-2 py-0.5 text-[10px] text-ink-soft">
                                            Standard Standby
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-[11px] text-ink-soft">
                                    {formatDateTime(log.started_at)}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-[11px] text-ink-soft">
                                    {log.ended_at
                                        ? formatDateTime(log.ended_at)
                                        : 'Ongoing'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-semibold text-ink">
                                    {log.duration_minutes !== null &&
                                    log.duration_minutes !== undefined
                                        ? `${log.duration_minutes}m`
                                        : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
