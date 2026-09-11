import { AlertTriangle, Check, Inbox, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { HTMLMotionProps } from 'motion/react';
import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export * from './ui/button';
export * from './ui/card';
export * from './ui/badge';
export * from './ui/stat';
export * from './ui/table';
export * from './ui/modal';
export * from './ui/form';

export function PageHeading({
    title,
    description,
    actions,
}: {
    title: string;
    description: string;
    actions?: ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-4 border-b border-line px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
            <div className="min-w-0 lg:flex-1">
                <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
                    {title}
                </h1>
                <p className="mt-1 max-w-[70ch] text-sm leading-6 text-ink-soft">
                    {description}
                </p>
            </div>
            {actions && (
                <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:max-w-[55%] lg:shrink">
                    {actions}
                </div>
            )}
        </div>
    );
}

export function ProgressBar({
    value,
    label,
}: {
    value: number;
    label: string;
}) {
    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-ink-soft">
                <span>{label}</span>
                <span>{value}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${value}%` }}
                />
            </div>
        </div>
    );
}

export function DataPair({
    label,
    value,
}: {
    label: string;
    value: ReactNode;
}) {
    return (
        <div className="grid grid-cols-[minmax(7rem,0.72fr)_1.3fr] gap-3 py-2 text-sm">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="min-w-0 font-medium text-ink">{value}</dd>
        </div>
    );
}

export function InlineNotice({
    tone,
    title,
    children,
    action,
    role = 'status',
    className,
}: PropsWithChildren<{
    tone: 'info' | 'warning' | 'success';
    title: string;
    action?: ReactNode;
    role?: string;
    className?: string;
}>) {
    const Icon =
        tone === 'warning' ? AlertTriangle : tone === 'success' ? Check : Info;

    return (
        <div
            role={role}
            className={cn(
                'flex items-start gap-3 rounded-lg p-3 text-sm',
                tone === 'info' && 'bg-brand-soft text-brand-strong',
                tone === 'warning' && 'bg-warning-soft text-warning-strong',
                tone === 'success' && 'bg-success-soft text-success-strong',
                className,
            )}
        >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className="font-semibold">{title}</p>
                <div className="mt-0.5 leading-5 opacity-90">{children}</div>
            </div>
            {action}
        </div>
    );
}

export function EmptyState({
    title,
    message,
    icon: Icon = Inbox,
    primaryAction,
    secondaryAction,
    compact = false,
    announce = false,
    className,
}: {
    title: string;
    message: string;
    icon?: LucideIcon;
    primaryAction?: ReactNode;
    secondaryAction?: ReactNode;
    compact?: boolean;
    announce?: boolean;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center',
                compact ? 'px-4 py-8' : 'min-h-56 px-5 py-10',
                className,
            )}
            role={announce ? 'status' : undefined}
            aria-live={announce ? 'polite' : undefined}
            aria-atomic={announce ? 'true' : undefined}
        >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface-subtle text-ink-soft">
                <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="font-semibold text-ink">{title}</p>
            <p className="mt-1 max-w-sm text-sm leading-6 text-ink-soft">
                {message}
            </p>
            {(primaryAction || secondaryAction) && (
                <div className="mt-5 flex w-full max-w-sm flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:items-center">
                    {primaryAction}
                    {secondaryAction}
                </div>
            )}
        </div>
    );
}

export function ToastStack({
    toasts,
    onDismiss,
}: {
    toasts: Array<{
        id: number;
        tone: 'success' | 'warning' | 'info';
        title: string;
        message: string;
    }>;
    onDismiss: (id: number) => void;
}) {
    const prefersReducedMotion = useReducedMotion() ?? false;

    return (
        <div
            className="fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
            aria-live="polite"
            aria-atomic="false"
        >
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={
                            prefersReducedMotion
                                ? false
                                : { opacity: 0, y: 12, scale: 0.95 }
                        }
                        animate={
                            prefersReducedMotion
                                ? false
                                : { opacity: 1, y: 0, scale: 1 }
                        }
                        exit={
                            prefersReducedMotion
                                ? undefined
                                : { opacity: 0, y: 8, scale: 0.95 }
                        }
                        transition={
                            prefersReducedMotion
                                ? undefined
                                : { duration: 0.18, ease: 'easeOut' }
                        }
                        className="flex items-start gap-3 rounded-xl bg-ink p-4 text-white shadow-lg"
                        role="status"
                    >
                        {toast.tone === 'success' ? (
                            <Check
                                className="mt-0.5 h-4 w-4 shrink-0 text-success-on-dark"
                                aria-hidden="true"
                            />
                        ) : toast.tone === 'warning' ? (
                            <AlertTriangle
                                className="mt-0.5 h-4 w-4 shrink-0 text-warning-on-dark"
                                aria-hidden="true"
                            />
                        ) : (
                            <Info
                                className="mt-0.5 h-4 w-4 shrink-0 text-info-on-dark"
                                aria-hidden="true"
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">
                                {toast.title}
                            </p>
                            <p className="mt-0.5 text-sm leading-5 text-ink-on-dark-muted">
                                {toast.message}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onDismiss(toast.id)}
                            className="-m-2 flex h-10 w-10 items-center justify-center rounded-lg text-ink-on-dark-muted hover:bg-white/10 hover:text-white"
                            aria-label={`Dismiss ${toast.title}`}
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

export function Skeleton({
    className,
    width,
    height,
    style,
    ...props
}: HTMLMotionProps<'div'> & {
    width?: string | number;
    height?: string | number;
}) {
    const prefersReducedMotion = useReducedMotion() ?? false;

    return (
        <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0.4 }}
            animate={
                prefersReducedMotion ? false : { opacity: [0.4, 0.85, 0.4] }
            }
            transition={
                prefersReducedMotion
                    ? undefined
                    : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
            }
            className={cn('rounded-md bg-line-strong/50', className)}
            style={{ width, height, ...style }}
            aria-hidden="true"
            {...props}
        />
    );
}

export { DateTimePicker } from './ui/date-time-picker';

export function PrototypeSandboxBanner({
    surfaceName,
    className,
}: {
    surfaceName?: string;
    className?: string;
}) {
    return (
        <aside
            className={cn(
                'border-b border-warning-strong/30 bg-warning-soft/95 px-4 py-2 text-xs text-warning-strong shadow-xs',
                className,
            )}
            role="status"
            aria-label="Prototype Sandbox Notice"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-warning-strong px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                        Simulation
                    </span>
                    <span className="font-semibold">
                        [Prototype / Sandbox Demo Mode - Read-Only Simulation
                        {surfaceName ? ' - ' + surfaceName : ''}]
                    </span>
                    <span className="hidden text-ink-soft md:inline">
                        — Actions simulated in local memory. No database records
                        modified.
                    </span>
                </div>
                <a
                    href="/operations"
                    className="inline-flex items-center gap-1 font-semibold text-brand-strong underline hover:text-brand"
                >
                    Go to Live Operations Workspace →
                </a>
            </div>
        </aside>
    );
}
