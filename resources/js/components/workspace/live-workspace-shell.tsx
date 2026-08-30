import { router, usePage } from '@inertiajs/react';
import {
    Archive,
    Bell,
    ChevronDown,
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
    ShieldAlert,
    ShieldCheck,
    Truck,
    Users,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    sos: ShieldCheck,
    safety: ShieldAlert,
};

interface NavGroupDefinition {
    id: string;
    label: string;
    sections: WorkspaceSection[];
}

const NAV_GROUPS: NavGroupDefinition[] = [
    {
        id: 'operations',
        label: 'Core Operations',
        sections: ['overview', 'dispatch', 'assets', 'fuel', 'tracking'],
    },
    {
        id: 'governance',
        label: 'Field Governance',
        sections: ['reports', 'archive'],
    },
    {
        id: 'safety_system',
        label: 'Safety & System',
        sections: ['gpt-recommendations', 'users', 'audit'],
    },
];

export function LiveWorkspaceShell({
    navigation,
    section,
    stale,
    refreshing,
    canShareLocation,
    locationPending,
    unreadNotificationCount = 0,
    pendingApprovalCount = 0,
    pendingFuelCount = 0,
    activeSosCount = 0,
    blockingAssetCount = 0,
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
    pendingFuelCount?: number;
    activeSosCount?: number;
    blockingAssetCount?: number;
    notifications?: NotificationViewModel[];
    onSectionChange: (section: WorkspaceSection) => void;
    onRefresh: () => void;
    onShareLocation: () => void;
}>) {
    const { auth } = usePage().props;
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
    const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
    const navigationRef = useRef<HTMLElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!userMenuOpen) {
            return;
        }

        const handleOutsideClick = (e: MouseEvent) => {
            if (
                userMenuRef.current &&
                !userMenuRef.current.contains(e.target as Node)
            ) {
                setUserMenuOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [userMenuOpen]);

    const userInitials = useMemo(() => {
        const name = auth.user?.name || '';
        const parts = name.trim().split(/\s+/);

        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }

        return (name.slice(0, 2) || 'OM').toUpperCase();
    }, [auth.user?.name]);

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

    const getBadgeInfo = useCallback(
        (id: WorkspaceSection) => {
            if (id === 'sos') {
                return {
                    count: activeSosCount,
                    label: 'active emergency',
                    tone: 'danger' as const,
                    pulse: true,
                    display: activeSosCount > 9 ? '9+' : `${activeSosCount}`,
                };
            }

            if (id === 'fuel') {
                return {
                    count: pendingFuelCount,
                    label: 'pending fuel requests',
                    tone: 'warning' as const,
                    pulse: false,
                    display:
                        pendingFuelCount > 9 ? '9+' : `${pendingFuelCount}`,
                };
            }

            if (id === 'approvals') {
                return {
                    count: pendingApprovalCount,
                    label: 'pending approvals',
                    tone: 'warning' as const,
                    pulse: false,
                    display:
                        pendingApprovalCount > 9
                            ? '9+'
                            : `${pendingApprovalCount}`,
                };
            }

            if (id === 'notifications') {
                return {
                    count: unreadNotificationCount,
                    label: 'unread notifications',
                    tone: 'danger' as const,
                    pulse: false,
                    display:
                        unreadNotificationCount > 9
                            ? '9+'
                            : `${unreadNotificationCount}`,
                };
            }

            if (id === 'assets' && blockingAssetCount > 0) {
                return {
                    count: blockingAssetCount,
                    label: 'blocked assets',
                    tone: 'danger' as const,
                    pulse: false,
                    display:
                        blockingAssetCount > 9 ? '9+' : `${blockingAssetCount}`,
                };
            }

            return null;
        },
        [
            activeSosCount,
            pendingFuelCount,
            pendingApprovalCount,
            unreadNotificationCount,
            blockingAssetCount,
        ],
    );

    const groupedNavigation = useMemo(() => {
        const groups: Array<{
            id: string;
            label: string;
            items: WorkspaceNavigationItem[];
        }> = [];

        const assignedSectionIds = new Set<WorkspaceSection>();

        for (const groupDef of NAV_GROUPS) {
            const matchingItems = navigation.filter((item) =>
                groupDef.sections.includes(item.id),
            );

            if (matchingItems.length > 0) {
                matchingItems.forEach((item) =>
                    assignedSectionIds.add(item.id),
                );
                groups.push({
                    id: groupDef.id,
                    label: groupDef.label,
                    items: matchingItems,
                });
            }
        }

        const unassignedItems = navigation.filter(
            (item) => !assignedSectionIds.has(item.id),
        );

        if (unassignedItems.length > 0) {
            groups.push({
                id: 'other',
                label: 'Other modules',
                items: unassignedItems,
            });
        }

        return groups;
    }, [navigation]);

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
                        <div className="space-y-4">
                            {groupedNavigation.map((group, groupIndex) => (
                                <div
                                    key={group.id}
                                    className={groupIndex > 0 ? 'pt-2' : ''}
                                >
                                    {!collapsed && (
                                        <p className="px-3 pb-1.5 text-[10px] font-bold tracking-wider text-white/40 uppercase">
                                            {group.label}
                                        </p>
                                    )}
                                    {collapsed && groupIndex > 0 && (
                                        <div
                                            className="mx-2 mb-2 h-px bg-white/10"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <ul className="space-y-1">
                                        {group.items.map((item) => {
                                            const badge = getBadgeInfo(item.id);
                                            const showBadge =
                                                badge !== null &&
                                                badge.count > 0;
                                            const Icon =
                                                item.id === 'sos' && showBadge
                                                    ? ShieldAlert
                                                    : sectionIcons[item.id];
                                            const active = item.id === section;

                                            return (
                                                <li key={item.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onSectionChange(
                                                                item.id,
                                                            );
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
                                                            active
                                                                ? 'page'
                                                                : undefined
                                                        }
                                                        aria-label={
                                                            collapsed
                                                                ? showBadge
                                                                    ? `${item.label} (${badge.count} ${badge.label})`
                                                                    : item.label
                                                                : undefined
                                                        }
                                                        title={
                                                            collapsed
                                                                ? showBadge
                                                                    ? `${item.label} (${badge.count} ${badge.label})`
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
                                                                className={cn(
                                                                    'h-5 w-5',
                                                                    item.id ===
                                                                        'sos' &&
                                                                        showBadge &&
                                                                        'animate-pulse text-danger',
                                                                )}
                                                                aria-hidden="true"
                                                            />
                                                            {showBadge && (
                                                                <span
                                                                    className={cn(
                                                                        'absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold text-white',
                                                                        badge.tone ===
                                                                            'danger'
                                                                            ? 'bg-danger'
                                                                            : 'bg-warning-strong text-white',
                                                                        badge.pulse &&
                                                                            'animate-pulse ring-2 ring-danger/40',
                                                                    )}
                                                                    aria-hidden="true"
                                                                >
                                                                    {
                                                                        badge.display
                                                                    }
                                                                </span>
                                                            )}
                                                        </span>
                                                        {!collapsed && (
                                                            <span className="flex flex-1 items-center justify-between text-left font-medium">
                                                                <span
                                                                    className={
                                                                        item.id ===
                                                                            'sos' &&
                                                                        showBadge
                                                                            ? 'font-semibold text-danger'
                                                                            : undefined
                                                                    }
                                                                >
                                                                    {item.label}
                                                                </span>
                                                                {showBadge && (
                                                                    <span
                                                                        className={cn(
                                                                            'ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                                                                            badge.tone ===
                                                                                'danger'
                                                                                ? 'bg-danger text-white'
                                                                                : 'bg-warning-soft text-warning-strong',
                                                                            badge.pulse &&
                                                                                'animate-pulse ring-2 ring-danger/40',
                                                                        )}
                                                                    >
                                                                        {
                                                                            badge.display
                                                                        }
                                                                    </span>
                                                                )}
                                                            </span>
                                                        )}
                                                        {showBadge && (
                                                            <span className="sr-only">
                                                                {badge.count}{' '}
                                                                {badge.label}
                                                            </span>
                                                        )}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>
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
                        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
                            {/* Live Stream / Safety Status Pill */}
                            {activeSosCount > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => onSectionChange('sos')}
                                    className="flex animate-pulse items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger-strong ring-1 ring-danger/40 hover:bg-danger-soft/80 focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
                                    title={`${activeSosCount} active emergency in queue · Click to open`}
                                >
                                    <span className="h-2 w-2 rounded-full bg-danger" />
                                    <span>{activeSosCount} Active SOS</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onSectionChange('sos')}
                                    className="hidden items-center gap-1.5 rounded-full border border-line bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-surface hover:text-ink sm:flex"
                                    title="Realtime Reverb Stream Connected · Click to view Safety Watch"
                                >
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                                    <span className="text-[11px] font-semibold text-ink">
                                        Live Stream
                                    </span>
                                </button>
                            )}

                            <div
                                className="hidden h-4 w-px bg-line sm:block"
                                aria-hidden="true"
                            />

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

                            {/* Bell notification button */}
                            <NotificationCenterPopover
                                notifications={notifications}
                                onViewAll={() =>
                                    onSectionChange('notifications')
                                }
                                onNavigate={onSectionChange}
                            />

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

                            <div
                                className="h-4 w-px bg-line"
                                aria-hidden="true"
                            />

                            {/* User Avatar & Account Dropdown Menu */}
                            <div className="relative" ref={userMenuRef}>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setUserMenuOpen((prev) => !prev)
                                    }
                                    className="flex items-center gap-2 rounded-lg p-1 text-left text-sm transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                                    aria-expanded={userMenuOpen}
                                    aria-haspopup="menu"
                                    aria-label="User account menu"
                                >
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-xs font-bold text-brand-strong ring-1 ring-brand/20">
                                        {userInitials}
                                    </span>
                                    <div className="hidden leading-none md:block">
                                        <span className="block max-w-[12rem] truncate text-xs font-semibold text-ink">
                                            {auth.user?.name ?? 'User'}
                                        </span>
                                        <span className="mt-0.5 block max-w-[12rem] truncate text-[10px] text-ink-soft">
                                            {auth.role_label ?? 'Operations'}
                                        </span>
                                    </div>
                                    <ChevronDown
                                        className="hidden h-3.5 w-3.5 text-ink-soft md:block"
                                        aria-hidden="true"
                                    />
                                </button>

                                {userMenuOpen && (
                                    <div
                                        className="absolute top-full right-0 z-50 mt-2 w-60 space-y-1 rounded-xl border border-line bg-surface p-2 shadow-lg"
                                        role="menu"
                                        aria-label="User account options"
                                    >
                                        <div className="space-y-1 border-b border-line px-3 py-2">
                                            <p className="truncate text-xs font-semibold text-ink">
                                                {auth.user?.name ?? 'User'}
                                            </p>
                                            {auth.user?.email && (
                                                <p className="truncate text-[11px] text-ink-soft">
                                                    {auth.user.email}
                                                </p>
                                            )}
                                            <div className="pt-0.5">
                                                <span className="inline-block rounded border border-line bg-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                                                    {auth.role_label ??
                                                        'Operations'}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.post('/logout')
                                            }
                                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-danger transition-colors hover:bg-danger-soft/60"
                                            role="menuitem"
                                        >
                                            <LogOut
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                            />
                                            <span>Sign out</span>
                                        </button>
                                    </div>
                                )}
                            </div>
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
