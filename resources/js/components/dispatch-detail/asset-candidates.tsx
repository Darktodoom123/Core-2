import { Link } from '@inertiajs/react';
import { Search, Truck } from 'lucide-react';
import React, { useState } from 'react';
import { EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { AssetCandidateViewModel } from '@/types/workspace';
import { ConflictDetails, EligibilityBadge } from './dispatch-detail-helpers';

export function AssetCandidates({
    candidates,
    selectedIds,
    canAssign,
    onToggle,
    assetCatalogAccess,
}: {
    candidates: AssetCandidateViewModel[];
    selectedIds: number[];
    canAssign: boolean;
    onToggle: (candidate: AssetCandidateViewModel) => void;
    assetCatalogAccess: {
        fleet: boolean;
        equipment: boolean;
    };
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showEligibleOnly, setShowEligibleOnly] = useState(false);

    const groups: Array<{
        type: AssetCandidateViewModel['assignment_type'];
        label: string;
    }> = [
        { type: 'truck', label: 'Trucks' },
        { type: 'crane', label: 'Cranes' },
        { type: 'equipment', label: 'Equipment' },
    ];

    const eligibleCount = candidates.filter((c) => c.eligible).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-subtle/50 px-3.5 py-2.5">
                <div className="relative max-w-sm min-w-[14rem] flex-1">
                    <Search
                        className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft"
                        aria-hidden="true"
                    />
                    <input
                        type="text"
                        placeholder="Search assets by code or name…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md border border-line bg-surface py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-soft/70 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                        aria-label="Search asset candidates"
                    />
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-ink-soft select-none hover:text-ink">
                        <input
                            type="checkbox"
                            checked={showEligibleOnly}
                            onChange={(e) =>
                                setShowEligibleOnly(e.target.checked)
                            }
                            className="h-4 w-4 rounded accent-brand"
                        />
                        <span>
                            Show eligible only ({eligibleCount}/
                            {candidates.length})
                        </span>
                    </label>
                </div>
            </div>

            <div className="grid gap-4 2xl:grid-cols-3">
                {groups.map((group) => {
                    const groupCandidates = candidates.filter(
                        (candidate) => candidate.assignment_type === group.type,
                    );
                    const catalogAccess =
                        group.type === 'truck'
                            ? assetCatalogAccess.fleet
                            : assetCatalogAccess.equipment;
                    const catalogHref =
                        group.type === 'truck'
                            ? '/operations/fleet/assets'
                            : '/operations/equipment/assets';
                    const catalogLabel =
                        group.type === 'truck'
                            ? 'Open fleet asset catalog'
                            : 'Open equipment catalog';

                    const filtered = groupCandidates.filter((c) => {
                        if (showEligibleOnly && !c.eligible) {
                            return false;
                        }

                        if (searchQuery.trim()) {
                            const q = searchQuery.toLowerCase();

                            return (
                                c.code.toLowerCase().includes(q) ||
                                c.name.toLowerCase().includes(q) ||
                                c.assignment_label.toLowerCase().includes(q)
                            );
                        }

                        return true;
                    });

                    return (
                        <fieldset
                            key={group.type}
                            className="min-w-0 rounded-xl border border-line bg-surface shadow-2xs"
                        >
                            <legend className="sr-only">{group.label}</legend>
                            <div className="flex items-center justify-between border-b border-line px-4 py-3">
                                <div>
                                    <h3 className="text-sm font-semibold">
                                        {group.label}
                                    </h3>
                                    <p className="mt-0.5 text-xs text-ink-soft">
                                        {
                                            groupCandidates.filter(
                                                (resource) => resource.eligible,
                                            ).length
                                        }{' '}
                                        eligible of {groupCandidates.length}
                                    </p>
                                </div>
                                <span
                                    className={cn(
                                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                        groupCandidates.some((c) => c.eligible)
                                            ? 'bg-success-soft text-success-strong'
                                            : 'bg-surface-subtle text-ink-soft',
                                    )}
                                >
                                    {
                                        groupCandidates.filter(
                                            (c) => c.eligible,
                                        ).length
                                    }{' '}
                                    ready
                                </span>
                            </div>
                            {filtered.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={Truck}
                                    title={
                                        groupCandidates.length === 0
                                            ? `No ${group.label.toLowerCase()}`
                                            : `No matching ${group.label.toLowerCase()}`
                                    }
                                    message={
                                        catalogAccess
                                            ? 'No Core 3 assets in this category are available for this dispatch window.'
                                            : 'Ask the Core 3 asset administrator to import an eligible asset for this dispatch.'
                                    }
                                    primaryAction={
                                        catalogAccess ? (
                                            <Link
                                                href={catalogHref}
                                                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-subtle"
                                            >
                                                {catalogLabel}
                                            </Link>
                                        ) : undefined
                                    }
                                />
                            ) : (
                                <ul className="divide-y divide-line">
                                    {filtered.map((candidate) => (
                                        <AssetCandidate
                                            key={candidate.id}
                                            candidate={candidate}
                                            selected={selectedIds.includes(
                                                candidate.id,
                                            )}
                                            canAssign={canAssign}
                                            onToggle={onToggle}
                                        />
                                    ))}
                                </ul>
                            )}
                        </fieldset>
                    );
                })}
            </div>
        </div>
    );
}

export function AssetCandidate({
    candidate,
    selected,
    canAssign,
    onToggle,
}: {
    candidate: AssetCandidateViewModel;
    selected: boolean;
    canAssign: boolean;
    onToggle: (candidate: AssetCandidateViewModel) => void;
}) {
    const detailsId = `asset-${candidate.id}-details`;

    return (
        <li
            className={cn(
                'p-4 transition-colors',
                selected && 'border-l-4 border-l-brand bg-brand-soft/50',
                !candidate.eligible && 'bg-surface-subtle/50',
            )}
        >
            <div className="flex min-h-11 items-start gap-1">
                {canAssign && (
                    <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-start justify-center pt-1">
                        <input
                            type="checkbox"
                            checked={selected}
                            disabled={!candidate.eligible}
                            onChange={() => onToggle(candidate)}
                            aria-describedby={detailsId}
                            className="h-5 w-5 cursor-pointer accent-[var(--color-brand)] disabled:cursor-not-allowed"
                        />
                        <span className="sr-only">
                            Select {candidate.code} · {candidate.name}
                        </span>
                    </label>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <p
                                className={cn(
                                    'font-medium',
                                    candidate.eligible
                                        ? 'font-semibold text-ink'
                                        : 'text-ink-soft',
                                )}
                            >
                                {candidate.code}
                            </p>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                {candidate.name}
                            </p>
                        </div>
                        <EligibilityBadge eligible={candidate.eligible} />
                    </div>
                    <div
                        id={detailsId}
                        className="mt-2 space-y-1 text-xs leading-5 text-ink-soft"
                    >
                        <p>
                            Readiness: {candidate.readiness.label} · Maintenance
                            blocks: {candidate.blocking_maintenance_count}
                        </p>
                        <ConflictDetails
                            reasons={candidate.reasons}
                            conflicts={candidate.schedule_conflicts}
                        />
                    </div>
                </div>
            </div>
        </li>
    );
}
