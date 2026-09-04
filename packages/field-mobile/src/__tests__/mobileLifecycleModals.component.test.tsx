import { cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import '@testing-library/react-native/matchers';
import React from 'react';
import {
    ChangeUnitModal,
    EndShiftSafeguardModal,
    OnSiteConfirmationModal,
    ReliefHandoverModal,
} from '../components/index';
import { AssignedJobsListScreen } from '../screens/AssignedJobsListScreen';
import { HosScreen } from '../screens/HosScreen';
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

        it('renders [ Change Unit ] button and opens ChangeUnitModal', async () => {
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

            expect(
                view.getByTestId('vehicle-card-change-unit-btn'),
            ).toBeTruthy();
            await fireEvent.press(
                view.getByTestId('vehicle-card-change-unit-btn'),
            );
            expect(view.getByTestId('change-unit-modal')).toBeTruthy();
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
    });
});
