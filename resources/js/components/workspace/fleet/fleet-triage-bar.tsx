import {
    AlertCircle,
    AlertTriangle,
    Radio,
    ShieldAlert,
    Wrench,
    X,
} from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';

export type FleetTriageException =
    'lockouts' | 'blocking_orders' | 'dvir_defects' | 'stale_gps';

export interface FleetTriageCounts {
    lockouts: number;
    blocking_orders: number;
    dvir_defects: number;
    stale_gps: number;
}

export interface FleetTriageBarProps {
    activeFilter: FleetTriageException | null;
    onFilterChange: (filter: FleetTriageException | null) => void;
    counts: FleetTriageCounts;
    className?: string;
}

export function FleetTriageBar({
    activeFilter,
    onFilterChange,
    counts,
    className,
}: FleetTriageBarProps) {
    const handleToggle = (exception: FleetTriageException) => {
        if (activeFilter === exception) {
            onFilterChange(null);
        } else {
            onFilterChange(exception);
        }
    };

    return (
        <div
            className={cn(
                'flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-line bg-surface-subtle/50 p-2.5 shadow-2xs',
                className,
            )}
            role="region"
            aria-label="Exception triage toolbar"
        >
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 pr-1 text-xs font-semibold text-ink-soft">
                    <AlertCircle className="h-3.5 w-3.5 text-warning-strong" />
                    <span>Exception Triage:</span>
                </div>

                <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="group"
                    aria-label="1-click exception triage filters"
                >
                    {/* 1. Lockouts Filter */}
                    <button
                        type="button"
                        aria-pressed={activeFilter === 'lockouts'}
                        onClick={() => handleToggle('lockouts')}
                        className={cn(
                            'inline-flex min-h-7 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                            activeFilter === 'lockouts'
                                ? 'border-danger/50 bg-danger-soft font-semibold text-danger-strong ring-1 ring-danger/40'
                                : counts.lockouts > 0
                                  ? 'border-danger/30 bg-surface text-danger hover:bg-danger-soft/40'
                                  : 'border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                        )}
                    >
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                        <span>Lockouts ({counts.lockouts})</span>
                    </button>

                    {/* 2. Blocking Work Orders Filter */}
                    <button
                        type="button"
                        aria-pressed={activeFilter === 'blocking_orders'}
                        onClick={() => handleToggle('blocking_orders')}
                        className={cn(
                            'inline-flex min-h-7 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                            activeFilter === 'blocking_orders'
                                ? 'border-warning/50 bg-warning-soft font-semibold text-warning-strong ring-1 ring-warning/40'
                                : counts.blocking_orders > 0
                                  ? 'border-warning/30 bg-surface text-warning-strong hover:bg-warning-soft/40'
                                  : 'border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                        )}
                    >
                        <Wrench className="h-3.5 w-3.5 shrink-0" />
                        <span>Blocking Orders ({counts.blocking_orders})</span>
                    </button>

                    {/* 3. DVIR Defects Filter */}
                    <button
                        type="button"
                        aria-pressed={activeFilter === 'dvir_defects'}
                        onClick={() => handleToggle('dvir_defects')}
                        className={cn(
                            'inline-flex min-h-7 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                            activeFilter === 'dvir_defects'
                                ? 'border-amber-500/50 bg-amber-500/15 font-semibold text-amber-700 ring-1 ring-amber-500/40 dark:text-amber-300'
                                : counts.dvir_defects > 0
                                  ? 'border-amber-500/30 bg-surface text-amber-600 hover:bg-amber-500/10 dark:text-amber-400'
                                  : 'border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                        )}
                    >
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>DVIR Defects ({counts.dvir_defects})</span>
                    </button>

                    {/* 4. Stale GPS Filter */}
                    <button
                        type="button"
                        aria-pressed={activeFilter === 'stale_gps'}
                        onClick={() => handleToggle('stale_gps')}
                        className={cn(
                            'inline-flex min-h-7 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                            activeFilter === 'stale_gps'
                                ? 'border-ink/50 bg-surface font-semibold text-ink ring-1 ring-ink/30'
                                : counts.stale_gps > 0
                                  ? 'border-line-strong bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink'
                                  : 'border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                        )}
                    >
                        <Radio className="h-3.5 w-3.5 shrink-0" />
                        <span>Stale GPS ({counts.stale_gps})</span>
                    </button>
                </div>
            </div>

            {activeFilter && (
                <button
                    type="button"
                    onClick={() => onFilterChange(null)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-soft hover:bg-surface hover:text-ink focus:outline-none"
                    title="Reset exception triage filter"
                >
                    <X className="h-3 w-3" />
                    <span>Reset triage</span>
                </button>
            )}
        </div>
    );
}
