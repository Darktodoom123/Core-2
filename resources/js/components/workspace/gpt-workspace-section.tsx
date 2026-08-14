import { router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    Bot,
    CheckCircle,
    Clock,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Truck,
    User,
    XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    GptRecommendationViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

export function GptRecommendationsSurface({
    recommendations = [],
    capabilities,
}: {
    recommendations?: GptRecommendationViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const [selectedForAccept, setSelectedForAccept] =
        useState<GptRecommendationViewModel | null>(null);
    const [selectedForReject, setSelectedForReject] =
        useState<GptRecommendationViewModel | null>(null);
    const [retryingId, setRetryingId] = useState<number | null>(null);
    const [pollingStoppedFor, setPollingStoppedFor] = useState<string | null>(
        null,
    );

    const pending = useMemo(
        () =>
            recommendations.filter(
                (r) => r.status === 'pending_review' && !r.is_expired,
            ),
        [recommendations],
    );

    const processing = useMemo(
        () =>
            recommendations.filter((r) =>
                ['draft', 'processing'].includes(r.status),
            ),
        [recommendations],
    );

    const history = useMemo(
        () =>
            recommendations.filter(
                (r) =>
                    !['pending_review', 'draft', 'processing'].includes(
                        r.status,
                    ) || r.is_expired,
            ),
        [recommendations],
    );

    const processingKey = processing
        .map((recommendation) => recommendation.id)
        .join(',');
    const pollingStopped =
        processingKey !== '' && pollingStoppedFor === processingKey;

    useEffect(() => {
        if (processing.length === 0) {
            return;
        }

        let attempts = 0;
        const maxAttempts = 15;

        const timer = window.setInterval(() => {
            if (attempts >= maxAttempts) {
                window.clearInterval(timer);
                setPollingStoppedFor(processingKey);

                return;
            }

            attempts += 1;
            router.reload({
                only: ['gptRecommendations'],
            });
        }, 4000);

        return () => window.clearInterval(timer);
    }, [processing.length, processingKey]);

    const refreshRecommendations = () => {
        setPollingStoppedFor(null);
        router.reload({
            only: ['gptRecommendations'],
        });
    };

    return (
        <div>
            <PageHeading
                title="GPT AI Advisory & Resource Recommendations"
                description="Review explainable AI dispatch and resource proposals. All recommendations are purely advisory and require explicit human confirmation to apply."
            />

            <div className="space-y-6 p-4 md:p-6">
                {/* Informational Guidance Banner */}
                <div className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
                    <Bot className="mt-0.5 h-5 w-5 shrink-0 text-brand-strong" />
                    <div className="text-xs text-ink">
                        <span className="font-semibold text-brand-strong">
                            Advisory Safety Protocol:
                        </span>{' '}
                        AI suggestions analyze personnel certifications, asset
                        telemetry, and scheduling conflicts. No automated
                        assignment or state changes occur without human manager
                        sign-off. Each proposal is bound to a strict 15-minute
                        re-evaluation window and a $0.05 cost ceiling.
                    </div>
                </div>

                {/* Pending Recommendations Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                            <Sparkles className="h-5 w-5 text-brand-strong" />
                            Pending Human Review ({pending.length})
                        </h3>
                    </div>

                    {pending.length === 0 ? (
                        <Panel>
                            <EmptyState
                                icon={Sparkles}
                                title="No pending AI recommendations"
                                message="When dispatchers request AI assistance during resource planning, pending proposed plans will appear here for human evaluation."
                            />
                        </Panel>
                    ) : (
                        <div className="grid gap-6 lg:grid-cols-2">
                            {pending.map((rec) => (
                                <PendingRecommendationCard
                                    key={rec.id}
                                    rec={rec}
                                    capabilities={capabilities}
                                    onAccept={() => setSelectedForAccept(rec)}
                                    onReject={() => setSelectedForReject(rec)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Processing In-Flight Proposals */}
                {processing.length > 0 && (
                    <div className="space-y-3" aria-live="polite">
                        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                            <Clock className="h-5 w-5 text-brand-strong" />
                            Processing Proposals ({processing.length})
                        </h3>
                        <Panel className="space-y-2">
                            {processing.map((rec) => (
                                <div
                                    key={rec.id}
                                    className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2.5 last:border-0 last:pb-0"
                                >
                                    <div>
                                        <p className="text-sm font-medium text-ink">
                                            Proposal #{rec.id} · Dispatch #
                                            {rec.subject_id}
                                        </p>
                                        <p className="text-xs text-ink-soft">
                                            {rec.status === 'draft'
                                                ? 'Queued for advisory synthesis.'
                                                : 'Evaluating personnel availability, credentials, and asset maintenance…'}
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
                                        <RefreshCw
                                            className="h-3.5 w-3.5 animate-spin"
                                            aria-hidden="true"
                                        />
                                        {rec.status === 'draft'
                                            ? 'Queued'
                                            : 'Processing AI'}
                                    </span>
                                </div>
                            ))}
                        </Panel>
                    </div>
                )}

                {pollingStopped && (
                    <Panel className="flex flex-wrap items-center justify-between gap-3 border-warning/30 bg-warning-soft/40">
                        <p className="text-sm text-ink" role="status">
                            Automatic polling stopped. Click below to refresh
                            latest AI proposal status.
                        </p>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={refreshRecommendations}
                        >
                            <RefreshCw
                                className="mr-1.5 h-3.5 w-3.5"
                                aria-hidden="true"
                            />
                            Refresh Recommendations
                        </Button>
                    </Panel>
                )}

                {/* Historical AI Decision Table */}
                <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-ink">
                            Recommendation Decision History
                        </h3>
                        <span className="text-xs text-ink-soft">
                            {history.length} logged decisions
                        </span>
                    </div>

                    {history.length === 0 ? (
                        <Panel>
                            <EmptyState
                                icon={Clock}
                                title="No historical AI decisions"
                                message="Accepted, rejected, expired, and stale AI recommendations will be archived here for audit trail and compliance."
                            />
                        </Panel>
                    ) : (
                        <Panel className="overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-line bg-surface-subtle text-xs font-semibold text-ink-soft uppercase">
                                        <tr>
                                            <th className="px-4 py-3">
                                                Proposal ID
                                            </th>
                                            <th className="px-4 py-3">
                                                Purpose
                                            </th>
                                            <th className="px-4 py-3">
                                                Status
                                            </th>
                                            <th className="px-4 py-3">Model</th>
                                            <th className="px-4 py-3">
                                                Cost / Tokens
                                            </th>
                                            <th className="px-4 py-3">
                                                Requested By
                                            </th>
                                            <th className="px-4 py-3">
                                                Decided By
                                            </th>
                                            <th className="px-4 py-3">
                                                Decided At
                                            </th>
                                            <th className="px-4 py-3 text-right">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {history.map((rec) => (
                                            <tr
                                                key={rec.id}
                                                className="text-xs hover:bg-surface-subtle/50"
                                            >
                                                <td className="px-4 py-3 font-mono font-semibold text-ink">
                                                    #{rec.id}
                                                    <span className="block text-[10px] font-normal text-ink-soft">
                                                        Dispatch #
                                                        {rec.subject_id}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3 font-medium text-ink capitalize">
                                                    {rec.purpose.replace(
                                                        '_',
                                                        ' ',
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="space-y-1">
                                                        <span
                                                            className={cn(
                                                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                                                rec.status ===
                                                                    'accepted'
                                                                    ? 'bg-success-soft text-success-strong'
                                                                    : rec.status ===
                                                                        'rejected'
                                                                      ? 'bg-danger-soft text-danger-strong'
                                                                      : rec.status ===
                                                                              'stale' ||
                                                                          rec.is_expired
                                                                        ? 'bg-warning-soft text-warning-strong'
                                                                        : 'bg-surface-subtle text-ink-soft',
                                                            )}
                                                        >
                                                            {rec.is_expired
                                                                ? 'Expired (15m window)'
                                                                : rec.status}
                                                        </span>
                                                        {rec.error_message && (
                                                            <p
                                                                className="max-w-xs text-xs text-danger"
                                                                role="status"
                                                            >
                                                                {
                                                                    rec.error_message
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3 font-mono text-ink-soft">
                                                    {rec.model}
                                                </td>

                                                <td className="px-4 py-3 text-ink-soft">
                                                    <span>
                                                        {rec.cost_usd !== null
                                                            ? `$${rec.cost_usd.toFixed(4)}`
                                                            : '—'}
                                                    </span>
                                                    {rec.usage && (
                                                        <span className="block text-[10px] text-ink-soft">
                                                            {rec.usage.total_tokens.toLocaleString()}{' '}
                                                            tok
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 text-ink">
                                                    {rec.requested_by.name}
                                                </td>

                                                <td className="px-4 py-3 text-ink">
                                                    {rec.decided_by?.name ||
                                                        rec.decided_by_name ||
                                                        'N/A'}
                                                </td>

                                                <td className="px-4 py-3 text-ink-soft">
                                                    {rec.decided_at
                                                        ? formatDateTime(
                                                              rec.decided_at,
                                                          )
                                                        : '—'}
                                                </td>

                                                <td className="px-4 py-3 text-right">
                                                    {capabilities.retry_gpt_recommendation &&
                                                        rec.is_retryable && (
                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                disabled={
                                                                    retryingId ===
                                                                    rec.id
                                                                }
                                                                onClick={() => {
                                                                    setRetryingId(
                                                                        rec.id,
                                                                    );
                                                                    router.post(
                                                                        rec.retry_url,
                                                                        {},
                                                                        {
                                                                            onFinish:
                                                                                () =>
                                                                                    setRetryingId(
                                                                                        null,
                                                                                    ),
                                                                        },
                                                                    );
                                                                }}
                                                            >
                                                                <RefreshCw
                                                                    className={cn(
                                                                        'mr-1 h-3.5 w-3.5',
                                                                        retryingId ===
                                                                            rec.id &&
                                                                            'animate-spin',
                                                                    )}
                                                                    aria-hidden="true"
                                                                />
                                                                {retryingId ===
                                                                rec.id
                                                                    ? 'Retrying…'
                                                                    : 'Retry'}
                                                            </Button>
                                                        )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>
                    )}
                </div>
            </div>

            {/* Accept Modal */}
            {selectedForAccept && (
                <AcceptGptModal
                    rec={selectedForAccept}
                    onClose={() => setSelectedForAccept(null)}
                />
            )}

            {/* Reject Modal */}
            {selectedForReject && (
                <RejectGptModal
                    rec={selectedForReject}
                    onClose={() => setSelectedForReject(null)}
                />
            )}
        </div>
    );
}

function PendingRecommendationCard({
    rec,
    capabilities,
    onAccept,
    onReject,
}: {
    rec: GptRecommendationViewModel;
    capabilities: WorkspaceCapabilities;
    onAccept: () => void;
    onReject: () => void;
}) {
    return (
        <Panel className="space-y-4 border-brand/30 bg-surface p-5 shadow-sm">
            {/* Header / Purpose & 15-Minute Expiry Countdown */}
            <div className="flex items-start justify-between border-b border-line pb-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong">
                            {rec.purpose.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="font-mono text-xs text-ink-soft">
                            {rec.model}
                        </span>
                    </div>
                    <h4 className="mt-1 text-sm font-bold text-ink">
                        Advisory Proposal #{rec.id} · Dispatch #{rec.subject_id}
                    </h4>
                </div>

                {/* Expiry countdown indicator */}
                <Gpt15MinCountdown
                    expiresAt={rec.expires_at}
                    expiresInSeconds={rec.expires_in_seconds}
                />
            </div>

            {/* Prompt context summary */}
            {rec.prompt_summary && (
                <div className="rounded-lg bg-surface-subtle p-2.5 text-xs text-ink-soft">
                    <span className="font-semibold text-ink">
                        Prompt Context:
                    </span>{' '}
                    {rec.prompt_summary}
                </div>
            )}

            {/* Explainability & Assumptions Details */}
            <RecommendationDetails rec={rec} />

            {/* Proposed Resource Plan */}
            <div className="space-y-2 text-xs">
                <h5 className="font-semibold text-ink">
                    Proposed Resource Plan:
                </h5>

                {rec.proposed_personnel &&
                    rec.proposed_personnel.length > 0 && (
                        <div className="space-y-1 rounded-lg border border-line bg-surface p-2.5">
                            <div className="flex items-center gap-1.5 font-semibold text-ink">
                                <User className="h-3.5 w-3.5 text-brand-strong" />
                                <span>
                                    Personnel ({rec.proposed_personnel.length}):
                                </span>
                            </div>
                            <ul className="grid gap-1 pl-4 sm:grid-cols-2">
                                {rec.proposed_personnel.map((p, idx) => (
                                    <li key={idx} className="text-ink">
                                        <strong className="font-medium">
                                            {p.name || `User #${p.user_id}`}
                                        </strong>{' '}
                                        <span className="text-ink-soft">
                                            ({p.assignment_type}
                                            {p.role ? ` · ${p.role}` : ''})
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                {rec.proposed_assets && rec.proposed_assets.length > 0 && (
                    <div className="space-y-1 rounded-lg border border-line bg-surface p-2.5">
                        <div className="flex items-center gap-1.5 font-semibold text-ink">
                            <Truck className="h-3.5 w-3.5 text-brand-strong" />
                            <span>Assets ({rec.proposed_assets.length}):</span>
                        </div>
                        <ul className="grid gap-1 pl-4 sm:grid-cols-2">
                            {rec.proposed_assets.map((a, idx) => (
                                <li key={idx} className="text-ink">
                                    <strong className="font-medium">
                                        {a.name ||
                                            a.asset_code ||
                                            `Asset #${a.operational_asset_id}`}
                                    </strong>{' '}
                                    <span className="text-ink-soft">
                                        ({a.assignment_type})
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Conflict Check Results */}
            {rec.conflicts && rec.conflicts.length > 0 ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft/40 p-3 text-xs text-danger-strong">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                        <span className="font-semibold">
                            Conflict Check Warnings:
                        </span>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                            {rec.conflicts.map((c, i) => (
                                <li key={i}>
                                    {String(
                                        c.reason ||
                                            c.message ||
                                            JSON.stringify(c),
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft/30 px-3 py-2 text-xs text-success-strong">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>
                        Zero scheduling overlaps or safety certification
                        conflicts detected.
                    </span>
                </div>
            )}

            {/* Footer / Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-xs">
                <span className="text-ink-soft">
                    Requested by{' '}
                    <strong className="font-medium text-ink">
                        {rec.requested_by.name}
                    </strong>
                </span>

                {capabilities.decide_gpt_recommendation && (
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={onReject}
                        >
                            <XCircle className="mr-1.5 h-3.5 w-3.5 text-danger-strong" />
                            Reject Proposal
                        </Button>
                        <Button size="sm" variant="primary" onClick={onAccept}>
                            <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-success-strong" />
                            Accept & Apply Plan
                        </Button>
                    </div>
                )}
            </div>
        </Panel>
    );
}

export function RecommendationDetails({
    rec,
}: {
    rec: GptRecommendationViewModel;
}) {
    const recommendation = rec.recommendation ?? {};
    const reasons = Array.isArray(recommendation.reasons)
        ? recommendation.reasons
        : [];
    const assumptions = Array.isArray(recommendation.assumptions)
        ? recommendation.assumptions
        : [];

    return (
        <div className="space-y-2 rounded-lg border border-line bg-surface-subtle p-3 text-xs text-ink-soft">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                    <span className="font-semibold text-ink">Freshness:</span>{' '}
                    {rec.generated_at
                        ? formatDateTime(rec.generated_at)
                        : 'Not generated yet'}
                </div>
                <div>
                    <span className="font-semibold text-ink">Model:</span>{' '}
                    <span className="font-mono">{rec.model}</span>
                </div>
                <div>
                    <span className="font-semibold text-ink">Latency:</span>{' '}
                    {rec.latency_ms !== null ? `${rec.latency_ms} ms` : '—'}
                </div>
                <div>
                    <span className="font-semibold text-ink">Token Usage:</span>{' '}
                    {rec.usage
                        ? `${rec.usage.total_tokens.toLocaleString()} tokens (${rec.usage.prompt_tokens} in / ${rec.usage.completion_tokens} out)`
                        : 'Not available'}
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                    <span className="font-semibold text-ink">
                        Cost / Budget Ceiling:
                    </span>{' '}
                    <span className="font-semibold text-brand-strong">
                        {rec.cost_usd !== null
                            ? `$${rec.cost_usd.toFixed(4)}`
                            : 'N/A'}
                    </span>{' '}
                    <span className="text-[11px] text-ink-soft">
                        ($0.05 ceiling per proposal)
                    </span>
                </div>
            </div>

            {/* Explanation Reasons */}
            {reasons.length > 0 && (
                <div className="border-t border-line/60 pt-2">
                    <span className="font-semibold text-ink">
                        Advisory Reasons & Rationale:
                    </span>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink">
                        {reasons.map((r, i) => (
                            <li key={i}>{String(r)}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Assumptions */}
            {assumptions.length > 0 && (
                <div className="border-t border-line/60 pt-2">
                    <span className="font-semibold text-ink">
                        Operational Assumptions:
                    </span>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-soft">
                        {assumptions.map((a, i) => (
                            <li key={i}>{String(a)}</li>
                        ))}
                    </ul>
                </div>
            )}

            {rec.error_message && (
                <div
                    className="rounded border border-danger/30 bg-danger-soft p-2 text-danger-strong"
                    role="alert"
                >
                    {rec.error_message}
                </div>
            )}

            {rec.response_summary && (
                <div className="border-t border-line/60 pt-2">
                    <span className="font-semibold text-ink">
                        Synthesis Summary:
                    </span>{' '}
                    <span className="text-ink">{rec.response_summary}</span>
                </div>
            )}
        </div>
    );
}

function Gpt15MinCountdown({
    expiresAt,
    expiresInSeconds,
}: {
    expiresAt: string | null;
    expiresInSeconds?: number;
}) {
    const [remainingSec, setRemainingSec] = useState<number>(() => {
        if (typeof expiresInSeconds === 'number') {
            return Math.max(0, expiresInSeconds);
        }

        if (expiresAt) {
            const diff = Math.floor(
                (new Date(expiresAt).getTime() - Date.now()) / 1000,
            );

            return Math.max(0, diff);
        }

        return 900; // default 15 mins
    });

    useEffect(() => {
        if (remainingSec <= 0) {
            return;
        }

        const interval = window.setInterval(() => {
            setRemainingSec((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => window.clearInterval(interval);
    }, [remainingSec]);

    const isUrgent = remainingSec < 180; // under 3 mins

    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;

    if (remainingSec === 0) {
        return (
            <span className="inline-flex items-center gap-1 rounded bg-danger-soft px-2 py-1 text-xs font-semibold text-danger-strong">
                <AlertCircle className="h-3.5 w-3.5" />
                Proposal Expired
            </span>
        );
    }

    return (
        <div
            className={cn(
                'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-2xs',
                isUrgent
                    ? 'animate-pulse bg-danger-soft text-danger-strong'
                    : 'bg-warning-soft text-warning-strong',
            )}
            title="15-minute advisory proposal validity window"
        >
            <Clock className="h-3.5 w-3.5" />
            <span>
                {mins}m {secs < 10 ? `0${secs}` : secs}s window
            </span>
        </div>
    );
}

export function AcceptGptModal({
    rec,
    onClose,
}: {
    rec: GptRecommendationViewModel;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setProcessing(true);

        router.post(
            `/operations/gpt-recommendations/${rec.id}/accept`,
            {},
            {
                onFinish: () => {
                    setProcessing(false);
                    onClose();
                },
            },
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                className="w-full max-w-md space-y-4 rounded-xl bg-surface p-6 shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`accept-gpt-title-${rec.id}`}
            >
                <div className="flex items-center gap-3 text-success-strong">
                    <CheckCircle className="h-6 w-6" />
                    <h3
                        id={`accept-gpt-title-${rec.id}`}
                        className="text-lg font-semibold text-ink"
                    >
                        Accept AI Resource Recommendation
                    </h3>
                </div>

                <p className="text-sm leading-relaxed text-ink-soft">
                    You are confirming and executing this AI recommendation
                    under your active authenticated human account. This will
                    trigger the resource assignment transaction for Dispatch #
                    {rec.subject_id}.
                </p>

                <div className="space-y-1.5 rounded-lg border border-line bg-surface-subtle p-3 text-xs">
                    <p className="font-semibold text-ink">
                        Safety & Authorization Verification:
                    </p>
                    <p className="text-ink-soft">
                        • Context hash will be re-validated against current
                        dispatch state.
                    </p>
                    <p className="text-ink-soft">
                        • Decision will be recorded in audit log as{' '}
                        <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px]">
                            gpt.recommendation_accepted
                        </code>
                        .
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="flex justify-end gap-3 pt-2"
                >
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={processing}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={processing}
                    >
                        {processing
                            ? 'Applying Assignment…'
                            : 'Confirm & Apply Resource Plan'}
                    </Button>
                </form>
            </div>
        </div>
    );
}

export function RejectGptModal({
    rec,
    onClose,
}: {
    rec: GptRecommendationViewModel;
    onClose: () => void;
}) {
    const form = useForm({
        reason: '',
    });
    const reasonRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        reasonRef.current?.focus();
    }, []);

    function handleSubmit(e: FormEvent) {
        e.preventDefault();

        form.post(`/operations/gpt-recommendations/${rec.id}/reject`, {
            onSuccess: () => onClose(),
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                className="w-full max-w-md space-y-4 rounded-xl bg-surface p-6 shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`reject-gpt-title-${rec.id}`}
            >
                <div className="flex items-center gap-3 text-danger">
                    <XCircle className="h-6 w-6" />
                    <h3
                        id={`reject-gpt-title-${rec.id}`}
                        className="text-lg font-semibold text-ink"
                    >
                        Reject AI Recommendation
                    </h3>
                </div>

                <p className="text-sm text-ink-soft">
                    Rejecting Recommendation #{rec.id} will mark it as rejected
                    and preserve a structured audit log.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-ink uppercase">
                            Rejection Reason (Optional)
                        </label>
                        <input
                            ref={reasonRef}
                            type="text"
                            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                            placeholder="e.g. Driver requested off shift / Site requires 80T crane instead"
                            value={form.data.reason}
                            onChange={(e) =>
                                form.setData('reason', e.target.value)
                            }
                        />
                        {form.errors.reason && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.reason}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={form.processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="secondary"
                            className="border-danger/30 bg-danger-soft text-danger-strong hover:bg-danger-soft/70"
                            disabled={form.processing}
                        >
                            {form.processing
                                ? 'Rejecting…'
                                : 'Confirm Rejection'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
