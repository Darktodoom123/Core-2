import { cn } from '@/lib/utils';
import type { CanonicalStatusValue, StatusViewModel } from '@/types/workspace';

type StatusTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

const statusTones: Record<CanonicalStatusValue, StatusTone> = {
    draft: 'neutral',
    pending_approval: 'warning',
    scheduled: 'brand',
    dispatched: 'brand',
    accepted: 'brand',
    en_route: 'brand',
    arrived: 'success',
    working: 'success',
    completed: 'success',
    cancelled: 'danger',
    routine: 'neutral',
    priority: 'warning',
    emergency: 'danger',
    submitted: 'neutral',
    dispatching: 'brand',
    forwarded: 'brand',
    approved: 'success',
    rejected: 'danger',
    verified: 'success',
    logged: 'success',
    available: 'success',
    assigned: 'brand',
    in_transit: 'brand',
    on_site: 'success',
    maintenance: 'warning',
    out_of_service: 'danger',
    under_inspection: 'warning',
    under_maintenance: 'warning',
    awaiting_parts: 'warning',
    ready_for_service: 'success',
    unavailable: 'danger',
    pending: 'warning',
    queued: 'neutral',
    processing: 'brand',
    failed: 'danger',
    expired: 'neutral',
};

const toneClasses: Record<StatusTone, string> = {
    neutral: 'border border-line-strong bg-surface-subtle text-ink-soft',
    brand: 'border border-brand/25 bg-brand-soft text-brand-strong',
    success: 'border border-success/25 bg-success-soft text-success-strong',
    warning:
        'border border-warning/30 bg-warning-soft text-warning-strong font-medium',
    danger: 'border border-danger/25 bg-danger-soft text-danger-strong',
};

const toneDotClasses: Record<StatusTone, string> = {
    neutral: 'bg-ink-muted',
    brand: 'bg-brand-strong',
    success: 'bg-success-strong',
    warning: 'bg-warning-strong',
    danger: 'bg-danger-strong',
};

export function CanonicalStatusBadge({
    status,
    className,
    showDot = true,
}: {
    status: StatusViewModel<CanonicalStatusValue>;
    className?: string;
    showDot?: boolean;
}) {
    const tone = statusTones[status.value] ?? 'neutral';

    return (
        <span
            className={cn(
                'inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors',
                toneClasses[tone],
                className,
            )}
        >
            {showDot && (
                <span
                    className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        toneDotClasses[tone],
                    )}
                    aria-hidden="true"
                />
            )}
            <span>{status.label}</span>
        </span>
    );
}
