import { FileCheck, FileClock, FileQuestionMark, FileX } from 'lucide-react';
import React, { useMemo } from 'react';
import { getFleetPermitIssue } from '@/components/workspace/fleet/fleet-permit-status';
import type { FleetTriageException } from '@/components/workspace/fleet/fleet-triage-bar';
import { cn } from '@/lib/utils';
import type { AssetViewModel } from '@/types/workspace';

type PermitFilter = Extract<
    FleetTriageException,
    'permit_expired' | 'permit_expiring' | 'permit_missing'
>;

export interface FleetPermitRenewalsProps {
    assets: AssetViewModel[];
    activeFilter: FleetTriageException | null;
    onFilterChange: (filter: FleetTriageException | null) => void;
}

/**
 * Fleet-wide permit renewal queue: each count filters the asset list.
 */
export function FleetPermitRenewals({
    assets,
    activeFilter,
    onFilterChange,
}: FleetPermitRenewalsProps) {
    const counts = useMemo(() => {
        const result = {
            expired: 0,
            expiring: 0,
            missing: 0,
            valid: 0,
            tracked: 0,
        };

        for (const asset of assets) {
            const state = asset.permit_compliance?.state;

            if (!state || state === 'not_required') {
                continue;
            }

            result.tracked += 1;
            const issue = getFleetPermitIssue(asset);

            if (issue) {
                result[issue] += 1;
            } else {
                result.valid += 1;
            }
        }

        return result;
    }, [assets]);

    if (counts.tracked === 0) {
        return null;
    }

    const tiles: Array<{
        filter: PermitFilter | null;
        label: string;
        count: number;
        Icon: typeof FileX;
        tone: 'danger' | 'warning' | 'neutral' | 'success';
    }> = [
        {
            filter: 'permit_expired',
            label: 'Expired or revoked',
            count: counts.expired,
            Icon: FileX,
            tone: 'danger',
        },
        {
            filter: 'permit_expiring',
            label: 'Expiring within 30 days',
            count: counts.expiring,
            Icon: FileClock,
            tone: 'warning',
        },
        {
            filter: 'permit_missing',
            label: 'Missing required permit',
            count: counts.missing,
            Icon: FileQuestionMark,
            tone: 'neutral',
        },
        {
            filter: null,
            label: 'All permits valid',
            count: counts.valid,
            Icon: FileCheck,
            tone: 'success',
        },
    ];

    return (
        <section aria-labelledby="fleet-permit-renewals-heading">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2
                    id="fleet-permit-renewals-heading"
                    className="text-sm font-semibold text-ink"
                >
                    Permit renewals
                </h2>
                <p className="text-xs text-ink-soft">
                    <span className="tabular-nums">{counts.valid}</span> of{' '}
                    <span className="tabular-nums">{counts.tracked}</span>{' '}
                    assets fully compliant
                </p>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {tiles.map(({ filter, label, count, Icon, tone }) => {
                    const isActive = filter !== null && activeFilter === filter;
                    const content = (
                        <>
                            <span className="flex items-center gap-1.5 text-xs font-medium">
                                <Icon
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                {label}
                            </span>
                            <span className="mt-1 block text-xl font-semibold text-ink tabular-nums">
                                {count}
                            </span>
                        </>
                    );
                    const toneClasses = cn(
                        tone === 'danger' && count > 0 && 'text-danger-strong',
                        tone === 'warning' &&
                            count > 0 &&
                            'text-warning-strong',
                        tone === 'success' && 'text-success-strong',
                        (tone === 'neutral' || count === 0) &&
                            tone !== 'success' &&
                            'text-ink-soft',
                    );

                    if (filter === null) {
                        return (
                            <div
                                key={label}
                                className={cn(
                                    'rounded-lg border border-line bg-surface px-3 py-2.5',
                                    toneClasses,
                                )}
                            >
                                {content}
                            </div>
                        );
                    }

                    return (
                        <button
                            key={label}
                            type="button"
                            aria-pressed={isActive}
                            disabled={count === 0 && !isActive}
                            onClick={() =>
                                onFilterChange(isActive ? null : filter)
                            }
                            className={cn(
                                'rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden disabled:cursor-default',
                                isActive
                                    ? 'border-brand-strong/50 bg-brand-soft'
                                    : 'border-line bg-surface enabled:hover:bg-surface-subtle',
                                toneClasses,
                            )}
                        >
                            {content}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
