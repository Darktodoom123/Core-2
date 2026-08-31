import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { DvirScreen } from '../screens/DvirScreen';

describe('DvirScreen Component & Workflows', () => {
    it('renders the Create DVIR screen with inspection type, photos, defects, and safety status', async () => {
        const onBack = jest.fn();
        const onSave = jest.fn();

        const view = await render(
            <DvirScreen
                activeJobReference="DISP-2026-0891"
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
                inspectorName="Alex Rivera (Certified Crane Operator)"
                onBack={onBack}
                onSaveInspectionRecord={onSave}
            />,
        );

        // Header & Core Titles
        expect(view.getByText('Create DVIR')).toBeTruthy();
        expect(view.getByText('Choose inspection type')).toBeTruthy();
        expect(view.getByText('Take walkaround photos')).toBeTruthy();
        expect(view.getByText('Add new vehicle defects')).toBeTruthy();
        expect(view.getByText('Choose safety status')).toBeTruthy();

        // 4 Walkaround Photo Slots
        expect(view.getByTestId('slot-driver-side')).toBeTruthy();
        expect(view.getByTestId('slot-front')).toBeTruthy();
        expect(view.getByTestId('slot-passenger-side')).toBeTruthy();
        expect(view.getByTestId('slot-back')).toBeTruthy();

        // Telemetry inputs
        expect(view.getByTestId('input-odometer')).toBeTruthy();
        expect(view.getByTestId('input-engine-hours')).toBeTruthy();
    });

    it('switches between Pre-Trip and Post-Trip inspection types', async () => {
        const view = await render(
            <DvirScreen assetCode="ALB-CRN-050" initialMode="pre_trip" />,
        );

        // Pre-trip is active by default
        const preTripBtn = view.getByTestId('tab-pre-trip');
        const postTripBtn = view.getByTestId('tab-post-trip');

        expect(preTripBtn).toBeTruthy();
        expect(postTripBtn).toBeTruthy();

        // Switch to post-trip
        await fireEvent.press(postTripBtn);
        expect(
            view.getByText('PARKED & SECURED SHUTDOWN CHECKLIST'),
        ).toBeTruthy();
        expect(view.getByTestId('check-parking-brake')).toBeTruthy();
        expect(view.getByTestId('check-wheel-chocks')).toBeTruthy();
        expect(view.getByTestId('check-outriggers-stowed')).toBeTruthy();

        // Switch back to pre-trip
        await fireEvent.press(preTripBtn);
        expect(
            view.queryByText('PARKED & SECURED SHUTDOWN CHECKLIST'),
        ).toBeNull();
    });

    it('opens the defects modal, searches for defects, selects items, and displays defect chips', async () => {
        const view = await render(<DvirScreen assetCode="ALB-CRN-050" />);

        // Open defects modal
        await fireEvent.press(view.getByTestId('add-defects-button'));

        // Modal should display search and categories
        expect(view.getByTestId('defects-search-input')).toBeTruthy();
        expect(view.getByText('Exterior - Front')).toBeTruthy();
        expect(view.getByText('Battery')).toBeTruthy();
        expect(view.getByText('Belts Hoses')).toBeTruthy();

        // Search for "Radiator"
        await fireEvent.changeText(
            view.getByTestId('defects-search-input'),
            'Radiator',
        );
        expect(view.getByText('Radiator')).toBeTruthy();

        // Select Radiator
        await fireEvent.press(view.getByTestId('defect-item-front_radiator'));

        // Clear search and select Battery
        await fireEvent.changeText(
            view.getByTestId('defects-search-input'),
            'Battery',
        );
        await fireEvent.press(view.getByTestId('defect-item-front_battery'));

        // Press Done
        await fireEvent.press(view.getByTestId('defects-modal-done'));

        // Verify defect chips are displayed on main screen
        expect(view.getByText('Radiator')).toBeTruthy();
        expect(view.getByText('Battery')).toBeTruthy();
        expect(view.getByText('Edit defects (2 added)')).toBeTruthy();
    });

    it('toggles safety status and lockout banner', async () => {
        const view = await render(<DvirScreen assetCode="ALB-CRN-050" />);

        const safeBtn = view.getByTestId('safety-status-safe');
        const unsafeBtn = view.getByTestId('safety-status-unsafe');

        expect(safeBtn).toBeTruthy();
        expect(unsafeBtn).toBeTruthy();

        // Default is safe -> no lockout banner
        expect(view.queryByTestId('dvir-lockout-banner')).toBeNull();

        // Select Unsafe -> lockout banner displays
        await fireEvent.press(unsafeBtn);
        expect(view.getByTestId('dvir-lockout-banner')).toBeTruthy();
        expect(view.getByText('DISPATCH LOCKOUT ACTIVE')).toBeTruthy();

        // Select Safe again
        await fireEvent.press(safeBtn);
        expect(view.queryByTestId('dvir-lockout-banner')).toBeNull();
    });

    it('navigates to review/sign-off step and completes DVIR certification', async () => {
        const onSave = jest.fn();

        const view = await render(
            <DvirScreen
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
                inspectorName="Alex Rivera (Certified Crane Operator)"
                onSaveInspectionRecord={onSave}
            />,
        );

        // Update odometer & hours
        await fireEvent.changeText(view.getByTestId('input-odometer'), '42200');
        await fireEvent.changeText(
            view.getByTestId('input-engine-hours'),
            '1855.0',
        );

        // Enter inspector remarks
        await fireEvent.changeText(
            view.getByTestId('dvir-remarks-input'),
            'Walkaround photos clear. No fluid leaks or structural defects.',
        );

        // Press Next/Complete DVIR
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                assetCode: 'ALB-CRN-050',
                type: 'pre_trip',
                startingOdometerKm: 42200,
                engineHours: 1855.0,
                signatureCaptured: true,
                hasDefects: false,
            }),
        );
    });

    it('views past DVIR history records', async () => {
        const view = await render(<DvirScreen assetCode="ALB-CRN-050" />);

        // Toggle history tab
        await fireEvent.press(view.getByTestId('tab-history'));

        expect(view.getByText('PAST DVIR INSPECTION RECORDS')).toBeTruthy();
        expect(view.getByTestId('history-card-DVIR-2026-0830-01')).toBeTruthy();
        expect(view.getByTestId('history-card-DVIR-2026-0829-02')).toBeTruthy();
    });

    it('filters and selects Mobile Crane specific defects with automatic critical safety lockout', async () => {
        const view = await render(
            <DvirScreen
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
            />,
        );

        // Open defects modal
        await fireEvent.press(view.getByTestId('add-defects-button'));

        // Check equipment filter pills exist
        expect(view.getByTestId('filter-all')).toBeTruthy();
        expect(view.getByTestId('filter-mobile-crane')).toBeTruthy();
        expect(view.getByTestId('filter-tower-crane')).toBeTruthy();
        expect(view.getByTestId('filter-carrier')).toBeTruthy();

        // Switch to Mobile Crane filter
        await fireEvent.press(view.getByTestId('filter-mobile-crane'));
        expect(view.getByText('Mobile Crane: Boom & Telescoping')).toBeTruthy();
        expect(
            view.getByText('Mobile Crane: Outriggers & Leveling'),
        ).toBeTruthy();
        expect(
            view.getByText('Mobile Crane: Slewing & Upper Cab'),
        ).toBeTruthy();

        // Select critical mobile crane defect: Telescopic Boom
        await fireEvent.press(
            view.getByTestId('defect-item-crane_telescopic_boom'),
        );

        // Select outriggers defect
        await fireEvent.press(
            view.getByTestId('defect-item-crane_outriggers_jacks'),
        );

        // Press Done
        await fireEvent.press(view.getByTestId('defects-modal-done'));

        // Verify chips and automatic unsafe lockout state
        expect(
            view.getByText('Telescopic Boom Sections & Wear Pads'),
        ).toBeTruthy();
        expect(
            view.getByText('Hydraulic Jack Cylinders & Pilot Check Valves'),
        ).toBeTruthy();
        expect(view.getByTestId('dvir-lockout-banner')).toBeTruthy();
        expect(view.getByText('DISPATCH LOCKOUT ACTIVE')).toBeTruthy();
    });

    it('filters and selects Tower Crane specific defects including Weather-Vaning mechanism', async () => {
        const view = await render(
            <DvirScreen
                assetCode="TWR-CRN-280"
                assetName="Liebherr 280 EC-H Tower Crane"
            />,
        );

        // Open defects modal
        await fireEvent.press(view.getByTestId('add-defects-button'));

        // Switch to Tower Crane filter
        await fireEvent.press(view.getByTestId('filter-tower-crane'));

        expect(
            view.getByText('Tower Crane: Mast, Anchors & Ties'),
        ).toBeTruthy();
        expect(
            view.getByText('Tower Crane: Jib & Weather-Vaning'),
        ).toBeTruthy();
        expect(
            view.getByText('Tower Crane: Trolley & Luffing Drive'),
        ).toBeTruthy();

        // Select Weather-Vaning mechanism defect
        await fireEvent.press(
            view.getByTestId('defect-item-tower_weather_vaning_brake'),
        );

        // Select Trolley winch defect
        await fireEvent.press(
            view.getByTestId('defect-item-tower_trolley_winch'),
        );

        // Press Done
        await fireEvent.press(view.getByTestId('defects-modal-done'));

        // Verify tower crane defect chips
        expect(
            view.getByText(
                'Weather-Vaning / Free-Slewing Release Mechanism & Brake',
            ),
        ).toBeTruthy();
        expect(
            view.getByText('Trolley Drive Winch Motor, Brake & Gearbox'),
        ).toBeTruthy();
        expect(view.getByTestId('dvir-lockout-banner')).toBeTruthy();
    });
});
