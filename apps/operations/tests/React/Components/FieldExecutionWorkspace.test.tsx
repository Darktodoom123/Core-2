import { router } from '@inertiajs/react';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FieldExecutionWorkspace } from '@/components/dispatch-detail/field-execution-workspace';
import type { DispatchDetailPageProps } from '@/types/workspace';

const job = {
    id: 7,
    reference: 'EXEC-7001',
    client: 'Northline Construction',
    title: 'Field lift',
    site: 'Pasig City',
    site_notes: null,
    source: null,
    priority: { value: 'routine', label: 'Routine' },
    status: { value: 'working', label: 'Working' },
    scheduled_start: null,
    scheduled_end: null,
    requirements: [],
    version: 2,
    updated_at: '2026-09-08T01:00:00Z',
    personnel_assignments: [
        {
            id: 1,
            user_id: 9,
            name: 'Assigned Operator',
            type: 'crane_operator',
            response_status: { value: 'accepted', label: 'Accepted' },
            responded_at: null,
            response_reason: null,
        },
    ],
    asset_assignments: [],
} satisfies DispatchDetailPageProps['job'];

const execution = {
    status: { value: 'working', label: 'Working' },
    updated_at: '2026-09-08T01:00:00Z',
    milestones: [],
    issues: [],
    site: {
        name: 'Pasig City',
        notes: null,
        planned_coordinates: null,
        latest_location: null,
    },
    reports: [],
    activity: [],
} satisfies NonNullable<DispatchDetailPageProps['execution']>;

const capabilities = {
    assign_resources: false,
    reassign_resources: false,
    view_assignment_candidates: false,
    activate: false,
    update_own_status: false,
    respond_assignment: false,
    cancel: false,
    reopen: false,
    archive: false,
    restore: false,
};

describe('FieldExecutionWorkspace', () => {
    it('shows an honest empty evidence state and keeps restricted resources read only', () => {
        render(
            <FieldExecutionWorkspace
                job={job}
                execution={execution}
                capabilities={capabilities}
                personnelCandidates={[]}
                assetCandidates={[]}
            />,
        );

        expect(screen.getByText(/Current status:/)).toBeInTheDocument();
        expect(screen.getByTestId('planned-location-name')).toHaveTextContent(
            'Pasig City',
        );
        expect(
            screen.queryByText(/Planned coordinates/),
        ).not.toBeInTheDocument();
        expect(
            screen.getByText(
                'No shared location is available to you for this dispatch.',
            ),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Reassign' }),
        ).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Resources' })).toHaveAttribute(
            'href',
            '#assignment-summary',
        );
    });

    it('refreshes the evidence snapshot with the current supporting props', () => {
        const reload = vi.mocked(router.reload);
        reload.mockClear();
        render(
            <FieldExecutionWorkspace
                job={job}
                execution={execution}
                capabilities={capabilities}
                personnelCandidates={[]}
                assetCandidates={[]}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Refresh record' }));
        expect(reload).toHaveBeenCalledWith(
            expect.objectContaining({
                only: expect.arrayContaining([
                    'job',
                    'execution',
                    'capabilities',
                    'progression',
                    'personnel_candidates',
                    'asset_candidates',
                ]),
            }),
        );
    });

    it('keeps the recorded snapshot visible when refresh fails and allows a retry', () => {
        const reload = vi.mocked(router.reload);
        reload.mockClear();
        reload.mockImplementationOnce((options) => {
            (options as { onError?: () => void }).onError?.();
        });
        reload.mockImplementationOnce((options) => {
            (options as { onFinish?: () => void }).onFinish?.();
        });

        render(
            <FieldExecutionWorkspace
                job={job}
                execution={execution}
                capabilities={capabilities}
                personnelCandidates={[]}
                assetCandidates={[]}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Refresh record' }));
        expect(
            screen.getByText(
                'Refresh failed. Showing the last recorded execution snapshot.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByText(/Current status:/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(reload).toHaveBeenCalledTimes(2);
    });

    it('renders rental handoff evidence panel with operator metrics, signature, and authoritative action', () => {
        const executionWithEvidence = {
            ...execution,
            handoff_evidence: {
                type: 'rental' as const,
                source_id: 42,
                source_reference: 'REN-2026-0042',
                handover_type: 'checkout' as const,
                submitted_at: '2026-09-17T08:30:00Z',
                submitted_by: { id: 9, name: 'Assigned Operator' },
                signee_name: 'Jane Customer',
                signee_role: 'Site Supervisor',
                hour_meter: 124.5,
                fuel_percent: 85,
                condition_assessment: 'good' as const,
                condition_notes: 'Clean crane, no hydraulic leaks.',
                damage_noted: true,
                damage_notes: 'Minor scratch on left outrigger pad.',
                photos: [
                    { path: 'rentals/photos/pad.jpg', label: 'Outrigger pad' },
                ],
                signature_path: 'rentals/signatures/sig.png',
                signature_url: 'https://storage.local/sig.png',
                managerial_status: 'reserved',
                managerial_status_label: 'Reserved',
                can_checkout: true,
                can_return: false,
            },
        };

        render(
            <FieldExecutionWorkspace
                job={job}
                execution={executionWithEvidence}
                capabilities={capabilities}
                personnelCandidates={[]}
                assetCandidates={[]}
            />,
        );

        expect(
            screen.getByText(/Rental Handover Evidence \(Checkout\)/),
        ).toBeInTheDocument();
        expect(screen.getByText('REN-2026-0042')).toBeInTheDocument();
        expect(screen.getByText(/Jane Customer \(Site Supervisor\)/)).toBeInTheDocument();
        expect(screen.getByText('124.5 hrs')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
        expect(screen.getByText('Damage Noted During Handover')).toBeInTheDocument();
        expect(
            screen.getByText('Minor scratch on left outrigger pad.'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', {
                name: 'Process Authoritative Checkout',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Evidence' }),
        ).toHaveAttribute('href', '#handoff-evidence');
    });
});
