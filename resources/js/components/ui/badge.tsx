import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import type {
    PrototypeDispatchStatusLabel,
    TelemetryFreshness,
} from '@/types/operations';

export const badgeVariants = cva(
    'inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none',
    {
        variants: {
            variant: {
                default: 'bg-surface-subtle text-ink-soft',
                brand: 'bg-brand-soft text-brand-strong font-semibold',
                secondary: 'border border-line-strong bg-surface text-ink',
                outline: 'border border-line bg-transparent text-ink-soft',
                success: 'bg-success-soft text-success-strong',
                warning: 'bg-warning-soft text-warning-strong',
                danger: 'bg-danger-soft text-danger-strong',
                info: 'bg-info-soft text-info-strong',
                dark: 'bg-ink text-white',
            },
            size: {
                sm: 'min-h-5 px-2 text-[11px]',
                md: 'min-h-6 px-2.5 text-xs',
                lg: 'min-h-7 px-3 text-sm',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'md',
        },
    },
);

export interface BadgeProps
    extends HTMLAttributes<HTMLSpanElement>,
        VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant, size, ...props }, ref) => (
        <span
            ref={ref}
            className={cn(badgeVariants({ variant, size, className }))}
            {...props}
        />
    ),
);
Badge.displayName = 'Badge';

export const statusClasses: Record<string, string> = {
    // Title Case (Prototype simulation compatibility)
    Draft: 'bg-surface-subtle text-ink-soft',
    Scheduled: 'bg-brand-soft text-brand-strong',
    Dispatched: 'bg-brand-soft text-brand-strong',
    'En route': 'bg-brand-soft text-brand-strong',
    Arrived: 'bg-success-soft text-success-strong',
    'In progress': 'bg-success-soft text-success-strong',
    'On hold': 'bg-warning-soft text-warning-strong',
    Completed: 'bg-success-soft text-success-strong',
    Cancelled: 'bg-danger-soft text-danger-strong',
    Live: 'bg-success-soft text-success-strong',
    Delayed: 'bg-warning-soft text-warning-strong',
    Stale: 'bg-warning-soft text-warning-strong',
    Offline: 'bg-surface-subtle text-ink-soft',
    Available: 'bg-success-soft text-success-strong',
    Assigned: 'bg-brand-soft text-brand-strong',
    Working: 'bg-success-soft text-success-strong',
    Maintenance: 'bg-warning-soft text-warning-strong',
    Pending: 'bg-warning-soft text-warning-strong',
    Approved: 'bg-success-soft text-success-strong',
    Rejected: 'bg-danger-soft text-danger-strong',
    Dispensed: 'bg-brand-soft text-brand-strong',
    Priority: 'bg-warning-soft text-warning-strong',
    Emergency: 'bg-danger-soft text-danger-strong',
    Routine: 'bg-surface-subtle text-ink-soft',
    Operational: 'bg-success-soft text-success-strong',
    Resolved: 'bg-success-soft text-success-strong',

    // Canonical Lowercase Statuses
    draft: 'bg-surface-subtle text-ink-soft',
    pending_approval: 'bg-warning-soft text-warning-strong',
    scheduled: 'bg-brand-soft text-brand-strong',
    dispatched: 'bg-brand-soft text-brand-strong',
    accepted: 'bg-brand-soft text-brand-strong',
    en_route: 'bg-brand-soft text-brand-strong',
    arrived: 'bg-success-soft text-success-strong',
    working: 'bg-success-soft text-success-strong',
    completed: 'bg-success-soft text-success-strong',
    cancelled: 'bg-danger-soft text-danger-strong',
    routine: 'bg-surface-subtle text-ink-soft',
    priority: 'bg-warning-soft text-warning-strong',
    emergency: 'bg-danger-soft text-danger-strong',
    available: 'bg-success-soft text-success-strong',
    assigned: 'bg-brand-soft text-brand-strong',
    in_transit: 'bg-brand-soft text-brand-strong',
    on_site: 'bg-success-soft text-success-strong',
    maintenance: 'bg-warning-soft text-warning-strong',
    out_of_service: 'bg-danger-soft text-danger-strong',
    under_inspection: 'bg-warning-soft text-warning-strong',
    under_maintenance: 'bg-warning-soft text-warning-strong',
    awaiting_parts: 'bg-warning-soft text-warning-strong',
    ready_for_service: 'bg-success-soft text-success-strong',
    unavailable: 'bg-danger-soft text-danger-strong',
    pending: 'bg-warning-soft text-warning-strong',
    approved: 'bg-success-soft text-success-strong',
    rejected: 'bg-danger-soft text-danger-strong',
    submitted: 'bg-surface-subtle text-ink-soft',
    dispatching: 'bg-brand-soft text-brand-strong',
    forwarded: 'bg-brand-soft text-brand-strong',
    verified: 'bg-success-soft text-success-strong',
    logged: 'bg-success-soft text-success-strong',
    queued: 'bg-surface-subtle text-ink-soft',
    processing: 'bg-brand-soft text-brand-strong',
    failed: 'bg-danger-soft text-danger-strong',
    expired: 'bg-surface-subtle text-ink-soft',
    fresh: 'bg-success-soft text-success-strong',
    delayed: 'bg-warning-soft text-warning-strong',
    stale: 'bg-warning-soft text-warning-strong',
    offline: 'bg-surface-subtle text-ink-soft',
};

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
    status: PrototypeDispatchStatusLabel | TelemetryFreshness | string;
    showDot?: boolean;
}

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
    ({ status, className, showDot = true, children, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(
                    'inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                    statusClasses[status] ?? 'bg-surface-subtle text-ink-soft',
                    className,
                )}
                {...props}
            >
                {showDot && (
                    <span
                        aria-hidden="true"
                        className={cn(
                            'h-1.5 w-1.5 rounded-full bg-current shrink-0',
                            status === 'Offline' && 'rounded-none',
                        )}
                    />
                )}
                {children ?? status}
            </span>
        );
    },
);
StatusBadge.displayName = 'StatusBadge';
