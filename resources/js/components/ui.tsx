import { AlertTriangle, Check, Inbox, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { HTMLMotionProps } from 'motion/react';
import type {
    ButtonHTMLAttributes,
    HTMLAttributes,
    PropsWithChildren,
    ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import type {
    PrototypeDispatchStatusLabel,
    TelemetryFreshness,
} from '@/types/operations';

export function Button({
    className,
    variant = 'secondary',
    size = 'md',
    type = 'button',
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
    size?: 'sm' | 'md' | 'icon';
}) {
    return (
        <button
            type={type}
            className={cn(
                'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
                variant === 'primary' &&
                    'bg-brand text-ink hover:bg-brand-strong hover:text-white active:bg-brand-strong active:text-white',
                variant === 'secondary' &&
                    'border border-line-strong bg-surface text-ink hover:bg-surface-subtle',
                variant === 'quiet' &&
                    'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                variant === 'danger' &&
                    'bg-danger text-danger-contrast hover:bg-danger-strong',
                size === 'sm' && 'min-h-10 px-3 text-sm',
                size === 'md' && 'px-4 text-sm',
                size === 'icon' && 'h-11 w-11 p-0',
                className,
            )}
            {...props}
        />
    );
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <section
            className={cn(
                'rounded-xl border border-line bg-surface',
                className,
            )}
            {...props}
        />
    );
}

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
        <div className="flex flex-col gap-4 border-b border-line px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
            <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
                    {title}
                </h1>
                <p className="mt-1 max-w-[70ch] text-sm leading-6 text-ink-soft">
                    {description}
                </p>
            </div>
            {actions && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}

const statusClasses: Record<string, string> = {
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

export function StatusBadge({
    status,
    className,
}: {
    status: PrototypeDispatchStatusLabel | TelemetryFreshness | string;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                statusClasses[status] ?? 'bg-surface-subtle text-ink-soft',
                className,
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    'h-1.5 w-1.5 rounded-full bg-current',
                    status === 'Offline' && 'rounded-none',
                )}
            />
            {status}
        </span>
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
}: PropsWithChildren<{
    tone: 'info' | 'warning' | 'success';
    title: string;
    action?: ReactNode;
}>) {
    const Icon =
        tone === 'warning' ? AlertTriangle : tone === 'success' ? Check : Info;

    return (
        <div
            className={cn(
                'flex items-start gap-3 rounded-lg p-3 text-sm',
                tone === 'info' && 'bg-brand-soft text-brand-strong',
                tone === 'warning' && 'bg-warning-soft text-warning-strong',
                tone === 'success' && 'bg-success-soft text-success-strong',
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
