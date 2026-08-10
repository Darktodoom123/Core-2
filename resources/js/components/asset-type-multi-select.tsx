import {
    Check,
    ChevronDown,
    Construction,
    ListFilter,
    Truck,
    UserRoundCog,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    getAssetKind,
    HeavyEquipmentIcon,
} from '@/components/openstreetmap-tracking-map';
import type { AssetKind } from '@/components/openstreetmap-tracking-map';
import { cn } from '@/lib/utils';
import type { LocationUpdateViewModel } from '@/types/workspace';

const ASSET_TYPE_FILTERS: ReadonlyArray<{
    id: AssetKind;
    label: string;
}> = [
    { id: 'truck', label: 'Trucks' },
    { id: 'crane', label: 'Cranes' },
    { id: 'equipment', label: 'Heavy Eqp' },
    { id: 'personnel', label: 'Personnel' },
];

type AssetStatusFilter = 'all' | LocationUpdateViewModel['freshness_status'];

export interface AssetTypeMultiSelectProps {
    locations: LocationUpdateViewModel[];
    selectedTypes: Set<AssetKind>;
    onChange: (selectedTypes: Set<AssetKind>) => void;
    statusFilter?: AssetStatusFilter;
    label?: string;
}

export function AssetTypeMultiSelect({
    locations,
    selectedTypes,
    onChange,
    statusFilter = 'all',
    label = 'Asset:',
}: AssetTypeMultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') {
                return;
            }

            setIsOpen(false);
            window.requestAnimationFrame(() => triggerRef.current?.focus());
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const allTypesSelected =
        selectedTypes.size === 0 ||
        selectedTypes.size === ASSET_TYPE_FILTERS.length;
    const selectedLabel = allTypesSelected
        ? 'All Types'
        : selectedTypes.size === 1
          ? (ASSET_TYPE_FILTERS.find((item) => selectedTypes.has(item.id))
                ?.label ?? '1 Type')
          : `${selectedTypes.size} Types`;
    const filteredCount = locations.filter(
        (location) =>
            matchesStatus(location, statusFilter) &&
            matchesType(location, selectedTypes),
    ).length;

    const toggleType = (type: AssetKind) => {
        const next = new Set(selectedTypes);

        if (next.has(type)) {
            next.delete(type);
        } else {
            next.add(type);
        }

        onChange(next);
    };

    return (
        <div ref={menuRef} className="relative flex items-center gap-2">
            <span className="mr-1 text-xs font-semibold tracking-wider text-ink-soft uppercase">
                {label}
            </span>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                className={cn(
                    'inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                    allTypesSelected
                        ? 'bg-brand-strong font-semibold text-white shadow-xs'
                        : 'bg-brand-soft font-semibold text-brand-strong ring-1 ring-brand-strong/20',
                )}
                aria-label={`Asset type filter: ${selectedLabel}`}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-controls="asset-type-filter-menu"
            >
                <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{selectedLabel}</span>
                <span className="py-0.2 rounded-full bg-white/20 px-1.5 text-[10px] font-semibold">
                    {filteredCount}
                </span>
                <ChevronDown
                    className={cn(
                        'h-3.5 w-3.5 transition-transform',
                        isOpen && 'rotate-180',
                    )}
                    aria-hidden="true"
                />
            </button>

            {isOpen && (
                <div
                    id="asset-type-filter-menu"
                    role="menu"
                    aria-label="Asset type filters"
                    className="absolute top-full right-0 z-[1000] mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-lg ring-1 ring-black/5"
                >
                    <button
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={allTypesSelected}
                        onClick={() => onChange(new Set())}
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
                    >
                        <FilterCheck checked={allTypesSelected} />
                        <span className="min-w-0 flex-1">All Types</span>
                        <FilterCount
                            count={
                                locations.filter((location) =>
                                    matchesStatus(location, statusFilter),
                                ).length
                            }
                        />
                    </button>

                    <div className="my-1 border-t border-line" />

                    {ASSET_TYPE_FILTERS.map((item) => {
                        const count = locations.filter(
                            (location) =>
                                matchesStatus(location, statusFilter) &&
                                getAssetKind(location) === item.id,
                        ).length;
                        const isSelected = selectedTypes.has(item.id);

                        return (
                            <button
                                key={item.id}
                                type="button"
                                role="menuitemcheckbox"
                                aria-checked={isSelected}
                                onClick={() => toggleType(item.id)}
                                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
                            >
                                <FilterCheck checked={isSelected} />
                                <AssetTypeIcon type={item.id} />
                                <span className="min-w-0 flex-1">
                                    {item.label}
                                </span>
                                <FilterCount count={count} />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function matchesStatus(
    location: LocationUpdateViewModel,
    statusFilter: AssetStatusFilter,
) {
    return statusFilter === 'all' || location.freshness_status === statusFilter;
}

function matchesType(
    location: LocationUpdateViewModel,
    selectedTypes: Set<AssetKind>,
) {
    return (
        selectedTypes.size === 0 || selectedTypes.has(getAssetKind(location))
    );
}

function FilterCheck({ checked }: { checked: boolean }) {
    return (
        <span
            className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                checked
                    ? 'border-brand-strong bg-brand-strong text-white'
                    : 'border-line-strong bg-surface',
            )}
            aria-hidden="true"
        >
            {checked && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
    );
}

function FilterCount({ count }: { count: number }) {
    return (
        <span className="rounded-full bg-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
            {count}
        </span>
    );
}

function AssetTypeIcon({ type }: { type: AssetKind }) {
    const className = 'h-4 w-4 shrink-0 text-ink-soft';

    if (type === 'truck') {
        return <Truck className={className} aria-hidden="true" />;
    }

    if (type === 'crane') {
        return <Construction className={className} aria-hidden="true" />;
    }

    if (type === 'equipment') {
        return <HeavyEquipmentIcon className={className} aria-hidden="true" />;
    }

    return <UserRoundCog className={className} aria-hidden="true" />;
}
