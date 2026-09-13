import { Search, SearchX } from 'lucide-react';
import React from 'react';
import { Button, EmptyState, Panel } from '@/components/ui';
import { FleetAssetCard } from '@/components/workspace/fleet/fleet-asset-card';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    LocationUpdateViewModel,
} from '@/types/workspace';

export type FleetCategoryFilter =
    'all' | 'cranes' | 'trucks' | 'available' | 'maintenance';

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
}: FleetQueueProps) {
    return (
        <Panel className="overflow-hidden">
            <div className="space-y-3 border-b border-line p-3.5">
                <label className="relative block">
                    <span className="sr-only">Search assets</span>
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search code, name, model, plate, category…"
                        className="h-9 w-full rounded-lg border border-line-strong bg-surface-subtle pr-3 pl-9 text-xs text-ink placeholder:text-ink-soft focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                    />
                </label>

                {/* Compact Category Filter Buttons */}
                <div
                    className="flex flex-wrap gap-1"
                    role="group"
                    aria-label="Filter fleet assets"
                >
                    <button
                        type="button"
                        aria-pressed={categoryFilter === 'all'}
                        onClick={() => onCategoryFilterChange('all')}
                        className={cn(
                            'inline-flex min-h-7 items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
                            categoryFilter === 'all'
                                ? 'bg-ink font-semibold text-canvas'
                                : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                        )}
                    >
                        All (
                        <span className="tabular-nums">{counts.total}</span>)
                    </button>
                    <button
                        type="button"
                        aria-pressed={categoryFilter === 'cranes'}
                        onClick={() => onCategoryFilterChange('cranes')}
                        className={cn(
                            'inline-flex min-h-7 items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
                            categoryFilter === 'cranes'
                                ? 'border border-brand/40 bg-brand-soft font-semibold text-brand-strong'
                                : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                        )}
                    >
                        Cranes (
                        <span className="tabular-nums">{counts.cranes}</span>)
                    </button>
                    <button
                        type="button"
                        aria-pressed={categoryFilter === 'trucks'}
                        onClick={() => onCategoryFilterChange('trucks')}
                        className={cn(
                            'inline-flex min-h-7 items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
                            categoryFilter === 'trucks'
                                ? 'border border-line-strong bg-surface-subtle font-semibold text-ink'
                                : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                        )}
                    >
                        Transport (
                        <span className="tabular-nums">{counts.trucks}</span>)
                    </button>
                    <button
                        type="button"
                        aria-pressed={categoryFilter === 'available'}
                        onClick={() => onCategoryFilterChange('available')}
                        className={cn(
                            'inline-flex min-h-7 items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
                            categoryFilter === 'available'
                                ? 'border border-success/40 bg-success-soft font-semibold text-success-strong'
                                : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                        )}
                    >
                        Ready (
                        <span className="tabular-nums">{counts.ready}</span>)
                    </button>
                    <button
                        type="button"
                        aria-pressed={categoryFilter === 'maintenance'}
                        onClick={() => onCategoryFilterChange('maintenance')}
                        className={cn(
                            'inline-flex min-h-7 items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
                            categoryFilter === 'maintenance'
                                ? 'border border-warning/40 bg-warning-soft font-semibold text-warning-strong'
                                : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                        )}
                    >
                        Holds (
                        <span className="tabular-nums">
                            {counts.maintenance}
                        </span>
                        )
                    </button>
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
                <ul className="divide-y divide-line">
                    {assets.map((asset) => {
                        const matchingLoc = locations.find(
                            (l) => l.asset?.id === asset.id,
                        );

                        return (
                            <li key={asset.id}>
                                <FleetAssetCard
                                    asset={asset}
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
