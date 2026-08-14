import { cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import React from 'react';
import { CraneSetupSafetyCard } from '../components/cards/CraneSetupSafetyCard';
import { HeavyCraneDriveModeModal } from '../components/cards/HeavyCraneDriveModeModal';
import { ParkedSecuredCard } from '../components/cards/ParkedSecuredCard';
import {
    FuelReceiptTab,
    HandoverTab,
    InspectionChecklistTab,
    MaintenanceWorkOrderTab,
    SafeReleaseTab,
} from '../components/inspection';
import { EquipmentInspectionScreen } from '../screens/EquipmentInspectionScreen';
import type {
    ParkedSecuredChecklist,
    TechnicianInspectionCheck,
} from '../types/index';

describe('Native Field Workflows Component Tests', () => {
    afterEach(async () => {
        await cleanup();
    });

    describe('HeavyCraneDriveModeModal', () => {
        it('renders large glanceable metrics, corridor guidance, and arrival confirmation', async () => {
            const onArrived = jest.fn();
            const onClose = jest.fn();

            const view = await render(
                <HeavyCraneDriveModeModal
                    assetLabel="CRN-07 · 50t Mobile Crane"
                    destination="North Processing Plant"
                    distanceLabel="6.2 km"
                    etaLabel="14 min"
                    jobReference="DISP-9901"
                    onArrived={onArrived}
                    onClose={onClose}
                    siteEntrance="Gate 3"
                    stagingPoint="Pad 2"
                    visible={true}
                />,
            );

            expect(view.getByText('HEAVY CRANE DRIVE MODE')).toBeTruthy();
            expect(view.getByText('14 min')).toBeTruthy();
            expect(view.getByText('6.2 km')).toBeTruthy();
            expect(view.getByText('Gate 3')).toBeTruthy();
            expect(view.getByText('Pad 2')).toBeTruthy();
            expect(view.getByText(/Bridge clearance/)).toBeTruthy();

            // Trigger delay options
            await fireEvent.press(view.getByTestId('report-delay-trigger-btn'));
            await fireEvent.press(
                view.getByText('Heavy traffic / escort delay'),
            );
            expect(
                view.getByText('✓ Delay reported to Dispatch:'),
            ).toBeTruthy();

            // Arrival tap (triggers onArrived and automatically closes)
            await fireEvent.press(view.getByTestId('drive-mode-arrived-btn'));
            expect(onArrived).toHaveBeenCalledTimes(1);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('allows exiting drive mode via close button', async () => {
            const onClose = jest.fn();

            const view = await render(
                <HeavyCraneDriveModeModal
                    assetLabel="CRN-07 · 50t Mobile Crane"
                    destination="North Processing Plant"
                    distanceLabel="6.2 km"
                    etaLabel="14 min"
                    jobReference="DISP-9901"
                    onArrived={jest.fn()}
                    onClose={onClose}
                    siteEntrance="Gate 3"
                    stagingPoint="Pad 2"
                    visible={true}
                />,
            );

            await fireEvent.press(view.getByTestId('exit-drive-mode-btn'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('ParkedSecuredCard', () => {
        it('requires explicit confirmation before exposing crane setup', async () => {
            const onConfirm = jest.fn();

            const view = await render(
                <ParkedSecuredCard
                    isArrived={true}
                    onConfirm={onConfirm}
                    state={null}
                />,
            );

            expect(
                view.getByText('Parked & Secured Confirmation'),
            ).toBeTruthy();
            expect(view.getByText('ACTION REQUIRED UPON ARRIVAL')).toBeTruthy();

            // Toggle all 4 checklist items
            await fireEvent.press(view.getByTestId('parked-check-brake'));
            await fireEvent.press(view.getByTestId('parked-check-chocks'));
            await fireEvent.press(view.getByTestId('parked-check-beacons'));
            await fireEvent.press(view.getByTestId('parked-check-surface'));

            // Press confirm button
            await fireEvent.press(
                view.getByTestId('confirm-parked-secured-btn'),
            );
            expect(onConfirm).toHaveBeenCalledTimes(1);
            expect(onConfirm).toHaveBeenCalledWith({
                parkingBrakeEngaged: true,
                wheelChocksDeployed: true,
                hazardBeaconsActive: true,
                surfaceAssessed: true,
            });
        });

        it('shows verified state when state is already confirmed', async () => {
            const confirmedChecklist: ParkedSecuredChecklist = {
                parkingBrakeEngaged: true,
                wheelChocksDeployed: true,
                hazardBeaconsActive: true,
                surfaceAssessed: true,
            };

            const view = await render(
                <ParkedSecuredCard
                    isArrived={true}
                    onConfirm={jest.fn()}
                    state={{
                        isConfirmed: true,
                        confirmedAt: '2026-08-15T01:00:00Z',
                        confirmedBy: 'Marcus Operator',
                        checklist: confirmedChecklist,
                    }}
                />,
            );

            expect(view.getByText('SAFETY VERIFIED')).toBeTruthy();
            expect(
                view.getByText('Parked & Secured Confirmation'),
            ).toBeTruthy();
        });
    });

    describe('CraneSetupSafetyCard', () => {
        it('renders site map, hazard identification, and blocking checklist', async () => {
            const onVerifySetup = jest.fn();

            const view = await render(
                <CraneSetupSafetyCard
                    isCraneAsset={true}
                    isParkedAndSecured={true}
                    onVerifySetup={onVerifySetup}
                    state={null}
                />,
            );

            expect(
                view.getByText('Setup & Exclusion Zone Verification'),
            ).toBeTruthy();
            expect(view.getByText('15m Exclusion Zone')).toBeTruthy();
            expect(
                view.getByText('Overhead 13.8kV Distribution Line'),
            ).toBeTruthy();

            // Mitigate hazard
            await fireEvent.press(
                view.getByTestId('hazard-item-hazard-powerlines'),
            );

            // Complete blocking checklist
            await fireEvent.press(view.getByTestId('setup-check-ground'));
            await fireEvent.press(view.getByTestId('setup-check-outriggers'));
            await fireEvent.press(view.getByTestId('setup-check-level'));
            await fireEvent.press(view.getByTestId('setup-check-powerline'));
            await fireEvent.press(view.getByTestId('setup-check-barricade'));
            await fireEvent.press(view.getByTestId('setup-check-wind'));

            // Unlock crane operation
            await fireEvent.press(view.getByTestId('verify-crane-setup-btn'));
            expect(onVerifySetup).toHaveBeenCalledTimes(1);
        });
    });

    describe('Equipment Inspection Tabs', () => {
        it('renders and toggles inspection checklist items', async () => {
            const onSave = jest.fn();
            const onToggle = jest.fn();
            const sampleChecks: TechnicianInspectionCheck[] = [
                {
                    id: 'hyd-01',
                    category: 'hydraulics',
                    label: 'Hydraulic cylinders & outrigger rams',
                    status: 'good',
                    statusLabel: 'Pass · No leaks',
                    icon: '💧',
                },
            ];

            const view = await render(
                <InspectionChecklistTab
                    checks={sampleChecks}
                    isSaved={false}
                    onSaveInspection={onSave}
                    onToggleCheck={onToggle}
                />,
            );

            expect(
                view.getByText('Hydraulic cylinders & outrigger rams'),
            ).toBeTruthy();
            await fireEvent.press(view.getByTestId('check-item-hyd-01'));
            expect(onToggle).toHaveBeenCalledWith('hyd-01');

            await fireEvent.press(view.getByTestId('save-inspection-btn'));
            expect(onSave).toHaveBeenCalledTimes(1);
        });

        it('logs maintenance work orders with severity and defect details', async () => {
            const onLog = jest.fn();
            const view = await render(
                <MaintenanceWorkOrderTab
                    assetCode="CRN-07"
                    assetName="50t Crane"
                    onLogWorkOrder={onLog}
                    technicianName="Alex Rivera"
                    workOrders={[]}
                />,
            );

            expect(
                view.getByText('Log Maintenance Defect / Work Order'),
            ).toBeTruthy();
            await fireEvent.changeText(
                view.getByTestId('wo-title-input'),
                'Stabilizer leak',
            );
            await fireEvent.changeText(
                view.getByTestId('wo-desc-input'),
                'Replace seal kit',
            );
            await fireEvent.press(view.getByTestId('submit-work-order-btn'));

            expect(onLog).toHaveBeenCalledTimes(1);
            expect(onLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    assetCode: 'CRN-07',
                    defectTitle: 'Stabilizer leak',
                    description: 'Replace seal kit',
                    severity: 'minor',
                }),
            );
        });

        it('certifies safe release post-repair', async () => {
            const onRelease = jest.fn();
            const view = await render(
                <SafeReleaseTab
                    assetCode="CRN-07"
                    assetName="50t Crane"
                    onSafeRelease={onRelease}
                    technicianName="Alex Rivera"
                />,
            );

            expect(
                view.getByText('Safe-Release Post-Repair Verification'),
            ).toBeTruthy();
            await fireEvent.press(view.getByTestId('certify-safe-release-btn'));

            expect(onRelease).toHaveBeenCalledTimes(1);
            expect(onRelease).toHaveBeenCalledWith(
                expect.objectContaining({
                    isCertifiedSafe: true,
                    certifiedBy: 'Alex Rivera',
                }),
            );
        });

        it('records fuel receipts and consumption', async () => {
            const onFuel = jest.fn();
            const view = await render(
                <FuelReceiptTab
                    assetCode="CRN-07"
                    fuelLogs={[]}
                    onLogFuelReceipt={onFuel}
                />,
            );

            expect(
                view.getByText('Fuel Receipt & Dispense Logging'),
            ).toBeTruthy();
            await fireEvent.changeText(
                view.getByTestId('fuel-liters-input'),
                '220',
            );
            await fireEvent.changeText(
                view.getByTestId('fuel-cost-input'),
                '440.00',
            );
            await fireEvent.changeText(
                view.getByTestId('fuel-receipt-input'),
                'RCPT-8812',
            );
            await fireEvent.press(view.getByTestId('log-fuel-btn'));

            expect(onFuel).toHaveBeenCalledTimes(1);
            expect(onFuel).toHaveBeenCalledWith(
                expect.objectContaining({
                    quantityLiters: 220,
                    fuelCost: 440,
                    receiptNumber: 'RCPT-8812',
                }),
            );
        });

        it('completes technician to operator handover', async () => {
            const onHandover = jest.fn();
            const view = await render(
                <HandoverTab
                    assetCode="CRN-07"
                    onCompleteHandover={onHandover}
                    technicianName="Alex Rivera"
                />,
            );

            expect(
                view.getByText('Technician Asset Handover Sign-Off'),
            ).toBeTruthy();
            await fireEvent.changeText(
                view.getByTestId('handover-recipient-input'),
                'Marcus Vance',
            );
            await fireEvent.press(view.getByTestId('confirm-handover-btn'));

            expect(onHandover).toHaveBeenCalledTimes(1);
            expect(onHandover).toHaveBeenCalledWith(
                expect.objectContaining({
                    assetCode: 'CRN-07',
                    technicianName: 'Alex Rivera',
                    recipientName: 'Marcus Vance',
                    conditionRating: 'excellent',
                    signatureConfirmed: true,
                }),
            );
        });

        it('renders full EquipmentInspectionScreen and switches tabs', async () => {
            const view = await render(
                <EquipmentInspectionScreen
                    assetCode="CRN-07"
                    assetName="50-Ton Mobile All-Terrain Crane"
                    technicianName="Alex Rivera"
                />,
            );

            expect(view.getByText('FIELD TECHNICIAN WORKFLOW')).toBeTruthy();
            expect(
                view.getByText('CRN-07 · 50-Ton Mobile All-Terrain Crane'),
            ).toBeTruthy();

            // Switch to Work Orders tab
            await fireEvent.press(view.getByTestId('tab-work-orders'));
            expect(
                view.getByText('Log Maintenance Defect / Work Order'),
            ).toBeTruthy();

            // Switch to Safe Release tab
            await fireEvent.press(view.getByTestId('tab-safe-release'));
            expect(
                view.getByText('Safe-Release Post-Repair Verification'),
            ).toBeTruthy();

            // Switch to Fuel tab
            await fireEvent.press(view.getByTestId('tab-fuel'));
            expect(
                view.getByText('Fuel Receipt & Dispense Logging'),
            ).toBeTruthy();

            // Switch to Handover tab
            await fireEvent.press(view.getByTestId('tab-handover'));
            expect(
                view.getByText('Technician Asset Handover Sign-Off'),
            ).toBeTruthy();
        });
    });
});
