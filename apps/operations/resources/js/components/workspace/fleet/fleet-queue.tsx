import { ChevronDown, ListFilter, Search, SearchX } from 'lucide-react';
import React, { useEffect, useId, useRef, useState } from 'react';
import { Button, EmptyState, Panel } from '@/components/ui';
import { FleetAssetCard } from '@/components/workspace/fleet/fleet-asset-card';
import { FleetTriageBar } from '@/components/workspace/fleet/fleet-triage-bar';
import type {
    FleetTriageCounts,
    FleetTriageException,
} from '@/components/workspace/fleet/fleet-triage-bar';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    LocationUpdateViewModel,
} from '@/types/workspace';

export type FleetCategoryFilter =
    'all' | 'cranes' | 'trucks' | 'available' | 'maintenance';

interface FleetCategoryFilterMenuProps {
    categoryFilter: FleetCategoryFilter;
    onCategoryFilterChange: (category: FleetCategoryFilter) => void;
    counts: {
        total: number;
        cranes: number;
        trucks: number;
        ready: number;
        maintenance: number;
    };
}

function FleetCategoryFilterMenu({
    categoryFilter,
    onCategoryFilterChange,
    counts,
}: FleetCategoryFilterMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuId = `fleet-category-menu-${useId().replace(/:/g, '')}`;

    const options = [
        { key: 'all' as const, label: 'All assets', count: counts.total },
        { key: 'cranes' as const, label: 'Cranes', count: counts.cranes },
        { key: 'trucks' as const, label: 'Transport', count: counts.trucks },
        { key: 'available' as const, label: 'Ready', count: counts.ready },
        {
            key: 'maintenance' as const,
            label: 'Holds',
            count: counts.maintenance,
        },
    ];
    const activeOption =
        options.find((option) => option.key === categoryFilter) ?? options[0];

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

    const handleSelect = (category: FleetCategoryFilter) => {
        onCategoryFilterChange(category);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative shrink-0">
            <button
                ref={triggerRef}
                type="button"
                aria-label={`Filter assets: ${activeOption.label}`}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-controls={menuId}
                onClick={() => setIsOpen((value) => !value)}
                className={cn(
                    'inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
                    categoryFilter === 'all'
                        ? 'border-line-strong bg-surface-subtle text-ink hover:bg-surface'
                        : 'border-brand-strong/40 bg-brand-soft font-semibold text-brand-strong hover:bg-brand-soft/70',
                )}
            >
                <ListFilter
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                />
                <span>Filter</span>
                <span className="max-w-24 truncate text-ink-soft">
                    {activeOption.label}
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
                    aria-label="Fleet asset category filters"
                    className="absolute top-full left-0 z-30 mt-2 w-56 rounded-lg border border-line bg-surface p-1.5 shadow-lg"
                >
                    <p className="px-2 py-1.5 text-[11px] font-semibold text-ink-soft">
                        Filter fleet assets
                    </p>
                    {options.map(({ key, label, count }) => (
                        <button
                            key={key}
                            type="button"
                            role="menuitemradio"
                            aria-checked={categoryFilter === key}
                            onClick={() => {
                                handleSelect(key);
                                triggerRef.current?.focus();
                            }}
                            className={cn(
                                'flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
                                categoryFilter === key
                                    ? 'bg-brand-soft font-semibold text-brand-strong'
                                    : 'text-ink hover:bg-surface-subtle',
                            )}
                        >
                            <span className="min-w-0 flex-1">
                                {label} ({count})
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export interface FleetQueueProps {
    assets: AssetViewModel[];
    selectedAssetId: number | null;
    onSelectAsset: (assetId: number) => void;
    locations?: LocationUpdateViewModel[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    categoryFilter: FleetCategoryFilter;
    onCategoryFilterChange: (category: FleetCategoryFilter) => void;
    counts: {
        total: number;
        cranes: number;
        trucks: number;
        ready: number;
        maintenance: number;
    };
    onClearFilters: () => void;
    triageFilter?: FleetTriageException | null;
    onTriageFilterChange?: (filter: FleetTriageException | null) => void;
    triageCounts?: FleetTriageCounts;
}

export function FleetQueue({
    assets,
    selectedAssetId,
    onSelectAsset,
    locations = [],
    searchQuery,
    onSearchChange,
    categoryFilter,
    onCategoryFilterChange,
    counts,
    onClearFilters,
    triageFilter = null,
    onTriageFilterChange,
    triageCounts,
}: FleetQueueProps) {
    const resultLabel =
        assets.length === counts.total
            ? `${counts.total} assets`
            : `${assets.length} of ${counts.total} assets`;

    return (
        <Panel className="flex max-h-[calc(100dvh-7rem)] min-h-0 flex-col overflow-hidden lg:h-full lg:max-h-none">
            <div className="shrink-0 space-y-2.5 border-b border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-ink">
                        Fleet registry
                    </h2>
                    {triageCounts && onTriageFilterChange && (
                        <FleetTriageBar
                            activeFilter={triageFilter}
                            onFilterChange={onTriageFilterChange}
                            counts={triageCounts}
                        />
                    )}
                </div>

                <label className="relative block">
                    <span className="sr-only">Search assets</span>
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search code, name, model, plate, category…"
                        className="h-10 w-full rounded-lg border border-line-strong bg-surface-subtle pr-3 pl-9 text-sm text-ink placeholder:text-ink-soft focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                    />
                </label>

                <div className="flex items-center justify-between gap-2">
                    <FleetCategoryFilterMenu
                        categoryFilter={categoryFilter}
                        onCategoryFilterChange={onCategoryFilterChange}
                        counts={counts}
                    />
                    <span
                        className="text-xs font-medium text-ink-soft tabular-nums"
                        aria-live="polite"
                    >
                        {resultLabel}
                    </span>
                </div>
            </div>

            {assets.length === 0 ? (
                <EmptyState
                    compact
                    icon={SearchX}
                    title="No matching assets"
                    message="Try another asset code, model, or filter category."
                    primaryAction={
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onClearFilters}
                        >
                            Clear filters
                        </Button>
                    }
                />
            ) : (
                <ul
                    aria-label="Fleet assets"
                    className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain"
                >
                    {assets.map((asset) => {
                        const matchingLoc = locations.find(
                            (l) => l.asset?.id === asset.id,
                        );

                        return (
                            <li key={asset.id}>
                                <FleetAssetCard
                                    asset={asset}
                                    compact
                                    isSelected={asset.id === selectedAssetId}
                                    location={matchingLoc}
                                    onSelect={onSelectAsset}
                                />
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}
