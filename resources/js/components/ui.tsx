import { AlertTriangle, Check, Inbox, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
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
                    'bg-brand text-brand-contrast hover:bg-brand-strong active:bg-brand-strong',
                variant === 'secondary' &&
                    'border border-line-strong bg-surface text-ink hover:bg-surface-subtle',
                variant === 'quiet' &&
                    'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                variant === 'danger' && 'bg-danger text-white hover:bg-red-700',
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
    Draft: 'bg-surface-subtle text-ink-soft',
    Scheduled: 'bg-brand-soft text-brand-strong',
    Dispatched: 'bg-brand-soft text-brand-strong',
    'En route': 'bg-brand-soft text-brand-strong',
    Arrived: 'bg-success-soft text-green-800',
    'In progress': 'bg-success-soft text-green-800',
    'On hold': 'bg-warning-soft text-warning-strong',
    Completed: 'bg-success-soft text-green-800',
    Cancelled: 'bg-danger-soft text-danger',
    Live: 'bg-success-soft text-green-800',
    Delayed: 'bg-warning-soft text-warning-strong',
    Stale: 'bg-warning-soft text-warning-strong',
    Offline: 'bg-surface-subtle text-ink-soft',
    Available: 'bg-success-soft text-green-800',
    Assigned: 'bg-brand-soft text-brand-strong',
    Working: 'bg-success-soft text-green-800',
    Maintenance: 'bg-warning-soft text-warning-strong',
    Pending: 'bg-warning-soft text-warning-strong',
    Approved: 'bg-success-soft text-green-800',
    Rejected: 'bg-danger-soft text-danger',
    Dispensed: 'bg-brand-soft text-brand-strong',
    Priority: 'bg-warning-soft text-warning-strong',
    Emergency: 'bg-danger-soft text-danger',
    Routine: 'bg-surface-subtle text-ink-soft',
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
                tone === 'success' && 'bg-success-soft text-green-900',
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
                        initial={{ opacity: 0, y: 12, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="flex items-start gap-3 rounded-xl bg-ink p-4 text-white shadow-lg"
                        role="status"
                    >
                        {toast.tone === 'success' ? (
                            <Check
                                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
                                aria-hidden="true"
                            />
                        ) : toast.tone === 'warning' ? (
                            <AlertTriangle
                                className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
                                aria-hidden="true"
                            />
                        ) : (
                            <Info
                                className="mt-0.5 h-4 w-4 shrink-0 text-blue-300"
                                aria-hidden="true"
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">
                                {toast.title}
                            </p>
                            <p className="mt-0.5 text-sm leading-5 text-slate-300">
                                {toast.message}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onDismiss(toast.id)}
                            className="-m-2 flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
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
    return (
        <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 0.85, 0.4] }}
            transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: 'easeInOut',
            }}
            className={cn('rounded-md bg-line-strong/50', className)}
            style={{ width, height, ...style }}
            aria-hidden="true"
            {...props}
        />
    );
}

export { DateTimePicker } from './ui/date-time-picker';
