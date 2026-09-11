import { router } from '@inertiajs/react';
import {
    AlertTriangle,
    Bell,
    CheckCircle2,
    ClipboardList,
    Fuel,
    Inbox,
    ShieldAlert,
    UserCheck,
    Wrench,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
    NotificationViewModel,
    WorkspaceSection,
} from '@/types/workspace';

export type NotificationCategory =
    'all' | 'dispatch' | 'safety' | 'fuel' | 'system';
type NotificationFilter = 'all' | 'unread';
export type NotificationTone = 'info' | 'warning' | 'success' | 'critical';

export type NotificationPresentation = {
    title: string;
    message: string;
    tone: NotificationTone;
    category: 'dispatch' | 'safety' | 'fuel' | 'system';
    Icon: LucideIcon;
};

export const toneClasses: Record<NotificationTone, string> = {
    info: 'bg-brand-soft text-brand-strong',
    warning: 'bg-warning-soft text-warning-strong',
    success: 'bg-success-soft text-green-800',
    critical: 'bg-danger-soft text-danger',
};

export function NotificationCenterPopover({
    notifications = [],
    onViewAll,
    onNavigate,
}: {
    notifications?: NotificationViewModel[];
    onViewAll: () => void;
    onNavigate?: (section: WorkspaceSection) => void;
}) {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState<NotificationFilter>('all');
    const [readOverrides, setReadOverrides] = useState<Set<string>>(
        () => new Set(),
    );
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const wasOpenRef = useRef(false);

    const isUnread = (notification: NotificationViewModel) =>
        notification.status !== 'read' &&
        !notification.read_at &&
        !readOverrides.has(notification.id);

    const unreadCount = notifications.filter(isUnread).length;
    const visibleNotifications = notifications
        .filter((notification) =>
            filter === 'unread' ? isUnread(notification) : true,
        )
        .slice(0, 6);

    useEffect(() => {
        if (!open) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
            }
        };

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;

            if (
                !panelRef.current?.contains(target) &&
                !triggerRef.current?.contains(target)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('pointerdown', handlePointerDown);
        window.requestAnimationFrame(() => closeRef.current?.focus());

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [open]);

    useEffect(() => {
        if (wasOpenRef.current && !open) {
            triggerRef.current?.focus();
        }

        wasOpenRef.current = open;
    }, [open]);

    const toggleOpen = () => {
        setOpen((current) => !current);
    };

    const markAsRead = (notification: NotificationViewModel) => {
        if (!isUnread(notification) || processingId !== null) {
            return;
        }

        setReadOverrides((current) => {
            const next = new Set(current);
            next.add(notification.id);

            return next;
        });

        setProcessingId(notification.id);
        setAnnouncement('Marking notification as read.');

        router.post(
            `/operations/notifications/${notification.id}/read`,
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () =>
                    setAnnouncement('Notification marked as read.'),
                onError: () => {
                    setReadOverrides((current) => {
                        const next = new Set(current);
                        next.delete(notification.id);

                        return next;
                    });

                    setAnnouncement(
                        'Notification could not be marked as read. Try again.',
                    );
                },
                onFinish: () => setProcessingId(null),
            },
        );
    };

    const handleViewAll = () => {
        setOpen(false);
        onViewAll();
    };

    const handleNotificationClick = (notification: NotificationViewModel) => {
        if (isUnread(notification)) {
            markAsRead(notification);
        }

        setOpen(false);

        if (!onNavigate) {
            return;
        }

        const category = categorizeNotification(notification);

        if (notification.dispatch_job || category === 'dispatch') {
            onNavigate('dispatch');
        } else if (category === 'fuel') {
            onNavigate('fuel');
        } else if (category === 'safety') {
            onNavigate('sos');
        }
    };

    const panel = (
        <div
            id="notification-center-popover"
            ref={panelRef}
            role="dialog"
            aria-labelledby="notification-center-title"
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-[80] max-h-[82vh] overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-[0_18px_50px_rgba(15,23,42,0.18)] sm:inset-x-auto sm:top-[4.75rem] sm:right-4 sm:bottom-auto sm:max-h-[calc(100vh-6rem)] sm:w-[min(26rem,calc(100vw-2rem))] sm:rounded-xl"
        >
            <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
                <div>
                    <h2
                        id="notification-center-title"
                        className="text-sm font-semibold text-ink"
                    >
                        Notifications
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-soft">
                        {unreadCount === 0
                            ? 'You are all caught up.'
                            : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
                    </p>
                </div>
                <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                    aria-label="Close notifications"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>

            <div className="flex items-center gap-1 border-b border-line px-3 py-2">
                {(['all', 'unread'] as const).map((option) => {
                    const selected = filter === option;
                    const label = option === 'all' ? 'All' : 'Unread';

                    return (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setFilter(option)}
                            aria-pressed={selected}
                            className={`min-h-11 min-w-11 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                                selected
                                    ? 'bg-brand-soft text-brand-strong'
                                    : 'text-ink-soft hover:bg-surface-subtle hover:text-ink'
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {visibleNotifications.length === 0 ? (
                <div className="px-6 py-9 text-center">
                    <Inbox
                        className="mx-auto h-8 w-8 text-ink-soft"
                        aria-hidden="true"
                    />
                    <p className="mt-3 text-sm font-semibold text-ink">
                        {filter === 'unread'
                            ? 'No unread notifications'
                            : 'No notifications yet'}
                    </p>
                    <p className="mt-1 text-sm leading-5 text-ink-soft">
                        Dispatch assignments, delays, and completions will
                        appear here.
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-line">
                    {visibleNotifications.map((notification) => {
                        const presentation = presentNotification(notification);
                        const unread = isUnread(notification);

                        return (
                            <li
                                key={notification.id}
                                className={`group px-4 py-3 transition-colors ${unread ? 'bg-brand-soft/25' : 'hover:bg-surface-subtle/50'}`}
                            >
                                <div className="flex items-start gap-3">
                                    <span
                                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClasses[presentation.tone]}`}
                                    >
                                        <presentation.Icon
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() =>
                                                handleNotificationClick(
                                                    notification,
                                                )
                                            }
                                            onKeyDown={(e) => {
                                                if (
                                                    e.key === 'Enter' ||
                                                    e.key === ' '
                                                ) {
                                                    e.preventDefault();
                                                    handleNotificationClick(
                                                        notification,
                                                    );
                                                }
                                            }}
                                            className="cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-ink group-hover:text-brand-strong">
                                                        {presentation.title}
                                                    </p>
                                                    {notification.dispatch_job && (
                                                        <p className="mt-0.5 truncate font-mono text-xs text-ink-soft">
                                                            {
                                                                notification
                                                                    .dispatch_job
                                                                    .reference
                                                            }
                                                        </p>
                                                    )}
                                                </div>
                                                {unread && (
                                                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-strong" />
                                                )}
                                            </div>
                                            <p className="mt-1 text-sm leading-5 text-ink">
                                                {presentation.message}
                                            </p>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between gap-2">
                                            <p
                                                className="text-xs text-ink-soft"
                                                title={exactTimestamp(
                                                    notification.created_at,
                                                )}
                                            >
                                                {formatRelativeTime(
                                                    notification.created_at,
                                                )}
                                                {unread && (
                                                    <span className="sr-only">
                                                        {' '}
                                                        Unread.
                                                    </span>
                                                )}
                                            </p>
                                            {unread && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsRead(
                                                            notification,
                                                        );
                                                    }}
                                                    disabled={
                                                        processingId !== null
                                                    }
                                                    className="inline-flex min-h-7 items-center rounded px-2 text-xs font-semibold text-brand-strong hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {processingId ===
                                                    notification.id
                                                        ? 'Marking…'
                                                        : 'Mark read'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="border-t border-line px-4 py-3">
                <button
                    type="button"
                    onClick={handleViewAll}
                    className="flex min-h-11 w-full items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                    View all notifications
                </button>
            </div>
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {announcement}
            </div>
        </div>
    );

    const portalContent = (
        <>
            <div
                className="fixed inset-0 z-[79] bg-ink/20 sm:hidden"
                aria-hidden="true"
                onPointerDown={() => setOpen(false)}
            />
            {panel}
        </>
    );

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={toggleOpen}
                className="relative flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                aria-label={
                    unreadCount > 0
                        ? `Notifications, ${unreadCount} unread`
                        : 'Notifications'
                }
                aria-expanded={open}
                aria-controls="notification-center-popover"
                title="Notifications"
            >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {unreadCount > 0 && (
                    <>
                        <span
                            aria-hidden="true"
                            className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-none font-bold text-brand-contrast"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                        <span className="sr-only">
                            {unreadCount} unread notification
                            {unreadCount === 1 ? '' : 's'}
                        </span>
                    </>
                )}
            </button>
            {open && typeof document !== 'undefined'
                ? createPortal(portalContent, document.body)
                : null}
        </>
    );
}

