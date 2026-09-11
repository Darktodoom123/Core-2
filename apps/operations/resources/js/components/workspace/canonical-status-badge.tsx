import type { LucideIcon } from 'lucide-react';
import {
    AlertTriangle,
    Check,
    Clock,
    Flame,
    Loader2,
    Truck,
    Wrench,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CanonicalStatusValue, StatusViewModel } from '@/types/workspace';

export type StatusTone =
    'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger';

export type BadgeVariant = 'soft' | 'outline' | 'minimal';
export type BadgeSize = 'sm' | 'md' | 'lg';

export const statusTones: Record<CanonicalStatusValue, StatusTone> = {
    // Neutral (Drafts, queues, logs)
    draft: 'neutral',
    routine: 'neutral',
    submitted: 'neutral',
    queued: 'neutral',
    expired: 'neutral',

    // Brand / Assignment (Internal dispatch staging)
    scheduled: 'brand',
    assigned: 'brand',
    dispatching: 'brand',
    forwarded: 'brand',

    // Info (Active in-transit & active field operations)
    dispatched: 'info',
    accepted: 'info',
    en_route: 'info',
    in_transit: 'info',
    working: 'info',
    processing: 'info',

    // Success (Resolved, confirmed, healthy, ready)
    arrived: 'success',
    completed: 'success',
    approved: 'success',
    verified: 'success',
    logged: 'success',
    available: 'success',
    on_site: 'success',
    ready_for_service: 'success',

    // Warning (Needs attention, delays, inspection)
    pending_approval: 'warning',
    pending: 'warning',
    priority: 'warning',
    maintenance: 'warning',
    under_inspection: 'warning',
    under_maintenance: 'warning',
    awaiting_parts: 'warning',

    // Danger (Critical, rejected, blocked, failure)
    cancelled: 'danger',
    emergency: 'danger',
    rejected: 'danger',
    out_of_service: 'danger',
    unavailable: 'danger',
    failed: 'danger',
};

export const liveStatuses = new Set<CanonicalStatusValue>([
    'en_route',
    'in_transit',
    'working',
    'processing',
    'dispatching',
]);

export const statusIcons: Partial<Record<CanonicalStatusValue, LucideIcon>> = {
    completed: Check,
    approved: Check,
    ready_for_service: Check,
    verified: Check,
    cancelled: X,
    rejected: X,
    failed: X,
    emergency: Flame,
    priority: AlertTriangle,
    maintenance: Wrench,
    under_maintenance: Wrench,
    en_route: Truck,
    in_transit: Truck,
    processing: Loader2,
    scheduled: Clock,
    pending: Clock,
    pending_approval: Clock,
};

export const toneClasses: Record<StatusTone, string> = {
    neutral: 'border border-line-strong bg-surface-subtle text-ink-soft',
    brand: 'border border-brand/25 bg-brand-soft text-brand-strong',
    info: 'border border-info/25 bg-info-soft text-info-strong',
    success: 'border border-success/25 bg-success-soft text-success-strong',
    warning:
        'border border-warning/30 bg-warning-soft text-warning-strong font-medium',
    danger: 'border border-danger/25 bg-danger-soft text-danger-strong',
};

export const variantToneClasses: Record<
    BadgeVariant,
    Record<StatusTone, string>
> = {
    soft: toneClasses,
    outline: {
        neutral: 'border border-line-strong bg-transparent text-ink-soft',
        brand: 'border border-brand-strong/40 bg-transparent text-brand-strong',
        info: 'border border-info-strong/40 bg-transparent text-info-strong',
        success:
            'border border-success-strong/40 bg-transparent text-success-strong',
        warning:
            'border border-warning-strong/40 bg-transparent text-warning-strong font-medium',
        danger: 'border border-danger-strong/40 bg-transparent text-danger-strong',
    },
    minimal: {
        neutral: 'border-transparent bg-transparent text-ink-soft',
        brand: 'border-transparent bg-transparent font-medium text-brand-strong',
        info: 'border-transparent bg-transparent font-medium text-info-strong',
        success:
            'border-transparent bg-transparent font-medium text-success-strong',
        warning:
            'border-transparent bg-transparent font-medium text-warning-strong',
        danger: 'border-transparent bg-transparent font-medium text-danger-strong',
    },
};

export const toneDotClasses: Record<StatusTone, string> = {
    neutral: 'bg-ink-muted',
    brand: 'bg-brand-strong',
    info: 'bg-info-strong',
    success: 'bg-success-strong',
    warning: 'bg-warning-strong',
    danger: 'bg-danger-strong',
};

export const sizeClasses: Record<
    BadgeSize,
    { badge: string; dot: string; icon: string }
> = {
    sm: {
        badge: 'min-h-5 gap-1 px-2 py-0.5 text-[11px]',
        dot: 'h-1.5 w-1.5',
        icon: 'h-3 w-3',
    },
    md: {
        badge: 'min-h-6 gap-1.5 px-2.5 py-0.5 text-xs',
        dot: 'h-1.5 w-1.5',
        icon: 'h-3.5 w-3.5',
    },
    lg: {
        badge: 'min-h-7 gap-2 px-3 py-1 text-sm',
        dot: 'h-2 w-2',
        icon: 'h-4 w-4',
    },
};

export interface CanonicalStatusBadgeProps {
    status: StatusViewModel<CanonicalStatusValue>;
    variant?: BadgeVariant;
    size?: BadgeSize;
    className?: string;
    showDot?: boolean;
    showIcon?: boolean;
    pulse?: boolean;
}

export function CanonicalStatusBadge({
    status,
    variant = 'soft',
    size = 'md',
    className,
    showDot = true,
    showIcon = false,
    pulse,
}: CanonicalStatusBadgeProps) {
    const tone = statusTones[status.value] ?? 'neutral';
    const isLive = pulse ?? liveStatuses.has(status.value);
    const Icon = showIcon ? statusIcons[status.value] : null;
    const sizeConfig = sizeClasses[size];

    return (
        <span
            role="status"
            aria-label={`Status: ${status.label}`}
            className={cn(
                'inline-flex items-center rounded-full font-semibold tracking-wide transition-colors select-none',
                variantToneClasses[variant][tone],
                sizeConfig.badge,
                className,
            )}
        >
            {Icon && (
                <Icon
                    className={cn(
                        sizeConfig.icon,
                        'shrink-0',
                        (status.value === 'processing' ||
                            (isLive && Icon === Loader2)) &&
                            'animate-spin',
                    )}
                    aria-hidden="true"
                    data-testid="status-badge-icon"
                />
            )}

            {!Icon && showDot && (
                <span className="relative flex shrink-0 items-center justify-center">
                    {isLive && (
                        <span
                            className={cn(
                                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                                toneDotClasses[tone],
                            )}
                            data-testid="status-badge-ping"
                        />
                    )}
                    <span
                        className={cn(
                            'relative shrink-0 rounded-full',
                            sizeConfig.dot,
                            toneDotClasses[tone],
                        )}
                        aria-hidden="true"
                    />
                </span>
            )}

            <span className="truncate">{status.label}</span>
        </span>
    );
}
