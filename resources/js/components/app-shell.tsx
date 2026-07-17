import { router, usePage } from '@inertiajs/react';
import {
    Bell,
    Bot,
    ChevronRight,
    ClipboardList,
    Fuel,
    Gauge,
    LayoutDashboard,
    LogOut,
    Map,
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    Settings,
    ShieldCheck,
    Truck,
    Users,
    Wrench,
} from 'lucide-react';
import { useState } from 'react';
import type { ComponentType, PropsWithChildren, SVGProps } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
    AppSection,
    ConnectivityState,
    UserRole,
} from '@/types/operations';
import { roleLabels } from '@/types/operations';

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
    section: AppSection;
    label: string;
    icon: IconType;
    module?: number;
    detail?: string;
    anyPermission?: string[];
}

const coreModuleNavigation: NavItem[] = [
    {
        section: 'board',
        label: 'Dispatch Job and Scheduling',
        icon: Gauge,
        module: 1,
        detail: 'Real-time activation',
        anyPermission: ['dispatch.view_all', 'dispatch.view_assigned'],
    },
    {
        section: 'dispatch',
        label: 'Assign Driver/Operator and Equipment',
        icon: Users,
        module: 2,
        anyPermission: ['assignments.view_all', 'assignments.view_own'],
    },
    {
        section: 'fleet',
        label: 'Fleet Management',
        icon: Truck,
        module: 3,
        anyPermission: ['fleet.view_all', 'fleet.view_assigned'],
    },
    {
        section: 'equipment',
        label: 'Crane and Equipment Management',
        icon: Wrench,
        module: 4,
        anyPermission: ['equipment.view_all', 'equipment.view_assigned'],
    },
    {
        section: 'fuel',
        label: 'Fuel Management',
        icon: Fuel,
        module: 5,
        anyPermission: ['fuel.view_all', 'fuel.view_own', 'fuel.request'],
    },
];

const navigationByRole: Record<UserRole, NavItem[]> = {
    administrator: coreModuleNavigation,
    dispatcher: coreModuleNavigation,
    manager: coreModuleNavigation,
    driver: [
        { section: 'today', label: 'Today', icon: LayoutDashboard },
        { section: 'job', label: 'Job', icon: ClipboardList },
        { section: 'live', label: 'Route', icon: Map },
        { section: 'issues', label: 'Issues', icon: ShieldCheck },
    ],
    operator: [
        { section: 'today', label: 'Today', icon: LayoutDashboard },
        { section: 'job', label: 'Job', icon: ClipboardList },
        { section: 'tasks', label: 'Safety', icon: ShieldCheck },
        { section: 'issues', label: 'Issues', icon: Wrench },
    ],
    technician: [
        { section: 'tasks', label: 'Tasks', icon: ClipboardList },
        { section: 'job', label: 'Work order', icon: Wrench },
        { section: 'equipment', label: 'Assets', icon: Truck },
        { section: 'issues', label: 'Handover', icon: ShieldCheck },
    ],
};

export function getNavigationForRole(
    role: UserRole,
    permissions: string[] = [],
) {
    return navigationByRole[role].filter(
        (item) =>
            !item.anyPermission ||
            item.anyPermission.some((permission) =>
                permissions.includes(permission),
            ),
    );
}

