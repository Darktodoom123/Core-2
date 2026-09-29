import { PauseCircle, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { Button, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { budgetShare, formatUsd } from './admin-dashboard-model';
import { PauseAiDialog } from './pause-ai-dialog';
import type { AiGovernanceState } from './use-admin-data';

export function AiGovernancePanel({
    governance,
    canOpenAdvisory,
    onOpenAdvisory,
}: {
    governance: AiGovernanceState;
    canOpenAdvisory: boolean;
    onOpenAdvisory: () => void;
}) {
    const { data: ai, error, saving, saveError, setPaused } = governance;
    const [confirming, setConfirming] = useState(false);
    const share = budgetShare(ai);
    const paused = ai?.circuit_breaker_active ?? false;

    return (
        <section
            aria-labelledby="admin-ai-heading"
            className="overflow-hidden rounded-xl border border-line bg-surface shadow-2xs"
        >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                <div>
                    <h2
                        id="admin-ai-heading"
                        className="text-sm font-semibold text-ink"
                    >
                        AI advice
                    </h2>
                    <p className="text-xs text-ink-soft">
                        Spend, outcomes, and the switch that stops new AI
                        requests.
                    </p>
                </div>
                {canOpenAdvisory && (
                    <Button variant="quiet" size="sm" onClick={onOpenAdvisory}>
                        Open AI advisory
                    </Button>
                )}
            </div>

            {!ai ? (
                error ? (
                    <div className="flex items-center justify-between gap-3 p-4 text-sm text-warning-strong sm:px-5">
                        <span>{error}</span>
                        <Button size="sm" onClick={governance.reload}>
                            Try again
                        </Button>
                    </div>
                ) : (
                    <div role="status" className="space-y-3 p-4 sm:p-5">
                        <span className="sr-only">Loading AI usage</span>
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                    </div>
                )
            ) : (
                <div className="space-y-4 p-4 sm:p-5">
                    <div
                        className={cn(
                            'flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3',
                            paused
                                ? 'border-warning/40 bg-warning-soft'
                                : 'border-line bg-surface-subtle',
                        )}
                    >
                        <div className="flex items-center gap-2.5">
                            {paused ? (
                                <PauseCircle
                                    className="size-5 text-warning-strong"
                                    aria-hidden="true"
                                />
                            ) : (
                                <PlayCircle
                                    className="size-5 text-success-strong"
                                    aria-hidden="true"
                                />
                            )}
                            <div>
                                <p className="text-sm font-semibold text-ink">
                                    {paused ? 'Paused' : 'Running'}
                                </p>
                                <p className="text-xs text-ink-soft">
                                    {paused
                                        ? 'Dispatchers get no AI suggestions. Existing advice stays reviewable.'
                                        : 'Dispatchers can request AI suggestions. People still approve every change.'}
                                </p>
                            </div>
                        </div>
                        {paused ? (
                            <Button
                                size="sm"
                                variant="primary"
                                disabled={saving}
                                onClick={() => void setPaused(false)}
                            >
                                {saving ? 'Resuming…' : 'Resume AI advice'}
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={saving}
                                onClick={() => setConfirming(true)}
                            >
                                Pause AI advice
                            </Button>
                        )}
                    </div>

                    {saveError && !confirming && (
                        <p role="alert" className="text-xs text-danger-strong">
                            {saveError}
                        </p>
                    )}

                    <div>
                        <div className="flex items-baseline justify-between text-xs">
                            <span className="font-medium text-ink">
                                Spend this month
                            </span>
                            <span className="font-semibold text-ink tabular-nums">
                                {formatUsd(ai.monthly_spend_usd)} of{' '}
                                {formatUsd(ai.monthly_budget_ceiling_usd)}
                                {share !== null &&
                                    ` · ${Math.round(share * 100)}%`}
                            </span>
                        </div>
                        <div
                            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-subtle"
                            aria-hidden="true"
                        >
                            <div
                                className={cn(
                                    'h-full rounded-full',
                                    share !== null && share >= 1
                                        ? 'bg-danger'
                                        : share !== null && share >= 0.8
                                          ? 'bg-warning'
                                          : 'bg-ink-soft/70',
                                )}
                                style={{
                                    width: `${Math.min(100, Math.round((share ?? 0) * 100))}%`,
                                }}
                            />
                        </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line text-xs sm:grid-cols-4">
                        <Stat label="Accepted" value={ai.accepted_count} />
                        <Stat label="Rejected" value={ai.rejected_count} />
                        <Stat
                            label="Tokens"
                            value={ai.total_tokens.toLocaleString()}
                        />
                        <Stat
                            label="Avg. response"
                            value={
                                ai.avg_latency_ms > 0
                                    ? `${(ai.avg_latency_ms / 1000).toFixed(1)} s`
                                    : '—'
                            }
                        />
                    </dl>
                </div>
            )}

            <PauseAiDialog
                open={confirming}
                saving={saving}
                error={saveError}
                onCancel={() => setConfirming(false)}
                onConfirm={async (reason) => {
                    const saved = await setPaused(true, reason);

                    if (saved) {
                        setConfirming(false);
                    }

                    return saved;
                }}
            />
        </section>
    );
}

function Stat({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="bg-surface px-3 py-2.5">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink tabular-nums">
                {value}
            </dd>
        </div>
    );
}
