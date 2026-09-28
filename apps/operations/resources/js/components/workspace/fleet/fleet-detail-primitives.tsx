import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import React from 'react';
import { cn } from '@/lib/utils';

export type FleetPillTone =
    'success' | 'warning' | 'danger' | 'brand' | 'neutral';

const pillToneClasses: Record<FleetPillTone, string> = {
    success: 'bg-success-soft text-success-strong',
    warning: 'bg-warning-soft text-warning-strong',
    danger: 'bg-danger-soft text-danger-strong',
    brand: 'bg-brand-soft text-brand-strong',
    neutral: 'bg-surface-subtle text-ink-soft',
};

/** Compact status chip shared by every asset detail tab. */
export function FleetPill({
    tone = 'neutral',
    icon: Icon,
    dot = false,
    children,
    className,
}: {
    tone?: FleetPillTone;
    icon?: LucideIcon;
    dot?: boolean;
    children: ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                pillToneClasses[tone],
                className,
            )}
        >
            {Icon ? (
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : dot ? (
                <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                    aria-hidden="true"
                />
            ) : null}
            {children}
        </span>
    );
}

/** Title, one-line description and an optional primary action for a tab. */
export function FleetSectionHeader({
    id,
    title,
    description,
    action,
}: {
    id?: string;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1 basis-64">
                <h3 id={id} className="text-base font-semibold text-ink">
                    {title}
                </h3>
                {description && (
                    <p className="mt-1 max-w-2xl text-sm leading-5 text-ink-soft">
                        {description}
                    </p>
                )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

/** Empty state with an icon, a message and an optional next step. */
export function FleetEmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: LucideIcon;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong/70 bg-surface-subtle/40 px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink-soft shadow-2xs ring-1 ring-line">
                <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h4 className="mt-3 text-sm font-semibold text-ink">{title}</h4>
            {description && (
                <p className="mt-1 max-w-sm text-xs leading-5 text-ink-soft">
                    {description}
                </p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
