import { router } from '@inertiajs/react';
import { fireEvent, render, screen } from '@testing-library/react';
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
                options?.onFinish?.();
            },
        );
        render(<AcceptGptModal rec={proposal} onClose={onClose} />);
        expect(screen.getByRole('dialog')).toHaveTextContent('Sample Operator');
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Confirm & Apply Resource Plan',
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
        fireEvent.click(
            screen.getByRole('button', { name: 'Review & apply suggestion' }),
        );
        expect(props.onReview).toHaveBeenCalledOnce();
        expect(props.onRequest).not.toHaveBeenCalled();
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
});
