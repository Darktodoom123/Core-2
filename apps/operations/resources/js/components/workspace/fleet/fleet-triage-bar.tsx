import {
    AlertCircle,
    AlertTriangle,
    ChevronDown,
    Radio,
    ShieldAlert,
    Wrench,
    X,
} from 'lucide-react';
import React, { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type FleetTriageException =
    'lockouts' | 'blocking_orders' | 'dvir_defects' | 'stale_gps';

export interface FleetTriageCounts {
    needs_attention: number;
    lockouts: number;
    blocking_orders: number;
    dvir_defects: number;
    stale_gps: number;
}

export interface FleetTriageBarProps {
    activeFilter: FleetTriageException | null;
    onFilterChange: (filter: FleetTriageException | null) => void;
    counts: FleetTriageCounts;
    className?: string;
}

export function FleetTriageBar({
    activeFilter,
    onFilterChange,
    counts,
    className,
}: FleetTriageBarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuId = `fleet-exception-menu-${useId().replace(/:/g, '')}`;

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                !containerRef.current?.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleToggle = (exception: FleetTriageException) => {
        if (activeFilter === exception) {
            onFilterChange(null);
        } else {
            onFilterChange(exception);
        }

        setIsOpen(false);
    };

    const filterOptions = [
        {
            key: 'lockouts' as const,
            label: 'Lockouts',
            count: counts.lockouts,
            Icon: ShieldAlert,
        },
        {
            key: 'blocking_orders' as const,
            label: 'Blocking orders',
            count: counts.blocking_orders,
            Icon: Wrench,
        },
        {
            key: 'dvir_defects' as const,
            label: 'DVIR defects',
            count: counts.dvir_defects,
            Icon: AlertTriangle,
        },
        {
            key: 'stale_gps' as const,
            label: 'Stale GPS',
            count: counts.stale_gps,
            Icon: Radio,
        },
    ].filter((option) => option.count > 0 || activeFilter === option.key);

    return (
        <div ref={containerRef} className={cn('relative shrink-0', className)}>
            <button
                ref={triggerRef}
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-controls={menuId}
                onClick={() => setIsOpen((value) => !value)}
                className={cn(
                    'inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
                    activeFilter
                        ? 'border-brand/40 bg-brand-soft font-semibold text-brand-strong'
                        : counts.needs_attention > 0
                          ? 'border-warning/40 bg-warning-soft text-warning-strong hover:bg-warning-soft/70'
                          : 'border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                )}
            >
                <AlertCircle
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                />
                <span>
                    Needs attention (
                    <span className="tabular-nums">
                        {counts.needs_attention}
                    </span>
                    )
                </span>
                <ChevronDown
                    className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-transform',
                        isOpen && 'rotate-180',
                    )}
                    aria-hidden="true"
                />
            </button>

            {isOpen && (
                <div
                    id={menuId}
                    role="menu"
                    aria-label="Fleet exception filters"
                    className="absolute top-full right-0 z-30 mt-2 w-64 rounded-lg border border-line bg-surface p-1.5 shadow-lg"
                >
                    {filterOptions.length > 0 ? (
                        filterOptions.map(({ key, label, count, Icon }) => (
                            <button
                                key={key}
                                type="button"
                                role="menuitemcheckbox"
                                aria-checked={activeFilter === key}
                                onClick={() => {
                                    handleToggle(key);
                                    triggerRef.current?.focus();
                                }}
                                className={cn(
                                    'flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
                                    activeFilter === key
                                        ? 'bg-brand-soft font-semibold text-brand-strong'
                                        : 'text-ink hover:bg-surface-subtle',
                                )}
                            >
                                <Icon
                                    className="h-3.5 w-3.5 shrink-0 text-ink-soft"
                                    aria-hidden="true"
                                />
                                <span className="min-w-0 flex-1">
                                    {label} (
                                    <span className="tabular-nums">
                                        {count}
                                    </span>
                                    )
                                </span>
                            </button>
                        ))
                    ) : (
                        <p className="px-2 py-2 text-xs text-ink-soft">
                            No active exceptions
                        </p>
                    )}

                    {activeFilter && (
                        <>
                            <div className="my-1 border-t border-line" />
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    onFilterChange(null);
                                    setIsOpen(false);
                                    triggerRef.current?.focus();
                                }}
                                className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                                Clear exception filter
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
