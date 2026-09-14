import { Link, router } from '@inertiajs/react';
import { LogOut, Monitor, Moon, Sun, User as UserIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTheme } from '@/lib/use-theme';
import { cn } from '@/lib/utils';
import type { User } from '@/types/auth';
import type { WorkspaceSection } from '@/types/workspace';

export interface UserAccountMenuProps {
    user: User | null;
    roleLabel: string | null;
    userInitials: string;
    isOpen: boolean;
    onClose: () => void;
    triggerRef: React.RefObject<HTMLElement | null>;
    /** @deprecated Secondary navigation items are consolidated in My Account */
    canManageUsers?: boolean;
    /** @deprecated Secondary navigation items are consolidated in My Account */
    onNavigateSection?: (section: WorkspaceSection) => void;
}

const THEME_OPTIONS = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
] as const;

export function UserAccountMenu({
    user,
    roleLabel,
    userInitials,
    isOpen,
    onClose,
    triggerRef,
}: UserAccountMenuProps) {
    const { theme, setTheme } = useTheme();
    const shouldReduceMotion = useReducedMotion();
    const menuRef = useRef<HTMLDivElement>(null);

    // Initial focus on menu opening
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            const firstFocusable = menuRef.current?.querySelector<HTMLElement>(
                'a[role="menuitem"], button[role="menuitem"]',
            );
            firstFocusable?.focus();
        });

        return () => window.cancelAnimationFrame(frame);
    }, [isOpen]);

    // Handle outside clicks and global escape key
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            const isOutsideMenu =
                menuRef.current && !menuRef.current.contains(target);
            const isOutsideTrigger =
                !triggerRef.current || !triggerRef.current.contains(target);

            if (isOutsideMenu && isOutsideTrigger) {
                onClose();
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onClose();
                triggerRef.current?.focus();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, triggerRef]);

    // Keyboard navigation with 2D spatial mapping:
    // - ArrowLeft / ArrowRight cycles through theme options
    // - ArrowDown / ArrowUp traverses vertical menu rows (Nav -> Theme -> Sign out)
    // - Home / End jumps to top / bottom
    // - Escape closes and restores focus
    const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (!menuRef.current) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            triggerRef.current?.focus();

            return;
        }

        if (event.key === 'Tab') {
            onClose();

            return;
        }

        const navItems = Array.from(
            menuRef.current.querySelectorAll<HTMLElement>(
                '[role="group"][aria-label="Account"] [role="menuitem"]',
            ),
        );
        const themeButtons = Array.from(
            menuRef.current.querySelectorAll<HTMLButtonElement>(
                'button[role="radio"]',
            ),
        );
        const signOutBtn = menuRef.current.querySelector<HTMLButtonElement>(
            'button[data-action="logout"]',
        );

        const active = document.activeElement;
        const isTheme = themeButtons.includes(active as HTMLButtonElement);
        const isNav = navItems.includes(active as HTMLElement);
        const isSignOut = active === signOutBtn;

        // Space key on link menu items should activate rather than scroll
        if (event.key === ' ' && isNav && active instanceof HTMLAnchorElement) {
            event.preventDefault();
            active.click();

            return;
        }

        if (isTheme) {
            const radioIndex = themeButtons.indexOf(
                active as HTMLButtonElement,
            );

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                const nextIndex = (radioIndex + 1) % themeButtons.length;
                themeButtons[nextIndex]?.focus();
                setTheme(THEME_OPTIONS[nextIndex].value);
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                const prevIndex =
                    (radioIndex - 1 + themeButtons.length) %
                    themeButtons.length;
                themeButtons[prevIndex]?.focus();
                setTheme(THEME_OPTIONS[prevIndex].value);
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                signOutBtn?.focus();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                navItems[navItems.length - 1]?.focus();
            } else if (event.key === 'Home') {
                event.preventDefault();
                navItems[0]?.focus();
            } else if (event.key === 'End') {
                event.preventDefault();
                signOutBtn?.focus();
            }
        } else if (isNav) {
            const navIndex = navItems.indexOf(active as HTMLElement);

            if (event.key === 'ArrowDown') {
                event.preventDefault();

                if (navIndex < navItems.length - 1) {
                    navItems[navIndex + 1]?.focus();
                } else {
                    const activeRadio =
                        themeButtons.find(
                            (btn) =>
                                btn.getAttribute('aria-checked') === 'true',
                        ) || themeButtons[0];
                    activeRadio?.focus();
                }
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();

                if (navIndex > 0) {
                    navItems[navIndex - 1]?.focus();
                } else {
                    signOutBtn?.focus();
                }
            } else if (event.key === 'Home') {
                event.preventDefault();
                navItems[0]?.focus();
            } else if (event.key === 'End') {
                event.preventDefault();
                signOutBtn?.focus();
            }
        } else if (isSignOut) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                navItems[0]?.focus();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                const activeRadio =
                    themeButtons.find(
                        (btn) => btn.getAttribute('aria-checked') === 'true',
                    ) || themeButtons[0];
                activeRadio?.focus();
            } else if (event.key === 'Home') {
                event.preventDefault();
                navItems[0]?.focus();
            } else if (event.key === 'End') {
                event.preventDefault();
                signOutBtn?.focus();
            }
        } else {
            // Container or outer boundary fallback focus
            if (event.key === 'ArrowDown' || event.key === 'Home') {
                event.preventDefault();
                navItems[0]?.focus();
            } else if (event.key === 'ArrowUp' || event.key === 'End') {
                event.preventDefault();
                signOutBtn?.focus();
            }
        }
    };

    const handleSignOut = () => {
        onClose();
        router.post('/logout');
    };

    if (!isOpen) {
        return null;
    }

    return (
        <motion.div
            ref={menuRef}
            id="user-account-menu"
            role="menu"
            aria-label="User account options"
            tabIndex={-1}
            onKeyDown={handleMenuKeyDown}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{
                duration: shouldReduceMotion ? 0 : 0.15,
                ease: [0.16, 1, 0.3, 1],
            }}
            className="absolute top-full right-0 z-50 mt-1.5 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-line bg-surface p-1.5 shadow-xl shadow-ink/10 dark:shadow-2xl dark:ring-1 dark:shadow-black/70 dark:ring-white/[0.08]"
        >
            {/* Identity Header */}
            <div className="flex items-center gap-2.5 px-2 py-1.5">
                <div className="relative shrink-0">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-xs font-bold text-brand-strong ring-1 ring-brand/20">
                        {userInitials}
                    </span>
                    <span
                        className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-surface"
                        title="Active session"
                        aria-label="Active session status: live"
                    />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">
                        {user?.name ?? 'Operations User'}
                    </p>
                    {user?.email && (
                        <p className="truncate text-[11px] text-ink-soft">
                            {user.email}
                        </p>
                    )}
                    <div className="mt-1 flex items-center">
                        <span className="inline-flex items-center rounded border border-line bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                            {roleLabel ?? 'Operations'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="my-1.5 h-px bg-line" role="separator" />

            {/* Navigation Options - Consolidated */}
            <div className="space-y-0.5" role="group" aria-label="Account">
                <Link
                    href="/account"
                    onClick={onClose}
                    className="group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-xs font-medium text-ink transition-all duration-150 hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none active:scale-[0.99]"
                    role="menuitem"
                >
                    <UserIcon
                        className="h-4 w-4 shrink-0 text-ink-soft transition-colors group-hover:text-ink"
                        aria-hidden="true"
                    />
                    <span className="truncate">My Account</span>
                </Link>
            </div>

            <div className="my-1.5 h-px bg-line" role="separator" />

            {/* Appearance Segmented Control */}
            <div className="p-0.5" role="group" aria-label="Theme">
                <div
                    role="radiogroup"
                    aria-label="Theme selection"
                    className="grid grid-cols-3 gap-1 rounded-xl border border-line/70 bg-surface-subtle/80 p-1 dark:border-white/[0.06] dark:bg-black/35"
                >
                    {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                        const isSelected = theme === value;

                        return (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                tabIndex={isSelected ? 0 : -1}
                                onClick={() => setTheme(value)}
                                className={cn(
                                    'relative flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors duration-150',
                                    'focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                                    isSelected
                                        ? 'text-ink dark:text-white'
                                        : 'text-ink-soft hover:bg-surface/50 hover:text-ink dark:text-ink-soft dark:hover:bg-white/[0.04] dark:hover:text-white',
                                )}
                            >
                                {isSelected && (
                                    <motion.span
                                        layoutId="user-account-theme-pill"
                                        aria-hidden="true"
                                        className="absolute inset-0 rounded-lg bg-surface shadow-xs ring-1 ring-black/5 dark:bg-surface-subtle dark:shadow-md dark:ring-1 dark:ring-white/[0.12]"
                                        transition={{
                                            type: shouldReduceMotion
                                                ? false
                                                : 'spring',
                                            bounce: 0,
                                            duration: shouldReduceMotion
                                                ? 0
                                                : 0.2,
                                        }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center justify-center gap-1.5">
                                    <Icon
                                        className={cn(
                                            'h-3.5 w-3.5 shrink-0 transition-colors',
                                            isSelected
                                                ? 'text-brand-strong'
                                                : 'text-ink-soft',
                                        )}
                                        aria-hidden="true"
                                    />
                                    <span
                                        className={
                                            isSelected
                                                ? 'font-semibold'
                                                : 'font-medium'
                                        }
                                    >
                                        {label}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="my-1.5 h-px bg-line" role="separator" />

            {/* Safe Isolated Destructive Action */}
            <div className="pt-0.5">
                <button
                    type="button"
                    data-action="logout"
                    onClick={handleSignOut}
                    className="group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-xs font-medium text-danger transition-all duration-150 hover:bg-danger-soft/70 hover:text-danger-strong focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none active:scale-[0.99]"
                    role="menuitem"
                >
                    <LogOut
                        className="h-4 w-4 shrink-0 text-danger transition-colors group-hover:text-danger-strong"
                        aria-hidden="true"
                    />
                    <span className="truncate font-medium">Sign out</span>
                </button>
            </div>
        </motion.div>
    );
}
