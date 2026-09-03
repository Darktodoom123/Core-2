import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { HeavyCraneDriveModeScreen } from '../screens/HeavyCraneDriveModeScreen';
import type { DispatchJob } from '../types/index';

const mockJob: DispatchJob = {
    id: 101,
    reference: 'DISP-2026-0891',
    title: '50T Crane Transit & Rigging',
    status: {
        value: 'en_route',
        label: 'En Route',
    },
    priority: {
        value: 'priority',
        label: 'Priority',
    },
    scheduled_start: '2026-09-03T08:00:00Z',
    scheduled_end: '2026-09-03T18:00:00Z',
    site: 'Batangas Power Plant Expansion',
    client: 'DMCI Power & Infra',
    version: 3,
    capabilities: {
        can_respond: true,
        can_update_status: true,
        can_share_location: true,
    },
    asset_assignments: [
        {
            id: 1,
            operational_asset_id: 50,
            asset_code: 'ALB-CRN-050',
            asset_name: '50T Tadano All-Terrain Crane',
            asset_kind: 'mobile_crane',
        },
    ],
};

describe('HeavyCraneDriveModeScreen Component & Workflows', () => {
    jest.setTimeout(15000);

    it('renders header bar, LIVE beacon, ETA/distance metrics, destination, and instructions', async () => {
        const onBack = jest.fn();

        const view = await render(
            <HeavyCraneDriveModeScreen
                activeJob={mockJob}
                onBack={onBack}
                operatorName="Alex Rivera"
            />,
        );

        // Header & HUD Titles
        expect(view.getByText('Heavy Crane Drive Mode')).toBeTruthy();
        expect(
            view.getByText('HEAVY TRANSIT · CORRIDOR NAVIGATION'),
        ).toBeTruthy();
        expect(view.getByText('LIVE')).toBeTruthy();

        // Metrics
        expect(view.getByText('ESTIMATED ARRIVAL')).toBeTruthy();
        expect(view.getByText('18 min')).toBeTruthy();
        expect(view.getByText('DISTANCE REMAINING')).toBeTruthy();
        expect(view.getByText('7.4 km')).toBeTruthy();

        // Destination & Site Access
        expect(
            view.getAllByText('Batangas Power Plant Expansion').length,
        ).toBeGreaterThan(0);
        expect(
            view.getByText('ALB-CRN-050 · 50T Tadano All-Terrain Crane'),
        ).toBeTruthy();
        expect(view.getByText('Gate 3 (South Heavy Haul Access)')).toBeTruthy();

        // Telemetry
        expect(view.getByText('42')).toBeTruthy();
        expect(view.getByText('km/h')).toBeTruthy();
        expect(view.getByText('50')).toBeTruthy();

        // Open Corridor Steps sheet
        await fireEvent.press(view.getByTestId('toggle-corridor-steps-btn'));

        // Corridor Instructions
        expect(view.getByTestId('drive-instruction-1')).toBeTruthy();
        expect(view.getByTestId('drive-instruction-2')).toBeTruthy();
        expect(view.getByTestId('drive-instruction-3')).toBeTruthy();
        expect(
            view.getByText(
                'Bridge clearance only 4.1m — DO NOT ENTER Old Mill Road.',
            ),
        ).toBeTruthy();

        // Map Section
        expect(view.getByTestId('drive-mode-map-section')).toBeTruthy();
    });

    it('invokes onBack when back button is pressed', async () => {
        const onBack = jest.fn();

        const view = await render(
            <HeavyCraneDriveModeScreen activeJob={mockJob} onBack={onBack} />,
        );

        const backBtn = view.getByTestId('drive-mode-back-btn');
        await fireEvent.press(backBtn);

        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('invokes onArrived with job id and version when arrival button is pressed', async () => {
        const onArrived = jest.fn();

        const view = await render(
            <HeavyCraneDriveModeScreen
                activeJob={mockJob}
                onArrived={onArrived}
            />,
        );

        const arrivedBtn = view.getByTestId('drive-mode-arrived-btn');
        await fireEvent.press(arrivedBtn);

        expect(onArrived).toHaveBeenCalledTimes(1);
        expect(onArrived).toHaveBeenCalledWith(101, 3);
    });

    it('handles delay reporting drawer and triggers onReportDelay', async () => {
        const onReportDelay = jest.fn();

        const view = await render(
            <HeavyCraneDriveModeScreen
                activeJob={mockJob}
                onReportDelay={onReportDelay}
            />,
        );

        // Tap trigger to open drawer
        const trigger = view.getByTestId('report-delay-trigger-btn');
        await fireEvent.press(trigger);

        // Select delay reason
        const option = view.getByText('Low clearance detour required');
        await fireEvent.press(option);

        expect(onReportDelay).toHaveBeenCalledWith(
            'Low clearance detour required',
        );
        expect(view.getByText('✓ Delay reported to Dispatch:')).toBeTruthy();
    });

    it('toggles corridor steps sheet when Corridor Steps button is pressed', async () => {
        const view = await render(
            <HeavyCraneDriveModeScreen activeJob={mockJob} />,
        );

        expect(view.getByText('Corridor Steps')).toBeTruthy();
        expect(view.queryByTestId('drive-instruction-1')).toBeNull();

        await fireEvent.press(view.getByTestId('toggle-corridor-steps-btn'));
        expect(view.getByText('Hide Steps')).toBeTruthy();
        expect(view.getByTestId('drive-instruction-1')).toBeTruthy();

        await fireEvent.press(view.getByTestId('toggle-corridor-steps-btn'));
        expect(view.getByText('Corridor Steps')).toBeTruthy();
        expect(view.queryByTestId('drive-instruction-1')).toBeNull();
    });

    it('supports active turn-by-turn navigation stepper and updates voice & lane guidance', async () => {
        const view = await render(
            <HeavyCraneDriveModeScreen activeJob={mockJob} />,
        );

        // Initial Step 1
        expect(view.getByText('TURN 1 OF 4')).toBeTruthy();
        expect(view.getByText('In 500 m')).toBeTruthy();
        expect(view.getByTestId('voice-guidance-banner')).toBeTruthy();
        expect(
            view.getByText(
                'In 500 meters, merge right onto Highway 10 North Corridor.',
            ),
        ).toBeTruthy();
        expect(view.getByTestId('lane-guidance-bar')).toBeTruthy();
        expect(view.getByText('🚛 WIDE ESCORT')).toBeTruthy();

        // Advance to Turn 2
        const nextBtn = view.getByTestId('turn-next-btn');
        await fireEvent.press(nextBtn);

        expect(view.getByText('TURN 2 OF 4')).toBeTruthy();
        expect(view.getByText('In 4.2 km')).toBeTruthy();
        expect(view.getByText('12 min')).toBeTruthy();
        expect(view.getByText('4.6 km')).toBeTruthy();

        // Previous button returns to Turn 1
        const prevBtn = view.getByTestId('turn-prev-btn');
        await fireEvent.press(prevBtn);

        expect(view.getByText('TURN 1 OF 4')).toBeTruthy();
        expect(view.getByText('In 500 m')).toBeTruthy();
    });

    it('selects turn step when tapped from the Corridor Steps sheet', async () => {
        const view = await render(
            <HeavyCraneDriveModeScreen activeJob={mockJob} />,
        );

        // Open corridor steps sheet
        await fireEvent.press(view.getByTestId('toggle-corridor-steps-btn'));

        // Tap Step 2 in sheet
        await fireEvent.press(view.getByTestId('drive-instruction-2'));

        // Returns to HUD with Step 2 active
        expect(view.getByText('TURN 2 OF 4')).toBeTruthy();
        expect(view.getByText('In 4.2 km')).toBeTruthy();
    });
});
