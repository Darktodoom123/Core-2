import {
    Activity,
    Database,
    Layers,
    MapPin,
    Radio,
    RefreshCw,
    Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatClockTime } from '../manager/manager-dashboard-model';
import type {
    ServiceState,
    Subsystem,
    SystemHealth,
} from './admin-dashboard-model';

const ICONS: Record<string, LucideIcon> = {
    database: Database,
    cache: Zap,
    outbox: Layers,
    queues: Activity,
    tracking: MapPin,
    realtime: Radio,
};

const STATE_DOT: Record<ServiceState, string> = {
    ok: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    unknown: 'bg-line-strong',
    off: 'bg-line-strong',
};

const STATE_TEXT: Record<ServiceState, string> = {
    ok: 'text-success-strong',
    warning: 'text-warning-strong',
    danger: 'text-danger-strong',
    unknown: 'text-ink-soft',
    off: 'text-ink-soft',
};

const OVERALL: Record<
    SystemHealth['status'],
    { label: string; className: string }
> = {
    healthy: {
        label: 'Healthy',
        className: 'bg-success-soft text-success-strong',
    },
    degraded: {
        label: 'Degraded',
        className: 'bg-warning-soft text-warning-strong',
    },
    unhealthy: {
        label: 'Unhealthy',
        className: 'bg-danger-soft text-danger-strong',
    },
};

export function SystemHealthPanel({
    health,
    rows,
    error,
    loading,
    checkedAt,
    onRefresh,
}: {
    health: SystemHealth | null;
    rows: Subsystem[];
    error: string | null;
    loading: boolean;
    checkedAt: number | null;
    onRefresh: () => void;
}) {
    const overall = health ? OVERALL[health.status] : null;

    return (
        <section
            aria-labelledby="admin-health-heading"
            className="overflow-hidden rounded-xl border border-line bg-surface shadow-2xs"
        >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-2.5">
                    <h2
                        id="admin-health-heading"
                        className="text-sm font-semibold text-ink"
                    >
                        System health
                    </h2>
                    {overall && (
                        <span
                            className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-semibold',
                                overall.className,
                            )}
                        >
                            {overall.label}
                        </span>
                    )}
                    <span
                        className="text-xs text-ink-soft tabular-nums"
                        aria-live="polite"
                    >
                        {error
                            ? `Last check failed · ${error}`
                            : checkedAt
                              ? `Checked ${formatClockTime(new Date(checkedAt))} · every 30 s`
                              : 'Checking…'}
                    </span>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onRefresh}
                    disabled={loading}
                    className="gap-1.5"
                >
                    <RefreshCw
                        className={cn(
                            'size-3.5',
                            loading &&
                                'animate-spin motion-reduce:animate-none',
                        )}
                        aria-hidden="true"
                    />
                    {loading ? 'Checking…' : 'Check now'}
                </Button>
            </div>

            <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => {
                    const Icon = ICONS[row.key] ?? Activity;

                    return (
                        <li key={row.key} className="bg-surface p-4 sm:p-5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="flex items-center gap-1.5 font-medium text-ink-soft">
                                    <Icon
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    {row.label}
                                </span>
                                <span
                                    className={cn(
                                        'inline-flex items-center gap-1.5 font-semibold',
                                        STATE_TEXT[row.state],
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'size-1.5 rounded-full',
                                            STATE_DOT[row.state],
                                        )}
                                        aria-hidden="true"
                                    />
                                    {row.status}
                                </span>
                            </div>
                            <p className="mt-2 text-lg font-semibold tracking-tight text-ink tabular-nums">
                                {row.value}
                            </p>
                            <p className="text-xs text-ink-soft">
                                {row.detail}
                            </p>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
