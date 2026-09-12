import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowUpRight,
    Check,
    Clock,
    LoaderCircle,
    RefreshCw,
    Truck,
    Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui';
import { humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { GptRecommendationViewModel } from '@/types/workspace';

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
    onRequest: () => void;
    onRetry: () => void;
    onReview: () => void;
    onReject: () => void;
    details?: ReactNode;
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
    onRequest,
    onRetry,
    onReview,
    onReject,
    details,
}: DispatchAdvisoryCardProps) {
    const queued = rec?.status === 'draft';
    const processing = rec?.status === 'processing';
    const pending = busy || queued || processing;
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

    return (
        <section
            className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface"
            aria-labelledby={`dispatch-gpt-advisory-${jobId}`}
        >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4">
                <div className="min-w-0">
                    <h3
                        id={`dispatch-gpt-advisory-${jobId}`}
                        className="text-sm font-semibold text-ink"
                    >
                        AI assistance
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
                                className="font-medium text-brand-strong hover:underline"
                            >
                                View full advisory
                            </Link>
                        </div>
                    )}
                </div>
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium',
                        ready || accepted
                            ? 'bg-success-soft text-success-strong'
                            : expired || stale || rec?.status === 'failed'
                              ? 'bg-warning-soft text-warning-strong'
                              : 'bg-surface-subtle text-ink-soft',
                    )}
                >
                    {pending ? (
                        <LoaderCircle
                            className="h-3 w-3 motion-safe:animate-spin"
                            aria-hidden="true"
                        />
                    ) : ready || accepted ? (
                        <Check className="h-3 w-3" aria-hidden="true" />
                    ) : (
                        <Clock className="h-3 w-3" aria-hidden="true" />
                    )}
                    {status}
                </span>
            </header>

            <div className="space-y-4 p-4">
                <div role="status" aria-live="polite" aria-atomic="true">
                    <h4 className="text-sm font-semibold text-ink">{title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                        {description}
                    </p>
                </div>

                {showResources ? (
                    <div className="divide-y divide-line">
                        <ResourceGroup
                            label="Suggested crew"
                            icon={
                                <Users className="h-4 w-4" aria-hidden="true" />
                            }
                            empty="No crew proposed"
                        >
                            {personnel.map((person) => (
                                <li
                                    key={`${person.user_id}-${person.assignment_type}`}
                                    className="min-w-0 py-2"
                                >
                                    <p className="text-sm font-medium break-words text-ink">
                                        {person.name ||
                                            `Crew member #${person.user_id}`}
                                    </p>
                                    <p className="mt-0.5 text-xs break-words text-ink-soft">
                                        {humanize(person.assignment_type)}
                                    </p>
                                </li>
                            ))}
                        </ResourceGroup>
                        <ResourceGroup
                            label="Suggested equipment"
                            icon={
                                <Truck className="h-4 w-4" aria-hidden="true" />
                            }
                            empty="No equipment proposed"
                        >
                            {assets.map((asset) => (
                                <li
                                    key={`${asset.operational_asset_id}-${asset.assignment_type}`}
                                    className="min-w-0 py-2"
                                >
                                    <p className="text-sm font-medium break-words text-ink">
                                        {asset.name ||
                                            asset.asset_code ||
                                            `Equipment #${asset.operational_asset_id}`}
                                    </p>
                                    <p className="mt-0.5 text-xs break-words text-ink-soft">
                                        {[
                                            asset.asset_code !== asset.name
                                                ? asset.asset_code
                                                : null,
                                            humanize(asset.assignment_type),
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                </li>
                            ))}
                        </ResourceGroup>
                    </div>
                ) : !rec || pending ? (
                    <div className="divide-y divide-line rounded-lg bg-surface-subtle/60 px-3">
                        <Placeholder
                            label="Crew"
                            icon={
                                <Users className="h-4 w-4" aria-hidden="true" />
                            }
                            pending={pending}
                        />
                        <Placeholder
                            label="Equipment"
                            icon={
                                <Truck className="h-4 w-4" aria-hidden="true" />
                            }
                            pending={pending}
                        />
                    </div>
                ) : null}

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
                                        {String(
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
                    <div className="space-y-2">
                        {assignmentUrl ? (
                            <Link
                                href={assignmentUrl}
                                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-ink hover:bg-brand-strong hover:text-white"
                            >
                                Review in assignment workspace{' '}
                                <ArrowUpRight
                                    className="h-4 w-4 shrink-0"
                                    aria-hidden="true"
                                />
                            </Link>
                        ) : (
                            <Button
                                variant="primary"
                                className="w-full whitespace-normal"
                                onClick={onReview}
                            >
                                {hasResources
                                    ? 'Review & apply suggestion'
                                    : 'Review advisory'}
                            </Button>
                        )}
                        <Button
                            variant="quiet"
                            size="sm"
                            className="w-full"
                            onClick={onReject}
                        >
                            Decline suggestion
                        </Button>
                    </div>
                )}
                {!pending && retry && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onRetry}
                        className="gap-2"
                    >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        {rec?.status === 'failed'
                            ? 'Try again'
                            : 'Refresh suggestions'}
                    </Button>
                )}
                {allowRequest && (
                    <Button
                        variant="quiet"
                        size="sm"
                        onClick={onRequest}
                        className="gap-2"
                    >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        {rec ? 'Request new suggestion' : 'Request now'}
                    </Button>
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
        <div className="py-3 first:pt-0 last:pb-0">
            <h5 className="flex items-center gap-2 text-xs font-medium text-ink-soft">
                {icon}
                {label}
                <span className="ml-auto tabular-nums">{children.length}</span>
            </h5>
            {children.length ? (
                <ul className="mt-1 divide-y divide-line/60 pl-6">
                    {children}
                </ul>
            ) : (
                <p className="mt-2 pl-6 text-xs text-ink-soft">{empty}</p>
            )}
        </div>
    );
}

function Placeholder({
    label,
    icon,
    pending,
}: {
    label: string;
    icon: ReactNode;
    pending: boolean;
}) {
    return (
        <div className="flex items-center gap-3 py-3 text-ink-soft">
            {icon}
            <div>
                <p className="text-xs font-medium text-ink">{label}</p>
                <p className="mt-0.5 text-[11px]">
                    {pending
                        ? 'Awaiting resource check'
                        : 'Suggestions will appear here'}
                </p>
            </div>
        </div>
    );
}
