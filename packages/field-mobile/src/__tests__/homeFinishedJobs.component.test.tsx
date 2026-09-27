import { render, within } from '@testing-library/react-native';
import React from 'react';
import { AssignedJobsListScreen } from '../screens/AssignedJobsListScreen';
import type { DispatchJob, DispatchStatus } from '../types/index';

const jobWith = (
    id: number,
    status: DispatchStatus,
    responseStatus: 'pending' | 'accepted' = 'accepted',
): DispatchJob => ({
    id,
    reference: `JOB-${id}`,
    title: `Lift ${id}`,
    client: 'DMCI',
    site: 'Pier 4',
    scheduled_start: '2026-09-07T08:00:00Z',
    priority: { value: 'routine', label: 'Routine' },
    status: { value: status, label: status },
    version: 1,
    capabilities: {
        can_respond: true,
        can_update_status: true,
        can_share_location: true,
    },
    my_assignment: {
        id: id * 10,
        response_status: responseStatus,
        response_status_label: responseStatus,
    },
    asset_assignments: [
        {
            id: id * 100,
            operational_asset_id: id * 1000,
            asset_code: `CRN-${id}`,
            asset_name: `Crane ${id}`,
            asset_kind: 'mobile_crane',
        },
    ],
});

const renderHome = (jobs: DispatchJob[]) =>
    render(
        <AssignedJobsListScreen
            isLoading={false}
            jobs={jobs}
            onRefresh={jest.fn()}
            onSelectJob={jest.fn()}
            onSosHoldComplete={jest.fn()}
            outboxCommands={[]}
        />,
    );

describe('Home ignores finished jobs', () => {
    it('summarises and opens the live job, not a finished one listed first', async () => {
        const view = await renderHome([
            jobWith(1, 'completed'),
            jobWith(2, 'accepted'),
        ]);
        const card = view.getByTestId('home-assignment-summary-card');

        expect(within(card).getByText('JOB-2')).toBeTruthy();
        expect(within(card).queryByText('JOB-1')).toBeNull();
        expect(within(card).getByText('0 active · 1 scheduled')).toBeTruthy();
        expect(view.getByTestId('tile-forms-badge')).toHaveTextContent('1');
    });

    it('shows no work, no badge and no unit when every job is finished', async () => {
        const view = await renderHome([
            jobWith(1, 'completed'),
            jobWith(2, 'cancelled'),
        ]);

        expect(view.queryByTestId('home-assignment-summary-card')).toBeNull();
        expect(view.queryByTestId('tile-forms-badge')).toBeNull();
        expect(view.getByText('No unit assigned')).toBeTruthy();
        expect(view.queryByText('CRN-1')).toBeNull();
    });

    it('never asks for a response on a cancelled job', async () => {
        const view = await renderHome([jobWith(3, 'cancelled', 'pending')]);

        expect(view.queryByTestId('tile-forms-badge')).toBeNull();
        expect(view.queryByText(/response needed/)).toBeNull();
    });
});
