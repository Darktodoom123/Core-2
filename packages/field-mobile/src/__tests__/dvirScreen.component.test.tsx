import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Alert } from 'react-native';
import { DvirScreen } from '../screens/DvirScreen';
import { FieldApiClient } from '../services/apiClient';
import { ThemeProvider } from '../theme';
import type { AssetAssignment } from '../types/index';
import { takeWalkaroundPhotos } from './dvir-test-photos';

/** DVIR readings start empty and must be confirmed; tests that complete one do both. */
const enterEngineHours = async (view: { getByTestId: (id: string) => any }) => {
    await fireEvent.changeText(view.getByTestId('input-engine-hours'), '1855');
    await fireEvent.press(view.getByTestId('dvir-attestation'));
};

const daysAgo = (days: number) =>
    new Date(Date.now() - days * 86400000).toISOString();

const serverInspection = (
    id: string,
    completedAt: string,
    type = 'pre_trip',
) => ({
    id,
    type,
    asset_code: 'ALB-CRN-050',
    asset_name: '50T Tadano All-Terrain Crane',
    inspector_name: 'BJ Bello',
    has_defects: false,
    critical_defects_count: 0,
    completed_at: completedAt,
    checks: [],
});

/** A client whose DVIR history holds today, 1, 3 and 13 days ago. */
const historyClient = () =>
    new FieldApiClient({
        baseUrl: 'https://api.example.com',
        getToken: () => 'test-token',
        fetchFn: jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () =>
                JSON.stringify({
                    data: {
                        days: 30,
                        inspections: [
                            serverInspection(
                                'DVIR-900001',
                                new Date().toISOString(),
                            ),
                            serverInspection(
                                'DVIR-900002',
                                daysAgo(1),
                                'post_trip',
                            ),
                            serverInspection('DVIR-900003', daysAgo(3)),
                            serverInspection('DVIR-900004', daysAgo(13)),
                        ],
                    },
                }),
        }) as any,
    });

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
            <DvirScreen
                assetCode="ALB-CRN-050"
                assetKind="crane"
                initialMode="pre_trip"
            />,
        );

        // Pre-trip is active by default
        const preTripBtn = view.getByTestId('tab-pre-trip');
        const postTripBtn = view.getByTestId('tab-post-trip');

        expect(preTripBtn).toBeTruthy();
        expect(postTripBtn).toBeTruthy();

        // Switch to post-trip
        await fireEvent.press(postTripBtn);
        expect(view.getByText('PARKED & SECURED')).toBeTruthy();
        expect(
            view.getByTestId('post-trip-check-post-trip-parking-brake'),
        ).toBeTruthy();
        expect(
            view.getByTestId('post-trip-check-post-trip-wheel-chocks'),
        ).toBeTruthy();
        expect(
            view.getByTestId('post-trip-check-post-trip-outriggers'),
        ).toBeTruthy();

        // Switch back to pre-trip
        await fireEvent.press(preTripBtn);
        expect(view.queryByText('PARKED & SECURED')).toBeNull();
    });

    it('opens the defects modal, searches for defects, selects items, and displays defect chips', async () => {
        const view = await render(<DvirScreen assetCode="ALB-CRN-050" />);

        // Open defects modal
        await fireEvent.press(view.getByTestId('add-defects-button'));

        // Modal should display search and categories
        expect(view.getByTestId('defects-search-input')).toBeTruthy();
        expect(view.getByText('Exterior - Front')).toBeTruthy();
        await fireEvent.press(
            view.getByTestId('category-toggle-exterior_front'),
        );
        expect(view.getByText('Battery')).toBeTruthy();
        expect(view.getByText('Belts & Hoses')).toBeTruthy();

        // Search for "Radiator"
        await fireEvent.changeText(
            view.getByTestId('defects-search-input'),
            'Radiator',
        );
        expect(view.getByText('Radiator')).toBeTruthy();

        // Select Radiator
        await fireEvent.press(
            view.getByTestId('category-toggle-exterior_front'),
        );
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
        expect(view.getByText('UNIT WILL BE LOCKED')).toBeTruthy();

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
        await takeWalkaroundPhotos(view);

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
        await fireEvent.press(view.getByTestId('dvir-attestation'));
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

    it('views past DVIR history records from the server', async () => {
        const view = await render(
            <DvirScreen apiClient={historyClient()} assetCode="ALB-CRN-050" />,
        );

        await waitFor(() => expect(view.getByText('History (4)')).toBeTruthy());
        await fireEvent.press(view.getByTestId('tab-history'));

        expect(view.getByText("TODAY'S SHIFT INSPECTIONS")).toBeTruthy();
        expect(view.getByTestId('history-card-DVIR-900001')).toBeTruthy();
        expect(view.getByTestId('history-card-DVIR-900002')).toBeTruthy();
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

        expect(view.getByText('Boom & Telescoping')).toBeTruthy();
        expect(view.getByText('Outriggers & Leveling')).toBeTruthy();
        expect(view.getByText('Slewing & Upper Cab')).toBeTruthy();

        // Select critical mobile crane defect: Telescopic Boom
        await fireEvent.press(
            view.getByTestId('category-toggle-mobile_crane_boom'),
        );
        await fireEvent.press(
            view.getByTestId('defect-item-crane_telescopic_boom'),
        );

        // Select outriggers defect
        await fireEvent.press(
            view.getByTestId('category-toggle-mobile_crane_outriggers'),
        );
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
        expect(view.getByText('UNIT WILL BE LOCKED')).toBeTruthy();
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

        expect(view.getByText('Mast, Anchors & Ties')).toBeTruthy();
        expect(view.getByText('Jib & Weather-Vaning')).toBeTruthy();
        expect(view.getByText('Trolley & Luffing Drive')).toBeTruthy();

        // Select Weather-Vaning mechanism defect
        await fireEvent.press(
            view.getByTestId('category-toggle-tower_crane_jib'),
        );
        await fireEvent.press(
            view.getByTestId('defect-item-tower_weather_vaning_brake'),
        );

        // Select Trolley winch defect
        await fireEvent.press(
            view.getByTestId('category-toggle-tower_crane_trolley'),
        );
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
                apiClient={historyClient()}
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
            />,
        );

        await waitFor(() => expect(view.getByText('History (4)')).toBeTruthy());
        await fireEvent.press(view.getByTestId('tab-history'));

        expect(view.getByText("TODAY'S SHIFT INSPECTIONS")).toBeTruthy();
        expect(view.getByText('PAST 7 DAYS (SAFETY COMPLIANCE)')).toBeTruthy();
        expect(view.getByTestId('history-card-DVIR-900001')).toBeTruthy();
        expect(view.getByTestId('history-card-DVIR-900002')).toBeTruthy();
        expect(view.getByTestId('history-card-DVIR-900003')).toBeTruthy();

        const archiveButton = view.getByTestId('toggle-older-archive');
        await fireEvent.press(archiveButton);
        expect(view.getByTestId('history-card-DVIR-900004')).toBeTruthy();
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

        // Wait for server records to load (history starts empty)
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
        const onPreTripPassed = jest.fn();
        const onPreTripPending = jest.fn();

        const view = await render(
            <DvirScreen
                apiClient={apiClient}
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
                inspectorName="Alex Rivera (Certified Crane Operator)"
                onSaveInspectionRecord={onSave}
                onPreTripPassed={onPreTripPassed}
                onPreTripPending={onPreTripPending}
            />,
        );
        await takeWalkaroundPhotos(view);

        // Update odometer & hours
        await fireEvent.changeText(view.getByTestId('input-odometer'), '42200');
        await fireEvent.changeText(
            view.getByTestId('input-engine-hours'),
            '1855.0',
        );

        // Press complete DVIR
        await fireEvent.press(view.getByTestId('dvir-attestation'));
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        expect(onSave).toHaveBeenCalled();
        expect(onPreTripPending).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(capturedUrl).toBe(
                'https://api.example.com/api/v1/dvir/inspections',
            );
            expect(capturedBody).not.toBeNull();
            expect(onPreTripPassed).toHaveBeenCalledTimes(1);
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

        await takeWalkaroundPhotos(view);

        // Complete DVIR
        await enterEngineHours(view);
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        await waitFor(() => {
            expect(capturedBody).not.toBeNull();
            expect(capturedBody.photos).toBeDefined();
            expect(
                capturedBody.photos.map((p: { angle: string }) => p.angle),
            ).toEqual(['driver_side', 'front', 'passenger_side', 'back']);
            expect(capturedBody.photos[0].base64).toBe(
                'fake_base64_photo_data',
            );
        });
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

        // Filter and select an item in light mode
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
        expect(view.getByText('UNIT WILL BE LOCKED')).toBeTruthy();

        // Defects modal in dark HUD mode
        await fireEvent.press(view.getByTestId('add-defects-button'));
        expect(view.getByTestId('defects-modal-container')).toBeTruthy();

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
        expect(view.getByTestId('defect-sheet-unit')).toHaveTextContent(
            /TRK-202 · Truck \/ carrier/,
        );

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
        expect(view.getByTestId('defect-sheet-unit')).toHaveTextContent(
            /TWR-CRN-280 · Tower crane/,
        );

        // Tower crane categories are immediately visible without manual tab switching
        expect(view.getByText('Mast, Anchors & Ties')).toBeTruthy();
        expect(view.getByText('Jib & Weather-Vaning')).toBeTruthy();
        expect(view.getByText('Trolley & Luffing Drive')).toBeTruthy();

        // Close modal
        await fireEvent.press(view.getByTestId('defects-modal-done'));
    });

    it('shows the lockout fallback after an unsafe pre-trip and asks dispatch for a replacement', async () => {
        const onDefectLockout = jest.fn();
        const onRequestReplacement = jest.fn();

        const view = await render(
            <DvirScreen
                assetCode="CRN-101"
                assetName="100T Liebherr Crane"
                canRequestReplacement
                initialMode="pre_trip"
                onDefectLockout={onDefectLockout}
                onRequestReplacement={onRequestReplacement}
                onSaveInspectionRecord={jest.fn()}
            />,
        );

        await fireEvent.press(view.getByTestId('safety-status-unsafe'));
        await enterEngineHours(view);
        await fireEvent.changeText(
            view.getByTestId('dvir-remarks-input'),
            'Boom hoist brake slipping under load.',
        );
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        expect(onDefectLockout).toHaveBeenCalledWith(
            'CRN-101',
            expect.objectContaining({ hasDefects: true, type: 'pre_trip' }),
        );
        expect(view.getByText('SAFETY LOCKOUT')).toBeTruthy();

        await fireEvent.press(
            view.getByTestId('fallback-request-replacement-btn'),
        );
        await fireEvent.changeText(
            view.getByTestId('replacement-request-note'),
            'Hoist brake slipping',
        );
        await fireEvent.press(view.getByTestId('replacement-request-send'));

        expect(onRequestReplacement).toHaveBeenCalledWith(
            'Hoist brake slipping',
        );
        expect(
            view.getByTestId('replacement-requested-notice'),
        ).toHaveTextContent(
            /You stay on CRN-101 until dispatch reassigns your job/,
        );
    });

    it('navigates to standby and backs out when standby chosen from defect fallback modal', async () => {
        const onDefectLockout = jest.fn();
        const onSwitchToStandby = jest.fn();
        const onBack = jest.fn();

        const view = await render(
            <DvirScreen
                assetCode="CRN-101"
                initialMode="pre_trip"
                onBack={onBack}
                onDefectLockout={onDefectLockout}
                onSwitchToStandby={onSwitchToStandby}
            />,
        );

        // Toggle Unsafe and complete DVIR
        await fireEvent.press(view.getByTestId('safety-status-unsafe'));
        await enterEngineHours(view);
        await fireEvent.changeText(
            view.getByTestId('dvir-remarks-input'),
            'Boom hoist brake slipping under load.',
        );
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        expect(view.getByTestId('pre-trip-defect-fallback-modal')).toBeTruthy();

        // Press Standby / Await Dispatch
        await fireEvent.press(view.getByTestId('fallback-standby-btn'));
        expect(onSwitchToStandby).toHaveBeenCalledTimes(1);
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('keeps server clearance pending when a clean pre-trip is saved only on the device', async () => {
        const onPreTripPassed = jest.fn();
        const onPreTripPending = jest.fn();
        const onDefectLockout = jest.fn();

        const view = await render(
            <DvirScreen
                assetCode="CRN-101"
                initialMode="pre_trip"
                onDefectLockout={onDefectLockout}
                onPreTripPassed={onPreTripPassed}
                onPreTripPending={onPreTripPending}
            />,
        );
        await takeWalkaroundPhotos(view);

        // Submit default safe inspection
        await enterEngineHours(view);
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        expect(onDefectLockout).not.toHaveBeenCalled();
        expect(onPreTripPending).toHaveBeenCalledTimes(1);
        expect(onPreTripPassed).not.toHaveBeenCalled();
    });

    it('navigates back to dashboard when pressing Saved · Back to home after inspection is saved', async () => {
        const onBack = jest.fn();
        const onPreTripPassed = jest.fn();
        const onPreTripPending = jest.fn();

        const view = await render(
            <DvirScreen
                assetCode="CRN-101"
                initialMode="pre_trip"
                onBack={onBack}
                onPreTripPassed={onPreTripPassed}
                onPreTripPending={onPreTripPending}
            />,
        );
        await takeWalkaroundPhotos(view);

        // First tap: signs & submits inspection
        await enterEngineHours(view);
        await fireEvent.press(view.getByTestId('complete-dvir-button'));
        expect(onPreTripPending).toHaveBeenCalledTimes(1);
        expect(onPreTripPassed).not.toHaveBeenCalled();
        expect(view.getByText('Saved · Back to home')).toBeTruthy();

        // Second tap on the saved button navigates back to dashboard
        await fireEvent.press(view.getByTestId('complete-dvir-button'));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('defaults to pre_trip and leaves clearance pending without server confirmation', async () => {
        const onPreTripPassed = jest.fn();
        const onPreTripPending = jest.fn();

        const view = await render(
            <DvirScreen
                assetCode="CRN-101"
                onPreTripPassed={onPreTripPassed}
                onPreTripPending={onPreTripPending}
            />,
        );
        await takeWalkaroundPhotos(view);

        await enterEngineHours(view);
        await fireEvent.press(view.getByTestId('complete-dvir-button'));
        expect(onPreTripPending).toHaveBeenCalledTimes(1);
        expect(onPreTripPassed).not.toHaveBeenCalled();
    });

    it('supports multi-asset selection, blocks submission until an asset is selected, and allows selection', async () => {
        const onSelectAsset = jest.fn();
        const onPreTripPassed = jest.fn();
        const onPreTripPending = jest.fn();

        const assetAssignments = [
            {
                id: 1,
                operational_asset_id: 101,
                asset_code: 'CRN-50',
                asset_name: '50-Ton Mobile Crane',
                asset_kind: 'mobile_crane',
            },
            {
                id: 2,
                operational_asset_id: 102,
                asset_code: 'TRK-20',
                asset_name: 'Support Flatbed Truck',
                asset_kind: 'truck',
            },
        ];

        const view = await render(
            <DvirScreen
                assetAssignments={assetAssignments}
                initialMode="pre_trip"
                onPreTripPassed={onPreTripPassed}
                onPreTripPending={onPreTripPending}
                onSelectAsset={onSelectAsset}
            />,
        );

        // Verify selector bar and prompt banner render
        expect(view.getByTestId('dvir-asset-selector')).toBeTruthy();
        expect(view.getByTestId('dvir-no-asset-selected-banner')).toBeTruthy();

        // Attempting to submit is blocked
        await enterEngineHours(view);
        await fireEvent.press(view.getByTestId('complete-dvir-button'));
        expect(onPreTripPassed).not.toHaveBeenCalled();

        // Select the crane
        await fireEvent.press(view.getByTestId('dvir-select-asset-101'));
        expect(onSelectAsset).toHaveBeenCalledWith(101);

        // Banner should disappear and submission should succeed
        expect(view.queryByTestId('dvir-no-asset-selected-banner')).toBeNull();
        // Switching unit clears readings, photos and the confirmation;
        // take them again for this unit.
        await takeWalkaroundPhotos(view);
        await enterEngineHours(view);
        await fireEvent.press(view.getByTestId('complete-dvir-button'));
        expect(onPreTripPending).toHaveBeenCalledTimes(1);
        expect(onPreTripPassed).not.toHaveBeenCalled();
    });

    it('renders unassigned banner and blocks submission when operator is unassigned', async () => {
        const onPreTripPassed = jest.fn();

        const view = await render(
            <DvirScreen
                assetCode="UNASSIGNED"
                initialMode="pre_trip"
                onPreTripPassed={onPreTripPassed}
            />,
        );

        expect(view.getByTestId('dvir-unassigned-banner')).toBeTruthy();
        expect(
            view.getByText(
                'No operational equipment assigned to this shift or dispatch.',
            ),
        ).toBeTruthy();

        // Pressing submit button is blocked
        await fireEvent.press(view.getByTestId('complete-dvir-button'));
        expect(onPreTripPassed).not.toHaveBeenCalled();
    });

    it('allows standalone inspection without dispatch linkage when activeJobReference is NO-DISPATCH', async () => {
        const onPreTripPassed = jest.fn();
        const onPreTripPending = jest.fn();

        const view = await render(
            <DvirScreen
                activeJobReference="NO-DISPATCH"
                assetCode="CRN-101"
                initialMode="pre_trip"
                onPreTripPassed={onPreTripPassed}
                onPreTripPending={onPreTripPending}
            />,
        );
        await takeWalkaroundPhotos(view);

        expect(view.queryByTestId('dvir-unassigned-banner')).toBeNull();
        expect(view.getByText('Inspection Checklist')).toBeTruthy();

        await enterEngineHours(view);
        await fireEvent.press(view.getByTestId('complete-dvir-button'));
        expect(onPreTripPending).toHaveBeenCalledTimes(1);
        expect(onPreTripPassed).not.toHaveBeenCalled();
    });

    it('resets captured defects and remarks when switching between assigned assets on a multi-asset job', async () => {
        const onSave = jest.fn();
        const assignments: AssetAssignment[] = [
            {
                id: 1,
                dispatch_job_id: 88,
                operational_asset_id: 101,
                asset_code: 'CRN-101',
                asset_name: 'Liebherr 100T',
                asset_kind: 'mobile_crane',
            },
            {
                id: 2,
                dispatch_job_id: 88,
                operational_asset_id: 202,
                asset_code: 'TRK-202',
                asset_name: 'Support Truck B',
                asset_kind: 'truck',
            },
        ];

        const view = await render(
            <DvirScreen
                assetAssignments={assignments}
                initialMode="pre_trip"
                onSaveInspectionRecord={onSave}
                selectedAssetId={101}
            />,
        );

        // Add a defect to CRN-101
        await fireEvent.press(view.getByTestId('add-defects-button'));
        await fireEvent.press(
            view.getByTestId('category-toggle-mobile_crane_boom'),
        );
        await fireEvent.press(
            view.getByTestId('defect-item-crane_telescopic_boom'),
        );
        await fireEvent.press(view.getByTestId('defects-modal-done'));

        // Defect chip for CRN-101 is displayed
        expect(
            view.getByText('Telescopic Boom Sections & Wear Pads'),
        ).toBeTruthy();

        // Switch to TRK-202
        await fireEvent.press(view.getByTestId('dvir-select-asset-202'));

        // The defect from CRN-101 must NOT be present on TRK-202
        expect(
            view.queryByText('Telescopic Boom Sections & Wear Pads'),
        ).toBeNull();
    });
});
