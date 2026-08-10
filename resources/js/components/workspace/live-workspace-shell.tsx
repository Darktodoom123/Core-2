import { router, usePage } from '@inertiajs/react';
import {
    Archive,
    Bell,
    Bot,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileText,
    LayoutDashboard,
    Fuel,
    LogOut,
    MapPin,
    Menu,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Truck,
    Users,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { PropsWithChildren } from 'react';
import { ApplicationLogo } from '@/components/application-logo';
import { Button } from '@/components/ui';
import { NotificationCenterPopover } from '@/components/workspace/notification-center-popover';
import { cn } from '@/lib/utils';
import type {
    NotificationViewModel,
    WorkspaceNavigationItem,
    WorkspaceSection,
} from '@/types/workspace';

const sectionIcons: Record<WorkspaceSection, LucideIcon> = {
    overview: LayoutDashboard,
    dispatch: ClipboardList,
    assets: Truck,
    fuel: Fuel,
    tracking: MapPin,
    approvals: ShieldCheck,
    reports: FileText,
    notifications: Bell,
    archive: Archive,
    'gpt-recommendations': Sparkles,
    users: Users,
    audit: Bot,
};

export function LiveWorkspaceShell({
    navigation,
    section,
    stale,
    refreshing,
    canShareLocation,
    locationPending,
    unreadNotificationCount = 0,
    notifications = [],
    onSectionChange,
    onRefresh,
    onShareLocation,
    children,
}: PropsWithChildren<{
    navigation: WorkspaceNavigationItem[];
    section: WorkspaceSection | null;
    stale: boolean;
    refreshing: boolean;
    canShareLocation: boolean;
    locationPending: boolean;
    unreadNotificationCount?: number;
    notifications?: NotificationViewModel[];
    onSectionChange: (section: WorkspaceSection) => void;
    onRefresh: () => void;
    onShareLocation: () => void;
}>) {
    const { auth } = usePage().props;
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="min-h-screen bg-canvas text-ink md:grid md:grid-cols-[auto_minmax(0,1fr)]">
            <a
                href="#workspace-content"
                className="sr-only z-[70] rounded-lg bg-ink px-4 py-3 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
            >
                Skip to workspace
            </a>

            <AnimatePresence>
                {mobileOpen && (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        type="button"
                        className="fixed inset-0 z-40 bg-ink/35 md:hidden"
                        onClick={() => setMobileOpen(false)}
                        aria-label="Close navigation"
                    />
                )}
            </AnimatePresence>

            <aside
                id="workspace-navigation"
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex h-screen w-[15.5rem] flex-col border-r border-white/10 bg-ink text-white transition-transform duration-200 ease-out md:sticky md:top-0 md:translate-x-0',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full',
                    collapsed && 'md:w-[4.75rem]',
                )}
            >
                <div
                    className={cn(
                        'flex h-[4.5rem] items-center border-b border-white/10 px-4',
                        collapsed ? 'justify-center' : 'gap-3',
                    )}
                >
                    <ApplicationLogo variant="badge" />
                    {!collapsed && (
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                                Core Transaction 2
                            </p>
                            <p className="truncate text-xs text-white/65">
                                {auth.role_label}
                            </p>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setMobileOpen(false)}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white md:hidden"
                        aria-label="Close navigation"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>

                <nav
                    className="flex-1 overflow-y-auto p-3"
                    aria-label="Available operations modules"
                >
                    {!collapsed && (
                        <p className="px-3 pb-2 text-xs font-medium text-white/55">
                            Available to your account
                        </p>
                    )}
                    <ul className="space-y-1">
                        {navigation.map((item) => {
                            const Icon = sectionIcons[item.id];
                            const active = item.id === section;
                            const isNotifications = item.id === 'notifications';
                            const showBadge =
                                isNotifications && unreadNotificationCount > 0;

                            return (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSectionChange(item.id);
                                            setMobileOpen(false);
                                        }}
                                        className={cn(
                                            'relative flex min-h-11 w-full items-center rounded-lg text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                                            collapsed
                                                ? 'justify-center'
                                                : 'gap-3 px-3',
                                            active
                                                ? 'bg-white/10 text-white'
                                                : 'text-white/65 hover:bg-white/5 hover:text-white',
                                        )}
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        aria-label={
                                            collapsed
                                                ? showBadge
                                                    ? `${item.label} (${unreadNotificationCount} unread)`
                                                    : item.label
                                                : undefined
                                        }
                                        title={
                                            collapsed
                                                ? showBadge
                                                    ? `${item.label} (${unreadNotificationCount} unread)`
                                                    : item.label
                                                : undefined
                                        }
                                    >
                                        {active && (
                                            <motion.span
                                                layoutId="active-nav-indicator"
                                                transition={{
                                                    duration: 0.18,
                                                    ease: 'easeOut',
                                                }}
                                                className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand"
                                                aria-hidden="true"
                                            />
                                        )}
                                        {/* Icon + badge wrapper */}
                                        <span className="relative shrink-0">
                                            <Icon
                                                className="h-5 w-5"
                                                aria-hidden="true"
                                            />
                                            {showBadge && (
                                                <span
                                                    className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-bold text-white"
                                                    aria-hidden="true"
                                                >
                                                    {unreadNotificationCount > 9
                                                        ? '9+'
                                                        : unreadNotificationCount}
                                                </span>
                                            )}
                                        </span>
                                        {!collapsed && (
                                            <span className="flex flex-1 items-center justify-between text-left font-medium">
                                                {item.label}
                                                {showBadge && (
                                                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                                                        {unreadNotificationCount >
                                                        9
                                                            ? '9+'
                                                            : unreadNotificationCount}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                        {showBadge && (
                                            <span className="sr-only">
                                                {unreadNotificationCount} unread
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div className="border-t border-white/10 p-3">
                    <button
                        type="button"
                        onClick={() => setCollapsed((value) => !value)}
                        className={cn(
                            'hidden min-h-11 w-full items-center rounded-lg text-sm text-white/65 hover:bg-white/5 hover:text-white md:flex',
                            collapsed ? 'justify-center' : 'gap-3 px-3',
                        )}
                        aria-label={
                            collapsed
                                ? 'Expand navigation'
                                : 'Collapse navigation'
                        }
                        aria-expanded={!collapsed}
                    >
                        {collapsed ? (
                            <ChevronRight
                                className="h-5 w-5"
                                aria-hidden="true"
                            />
                        ) : (
                            <>
                                <ChevronLeft
                                    className="h-5 w-5"
                                    aria-hidden="true"
                                />
                                Collapse navigation
                            </>
                        )}
                    </button>
                </div>
            </aside>

            <div className="min-w-0">
                <header className="sticky top-0 z-30 flex min-h-[4.5rem] items-center gap-2 border-b border-line bg-surface px-4 md:px-6">
                    <button
                        type="button"
                        onClick={() => setMobileOpen(true)}
                        className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-subtle md:hidden"
                        aria-label="Open navigation"
                        aria-expanded={mobileOpen}
                        aria-controls="workspace-navigation"
                    >
                        <Menu className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-subtle text-ink">
                            {section && sectionIcons[section] ? (
                                (() => {
                                    const Icon = sectionIcons[section];

                                    return (
                                        <Icon
                                            className="h-4 w-4 text-brand-strong"
                                            aria-hidden="true"
                                        />
                                    );
                                })()
                            ) : (
                                <LayoutDashboard
                                    className="h-4 w-4 text-brand-strong"
                                    aria-hidden="true"
                                />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-sm font-semibold text-ink">
                                {section
                                    ? (navigation.find((n) => n.id === section)
                                          ?.label ?? 'Workspace')
                                    : 'Workspace'}
                            </h1>
                            <p className="truncate text-xs text-ink-soft">
                                {stale ? (
                                    <span className="font-medium text-warning-strong">
                                        Data may be stale · Refresh to sync
                                    </span>
                                ) : (
                                    <span>
                                        {auth.user?.name ?? 'User'} ·{' '}
                                        {auth.role_label ?? 'Operations'}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-1 sm:gap-2">
                        {canShareLocation && (
                            <Button
                                variant="quiet"
                                onClick={onShareLocation}
                                disabled={locationPending}
                                aria-label={
                                    locationPending
                                        ? 'Sharing current location'
                                        : 'Share current location'
                                }
                            >
                                <MapPin
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                <span className="hidden sm:inline">
                                    {locationPending
                                        ? 'Sharing…'
                                        : 'Share location'}
                                </span>
                            </Button>
                        )}

                        {/* Bell notification button — only shown when notifications section is accessible */}
                        {navigation.some((n) => n.id === 'notifications') && (
                            <NotificationCenterPopover
                                notifications={notifications}
                                onViewAll={() =>
                                    onSectionChange('notifications')
                                }
                            />
                        )}

                        <Button
                            size="icon"
                            variant="quiet"
                            onClick={onRefresh}
                            disabled={refreshing}
                            aria-label={
                                refreshing
                                    ? 'Refreshing workspace'
                                    : 'Refresh workspace'
                            }
                            title="Refresh workspace"
                        >
                            <RefreshCw
                                className={cn(
                                    'h-5 w-5',
                                    refreshing && 'animate-spin',
                                )}
                                aria-hidden="true"
                            />
                        </Button>
                        <Button
                            size="icon"
                            variant="quiet"
                            onClick={() => router.post('/logout')}
                            aria-label="Sign out"
                            title="Sign out"
                        >
                            <LogOut className="h-5 w-5" aria-hidden="true" />
                        </Button>
                    </div>
                </header>

                <main id="workspace-content" className="min-w-0">
                    {children}
                </main>
            </div>
        </div>
    );
}
