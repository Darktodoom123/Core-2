import { Search, UserRound } from 'lucide-react';
import React, { useState } from 'react';
import { EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { PersonnelCandidateViewModel } from '@/types/workspace';
import {
    ConflictDetails,
    EligibilityBadge,
    credentialSummary,
} from './dispatch-detail-helpers';

export function PersonnelCandidates({
    candidates,
    selectedIds,
    canAssign,
    onToggle,
}: {
    candidates: PersonnelCandidateViewModel[];
    selectedIds: number[];
    canAssign: boolean;
    onToggle: (candidate: PersonnelCandidateViewModel) => void;
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showEligibleOnly, setShowEligibleOnly] = useState(false);

    const groups: Array<{
        type: PersonnelCandidateViewModel['assignment_type'];
        label: string;
    }> = [
        { type: 'driver', label: 'Drivers' },
        { type: 'crane_operator', label: 'Crane operators' },
        { type: 'field_technician', label: 'Field technicians' },
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
                        placeholder="Search personnel by name or role…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md border border-line bg-surface py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-soft/70 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                        aria-label="Search personnel candidates"
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
                    const filtered = groupCandidates.filter((c) => {
                        if (showEligibleOnly && !c.eligible) {
                            return false;
                        }

                        if (searchQuery.trim()) {
                            const q = searchQuery.toLowerCase();

                            return (
                                c.name.toLowerCase().includes(q) ||
                                c.assignment_label.toLowerCase().includes(q) ||
                                Boolean(
                                    c.credential.label &&
                                    c.credential.label
                                        .toLowerCase()
                                        .includes(q),
                                )
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
                                    icon={UserRound}
                                    title={
                                        groupCandidates.length === 0
                                            ? `No ${group.label.toLowerCase()}`
                                            : `No matching ${group.label.toLowerCase()}`
                                    }
                                    message={
                                        groupCandidates.length === 0
                                            ? 'Qualified personnel will appear after their operational role is provisioned.'
                                            : 'No candidates match the active filters.'
                                    }
                                />
                            ) : (
                                <ul className="divide-y divide-line">
                                    {filtered.map((candidate) => (
                                        <PersonnelCandidate
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

export function PersonnelCandidate({
    candidate,
    selected,
    canAssign,
    onToggle,
}: {
    candidate: PersonnelCandidateViewModel;
    selected: boolean;
    canAssign: boolean;
    onToggle: (candidate: PersonnelCandidateViewModel) => void;
}) {
    const detailsId = `personnel-${candidate.id}-details`;

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
                            Select {candidate.name} as{' '}
                            {candidate.assignment_label}
                        </span>
                    </label>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <p
                            className={cn(
                                'font-medium',
                                candidate.eligible
                                    ? 'font-semibold text-ink'
                                    : 'text-ink-soft',
                            )}
                        >
                            {candidate.name}
                        </p>
                        <EligibilityBadge eligible={candidate.eligible} />
                    </div>
                    <div
                        id={detailsId}
                        className="mt-2 space-y-1 text-xs leading-5 text-ink-soft"
                    >
                        <p>
                            Availability: {candidate.availability.label} ·
                            Account: {candidate.account_status.label}
                        </p>
                        <p>{credentialSummary(candidate)}</p>
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
