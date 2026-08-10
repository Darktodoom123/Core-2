import { router } from '@inertiajs/react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import {
    exactTimestamp,
    formatRelativeTime,
    presentNotification,
    toneClasses,
} from '@/components/workspace/notification-center-popover';
import type { NotificationViewModel } from '@/types/workspace';

export function NotificationsSurface({
    notifications = [],
}: {
    notifications?: NotificationViewModel[];
}) {
    const markAsRead = (id: string) => {
        router.post(
            `/operations/notifications/${id}/read`,
            {},
            { preserveScroll: true },
        );
    };

    const unreadCount = notifications.filter(
        (n) => n.status !== 'read' && !n.read_at,
    ).length;

    return (
        <div>
            <PageHeading
                title="System & dispatch notifications"
                description="Track live operational alerts, schedule updates, completion notices, and dispatch assignments."
            />
            <div className="space-y-6 p-4 md:p-6">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink">
                        {unreadCount === 0
                            ? 'All notifications are caught up'
                            : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
                    </span>
                </div>

                {notifications.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Bell}
                            title="No notifications"
                            message="Alerts regarding assigned jobs, schedule changes, and completion updates will appear here."
                        />
                    </Panel>
                ) : (
                    <Panel className="overflow-hidden">
                        <ul className="divide-y divide-line">
                            {notifications.map((n) => {
                                const isUnread =
                                    n.status !== 'read' && !n.read_at;
                                const presentation = presentNotification(n);
                                const Icon = presentation.Icon;

                                return (
                                    <li
                                        key={n.id}
                                        className={`flex flex-wrap items-start justify-between gap-4 p-4 transition-colors ${
                                            isUnread ? 'bg-brand-soft/30' : ''
                                        }`}
                                    >
                                        <div className="flex min-w-0 flex-1 items-start gap-3">
                                            <span
                                                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClasses[presentation.tone]}`}
                                            >
                                                <Icon
                                                    className="h-4 w-4"
                                                    aria-hidden="true"
                                                />
                                            </span>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-ink">
                                                        {presentation.title}
                                                    </span>
                                                    {n.dispatch_job && (
                                                        <span className="rounded bg-surface-subtle px-2 py-0.5 font-mono text-xs text-ink-soft">
                                                            {
                                                                n.dispatch_job
                                                                    .reference
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-1 line-clamp-2 text-sm text-ink">
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

                                        {isUnread && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => markAsRead(n.id)}
                                            >
                                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-success-strong" />
                                                Mark as read
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
