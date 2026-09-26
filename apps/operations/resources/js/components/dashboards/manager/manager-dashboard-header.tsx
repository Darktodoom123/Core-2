import { AlertTriangle, Radio, RefreshCw, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScopeRefreshState } from '@/types/workspace';
import { formatClockTime, formatElapsed } from './manager-dashboard-model';

export function ManagerDashboardHeader({
    actionCount,
    todayTotal,
    todayTruncated = false,
    inService,
    loadedUnits,
    realtimeConnected,
    workspaceRefresh,
    now,
}: {
    actionCount: number;
    todayTotal: number | null;
    /** The schedule was loaded partially, so todayTotal is a minimum. */
    todayTruncated?: boolean;
    inService: number;
    loadedUnits: number;
    realtimeConnected: boolean;
    workspaceRefresh?: ScopeRefreshState;
    now: number;
}) {
    const summary = [
        todayTotal === null
            ? null
            : todayTruncated
              ? `${todayTotal}+ dispatches today`
              : `${todayTotal} ${todayTotal === 1 ? 'dispatch' : 'dispatches'} today`,
        loadedUnits > 0
            ? `${inService} of ${loadedUnits} units in service`
            : null,
    ].filter(Boolean);

    return (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
                    Operation Dashboard
                </h1>
                <p className="mt-1 text-sm text-ink-soft">
                    <span className="font-semibold text-ink">
                        {actionCount === 0
                            ? 'Nothing needs your decision'
                            : `${actionCount} ${actionCount === 1 ? 'item needs' : 'items need'} action`}
                    </span>
                    {summary.map((part) => (
                        <span key={part}>
                            <span
                                className="mx-1.5 text-line-strong"
                                aria-hidden="true"
                            >
                                ·
                            </span>
                            {part}
                        </span>
                    ))}
                </p>
            </div>
            <DataFreshness
                realtimeConnected={realtimeConnected}
                refresh={workspaceRefresh}
                now={now}
            />
        </div>
    );
}

/** Connection state and data age are reported separately on purpose. */
function DataFreshness({
    realtimeConnected,
    refresh,
    now,
}: {
    realtimeConnected: boolean;
    refresh?: ScopeRefreshState;
    now: number;
}) {
    // Server snapshot time of the data on screen (same basis as the stale notice).
    const refreshedAt =
        refresh?.refreshed_at ?? refresh?.last_success_at ?? null;
    const age = formatElapsed(refreshedAt, now, { precise: true });

    return (
        <div
            className="shrink-0 text-xs leading-5 text-ink-soft tabular-nums lg:text-right"
            aria-live="polite"
        >
            <p
                className={cn(
                    'inline-flex items-center gap-1.5 font-semibold',
                    realtimeConnected
                        ? 'text-success-strong'
                        : 'text-warning-strong',
                )}
            >
                {realtimeConnected ? (
                    <Radio className="size-3.5" aria-hidden="true" />
                ) : (
                    <WifiOff className="size-3.5" aria-hidden="true" />
                )}
                {realtimeConnected
                    ? 'Live updates connected'
                    : 'Live updates offline · checking every 15 s'}
            </p>
            {refresh?.status === 'refreshing' ? (
                <p className="flex items-center gap-1.5 lg:justify-end">
                    <RefreshCw
                        className="size-3 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                    />
                    Refreshing workspace data…
                </p>
            ) : refresh?.status === 'failed' ? (
                <p className="flex items-center gap-1.5 font-medium text-warning-strong lg:justify-end">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    Refresh failed
                    {refreshedAt
                        ? ` · showing data from ${formatClockTime(refreshedAt)}`
                        : ''}
                </p>
            ) : age !== null && refreshedAt ? (
                <p>
                    Data refreshed {age} ago ·{' '}
                    <time dateTime={refreshedAt}>
                        {formatClockTime(refreshedAt)}
                    </time>
                </p>
            ) : null}
        </div>
    );
}
