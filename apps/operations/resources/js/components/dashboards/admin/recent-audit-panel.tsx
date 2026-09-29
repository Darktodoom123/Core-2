import { FileText } from 'lucide-react';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import type { AuditPage } from '@/components/workspace/audit/audit-api';
import {
    auditActionLabel,
    auditTone,
} from '@/components/workspace/audit/audit-labels';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { formatElapsed } from '../manager/manager-dashboard-model';

export function RecentAuditPanel({
    audit,
    error,
    now,
    canOpenAudit,
    onOpenAudit,
    onRetry,
}: {
    audit: AuditPage | null;
    error: string | null;
    now: number;
    canOpenAudit: boolean;
    onOpenAudit: () => void;
    onRetry: () => void;
}) {
    return (
        <section
            aria-labelledby="admin-recent-audit-heading"
            className="overflow-hidden rounded-xl border border-line bg-surface shadow-2xs"
        >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                <div>
                    <h2
                        id="admin-recent-audit-heading"
                        className="text-sm font-semibold text-ink"
                    >
                        Recent activity
                    </h2>
                    <p className="text-xs text-ink-soft">
                        {audit
                            ? `${audit.total.toLocaleString()} events recorded in total`
                            : 'Latest recorded changes and sign-ins'}
                    </p>
                </div>
                {canOpenAudit && (
                    <Button variant="quiet" size="sm" onClick={onOpenAudit}>
                        Open audit trail
                    </Button>
                )}
            </div>

            {!audit ? (
                error ? (
                    <div className="flex items-center justify-between gap-3 p-4 text-sm text-warning-strong sm:px-5">
                        <span>{error}</span>
                        <Button size="sm" onClick={onRetry}>
                            Try again
                        </Button>
                    </div>
                ) : (
                    <div role="status" className="space-y-3 p-4 sm:p-5">
                        <span className="sr-only">Loading recent activity</span>
                        {[0, 1, 2].map((row) => (
                            <Skeleton key={row} className="h-9 w-full" />
                        ))}
                    </div>
                )
            ) : audit.events.length === 0 ? (
                <EmptyState
                    compact
                    icon={FileText}
                    title="Nothing recorded yet"
                    message="Sign-ins, access changes, and overrides appear here as they happen."
                />
            ) : (
                <ol className="divide-y divide-line">
                    {audit.events.map((event) => {
                        const tone = auditTone(event.action);
                        const age = formatElapsed(event.occurred_at, now);

                        return (
                            <li
                                key={event.id}
                                className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5"
                            >
                                <div className="min-w-0">
                                    <p
                                        className={cn(
                                            'truncate text-sm font-medium',
                                            tone === 'danger'
                                                ? 'text-danger-strong'
                                                : tone === 'warning'
                                                  ? 'text-warning-strong'
                                                  : 'text-ink',
                                        )}
                                    >
                                        {auditActionLabel(event.action)}
                                    </p>
                                    <p className="truncate text-xs text-ink-soft">
                                        {event.actor?.name ?? 'System'}
                                        {event.reason
                                            ? ` · ${event.reason}`
                                            : ''}
                                    </p>
                                </div>
                                {event.occurred_at && (
                                    <time
                                        dateTime={event.occurred_at}
                                        title={formatDateTime(
                                            event.occurred_at,
                                        )}
                                        className="shrink-0 text-xs text-ink-soft tabular-nums"
                                    >
                                        {age ? `${age} ago` : ''}
                                    </time>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
