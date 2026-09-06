import {
    AlertTriangle,
    Camera,
    CheckCircle2,
    Clock,
    ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssetViewModel } from '@/types/workspace';

interface DvirStatusBadgeProps {
    dvir: AssetViewModel['latest_dvir'];
    onViewInspection?: (dvirId: number) => void;
    compact?: boolean;
    className?: string;
}

export function DvirStatusBadge({
    dvir,
    onViewInspection,
    compact = false,
    className,
}: DvirStatusBadgeProps) {
    if (!dvir || dvir.status === 'pending_inspection') {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-1 rounded-full border border-line bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink-soft',
                    className,
                )}
            >
                <Clock className="h-3 w-3" />
                <span>Pending DVIR</span>
            </span>
        );
    }

    const isCritical =
        dvir.status === 'critical_defect' || dvir.critical_defects_count > 0;
    const isDefect = dvir.status === 'defect_flagged' || dvir.has_defects;

    const config = isCritical
        ? {
              label: `Critical Defect (${dvir.critical_defects_count})`,
              badgeClass:
                  'bg-danger-soft text-danger-strong border-danger/30 hover:bg-danger-soft/80',
              icon: ShieldAlert,
          }
        : isDefect
          ? {
                label: 'Defects Flagged',
                badgeClass:
                    'bg-warning-soft text-warning-strong border-warning/30 hover:bg-warning-soft/80',
                icon: AlertTriangle,
            }
          : {
                label:
                    dvir.type === 'post_trip'
                        ? 'Post-Trip Passed'
                        : 'Pre-Trip Passed',
                badgeClass:
                    'bg-success-soft text-success-strong border-success/30 hover:bg-success-soft/80',
                icon: CheckCircle2,
            };

    const StatusIcon = config.icon;
    const photoCount = dvir.photos?.length ?? 0;

    const content = (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
                config.badgeClass,
                onViewInspection && 'cursor-pointer select-none',
                className,
            )}
        >
            <StatusIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{config.label}</span>
            {photoCount > 0 && !compact && (
                <span className="inline-flex items-center gap-0.5 text-[10px] opacity-75">
                    <Camera className="h-2.5 w-2.5" />
                    <span>{photoCount}</span>
                </span>
            )}
        </span>
    );

    if (onViewInspection) {
        return (
            <button
                type="button"
                onClick={() => onViewInspection(dvir.id)}
                className="inline-flex rounded-full focus:ring-2 focus:ring-brand/40 focus:ring-offset-1 focus:outline-none"
                title="Click to view DVIR walkaround photos and inspection checklist"
            >
                {content}
            </button>
        );
    }

    return content;
}
