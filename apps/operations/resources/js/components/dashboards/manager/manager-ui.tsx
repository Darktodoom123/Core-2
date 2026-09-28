import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SwatchTone =
    'success' | 'info' | 'warning' | 'warning-hatched' | 'danger' | 'neutral';

const SWATCH_CLASSES: Record<Exclude<SwatchTone, 'warning-hatched'>, string> = {
    success: 'bg-success',
    info: 'bg-info',
    warning: 'bg-warning',
    danger: 'bg-danger',
    neutral: 'bg-line-strong',
};

const HATCHED_WARNING: CSSProperties = {
    backgroundImage:
        'repeating-linear-gradient(135deg, var(--color-warning) 0 3px, var(--color-warning-soft) 3px 6px)',
};

/** Faint hatching for filled areas that also carry text, such as timeline bars. */
export const SOFT_WARNING_HATCH: CSSProperties = {
    backgroundImage:
        'repeating-linear-gradient(135deg, color-mix(in oklab, var(--color-warning) 24%, transparent) 0 3px, transparent 3px 8px)',
};

/** Solid or hatched fill; hatching keeps "needs resources" distinct without colour. */
export function swatchFill(tone: SwatchTone): {
    className: string;
    style?: CSSProperties;
} {
    return tone === 'warning-hatched'
        ? { className: 'bg-warning-soft', style: HATCHED_WARNING }
        : { className: SWATCH_CLASSES[tone] };
}

export function LegendSwatch({ tone }: { tone: SwatchTone }) {
    const fill = swatchFill(tone);

    return (
        <span
            className={cn(
                'inline-block size-2 shrink-0 rounded-[2px]',
                fill.className,
            )}
            style={fill.style}
            aria-hidden="true"
        />
    );
}

export interface Segment {
    key: string;
    count: number;
    tone: SwatchTone;
}

/** Proportional bar; always paired with a text legend by callers. */
export function SegmentBar({
    segments,
    className,
}: {
    segments: Segment[];
    className?: string;
}) {
    const visible = segments.filter((segment) => segment.count > 0);

    return (
        <div
            className={cn(
                'flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-surface-subtle',
                className,
            )}
            aria-hidden="true"
        >
            {visible.map((segment) => {
                const fill = swatchFill(segment.tone);

                return (
                    <span
                        key={segment.key}
                        className={cn('h-full', fill.className)}
                        style={{ ...fill.style, flexGrow: segment.count }}
                    />
                );
            })}
        </div>
    );
}

export function FilterGroup({
    label,
    children,
    className,
}: {
    label: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            role="group"
            aria-label={label}
            className={cn(
                'flex flex-wrap items-center gap-0.5 rounded-lg bg-surface-subtle p-0.5 text-xs',
                className,
            )}
        >
            {children}
        </div>
    );
}

/**
 * Toggle button whose accessible name reads "Label (count)" while the count
 * is shown as a compact badge.
 */
export function FilterButton({
    label,
    count,
    pressed,
    onClick,
    emphasis = 'neutral',
}: {
    label: string;
    count: number;
    pressed: boolean;
    onClick: () => void;
    emphasis?: 'neutral' | 'danger';
}) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            aria-label={`${label} (${count})`}
            onClick={onClick}
            className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden md:min-h-9',
                pressed
                    ? 'bg-surface font-semibold text-ink shadow-xs ring-1 ring-line'
                    : 'text-ink-soft hover:text-ink',
            )}
        >
            {label}
            <span
                aria-hidden="true"
                className={cn(
                    'inline-grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full px-1 text-[11px] font-semibold tabular-nums',
                    emphasis === 'danger' && count > 0
                        ? 'bg-danger text-danger-contrast'
                        : pressed
                          ? 'bg-ink text-surface'
                          : 'bg-ink/[0.07] text-ink-soft',
                )}
            >
                {count}
            </span>
        </button>
    );
}

export function SourceChip({
    label,
    className,
}: {
    label: 'Service' | 'Rental' | 'Manual';
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex h-5 shrink-0 items-center rounded-[5px] border px-1.5 text-[11px] font-semibold',
                label === 'Rental'
                    ? 'border-info/30 bg-info-soft text-info-strong'
                    : label === 'Service'
                      ? 'border-brand-strong/25 bg-brand-soft/60 text-brand-strong'
                      : 'border-line bg-surface text-ink-soft',
                className,
            )}
        >
            {label}
        </span>
    );
}
