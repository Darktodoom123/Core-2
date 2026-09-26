import {
    cleanup,
    fireEvent,
    render,
    within,
} from '@testing-library/react-native/pure';
import '@testing-library/react-native/matchers';
import React from 'react';
import { StyleSheet } from 'react-native';
import { DutyStatusSelectorModal } from '../components/sheets/DutyStatusSelectorModal';
import { AssignedJobsListScreen } from '../screens/AssignedJobsListScreen';
import { DocumentsWalletScreen } from '../screens/DocumentsWalletScreen';

const mockAuthUser = { id: 1, name: 'Alex Rivera' };
const mockApiClient = {};
jest.mock('../auth/AuthContext', () => ({
    useAuth: () => ({
        apiClient: mockApiClient,
        user: mockAuthUser,
    }),
}));

jest.mock('../services/walletService', () => ({
    WalletService: {
        getDocuments: jest.fn().mockResolvedValue([
            {
                id: 'doc-permit-01',
                category: 'road_permits',
                title: 'DPWH Special Heavy-Load Road Transit Permit',
                documentNumber: 'DPWH-NCR-2026-SP-8821',
                issuingAuthority:
                    'Department of Public Works and Highways (DPWH)',
                isExpired: false,
                status: 'valid',
                fileUri: 'test.pdf',
                isAvailableOffline: true,
            },
            {
                id: '2',
                category: 'load_test_certs',
                title: 'DOLE-OSHC 3rd-Party Annual Crane Load Test Certificate',
                documentNumber: 'DOLE-OSHC-2026',
                issuingAuthority: 'DOLE-OSHC',
                isExpired: false,
                status: 'valid',
                fileUri: 'test2.pdf',
                isAvailableOffline: false,
            },
        ]),
        makeAvailableOffline: jest
            .fn()
            .mockImplementation((doc) =>
                Promise.resolve({ ...doc, isAvailableOffline: true }),
            ),
        removeOfflineCopy: jest
            .fn()
            .mockImplementation((doc) =>
                Promise.resolve({ ...doc, isAvailableOffline: false }),
            ),
    },
}));
import { DvirScreen } from '../screens/DvirScreen';
import { lightThemeColors } from '../theme/tokens';
import type { DispatchJob } from '../types/index';

