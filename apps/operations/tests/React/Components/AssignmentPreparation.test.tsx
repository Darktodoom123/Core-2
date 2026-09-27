import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    AssetCandidate,
    AssetCandidates,
} from '@/components/dispatch-detail/asset-candidates';
import { AssignmentReadinessSummary } from '@/components/dispatch-detail/assignment-readiness-summary';
import { PersonnelCandidates } from '@/components/dispatch-detail/personnel-candidates';

const activation = {
    ready: true,
    blockers: [],
    approval_required: false,
    approval_status: null,
};

describe('preparation readiness', () => {
    it('distinguishes unsaved choices from the saved activation result', () => {
        const review = vi.fn();
        render(
            <AssignmentReadinessSummary
                activation={activation}
                personnelCount={0}
                assetCount={0}
                hasPendingSelections
                onReview={review}
            />,
        );
        expect(
            screen.getByText('Save selections before reviewing readiness'),
        ).toBeInTheDocument();
        expect(
            screen.queryByText('Ready for activation review'),
        ).not.toBeInTheDocument();
        expect(screen.getByText(/No saved personnel/)).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('button', { name: 'Review readiness' }),
        );
        expect(review).toHaveBeenCalledOnce();
    });

    it('keeps every saved blocker accessible with an explicit remaining count', () => {
        render(
            <AssignmentReadinessSummary
                activation={{
                    ...activation,
                    ready: false,
                    blockers: [
                        'Approval needed',
                        'Inspection needed',
                        'Operator missing',
                        'Equipment missing',
                        'Schedule overlaps',
                    ],
                }}
                personnelCount={0}
                assetCount={0}
                hasPendingSelections={false}
                onReview={vi.fn()}
            />,
        );
        const remaining = screen.getByText('Show 2 more blockers');
        expect(remaining.closest('details')).not.toHaveAttribute('open');
        fireEvent.click(remaining);
        expect(remaining.closest('details')).toHaveAttribute('open');
        expect(screen.getByText('Schedule overlaps')).toBeVisible();
    });
});

describe('candidate type filtering', () => {
    it('labels page-local eligibility and shows the full result total on one page', () => {
        render(
            <AssetCandidates
                candidates={[]}
                onCandidatesSeen={vi.fn()}
                selectedIds={[]}
                canAssign
                onToggle={vi.fn()}
                assetCatalogAccess={{ fleet: false, equipment: false }}
                page={{
                    data: [],
                    pagination: {
                        current_page: 1,
                        last_page: 1,
                        per_page: 25,
                        total: 0,
                        from: null,
                        to: null,
                    },
                    evaluated_at: '2026-09-27T00:00:00Z',
                    job_version: 1,
                    schedule_fingerprint: 'test',
                    error: null,
                }}
            />,
        );

        expect(
            screen.getByText('Show eligible only (0/0 on this page)'),
        ).toBeInTheDocument();
        expect(screen.getByText(/Showing 0–0 of 0 assets/)).toBeInTheDocument();
    });

    it('exposes fleet vehicles and tower cranes as distinct asset categories', () => {
        render(
            <AssetCandidates
                candidates={[]}
                onCandidatesSeen={vi.fn()}
                selectedIds={[]}
                canAssign
                onToggle={vi.fn()}
                assetCatalogAccess={{ fleet: true, equipment: true }}
            />,
        );

        expect(
            screen.getByRole('group', { name: 'Vehicles' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('group', { name: 'Tower cranes' }),
        ).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Filter asset type'), {
            target: { value: 'vehicle' },
        });
        expect(
            screen.getByRole('group', { name: 'Vehicles' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('group', { name: 'Tower cranes' }),
        ).not.toBeInTheDocument();
    });

    it('guides dispatchers to a separate driver licence evaluation', () => {
        render(
            <PersonnelCandidates
                candidates={[]}
                onCandidatesSeen={vi.fn()}
                selectedIds={[]}
                canAssign
                onToggle={vi.fn()}
            />,
        );

        expect(
            screen.queryByRole('group', { name: 'Drivers' }),
        ).not.toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('button', { name: 'Check licensed drivers' }),
        );
        expect(screen.getByLabelText('Filter personnel type')).toHaveValue(
            'driver',
        );
        expect(
            screen.getByRole('group', { name: 'Drivers' }),
        ).toBeInTheDocument();
    });

    it('shows catalog subtype and capacity beside asset readiness', () => {
        render(
            <AssetCandidate
                candidate={{
                    id: 12,
                    code: 'TR-104',
                    name: 'Harbor truck',
                    subtype: 'low bed',
                    capacity: '25 t',
                    assignment_type: 'truck',
                    assignment_label: 'Truck',
                    eligible: true,
                    reasons: [],
                    readiness: {
                        value: 'ready_for_service',
                        label: 'Ready for service',
                    },
                    blocking_maintenance_count: 0,
                    schedule_conflicts: [],
                    already_assigned: false,
                }}
                selected={false}
                canAssign
                onToggle={vi.fn()}
            />,
        );

        expect(screen.getByText('low bed · 25 t capacity')).toBeInTheDocument();
        expect(
            screen.getByText(/Readiness: Ready for service/),
        ).toBeInTheDocument();
    });

    it('only shows the selected personnel category', () => {
        render(
            <PersonnelCandidates
                candidates={[]}
                onCandidatesSeen={vi.fn()}
                selectedIds={[]}
                canAssign
                onToggle={vi.fn()}
            />,
        );
        fireEvent.change(screen.getByLabelText('Filter personnel type'), {
            target: { value: 'driver' },
        });
        expect(
            screen.getByRole('group', { name: 'Drivers' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('group', { name: 'Crane operators' }),
        ).not.toBeInTheDocument();
    });

    it('keeps both crane categories when filtering cranes and hides unrelated equipment', () => {
        render(
            <AssetCandidates
                candidates={[]}
                onCandidatesSeen={vi.fn()}
                selectedIds={[]}
                canAssign
                onToggle={vi.fn()}
                assetCatalogAccess={{ fleet: false, equipment: false }}
            />,
        );
        fireEvent.change(screen.getByLabelText('Filter asset type'), {
            target: { value: 'crane' },
        });
        expect(
            screen.getByRole('group', { name: 'Cranes' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('group', { name: 'Mobile cranes' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('group', { name: 'Trucks' }),
        ).not.toBeInTheDocument();
    });
});
