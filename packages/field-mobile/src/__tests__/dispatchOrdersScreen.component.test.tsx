import { cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import React, { act } from 'react';
import { DispatchOrdersScreen } from '../screens/DispatchOrdersScreen';
import { ThemeProvider } from '../theme';
import type { DispatchJob } from '../types/index';

const mockPendingJob: DispatchJob = {
    id: 101,
    reference: 'JOB-2026-0101',
    title: 'Precision Crane Lift',
    client: 'Megawide Construction Corp',
    site: 'Clark International Airport Terminal 2',
    scheduled_start: '2026-09-07T08:00:00Z',
    priority: {
        value: 'priority',
        label: 'Priority',
    },
    capabilities: {
        can_respond: true,
        can_update_status: true,
        can_share_location: true,
    },
    status: {
        value: 'dispatched',
        label: 'Dispatched',
    },
    version: 1,
    my_assignment: {
        id: 55,
        response_status: 'pending',
        response_status_label: 'Pending Response',
        assigned_at: '2026-09-07T07:30:00Z',
    },
    asset_assignments: [
        {
            id: 12,
            operational_asset_id: 101,
            asset_code: 'ALB-CRN-050',
            asset_name: '50T Tadano All-Terrain Crane',
            asset_kind: 'mobile_crane',
        },
    ],
};

const mockAcceptedJob: DispatchJob = {
    id: 102,
    reference: 'JOB-2026-0102',
    title: 'Flyover Girder Installation',
    client: 'DMCI Power & Infra',
    site: 'C-5 Flyover Expansion, Taguig',
    scheduled_start: '2026-09-07T10:00:00Z',
    priority: {
        value: 'routine',
        label: 'Routine',
    },
    capabilities: {
        can_respond: true,
        can_update_status: true,
        can_share_location: true,
    },
    status: {
        value: 'accepted',
        label: 'Accepted',
    },
    version: 2,
    my_assignment: {
        id: 56,
        response_status: 'accepted',
        response_status_label: 'Accepted',
        assigned_at: '2026-09-07T06:00:00Z',
    },
    asset_assignments: [
        {
            id: 13,
            operational_asset_id: 102,
            asset_code: 'ALB-CRN-080',
            asset_name: '80T Liebherr Mobile Crane',
            asset_kind: 'mobile_crane',
        },
    ],
};

describe('DispatchOrdersScreen', () => {
    afterEach(async () => {
        await cleanup();
        jest.clearAllMocks();
    });

    it('renders TileScreenHeader with Central Dispatch category, title, status badge and calls onBack', async () => {
        const onBack = jest.fn();

        const view = await render(
            <DispatchOrdersScreen
                jobs={[mockPendingJob, mockAcceptedJob]}
                onBack={onBack}
            />,
        );

        // Header elements
        expect(view.getByText('Central Dispatch')).toBeTruthy();
        expect(view.getByText('Dispatch Intake & Orders')).toBeTruthy();
        expect(view.getByText('1 PENDING')).toBeTruthy();
        expect(
            view.getByText('1 needs response · 2 total orders'),
        ).toBeTruthy();

        // Press back button
        await act(async () => {
            fireEvent.press(view.getByTestId('dispatch-back-btn'));
        });
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('displays segmented tab rail and allows toggling between Needs Response and All Orders', async () => {
        const onAccept = jest.fn();
        const onReject = jest.fn();
        const onSelectJob = jest.fn();

        const view = await render(
            <DispatchOrdersScreen
                jobs={[mockPendingJob, mockAcceptedJob]}
                onAcceptAssignment={onAccept}
                onRejectAssignment={onReject}
                onSelectJob={onSelectJob}
            />,
        );

        // By default with pending orders, Needs Response tab is active
        expect(view.getByText('Needs Response (1)')).toBeTruthy();
        expect(view.getByText('All Orders (2)')).toBeTruthy();

        // Pending job item visible with acceptance response actions
        expect(view.getByTestId('dispatch-intake-job-101')).toBeTruthy();
        expect(view.getByTestId('accept-assignment-btn')).toBeTruthy();

        // Switch to All Orders tab
        await act(async () => {
            fireEvent.press(view.getByTestId('intake-tab-all'));
        });

        // Both jobs should be rendered in All Orders
        expect(view.getByTestId('dispatch-intake-job-101')).toBeTruthy();
        expect(view.getByTestId('dispatch-intake-job-102')).toBeTruthy();
    });

    it('accepts pending assignment directly from the response card', async () => {
        const onAccept = jest.fn();

        const view = await render(
            <DispatchOrdersScreen
                jobs={[mockPendingJob]}
                onAcceptAssignment={onAccept}
                onRejectAssignment={jest.fn()}
            />,
        );

        await act(async () => {
            fireEvent.press(view.getByTestId('accept-assignment-btn'));
        });

        expect(onAccept).toHaveBeenCalledWith(101, 55, 1);
    });

    it('renders empty state when there are no jobs in current filter', async () => {
        const view = await render(
            <DispatchOrdersScreen jobs={[]} onBack={jest.fn()} />,
        );

        expect(view.getByTestId('dispatch-intake-empty')).toBeTruthy();
        expect(view.getByText('No Dispatch Orders Found')).toBeTruthy();
        expect(view.getByText('ALL CLEAR')).toBeTruthy();

        // Switch to pending tab to check pending empty state
        await act(async () => {
            fireEvent.press(view.getByTestId('intake-tab-pending'));
        });
        expect(view.getByText('No Orders Pending Response')).toBeTruthy();
    });

    it('supports dark HUD mode theme rendering properly', async () => {
        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <DispatchOrdersScreen
                    jobs={[mockAcceptedJob]}
                    onBack={jest.fn()}
                />
            </ThemeProvider>,
        );

        expect(view.getByText('Dispatch Intake & Orders')).toBeTruthy();
        expect(view.getByText('ALL CLEAR')).toBeTruthy();
    });
});
