import { router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { DispatchAdvisoryCard } from '@/components/workspace/dispatch-advisory-card';
import {
    AcceptGptModal,
    RecommendationDetails,
    RejectGptModal,
} from '@/components/workspace/gpt-workspace-section';
import type { Auth } from '@/types/auth';
import type {
    DispatchJobViewModel,
    GptRecommendationViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

export interface DispatchGptAdvisoryProps {
    job: DispatchJobViewModel;
    recommendations?: GptRecommendationViewModel[];
    capabilities: WorkspaceCapabilities;
}

function assignmentWorkspaceUrl(jobId: number, returnTo: string): string {
    const query = new URLSearchParams({ return_to: returnTo }).toString();

    return `/operations/dispatch-jobs/${jobId}?${query}`;
}

export function DispatchGptAdvisory({
    job,
    recommendations = [],
    capabilities,
}: DispatchGptAdvisoryProps) {
    const page = usePage<{ auth?: Auth }>();
    const returnTo = page.url;
    const { auth, errors } = page.props;
    const errorBag = `dispatchAdvisory${job.id}`;
    const persistedErrors = errors?.[errorBag];
    const persistedRequestError =
        typeof persistedErrors === 'string'
            ? persistedErrors
            : persistedErrors && typeof persistedErrors === 'object'
              ? Object.values(persistedErrors).join(' ')
              : null;
    const isAdmin =
        auth?.role === 'system_administrator' ||
        auth?.role === 'admin' ||
        auth?.prototype_role === 'system_administrator';
    const [selectedForAccept, setSelectedForAccept] =
        useState<GptRecommendationViewModel | null>(null);
    const [selectedForReject, setSelectedForReject] =
        useState<GptRecommendationViewModel | null>(null);
    const [requesting, setRequesting] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);
    const recommendation = useMemo(
        () =>
            recommendations
                .filter(
                    (candidate) =>
                        candidate.subject_type === 'dispatch_job' &&
                        candidate.subject_id === job.id &&
                        candidate.purpose === 'dispatch_assignment',
                )
                .reduce<GptRecommendationViewModel | undefined>(
                    (latest, candidate) =>
                        !latest || candidate.id > latest.id
                            ? candidate
                            : latest,
                    undefined,
                ),
        [job.id, recommendations],
    );

    const requestRecommendation = (retry = false) => {
        setRequestError(null);
        setRequesting(true);
        router.post(
            retry && recommendation
                ? recommendation.retry_url
                : '/operations/gpt-recommendations',
            retry
                ? {}
                : {
                      subject_type: 'dispatch_job',
                      subject_id: job.id,
                      purpose: 'dispatch_assignment',
                  },
            {
                preserveScroll: true,
                errorBag,
                only: ['gptRecommendations', 'errors', 'flash'],
                onError: (errors) =>
                    setRequestError(Object.values(errors).join(' ')),
                onFinish: () => setRequesting(false),
            },
        );
    };

    return (
        <>
            <DispatchAdvisoryCard
                jobId={job.id}
                recommendation={recommendation}
                automatic={Boolean(capabilities.proactive_gpt_assistance)}
                busy={requesting}
                canRequest={capabilities.request_gpt_assistance}
                canReview={capabilities.decide_gpt_recommendation}
                canRetry={capabilities.retry_gpt_recommendation}
                canViewHistory={isAdmin || capabilities.request_gpt_assistance}
                error={
                    requesting ? null : (requestError ?? persistedRequestError)
                }
                assignmentUrl={
                    !['draft', 'pending_approval', 'scheduled'].includes(
                        job.status.value,
                    )
                        ? assignmentWorkspaceUrl(job.id, returnTo)
                        : undefined
                }
                onRequest={() => requestRecommendation()}
                onRetry={() => requestRecommendation(true)}
                onReview={() =>
                    recommendation && setSelectedForAccept(recommendation)
                }
                onReject={() =>
                    recommendation && setSelectedForReject(recommendation)
                }
                details={
                    recommendation ? (
                        <RecommendationDetails rec={recommendation} />
                    ) : undefined
                }
            />
            {selectedForAccept && (
                <AcceptGptModal
                    rec={selectedForAccept}
                    onClose={() => setSelectedForAccept(null)}
                />
            )}
            {selectedForReject && (
                <RejectGptModal
                    rec={selectedForReject}
                    onClose={() => setSelectedForReject(null)}
                />
            )}
        </>
    );
}
