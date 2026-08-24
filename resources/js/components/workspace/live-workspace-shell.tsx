import { router, usePage } from '@inertiajs/react';
import {
    Archive,
    Bell,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Cpu,
    FileText,
    History,
    LayoutDashboard,
    Fuel,
    LogOut,
    MapPin,
    Menu,
    RefreshCw,
    ShieldCheck,
    Siren,
    Truck,
    Users,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
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

const WORKSPACE_SIDEBAR_BREAKPOINT = 840;

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
    'gpt-recommendations': Cpu,
    users: Users,
    audit: History,
    sos: Siren,
};

export function LiveWorkspaceShell({
    navigation,
    section,
    stale,
    refreshing,
    canShareLocation,
    locationPending,
    unreadNotificationCount = 0,
    pendingApprovalCount = 0,
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
    pendingApprovalCount?: number;
    notifications?: NotificationViewModel[];
    onSectionChange: (section: WorkspaceSection) => void;
    onRefresh: () => void;
    onShareLocation: () => void;
}>) {
    const { auth } = usePage().props;
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
    const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
    const navigationRef = useRef<HTMLElement>(null);
    const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

    const openMobileNavigation = useCallback(() => {
        previouslyFocusedElementRef.current = mobileMenuButtonRef.current;
        setMobileOpen(true);
    }, []);

    const closeMobileNavigation = useCallback(() => {
        setMobileOpen(false);
    }, []);

    useEffect(() => {
        if (!mobileOpen) {
            return;
        }

        const focusFirstControl = () => {
            mobileCloseButtonRef.current?.focus({ preventScroll: true });
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeMobileNavigation();

                return;
            }

            if (event.key !== 'Tab') {
                return;
            }

            const focusableElements = getFocusableElements(
                navigationRef.current,
            );
            const first = focusableElements[0];
            const last = focusableElements[focusableElements.length - 1];

            if (!first || !last) {
                event.preventDefault();
                navigationRef.current?.focus({ preventScroll: true });

                return;
            }

            if (!navigationRef.current?.contains(document.activeElement)) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus({ preventScroll: true });

                return;
            }

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus({ preventScroll: true });
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus({ preventScroll: true });
            }
        };

        const animationFrame = window.requestAnimationFrame(focusFirstControl);
        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [closeMobileNavigation, mobileOpen]);

    useEffect(() => {
        if (mobileOpen) {
            return;
        }

        const previouslyFocusedElement = previouslyFocusedElementRef.current;
        previouslyFocusedElementRef.current = null;

        if (
            previouslyFocusedElement?.isConnected &&
            previouslyFocusedElement.getClientRects().length > 0
        ) {
            window.requestAnimationFrame(() =>
                previouslyFocusedElement.focus({ preventScroll: true }),
            );
        }
    }, [mobileOpen]);

    useEffect(() => {
        const mediaQuery = window.matchMedia(
            `(min-width: ${WORKSPACE_SIDEBAR_BREAKPOINT}px)`,
        );
        const closeOnDesktop = () => {
            if (mediaQuery.matches) {
                closeMobileNavigation();
            }
        };

        closeOnDesktop();
        mediaQuery.addEventListener('change', closeOnDesktop);

        return () => mediaQuery.removeEventListener('change', closeOnDesktop);
    }, [closeMobileNavigation]);

    return (
        <MotionConfig reducedMotion="user">
            <div className="min-h-screen min-w-0 bg-canvas text-ink min-[840px]:grid min-[840px]:grid-cols-[auto_minmax(0,1fr)]">
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
                            className="fixed inset-0 z-40 bg-ink/35 min-[840px]:hidden"
                            onClick={closeMobileNavigation}
                            aria-label="Close navigation"
                            tabIndex={-1}
                        />
                    )}
                </AnimatePresence>

                <aside
                    id="workspace-navigation"
                    ref={navigationRef}
                    role={mobileOpen ? 'dialog' : undefined}
                    aria-modal={mobileOpen ? true : undefined}
                    aria-label={mobileOpen ? 'Workspace navigation' : undefined}
                    tabIndex={mobileOpen ? -1 : undefined}
                    className={cn(
                        'fixed inset-y-0 left-0 z-50 flex h-screen w-[15.5rem] flex-col border-r border-white/10 bg-ink text-white transition-transform duration-200 ease-out min-[840px]:sticky min-[840px]:top-0 min-[840px]:translate-x-0',
                        mobileOpen ? 'translate-x-0' : '-translate-x-full',
                        collapsed && 'min-[840px]:w-[4.75rem]',
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
                            ref={mobileCloseButtonRef}
                            onClick={closeMobileNavigation}
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white min-[840px]:hidden"
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
                                const isNotifications =
                                    item.id === 'notifications';
                                const isApprovals = item.id === 'approvals';
                                const badgeCount = isNotifications
                                    ? unreadNotificationCount
                                    : isApprovals
                                      ? pendingApprovalCount
                                      : 0;
                                const badgeLabel = isNotifications
                                    ? 'unread'
                                    : 'pending';
                                const showBadge = badgeCount > 0;

                                return (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onSectionChange(item.id);
                                                closeMobileNavigation();
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
                                                        ? `${item.label} (${badgeCount} ${badgeLabel})`
                                                        : item.label
                                                    : undefined
                                            }
                                            title={
                                                collapsed
                                                    ? showBadge
                                                        ? `${item.label} (${badgeCount} ${badgeLabel})`
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
                                                        {badgeCount > 9
                                                            ? '9+'
                                                            : badgeCount}
                                                    </span>
                                                )}
                                            </span>
                                            {!collapsed && (
                                                <span className="flex flex-1 items-center justify-between text-left font-medium">
                                                    {item.label}
                                                    {showBadge && (
                                                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                                                            {badgeCount > 9
                                                                ? '9+'
                                                                : badgeCount}
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                            {showBadge && (
                                                <span className="sr-only">
                                                    {badgeCount} {badgeLabel}
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
                                'hidden min-h-11 w-full items-center rounded-lg text-sm text-white/65 hover:bg-white/5 hover:text-white min-[840px]:flex',
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

                <div
                    className="min-w-0"
                    inert={mobileOpen || undefined}
                    aria-hidden={mobileOpen ? true : undefined}
                >
                    <header className="sticky top-0 z-30 flex min-h-[4.5rem] items-center gap-2 border-b border-line bg-surface px-4 min-[840px]:px-6">
                        <button
                            type="button"
                            ref={mobileMenuButtonRef}
                            onClick={openMobileNavigation}
                            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-subtle min-[840px]:hidden"
                            aria-label="Open navigation"
                            aria-expanded={mobileOpen}
                            aria-controls="workspace-navigation"
                        >
                            <Menu className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
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
                                        ? (navigation.find(
                                              (n) => n.id === section,
                                          )?.label ?? 'Workspace')
                                        : 'Workspace'}
                                </h1>
                                <p className="truncate text-xs text-ink-soft">
                                    {stale ? (
                                        <span className="block max-w-full truncate font-medium text-warning-strong">
                                            Data may be stale · Refresh to sync
                                        </span>
                                    ) : (
                                        <span className="block max-w-full truncate">
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
                            {navigation.some(
                                (n) => n.id === 'notifications',
                            ) && (
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
                                <LogOut
                                    className="h-5 w-5"
                                    aria-hidden="true"
                                />
                            </Button>
                        </div>
                    </header>

                    <main
                        id="workspace-content"
                        className="min-w-0"
                        tabIndex={-1}
                    >
                        {children}
                    </main>
                </div>
            </div>
        </MotionConfig>
    );
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
    if (!container) {
        return [];
    }

    return Array.from(
        container.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
    ).filter(
        (element) =>
            !element.hasAttribute('aria-hidden') &&
            element.getClientRects().length > 0,
    );
}
