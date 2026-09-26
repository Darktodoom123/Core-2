import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { humanize } from '@/lib/formatters';
import type {
    DispatchJobViewModel,
    GptRecommendationViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

export function DispatchBlockerAdvisory({
    job,
    recommendations,
    capabilities,
}: {
    job: DispatchJobViewModel;
    recommendations: GptRecommendationViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const page = usePage();
    const [requesting, setRequesting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pollingStoppedFor, setPollingStoppedFor] = useState<number | null>(
        null,
    );
    const rec = useMemo(
        () =>
            recommendations
                .filter(
                    (item) =>
                        item.subject_type === 'dispatch_job' &&
                        item.subject_id === job.id &&
                        item.purpose === 'dispatch_blocker_resolution',
                )
                .reduce<GptRecommendationViewModel | undefined>(
                    (latest, item) =>
                        !latest || item.id > latest.id ? item : latest,
                    undefined,
                ),
        [job.id, recommendations],
    );
    const pending =
        requesting || rec?.status === 'draft' || rec?.status === 'processing';
    const pendingId = rec?.id ?? -job.id;
    const pollingStopped = pending && pollingStoppedFor === pendingId;
    const expired = rec?.status !== 'accepted' && Boolean(rec?.is_expired);
    const stale =
        rec?.is_stale ||
        (rec?.recommendation.job_version !== undefined &&
            rec.recommendation.job_version !== job.version);
    const ready = rec?.status === 'pending_review' && !expired && !stale;
    const blocker = rec?.recommendation.blocker as
        | { code?: string; assignment_type?: string; reasons?: string[] }
        | undefined;

    useEffect(() => {
        if (!pending || pollingStopped) {
            return;
        }

        let attempts = 0;
        const timer = window.setInterval(() => {
            attempts += 1;
            router.reload({ only: ['gptRecommendations'] });

            if (attempts >= 25) {
                window.clearInterval(timer);
                setPollingStoppedFor(pendingId);
            }
        }, 3500);

        return () => window.clearInterval(timer);
    }, [pending, pendingId, pollingStopped]);

    const request = (refresh: boolean) => {
        setRequesting(true);
        setError(null);
        router.post(
            '/operations/gpt-recommendations',
            {
                subject_type: 'dispatch_job',
                subject_id: job.id,
                purpose: 'dispatch_blocker_resolution',
                refresh,
            },
            {
                preserveScroll: true,
                errorBag: `dispatchAdvisory${job.id}`,
                only: ['gptRecommendations', 'errors', 'flash'],
                onError: (errors) => setError(Object.values(errors).join(' ')),
                onFinish: () => setRequesting(false),
            },
        );
    };
    const manualUrl = `/operations/dispatch-jobs/${job.id}?${new URLSearchParams({ return_to: page.url })}`;

    return (
        <section
            className="rounded-xl border border-line bg-surface p-4"
            aria-labelledby={`blocker-advice-${job.id}`}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3
                    id={`blocker-advice-${job.id}`}
                    className="text-sm font-semibold text-ink"
                >
                    AI dispatch blocker assistance
                </h3>
                {rec && (
                    <Link
                        href={`/?view=gpt-recommendations&selected=${rec.id}`}
                        className="text-xs text-brand-strong underline"
                    >
                        Advice history
                    </Link>
                )}
            </div>
            {job.project_coverage_url ? (
                <div className="mt-3 space-y-2 text-sm text-ink-soft">
                    <p>
                        Project shift coverage is managed in the project plan.
                        Review open crew slots and asset reservations there.
                    </p>
                    {capabilities.edit_project_plan ? (
                        <Link
                            href={job.project_coverage_url}
                            className="font-medium text-brand-strong underline"
                        >
                            Fill coverage
                        </Link>
                    ) : (
                        <p>Ask a project planner to fill coverage.</p>
                    )}
                </div>
            ) : (
                <div className="mt-3 space-y-3 text-sm">
                    {pending ? (
                        <p role="status" className="text-ink-soft">
                            {pollingStopped
                                ? 'Automatic status checks paused. Check status for the latest result.'
                                : 'Checking the current resource blocker…'}
                        </p>
                    ) : ready ? (
                        <>
                            <div>
                                <p className="font-medium text-ink">
                                    {humanize(
                                        blocker?.code ?? 'resource blocker',
                                    )}
                                    {blocker?.assignment_type
                                        ? ` · ${humanize(blocker.assignment_type)}`
                                        : ''}
                                </p>
                                {blocker?.reasons?.[0] && (
                                    <p className="mt-1 text-ink-soft">
                                        {blocker.reasons[0]}
                                    </p>
                                )}
                                <p className="mt-1 text-ink-soft">
                                    {String(rec?.recommendation.summary ?? '')}
                                </p>
                            </div>
                            {(rec?.blocker_options ?? []).length ? (
                                <ul className="space-y-2">
                                    {rec?.blocker_options?.map((option) => {
                                        const url = `/operations/dispatch-jobs/${job.id}?${new URLSearchParams({ advice_id: String(rec.id), option_id: String(option.id), return_to: page.url })}`;

                                        return (
                                            <li
                                                key={option.id}
                                                className="rounded-lg border border-line p-3"
                                            >
                                                <p className="font-medium text-ink">
                                                    {option.candidate_name ??
                                                        `Resource #${option.candidate_id}`}
                                                </p>
                                                {option.candidate_code && (
                                                    <p className="text-xs text-ink-soft">
                                                        {option.candidate_code}
                                                    </p>
                                                )}
                                                <p className="mt-1 text-xs text-ink-soft">
                                                    {option.explanation}
                                                </p>
                                                <Link
                                                    href={url}
                                                    className="mt-2 inline-block text-xs font-medium text-brand-strong underline"
                                                >
                                                    Review option in assignment
                                                    workflow
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className="text-ink-soft">
                                    No eligible replacement was found. Review
                                    resources manually.
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-ink-soft">
                            {rec?.status === 'accepted'
                                ? 'The reviewed option was saved. Check the readiness panel for any remaining blockers.'
                                : rec?.status === 'failed'
                                  ? (rec.error_message ??
                                    'Advice could not be generated.')
                                  : rec?.status === 'stale' || stale || expired
                                    ? 'Resources may have changed. Refresh before reviewing an option.'
                                    : 'Request a check for the current dispatch resource blocker.'}
                        </p>
                    )}
                    {error && (
                        <p role="alert" className="text-danger">
                            {error}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {pollingStopped && (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                    setPollingStoppedFor(null);
                                    router.reload({
                                        only: ['gptRecommendations'],
                                    });
                                }}
                            >
                                Check status
                            </Button>
                        )}
                        {capabilities.request_gpt_assistance && !pending && (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => request(Boolean(rec))}
                            >
                                {rec?.status === 'accepted'
                                    ? 'Check next blocker'
                                    : rec
                                      ? 'Refresh advice'
                                      : 'Check blockers'}
                            </Button>
                        )}
                        <Link
                            href={manualUrl}
                            className="inline-flex items-center text-xs font-medium text-brand-strong underline"
                        >
                            Review assignments manually
                        </Link>
                    </div>
                </div>
            )}
        </section>
    );
}