export function AppShell({
    role,
    section,
    collapsed,
    connectivity,
    queuedActions,
    query,
    onQueryChange,
    onSectionChange,
    onToggleSidebar,
    children,
}: PropsWithChildren<{
    role: UserRole;
    section: AppSection;
    collapsed: boolean;
    connectivity: ConnectivityState;
    queuedActions: number;
    query: string;
    onQueryChange: (value: string) => void;
    onSectionChange: (section: AppSection) => void;
    onToggleSidebar: () => void;
}>) {
    const { auth } = usePage().props;
    const navigation = getNavigationForRole(role, auth.permissions);
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="min-h-screen bg-canvas md:grid md:grid-cols-[auto_minmax(0,1fr)]">
            <a
                href="#main-content"
                className="sr-only z-50 bg-ink px-4 py-3 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
            >
                Skip to main content
            </a>

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm md:hidden"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-white/10 bg-ink text-white transition-all duration-300 ease-in-out md:sticky md:top-0 md:translate-x-0',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full',
                    collapsed ? 'md:w-[4.75rem]' : 'w-[15.5rem]',
                )}
            >
                <div
                    className={cn(
                        'flex h-[4.5rem] items-center border-b border-white/10 px-4',
                        collapsed ? 'justify-center' : 'gap-3',
                    )}
                >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white">
                        C2
                    </div>
                    {!collapsed && (
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                                Core Transaction 2
                            </p>
                            <p className="mt-0.5 text-xs text-white/60">
                                Operations platform
                            </p>
                        </div>
                    )}
                </div>

                <nav
                    className="flex-1 scrollbar-thin overflow-y-auto p-3"
                    aria-label={`${roleLabels[role]} navigation`}
                >
                    {!collapsed && navigation.some((item) => item.module) && (
                        <p className="px-3 pb-2 text-xs font-medium text-white/50">
                            Core modules
                        </p>
                    )}
                    <ul className="space-y-1">
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            const active = item.section === section;

                            const accessibleLabel = item.module
                                ? `Module ${item.module}: ${item.label}${item.detail ? ` (${item.detail})` : ''}`
                                : item.label;

                            return (
                                <li key={item.section}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSectionChange(item.section);
                                            setMobileOpen(false);
                                        }}
                                        title={
                                            collapsed
                                                ? accessibleLabel
                                                : undefined
                                        }
                                        aria-label={accessibleLabel}
                                        className={cn(
                                            'nav-btn relative flex min-h-11 w-full items-center rounded-lg py-2 text-sm transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none',
                                            collapsed
                                                ? 'justify-center'
                                                : 'gap-3 pr-2 pl-4',
                                            active
                                                ? "bg-white/10 text-white before:absolute before:top-1/2 before:left-0 before:h-1 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-brand before:content-['']"
                                                : 'text-white/60 hover:bg-white/5 hover:text-white',
                                        )}
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                    >
                                        <Icon
                                            className={cn(
                                                'shrink-0 transition-transform duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none',
                                                active && !collapsed
                                                    ? 'translate-x-1'
                                                    : '',
                                                collapsed
                                                    ? 'h-[1.375rem] w-[1.375rem]'
                                                    : 'h-5 w-5',
                                            )}
                                            aria-hidden="true"
                                        />
                                        {!collapsed && (
                                            <span className="min-w-0 text-left">
                                                {item.module && (
                                                    <span className="block text-[0.6875rem] leading-4 font-medium text-white/50">
                                                        Module {item.module}
                                                    </span>
                                                )}
                                                <span
                                                    className={cn(
                                                        'block leading-5',
                                                        active
                                                            ? 'font-semibold'
                                                            : 'font-normal',
                                                    )}
                                                >
                                                    {item.label}
                                                </span>
                                                {item.detail && (
                                                    <span className="block text-[0.6875rem] leading-4 text-white/50">
                                                        {item.detail}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div className="border-t border-white/10 px-4 py-3">
                    {auth.permissions.some((permission) =>
                        [
                            'users.manage',
                            'roles.manage',
                            'system.configure',
                        ].includes(permission),
                    ) && (
                        <button
                            type="button"
                            onClick={() => onSectionChange('administration')}
                            className={cn(
                                'flex min-h-11 w-full items-center rounded-lg text-sm text-white/60 transition-colors duration-200 ease-out hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none',
                                collapsed ? 'justify-center' : 'gap-3 px-3',
                            )}
                            title={collapsed ? 'Settings' : undefined}
                        >
                            <Settings
                                className="h-[1.125rem] w-[1.125rem]"
                                aria-hidden="true"
                            />
                            {!collapsed && <span>Settings</span>}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        className={cn(
                            'mt-1 flex min-h-11 w-full items-center rounded-lg text-sm text-white/60 transition-colors duration-200 ease-out hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none',
                            collapsed ? 'justify-center' : 'gap-3 px-3',
                        )}
                        aria-label={
                            collapsed ? 'Expand sidebar' : 'Collapse sidebar'
                        }
                    >
                        {collapsed ? (
                            <PanelLeftOpen
                                className="h-[1.125rem] w-[1.125rem]"
                                aria-hidden="true"
                            />
                        ) : (
                            <PanelLeftClose
                                className="h-[1.125rem] w-[1.125rem]"
                                aria-hidden="true"
                            />
                        )}
                        {!collapsed && <span>Collapse sidebar</span>}
                    </button>
                </div>
            </aside>

            <div className="min-w-0">
                <header className="sticky top-0 z-30 flex h-[4.5rem] items-center gap-3 border-b border-line bg-surface px-5 md:px-7">
                    <div className="flex items-center gap-2 md:hidden">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(true)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-subtle text-ink transition-colors hover:bg-line"
                            aria-label="Open navigation menu"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-xs font-semibold text-white">
                            C2
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const index = navigation.findIndex(
                                    (item) => item.section === section,
                                );
                                const next =
                                    navigation[(index + 1) % navigation.length];

                                if (next) {
                                    onSectionChange(next.section);
                                }
                            }}
                            className="flex h-11 min-w-0 items-center gap-1 rounded-lg px-2 text-sm font-medium hover:bg-surface-subtle"
                            aria-label="Go to next section"
                        >
                            <span className="max-w-32 truncate">
                                {navigation.find(
                                    (item) => item.section === section,
                                )?.label ?? 'Overview'}
                            </span>
                            <ChevronRight
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                        </button>
                    </div>

                    <label className="relative hidden max-w-md flex-1 lg:block">
                        <span className="sr-only">
                            Search current workspace
                        </span>
                        <Search
                            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
                            aria-hidden="true"
                        />
                        <input
                            value={query}
                            onChange={(event) =>
                                onQueryChange(event.target.value)
                            }
                            className="h-10 w-full rounded-lg border border-line bg-surface-subtle pr-3 pl-9 text-sm text-ink placeholder:text-ink-soft"
                            placeholder="Search jobs, assets, people…"
                        />
                    </label>

                    <div className="ml-auto flex items-center gap-2">
                        <div
                            className={cn(
                                'hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium sm:flex',
                                connectivity === 'online' &&
                                    'bg-success-soft text-green-800',
                                connectivity === 'offline' &&
                                    'bg-warning-soft text-amber-900',
                                connectivity === 'syncing' &&
                                    'bg-brand-soft text-brand-strong',
                            )}
                            role="status"
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {connectivity === 'online'
                                ? 'Synced'
                                : connectivity === 'offline'
                                  ? `Offline · ${queuedActions} queued`
                                  : 'Syncing'}
                        </div>
                        <Button
                            size="icon"
                            variant="quiet"
                            aria-label="Notifications, 3 unread"
                            title="Notifications"
                            className="relative hidden min-[400px]:inline-flex"
                        >
                            <Bell className="h-5 w-5" aria-hidden="true" />
                            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
                        </Button>

                        <div className="hidden min-w-0 text-right sm:block">
                            <p className="max-w-40 truncate text-sm font-medium text-ink">
                                {auth.user?.name}
                            </p>
                            <p className="max-w-40 truncate text-xs text-ink-soft">
                                {auth.role_label}
                            </p>
                        </div>
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

                <main id="main-content" className="min-w-0">
                    {children}
                </main>
            </div>
        </div>
    );
}

export function PrototypeBadge() {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-strong">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            Interactive prototype
        </span>
    );
}
