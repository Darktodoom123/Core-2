import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowUpRight,
    Check,
    Clock,
    Construction,
    LoaderCircle,
    RefreshCw,
    Sparkles,
    Truck,
    User,
    Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui';
import { formatResourceCount, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { GptRecommendationViewModel } from '@/types/workspace';

export { formatResourceCount };

export interface DispatchAdvisoryCardProps {
    jobId: number;
    recommendation?: GptRecommendationViewModel;
    automatic: boolean;
    busy: boolean;
    canRequest: boolean;
    canReview: boolean;
    canRetry: boolean;
    canViewHistory?: boolean;
    error: string | null;
    assignmentUrl?: string;
    manualAssignmentUrl?: string;
    onRequest: () => void;
    onRetry: () => void;
    onReview: (
        selectedPersonnelIds?: number[],
        selectedAssetIds?: number[],
    ) => void;
    onApply?: (
        selectedPersonnelIds: number[],
        selectedAssetIds: number[],
    ) => void;
    onReject: () => void;
    details?: ReactNode;
    appliedNotice?: string | null;
}

export function DispatchAdvisoryCard({
    jobId,
    recommendation: rec,
    automatic,
    busy,
    canRequest,
    canReview,
    canRetry,
    error,
    assignmentUrl,
    manualAssignmentUrl,
    onRequest,
    onRetry,
    onReview,
    onApply,
    onReject,
    details,
    appliedNotice,
}: DispatchAdvisoryCardProps) {
    const manualUrl = manualAssignmentUrl ?? assignmentUrl;
    const queued = rec?.status === 'draft';
    const processing = rec?.status === 'processing';
    const pending = busy || queued || processing;

    const [prevRecKey, setPrevRecKey] = useState<string | null>(() =>
        rec ? `${rec.id}:${rec.context_hash}:${rec.status}` : null,
    );
    const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<number[]>(
        () => (rec?.proposed_personnel ?? []).map((p) => p.user_id),
    );
    const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>(() =>
        (rec?.proposed_assets ?? []).map((a) => a.operational_asset_id),
    );

    const currentRecKey = rec
        ? `${rec.id}:${rec.context_hash}:${rec.status}`
        : null;

    if (currentRecKey !== prevRecKey) {
        setPrevRecKey(currentRecKey);
        setSelectedPersonnelIds(
            (rec?.proposed_personnel ?? []).map((p) => p.user_id),
        );
        setSelectedAssetIds(
            (rec?.proposed_assets ?? []).map((a) => a.operational_asset_id),
        );
    }

    const togglePersonnel = (userId: number) => {
        setSelectedPersonnelIds((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId],
        );
    };

    const toggleAsset = (assetId: number) => {
        setSelectedAssetIds((prev) =>
            prev.includes(assetId)
                ? prev.filter((id) => id !== assetId)
                : [...prev, assetId],
        );
    };

    const selectedPersonnelCount = selectedPersonnelIds.length;
    const selectedAssetCount = selectedAssetIds.length;
    const totalSelected = selectedPersonnelCount + selectedAssetCount;
    const hasConflicts = Boolean(rec?.conflicts && rec.conflicts.length > 0);

    const [prevPending, setPrevPending] = useState(pending);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    if (prevPending !== pending) {
        setPrevPending(pending);

        if (!pending) {
            setElapsedSeconds(0);
        }
    }

    useEffect(() => {
        if (!pending) {
            return;
        }

        const timer = window.setInterval(() => {
            setElapsedSeconds((prev) => prev + 1);
        }, 1000);

        return () => {
            window.clearInterval(timer);
        };
    }, [pending]);

    const isProlonged = pending && elapsedSeconds >= 25;
    const expired =
        rec?.status !== 'accepted' &&
        (rec?.is_expired || rec?.status === 'expired');
    const stale =
        rec?.status !== 'accepted' &&
        (rec?.is_stale || rec?.status === 'stale');
    const ready =
        rec?.status === 'pending_review' && !expired && !stale && !pending;
    const accepted = rec?.status === 'accepted';
    const personnel = rec?.proposed_personnel ?? [];
    const assets = rec?.proposed_assets ?? [];
    const hasResources = personnel.length > 0 || assets.length > 0;
    const showResources = !pending && hasResources;
    const status = pending
        ? processing
            ? 'Checking resources'
            : 'Queued'
        : expired
          ? 'Expired'
          : stale
            ? 'Needs refresh'
            : accepted
              ? 'Applied'
              : rec?.status === 'failed'
                ? 'Unavailable'
                : rec?.status === 'rejected'
                  ? 'Declined'
                  : ready
                    ? 'Ready to review'
                    : automatic
                      ? 'Automatic'
                      : 'On request';
    const title = pending
        ? processing
            ? 'Finding suitable resources'
            : 'Suggestion queued'
        : expired || stale
          ? 'Refresh before applying'
          : rec?.status === 'failed'
            ? 'Suggestion unavailable'
            : rec?.status === 'rejected'
              ? 'Suggestion declined'
              : accepted
                ? 'Resource plan applied'
                : ready
                  ? hasResources
                      ? 'Suggested resources'
                      : 'No resources proposed'
                  : 'Waiting for a suggestion';
    const description = pending
        ? processing
            ? 'Checking crew availability, equipment fit, and scheduling conflicts.'
            : 'The resource check is queued. Your suggestion will appear here when ready.'
        : expired || stale
          ? 'Availability may have changed. Request a fresh suggestion before assigning resources.'
          : rec?.status === 'failed'
            ? rec.error_message ||
              'The resource check could not finish. Try again or review assignments manually.'
            : rec?.status === 'rejected'
              ? 'You can request another suggestion or choose resources in the assignment workspace.'
              : accepted
                ? 'This suggestion was confirmed. Review current assignments in the job details.'
                : ready
                  ? hasResources
                      ? 'Review the proposed crew and equipment before confirming.'
                      : 'Review the advisory notes or choose resources in the assignment workspace.'
                  : automatic
                    ? 'Eligible jobs are checked automatically. Crew and equipment suggestions will appear here when ready.'
                    : 'Request a resource check to find suitable crew and equipment for this job.';
    const retry = Boolean(rec?.is_retryable && canRetry);
    const allowRequest = !pending && !ready && !retry && canRequest;
    const canRefreshExpired = (expired || stale) && (canRetry || canRequest);

    const badgeVariant = pending
        ? processing
            ? 'bg-brand-soft text-brand-strong'
            : 'bg-surface-subtle text-ink-soft'
        : ready || accepted
          ? 'bg-success-soft text-success-strong'
          : expired || stale
            ? 'border-line bg-surface-subtle text-ink-soft'
            : rec?.status === 'failed'
              ? 'bg-danger-soft text-danger-strong'
              : 'bg-surface-subtle text-ink-soft';

    const badgeIcon = processing ? (
        <LoaderCircle
            className="h-3 w-3 motion-safe:animate-spin"
            aria-hidden="true"
        />
    ) : ready || accepted ? (
        <Check className="h-3 w-3" aria-hidden="true" />
    ) : expired || stale ? (
        <span
            className="h-1.5 w-1.5 rounded-full bg-amber-500"
            aria-hidden="true"
        />
    ) : rec?.status === 'failed' ? (
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
    ) : (
        <Clock className="h-3 w-3" aria-hidden="true" />
    );

    return (
        <section
            className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-xs transition-colors"
            aria-labelledby={`dispatch-gpt-advisory-${jobId}`}
        >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3.5">
                <div className="min-w-0">
                    <h3
                        id={`dispatch-gpt-advisory-${jobId}`}
                        className="flex items-center gap-1.5 text-sm font-semibold text-ink"
                    >
                        <Sparkles
                            className="h-4 w-4 shrink-0 text-brand"
                            aria-hidden="true"
                        />
                        <span>AI assistance</span>
                    </h3>
                    <h4 className="mt-0.5 text-xs font-semibold text-ink">
                        GPT dispatch advisory
                    </h4>
                    {rec && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-medium text-ink-soft">
                                Recommendation #{rec.id}
                            </span>
                            <span
                                className="text-ink-soft/40"
                                aria-hidden="true"
                            >
                                ·
                            </span>
                            <Link
                                href={`/?view=gpt-recommendations&selected=${rec.id}`}
                                className="font-medium text-ink underline decoration-brand underline-offset-2 hover:text-brand-strong"
                            >
                                View full advisory
                            </Link>
                        </div>
                    )}
                </div>
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11px] font-semibold',
                        badgeVariant,
                    )}
                >
                    {badgeIcon}
                    {status}
                </span>
            </header>

            <div className="space-y-4 p-4">
                <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className={cn(
                        'transition-all duration-150',
                        expired || stale
                            ? 'rounded-lg border border-line bg-surface-subtle/40 p-3 shadow-2xs'
                            : '',
                    )}
                >
                    <div className="flex items-start gap-2.5">
                        {(expired || stale) && (
                            <span
                                className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-500/20"
                                aria-hidden="true"
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-semibold text-ink">
                                {title}
                            </h4>
                            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                                {description}
                            </p>
                            {canRefreshExpired && (
                                <div className="mt-2.5">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={canRetry ? onRetry : onRequest}
                                        disabled={busy}
                                        aria-label="Refresh suggestions"
                                        className="w-full justify-center gap-2 text-xs font-medium"
                                    >
                                        <RefreshCw
                                            className={cn(
                                                'h-3.5 w-3.5 shrink-0',
                                                busy &&
                                                    'motion-safe:animate-spin',
                                            )}
                                            aria-hidden="true"
                                        />
                                        Refresh suggestions
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {isProlonged && (
                    <div
                        role="alert"
                        className="border-warning-subtle rounded-lg border bg-warning-soft p-3 text-xs text-warning-strong"
                    >
                        <div className="flex items-start gap-2">
                            <AlertTriangle
                                className="mt-0.5 h-4 w-4 shrink-0"
                                aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                    Taking longer than expected
                                </p>
                                <p className="mt-1 leading-relaxed text-ink-soft">
                                    The queue worker may be busy. You can
                                    continue waiting, retry the check, or assign
                                    resources manually.
                                </p>
                                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                    {canRetry && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={onRetry}
                                            disabled={busy}
                                            className="gap-1.5"
                                        >
                                            <RefreshCw
                                                className={cn(
                                                    'h-3.5 w-3.5',
                                                    busy &&
                                                        'motion-safe:animate-spin',
                                                )}
                                                aria-hidden="true"
                                            />
                                            Retry check
                                        </Button>
                                    )}
                                    {manualUrl && (
                                        <Link
                                            href={manualUrl}
                                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-ink hover:underline"
                                        >
                                            Assign manually
                                            <ArrowUpRight
                                                className="h-3 w-3"
                                                aria-hidden="true"
                                            />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showResources ? (
                    <div
                        className={cn(
                            'space-y-3 divide-y divide-line/60 transition-all duration-200',
                            (expired || stale) && 'opacity-75 grayscale-[20%]',
                        )}
                    >
                        <ResourceGroup
                            label="Suggested crew"
                            icon={
                                <Users
                                    className="h-4 w-4 text-ink-soft"
                                    aria-hidden="true"
                                />
                            }
                            empty="No crew proposed"
                        >
                            {personnel.map((person) => {
                                const hasName = Boolean(person.name);
                                const displayName =
                                    person.name ||
                                    `Crew member #${person.user_id}`;
                                const initials = getInitials(person.name);
                                const isSelected =
                                    selectedPersonnelIds.includes(
                                        person.user_id,
                                    );

                                return (
                                    <li
                                        key={`${person.user_id}-${person.assignment_type}`}
                                        className={cn(
                                            'group relative flex items-center gap-2.5 rounded-lg border p-2 transition-all duration-150',
                                            expired || stale
                                                ? 'border-line/40 bg-surface/30 opacity-75 grayscale-[20%]'
                                                : isSelected
                                                  ? 'border-line-strong bg-surface shadow-2xs'
                                                  : 'border-line bg-surface-subtle/30 hover:border-line-strong hover:bg-surface',
                                        )}
                                    >
                                        {ready && canReview && (
                                            <label className="-m-0.5 flex shrink-0 cursor-pointer items-center justify-center rounded-md p-1 transition-colors hover:bg-surface-subtle/60">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() =>
                                                        togglePersonnel(
                                                            person.user_id,
                                                        )
                                                    }
                                                    aria-label={`Select ${displayName}`}
                                                    className="h-3.5 w-3.5 cursor-pointer rounded border-line-strong text-brand accent-brand transition-shadow focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-hidden"
                                                    disabled={busy}
                                                />
                                            </label>
                                        )}
                                        <div
                                            className={cn(
                                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface-subtle text-[11px] font-semibold text-ink transition-colors',
                                                !(expired || stale) &&
                                                    'group-hover:border-line-strong group-hover:bg-surface',
                                            )}
                                            aria-hidden="true"
                                        >
                                            {initials || (
                                                <User
                                                    className={cn(
                                                        'h-3.5 w-3.5 text-ink-soft transition-colors',
                                                        !(expired || stale) &&
                                                            'group-hover:text-ink',
                                                    )}
                                                />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex min-w-0 items-center justify-between gap-1.5">
                                                <p
                                                    className="truncate text-xs font-semibold text-ink"
                                                    title={displayName}
                                                >
                                                    {displayName}
                                                </p>
                                                {hasName && (
                                                    <span className="inline-flex shrink-0 items-center rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-soft tabular-nums">
                                                        #{person.user_id}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
                                                <span className="inline-flex shrink-0 items-center rounded border border-line bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                                                    {humanize(
                                                        person.assignment_type,
                                                    )}
                                                </span>
                                                {person.role &&
                                                    humanize(person.role) !==
                                                        humanize(
                                                            person.assignment_type,
                                                        ) && (
                                                        <span className="truncate text-[11px] text-ink-soft">
                                                            ·{' '}
                                                            {humanize(
                                                                person.role,
                                                            )}
                                                        </span>
                                                    )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ResourceGroup>
                        <div className="pt-3">
                            <ResourceGroup
                                label="Suggested equipment"
                                icon={
                                    <Truck
                                        className="h-4 w-4 text-ink-soft"
                                        aria-hidden="true"
                                    />
                                }
                                empty="No equipment proposed"
                            >
                                {assets.map((asset) => {
                                    const hasName = Boolean(asset.name);
                                    const hasCode = Boolean(asset.asset_code);
                                    const isCodeSameAsName =
                                        hasName &&
                                        hasCode &&
                                        asset.name === asset.asset_code;
                                    const displayName =
                                        asset.name ||
                                        (!hasCode
                                            ? `Equipment #${asset.operational_asset_id}`
                                            : null);
                                    const showName =
                                        displayName &&
                                        (!hasCode || !isCodeSameAsName);
                                    const isCrane =
                                        asset.kind
                                            ?.toLowerCase()
                                            .includes('crane') ||
                                        asset.assignment_type
                                            ?.toLowerCase()
                                            .includes('crane');
                                    const IconComponent = isCrane
                                        ? Construction
                                        : Truck;
                                    const isSelected =
                                        selectedAssetIds.includes(
                                            asset.operational_asset_id,
                                        );
                                    const assetLabel = asset.name
                                        ? asset.asset_code &&
                                          asset.asset_code !== asset.name
                                            ? `${asset.asset_code} · ${asset.name}`
                                            : asset.name
                                        : asset.asset_code ||
                                          `Equipment #${asset.operational_asset_id}`;

                                    return (
                                        <li
                                            key={`${asset.operational_asset_id}-${asset.assignment_type}`}
                                            className={cn(
                                                'group relative flex items-center gap-2.5 rounded-lg border p-2 transition-all duration-150',
                                                expired || stale
                                                    ? 'border-line/40 bg-surface/30 opacity-75 grayscale-[20%]'
                                                    : isSelected
                                                      ? 'border-line-strong bg-surface shadow-2xs'
                                                      : 'border-line bg-surface-subtle/30 hover:border-line-strong hover:bg-surface',
                                            )}
                                        >
                                            {ready && canReview && (
                                                <label className="-m-0.5 flex shrink-0 cursor-pointer items-center justify-center rounded-md p-1 transition-colors hover:bg-surface-subtle/60">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() =>
                                                            toggleAsset(
                                                                asset.operational_asset_id,
                                                            )
                                                        }
                                                        aria-label={`Select ${assetLabel}`}
                                                        className="h-3.5 w-3.5 cursor-pointer rounded border-line-strong text-brand accent-brand transition-shadow focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-hidden"
                                                        disabled={busy}
                                                    />
                                                </label>
                                            )}
                                            <div
                                                className={cn(
                                                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-subtle text-ink transition-colors',
                                                    !(expired || stale) &&
                                                        'group-hover:border-line-strong',
                                                )}
                                                aria-hidden="true"
                                            >
                                                <IconComponent
                                                    className={cn(
                                                        'h-3.5 w-3.5 text-ink-soft transition-colors',
                                                        !(expired || stale) &&
                                                            'group-hover:text-ink',
                                                    )}
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex min-w-0 items-center justify-between gap-1.5">
                                                    <div className="flex min-w-0 items-center gap-1.5">
                                                        {hasCode && (
                                                            <span className="shrink-0 font-mono text-xs font-semibold text-ink">
                                                                {
                                                                    asset.asset_code
                                                                }
                                                            </span>
                                                        )}
                                                        {showName && (
                                                            <p
                                                                className="truncate text-xs font-semibold text-ink"
                                                                title={
                                                                    displayName ??
                                                                    undefined
                                                                }
                                                            >
                                                                {displayName}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {(hasName || hasCode) && (
                                                        <span className="inline-flex shrink-0 items-center rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-soft tabular-nums">
                                                            #
                                                            {
                                                                asset.operational_asset_id
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
                                                    <span className="inline-flex shrink-0 items-center rounded border border-line bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                                                        {humanize(
                                                            asset.assignment_type,
                                                        )}
                                                    </span>
                                                    {asset.capacity && (
                                                        <span className="inline-flex shrink-0 items-center rounded border border-line bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-ink-soft tabular-nums">
                                                            {asset.capacity}
                                                        </span>
                                                    )}
                                                    {asset.kind &&
                                                        humanize(asset.kind) !==
                                                            humanize(
                                                                asset.assignment_type,
                                                            ) && (
                                                            <span className="truncate text-[11px] text-ink-soft">
                                                                ·{' '}
                                                                {humanize(
                                                                    asset.kind,
                                                                )}
                                                            </span>
                                                        )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ResourceGroup>
                        </div>
                    </div>
                ) : !rec || pending ? (
                    <div className="divide-y divide-line rounded-lg bg-surface-subtle/60 px-3">
                        <Placeholder
                            label="Crew"
                            icon={
                                <Users className="h-4 w-4" aria-hidden="true" />
                            }
                            subtitle={
                                pending
                                    ? processing
                                        ? 'Checking driver & operator qualifications'
                                        : 'Queued for crew eligibility check'
                                    : 'Suggestions will appear here'
                            }
                        />
                        <Placeholder
                            label="Equipment"
                            icon={
                                <Truck className="h-4 w-4" aria-hidden="true" />
                            }
                            subtitle={
                                pending
                                    ? processing
                                        ? 'Matching cranes, transport trucks & flatbeds'
                                        : 'Queued for asset capacity & schedule fit'
                                    : 'Suggestions will appear here'
                            }
                        />
                    </div>
                ) : null}

                {pending && !isProlonged && (
                    <div className="rounded-lg border border-line/70 bg-surface-subtle/50 p-3 text-xs text-ink-soft">
                        <p className="font-medium text-ink">
                            You don&apos;t have to wait
                        </p>
                        <p className="mt-0.5 leading-relaxed">
                            Assignments can be made manually at any time without
                            waiting for the suggestion.
                        </p>
                        {manualUrl && (
                            <div className="mt-2">
                                <Link
                                    href={manualUrl}
                                    className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                                >
                                    Assign resources manually
                                    <ArrowUpRight
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                    />
                                </Link>
                            </div>
                        )}
                    </div>
                )}

                {!pending && Boolean(rec?.conflicts.length) && (
                    <div className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-xs text-warning-strong">
                        <AlertTriangle
                            className="mt-0.5 h-4 w-4 shrink-0"
                            aria-hidden="true"
                        />
                        <div className="min-w-0">
                            <p className="font-semibold">
                                Review these constraints
                            </p>
                            <ul className="mt-1 list-disc space-y-1 pl-4 break-words">
                                {rec?.conflicts.map((conflict, index) => (
                                    <li key={index}>
                                        {typeof conflict === 'string'
                                            ? conflict
                                            : String(
                                                  conflict.reason ??
                                                      conflict.message ??
                                                      'Review this constraint in the full advisory.',
                                              )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {!pending && rec && (rec.response_summary || details) && (
                    <details className="group text-xs">
                        <summary className="cursor-pointer rounded py-2 font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                            Why this suggestion?
                        </summary>
                        <div className="space-y-3 pt-1 leading-relaxed break-words text-ink-soft">
                            {rec.response_summary && (
                                <p>{rec.response_summary}</p>
                            )}
                            {details}
                        </div>
                    </details>
                )}

                {ready && canReview && (
                    <div className="space-y-2 pt-1">
                        {assignmentUrl ? (
                            <Link
                                href={assignmentUrl}
                                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2 text-center text-sm font-semibold text-ink shadow-xs transition-all duration-150 hover:bg-brand-strong hover:text-white active:scale-[0.98]"
                            >
                                Review in assignment workspace{' '}
                                <ArrowUpRight
                                    className="h-4 w-4 shrink-0"
                                    aria-hidden="true"
                                />
                            </Link>
                        ) : !hasResources ? (
                            <Button
                                variant="primary"
                                className="w-full whitespace-normal shadow-xs transition-transform duration-150 ease-out active:scale-[0.98]"
                                onClick={() =>
                                    onReview(
                                        selectedPersonnelIds,
                                        selectedAssetIds,
                                    )
                                }
                            >
                                Review advisory
                            </Button>
                        ) : hasConflicts ? (
                            <Button
                                variant="primary"
                                className="w-full whitespace-normal shadow-xs transition-transform duration-150 ease-out active:scale-[0.98]"
                                onClick={() =>
                                    onReview(
                                        selectedPersonnelIds,
                                        selectedAssetIds,
                                    )
                                }
                            >
                                Review &amp; Resolve Conflicts
                            </Button>
                        ) : (
                            <>
                                <Button
                                    variant="primary"
                                    className="w-full whitespace-normal shadow-xs transition-transform duration-150 ease-out active:scale-[0.98]"
                                    disabled={totalSelected === 0 || busy}
                                    onClick={() => {
                                        if (onApply) {
                                            onApply(
                                                selectedPersonnelIds,
                                                selectedAssetIds,
                                            );
                                        } else {
                                            onReview(
                                                selectedPersonnelIds,
                                                selectedAssetIds,
                                            );
                                        }
                                    }}
                                >
                                    {busy
                                        ? 'Applying Assignment…'
                                        : totalSelected === 0
                                          ? 'Apply selected'
                                          : `Apply ${formatResourceCount(selectedPersonnelCount, selectedAssetCount)}`}
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="w-full shadow-2xs transition-transform duration-150 ease-out active:scale-[0.98]"
                                    disabled={busy}
                                    onClick={() =>
                                        onReview(
                                            selectedPersonnelIds,
                                            selectedAssetIds,
                                        )
                                    }
                                >
                                    Review details
                                </Button>
                            </>
                        )}
                        <Button
                            variant="quiet"
                            size="sm"
                            className="w-full transition-transform duration-150 ease-out active:scale-[0.98]"
                            onClick={onReject}
                            disabled={busy}
                        >
                            Decline suggestion
                        </Button>
                    </div>
                )}
                {appliedNotice && (
                    <div
                        role="status"
                        className="border-success-subtle flex items-center gap-2 rounded-xl border bg-success-soft/80 p-3 text-xs font-medium text-success-strong shadow-2xs"
                    >
                        <Check
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                        />
                        <span>{appliedNotice}</span>
                    </div>
                )}
                {!pending && !(expired || stale) && retry && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onRetry}
                        disabled={busy}
                        className="gap-2 shadow-2xs transition-transform duration-150 ease-out active:scale-[0.98]"
                    >
                        <RefreshCw
                            className={cn(
                                'h-3.5 w-3.5',
                                busy && 'motion-safe:animate-spin',
                            )}
                            aria-hidden="true"
                        />
                        {rec?.status === 'failed'
                            ? 'Try again'
                            : 'Refresh suggestions'}
                    </Button>
                )}
                {allowRequest && !(expired || stale) && (
                    <Button
                        variant="quiet"
                        size="sm"
                        onClick={onRequest}
                        disabled={busy}
                        className="gap-2 transition-transform duration-150 ease-out active:scale-[0.98]"
                    >
                        <RefreshCw
                            className={cn(
                                'h-3.5 w-3.5',
                                busy && 'motion-safe:animate-spin',
                            )}
                            aria-hidden="true"
                        />
                        {rec ? 'Request new suggestion' : 'Request now'}
                    </Button>
                )}
                {!pending &&
                    (rec?.status === 'failed' || rec?.status === 'rejected') &&
                    manualUrl && (
                        <div>
                            <Link
                                href={manualUrl}
                                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                            >
                                Assign resources manually
                                <ArrowUpRight
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                />
                            </Link>
                        </div>
                    )}
                {error && (
                    <p role="alert" className="text-xs text-danger">
                        {error}
                    </p>
                )}
            </div>
        </section>
    );
}

function getInitials(name?: string | null): string {
    if (!name) {
        return '';
    }

    const clean = name.trim();

    if (!clean) {
        return '';
    }

    const parts = clean.split(/\s+/);

    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ResourceGroup({
    label,
    icon,
    empty,
    children,
}: {
    label: string;
    icon: ReactNode;
    empty: string;
    children: ReactNode[];
}) {
    return (
        <div className="py-2 first:pt-0 last:pb-0">
            <div className="mb-2 flex items-center justify-between gap-2">
                <h5 className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                    <span className="text-ink-soft">{icon}</span>
                    <span>{label}</span>
                </h5>
                <span className="inline-flex items-center rounded-full border border-line bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-soft tabular-nums">
                    {children.length}
                </span>
            </div>
            {children.length ? (
                <ul className="space-y-2">{children}</ul>
            ) : (
                <p className="rounded-lg border border-line bg-surface-subtle/40 px-3 py-2 text-xs text-ink-soft">
                    {empty}
                </p>
            )}
        </div>
    );
}

function Placeholder({
    label,
    icon,
    subtitle,
}: {
    label: string;
    icon: ReactNode;
    subtitle: string;
}) {
    return (
        <div className="flex items-center gap-3 py-3 text-ink-soft">
            {icon}
            <div className="min-w-0">
                <p className="text-xs font-medium text-ink">{label}</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">{subtitle}</p>
            </div>
        </div>
    );
}
