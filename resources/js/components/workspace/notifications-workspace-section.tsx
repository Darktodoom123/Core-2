import { router } from '@inertiajs/react';
import {
    Bell,
    CheckCheck,
    CheckCircle2,
    Filter,
    Search,
    ShieldAlert,
    Truck,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import {
    categorizeNotification,
    exactTimestamp,
    formatRelativeTime,
    presentNotification,
    toneClasses,
} from '@/components/workspace/notification-center-popover';
import type { NotificationCategory } from '@/components/workspace/notification-center-popover';
import { cn } from '@/lib/utils';
import type { NotificationViewModel } from '@/types/workspace';

export function NotificationsSurface({
    notifications = [],
}: {
    notifications?: NotificationViewModel[];
}) {
    const [categoryFilter, setCategoryFilter] =
        useState<NotificationCategory>('all');
    const [readFilter, setReadFilter] = useState<'all' | 'unread'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [markingAllAsRead, setMarkingAllAsRead] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const isUnread = (n: NotificationViewModel) =>
        n.status !== 'read' && !n.read_at;

    const stats = useMemo(() => {
        const total = notifications.length;
        const unread = notifications.filter(isUnread).length;
        const dispatch = notifications.filter(
            (n) => categorizeNotification(n) === 'dispatch',
        ).length;
        const safety = notifications.filter(
            (n) => categorizeNotification(n) === 'safety',
        ).length;
        const fuel = notifications.filter(
            (n) => categorizeNotification(n) === 'fuel',
        ).length;
        const system = notifications.filter(
            (n) => categorizeNotification(n) === 'system',
        ).length;

        return { total, unread, dispatch, safety, fuel, system };
    }, [notifications]);

    const filteredNotifications = useMemo(() => {
        return notifications.filter((n) => {
            if (readFilter === 'unread' && !isUnread(n)) {
                return false;
            }

            if (categoryFilter !== 'all') {
                const category = categorizeNotification(n);

                if (category !== categoryFilter) {
                    return false;
                }
            }

            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase().trim();
                const presentation = presentNotification(n);
                const title = presentation.title.toLowerCase();
                const message = presentation.message.toLowerCase();
                const ref = n.dispatch_job?.reference?.toLowerCase() ?? '';

                return (
                    title.includes(query) ||
                    message.includes(query) ||
                    ref.includes(query)
                );
            }

            return true;
        });
    }, [notifications, categoryFilter, readFilter, searchQuery]);

    const markAsRead = (id: string) => {
        setProcessingId(id);
        router.post(
            `/operations/notifications/${id}/read`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setProcessingId(null),
            },
        );
    };

    const markAllAsRead = () => {
        const unreadItems = notifications.filter(isUnread);

        if (unreadItems.length === 0) {
            return;
        }

        setMarkingAllAsRead(true);
        // Mark each unread notification or use batch if available
        Promise.all(
            unreadItems.map((item) =>
                router.post(
                    `/operations/notifications/${item.id}/read`,
                    {},
                    { preserveScroll: true },
                ),
            ),
        ).finally(() => {
            setMarkingAllAsRead(false);
        });
    };

    return (
        <div>
            <PageHeading
                title="System & dispatch notifications"
                description="Track live operational alerts, schedule updates, dispatch assignments, safety events, and fuel authorization notices."
            />
            <div className="space-y-6 p-4 md:p-6">
                {/* Stats Header Bar */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-ink-soft">
                                Total Alerts
                            </span>
                            <Bell className="h-4 w-4 text-brand-strong" />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-ink">
                            {stats.total}
                        </p>
                    </div>

                    <div className="rounded-xl border border-warning/30 bg-warning-soft/30 p-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-warning-strong">
                                Unread
                            </span>
                            <span className="h-2 w-2 rounded-full bg-warning-strong" />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-warning-strong">
                            {stats.unread}
                        </p>
                    </div>

                    <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-ink-soft">
                                Dispatch Events
                            </span>
                            <Truck className="h-4 w-4 text-brand-strong" />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-ink">
                            {stats.dispatch}
                        </p>
                    </div>

                    <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-ink-soft">
                                Safety & Maintenance
                            </span>
                            <ShieldAlert className="h-4 w-4 text-warning-strong" />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-ink">
                            {stats.safety}
                        </p>
                    </div>
                </div>

                {/* Filter and Action Bar */}
                <div className="flex flex-col gap-4 border-b border-line pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Category filter pills */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="mr-1 flex items-center text-xs font-medium text-ink-soft">
                                <Filter className="mr-1 h-3.5 w-3.5" />
                                Category:
                            </span>
                            {(
                                [
                                    {
                                        id: 'all',
                                        label: 'All Categories',
                                        count: stats.total,
                                    },
                                    {
                                        id: 'dispatch',
                                        label: 'Dispatch',
                                        count: stats.dispatch,
                                    },
                                    {
                                        id: 'safety',
                                        label: 'Safety',
                                        count: stats.safety,
                                    },
                                    {
                                        id: 'fuel',
                                        label: 'Fuel',
                                        count: stats.fuel,
                                    },
                                    {
                                        id: 'system',
                                        label: 'System',
                                        count: stats.system,
                                    },
                                ] as const
                            ).map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setCategoryFilter(cat.id)}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                                        categoryFilter === cat.id
                                            ? 'bg-brand-strong text-white shadow-sm'
                                            : 'bg-surface-subtle text-ink-soft hover:bg-surface-subtle/80 hover:text-ink',
                                    )}
                                >
                                    <span>{cat.label}</span>
                                    <span
                                        className={cn(
                                            'py-0.2 rounded-full px-1.5 text-[10px] font-semibold',
                                            categoryFilter === cat.id
                                                ? 'bg-white/20 text-white'
                                                : 'bg-surface text-ink-soft',
                                        )}
                                    >
                                        {cat.count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Read status filter and Bulk Read Action */}
                        <div className="flex items-center gap-2">
                            <div className="inline-flex rounded-lg border border-line p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setReadFilter('all')}
                                    className={cn(
                                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                        readFilter === 'all'
                                            ? 'bg-brand-soft text-brand-strong'
                                            : 'text-ink-soft hover:text-ink',
                                    )}
                                >
                                    All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setReadFilter('unread')}
                                    className={cn(
                                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                        readFilter === 'unread'
                                            ? 'bg-brand-soft text-brand-strong'
                                            : 'text-ink-soft hover:text-ink',
                                    )}
                                >
                                    Unread ({stats.unread})
                                </button>
                            </div>

                            {stats.unread > 0 && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={markAllAsRead}
                                    disabled={markingAllAsRead}
                                >
                                    <CheckCheck className="mr-1.5 h-3.5 w-3.5 text-success-strong" />
                                    {markingAllAsRead
                                        ? 'Marking all…'
                                        : 'Mark all as read'}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Search query */}
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search notifications by keyword or reference…"
                            className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-8 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-soft hover:text-ink"
                                aria-label="Clear search"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Notifications List */}
                {notifications.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Bell}
                            title="No notifications"
                            message="Alerts regarding assigned jobs, schedule changes, safety events, and completion updates will appear here."
                        />
                    </Panel>
                ) : filteredNotifications.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Filter}
                            title="No matching notifications"
                            message="No notifications match the active category, read status, or search query."
                        />
                    </Panel>
                ) : (
                    <Panel className="overflow-hidden">
                        <ul className="divide-y divide-line">
                            {filteredNotifications.map((n) => {
                                const unread = isUnread(n);
                                const presentation = presentNotification(n);
                                const Icon = presentation.Icon;

                                return (
                                    <li
                                        key={n.id}
                                        className={cn(
                                            'flex flex-wrap items-start justify-between gap-4 p-4 transition-colors',
                                            unread
                                                ? 'bg-brand-soft/25'
                                                : 'hover:bg-surface-subtle/40',
                                        )}
                                    >
                                        <div className="flex min-w-0 flex-1 items-start gap-3.5">
                                            <span
                                                className={cn(
                                                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-xs',
                                                    toneClasses[
                                                        presentation.tone
                                                    ],
                                                )}
                                            >
                                                <Icon
                                                    className="h-4 w-4"
                                                    aria-hidden="true"
                                                />
                                            </span>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold text-ink">
                                                        {presentation.title}
                                                    </span>

                                                    {/* Category badge */}
                                                    <span className="inline-flex items-center rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-ink-soft uppercase">
                                                        {presentation.category}
                                                    </span>

                                                    {n.dispatch_job && (
                                                        <span className="rounded bg-brand-soft/60 px-2 py-0.5 font-mono text-xs font-semibold text-brand-strong">
                                                            {
                                                                n.dispatch_job
                                                                    .reference
                                                            }
                                                        </span>
                                                    )}

                                                    {unread && (
                                                        <span className="h-2 w-2 rounded-full bg-brand-strong" />
                                                    )}
                                                </div>

                                                <p className="mt-1 text-sm leading-relaxed text-ink">
                                                    {presentation.message}
                                                </p>

                                                {n.created_at && (
                                                    <p
                                                        className="mt-1 text-xs text-ink-soft"
                                                        title={exactTimestamp(
                                                            n.created_at,
                                                        )}
                                                    >
                                                        {formatRelativeTime(
                                                            n.created_at,
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {unread && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => markAsRead(n.id)}
                                                disabled={processingId === n.id}
                                            >
                                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-success-strong" />
                                                {processingId === n.id
                                                    ? 'Marking…'
                                                    : 'Mark as read'}
                                            </Button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </Panel>
                )}
            </div>
        </div>
    );
}
