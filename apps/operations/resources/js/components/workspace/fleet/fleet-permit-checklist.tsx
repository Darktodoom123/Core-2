import { RefreshCw, Upload } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui';
import { FleetPill } from '@/components/workspace/fleet/fleet-detail-primitives';
import { describeDaysLeft } from '@/components/workspace/fleet/fleet-permit-status';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetPermitComplianceViewModel,
    AssetPermitItemViewModel,
} from '@/types/workspace';

export interface FleetPermitChecklistProps {
    assetCode: string;
    compliance: AssetPermitComplianceViewModel;
    canManage: boolean;
    warningDays?: number;
    onUpload: (item: AssetPermitItemViewModel) => void;
    onRenew: (item: AssetPermitItemViewModel) => void;
}

function describeItem(item: AssetPermitItemViewModel): {
    text: string;
    tone: 'danger' | 'warning' | 'success' | 'neutral';
} {
    if (item.state === 'missing') {
        return {
            text: item.blocks_dispatch
                ? 'Missing · blocks dispatch'
                : 'Missing · required for this asset type',
            tone: item.blocks_dispatch ? 'danger' : 'neutral',
        };
    }

    if (item.state === 'revoked') {
        return { text: 'Revoked · blocks dispatch', tone: 'danger' };
    }

    if (item.state === 'expired') {
        return {
            text: `Expired ${item.expires_at ? formatDate(item.expires_at) : ''} · blocks dispatch`,
            tone: 'danger',
        };
    }

    if (item.expires_at === null || item.days_left === null) {
        return { text: 'Valid · no expiry date', tone: 'success' };
    }

    return {
        text: `Valid until ${formatDate(item.expires_at)}`,
        tone: 'success',
    };
}

/**
 * Required permits for this asset type, one slot each, with the next action.
 */
export function FleetPermitChecklist({
    assetCode,
    compliance,
    canManage,
    warningDays = 30,
    onUpload,
    onRenew,
}: FleetPermitChecklistProps) {
    return (
        <section
            aria-labelledby={`permit-checklist-${assetCode}`}
            className="rounded-xl border border-line bg-surface"
        >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <h4
                    id={`permit-checklist-${assetCode}`}
                    className="text-sm font-semibold text-ink"
                >
                    Required permits
                </h4>
                {compliance.blocks_dispatch ? (
                    <FleetPill tone="danger" dot>
                        Can't be dispatched
                    </FleetPill>
                ) : compliance.state === 'valid' ? (
                    <FleetPill tone="success" dot>
                        All required permits valid
                    </FleetPill>
                ) : null}
            </div>
            <ul className="divide-y divide-line">
                {compliance.items.map((item) => {
                    const expiringSoon =
                        item.state === 'valid' &&
                        item.days_left !== null &&
                        item.days_left <= warningDays;
                    const described = expiringSoon
                        ? {
                              text: `Expires ${describeDaysLeft(item.days_left ?? 0)} · ${formatDate(item.expires_at ?? '')}`,
                              tone: 'warning' as const,
                          }
                        : describeItem(item);
                    const needsAction = item.state !== 'valid' || expiringSoon;

                    return (
                        <li
                            key={item.category}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-ink">
                                    {item.label}
                                </p>
                                <p
                                    className={cn(
                                        'text-xs',
                                        described.tone === 'danger' &&
                                            'font-medium text-danger-strong',
                                        described.tone === 'warning' &&
                                            'font-medium text-warning-strong',
                                        described.tone === 'success' &&
                                            'text-success-strong',
                                        described.tone === 'neutral' &&
                                            'text-ink-soft',
                                    )}
                                >
                                    {described.text}
                                </p>
                            </div>
                            {canManage && needsAction && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="min-h-9"
                                    onClick={() =>
                                        item.state === 'missing'
                                            ? onUpload(item)
                                            : onRenew(item)
                                    }
                                    aria-label={`${item.state === 'missing' ? 'Upload' : 'Renew'} ${item.label}`}
                                >
                                    {item.state === 'missing' ? (
                                        <Upload
                                            className="h-3.5 w-3.5"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <RefreshCw
                                            className="h-3.5 w-3.5"
                                            aria-hidden="true"
                                        />
                                    )}
                                    {item.state === 'missing'
                                        ? 'Upload'
                                        : 'Renew'}
                                </Button>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
