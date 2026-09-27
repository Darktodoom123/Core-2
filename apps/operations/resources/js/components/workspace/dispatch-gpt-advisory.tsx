import { router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { DispatchAdvisoryCard } from '@/components/workspace/dispatch-advisory-card';
import { DispatchBlockerAdvisory } from '@/components/workspace/dispatch-blocker-advisory';
import {
    AcceptGptModal,
    RecommendationDetails,
    RejectGptModal,
} from '@/components/workspace/gpt-workspace-section';
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

function LegacyDispatchGptAdvisory({
    job,
    recommendations = [],
    capabilities,
}: DispatchGptAdvisoryProps) {
    const page = usePage();
    const returnTo = page.url;
    const { errors } = page.props;
    const errorBag = `dispatchAdvisory${job.id}`;
    const persistedErrors = errors?.[errorBag];
    const persistedRequestError =
        typeof persistedErrors === 'string'
            ? persistedErrors
            : persistedErrors && typeof persistedErrors === 'object'
              ? Object.values(persistedErrors).join(' ')
              : null;
    const [selectedForAccept, setSelectedForAccept] =
        useState<GptRecommendationViewModel | null>(null);
    const [selectedForReject, setSelectedForReject] =
        useState<GptRecommendationViewModel | null>(null);
    const [modalTrigger, setModalTrigger] = useState<HTMLElement | null>(null);
    const [modalPersonnelIds, setModalPersonnelIds] = useState<
        number[] | undefined
    >();
    const [modalAssetIds, setModalAssetIds] = useState<number[] | undefined>();
    const [requesting, setRequesting] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);
    const [pollingCycle, setPollingCycle] = useState(0);
    const [pollingStoppedFor, setPollingStoppedFor] = useState<string | null>(
        null,
    );
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
    const recommendationVersion = recommendation?.recommendation.job_version;
    const assignedPersonnelIds = new Set(
        job.personnel_assignments.map((assignment) => assignment.user_id),
    );
    const assignedAssetIds = new Set(
        job.asset_assignments.map(
            (assignment) => assignment.operational_asset_id,
        ),
    );
    const staleRecommendation =
        recommendation !== undefined &&
        recommendation.status === 'pending_review' &&
        (typeof recommendationVersion !== 'number' ||
            recommendationVersion !== job.version ||
            (recommendation.proposed_personnel ?? []).some((person) =>
                assignedPersonnelIds.has(person.user_id),
            ) ||
            (recommendation.proposed_assets ?? []).some((asset) =>
                assignedAssetIds.has(asset.operational_asset_id),
            ));
    const visibleRecommendation =
        recommendation && staleRecommendation
            ? { ...recommendation, is_stale: true }
            : recommendation;

    const isPending =
        requesting ||
        recommendation?.status === 'draft' ||
        recommendation?.status === 'processing';
    const pendingKey = recommendation
        ? `${job.id}:${recommendation.id}`
        : `${job.id}:requesting`;
    const pollingStopped = pollingStoppedFor === pendingKey;

    useEffect(() => {
        if (!isPending) {
            return;
        }

        let attempts = 0;
        const maxAttempts = 15;
        const interval = window.setInterval(() => {
            if (attempts >= maxAttempts) {
                window.clearInterval(interval);
                setPollingStoppedFor(pendingKey);

                return;
            }

            attempts += 1;
            router.reload({
                only: ['gptRecommendations'],
            });
        }, 3500);

        return () => window.clearInterval(interval);
    }, [isPending, pendingKey, pollingCycle]);

    const requestRecommendation = (retry = false) => {
        setRequestError(null);
        setRequesting(true);
        setPollingStoppedFor(null);
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

    const refreshPendingStatus = () => {
        setPollingStoppedFor(null);
        setPollingCycle((cycle) => cycle + 1);
        router.reload({ only: ['gptRecommendations'] });
    };

    return (
        <>
            <DispatchAdvisoryCard
                jobId={job.id}
                recommendation={visibleRecommendation}
                automatic={Boolean(capabilities.proactive_gpt_assistance)}
                busy={requesting}
                pollingStopped={pollingStopped}
                canRequest={capabilities.request_gpt_assistance}
                canReview={capabilities.decide_gpt_recommendation}
                canRetry={capabilities.retry_gpt_recommendation}
                canViewHistory={capabilities.view_gpt_governance ?? false}
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
                manualAssignmentUrl={assignmentWorkspaceUrl(job.id, returnTo)}
                onRequest={() => requestRecommendation()}
                onRetry={() => requestRecommendation(true)}
                onRefreshStatus={refreshPendingStatus}
                onReview={(personnelIds, assetIds) => {
                    if (!recommendation || staleRecommendation) {
                        return;
                    }

                    setModalPersonnelIds(personnelIds);
                    setModalAssetIds(assetIds);
                    setModalTrigger(
                        document.activeElement instanceof HTMLElement
                            ? document.activeElement
                            : null,
                    );
                    setSelectedForAccept(recommendation);
                }}
                onReject={() => {
                    if (!recommendation) {
                        return;
                    }

                    setModalTrigger(
                        document.activeElement instanceof HTMLElement
                            ? document.activeElement
                            : null,
                    );
                    setSelectedForReject(recommendation);
                }}
                details={
                    recommendation ? (
                        <RecommendationDetails rec={recommendation} />
                    ) : undefined
                }
            />
            {selectedForAccept && (
                <AcceptGptModal
                    rec={selectedForAccept}
                    job={job}
                    manualAssignmentUrl={assignmentWorkspaceUrl(
                        job.id,
                        returnTo,
                    )}
                    initialPersonnelIds={modalPersonnelIds}
                    initialAssetIds={modalAssetIds}
                    onClose={() => {
                        setSelectedForAccept(null);
                        setModalPersonnelIds(undefined);
                        setModalAssetIds(undefined);
                    }}
                    returnFocusTo={modalTrigger}
                />
            )}
            {selectedForReject && (
                <RejectGptModal
                    rec={selectedForReject}
                    onClose={() => setSelectedForReject(null)}
                    returnFocusTo={modalTrigger}
                />
            )}
        </>
    );
}

export function DispatchGptAdvisory(props: DispatchGptAdvisoryProps) {
    if (props.capabilities.blocker_resolution_enabled) {
        return (
            <DispatchBlockerAdvisory
                job={props.job}
                recommendations={props.recommendations ?? []}
                capabilities={props.capabilities}
            />
        );
    }

    return <LegacyDispatchGptAdvisory {...props} />;
}
