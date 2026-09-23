import { router } from '@inertiajs/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GptRecommendationsSurface } from '@/components/workspace/gpt-workspace-section';
import type {
    GptRecommendationViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

const telemetry = {
    monthly_spend_usd: 0,
    monthly_budget_ceiling_usd: 250,
    total_tokens: 0,
    avg_latency_ms: 0,
    acceptance_rate: null,
    accepted_count: 0,
    rejected_count: 0,
    circuit_breaker_active: false,
};

const recommendation: GptRecommendationViewModel = {
    id: 42,
    subject_type: 'dispatch_job',
    subject_id: 12,
    purpose: 'dispatch_assignment',
    context_hash: 'hash',
    status: 'rejected',
    prompt_summary: null,
    response_summary: 'The proposed crew meets the job requirements.',
    recommendation: {
        reasons: ['The operator holds the required credential.'],
    },
    proposed_personnel: [],
    proposed_assets: [],
    conflicts: [],
    model: 'test-model',
    cost_usd: null,
    usage: null,
    generated_at: '2026-09-20T09:00:00+08:00',
    latency_ms: null,
    purge_at: null,
    expires_at: '2026-09-20T09:15:00+08:00',
    expires_in_seconds: 0,
    is_expired: true,
    is_retryable: false,
    error_message: null,
    retry_url: '/operations/gpt-recommendations/42/retry',
    requested_by: { id: 3, name: 'Dispatcher' },
    decided_by: { id: 4, name: 'Manager' },
    decided_at: '2026-09-20T09:10:00+08:00',
    created_at: '2026-09-20T09:00:00+08:00',
    is_advisory: true,
};

const capabilities = {} as WorkspaceCapabilities;

afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/operations');
});

function response(data: unknown): Response {
    return {
        ok: true,
        json: async () => data,
    } as Response;
}

describe('GPT recommendations surface', () => {
    it('shows a recoverable governance error and reports no decisions honestly', async () => {
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce(response(telemetry));
        vi.stubGlobal('fetch', fetchMock);

        render(
            <GptRecommendationsSurface
                recommendations={[]}
                capabilities={capabilities}
            />,
        );

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Governance status could not be loaded.',
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Retry governance status' }),
        );

        expect(await screen.findByText('No decisions')).toBeInTheDocument();
        expect(
            screen.getByRole('button', {
                name: 'Emergency AI Circuit Breaker',
            }),
        ).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('opens the recommendation referenced by a dispatch deep link', async () => {
        window.history.replaceState(
            {},
            '',
            '/operations?view=gpt-recommendations&selected=42',
        );
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(telemetry)));

        render(
            <GptRecommendationsSurface
                recommendations={[]}
                selectedRecommendation={recommendation}
                capabilities={capabilities}
            />,
        );

        expect(
            await screen.findByRole('dialog', { name: /Recommendation #42/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('The proposed crew meets the job requirements.'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('The operator holds the required credential.'),
        ).toBeInTheDocument();
    });

    it('requests the next retained history page without resetting the workspace', async () => {
        vi.mocked(router.get).mockReset();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(telemetry)));

        render(
            <GptRecommendationsSurface
                recommendations={[recommendation]}
                historyPagination={{
                    current_page: 1,
                    last_page: 2,
                    per_page: 25,
                    total: 26,
                    from: 1,
                    to: 25,
                }}
                capabilities={capabilities}
            />,
        );

        await waitFor(() =>
            expect(screen.getByText('No decisions')).toBeInTheDocument(),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

        expect(router.get).toHaveBeenCalledWith(
            expect.stringContaining('gpt_history_page=2'),
            {},
            expect.objectContaining({
                only: [
                    'gptRecommendations',
                    'gptRecommendationHistory_pagination',
                ],
                preserveState: true,
                preserveScroll: true,
            }),
        );
    });
});
