import {
    AlertTriangle,
    Check,
    Clock3,
    HardHat,
    ShieldCheck,
    Wrench,
} from 'lucide-react';
import React from 'react';
import { Skeleton } from '@/components/ui';
import { formatDateTime, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    PersonnelCandidateViewModel,
    WorkspaceFlash,
} from '@/types/workspace';

export function ResourceIcon({ icon }: { icon: 'personnel' | 'asset' }) {
    const Icon = icon === 'personnel' ? HardHat : Wrench;

    return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft">
            <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
    );
}

export function credentialSummary(candidate: PersonnelCandidateViewModel) {
    if (
        !candidate.credential.kind ||
        candidate.credential.status === 'not_required'
    ) {
        return 'Standard operational qualification checked';
    }

    const expiry = candidate.credential.expires_at
        ? ` · Expires ${candidate.credential.expires_at}`
        : '';

    return `Credential: ${candidate.credential.label} (${humanize(candidate.credential.status)})${expiry}`;
}

export function formatResourceCounts(
    personnelCount: number,
    assetCount: number,
) {
    return `${personnelCount} ${personnelCount === 1 ? 'person' : 'people'}, ${assetCount} asset${assetCount === 1 ? '' : 's'}`;
}

export function isAssignmentSuccessFlash(flash: WorkspaceFlash | null) {
    if (!flash || flash.tone !== 'success') {
        return false;
    }

    return (
        flash.message.includes('Resources were assigned') ||
        flash.message.includes('Assignments were updated')
    );
}

export function getSafeReturnTo() {
    if (typeof window === 'undefined') {
        return '/';
    }

    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('return_to');

    if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
        return '/';
    }

    return returnTo;
}

export function EligibilityBadge({ eligible }: { eligible: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-2xs',
                eligible
                    ? 'bg-success-soft text-success-strong'
                    : 'bg-danger-soft text-danger',
            )}
        >
            {eligible ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {eligible ? 'Eligible' : 'Blocked'}
        </span>
    );
}

export function ConflictDetails({
    reasons,
    conflicts,
}: {
    reasons: string[];
    conflicts: PersonnelCandidateViewModel['schedule_conflicts'];
}) {
    if (reasons.length === 0) {
        return (
            <p className="mt-1 inline-flex items-center gap-1.5 font-medium text-success-strong">
                <ShieldCheck
                    className="h-3.5 w-3.5 shrink-0 text-success-strong"
                    aria-hidden="true"
                />
                No blocking conflict at this schedule.
            </p>
        );
    }

    return (
        <div className="mt-1.5 space-y-1 rounded-md border border-danger/20 bg-danger-soft/60 p-2 text-xs text-danger">
            <ul className="space-y-1">
                {reasons.map((reason) => (
                    <li
                        key={reason}
                        className="flex items-start gap-1.5 font-medium"
                    >
                        <AlertTriangle
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        <span>{reason}</span>
                    </li>
                ))}
            </ul>
            {conflicts.length > 0 && (
                <p className="flex items-start gap-1.5 border-t border-danger/20 pt-1 text-danger">
                    <Clock3
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                    />
                    <span>
                        {conflicts
                            .map(
                                (conflict) =>
                                    `${conflict.reference} (${formatDateTime(conflict.scheduled_start)} – ${formatDateTime(conflict.scheduled_end)})`,
                            )
                            .join('; ')}
                    </span>
                </p>
            )}
        </div>
    );
}

export function SelectionGroup({
    label,
    items,
    emptyMessage,
}: {
    label: string;
    items: string[];
    emptyMessage: string;
}) {
    return (
        <div>
            <p className="text-xs font-medium text-ink-soft">{label}</p>
            {items.length > 0 ? (
                <ul className="mt-1 space-y-1">
                    {items.map((item) => (
                        <li
                            key={item}
                            className="truncate text-xs font-medium text-ink"
                        >
                            • {item}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-1 text-xs text-ink-soft">{emptyMessage}</p>
            )}
        </div>
    );
}

export function CandidateListSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
        </div>
    );
}
