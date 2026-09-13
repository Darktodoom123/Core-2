import { router } from '@inertiajs/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DispatchAdvisoryCard } from '@/components/workspace/dispatch-advisory-card';
import type { DispatchAdvisoryCardProps } from '@/components/workspace/dispatch-advisory-card';
import { AcceptGptModal } from '@/components/workspace/gpt-workspace-section';
import type { GptRecommendationViewModel } from '@/types/workspace';

const proposal: GptRecommendationViewModel = {
    id: 1,
    subject_id: 10,
    subject_type: 'dispatch_job',
    purpose: 'dispatch_assignment',
    context_hash: 'test',
    status: 'pending_review',
    prompt_summary: null,
    response_summary: 'The proposed crane meets the capacity requirement.',
    recommendation: {},
    proposed_personnel: [
        {
            user_id: 2,
            name: 'Sample Operator',
            assignment_type: 'crane_operator',
        },
    ],
    proposed_assets: [
        {
            operational_asset_id: 3,
            name: 'Crawler Crane',
            asset_code: 'CR-03',
            assignment_type: 'crane',
        },
    ],
    conflicts: [],
    model: 'test',
    cost_usd: null,
    usage: null,
    generated_at: null,
    latency_ms: null,
    purge_at: null,
    expires_at: null,
    is_expired: false,
    is_retryable: false,
    error_message: null,
    retry_url: '/recommendations/1/retry',
    requested_by: { id: 1, name: 'Manager' },
    decided_by: null,
    decided_at: null,
    created_at: null,
    is_advisory: true,
};

function show(overrides: Partial<DispatchAdvisoryCardProps> = {}) {
    const props: DispatchAdvisoryCardProps = {
        jobId: 10,
        automatic: true,
        busy: false,
        canRequest: true,
        canReview: true,
        canRetry: true,
        canViewHistory: true,
        error: null,
        onRequest: vi.fn(),
        onRetry: vi.fn(),
        onReview: vi.fn(),
        onReject: vi.fn(),
        ...overrides,
    };
    render(<DispatchAdvisoryCard {...props} />);

    return props;
}

