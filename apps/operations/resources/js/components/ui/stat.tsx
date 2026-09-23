import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import {
    forwardRef,
    type HTMLAttributes,
    type KeyboardEvent,
    type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './card';

export const statVariants = cva('overflow-hidden transition-all', {
    variants: {
        size: {
            sm: '',
            md: '',
            lg: '',
        },
        tone: {
            default: 'border-line bg-surface',
            brand: 'border-brand-strong/40 bg-brand-soft/20',
            warning: 'border-warning/30 bg-warning-soft/20',
            success: 'border-success/30 bg-success-soft/20',
            danger: 'border-danger/30 bg-danger-soft/20',
            info: 'border-info/30 bg-info-soft/20',
        },
    },
    defaultVariants: {
        size: 'md',
        tone: 'default',
    },
});

const toneSelectedClasses: Record<string, string> = {
    default: 'border-line-strong bg-surface-subtle ring-2 ring-line-strong/30',
    brand: 'border-brand-strong bg-brand-soft/40 ring-2 ring-brand-strong/30',
    warning: 'border-warning bg-warning-soft/40 ring-2 ring-warning/30',
    success: 'border-success bg-success-soft/40 ring-2 ring-success/30',
    danger: 'border-danger bg-danger-soft/40 ring-2 ring-danger/30',
    info: 'border-info bg-info-soft/40 ring-2 ring-info/30',
};

const toneValueClasses: Record<string, string> = {
    default: 'text-ink',
    brand: 'text-ink',
    warning: 'text-warning-strong',
    success: 'text-success-strong',
    danger: 'text-danger-strong',
    info: 'text-info-strong',
};

const toneIconClasses: Record<string, string> = {
    default: 'bg-surface-subtle text-ink-soft',
    brand: 'bg-brand-soft text-brand-strong',
    warning: 'bg-warning-soft text-warning-strong',
    success: 'bg-success-soft text-success-strong',
    danger: 'bg-danger-soft text-danger-strong',
    info: 'bg-info-soft text-info-strong',
};

const sizePaddingClasses = {
    sm: 'p-3.5 sm:p-4',
    md: 'p-4 sm:p-5',
    lg: 'p-5 sm:p-6',
};

export interface StatProps
    extends Omit<HTMLAttributes<HTMLDivElement>, 'size'>,
        VariantProps<typeof statVariants> {
    title: string;
    value: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon;
    indicator?: ReactNode;
    selected?: boolean;
    interactive?: boolean;
    valueClassName?: string;
    delta?: {
        value: string | number;
        trend?: 'up' | 'down' | 'neutral';
        label?: string;
    };
}

export const Stat = forwardRef<HTMLDivElement, StatProps>(
    (
        {
            className,
            title,
            value,
            description,
            icon: Icon,
            indicator,
            selected = false,
            interactive,
            valueClassName,
            delta,
            size = 'md',
            tone = 'default',
            onClick,
            onKeyDown,
            ...props
        },
        ref,
    ) => {
        const isInteractive = interactive ?? Boolean(onClick);
        const resolvedTone = tone ?? 'default';
        const resolvedSize = size ?? 'md';

        const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
            if (isInteractive && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                onClick?.(
                    event as unknown as React.MouseEvent<
                        HTMLDivElement,
                        MouseEvent
                    >,
                );
            }

            onKeyDown?.(event);
        };

        return (
            <Card
                ref={ref}
                role={isInteractive ? 'button' : undefined}
                tabIndex={isInteractive ? 0 : undefined}
                aria-pressed={isInteractive ? selected : undefined}
                onClick={onClick}
                onKeyDown={handleKeyDown}
                className={cn(
                    statVariants({ size: resolvedSize, tone: resolvedTone }),
                    isInteractive &&
                        'cursor-pointer transition-all hover:bg-surface-subtle active:scale-[0.99] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-strong/50',
                    selected && toneSelectedClasses[resolvedTone],
                    className,
                )}
                {...props}
            >
                <CardContent className={sizePaddingClasses[resolvedSize]}>
                    <div className="flex items-center justify-between gap-2">
                        <span
                            className={cn(
                                'text-xs font-semibold uppercase tracking-wider',
                                resolvedTone === 'default'
                                    ? 'text-ink-soft'
                                    : toneValueClasses[resolvedTone],
                            )}
                        >
                            {title}
                        </span>
                        <div className="flex items-center gap-1.5">
                            {indicator}
                            {Icon && (
                                <span
                                    className={cn(
                                        'flex h-8 w-8 items-center justify-center rounded-lg',
                                        toneIconClasses[resolvedTone],
                                    )}
                                >
                                    <Icon
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="mt-2 flex items-baseline gap-2">
                        <div
                            className={cn(
                                'font-variant-numeric text-2xl font-bold tracking-tight sm:text-3xl',
                                valueClassName ??
                                    (resolvedTone === 'default' ||
                                    resolvedTone === 'brand'
                                        ? 'text-ink'
                                        : toneValueClasses[resolvedTone]),
                            )}
                        >
                            {value}
                        </div>

                        {delta && (
                            <span
                                className={cn(
                                    'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold',
                                    delta.trend === 'up' &&
                                        'bg-success-soft text-success-strong',
                                    delta.trend === 'down' &&
                                        'bg-danger-soft text-danger-strong',
                                    (!delta.trend ||
                                        delta.trend === 'neutral') &&
                                        'bg-surface-subtle text-ink-soft',
                                )}
                            >
                                {delta.trend === 'up' && '↑ '}
                                {delta.trend === 'down' && '↓ '}
                                {delta.value}
                            </span>
                        )}
                    </div>

                    {description && (
                        <p className="mt-1 text-xs text-ink-soft">
                            {description}
                        </p>
                    )}
                </CardContent>
            </Card>
        );
    },
);

Stat.displayName = 'Stat';

export const StatCard = Stat;
