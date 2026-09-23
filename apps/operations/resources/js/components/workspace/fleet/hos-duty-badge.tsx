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
        badgeClass: 'bg-accent-soft text-accent-strong border-accent/30',
    },
    driving: {
        label: 'Driving',
        icon: Truck,
        badgeClass: 'bg-brand-soft text-brand-strong border-brand-strong/30',
    },
    standby: {
        label: 'Standby',
        icon: Pause,
        badgeClass: 'bg-warning-soft text-warning-strong border-warning/30',
    },
    on_break: {
        label: 'On Break',
        icon: Coffee,
        badgeClass: 'bg-info-soft text-info-strong border-info/30',
    },
    off_duty: {
        label: 'Off Duty',
        icon: Moon,
        badgeClass: 'bg-surface-subtle text-ink-soft border-line',
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
        badgeClass: 'bg-surface-subtle text-ink-soft border-line',
    };

    const DutyIcon = duty.icon;

    const isViolation = hos.fatigue_status === 'violation';
    const isCritical = hos.fatigue_status === 'critical';
    const isWarning = hos.fatigue_status === 'warning' || hos.dole_warning;

    const fatigueAlert = isViolation
        ? {
              label: '10h Operating Limit Exceeded',
              badgeClass: 'bg-danger text-canvas font-bold animate-pulse',
              description:
                  'Mandatory halt: the configured 10-hour operating limit has been exceeded.',
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
                  description:
                      'Approaching the configured 10-hour operating limit.',
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
                    <span className="font-mono text-[10px] tabular-nums opacity-80">
                        {hos.hours_elapsed.toFixed(1)}h
                    </span>
                </span>
                {fatigueAlert && (
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
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
                    <span className="ml-1 rounded bg-black/10 px-1 py-0.5 font-mono text-[11px] font-bold tabular-nums dark:bg-white/10">
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
