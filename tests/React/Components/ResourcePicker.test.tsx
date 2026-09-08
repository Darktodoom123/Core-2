import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ReassignmentModal } from '@/components/dispatch-detail/reassignment-modal';
import { ResourcePicker } from '@/components/dispatch-detail/resource-picker';
import { isCandidateEvaluationVisit } from '@/components/dispatch-detail/use-dispatch-assignment';

const { routerPost } = vi.hoisted(() => ({ routerPost: vi.fn() }));

vi.mock('@inertiajs/react', async () => {
    const actual = await vi.importActual('@inertiajs/react');

    return {
        ...actual,
        router: {
            reload: vi.fn(),
            post: routerPost,
        },
    };
});

const job = {
    id: 42,
    reference: 'DSP-0042',
    title: 'Harbor lift',
    scheduled_start: '2026-09-08T08:00:00+08:00',
    scheduled_end: '2026-09-08T16:00:00+08:00',
    version: 3,
    personnel_assignments: [],
    asset_assignments: [],
} as any;

const personnelCandidate = {
    id: 7,
    name: 'Jordan Cruz',
    assignment_type: 'driver',
    assignment_label: 'Driver',
    eligible: true,
    reasons: [],
    availability: { value: 'available', label: 'Available' },
    account_status: { value: 'active', label: 'Active' },
    credential: {
        kind: 'driver_license',
        label: 'Driver license valid',
        status: 'valid',
        expires_at: null,
    },
    schedule_conflicts: [],
    already_assigned: false,
} as any;

const assetCandidate = {
    id: 12,
    code: 'TR-104',
    name: 'Harbor truck',
    assignment_type: 'truck',
    assignment_label: 'Truck',
    eligible: true,
    reasons: [],
    readiness: { value: 'ready_for_service', label: 'Ready for service' },
    blocking_maintenance_count: 0,
    schedule_conflicts: [],
    already_assigned: false,
} as any;

describe('resource picker', () => {
    it('does not treat candidate partial reloads as leaving staged work', () => {
        expect(
            isCandidateEvaluationVisit({
                method: 'get',
                only: ['asset_candidates'],
            }),
        ).toBe(true);
        expect(
            isCandidateEvaluationVisit({ method: 'post', only: ['job'] }),
        ).toBe(false);
        expect(
            isCandidateEvaluationVisit({ method: 'get', only: ['job'] }),
        ).toBe(false);
    });

    it('keeps the employee and asset choices in the same staged picker', () => {
        const onPersonnel = vi.fn();
        const onAsset = vi.fn();

        render(
            <ResourcePicker
                open
                mode="initial"
                job={job}
                personnelCandidates={[personnelCandidate]}
                assetCandidates={[assetCandidate]}
                selectedPersonnelIds={[]}
                selectedAssetIds={[]}
                canSelect
                onTogglePersonnel={onPersonnel}
                onToggleAsset={onAsset}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
                confirmFormId="assignment-selection-form"
            />,
        );

        fireEvent.click(screen.getByRole('tab', { name: /Assets/ }));
        fireEvent.click(screen.getByLabelText(/Select TR-104 Harbor truck/));
        fireEvent.click(screen.getByRole('tab', { name: /Employees/ }));
        fireEvent.click(screen.getByLabelText(/Select Jordan Cruz as Driver/));

        expect(onAsset).toHaveBeenCalledWith(assetCandidate);
        expect(onPersonnel).toHaveBeenCalledWith(personnelCandidate);
        expect(screen.getByText('Selected resources')).toBeInTheDocument();
        expect(
            screen.getByRole('button', {
                name: 'Assign selected resources',
            }),
        ).toHaveAttribute('form', 'assignment-selection-form');
    });

    it('requires one compatible replacement and submits it atomically', () => {
        routerPost.mockReset();

        render(
            <ReassignmentModal
                job={job}
                target={{
                    kind: 'personnel',
                    id: 91,
                    name: 'Current Driver',
                    type: 'driver',
                }}
                personnelCandidates={[personnelCandidate]}
                assetCandidates={[]}
                onClose={vi.fn()}
            />,
        );

        const replace = screen.getByRole('button', { name: 'Replace driver' });
        expect(replace).toBeDisabled();
        expect(
            screen.queryByText('No replacement (end assignment only)'),
        ).not.toBeInTheDocument();

        fireEvent.click(screen.getByLabelText(/Select Jordan Cruz as Driver/));
        expect(replace).toBeEnabled();

        fireEvent.click(replace);

        expect(routerPost).toHaveBeenCalledWith(
            '/operations/dispatch-jobs/42/reassign',
            expect.objectContaining({
                version: 3,
                end_personnel_assignment_ids: [91],
                personnel: [
                    {
                        user_id: 7,
                        assignment_type: 'driver',
                    },
                ],
            }),
            expect.any(Object),
        );
    });

    it('keeps replacement review focused on one compatible resource type', () => {
        render(
            <ResourcePicker
                open
                mode="replacement"
                job={job}
                target={{
                    kind: 'asset',
                    id: 91,
                    name: 'Current crane',
                    type: 'crane',
                }}
                personnelCandidates={[]}
                assetCandidates={[
                    { ...assetCandidate, assignment_type: 'crane' },
                ]}
                selectedPersonnelIds={[]}
                selectedAssetIds={[]}
                canSelect
                onTogglePersonnel={vi.fn()}
                onToggleAsset={vi.fn()}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
                reason=""
                onReasonChange={vi.fn()}
            />,
        );

        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.getByText(/Compatible type: Crane/)).toBeInTheDocument();
        expect(screen.getByText('1 result')).toBeInTheDocument();
        expect(
            screen.getByText('Results include blocked resources.'),
        ).toBeInTheDocument();
    });

    it('normalizes legacy operator assignments to crane operator candidates', () => {
        render(
            <ReassignmentModal
                job={job}
                target={{
                    kind: 'personnel',
                    id: 91,
                    name: 'Current Operator',
                    type: 'operator',
                }}
                personnelCandidates={[
                    {
                        ...personnelCandidate,
                        assignment_type: 'crane_operator',
                    },
                ]}
                assetCandidates={[]}
                onClose={vi.fn()}
            />,
        );

        expect(screen.getByText('1 result')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText(/Select Jordan Cruz/));
        expect(
            screen.getByRole('button', { name: 'Replace resource' }),
        ).toBeEnabled();
    });
});
