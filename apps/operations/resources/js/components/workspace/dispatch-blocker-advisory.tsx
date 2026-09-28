import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { formatDateTime, humanize } from '@/lib/formatters';
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
    const [clockNow, setClockNow] = useState(() => Date.now());
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
    const expiresAt = rec?.expires_at ? Date.parse(rec.expires_at) : null;
    const expired =
        rec?.status !== 'accepted' &&
        (Boolean(rec?.is_expired) ||
            (expiresAt !== null &&
                Number.isFinite(expiresAt) &&
                expiresAt <= clockNow));
    const stale =
        rec?.is_stale ||
        (rec?.recommendation.job_version !== undefined &&
            rec.recommendation.job_version !== job.version);
    const ready = rec?.status === 'pending_review' && !expired && !stale;
    const blocker = rec?.recommendation.blocker as
        | {
              code?: string;
              resource_kind?: string;
              action?: string;
              assignment_type?: string;
              reasons?: string[];
          }
        | undefined;
    const resourceLabel = humanize(blocker?.assignment_type ?? 'resource');
    const blockerHeading =
        blocker?.action === 'reassign'
            ? `Replace ${resourceLabel}`
            : blocker?.resource_kind === 'asset'
              ? `Find ${resourceLabel} equipment`
              : `Find a ${resourceLabel}`;

    useEffect(() => {
        if (!rec?.expires_at || rec.status === 'accepted') {
            return;
        }

        const timer = window.setInterval(() => setClockNow(Date.now()), 1_000);

        return () => window.clearInterval(timer);
    }, [rec?.expires_at, rec?.status]);

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
                    {rec?.model === 'rules'
                        ? 'Resource eligibility check'
                        : rec?.status === 'pending_review'
                          ? 'AI-ranked resource options'
                          : 'Resource assistance'}
                </h3>
                {rec && capabilities.view_gpt_governance && (
                    <Link
                        href={`/?view=gpt-recommendations&selected=${rec.id}`}
                        className="inline-flex min-h-11 items-center text-xs text-brand-strong underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
                                    {blockerHeading}
                                </p>
                                {blocker?.reasons?.[0] && (
                                    <p className="mt-1 text-ink-soft">
                                        {blocker.reasons[0]}
                                    </p>
                                )}
                                <p className="mt-1 text-ink-soft">
                                    {String(rec?.recommendation.summary ?? '')}
                                </p>
                                {rec?.generated_at && (
                                    <p className="mt-2 text-xs text-ink-soft">
                                        Checked{' '}
                                        {formatDateTime(rec.generated_at)}
                                        {rec.expires_at &&
                                            ` · Valid until ${formatDateTime(rec.expires_at)}`}
                                    </p>
                                )}
                                {rec?.model === 'rules' && (
                                    <p className="mt-1 text-xs text-ink-soft">
                                        Based on recorded eligibility checks; no
                                        AI model was used for this result.
                                    </p>
                                )}
                            </div>
                            {(rec?.blocker_options ?? []).length ? (
                                <div>
                                    <p className="mb-2 text-xs font-medium text-ink-soft">
                                        {(rec?.blocker_options ?? []).length}{' '}
                                        eligible{' '}
                                        {(rec?.blocker_options ?? []).length ===
                                        1
                                            ? 'option'
                                            : 'options'}
                                        {rec?.model !== 'rules'
                                            ? ' · AI ranked'
                                            : ''}
                                    </p>
                                    <ul className="space-y-2">
                                        {rec?.blocker_options?.map((option) => {
                                            const url = `/operations/dispatch-jobs/${job.id}?${new URLSearchParams({ advice_id: String(rec.id), option_id: String(option.id), return_to: page.url })}`;
                                            const candidateName =
                                                option.candidate_name ??
                                                option.candidate_code ??
                                                `Resource #${option.candidate_id}`;
                                            const evidence = option.evidence;

                                            return (
                                                <li
                                                    key={option.id}
                                                    className="rounded-lg border border-line p-3"
                                                >
                                                    <p className="font-medium text-ink">
                                                        {candidateName}
                                                    </p>
                                                    {option.candidate_code && (
                                                        <p className="text-xs text-ink-soft">
                                                            {
                                                                option.candidate_code
                                                            }
                                                        </p>
                                                    )}
                                                    <p className="mt-1 text-xs text-ink-soft">
                                                        {humanize(
                                                            option.assignment_type,
                                                        )}{' '}
                                                        ·{' '}
                                                        {option.resource_kind ===
                                                        'asset'
                                                            ? 'equipment'
                                                            : 'crew'}
                                                    </p>
                                                    <dl className="mt-2 grid gap-1 text-xs text-ink-soft sm:grid-cols-2">
                                                        {option.resource_kind ===
                                                        'personnel' ? (
                                                            <>
                                                                <div>
                                                                    <dt className="inline font-medium text-ink">
                                                                        Availability:{' '}
                                                                    </dt>
                                                                    <dd className="inline">
                                                                        {humanize(
                                                                            evidence?.availability ??
                                                                                'not recorded',
                                                                        )}
                                                                    </dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="inline font-medium text-ink">
                                                                        Credential:{' '}
                                                                    </dt>
                                                                    <dd className="inline">
                                                                        {humanize(
                                                                            evidence?.credential ??
                                                                                'not recorded',
                                                                        )}
                                                                    </dd>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div>
                                                                <dt className="inline font-medium text-ink">
                                                                    Readiness:{' '}
                                                                </dt>
                                                                <dd className="inline">
                                                                    {humanize(
                                                                        evidence?.readiness ??
                                                                            'not recorded',
                                                                    )}
                                                                </dd>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <dt className="inline font-medium text-ink">
                                                                Schedule:{' '}
                                                            </dt>
                                                            <dd className="inline">
                                                                {evidence?.schedule_conflicts ===
                                                                0
                                                                    ? 'No overlap found'
                                                                    : 'Review in assignments'}
                                                            </dd>
                                                        </div>
                                                    </dl>
                                                    {evidence?.activation_constraints?.map(
                                                        (constraint) => (
                                                            <p
                                                                key={constraint}
                                                                className="mt-2 text-xs font-medium text-warning-strong"
                                                            >
                                                                Before
                                                                activation:{' '}
                                                                {constraint}
                                                            </p>
                                                        ),
                                                    )}
                                                    <p className="mt-2 text-xs text-ink-soft">
                                                        Highlighted check:{' '}
                                                        {option.explanation}
                                                    </p>
                                                    <Link
                                                        href={url}
                                                        aria-label={`Review ${candidateName} for ${humanize(option.assignment_type)}`}
                                                        className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-xs font-medium text-brand-strong underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                                                    >
                                                        Review {candidateName}
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ) : (
                                <p className="text-ink-soft">
                                    No eligible {resourceLabel} was found.
                                    Review resources manually.
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-ink-soft">
                            {rec?.status === 'accepted'
                                ? 'The reviewed option was saved. Check the readiness panel for any remaining blockers.'
                                : rec?.status === 'failed'
                                  ? 'The resource check could not finish. Try again or review assignments manually.'
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
                                className="min-h-11"
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
                                className="min-h-11"
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
                            className="inline-flex min-h-11 items-center text-xs font-medium text-brand-strong underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                            Review assignments manually
                        </Link>
                    </div>
                </div>
            )}
        </section>
    );
}
