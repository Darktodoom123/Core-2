import { UserMinus, UserPlus } from 'lucide-react';
import { humanize } from '@/lib/formatters';
import type { ApprovalViewModel } from '@/types/workspace';

interface ApprovalResourceDeltaProps {
    requestedChanges: ApprovalViewModel['requested_changes'];
}

export function ApprovalResourceDelta({
    requestedChanges,
}: ApprovalResourceDeltaProps) {
    const { personnel, assets, ended_personnel, ended_assets } =
        requestedChanges;

    const hasEnded = ended_personnel.length > 0 || ended_assets.length > 0;
    const hasAdded = personnel.length > 0 || assets.length > 0;

    if (!hasEnded && !hasAdded) {
        return (
            <div className="rounded-lg border border-line bg-surface-subtle/50 px-3.5 py-2.5 text-xs text-ink-soft">
                This request covers dispatch plan activation without new
                resource allocations.
            </div>
        );
    }

    return (
        <div className="space-y-2.5">
            <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold tracking-wider text-ink-soft uppercase">
                    Proposed Resource Allocation Delta
                </h3>
                <span className="text-[11px] font-medium text-ink-soft">
                    {hasEnded &&
                        `${ended_personnel.length + ended_assets.length} removed`}
                    {hasEnded && hasAdded && ' · '}
                    {hasAdded && `${personnel.length + assets.length} proposed`}
                </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                {/* Ending Active Assignments */}
                {hasEnded ? (
                    <div className="flex flex-col rounded-xl border border-danger/25 bg-danger-soft/15 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-danger-strong">
                            <UserMinus className="h-3.5 w-3.5 shrink-0 text-danger" />
                            <span>
                                Ending Assignments (
                                {ended_personnel.length + ended_assets.length})
                            </span>
                        </div>

                        <ul className="mt-2.5 space-y-1.5">
                            {ended_personnel.map((person) => (
                                <li
                                    key={`ended-personnel-${person.id}`}
                                    className="flex items-center justify-between rounded-lg border border-danger/20 bg-surface px-2.5 py-1.5 text-xs"
                                >
                                    <div className="min-w-0 pr-2">
                                        <p className="truncate font-semibold text-ink">
                                            {person.name}
                                        </p>
                                        <p className="text-[10px] text-ink-soft">
                                            {humanize(person.assignment_type)}
                                        </p>
                                    </div>
                                    <span className="shrink-0 rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger-strong">
                                        Replaced
                                    </span>
                                </li>
                            ))}

                            {ended_assets.map((asset) => (
                                <li
                                    key={`ended-asset-${asset.id}`}
                                    className="flex items-center justify-between rounded-lg border border-danger/20 bg-surface px-2.5 py-1.5 text-xs"
                                >
                                    <div className="min-w-0 pr-2">
                                        <p className="truncate font-semibold text-ink">
                                            <span className="font-mono text-ink-soft">
                                                {asset.code}
                                            </span>{' '}
                                            · {asset.name}
                                        </p>
                                        <p className="text-[10px] text-ink-soft">
                                            {humanize(asset.assignment_type)}
                                        </p>
                                    </div>
                                    <span className="shrink-0 rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger-strong">
                                        Replaced
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="flex flex-col justify-center rounded-xl border border-dashed border-line bg-surface-subtle/30 p-3 text-center text-xs text-ink-soft">
                        No active resources ending
                    </div>
                )}

                {/* Proposed Replacement Allocations */}
                {hasAdded ? (
                    <div className="flex flex-col rounded-xl border border-success/30 bg-success-soft/20 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-success-strong">
                            <UserPlus className="h-3.5 w-3.5 shrink-0 text-success" />
                            <span>
                                Proposed Allocations (
                                {personnel.length + assets.length})
                            </span>
                        </div>

                        <ul className="mt-2.5 space-y-1.5">
                            {personnel.map((person) => (
                                <li
                                    key={`personnel-${person.id}`}
                                    className="flex items-center justify-between rounded-lg border border-success/25 bg-surface px-2.5 py-1.5 text-xs"
                                >
                                    <div className="min-w-0 pr-2">
                                        <p className="truncate font-semibold text-ink">
                                            {person.name}
                                        </p>
                                        <p className="text-[10px] text-ink-soft">
                                            {humanize(person.assignment_type)}
                                        </p>
                                    </div>
                                    <span className="shrink-0 rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success-strong">
                                        Proposed
                                    </span>
                                </li>
                            ))}

                            {assets.map((asset) => (
                                <li
                                    key={`asset-${asset.id}`}
                                    className="flex items-center justify-between rounded-lg border border-success/25 bg-surface px-2.5 py-1.5 text-xs"
                                >
                                    <div className="min-w-0 pr-2">
                                        <p className="truncate font-semibold text-ink">
                                            <span className="font-mono text-ink-soft">
                                                {asset.code}
                                            </span>{' '}
                                            · {asset.name}
                                        </p>
                                        <p className="text-[10px] text-ink-soft">
                                            {humanize(asset.assignment_type)}
                                        </p>
                                    </div>
                                    <span className="shrink-0 rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success-strong">
                                        Proposed
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="flex flex-col justify-center rounded-xl border border-dashed border-line bg-surface-subtle/30 p-3 text-center text-xs text-ink-soft">
                        No new resources added
                    </div>
                )}
            </div>
        </div>
    );
}
