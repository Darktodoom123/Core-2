import {
    cleanup,
    fireEvent,
    render,
    within,
} from '@testing-library/react-native/pure';
import '@testing-library/react-native/matchers';
import React from 'react';
import { DutyStatusSelectorModal } from '../components/sheets/DutyStatusSelectorModal';
import { AssignedJobsListScreen } from '../screens/AssignedJobsListScreen';
import { DocumentsWalletScreen } from '../screens/DocumentsWalletScreen';
import { DvirScreen } from '../screens/DvirScreen';
import { OperatorDashboardScreen } from '../screens/OperatorDashboardScreen';
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

    describe('OperatorDashboardScreen 6-Tile Industrial Launcher', () => {
        it('renders persistent duty bar, vehicle asset card, and all 6 colored launcher tiles', async () => {
            const onOpenDvir = jest.fn();
            const onOpenDocs = jest.fn();
            const onOpenRoutes = jest.fn();
            const onOpenVehicle = jest.fn();
            const onOpenForms = jest.fn();
            const onOpenRental = jest.fn();
            const onOpenSales = jest.fn();
            const onSelectJob = jest.fn();

            const view = await render(
                <OperatorDashboardScreen
                    onSosHoldComplete={jest.fn()}
                    isLoading={false}
                    isOnline={true}
                    jobs={[mockJob]}
                    onDiscardCommand={jest.fn()}
                    onLogout={jest.fn()}
                    onOpenDocuments={onOpenDocs}
                    onOpenDvir={onOpenDvir}
                    onOpenForms={onOpenForms}
                    onOpenRental={onOpenRental}
                    onOpenRoutes={onOpenRoutes}
                    onOpenSales={onOpenSales}
                    onOpenVehicle={onOpenVehicle}
                    onRefresh={jest.fn()}
                    onRetryCommand={jest.fn()}
                    onSelectJob={onSelectJob}
                    outboxCommands={[]}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        hoursElapsed: 4.2,
                    }}
                    userName="Alex Rivera"
                    userRole="Master Crane Rigger"
                />,
            );

            // Identity & Vehicle
            expect(view.getByText('ALEX RIVERA')).toBeTruthy();
            expect(view.getByText('ALB-CRN-050')).toBeTruthy();
            expect(view.getByText('DISP-2026-0891')).toBeTruthy();

            // Launcher Grid
            expect(view.getByTestId('tile-hos')).toBeTruthy();
            expect(view.getByTestId('tile-dvir')).toBeTruthy();
            expect(view.getByTestId('tile-routes')).toBeTruthy();
            expect(view.getByTestId('tile-documents')).toBeTruthy();
            expect(view.getByTestId('tile-vehicle')).toBeTruthy();
            expect(view.getByTestId('tile-forms')).toBeTruthy();
            const rentalTile = view.getByTestId('tile-rental');
            const salesTile = view.getByTestId('tile-sales');
            expect(rentalTile).toBeTruthy();
            expect(salesTile).toBeTruthy();
            expect(rentalTile.props.style).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ backgroundColor: '#4F46E5' }),
                ]),
            );
            expect(salesTile.props.style).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ backgroundColor: '#E11D48' }),
                ]),
            );

            // 2x4 Column Layout Verification
            // Col 1: HOS (top) & Documents (bottom)
            // Col 2: Vehicle Inspection (top) & Machine Profile (bottom)
            // Col 3: Routes (top) & Dispatch Schedule (bottom)
            // Col 4: Rental Handover (top) & Sales Delivery (bottom)
            const col1 = view.getByTestId('tile-column-1');
            const col2 = view.getByTestId('tile-column-2');
            const col3 = view.getByTestId('tile-column-3');
            const col4 = view.getByTestId('tile-column-4');
            expect(within(col1).getByTestId('tile-hos')).toBeTruthy();
            expect(within(col1).getByTestId('tile-documents')).toBeTruthy();
            expect(within(col2).getByTestId('tile-dvir')).toBeTruthy();
            expect(within(col2).getByTestId('tile-vehicle')).toBeTruthy();
            expect(within(col3).getByTestId('tile-routes')).toBeTruthy();
            expect(within(col3).getByTestId('tile-forms')).toBeTruthy();
            expect(within(col4).getByTestId('tile-rental')).toBeTruthy();
            expect(within(col4).getByTestId('tile-sales')).toBeTruthy();

            // UX User-Friendly Text Labels
            expect(view.getByText('Hours of\nService')).toBeTruthy();
            expect(view.getByText('Vehicle\nInspection')).toBeTruthy();
            expect(view.getByText('Drive\nRoutes')).toBeTruthy();
            expect(view.getByText('Documents')).toBeTruthy();
            expect(view.getByText('Machine\nProfile')).toBeTruthy();
            expect(view.getByText('Dispatch')).toBeTruthy();
            expect(view.getByText('Intake & Orders')).toBeTruthy();
            expect(view.getByText('Rental\nHandover')).toBeTruthy();
            expect(view.getByText('Sales\nDelivery')).toBeTruthy();

            // Tapping DVIR tile
            await fireEvent.press(view.getByTestId('tile-dvir'));
            expect(onOpenDvir).toHaveBeenCalled();

            // Tapping Routes tile
            await fireEvent.press(view.getByTestId('tile-routes'));
            expect(onOpenRoutes).toHaveBeenCalled();

            // Tapping Documents tile
            await fireEvent.press(view.getByTestId('tile-documents'));
            expect(onOpenDocs).toHaveBeenCalled();

            // Tapping Forms tile
            await fireEvent.press(view.getByTestId('tile-forms'));
            expect(onOpenForms).toHaveBeenCalled();

            // Tapping Rental tile
            await fireEvent.press(view.getByTestId('tile-rental'));
            expect(onOpenRental).toHaveBeenCalled();

            // Tapping Sales tile
            await fireEvent.press(view.getByTestId('tile-sales'));
            expect(onOpenSales).toHaveBeenCalled();
        });

        it('updates persistent duty status when confirmed via selector modal', async () => {
            const onChangeDutyStatus = jest.fn();

            const view = await render(
                <OperatorDashboardScreen
                    isLoading={false}
                    jobs={[mockJob]}
                    onChangeDutyStatus={onChangeDutyStatus}
                    onDiscardCommand={jest.fn()}
                    onLogout={jest.fn()}
                    onOpenDocuments={jest.fn()}
                    onOpenDvir={jest.fn()}
                    onOpenForms={jest.fn()}
                    onOpenRoutes={jest.fn()}
                    onOpenVehicle={jest.fn()}
                    onRefresh={jest.fn()}
                    onRetryCommand={jest.fn()}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        hoursElapsed: 4.5,
                    }}
                    userName="Alex Rivera"
                    userRole="Master Crane Rigger"
                />,
            );

            // Initially operating
            expect(view.getByText('On Duty — Crane Operating')).toBeTruthy();
            expect(view.getByText('OPR')).toBeTruthy();

            // Open duty modal by tapping persistent duty bar
            await fireEvent.press(view.getByTestId('hero-duty-status-bar'));
            expect(view.getByTestId('duty-status-sheet')).toBeTruthy();

            // Select Driving
            await fireEvent.press(view.getByTestId('duty-option-driving'));

            // Confirm
            await fireEvent.press(view.getByTestId('confirm-duty-status-btn'));
            expect(onChangeDutyStatus).toHaveBeenCalledWith(
                'driving',
                undefined,
                undefined,
            );

            // Verified immediate update on dashboard screen
            expect(view.getByText('On Duty — Driving / Transit')).toBeTruthy();
            expect(view.getByText('DRV')).toBeTruthy();
        });

        it('opens DispatchIntakeSheet from Dispatch tile to inspect orders and accept assignment', async () => {
            const onAccept = jest.fn();
            const onReject = jest.fn();
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
                <OperatorDashboardScreen
                    isLoading={false}
                    jobs={[pendingJob]}
                    onAcceptAssignment={onAccept}
                    onDiscardCommand={jest.fn()}
                    onLogout={jest.fn()}
                    onOpenDocuments={jest.fn()}
                    onOpenDvir={jest.fn()}
                    onOpenForms={onOpenForms}
                    onOpenRental={jest.fn()}
                    onOpenRoutes={jest.fn()}
                    onOpenSales={jest.fn()}
                    onOpenVehicle={jest.fn()}
                    onRefresh={jest.fn()}
                    onRejectAssignment={onReject}
                    onRetryCommand={jest.fn()}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        hoursElapsed: 4.5,
                    }}
                    userName="Alex Rivera"
                    userRole="Master Crane Rigger"
                />,
            );

            // Sublabel displayed on tile
            expect(view.getByText('Intake & Orders')).toBeTruthy();

            // Press Dispatch tile
            await fireEvent.press(view.getByTestId('tile-forms'));
            expect(onOpenForms).toHaveBeenCalled();

            // Sheet opens and displays pending assignment
            expect(view.getByTestId('dispatch-intake-sheet')).toBeTruthy();
            expect(view.getByText('Dispatch Intake & Orders')).toBeTruthy();
            expect(view.getByText('Needs Response (1)')).toBeTruthy();
            expect(view.getByTestId('dispatch-intake-job-202')).toBeTruthy();
            expect(view.getByTestId('accept-assignment-btn')).toBeTruthy();

            // Accept assignment
            await fireEvent.press(view.getByTestId('accept-assignment-btn'));
            expect(onAccept).toHaveBeenCalledWith(202, 77, 3);

            // Close sheet
            await fireEvent.press(
                view.getByTestId('close-dispatch-intake-btn'),
            );
            expect(view.queryByTestId('dispatch-intake-sheet')).toBeNull();
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

        it('renders 6 solid-color centered launcher tiles with user-friendly text', async () => {
            const onOpenHos = jest.fn();
            const onOpenDvir = jest.fn();
            const onOpenRoutes = jest.fn();
            const onOpenDocs = jest.fn();
            const onOpenVehicle = jest.fn();
            const onOpenRental = jest.fn();
            const onOpenSales = jest.fn();

            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    jobs={[mockJob]}
                    onOpenDocuments={onOpenDocs}
                    onOpenDvir={onOpenDvir}
                    onOpenHos={onOpenHos}
                    onOpenRental={onOpenRental}
                    onOpenRoutes={onOpenRoutes}
                    onOpenSales={onOpenSales}
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
            expect(view.getByText('Drive\nRoutes')).toBeTruthy();
            expect(view.getByText('Documents')).toBeTruthy();
            expect(view.getByText('Machine\nProfile')).toBeTruthy();
            expect(view.getByText('Dispatch')).toBeTruthy();
            expect(view.getByText('Intake & Orders')).toBeTruthy();
            expect(view.getByText('Rental\nHandover')).toBeTruthy();
            expect(view.getByText('Sales\nDelivery')).toBeTruthy();

            // Verify testIDs
            expect(view.getByTestId('tile-hos')).toBeTruthy();
            expect(view.getByTestId('tile-dvir')).toBeTruthy();
            expect(view.getByTestId('tile-routes')).toBeTruthy();
            expect(view.getByTestId('tile-documents')).toBeTruthy();
            expect(view.getByTestId('tile-vehicle')).toBeTruthy();
            expect(view.getByTestId('tile-forms')).toBeTruthy();
            const assignedRentalTile = view.getByTestId('tile-rental');
            const assignedSalesTile = view.getByTestId('tile-sales');
            expect(assignedRentalTile).toBeTruthy();
            expect(assignedSalesTile).toBeTruthy();
            expect(assignedRentalTile.props.style).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ backgroundColor: '#4F46E5' }),
                ]),
            );
            expect(assignedSalesTile.props.style).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ backgroundColor: '#E11D48' }),
                ]),
            );

            // 2x4 Column Layout Verification
            // Col 1: HOS (top) & Documents (bottom)
            // Col 2: Vehicle Inspection (top) & Machine Profile (bottom)
            // Col 3: Routes (top) & Dispatch Schedule (bottom)
            // Col 4: Rental Handover (top) & Sales Delivery (bottom)
            const assignedCol1 = view.getByTestId('tile-column-1');
            const assignedCol2 = view.getByTestId('tile-column-2');
            const assignedCol3 = view.getByTestId('tile-column-3');
            const assignedCol4 = view.getByTestId('tile-column-4');
            expect(within(assignedCol1).getByTestId('tile-hos')).toBeTruthy();
            expect(
                within(assignedCol1).getByTestId('tile-documents'),
            ).toBeTruthy();
            expect(within(assignedCol2).getByTestId('tile-dvir')).toBeTruthy();
            expect(
                within(assignedCol2).getByTestId('tile-vehicle'),
            ).toBeTruthy();
            expect(
                within(assignedCol3).getByTestId('tile-routes'),
            ).toBeTruthy();
            expect(within(assignedCol3).getByTestId('tile-forms')).toBeTruthy();
            expect(
                within(assignedCol4).getByTestId('tile-rental'),
            ).toBeTruthy();
            expect(within(assignedCol4).getByTestId('tile-sales')).toBeTruthy();

            // Tapping HOS opens HOS callback
            await fireEvent.press(view.getByTestId('tile-hos'));
            expect(onOpenHos).toHaveBeenCalled();

            // Tapping DVIR opens DVIR callback
            await fireEvent.press(view.getByTestId('tile-dvir'));
            expect(onOpenDvir).toHaveBeenCalled();

            // Tapping Routes opens Routes callback
            await fireEvent.press(view.getByTestId('tile-routes'));
            expect(onOpenRoutes).toHaveBeenCalled();

            // Tapping Documents opens Documents callback
            await fireEvent.press(view.getByTestId('tile-documents'));
            expect(onOpenDocs).toHaveBeenCalled();

            // Tapping Vehicle opens Vehicle callback
            await fireEvent.press(view.getByTestId('tile-vehicle'));
            expect(onOpenVehicle).toHaveBeenCalled();

            // Tapping Rental opens Rental callback
            await fireEvent.press(view.getByTestId('tile-rental'));
            expect(onOpenRental).toHaveBeenCalled();

            // Tapping Sales opens Sales callback
            await fireEvent.press(view.getByTestId('tile-sales'));
            expect(onOpenSales).toHaveBeenCalled();
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
                view.getByText('DPWH Special Heavy-Load Road Transit Permit'),
            ).toBeTruthy();
            expect(
                view.getByText(
                    'DOLE-OSHC 3rd-Party Annual Crane Load Test Certificate',
                ),
            ).toBeTruthy();

            // Filter by road permits
            await fireEvent.press(view.getByTestId('filter-road_permits'));
            expect(
                view.getByText('DPWH Special Heavy-Load Road Transit Permit'),
            ).toBeTruthy();

            // Open digital certificate modal
            await fireEvent.press(
                view.getByTestId('view-doc-btn-doc-permit-01'),
            );
            expect(view.getByTestId('certificate-modal')).toBeTruthy();
            expect(view.getByText('REPUBLIC OF THE PHILIPPINES')).toBeTruthy();
            expect(
                view.getAllByText('DPWH-NCR-2026-SP-8821').length,
            ).toBeGreaterThanOrEqual(1);
            expect(view.getByText('✓ Verified Compliance Record')).toBeTruthy();
        });
    });
});
