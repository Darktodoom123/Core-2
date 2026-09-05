import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AssetCandidates } from '@/components/dispatch-detail/asset-candidates';
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