export function categorizeNotification(
    notification: NotificationViewModel,
): 'dispatch' | 'safety' | 'fuel' | 'system' {
    const rawCategory = stringValue(notification.data.category);

    if (
        rawCategory === 'dispatch' ||
        rawCategory === 'safety' ||
        rawCategory === 'fuel' ||
        rawCategory === 'system'
    ) {
        return rawCategory;
    }

    const event =
        stringValue(notification.data.event) ?? notification.type ?? '';

    if (
        event.startsWith('dispatch.') ||
        event.startsWith('assignment.') ||
        event.startsWith('schedule.')
    ) {
        return 'dispatch';
    }

    if (
        event.startsWith('safety.') ||
        event.startsWith('inspection.') ||
        event.startsWith('maintenance.') ||
        event.startsWith('incident.')
    ) {
        return 'safety';
    }

    if (event.startsWith('fuel.')) {
        return 'fuel';
    }

    return 'system';
}

export function presentNotification(
    notification: NotificationViewModel,
): NotificationPresentation {
    const event =
        stringValue(notification.data.event) ?? notification.type ?? '';
    const reference = notification.dispatch_job?.reference ?? 'the dispatch';
    const message =
        stringValue(notification.data.message) ??
        stringValue(notification.data.reason) ??
        `There is an update for ${reference}.`;

    const category = categorizeNotification(notification);

    if (event === 'dispatch.delayed') {
        return {
            title: 'Dispatch Delayed',
            message,
            tone: 'warning',
            category: 'dispatch',
            Icon: AlertTriangle,
        };
    }

    if (event === 'dispatch.completed') {
        return {
            title: 'Dispatch Completed',
            message,
            tone: 'success',
            category: 'dispatch',
            Icon: CheckCircle2,
        };
    }

    if (event === 'dispatch.assigned') {
        return {
            title: 'New Dispatch Assignment',
            message,
            tone: 'info',
            category: 'dispatch',
            Icon: ClipboardList,
        };
    }

    if (category === 'fuel') {
        return {
            title: 'Fuel Request Update',
            message,
            tone: 'info',
            category: 'fuel',
            Icon: Fuel,
        };
    }

    if (category === 'safety') {
        return {
            title: 'Safety & Inspection Alert',
            message,
            tone:
                event.includes('fail') || event.includes('block')
                    ? 'critical'
                    : 'warning',
            category: 'safety',
            Icon: event.includes('maintenance') ? Wrench : ShieldAlert,
        };
    }

    if (event.includes('user') || event.includes('access')) {
        return {
            title: 'User & Access Event',
            message,
            tone: 'info',
            category: 'system',
            Icon: UserCheck,
        };
    }

    return {
        title: 'Operations Update',
        message,
        tone: 'info',
        category,
        Icon: Bell,
    };
}

function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export function formatRelativeTime(value: string | null): string {
    if (!value) {
        return 'Time unavailable';
    }

    const timestamp = new Date(value).getTime();

    if (Number.isNaN(timestamp)) {
        return 'Time unavailable';
    }

    const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - timestamp) / 1000),
    );

    if (elapsedSeconds < 60) {
        return 'Just now';
    }

    if (elapsedSeconds < 3600) {
        return `${Math.floor(elapsedSeconds / 60)}m ago`;
    }

    if (elapsedSeconds < 86400) {
        return `${Math.floor(elapsedSeconds / 3600)}h ago`;
    }

    return new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year:
            new Date(timestamp).getFullYear() === new Date().getFullYear()
                ? undefined
                : 'numeric',
    });
}

export function exactTimestamp(value: string | null): string {
    if (!value || Number.isNaN(new Date(value).getTime())) {
        return 'Exact time unavailable';
    }

    return new Date(value).toLocaleString();
}
