import { cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import '@testing-library/react-native/matchers';
import React from 'react';
import {
    ChangeUnitModal,
    EndShiftSafeguardModal,
    OnSiteConfirmationModal,
    PreTripDefectFallbackModal,
    ReliefHandoverModal,
} from '../components/index';
import { AssignedJobsListScreen } from '../screens/AssignedJobsListScreen';
import { HosScreen } from '../screens/HosScreen';
import { OperatorDashboardScreen } from '../screens/OperatorDashboardScreen';
import type { DispatchJob } from '../types/index';

describe('Mobile Lifecycle Modals & Operational Safeguards', () => {
    afterEach(async () => {
        await cleanup();
        jest.clearAllMocks();
    });

    const mockAcceptedJob: DispatchJob = {
        id: 101,
        reference: 'DISP-LIFECYCLE-101',
        title: 'C-5 Station Foundation Lift',
        status: {
            value: 'accepted',
            label: 'Accepted by Operator',
        },
        priority: {
            value: 'priority',
            label: 'Priority',
        },
        scheduled_start: '2026-09-04T08:00:00Z',
        site: 'C-5 Ortigas Ext. Northbound',
        client: 'Metro Manila Subway Consortium',
        version: 2,
        capabilities: {
            can_respond: true,
            can_update_status: true,
            can_share_location: true,
        },
        my_assignment: {
            id: 201,
            response_status: 'accepted',
            response_status_label: 'Accepted',
        },
        asset_assignments: [
            {
                id: 1,
                operational_asset_id: 101,
                asset_name: '100T Liebherr All-Terrain Crane',
                asset_code: 'CRN-101',
                asset_kind: 'crane',
            },
        ],
    };

    describe('OnSiteConfirmationModal', () => {
        it('prompts operator for physical arrival and confirms telemetry activation', async () => {
            const onConfirm = jest.fn();
            const onCancel = jest.fn();

            const view = await render(
                <OnSiteConfirmationModal
                    assetCode="CRN-101"
                    onCancel={onCancel}
                    onConfirm={onConfirm}
                    visible={true}
                />,
            );

            expect(view.getByTestId('on-site-confirmation-modal')).toBeTruthy();
            expect(view.getByText('Confirm Physical Arrival')).toBeTruthy();
            expect(
                view.getByText(/Are you physically at Unit.*CRN-101.*/),
            ).toBeTruthy();
            expect(
                view.getByText(
                    /Personal coordinates remain private during your commute/,
                ),
            ).toBeTruthy();

            await fireEvent.press(view.getByTestId('confirm-on-site-btn'));
            expect(onConfirm).toHaveBeenCalledTimes(1);

            await fireEvent.press(view.getByTestId('cancel-on-site-btn'));
            expect(onCancel).toHaveBeenCalledTimes(1);
        });
    });

    describe('EndShiftSafeguardModal', () => {
        it('intercepts shift end while linked to unit and confirms unbinding', async () => {
            const onConfirm = jest.fn();
            const onCancel = jest.fn();

            const view = await render(
                <EndShiftSafeguardModal
                    assetCode="CRN-101"
                    onCancel={onCancel}
                    onConfirmReleaseAndClockOut={onConfirm}
                    visible={true}
                />,
            );

            expect(view.getByTestId('end-shift-safeguard-modal')).toBeTruthy();
            expect(view.getByText('Active Equipment Warning')).toBeTruthy();
            expect(
                view.getByText(
                    /You are still linked to.*CRN-101.*Release unit and turn off tracking\?/,
                ),
            ).toBeTruthy();

            await fireEvent.press(view.getByTestId('confirm-safeguard-btn'));
            expect(onConfirm).toHaveBeenCalledTimes(1);

            await fireEvent.press(view.getByTestId('cancel-safeguard-btn'));
            expect(onCancel).toHaveBeenCalledTimes(1);
        });
    });

    describe('ChangeUnitModal', () => {
        it('allows selecting alternative physical machinery with override reason', async () => {
            const onConfirm = jest.fn();
            const onClose = jest.fn();

            const view = await render(
                <ChangeUnitModal
                    currentAssetCode="CRN-101"
                    onClose={onClose}
                    onConfirmUnitChange={onConfirm}
                    visible={true}
                />,
            );

            expect(view.getByTestId('change-unit-modal')).toBeTruthy();
            expect(view.getByText('Override Assigned Equipment')).toBeTruthy();
            expect(view.getByText('Currently assigned: CRN-101')).toBeTruthy();

            // Select CRN-102
            await fireEvent.press(view.getByTestId('unit-option-CRN-102'));
            await fireEvent.press(view.getByTestId('confirm-change-unit-btn'));

            expect(onConfirm).toHaveBeenCalledWith(
                'CRN-102',
                expect.stringContaining('Site supervisor reallocated unit'),
            );
        });

        it('allows typing a replacement machinery code directly into manual input', async () => {
            const onConfirm = jest.fn();
            const onClose = jest.fn();

            const view = await render(
                <ChangeUnitModal
                    currentAssetCode="CRN-101"
                    onClose={onClose}
                    onConfirmUnitChange={onConfirm}
                    visible={true}
                />,
            );

            expect(view.getByTestId('change-unit-code-input')).toBeTruthy();
            await fireEvent.changeText(
                view.getByTestId('change-unit-code-input'),
                'CRN-102',
            );
            await fireEvent.press(view.getByTestId('confirm-change-unit-btn'));

            expect(onConfirm).toHaveBeenCalledWith(
                'CRN-102',
                expect.any(String),
            );
        });
    });

    describe('PreTripDefectFallbackModal', () => {
        it('renders safety lockout alert, HoS On Duty preservation, and provides swap/standby actions', async () => {
            const onSwapUnit = jest.fn();
            const onStandby = jest.fn();
            const onClose = jest.fn();

            const view = await render(
                <PreTripDefectFallbackModal
                    assetCode="CRN-101"
                    onClose={onClose}
                    onStandby={onStandby}
                    onSwapUnit={onSwapUnit}
                    visible={true}
                />,
            );

            expect(
                view.getByTestId('pre-trip-defect-fallback-modal'),
            ).toBeTruthy();
            expect(
                view.getByText('SAFETY LOCKOUT · UnderMaintenance'),
            ).toBeTruthy();
            expect(view.getByText('Pre-Trip Safety Lockout')).toBeTruthy();
            expect(view.getByText(/CRN-101/)).toBeTruthy();
            expect(view.getByText(/You remain clocked in/)).toBeTruthy();
            expect(view.getByText('On Duty')).toBeTruthy();

            // Tap Swap / Link Replacement Unit
            await fireEvent.press(view.getByTestId('fallback-swap-unit-btn'));
            expect(onSwapUnit).toHaveBeenCalledTimes(1);

            // Tap Standby / Await Dispatch
            await fireEvent.press(view.getByTestId('fallback-standby-btn'));
            expect(onStandby).toHaveBeenCalledTimes(1);
        });
    });

    describe('ReliefHandoverModal (Smart Dual: 1-Tap Scheduled Push + 4-Digit PIN)', () => {
        it('supports 1-tap push notification dispatch for outgoing operator', async () => {
            const onPush = jest.fn();
            const onClose = jest.fn();

            const view = await render(
                <ReliefHandoverModal
                    assetCode="CRN-101"
                    handoverPin="8421"
                    mode="outgoing_offer"
                    onClose={onClose}
                    onInitiatePushHandover={onPush}
                    reliefOperatorName="Carlos Reyes (Night Shift)"
                    visible={true}
                />,
            );

            expect(view.getByTestId('relief-handover-modal')).toBeTruthy();
            expect(view.getByText('Equipment Hot-Seat Handover')).toBeTruthy();
            expect(view.getByText('Carlos Reyes (Night Shift)')).toBeTruthy();
            expect(view.getByText('8')).toBeTruthy();
            expect(view.getByText('4')).toBeTruthy();
            expect(view.getAllByText('2').length).toBeGreaterThanOrEqual(1);
            expect(view.getAllByText('1').length).toBeGreaterThanOrEqual(1);

            // Fire 1-tap push
            await fireEvent.press(view.getByTestId('send-push-handover-btn'));
            expect(onPush).toHaveBeenCalledTimes(1);
            expect(view.getByText('Handover Alert Sent!')).toBeTruthy();
        });

        it('supports 4-digit PIN entry for incoming operator claim', async () => {
            const onClaimWithPin = jest.fn();
            const onClose = jest.fn();

            const view = await render(
                <ReliefHandoverModal
                    assetCode="CRN-101"
                    mode="incoming_claim"
                    onClaimWithPin={onClaimWithPin}
                    onClose={onClose}
                    visible={true}
                />,
            );

            expect(view.getByText('Claim Equipment Handover')).toBeTruthy();
            const pinInput = view.getByTestId('handover-pin-input');
            await fireEvent.changeText(pinInput, '8421');
            await fireEvent.press(view.getByTestId('claim-pin-btn'));

            expect(onClaimWithPin).toHaveBeenCalledWith('8421');
        });
    });

    describe('AssignedJobsListScreen Lifecycle Integration', () => {
        it('renders DOLE 9.0h warning banner and allows triggering relief handover', async () => {
            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    jobs={[mockAcceptedJob]}
                    onRefresh={jest.fn()}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        startedAt: '06:00 AM',
                        hoursElapsed: 9.2,
                        limitCounterMinutes: 552,
                        doleWarning: true,
                    }}
                />,
            );

            expect(view.getByTestId('dole-shift-limit-banner')).toBeTruthy();
            expect(
                view.getByText(
                    'Approaching 10h Operating Limit — Prepare for Handover or Shift Closure.',
                ),
            ).toBeTruthy();

            // Press Relief Handover button in banner
            await fireEvent.press(
                view.getByTestId('dole-handover-trigger-btn'),
            );
            expect(view.getByTestId('relief-handover-modal')).toBeTruthy();
        });

        it('renders assigned vehicle card locked to dispatch assignment without self-serve unit change button', async () => {
            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    jobs={[mockAcceptedJob]}
                    onRefresh={jest.fn()}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                />,
            );

            expect(view.getByTestId('hero-vehicle-card')).toBeTruthy();
            expect(view.getByText('CRN-101')).toBeTruthy();
            expect(view.getByText('ASSIGNED VEHICLE')).toBeTruthy();
            expect(
                view.queryByTestId('vehicle-card-change-unit-btn'),
            ).toBeNull();
        });

        it('keeps delay evidence visible when the parent cannot enqueue it', async () => {
            const onReportDelay = jest
                .fn()
                .mockRejectedValue(new Error('Outbox unavailable.'));

            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    jobs={[mockAcceptedJob]}
                    onRefresh={jest.fn()}
                    onReportDelay={onReportDelay}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                />,
            );

            await fireEvent.press(view.getByTestId('report-delay-btn-101'));
            await fireEvent.press(
                view.getByTestId('delay-reason-site_not_ready'),
            );
            await fireEvent.press(view.getByTestId('submit-delay-btn'));

            expect(onReportDelay).toHaveBeenCalledTimes(1);
            expect(view.getByTestId('report-delay-modal')).toBeTruthy();
            expect(view.getByText('Outbox unavailable.')).toBeTruthy();
        });

        it('renders I am On Site button on accepted jobs and triggers OnSiteConfirmationModal', async () => {
            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    jobs={[mockAcceptedJob]}
                    onRefresh={jest.fn()}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                />,
            );

            expect(view.getByTestId('start-unit-on-site-btn')).toBeTruthy();
            await fireEvent.press(view.getByTestId('start-unit-on-site-btn'));
            expect(view.getByTestId('on-site-confirmation-modal')).toBeTruthy();
        });

        it('transitions from "I\'m On Site" button to "Start Pre-Trip DVIR Inspection" CTA after confirming link', async () => {
            const onLinkUnit = jest.fn();
            const onOpenDvir = jest.fn();

            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    jobs={[mockAcceptedJob]}
                    onLinkUnit={onLinkUnit}
                    onOpenDvir={onOpenDvir}
                    onRefresh={jest.fn()}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                />,
            );

            // Step 1: Unlinked state shows "I'm On Site" button, and pre-trip CTA does not exist yet
            expect(view.getByTestId('start-unit-on-site-btn')).toBeTruthy();
            expect(
                view.getByText("I'm On Site — Start Unit (CRN-101)"),
            ).toBeTruthy();
            expect(view.queryByTestId('dvir-pending-banner')).toBeNull();
            expect(view.queryByTestId('start-pre-trip-dvir-btn')).toBeNull();

            // Step 2: Tap "I'm On Site" to open confirmation modal
            await fireEvent.press(view.getByTestId('start-unit-on-site-btn'));
            expect(view.getByTestId('on-site-confirmation-modal')).toBeTruthy();

            // Step 3: Confirm physical arrival
            await fireEvent.press(view.getByTestId('confirm-on-site-btn'));
            expect(onLinkUnit).toHaveBeenCalledWith('CRN-101');

            // Step 4: Verify "I'm On Site" button is GONE and replaced by Pre-Trip banner + CTA
            expect(view.queryByTestId('start-unit-on-site-btn')).toBeNull();
            expect(view.getByTestId('dvir-pending-banner')).toBeTruthy();
            expect(view.getByText('PRE-TRIP PENDING')).toBeTruthy();
            expect(
                view.getByText(
                    'Pre-trip walkaround inspection is required before operation.',
                ),
            ).toBeTruthy();
            expect(view.getByTestId('start-pre-trip-dvir-btn')).toBeTruthy();

            // Step 5: Tapping "Start Pre-Trip DVIR Inspection" CTA calls onOpenDvir
            await fireEvent.press(view.getByTestId('start-pre-trip-dvir-btn'));
            expect(onOpenDvir).toHaveBeenCalledTimes(1);
        });

        it('transitions to Operating / Drive Mode and telemetry controls when pre-trip DVIR has passed', async () => {
            const onOpenRoutes = jest.fn();
            const onToggleLocationSharing = jest.fn();
            const onReleaseUnit = jest.fn();

            const view = await render(
                <AssignedJobsListScreen
                    dvirStatus="cleared"
                    isLoading={false}
                    isUnitLinked={true}
                    jobs={[mockAcceptedJob]}
                    locationSharingActive={true}
                    onOpenRoutes={onOpenRoutes}
                    onRefresh={jest.fn()}
                    onReleaseUnit={onReleaseUnit}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    onToggleLocationSharing={onToggleLocationSharing}
                    outboxCommands={[]}
                />,
            );

            // Unlinked and pre-trip pending buttons are not rendered
            expect(view.queryByTestId('start-unit-on-site-btn')).toBeNull();
            expect(view.queryByTestId('dvir-pending-banner')).toBeNull();
            expect(view.queryByTestId('start-pre-trip-dvir-btn')).toBeNull();

            // Operating container and active badge are rendered
            expect(view.getByTestId('operating-mode-container')).toBeTruthy();
            expect(view.getByText('UNIT IN SERVICE · ACTIVE')).toBeTruthy();
            expect(view.getByTestId('operating-drive-mode-btn')).toBeTruthy();

            // Tap Drive Mode
            await fireEvent.press(view.getByTestId('operating-drive-mode-btn'));
            expect(onOpenRoutes).toHaveBeenCalledTimes(1);

            // Tap Pause Telemetry
            const pauseBtn = view.getByTestId(
                'quick-action-pause-telemetry-btn',
            );
            expect(view.getByText('Pause Telemetry')).toBeTruthy();
            await fireEvent.press(pauseBtn);
            expect(onToggleLocationSharing).toHaveBeenCalledTimes(1);

            // Tap Release Unit
            await fireEvent.press(
                view.getByTestId('quick-action-release-unit-btn'),
            );
            expect(onReleaseUnit).toHaveBeenCalledWith('CRN-101');
        });

        it('renders pre-trip defect lockout fallback banner, allows unit swap to CRN-102 and standby transition', async () => {
            const onSwapUnit = jest.fn();
            const onChangeDutyStatus = jest.fn();

            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    isUnitLinked={true}
                    jobs={[mockAcceptedJob]}
                    onChangeDutyStatus={onChangeDutyStatus}
                    onRefresh={jest.fn()}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    onSwapUnit={onSwapUnit}
                    outboxCommands={[]}
                    preTripDefectLockout={true}
                />,
            );

            // Lockout banner renders with UnderMaintenance alert and unbind notice
            expect(
                view.getByTestId('pre-trip-defect-lockout-banner'),
            ).toBeTruthy();
            expect(
                view.getByText('SAFETY LOCKOUT · UnderMaintenance'),
            ).toBeTruthy();
            expect(
                view.getByText(
                    'Critical defect detected during pre-trip inspection. Telemetry unbound. Operator remains On Duty.',
                ),
            ).toBeTruthy();
            expect(view.queryByTestId('start-unit-on-site-btn')).toBeNull();
            expect(view.queryByTestId('operating-drive-mode-btn')).toBeNull();

            // Test Option A: Swap replacement unit to CRN-102
            await fireEvent.press(view.getByTestId('fallback-swap-unit-btn'));
            expect(view.getByTestId('change-unit-modal')).toBeTruthy();

            // Select CRN-102 in ChangeUnitModal and confirm
            await fireEvent.press(view.getByTestId('unit-option-CRN-102'));
            await fireEvent.press(view.getByTestId('confirm-change-unit-btn'));

            expect(onSwapUnit).toHaveBeenCalledWith(
                'CRN-102',
                expect.any(String),
            );

            // UI transitions to fresh pre-trip pending state for CRN-102
            expect(
                view.queryByTestId('pre-trip-defect-lockout-banner'),
            ).toBeNull();
            expect(view.getByTestId('dvir-pending-banner')).toBeTruthy();
            expect(view.getAllByText('CRN-102').length).toBeGreaterThanOrEqual(
                1,
            );
            expect(view.getByTestId('start-pre-trip-dvir-btn')).toBeTruthy();
        });

        it('switches to standby from pre-trip defect lockout banner preserving operator On Duty status', async () => {
            const onChangeDutyStatus = jest.fn();

            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    isUnitLinked={true}
                    jobs={[mockAcceptedJob]}
                    onChangeDutyStatus={onChangeDutyStatus}
                    onRefresh={jest.fn()}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                    preTripDefectLockout={true}
                />,
            );

            expect(
                view.getByTestId('pre-trip-defect-lockout-banner'),
            ).toBeTruthy();

            // Press Standby / Await Dispatch
            await fireEvent.press(view.getByTestId('fallback-standby-btn'));
            expect(onChangeDutyStatus).toHaveBeenCalledWith(
                'standby',
                'mechanical_inspection',
                'Pre-trip DVIR defect lockout',
            );
            // Duty status bar immediately reflects standby
            expect(view.getByText('SBY')).toBeTruthy();
            expect(view.getByText('On Duty — Standby / Delay')).toBeTruthy();
        });

        it('allows tapping the defect lockout banner header to open PreTripDefectFallbackModal and dismissing it', async () => {
            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    isUnitLinked={true}
                    jobs={[mockAcceptedJob]}
                    onRefresh={jest.fn()}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    outboxCommands={[]}
                    preTripDefectLockout={true}
                />,
            );

            expect(
                view.getByTestId('pre-trip-defect-lockout-banner'),
            ).toBeTruthy();
            expect(
                view.queryByTestId('pre-trip-defect-fallback-modal'),
            ).toBeNull();

            // Tap banner header to inspect lockout details modal
            await fireEvent.press(
                view.getByTestId('view-defect-lockout-details-btn'),
            );
            expect(
                view.getByTestId('pre-trip-defect-fallback-modal'),
            ).toBeTruthy();
            expect(view.getByText('Pre-Trip Safety Lockout')).toBeTruthy();

            // Dismiss modal
            await fireEvent.press(view.getByTestId('close-fallback-modal-btn'));
            expect(
                view.queryByTestId('pre-trip-defect-fallback-modal'),
            ).toBeNull();
        });

        it('filters currentAssetCode out from replacement options in ChangeUnitModal', async () => {
            const view = await render(
                <ChangeUnitModal
                    currentAssetCode="CRN-102"
                    onClose={jest.fn()}
                    onConfirmUnitChange={jest.fn()}
                    visible={true}
                />,
            );

            // CRN-102 should be filtered out from replacement list because it is the currently defective unit
            expect(view.queryByTestId('unit-option-CRN-102')).toBeNull();
            expect(view.getByTestId('unit-option-CRN-103')).toBeTruthy();
            expect(view.getByTestId('unit-option-CRN-201')).toBeTruthy();
        });

        it('intercepts off_duty selection from DutyStatusSelectorModal with EndShiftSafeguardModal when linked to an active unit', async () => {
            const onChangeDutyStatus = jest.fn();
            const onToggleShift = jest.fn();
            const onReleaseUnit = jest.fn();

            const view = await render(
                <AssignedJobsListScreen
                    isLoading={false}
                    jobs={[mockAcceptedJob]}
                    onChangeDutyStatus={onChangeDutyStatus}
                    onRefresh={jest.fn()}
                    onReleaseUnit={onReleaseUnit}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    onToggleShift={onToggleShift}
                    outboxCommands={[]}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        startedAt: '08:00 AM',
                        hoursElapsed: 5.0,
                    }}
                />,
            );

            // Open DutyStatusSelectorModal via persistent duty status bar
            await fireEvent.press(view.getByTestId('hero-duty-status-bar'));
            expect(view.getByTestId('duty-status-sheet')).toBeTruthy();

            // Select off_duty
            await fireEvent.press(
                view.getByLabelText(/Off Duty — Shift Complete/i),
            );

            // Confirm selection
            await fireEvent.press(view.getByTestId('confirm-duty-status-btn'));

            // EndShiftSafeguardModal should appear immediately because linked to asset
            expect(view.getByTestId('end-shift-safeguard-modal')).toBeTruthy();
            expect(view.getByText(/You are still linked to/i)).toBeTruthy();
            expect(onChangeDutyStatus).not.toHaveBeenCalled();
            expect(onToggleShift).not.toHaveBeenCalled();
            expect(onReleaseUnit).not.toHaveBeenCalled();

            // When cancelling, shift is not ended
            await fireEvent.press(view.getByTestId('cancel-safeguard-btn'));
            expect(view.queryByTestId('end-shift-safeguard-modal')).toBeNull();
            expect(onChangeDutyStatus).not.toHaveBeenCalled();
            expect(onToggleShift).not.toHaveBeenCalled();
            expect(onReleaseUnit).not.toHaveBeenCalled();

            // Reopen and confirm release
            await fireEvent.press(view.getByTestId('hero-duty-status-bar'));
            await fireEvent.press(
                view.getByLabelText(/Off Duty — Shift Complete/i),
            );
            await fireEvent.press(view.getByTestId('confirm-duty-status-btn'));
            expect(view.getByTestId('end-shift-safeguard-modal')).toBeTruthy();

            await fireEvent.press(view.getByTestId('confirm-safeguard-btn'));
            expect(onReleaseUnit).toHaveBeenCalledWith('CRN-101');
            expect(onToggleShift).toHaveBeenCalledWith('off_shift');
            expect(onChangeDutyStatus).toHaveBeenCalledWith(
                'off_duty',
                undefined,
                undefined,
            );
        });

        it('intercepts off_duty selection in OperatorDashboardScreen with EndShiftSafeguardModal and releases unit on confirmation', async () => {
            const onChangeDutyStatus = jest.fn();
            const onToggleShift = jest.fn();
            const onReleaseUnit = jest.fn();

            const view = await render(
                <OperatorDashboardScreen
                    isLoading={false}
                    jobs={[mockAcceptedJob]}
                    onChangeDutyStatus={onChangeDutyStatus}
                    onDiscardCommand={jest.fn()}
                    onLogout={jest.fn()}
                    onOpenDocuments={jest.fn()}
                    onOpenDvir={jest.fn()}
                    onOpenForms={jest.fn()}
                    onOpenRental={jest.fn()}
                    onOpenRoutes={jest.fn()}
                    onOpenSales={jest.fn()}
                    onOpenVehicle={jest.fn()}
                    onRefresh={jest.fn()}
                    onReleaseUnit={onReleaseUnit}
                    onRetryCommand={jest.fn()}
                    onSelectJob={jest.fn()}
                    onSosHoldComplete={jest.fn()}
                    onToggleShift={onToggleShift}
                    outboxCommands={[]}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        startedAt: '08:00 AM',
                        hoursElapsed: 4.5,
                    }}
                />,
            );

            // Open duty modal by tapping persistent duty bar
            await fireEvent.press(view.getByTestId('hero-duty-status-bar'));
            expect(view.getByTestId('duty-status-sheet')).toBeTruthy();

            // Select Off Duty
            await fireEvent.press(
                view.getByLabelText(/Off Duty — Shift Complete/i),
            );

            // Confirm duty selection
            await fireEvent.press(view.getByTestId('confirm-duty-status-btn'));

            // Intercept modal prompts
            expect(view.getByTestId('end-shift-safeguard-modal')).toBeTruthy();
            expect(onReleaseUnit).not.toHaveBeenCalled();
            expect(onToggleShift).not.toHaveBeenCalled();
            expect(onChangeDutyStatus).not.toHaveBeenCalled();

            // Confirm release
            await fireEvent.press(view.getByTestId('confirm-safeguard-btn'));
            expect(onReleaseUnit).toHaveBeenCalledWith('CRN-101');
            expect(onToggleShift).toHaveBeenCalledWith('off_shift');
            expect(onChangeDutyStatus).toHaveBeenCalledWith(
                'off_duty',
                undefined,
                undefined,
            );
        });
    });

    describe('HosScreen DOLE & Safeguard Integration', () => {
        it('displays DOLE warning banner and intercepts off-duty transition with safeguard modal', async () => {
            const onUpdateDutyStatus = jest.fn();

            const view = await render(
                <HosScreen
                    linkedAssetCode="CRN-101"
                    onUpdateDutyStatus={onUpdateDutyStatus}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        startedAt: '06:00 AM',
                        hoursElapsed: 9.5,
                        limitCounterMinutes: 570,
                        doleWarning: true,
                    }}
                />,
            );

            // Verify DOLE 9.0h warning
            expect(view.getByTestId('dole-shift-limit-banner')).toBeTruthy();
            expect(
                view.getByText(
                    'Approaching 10h Operating Limit — Prepare for Handover or Shift Closure.',
                ),
            ).toBeTruthy();

            // Select Off Duty
            await fireEvent.press(view.getByTestId('duty-option-off_duty'));

            // Click Update & Certify Duty Status
            await fireEvent.press(view.getByTestId('confirm-hos-btn'));

            // Intercept modal should appear
            expect(view.getByTestId('end-shift-safeguard-modal')).toBeTruthy();
            expect(onUpdateDutyStatus).not.toHaveBeenCalled();

            // Confirm release in modal
            await fireEvent.press(view.getByTestId('confirm-safeguard-btn'));
            expect(onUpdateDutyStatus).toHaveBeenCalledWith(
                'off_duty',
                undefined,
                undefined,
            );
        });

        it('provides a compliant End Shift / Clock Out flow guarded by EndShiftSafeguardModal', async () => {
            const onUpdateDutyStatus = jest.fn();
            const onReleaseUnit = jest.fn();
            const onToggleShift = jest.fn();
            const onEndShift = jest.fn();

            const view = await render(
                <HosScreen
                    linkedAssetCode="CRN-101"
                    onEndShift={onEndShift}
                    onReleaseUnit={onReleaseUnit}
                    onToggleShift={onToggleShift}
                    onUpdateDutyStatus={onUpdateDutyStatus}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        startedAt: '08:00 AM',
                        hoursElapsed: 4.5,
                    }}
                />,
            );

            // Dedicated End Shift / Clock Out section is visible
            expect(view.getByTestId('hos-end-shift-card')).toBeTruthy();
            expect(view.getByText('END SHIFT & CLOCK OUT')).toBeTruthy();
            expect(view.getByText('Linked Equipment: CRN-101')).toBeTruthy();

            // Tap End Shift & Clock Out button
            const endShiftBtn = view.getByTestId('hos-end-shift-btn');
            await fireEvent.press(endShiftBtn);

            // Intercepted by EndShiftSafeguardModal
            expect(view.getByTestId('end-shift-safeguard-modal')).toBeTruthy();
            expect(onReleaseUnit).not.toHaveBeenCalled();
            expect(onUpdateDutyStatus).not.toHaveBeenCalled();

            // Cancel
            await fireEvent.press(view.getByTestId('cancel-safeguard-btn'));
            expect(view.queryByTestId('end-shift-safeguard-modal')).toBeNull();
            expect(onReleaseUnit).not.toHaveBeenCalled();

            // Tap again and confirm release
            await fireEvent.press(view.getByTestId('hos-end-shift-btn'));
            await fireEvent.press(view.getByTestId('confirm-safeguard-btn'));

            expect(onReleaseUnit).toHaveBeenCalledWith('CRN-101');
            expect(onUpdateDutyStatus).toHaveBeenCalledWith(
                'off_duty',
                undefined,
                undefined,
            );
            expect(onToggleShift).toHaveBeenCalledWith('off_shift');
            expect(onEndShift).toHaveBeenCalled();
            expect(view.getByTestId('shift-completed-notice')).toBeTruthy();
        });

        it('ends shift directly without safeguard modal in HosScreen when linkedAssetCode is null', async () => {
            const onUpdateDutyStatus = jest.fn();
            const onToggleShift = jest.fn();
            const onEndShift = jest.fn();

            const view = await render(
                <HosScreen
                    linkedAssetCode={null}
                    onEndShift={onEndShift}
                    onToggleShift={onToggleShift}
                    onUpdateDutyStatus={onUpdateDutyStatus}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        startedAt: '08:00 AM',
                        hoursElapsed: 4.5,
                    }}
                />,
            );

            // Linked asset pill is not rendered when null
            expect(view.queryByText(/Linked Equipment:/i)).toBeNull();

            // Press End Shift & Clock Out
            await fireEvent.press(view.getByTestId('hos-end-shift-btn'));

            // No modal appears; completes directly
            expect(view.queryByTestId('end-shift-safeguard-modal')).toBeNull();
            expect(onUpdateDutyStatus).toHaveBeenCalledWith(
                'off_duty',
                undefined,
                undefined,
            );
            expect(onToggleShift).toHaveBeenCalledWith('off_shift');
            expect(onEndShift).toHaveBeenCalled();
            expect(view.getByTestId('shift-completed-notice')).toBeTruthy();
        });

        it('ends shift directly without safeguard modal in HosScreen when confirming off_duty from duty options and linkedAssetCode is null', async () => {
            const onUpdateDutyStatus = jest.fn();
            const onToggleShift = jest.fn();
            const onEndShift = jest.fn();

            const view = await render(
                <HosScreen
                    linkedAssetCode={null}
                    onEndShift={onEndShift}
                    onToggleShift={onToggleShift}
                    onUpdateDutyStatus={onUpdateDutyStatus}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        startedAt: '08:00 AM',
                        hoursElapsed: 4.5,
                    }}
                />,
            );

            // Select Off Duty
            await fireEvent.press(view.getByTestId('duty-option-off_duty'));

            // Click Update & Certify Duty Status
            await fireEvent.press(view.getByTestId('confirm-hos-btn'));

            // No modal appears; completes directly
            expect(view.queryByTestId('end-shift-safeguard-modal')).toBeNull();
            expect(onUpdateDutyStatus).toHaveBeenCalledWith(
                'off_duty',
                undefined,
                undefined,
            );
            expect(onToggleShift).toHaveBeenCalledWith('off_shift');
            expect(onEndShift).toHaveBeenCalled();
        });
    });
});
