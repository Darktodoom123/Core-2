import { router } from '@inertiajs/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DispatchGptAdvisory } from '@/components/workspace/dispatch-gpt-advisory';
import type {
    DispatchJobViewModel,
    GptRecommendationViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

function capabilities(
    overrides: Partial<WorkspaceCapabilities> = {},
): WorkspaceCapabilities {
    return {
        create_dispatch: false,
        create_client: false,
        create_service_request: false,
        convert_service_request: false,
        create_rental_dispatch: false,
        create_sales_dispatch: false,
        share_location: false,
        view_tracking: false,
        request_fuel: false,
        forward_fuel: false,
        approve_fuel: false,
        verify_fuel: false,
        record_fuel: false,
        decide_approval: false,
        update_assigned_dispatch_status: false,
        update_asset_status: false,
        safety_lockdown_asset: false,
        inspect_asset: false,
        maintain_asset: false,
        request_gpt_assistance: true,
        proactive_gpt_assistance: false,
        decide_gpt_recommendation: true,
        retry_gpt_recommendation: true,
        create_job_report: false,
        attachment_upload: false,
        attachment_policy: {
            owner_type: 'job_report',
            max_bytes: 1,
            max_count: 1,
            accepted_mime_types: [],
        },
        review_job_report: false,
        export_reports: false,
        manage_notifications: false,
        view_archive: false,
        restore_dispatch: false,
        view_sos: false,
        respond_sos: false,
        ...overrides,
    };
}

function job(id: number): DispatchJobViewModel {
    return {
        id,
        reference: `DSP-${id}`,
        client: 'Northwind Logistics',
        title: 'Crane delivery',
        site: 'Makati yard',
        site_notes: null,
        source: null,
        priority: { value: 'routine', label: 'Routine' },
        status: { value: 'scheduled', label: 'Scheduled' },
        scheduled_start: '2026-09-05T09:00:00+08:00',
        scheduled_end: '2026-09-05T11:00:00+08:00',
        requirements: ['Operator credential'],
        version: 1,
        updated_at: '2026-09-05T08:00:00+08:00',
        personnel_assignments: [],
        asset_assignments: [],
    };
}

function recommendation(
    overrides: Partial<GptRecommendationViewModel> = {},
): GptRecommendationViewModel {
    return {
        id: 1,
        subject_type: 'dispatch_job',
        subject_id: 10,
        purpose: 'dispatch_assignment',
        context_hash: 'context',
        status: 'pending_review',
        prompt_summary: null,
        response_summary: null,
        recommendation: {},
        proposed_personnel: [
            {
                user_id: 2,
                name: 'Suggested operator',
                assignment_type: 'crane_operator',
            },
        ],
        proposed_assets: [],
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
        retry_url: '/operations/gpt-recommendations/1/retry',
        requested_by: { id: 1, name: 'Manager' },
        decided_by: null,
        decided_at: null,
        created_at: null,
        is_advisory: true,
        ...overrides,
    };
}

beforeEach(() => {
    vi.mocked(router.post).mockReset();
});

describe('dispatch GPT advisory', () => {
    it('shows only the latest dispatch assignment recommendation for the selected job', () => {
        render(
            <DispatchGptAdvisory
                job={job(10)}
                capabilities={capabilities()}
                recommendations={[
                    recommendation({
                        id: 3,
                        proposed_personnel: [
                            {
                                user_id: 3,
                                name: 'Selected job operator',
                                assignment_type: 'crane_operator',
                            },
                        ],
                    }),
                    recommendation({
                        id: 99,
                        subject_type: 'maintenance_work_order',
                        proposed_personnel: [
                            {
                                user_id: 9,
                                name: 'Wrong subject operator',
                                assignment_type: 'technician',
                            },
                        ],
                    }),
                    recommendation({
                        id: 100,
                        purpose: 'operations_review',
                        proposed_personnel: [
                            {
                                user_id: 10,
                                name: 'Wrong purpose operator',
                                assignment_type: 'driver',
                            },
                        ],
                    }),
                    recommendation({
                        id: 101,
                        subject_id: 11,
                        proposed_personnel: [
                            {
                                user_id: 11,
                                name: 'Other job operator',
                                assignment_type: 'driver',
                            },
                        ],
                    }),
                ]}
            />,
        );

        expect(
            screen.getByRole('heading', { name: 'AI assistance' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Selected job operator')).toBeInTheDocument();
        expect(
            screen.queryByText('Wrong subject operator'),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText('Wrong purpose operator'),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText('Other job operator'),
        ).not.toBeInTheDocument();
    });

    it('posts the bounded request payload and respects request capability', () => {
        vi.mocked(router.post).mockImplementationOnce(
            (_url, _data, options) => {
                options?.onFinish?.({} as never);
            },
        );
        const { unmount } = render(
            <DispatchGptAdvisory
                job={job(10)}
                capabilities={capabilities()}
                recommendations={[]}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Request now' }));

        expect(router.post).toHaveBeenCalledWith(
            '/operations/gpt-recommendations',
            {
                subject_type: 'dispatch_job',
                subject_id: 10,
                purpose: 'dispatch_assignment',
            },
            expect.objectContaining({
                errorBag: 'dispatchAdvisory10',
                only: ['gptRecommendations', 'errors', 'flash'],
                preserveScroll: true,
            }),
        );

        unmount();
        render(
            <DispatchGptAdvisory
                job={job(10)}
                capabilities={capabilities({
                    request_gpt_assistance: false,
                    decide_gpt_recommendation: false,
                    retry_gpt_recommendation: false,
                })}
                recommendations={[]}
            />,
        );

        expect(
            screen.queryByRole('button', { name: 'Request now' }),
        ).not.toBeInTheDocument();
    });

    it('clears an open review when the selected job changes', async () => {
        const firstRecommendation = recommendation({
            id: 1,
            subject_id: 10,
            proposed_personnel: [
                {
                    user_id: 2,
                    name: 'First job operator',
                    assignment_type: 'crane_operator',
                },
            ],
        });
        const secondRecommendation = recommendation({
            id: 2,
            subject_id: 11,
            proposed_personnel: [
                {
                    user_id: 3,
                    name: 'Second job operator',
                    assignment_type: 'crane_operator',
                },
            ],
        });
        const { rerender } = render(
            <DispatchGptAdvisory
                key={10}
                job={job(10)}
                capabilities={capabilities()}
                recommendations={[firstRecommendation, secondRecommendation]}
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Review & apply suggestion' }),
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        rerender(
            <DispatchGptAdvisory
                key={11}
                job={job(11)}
                capabilities={capabilities()}
                recommendations={[firstRecommendation, secondRecommendation]}
            />,
        );

        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        );
        expect(screen.getByText('Second job operator')).toBeInTheDocument();
    });

    it('traps modal focus, closes on Escape, and restores the review trigger', async () => {
        render(
            <DispatchGptAdvisory
                job={job(10)}
                capabilities={capabilities()}
                recommendations={[
                    recommendation({
                        id: 1,
                        subject_id: 10,
                        proposed_personnel: [
                            {
                                user_id: 2,
                                name: 'Qualified operator',
                                assignment_type: 'crane_operator',
                            },
                        ],
                    }),
                ]}
            />,
        );

        const trigger = screen.getByRole('button', {
            name: 'Review & apply suggestion',
        });
        trigger.focus();
        fireEvent.click(trigger);

        const dialog = screen.getByRole('dialog');
        const confirm = screen.getByRole('button', {
            name: 'Confirm & Apply Resource Plan',
        });
        await waitFor(() =>
            expect(
                screen.getByRole('button', { name: 'Close dialog' }),
            ).toHaveFocus(),
        );
        expect(document.body.style.overflow).toBe('hidden');

        confirm.focus();
        fireEvent.keyDown(window, { key: 'Tab' });
        expect(
            screen.getByRole('button', { name: 'Close dialog' }),
        ).toHaveFocus();
        expect(dialog).toBeInTheDocument();

        fireEvent.keyDown(window, { key: 'Escape' });
        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        );
        await waitFor(() => expect(trigger).toHaveFocus());
        expect(document.body.style.overflow).toBe('');
    });
});
