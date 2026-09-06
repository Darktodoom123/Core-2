import { Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssetViewModel } from '@/types/workspace';

interface OperatorBindingChipProps {
    activeOperator: AssetViewModel['active_operator'];
    compact?: boolean;
    className?: string;
}

const TELEMETRY_STYLES: Record<
    'fresh' | 'delayed' | 'stale' | 'offline',
    { label: string; dotClass: string; badgeClass: string }
> = {
    fresh: {
        label: 'Live',
        dotClass: 'bg-emerald-500 animate-pulse',
        badgeClass:
            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    },
    delayed: {
        label: 'Delayed (<15m)',
        dotClass: 'bg-amber-500',
        badgeClass:
            'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
    stale: {
        label: 'Stale (>15m)',
        dotClass: 'bg-orange-500',
        badgeClass:
            'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    },
    offline: {
        label: 'Offline (>30m)',
        dotClass: 'bg-zinc-400 dark:bg-zinc-500',
        badgeClass:
            'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20',
    },
};

export function OperatorBindingChip({
    activeOperator,
    compact = false,
    className,
}: OperatorBindingChipProps) {
    if (!activeOperator) {
        return (
            <div
                className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border border-dashed border-line px-2 py-1 text-xs text-ink-soft',
                    className,
                )}
            >
                <User className="h-3 w-3 text-ink-soft/70" />
                <span>No active operator</span>
            </div>
        );
    }

    const telemetry =
        TELEMETRY_STYLES[activeOperator.telemetry_status] ??
        TELEMETRY_STYLES.offline;

    const initials = activeOperator.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('');

    if (compact) {
        return (
            <div
                className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-subtle px-2 py-0.5 text-xs text-ink',
                    className,
                )}
                title={`Operator: ${activeOperator.name} (${activeOperator.hours_elapsed.toFixed(1)}h shift, telemetry: ${telemetry.label})`}
            >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[9px] font-bold text-brand-strong">
                    {initials}
                </span>
                <span className="max-w-[100px] truncate font-medium">
                    {activeOperator.name}
                </span>
                <span className="inline-flex items-center gap-1">
                    <span
                        className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            telemetry.dotClass,
                        )}
                    />
                </span>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-subtle/80 p-2 text-xs',
                className,
            )}
        >
            <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand-strong shadow-xs">
                    {initials}
                </span>
                <div>
                    <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink">
                            {activeOperator.name}
                        </span>
                        <span
                            className={cn(
                                'py-0.2 inline-flex items-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold',
                                telemetry.badgeClass,
                            )}
                        >
                            <span
                                className={cn(
                                    'h-1.5 w-1.5 rounded-full',
                                    telemetry.dotClass,
                                )}
                            />
                            {telemetry.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-ink-soft">
                        <Clock className="h-3 w-3" />
                        <span>
                            {activeOperator.hours_elapsed.toFixed(1)}h on shift
                        </span>
                        {activeOperator.shift_started_at && (
                            <span className="text-ink-soft/60">
                                · started{' '}
                                {new Date(
                                    activeOperator.shift_started_at,
                                ).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
