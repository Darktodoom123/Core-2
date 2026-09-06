import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Alert } from 'react-native';
import { DvirScreen } from '../screens/DvirScreen';
import { FieldApiClient } from '../services/apiClient';
import { ThemeProvider } from '../theme';

describe('DvirScreen Component & Workflows', () => {
    jest.setTimeout(15000);

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
        expect(view.getByText('Add new mobile crane defects')).toBeTruthy();
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

        expect(view.getByText("TODAY'S SHIFT INSPECTIONS")).toBeTruthy();
        expect(view.getByTestId('history-card-DVIR-2026-0831-01')).toBeTruthy();
        expect(view.getByTestId('history-card-DVIR-2026-0830-02')).toBeTruthy();
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

    it('renders grouped history sections for Today, Past 7 Days compliance, and 30-Day Archive', async () => {
        const view = await render(
            <DvirScreen
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
            />,
        );

        // Switch to history tab
        await fireEvent.press(view.getByTestId('tab-history'));

        // Verify section headers
        expect(view.getByText("TODAY'S SHIFT INSPECTIONS")).toBeTruthy();
        expect(view.getByText('PAST 7 DAYS (SAFETY COMPLIANCE)')).toBeTruthy();

        // Verify today and past 7 days cards are rendered
        expect(view.getByTestId('history-card-DVIR-2026-0831-01')).toBeTruthy();
        expect(view.getByTestId('history-card-DVIR-2026-0830-02')).toBeTruthy();
        expect(view.getByTestId('history-card-DVIR-2026-0828-01')).toBeTruthy();

        // Archive button exists
        const archiveButton = view.getByTestId('toggle-older-archive');
        expect(archiveButton).toBeTruthy();

        // Expand 30-day archive
        await fireEvent.press(archiveButton);
        expect(view.getByTestId('history-card-DVIR-2026-0818-01')).toBeTruthy();
    });

    it('loads DVIR history from apiClient on mount', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () =>
                JSON.stringify({
                    data: {
                        days: 30,
                        inspections: [
                            {
                                id: 'DVIR-000042',
                                type: 'pre_trip',
                                type_label: 'Pre-Trip Inspection',
                                asset_code: 'CRN-777',
                                asset_name: '70T Grove Mobile Crane',
                                inspector_name: 'Alex Rivera',
                                starting_odometer_km: 12000,
                                ending_odometer_km: null,
                                engine_hours: 500,
                                has_defects: false,
                                critical_defects_count: 0,
                                signature_captured: true,
                                remarks: 'All green on server fetch.',
                                completed_at: new Date().toISOString(),
                                checks: [],
                            },
                        ],
                    },
                }),
        });

        const apiClient = new FieldApiClient({
            baseUrl: 'https://api.example.com',
            getToken: () => 'test-token',
            fetchFn: mockFetch as any,
        });

        const view = await render(
            <DvirScreen apiClient={apiClient} assetCode="CRN-777" />,
        );

        // Wait for server records to load (history button label updates from History (4) to History (1))
        await waitFor(() => {
            expect(view.getByText('History (1)')).toBeTruthy();
        });

        // Switch to history tab
        await fireEvent.press(view.getByTestId('tab-history'));

        // Verify the server record details are displayed in the history tab
        expect(view.getByText('DVIR-000042')).toBeTruthy();
        expect(view.getByTestId('history-card-DVIR-000042')).toBeTruthy();
        expect(view.getByText(/70T Grove Mobile Crane/)).toBeTruthy();

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.example.com/api/v1/dvir/inspections?days=30',
            expect.objectContaining({ method: 'GET' }),
        );
    });

    it('submits completed DVIR to apiClient with correct payload structure', async () => {
        let capturedUrl = '';
        let capturedBody: any = null;

        const mockFetch = jest.fn().mockImplementation(async (url, init) => {
            if (init?.method === 'POST') {
                capturedUrl = String(url);
                capturedBody = JSON.parse(init.body);

                return {
                    ok: true,
                    status: 201,
                    text: async () =>
                        JSON.stringify({
                            data: {
                                id: 'DVIR-000099',
                                type: capturedBody.inspection_type,
                                asset_code: capturedBody.asset_code,
                                asset_name: capturedBody.asset_name,
                                inspector_name: capturedBody.inspector_name,
                                starting_odometer_km:
                                    capturedBody.starting_odometer_km,
                                engine_hours: capturedBody.engine_hours,
                                has_defects: capturedBody.has_defects,
                                critical_defects_count: 0,
                                signature_captured: true,
                                remarks: capturedBody.remarks,
                                completed_at: new Date().toISOString(),
                                checks: capturedBody.checks,
                            },
                        }),
                };
            }

            return {
                ok: true,
                status: 200,
                text: async () =>
                    JSON.stringify({
                        data: {
                            days: 30,
                            inspections: [],
                        },
                    }),
            };
        });

        const apiClient = new FieldApiClient({
            baseUrl: 'https://api.example.com',
            getToken: () => 'test-token',
            fetchFn: mockFetch as any,
        });

        const onSave = jest.fn();

        const view = await render(
            <DvirScreen
                apiClient={apiClient}
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

        // Press complete DVIR
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        expect(onSave).toHaveBeenCalled();

        await waitFor(() => {
            expect(capturedUrl).toBe(
                'https://api.example.com/api/v1/dvir/inspections',
            );
            expect(capturedBody).not.toBeNull();
        });

        expect(capturedBody.inspection_type).toBe('pre_trip');
        expect(capturedBody.asset_code).toBe('ALB-CRN-050');
        expect(capturedBody.asset_name).toBe('50T Tadano All-Terrain Crane');
        expect(capturedBody.inspector_name).toBe(
            'Alex Rivera (Certified Crane Operator)',
        );
        expect(capturedBody.starting_odometer_km).toBe(42200);
        expect(capturedBody.ending_odometer_km).toBeNull();
        expect(capturedBody.engine_hours).toBe(1855.0);
        expect(capturedBody.has_defects).toBe(false);
        expect(capturedBody.signature_captured).toBe(true);
        expect(Array.isArray(capturedBody.checks)).toBe(true);
        expect(capturedBody.checks.length).toBeGreaterThan(0);
        expect(capturedBody.checks[0]).toHaveProperty('category');
        expect(capturedBody.checks[0]).toHaveProperty('label');
        expect(capturedBody.checks[0]).toHaveProperty('status');

        // Server-derived / forbidden-on-create fields should NOT be sent
        expect(capturedBody.critical_defects_count).toBeUndefined();
        expect(capturedBody.completed_at).toBeUndefined();
    });

    it('submits completed DVIR with walkaround photos when photos are captured', async () => {
        let capturedBody: any = null;
        const mockFetch = jest
            .fn()
            .mockImplementation(async (url: string, init: any) => {
                if (
                    url.includes('/api/v1/dvir/inspections') &&
                    init?.method === 'POST'
                ) {
                    capturedBody = JSON.parse(init.body);

                    return {
                        ok: true,
                        status: 201,
                        json: async () => ({
                            message: 'DVIR recorded successfully',
                            data: {
                                id: 'DVIR-000099',
                                internal_id: 99,
                                type: capturedBody.inspection_type,
                                asset_code: capturedBody.asset_code,
                                asset_name: capturedBody.asset_name,
                                checks: [],
                                photos: capturedBody.photos || [],
                                completed_at: new Date().toISOString(),
                            },
                        }),
                    };
                }

                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { days: 30, inspections: [] } }),
                };
            });

        const apiClient = new FieldApiClient({
            baseUrl: 'https://api.example.com',
            getToken: () => 'test-token',
            fetchFn: mockFetch as any,
        });

        jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
            buttons?.[0]?.onPress?.();
        });

        jest.spyOn(
            ImagePicker,
            'requestCameraPermissionsAsync',
        ).mockResolvedValue({
            status: 'granted',
            canAskAgain: true,
            expires: 'never',
            granted: true,
        } as any);

        jest.spyOn(ImagePicker, 'launchCameraAsync').mockResolvedValue({
            canceled: false,
            assets: [
                {
                    uri: 'file:///photo_driver_side.jpg',
                    fileName: 'driver_side_photo.jpg',
                    fileSize: 1024,
                    base64: 'fake_base64_photo_data',
                    width: 800,
                    height: 600,
                },
            ],
        } as any);

        const view = await render(
            <DvirScreen
                apiClient={apiClient}
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
            />,
        );

        // Click driver side photo slot
        await fireEvent.press(view.getByTestId('slot-driver-side'));

        // Complete DVIR
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        await waitFor(() => {
            expect(capturedBody).not.toBeNull();
            expect(capturedBody.photos).toBeDefined();
            expect(capturedBody.photos.length).toBe(1);
            expect(capturedBody.photos[0].angle).toBe('driver_side');
            expect(capturedBody.photos[0].base64).toBe(
                'fake_base64_photo_data',
            );
        });
    });

    it('falls back to local history and shows warning when server history fetch fails', async () => {
        const mockFetch = jest
            .fn()
            .mockRejectedValue(new Error('Network error'));

        const apiClient = new FieldApiClient({
            baseUrl: 'https://api.example.com',
            getToken: () => 'test-token',
            fetchFn: mockFetch as any,
        });

        const view = await render(
            <DvirScreen apiClient={apiClient} assetCode="ALB-CRN-050" />,
        );

        // Switch to history tab
        await fireEvent.press(view.getByTestId('tab-history'));

        // Wait for sync warning to appear
        await waitFor(() => {
            expect(view.getByTestId('dvir-sync-warning')).toBeTruthy();
            expect(
                view.getByText(
                    'DVIR history could not be loaded. Showing cached records.',
                ),
            ).toBeTruthy();
        });

        // Cached/initial records are still visible
        expect(view.getByTestId('history-card-DVIR-2026-0831-01')).toBeTruthy();
    });

    it('renders properly in Light mode with mobile design system surface and tokens', async () => {
        const onBack = jest.fn();
        const view = await render(
            <ThemeProvider initialMode="light">
                <DvirScreen
                    activeJobReference="DISP-2026-0891"
                    assetCode="ALB-CRN-050"
                    onBack={onBack}
                />
            </ThemeProvider>,
        );

        // Core screen and back button render
        expect(view.getByTestId('dvir-screen')).toBeTruthy();
        expect(view.getByTestId('dvir-back-button')).toBeTruthy();

        // 4 walkaround camera photo slots render
        expect(view.getByTestId('slot-driver-side')).toBeTruthy();
        expect(view.getByTestId('slot-front')).toBeTruthy();
        expect(view.getByTestId('slot-passenger-side')).toBeTruthy();
        expect(view.getByTestId('slot-back')).toBeTruthy();

        // Defects modal can open in light theme
        await fireEvent.press(view.getByTestId('add-defects-button'));
        expect(view.getByTestId('defects-modal-container')).toBeTruthy();
        expect(view.getByTestId('defects-search-input')).toBeTruthy();
        expect(view.getByTestId('filter-all')).toBeTruthy();

        // Filter and select an item in light mode
        await fireEvent.press(view.getByTestId('filter-carrier'));
        await fireEvent.press(view.getByTestId('defects-modal-done'));

        // Action button renders
        expect(view.getByTestId('complete-dvir-button')).toBeTruthy();
    });

    it('renders properly in Dark HUD mode matching industrial telemetry tokens', async () => {
        const onBack = jest.fn();
        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <DvirScreen
                    activeJobReference="DISP-2026-0891"
                    assetCode="ALB-CRN-050"
                    onBack={onBack}
                />
            </ThemeProvider>,
        );

        // Screen and HUD back button render
        expect(view.getByTestId('dvir-screen')).toBeTruthy();
        expect(view.getByTestId('dvir-back-button')).toBeTruthy();

        // Safe/Unsafe toggle switches to unsafe and displays critical lockout banner
        await fireEvent.press(view.getByTestId('safety-status-unsafe'));
        expect(view.getByTestId('dvir-lockout-banner')).toBeTruthy();
        expect(view.getByText('DISPATCH LOCKOUT ACTIVE')).toBeTruthy();

        // Defects modal in dark HUD mode
        await fireEvent.press(view.getByTestId('add-defects-button'));
        expect(view.getByTestId('defects-modal-container')).toBeTruthy();
        expect(view.getByTestId('filter-mobile-crane')).toBeTruthy();

        // Close modal
        await fireEvent.press(view.getByTestId('defects-modal-done'));
    });

    it('dynamically adapts defect reporting and modal for a designated Vehicle / Carrier', async () => {
        const view = await render(
            <DvirScreen
                assetCode="TRK-202"
                assetKind="truck"
                assetName="Heavy Rig Truck"
            />,
        );

        // Section header and helper are tailored to vehicle
        expect(view.getByText('Add new vehicle defects')).toBeTruthy();
        expect(
            view.getByText(
                'Any vehicle attributes not displayed are certified safe by the driver',
            ),
        ).toBeTruthy();
        expect(view.getByText('Safe to drive')).toBeTruthy();

        // Open defects modal
        await fireEvent.press(view.getByTestId('add-defects-button'));

        // Modal title reflects vehicle
        expect(view.getByTestId('defects-modal-title')).toBeTruthy();
        expect(view.getByText('Add Vehicle Defects')).toBeTruthy();

        // Designated asset banner displays vehicle context
        expect(view.getByTestId('designated-asset-banner')).toBeTruthy();
        expect(view.getByText('TRK-202')).toBeTruthy();
        expect(view.getByText('Heavy Rig Truck')).toBeTruthy();
        expect(view.getByText('Carrier & Road (Designated)')).toBeTruthy();

        // Vehicle categories are displayed
        expect(view.getByText('Exterior - Front')).toBeTruthy();
        expect(view.getByText('Exterior - Sides & Cab')).toBeTruthy();
        expect(view.getByText('Brakes & Suspension')).toBeTruthy();
        expect(view.getByText('Tires & Wheels')).toBeTruthy();

        // Close modal
        await fireEvent.press(view.getByTestId('defects-modal-done'));
    });

    it('dynamically adapts defect reporting and modal for a designated Tower Crane', async () => {
        const view = await render(
            <DvirScreen
                assetCode="TWR-CRN-280"
                assetKind="tower_crane"
                assetName="Liebherr 280 EC-H Tower Crane"
            />,
        );

        // Section header and helper are tailored to crane tower
        expect(view.getByText('Add new crane tower defects')).toBeTruthy();
        expect(
            view.getByText(
                'Any crane tower attributes not displayed are certified safe by the crane operator',
            ),
        ).toBeTruthy();
        expect(view.getByText('Safe to operate')).toBeTruthy();

        // Open defects modal
        await fireEvent.press(view.getByTestId('add-defects-button'));

        // Modal title reflects tower crane
        expect(view.getByTestId('defects-modal-title')).toBeTruthy();
        expect(view.getByText('Add Tower Crane Defects')).toBeTruthy();

        // Designated asset banner displays tower crane context
        expect(view.getByTestId('designated-asset-banner')).toBeTruthy();
        expect(view.getByText('TWR-CRN-280')).toBeTruthy();
        expect(view.getByText('Tower Crane (Designated)')).toBeTruthy();

        // Tower crane categories are immediately visible without manual tab switching
        expect(
            view.getByText('Tower Crane: Mast, Anchors & Ties'),
        ).toBeTruthy();
        expect(
            view.getByText('Tower Crane: Jib & Weather-Vaning'),
        ).toBeTruthy();
        expect(
            view.getByText('Tower Crane: Trolley & Luffing Drive'),
        ).toBeTruthy();

        // Close modal
        await fireEvent.press(view.getByTestId('defects-modal-done'));
    });
});