describe('Samsara-Style Heavy Equipment Launcher & Safety Gauntlets', () => {
    afterEach(async () => {
        await cleanup();
        jest.clearAllMocks();
    });

    const mockJob: DispatchJob = {
        id: 101,
        reference: 'DISP-2026-0891',
        title: '50T Crane Dual Pick & Set',
        status: {
            value: 'arrived',
            label: 'Arrived at Site',
        },
        priority: {
            value: 'priority',
            label: 'Priority',
        },
        scheduled_start: '2026-08-31T08:00:00Z',
        site: 'DMCI Power Plant Block B',
        client: 'DMCI Power & Infra Corp',
        version: 1,
        capabilities: {
            can_respond: true,
            can_update_status: true,
            can_share_location: true,
        },
        asset_assignments: [
            {
                id: 1,
                operational_asset_id: 50,
                asset_name: '50T Tadano All-Terrain Crane',
                asset_code: 'ALB-CRN-050',
                asset_kind: 'mobile_crane',
            },
        ],
    };

    describe('DutyStatusSelectorModal', () => {
        it('renders 5 heavy equipment duty states with shift fatigue gauge', async () => {
            const onSelect = jest.fn();
            const onClose = jest.fn();

            const view = await render(
                <DutyStatusSelectorModal
                    currentDutyStatus="operating"
                    hoursElapsed={4.5}
                    maxShiftHours={10}
                    onClose={onClose}
                    onSelectDutyStatus={onSelect}
                    visible={true}
                />,
            );

            expect(view.getByText('Select Duty Status')).toBeTruthy();
            expect(
                view.getByText('Shift Duty Clock: 4.5h / 10h Limit'),
            ).toBeTruthy();
            expect(
                view.getByText('On Duty — Crane / Machine Operating'),
            ).toBeTruthy();
            expect(view.getByText('On Duty — Driving / Transit')).toBeTruthy();
            expect(
                view.getByText('On Duty — Standby / Delay (Demurrage)'),
            ).toBeTruthy();
            expect(
                view.getByText('On Break — Meal / Rest Period'),
            ).toBeTruthy();
            expect(view.getByText('Off Duty — Shift Complete')).toBeTruthy();
        });

        it('shows billable demurrage reasons when standby is selected', async () => {
            const onSelect = jest.fn();
            const onClose = jest.fn();

            const view = await render(
                <DutyStatusSelectorModal
                    currentDutyStatus="operating"
                    hoursElapsed={5.0}
                    maxShiftHours={10}
                    onClose={onClose}
                    onSelectDutyStatus={onSelect}
                    visible={true}
                />,
            );

            // Select standby option
            await fireEvent.press(view.getByTestId('duty-option-standby'));
            expect(view.getByTestId('standby-reason-section')).toBeTruthy();
            expect(
                view.getByText('STANDBY REASON (DEMURRAGE BILLING)'),
            ).toBeTruthy();

            // Select weather hold reason
            await fireEvent.press(view.getByTestId('reason-weather_hold'));

            // Enter optional remarks
            await fireEvent.changeText(
                view.getByTestId('duty-remarks-input'),
                'Typhoon Signal 2 gusts at 45kph - site crane operations halted by Safety Officer.',
            );

            // Confirm
            await fireEvent.press(view.getByTestId('confirm-duty-status-btn'));
            expect(onSelect).toHaveBeenCalledWith(
                'standby',
                'weather_hold',
                'Typhoon Signal 2 gusts at 45kph - site crane operations halted by Safety Officer.',
            );
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('AssignedJobsListScreen Persistent Duty Bar', () => {
        it('updates persistent duty status when confirmed via selector modal', async () => {
            const onChangeDutyStatus = jest.fn();

            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    jobs={[mockJob]}
                    onChangeDutyStatus={onChangeDutyStatus}
                    onRefresh={jest.fn()}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        hoursElapsed: 4.0,
                    }}
                />,
            );

            // Initially operating
            expect(view.getByText('On Duty — Crane Operating')).toBeTruthy();
            expect(view.getByText('OPR')).toBeTruthy();

            // Open duty modal by tapping persistent duty bar
            await fireEvent.press(view.getByTestId('hero-duty-status-bar'));
            expect(view.getByTestId('duty-status-sheet')).toBeTruthy();

            // Select Standby
            await fireEvent.press(view.getByTestId('duty-option-standby'));
            await fireEvent.press(view.getByTestId('reason-client_delay'));

            // Confirm
            await fireEvent.press(view.getByTestId('confirm-duty-status-btn'));
            expect(onChangeDutyStatus).toHaveBeenCalledWith(
                'standby',
                'client_delay',
                undefined,
            );

            // Verified immediate update on screen
            expect(view.getByText('On Duty — Standby / Delay')).toBeTruthy();
            expect(view.getByText('SBY')).toBeTruthy();
        });

        it('renders neutral launcher tiles in a non-scrolling grid with user-friendly text', async () => {
            const onOpenHos = jest.fn();
            const onOpenDvir = jest.fn();
            const onOpenRoutes = jest.fn();
            const onOpenDocs = jest.fn();
            const onOpenVehicle = jest.fn();
            const onOpenRental = jest.fn();
            const onOpenFuel = jest.fn();

            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    jobs={[mockJob]}
                    onOpenDocuments={onOpenDocs}
                    onOpenDvir={onOpenDvir}
                    onOpenFuel={onOpenFuel}
                    onOpenHos={onOpenHos}
                    onOpenRental={onOpenRental}
                    onOpenRoutes={onOpenRoutes}
                    onOpenVehicle={onOpenVehicle}
                    onRefresh={jest.fn()}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        hoursElapsed: 4.0,
                    }}
                />,
            );

            // Verify friendly text labels
            expect(view.getByText('Hours of\nService')).toBeTruthy();
            expect(view.getByText('Vehicle\nInspection')).toBeTruthy();
            expect(view.queryByText('Drive\nRoutes')).toBeNull();
            expect(view.getByText('Documents')).toBeTruthy();
            expect(view.getByText('Machine\nProfile')).toBeTruthy();
            expect(view.getByText('Dispatch')).toBeTruthy();
            expect(view.getByText('Intake & Orders')).toBeTruthy();
            expect(view.getByText('Rental\nHandover')).toBeTruthy();
            expect(view.getByText('Fuel')).toBeTruthy();

            // The grid wraps instead of scrolling sideways (Docs/design/mobile.md).
            const grid = view.getByTestId('industrial-tile-grid');
            expect(grid.props.horizontal).toBeFalsy();
            expect(view.queryByTestId('tile-routes')).toBeNull();

            // Row layout: lifecycle actions first, then supporting tools.
            const row1 = view.getByTestId('tile-row-1');
            const row2 = view.getByTestId('tile-row-2');
            expect(within(row1).getByTestId('tile-hos')).toBeTruthy();
            expect(within(row1).getByTestId('tile-dvir')).toBeTruthy();
            expect(within(row1).getByTestId('tile-forms')).toBeTruthy();
            expect(within(row2).getByTestId('tile-documents')).toBeTruthy();
            expect(within(row2).getByTestId('tile-vehicle')).toBeTruthy();
            expect(within(row2).getByTestId('tile-rental')).toBeTruthy();
            expect(within(grid).getByTestId('tile-fuel')).toBeTruthy();

            // Tiles are navigation, not status: neutral surface, hairline
            // border, no per-tile hue and no resting shadow.
            for (const id of [
                'hos',
                'dvir',
                'forms',
                'documents',
                'vehicle',
                'rental',
                'fuel',
            ]) {
                const tileStyle = StyleSheet.flatten(
                    view.getByTestId(`tile-${id}`).props.style,
                );
                expect(tileStyle).toEqual(
                    expect.objectContaining({
                        backgroundColor: lightThemeColors.surface,
                        borderColor: lightThemeColors.border,
                        borderWidth: 1,
                        borderRadius: 12,
                    }),
                );
                expect(tileStyle.elevation ?? 0).toBe(0);
                expect(tileStyle.boxShadow).toBeUndefined();
            }

            // State appears only as a badge; a pending dispatch is an action,
            // so its count badge uses Signal Gold.
            const badgeStyle = StyleSheet.flatten(
                view.getByTestId('tile-forms-badge').props.style,
            );
            expect(badgeStyle.backgroundColor).toBe(
                lightThemeColors.brandAmber,
            );

            // Text respects the 12sp floor.
            for (const label of ['Dispatch', 'Intake & Orders']) {
                const textStyle = StyleSheet.flatten(
                    view.getByText(label).props.style,
                );
                expect(textStyle.fontSize).toBeGreaterThanOrEqual(12);
            }

            await fireEvent.press(view.getByTestId('tile-hos'));
            expect(onOpenHos).toHaveBeenCalled();

            await fireEvent.press(view.getByTestId('tile-dvir'));
            expect(onOpenDvir).toHaveBeenCalled();

            await fireEvent.press(view.getByTestId('tile-documents'));
            expect(onOpenDocs).toHaveBeenCalled();

            await fireEvent.press(view.getByTestId('tile-vehicle'));
            expect(onOpenVehicle).toHaveBeenCalled();

            await fireEvent.press(view.getByTestId('tile-rental'));
            expect(onOpenRental).toHaveBeenCalled();

            await fireEvent.press(view.getByTestId('tile-fuel'));
            expect(onOpenFuel).toHaveBeenCalled();
        });

        it('opens DispatchIntakeSheet from Dispatch tile to inspect orders and accept assignment', async () => {
            const onAccept = jest.fn();
            const onOpenForms = jest.fn();

            const pendingJob: DispatchJob = {
                ...mockJob,
                id: 202,
                version: 3,
                status: {
                    value: 'dispatched',
                    label: 'Dispatched',
                },
                my_assignment: {
                    id: 77,
                    response_status: 'pending',
                    response_status_label: 'Pending Response',
                    assigned_at: '2026-08-31T08:00:00Z',
                },
            };

            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    jobs={[pendingJob]}
                    onAcceptAssignment={onAccept}
                    onOpenForms={onOpenForms}
                    onRefresh={jest.fn()}
                    onRejectAssignment={jest.fn()}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        hoursElapsed: 4.5,
                    }}
                />,
            );

            // Press Dispatch tile
            await fireEvent.press(view.getByTestId('tile-forms'));
            expect(onOpenForms).toHaveBeenCalled();

            // Sheet opens on the pending assignment
            expect(view.getByTestId('dispatch-intake-sheet')).toBeTruthy();
            expect(view.getByText('Needs Response (1)')).toBeTruthy();
            expect(view.getByTestId('dispatch-intake-job-202')).toBeTruthy();

            // Accept assignment
            await fireEvent.press(view.getByTestId('accept-assignment-btn'));
            expect(onAccept).toHaveBeenCalledWith(202, 77, 3);

            // Close sheet
            await fireEvent.press(
                view.getByTestId('close-dispatch-intake-btn'),
            );
            expect(view.queryByTestId('dispatch-intake-sheet')).toBeNull();
        });

        it('opens DispatchIntakeSheet from Dispatch tile and allows rejecting assignment with reason', async () => {
            const onAccept = jest.fn();
            const onReject = jest.fn();

            const pendingJob: DispatchJob = {
                ...mockJob,
                id: 303,
                version: 2,
                status: {
                    value: 'dispatched',
                    label: 'Dispatched',
                },
                my_assignment: {
                    id: 99,
                    response_status: 'pending',
                    response_status_label: 'Pending Response',
                    assigned_at: '2026-08-31T08:00:00Z',
                },
            };

            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    jobs={[pendingJob]}
                    onAcceptAssignment={onAccept}
                    onRefresh={jest.fn()}
                    onRejectAssignment={onReject}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        hoursElapsed: 4.0,
                    }}
                />,
            );

            // Sublabel displayed on tile
            expect(view.getByText('Intake & Orders')).toBeTruthy();

            // Press Dispatch tile
            await fireEvent.press(view.getByTestId('tile-forms'));

            // Sheet opens and displays pending assignment
            expect(view.getByTestId('dispatch-intake-sheet')).toBeTruthy();
            expect(view.getByText('Dispatch Intake & Orders')).toBeTruthy();
            expect(view.getByTestId('dispatch-intake-job-303')).toBeTruthy();
            expect(view.getByTestId('reject-assignment-btn')).toBeTruthy();

            // Press reject assignment button to show reason input
            await fireEvent.press(view.getByTestId('reject-assignment-btn'));
            expect(view.getByTestId('rejection-reason-input')).toBeTruthy();

            // Fill reason and submit rejection
            await fireEvent.changeText(
                view.getByTestId('rejection-reason-input'),
                'Boom extension not rated for 50T lift at DMCI site.',
            );
            await fireEvent.press(view.getByTestId('submit-rejection-btn'));

            expect(onReject).toHaveBeenCalledWith(
                303,
                99,
                'Boom extension not rated for 50T lift at DMCI site.',
                2,
            );

            // Close sheet
            await fireEvent.press(
                view.getByTestId('close-dispatch-intake-btn'),
            );
            expect(view.queryByTestId('dispatch-intake-sheet')).toBeNull();
        });

        it('auto-selects All Orders tab in DispatchIntakeSheet when opened with zero pending orders and allows selecting a job', async () => {
            const onSelectJob = jest.fn();

            const acceptedJob: DispatchJob = {
                ...mockJob,
                id: 404,
                version: 4,
                status: {
                    value: 'working',
                    label: 'Working On Site',
                },
                my_assignment: {
                    id: 112,
                    response_status: 'accepted',
                    response_status_label: 'Accepted',
                    assigned_at: '2026-08-31T08:00:00Z',
                },
            };

            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    jobs={[acceptedJob]}
                    onRefresh={jest.fn()}
                    onSelectJob={onSelectJob}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        hoursElapsed: 4.0,
                    }}
                />,
            );

            // Open Dispatch tile
            await fireEvent.press(view.getByTestId('tile-forms'));

            // Sheet should open on All Orders tab since 0 pending orders
            expect(view.getByTestId('dispatch-intake-sheet')).toBeTruthy();
            expect(view.getByText('All Orders (1)')).toBeTruthy();
            expect(view.getByTestId('dispatch-intake-job-404')).toBeTruthy();

            // Select job closes sheet and invokes callback
            await fireEvent.press(
                within(view.getByTestId('dispatch-intake-sheet')).getByTestId(
                    'job-card-404',
                ),
            );
            expect(onSelectJob).toHaveBeenCalledWith(404);
            expect(view.queryByTestId('dispatch-intake-sheet')).toBeNull();
        });
    });

    describe('DvirScreen Pre-Trip & Post-Trip Engine', () => {
        it('renders pre-trip walkaround, updates meter values, and completes sign-off', async () => {
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

            expect(view.getByText('Vehicle Inspection')).toBeTruthy();
            expect(view.getByText('Create DVIR')).toBeTruthy();
            expect(view.getByText('1. Pre-Trip')).toBeTruthy();
            expect(view.getByText('2. Post-Trip')).toBeTruthy();
            expect(view.getByTestId('input-odometer')).toBeTruthy();

            // Enter odometer & hour meter
            await fireEvent.changeText(
                view.getByTestId('input-odometer'),
                '42180',
            );
            await fireEvent.changeText(
                view.getByTestId('input-engine-hours'),
                '1850.0',
            );

            // Complete DVIR
            await fireEvent.press(view.getByTestId('complete-dvir-button'));
            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    assetCode: 'ALB-CRN-050',
                    type: 'pre_trip',
                    startingOdometerKm: 42180,
                    engineHours: 1850.0,
                    signatureCaptured: true,
                }),
            );
        });

        it('supports Post-Trip parked & secured shutdown checklists', async () => {
            const view = await render(
                <DvirScreen assetCode="ALB-CRN-050" initialMode="post_trip" />,
            );

            // Switch to Post-Trip tab
            await fireEvent.press(view.getByTestId('tab-post-trip'));
            expect(
                view.getByText('PARKED & SECURED SHUTDOWN CHECKLIST'),
            ).toBeTruthy();
            expect(view.getByTestId('check-parking-brake')).toBeTruthy();
            expect(view.getByTestId('check-wheel-chocks')).toBeTruthy();
            expect(view.getByTestId('check-outriggers-stowed')).toBeTruthy();
        });
    });

    describe('DocumentsWalletScreen In-Cab Digital Cache', () => {
        it('renders road permits, load certs, licenses, and permits previewing certificate', async () => {
            const onBack = jest.fn();

            const view = await render(
                <DocumentsWalletScreen
                    assetCode="ALB-CRN-050"
                    onBack={onBack}
                    operatorName="Alex Rivera"
                />,
            );

            expect(view.getByText('Documents & Permits')).toBeTruthy();
            expect(
                await view.findByText(
                    'DPWH Special Heavy-Load Road Transit Permit',
                ),
            ).toBeTruthy();
            expect(
                await view.findByText(
                    'DOLE-OSHC 3rd-Party Annual Crane Load Test Certificate',
                ),
            ).toBeTruthy();

            // Filter by road permits
            await fireEvent.press(view.getByTestId('filter-road_permits'));
            expect(
                await view.findByText(
                    'DPWH Special Heavy-Load Road Transit Permit',
                ),
            ).toBeTruthy();

            // Open source document modal
            await fireEvent.press(
                view.getByTestId('view-doc-btn-doc-permit-01'),
            );
            expect(await view.findByTestId('certificate-modal')).toBeTruthy();
            expect(await view.findByText('CORE-2 OPERATIONS')).toBeTruthy();
            expect(
                view.getAllByText('DPWH-NCR-2026-SP-8821').length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                view.getByText('✓ Operations Record Synchronized'),
            ).toBeTruthy();
        });
    });
});