describe('dispatch advisory', () => {
    it('keeps the confirmation open when assignment validation fails', () => {
        const onClose = vi.fn();
        vi.mocked(router.post).mockImplementationOnce(
            (_url, _data, options) => {
                options?.onError?.({
                    gpt: 'Resource availability changed. Refresh the suggestion.',
                });
                options?.onFinish?.({} as never);
            },
        );
        render(<AcceptGptModal rec={proposal} onClose={onClose} />);
        expect(screen.getByRole('dialog')).toHaveTextContent('Sample Operator');
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Confirm & Apply 1 crew & 1 asset',
            }),
        );
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Resource availability changed.',
        );
        expect(onClose).not.toHaveBeenCalled();
    });
    it('waits honestly without starting a request on render', () => {
        const props = show();
        expect(
            screen.getByText('Waiting for a suggestion'),
        ).toBeInTheDocument();
        expect(
            screen.queryByText('Checking resources'),
        ).not.toBeInTheDocument();
        expect(props.onRequest).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Request now' }));
        expect(props.onRequest).toHaveBeenCalledOnce();
    });

    it.each(['draft', 'processing'])(
        'shows actual %s work without duplicate request actions',
        (status) => {
            show({ recommendation: { ...proposal, status } });
            expect(screen.getByRole('status')).toHaveTextContent(
                status === 'draft'
                    ? 'Suggestion queued'
                    : 'Finding suitable resources',
            );
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
            expect(
                screen.queryByText('Sample Operator'),
            ).not.toBeInTheDocument();
        },
    );

    it('shows named resources and opens review only after an explicit click', () => {
        const props = show({ recommendation: proposal });
        expect(screen.getByText('Sample Operator')).toBeInTheDocument();
        expect(screen.getByText('Crawler Crane')).toBeInTheDocument();
        expect(props.onReview).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Review details' }));
        expect(props.onReview).toHaveBeenCalledOnce();
        expect(props.onRequest).not.toHaveBeenCalled();
    });

    it('renders rich crew details including initials, role badges, and user ID tags', () => {
        show({
            recommendation: {
                ...proposal,
                proposed_personnel: [
                    {
                        user_id: 19,
                        name: 'Sarah Jenkins',
                        role: 'field_foreman',
                        assignment_type: 'driver',
                    },
                ],
                proposed_assets: [],
            },
        });
        expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
        expect(screen.getByText('#19')).toBeInTheDocument();
        expect(screen.getByText('driver')).toBeInTheDocument();
        expect(screen.getByText('· field foreman')).toBeInTheDocument();
        expect(screen.getByText('SJ')).toBeInTheDocument();
    });

    it('renders rich equipment details including asset code pill, name, capacity, and asset ID', () => {
        show({
            recommendation: {
                ...proposal,
                proposed_personnel: [],
                proposed_assets: [
                    {
                        operational_asset_id: 14,
                        asset_code: 'CR-101',
                        name: 'Liebherr LTM 1050',
                        assignment_type: 'crane',
                        capacity: '50 t',
                    },
                ],
            },
        });
        expect(screen.getByText('CR-101')).toBeInTheDocument();
        expect(screen.getByText('Liebherr LTM 1050')).toBeInTheDocument();
        expect(screen.getByText('#14')).toBeInTheDocument();
        expect(screen.getByText('50 t')).toBeInTheDocument();
        expect(screen.getByText('crane')).toBeInTheDocument();
    });

    it('renders clean fallbacks without duplicate ID badges when personnel names or asset codes are missing', () => {
        show({
            recommendation: {
                ...proposal,
                proposed_personnel: [
                    {
                        user_id: 19,
                        assignment_type: 'driver',
                    },
                ],
                proposed_assets: [
                    {
                        operational_asset_id: 14,
                        assignment_type: 'truck',
                    },
                ],
            },
        });
        expect(screen.getByText('Crew member #19')).toBeInTheDocument();
        expect(screen.getByText('Equipment #14')).toBeInTheDocument();
        // Fallback names should not have redundant adjacent #19 or #14 badges
        expect(screen.queryByText('#19')).not.toBeInTheDocument();
        expect(screen.queryByText('#14')).not.toBeInTheDocument();
    });

    it('does not duplicate asset code when asset name equals asset code', () => {
        show({
            recommendation: {
                ...proposal,
                proposed_personnel: [],
                proposed_assets: [
                    {
                        operational_asset_id: 14,
                        asset_code: 'CR-101',
                        name: 'CR-101',
                        assignment_type: 'crane',
                        kind: 'mobile_crane',
                    },
                ],
            },
        });
        expect(screen.getAllByText('CR-101')).toHaveLength(1);
        expect(screen.getByText('#14')).toBeInTheDocument();
    });

    it.each(['expired', 'stale', 'failed'])(
        'does not offer to apply a %s proposal',
        (status) => {
            const props = show({
                recommendation: { ...proposal, status, is_retryable: true },
            });
            expect(
                screen.queryByRole('button', { name: /Review & apply/ }),
            ).not.toBeInTheDocument();
            fireEvent.click(
                screen.getByRole('button', {
                    name:
                        status === 'failed'
                            ? 'Try again'
                            : 'Refresh suggestions',
                }),
            );
            expect(props.onRetry).toHaveBeenCalledOnce();
        },
    );

    it('routes active dispatch resource changes through assignment review', () => {
        show({
            recommendation: proposal,
            assignmentUrl: '/assignments?job=10',
        });
        expect(
            screen.getByRole('link', {
                name: /Review in assignment workspace/,
            }),
        ).toHaveAttribute('href', '/assignments?job=10');
        expect(
            screen.queryByRole('button', { name: /Review & apply/ }),
        ).not.toBeInTheDocument();
    });

    it('retains applied status after the proposal validity window expires', () => {
        show({
            recommendation: {
                ...proposal,
                status: 'accepted',
                is_expired: true,
            },
        });
        expect(screen.getByText('Resource plan applied')).toBeInTheDocument();
        expect(
            screen.queryByText('Refresh before applying'),
        ).not.toBeInTheDocument();
    });

    it('respects permissions and announces request errors', () => {
        show({
            recommendation: proposal,
            canReview: false,
            canRequest: false,
            canRetry: false,
            error: 'Request limit reached.',
        });
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Request limit reached.',
        );
    });

    it('does not invent resources when the proposal is guidance only', () => {
        show({
            recommendation: {
                ...proposal,
                proposed_personnel: [],
                proposed_assets: [],
            },
        });
        expect(screen.getByText('No resources proposed')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Review advisory' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /Review & apply/ }),
        ).not.toBeInTheDocument();
    });

    it('does not render the confirmation footer or advisory history link', () => {
        show({ recommendation: proposal, canViewHistory: true });
        expect(
            screen.queryByText('You confirm every assignment'),
        ).not.toBeInTheDocument();
        expect(screen.queryByText('Advisory history')).not.toBeInTheDocument();
    });

    it('differentiates crew and equipment placeholders between queued and processing', () => {
        const { unmount } = render(
            <DispatchAdvisoryCard
                jobId={10}
                recommendation={{ ...proposal, status: 'draft' }}
                automatic={true}
                busy={false}
                canRequest={true}
                canReview={true}
                canRetry={true}
                error={null}
                onRequest={vi.fn()}
                onRetry={vi.fn()}
                onReview={vi.fn()}
                onReject={vi.fn()}
            />,
        );
        expect(
            screen.getByText('Queued for crew eligibility check'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Queued for asset capacity & schedule fit'),
        ).toBeInTheDocument();

        unmount();

        render(
            <DispatchAdvisoryCard
                jobId={10}
                recommendation={{ ...proposal, status: 'processing' }}
                automatic={true}
                busy={false}
                canRequest={true}
                canReview={true}
                canRetry={true}
                error={null}
                onRequest={vi.fn()}
                onRetry={vi.fn()}
                onReview={vi.fn()}
                onReject={vi.fn()}
            />,
        );
        expect(
            screen.getByText('Checking driver & operator qualifications'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Matching cranes, transport trucks & flatbeds'),
        ).toBeInTheDocument();
    });

    it('displays while-waiting guidance and manual assignment link during pending states', () => {
        show({
            recommendation: { ...proposal, status: 'draft' },
            manualAssignmentUrl: '/operations/dispatch-jobs/10?tab=assignments',
        });
        expect(screen.getByText("You don't have to wait")).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /Assign resources manually/i }),
        ).toHaveAttribute(
            'href',
            '/operations/dispatch-jobs/10?tab=assignments',
        );
    });

    it('renders prolonged wait recovery options when pending wait exceeds 25 seconds', () => {
        vi.useFakeTimers();

        try {
            const props = show({
                recommendation: { ...proposal, status: 'processing' },
                manualAssignmentUrl: '/operations/dispatch-jobs/10',
                canRetry: true,
            });

            expect(
                screen.queryByText('Taking longer than expected'),
            ).not.toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(26000);
            });

            expect(
                screen.getByText('Taking longer than expected'),
            ).toBeInTheDocument();
            const retryButton = screen.getByRole('button', {
                name: /Retry check/i,
            });
            expect(retryButton).toBeInTheDocument();
            fireEvent.click(retryButton);
            expect(props.onRetry).toHaveBeenCalledOnce();

            expect(
                screen.getByRole('link', { name: /Assign manually/i }),
            ).toHaveAttribute('href', '/operations/dispatch-jobs/10');
        } finally {
            vi.useRealTimers();
        }
    });

    it('renders manual assignment link when recommendation fails or is rejected', () => {
        show({
            recommendation: {
                ...proposal,
                status: 'failed',
                is_retryable: true,
            },
            manualAssignmentUrl: '/operations/dispatch-jobs/10?tab=assignments',
        });
        expect(
            screen.getByRole('link', { name: /Assign resources manually/i }),
        ).toHaveAttribute(
            'href',
            '/operations/dispatch-jobs/10?tab=assignments',
        );
    });

    it('toggles crew and equipment checkboxes and dynamically updates the apply button count', () => {
        show({ recommendation: proposal });

        const applyButton = screen.getByRole('button', {
            name: 'Apply 1 crew & 1 asset',
        });
        expect(applyButton).toBeEnabled();

        const crewCheckbox = screen.getByRole('checkbox', {
            name: 'Select Sample Operator',
        });
        const assetCheckbox = screen.getByRole('checkbox', {
            name: 'Select CR-03 · Crawler Crane',
        });

        expect(crewCheckbox).toBeChecked();
        expect(assetCheckbox).toBeChecked();

        // Uncheck crew -> dynamic count changes to "Apply 1 asset"
        fireEvent.click(crewCheckbox);
        expect(crewCheckbox).not.toBeChecked();
        expect(
            screen.getByRole('button', { name: 'Apply 1 asset' }),
        ).toBeEnabled();

        // Uncheck asset -> 0 selected -> button shows "Apply selected" and is disabled
        fireEvent.click(assetCheckbox);
        expect(assetCheckbox).not.toBeChecked();
        const disabledButton = screen.getByRole('button', {
            name: 'Apply selected',
        });
        expect(disabledButton).toBeDisabled();

        // Re-check crew -> dynamic count changes to "Apply 1 crew" and enabled
        fireEvent.click(crewCheckbox);
        expect(crewCheckbox).toBeChecked();
        expect(
            screen.getByRole('button', { name: 'Apply 1 crew' }),
        ).toBeEnabled();
    });

    it('triggers Smart Apply directly in-place on clean suggestions without modal', () => {
        const onApply = vi.fn();
        const onReview = vi.fn();

        show({
            recommendation: proposal,
            onApply,
            onReview,
        });

        const applyButton = screen.getByRole('button', {
            name: 'Apply 1 crew & 1 asset',
        });
        fireEvent.click(applyButton);

        expect(onApply).toHaveBeenCalledOnce();
        expect(onApply).toHaveBeenCalledWith([2], [3]);
        expect(onReview).not.toHaveBeenCalled();
    });

    it('shows Review & Resolve Conflicts button when recommendation has conflicts', () => {
        const onReview = vi.fn();
        const onApply = vi.fn();

        show({
            recommendation: {
                ...proposal,
                conflicts: [
                    { reason: 'Operating window overlaps with maintenance' },
                ],
            },
            onReview,
            onApply,
        });

        expect(
            screen.queryByRole('button', { name: /Apply 1 crew/ }),
        ).not.toBeInTheDocument();

        const conflictButton = screen.getByRole('button', {
            name: 'Review & Resolve Conflicts',
        });
        expect(conflictButton).toBeInTheDocument();

        fireEvent.click(conflictButton);
        expect(onReview).toHaveBeenCalledOnce();
        expect(onReview).toHaveBeenCalledWith([2], [3]);
        expect(onApply).not.toHaveBeenCalled();
    });

    it('allows opening full review modal from clean suggestions via Review details', () => {
        const onReview = vi.fn();

        show({
            recommendation: proposal,
            onReview,
        });

        const reviewDetailsButton = screen.getByRole('button', {
            name: 'Review details',
        });
        fireEvent.click(reviewDetailsButton);

        expect(onReview).toHaveBeenCalledOnce();
        expect(onReview).toHaveBeenCalledWith([2], [3]);
    });

    it('displays appliedNotice status update when resources are applied', () => {
        show({
            recommendation: {
                ...proposal,
                status: 'accepted',
            },
            appliedNotice: 'Resource plan applied successfully.',
        });

        expect(
            screen.getByText('Resource plan applied successfully.'),
        ).toBeInTheDocument();
    });

    it('renders raw string conflicts directly on the card without fallback text', () => {
        show({
            recommendation: {
                ...proposal,
                conflicts: [
                    'Crane CR-03 booked for inspection at 10:00 AM' as unknown as Record<
                        string,
                        unknown
                    >,
                ],
            },
        });

        expect(
            screen.getByText('Crane CR-03 booked for inspection at 10:00 AM'),
        ).toBeInTheDocument();
        expect(
            screen.queryByText('Review this constraint in the full advisory.'),
        ).not.toBeInTheDocument();
    });

    it('renders raw string conflicts directly in AcceptGptModal without fallback text', () => {
        const onClose = vi.fn();
        render(
            <AcceptGptModal
                rec={{
                    ...proposal,
                    conflicts: [
                        'Driver John exceeds maximum consecutive driving hours' as unknown as Record<
                            string,
                            unknown
                        >,
                    ],
                }}
                onClose={onClose}
            />,
        );

        expect(
            screen.getByText(
                'Driver John exceeds maximum consecutive driving hours',
            ),
        ).toBeInTheDocument();
        expect(
            screen.queryByText('Review this constraint in the advisory.'),
        ).not.toBeInTheDocument();
    });

    it('disables apply button in AcceptGptModal when all resources are deselected', () => {
        const onClose = vi.fn();
        render(<AcceptGptModal rec={proposal} onClose={onClose} />);

        const crewCheckbox = screen.getByRole('checkbox', {
            name: 'Select Sample Operator',
        });
        const assetCheckbox = screen.getByRole('checkbox', {
            name: 'Select CR-03 · Crawler Crane',
        });

        expect(crewCheckbox).toBeChecked();
        expect(assetCheckbox).toBeChecked();

        fireEvent.click(crewCheckbox);
        fireEvent.click(assetCheckbox);

        const submitButton = screen.getByRole('button', {
            name: 'Confirm & Apply Selected',
        });
        expect(submitButton).toBeDisabled();
    });

    it('allows refreshing an expired proposal even when is_retryable is false', () => {
        const props = show({
            recommendation: {
                ...proposal,
                status: 'expired',
                is_retryable: false,
            },
            canRetry: true,
        });

        const refreshButton = screen.getByRole('button', {
            name: 'Refresh suggestions',
        });
        expect(refreshButton).toBeInTheDocument();
        fireEvent.click(refreshButton);
        expect(props.onRetry).toHaveBeenCalledOnce();
    });

    it('falls back to onRequest in expired state when canRetry is false but canRequest is true', () => {
        const props = show({
            recommendation: {
                ...proposal,
                status: 'expired',
                is_retryable: false,
            },
            canRetry: false,
            canRequest: true,
        });

        const refreshButton = screen.getByRole('button', {
            name: 'Refresh suggestions',
        });
        expect(refreshButton).toBeInTheDocument();
        fireEvent.click(refreshButton);
        expect(props.onRequest).toHaveBeenCalledOnce();
        expect(props.onRetry).not.toHaveBeenCalled();
    });

    it('renders suggested resources with muted styling and no checkboxes when expired', () => {
        show({
            recommendation: {
                ...proposal,
                status: 'expired',
            },
        });

        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(screen.getByText('Sample Operator')).toBeInTheDocument();
        expect(screen.getByText('Crawler Crane')).toBeInTheDocument();
    });
});
