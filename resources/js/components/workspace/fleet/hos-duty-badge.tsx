import {
    Activity,
    AlertTriangle,
    Coffee,
    Moon,
    Pause,
    Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssetViewModel } from '@/types/workspace';

interface HosDutyBadgeProps {
    hos: AssetViewModel['hos'];
    compact?: boolean;
    className?: string;
}

const DUTY_CONFIG: Record<
    string,
    { label: string; icon: typeof Activity; badgeClass: string }
> = {
    operating: {
        label: 'Operating',
        icon: Activity,
        badgeClass:
            'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    },
    driving: {
        label: 'Driving',
        icon: Truck,
        badgeClass:
            'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    },
    standby: {
        label: 'Standby',
        icon: Pause,
        badgeClass:
            'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
    on_break: {
        label: 'On Break',
        icon: Coffee,
        badgeClass:
            'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    },
    off_duty: {
        label: 'Off Duty',
        icon: Moon,
        badgeClass:
            'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    },
};

export function HosDutyBadge({
    hos,
    compact = false,
    className,
}: HosDutyBadgeProps) {
    if (!hos) {
        return null;
    }

    const duty = DUTY_CONFIG[hos.duty_status] ?? {
        label: hos.duty_status_label || hos.duty_status,
        icon: Activity,
        badgeClass:
            'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    };

    const DutyIcon = duty.icon;

    const isViolation = hos.fatigue_status === 'violation';
    const isCritical = hos.fatigue_status === 'critical';
    const isWarning = hos.fatigue_status === 'warning' || hos.dole_warning;

    const fatigueAlert = isViolation
        ? {
              label: 'DOLE 14h Limit Exceeded',
              badgeClass: 'bg-danger text-canvas font-bold animate-pulse',
              description:
                  'Mandatory halt: Daily operating limit exceeded per DOLE guidelines.',
          }
        : isCritical
          ? {
                label: 'DOLE 10h Cap Reached',
                badgeClass:
                    'bg-danger-soft text-danger-strong border-danger/30 font-semibold',
                description:
                    'Relief operator required: 10-hour duty threshold reached.',
            }
          : isWarning
            ? {
                  label: 'DOLE Caution (9h+)',
                  badgeClass:
                      'bg-warning-soft text-warning-strong border-warning/30 font-medium',
                  description: 'Approaching maximum continuous duty shift.',
              }
            : null;

    if (compact) {
        return (
            <div className={cn('inline-flex items-center gap-1.5', className)}>
                <span
                    className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
                        duty.badgeClass,
                    )}
                >
                    <DutyIcon className="h-3 w-3" />
                    <span>{duty.label}</span>
                    <span className="font-mono text-[10px] opacity-80">
                        {hos.hours_elapsed.toFixed(1)}h
                    </span>
                </span>
                {fatigueAlert && (
                    <span
                        className={cn(
                            'py-0.2 inline-flex items-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold',
                            fatigueAlert.badgeClass,
                        )}
                        title={fatigueAlert.description}
                    >
                        <AlertTriangle className="h-2.5 w-2.5" />
                        <span>{fatigueAlert.label}</span>
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className={cn('space-y-1.5', className)}>
            <div className="flex flex-wrap items-center gap-2">
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold',
                        duty.badgeClass,
                    )}
                >
                    <DutyIcon className="h-3.5 w-3.5" />
                    <span>{duty.label}</span>
                    <span className="py-0.2 ml-1 rounded bg-black/10 px-1 font-mono text-[11px] font-bold dark:bg-white/10">
                        {hos.hours_elapsed.toFixed(1)} hrs
                    </span>
                </span>

                {fatigueAlert && (
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs',
                            fatigueAlert.badgeClass,
                        )}
                        title={fatigueAlert.description}
                    >
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>{fatigueAlert.label}</span>
                    </span>
                )}
            </div>

            {fatigueAlert && (
                <p className="text-[11px] text-ink-soft">
                    {fatigueAlert.description}
                </p>
            )}
        </div>
    );
}
