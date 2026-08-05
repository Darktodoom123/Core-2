import { router } from '@inertiajs/react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
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

    const unreadCount = notifications.filter((n) => n.status !== 'read' && !n.read_at).length;

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
                                const isUnread = n.status !== 'read' && !n.read_at;

                                return (
                                    <li
                                        key={n.id}
                                        className={`flex flex-wrap items-start justify-between gap-4 p-4 transition-colors ${
                                            isUnread ? 'bg-brand-soft/30' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <Bell
                                                className={`mt-0.5 h-5 w-5 shrink-0 ${
                                                    isUnread ? 'text-brand-strong' : 'text-ink-soft'
                                                }`}
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-ink">
                                                        {humanizeType(n.type)}
                                                    </span>
                                                    {n.dispatch_job && (
                                                        <span className="rounded bg-surface-subtle px-2 py-0.5 text-xs font-mono text-ink-soft">
                                                            {n.dispatch_job.reference}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-sm text-ink line-clamp-2">
                                                    {extractMessage(n.data)}
                                                </p>
                                                {n.created_at && (
                                                    <p className="mt-1 text-xs text-ink-soft">
                                                        {new Date(n.created_at).toLocaleString()}
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

function humanizeType(type: string): string {
    return type
        .replace(/^[^\\]*\\/, '')
        .replace(/Notification$/, '')
        .replace(/([A-Z])/g, ' $1')
        .trim();
}

function extractMessage(data: Record<string, unknown>): string {
    if (typeof data.message === 'string') {
        return data.message;
    }

    if (typeof data.title === 'string') {
        return data.title;
    }

    if (typeof data.reason === 'string') {
        return data.reason;
    }

    return JSON.stringify(data);
}
