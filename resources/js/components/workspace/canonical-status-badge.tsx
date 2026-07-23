import { AlertTriangle, Check, Circle, Clock3, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
    forwarded: 'brand',
    approved: 'success',
    rejected: 'danger',
    verified: 'success',
    logged: 'success',
    available: 'success',
    assigned: 'brand',
    under_inspection: 'warning',
    under_maintenance: 'warning',
    awaiting_parts: 'warning',
    ready_for_service: 'success',
    unavailable: 'danger',
    pending: 'warning',
};

const toneClasses: Record<StatusTone, string> = {
    neutral: 'bg-surface-subtle text-ink-soft',
    brand: 'bg-brand-soft text-brand-strong',
    success: 'bg-success-soft text-success-strong',
    warning: 'bg-warning-soft text-warning-strong',
    danger: 'bg-danger-soft text-danger',
};

const toneIcons: Record<StatusTone, LucideIcon> = {
    neutral: Circle,
    brand: Clock3,
    success: Check,
    warning: AlertTriangle,
    danger: X,
};

export function CanonicalStatusBadge({
    status,
    className,
}: {
    status: StatusViewModel<CanonicalStatusValue>;
    className?: string;
}) {
    const tone = statusTones[status.value];
    const Icon = toneIcons[tone];

    return (
        <span
            className={cn(
                'inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                toneClasses[tone],
                className,
            )}
        >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {status.label}
        </span>
    );
}
