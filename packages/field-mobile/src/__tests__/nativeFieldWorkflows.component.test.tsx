import { cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import React from 'react';
import { HeavyCraneDriveModeModal } from '../components/cards/HeavyCraneDriveModeModal';
import { JobListItemCard } from '../components/cards/JobListItemCard';
import {
    FuelReceiptTab,
    HandoverTab,
    InspectionChecklistTab,
    MaintenanceWorkOrderTab,
    SafeReleaseTab,
} from '../components/inspection';
import { EquipmentInspectionScreen } from '../screens/EquipmentInspectionScreen';
import type {
    AssetAssignment,
    DispatchJob,
    MaintenanceWorkOrder,
    TechnicianInspectionCheck,
} from '../types/index';

jest.setTimeout(25000);

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

    describe('JobListItemCard (Upgraded Dispatch Card)', () => {
        const mockJob: DispatchJob = {
            id: 101,
            reference: 'DSP-2026-0894',
            client: 'Megawide Construction',
            title: 'Steel Girder Erection',
            site: 'Batangas Port Pier 4 - Alibaton PH',
            site_notes: 'Enter via South Gate pad 2',
            scheduled_start: '2026-08-15T08:00:00Z',
            priority: { value: 'priority', label: 'Priority' },
            status: { value: 'accepted', label: 'Accepted' },
            version: 2,
            requirements: ['50T lift', 'Tandem lift'],
            capabilities: {
                can_respond: true,
                can_update_status: true,
                can_share_location: true,
            },
            asset_assignments: [
                {
                    id: 1,
                    operational_asset_id: 55,
                    asset_code: 'CRN-101',
                    asset_name: 'Liebherr LTM 1050-3.1',
                    asset_kind: 'mobile_crane',
                },
            ],
            personnel_assignments: [],
            my_assignment: {
                id: 42,
                response_status: 'accepted',
                response_status_label: 'Accepted',
            },
        };

        it('renders full job details: reference, title, client, location, equipment, and scope', async () => {
            const view = await render(
                <JobListItemCard
                    job={mockJob}
                    onOpenDriveRoutes={jest.fn()}
                    onSelectJob={jest.fn()}
                    onTransitionStatus={jest.fn()}
                />,
            );

            expect(view.getByText('DSP-2026-0894')).toBeTruthy();
            expect(view.getByText('Steel Girder Erection')).toBeTruthy();
            expect(view.getByText('Megawide Construction')).toBeTruthy();
            expect(
                view.getByText('Batangas Port Pier 4 - Alibaton PH'),
            ).toBeTruthy();
            expect(view.getByText('Enter via South Gate pad 2')).toBeTruthy();
            expect(
                view.getByText('CRN-101 · Liebherr LTM 1050-3.1'),
            ).toBeTruthy();
            expect(view.getByText('50T lift')).toBeTruthy();
            expect(view.getByText('Tandem lift')).toBeTruthy();
        });

        it('shows every assigned asset and never fabricates an equipment identity', async () => {
            const multipleAssetsView = await render(
                <JobListItemCard
                    job={{
                        ...mockJob,
                        asset_assignments: [
                            ...(mockJob.asset_assignments ?? []),
                            {
                                id: 2,
                                operational_asset_id: 56,
                                asset_code: 'TRK-LONG-IDENTIFIER-2026-0042',
                                asset_name:
                                    'Prime Mover with Extendable Low-Bed Trailer',
                                asset_kind: 'truck',
                            },
                        ],
                    }}
                />,
            );

            expect(
                multipleAssetsView.getByText(
                    'CRN-101 · Liebherr LTM 1050-3.1\nTRK-LONG-IDENTIFIER-2026-0042 · Prime Mover with Extendable Low-Bed Trailer',
                ),
            ).toBeTruthy();

            await cleanup();

            const unassignedView = await render(
                <JobListItemCard job={{ ...mockJob, asset_assignments: [] }} />,
            );
            expect(
                unassignedView.getByText('No equipment assigned'),
            ).toBeTruthy();
            expect(
                unassignedView.queryByText('CRN-101 · Liebherr LTM 1050-3.1'),
            ).toBeNull();
        });

        it('handles direct one-tap assignment acceptance and rejection when pending', async () => {
            const pendingJob: DispatchJob = {
                ...mockJob,
                my_assignment: {
                    id: 99,
                    response_status: 'pending',
                    response_status_label: 'Pending Response',
                },
            };

            const onAccept = jest.fn();
            const onReject = jest.fn();

            const view = await render(
                <JobListItemCard
                    job={pendingJob}
                    onAcceptAssignment={onAccept}
                    onRejectAssignment={onReject}
                />,
            );

            expect(
                view.getByText('Operator assignment requires confirmation'),
            ).toBeTruthy();

            // Accept
            await fireEvent.press(
                view.getByTestId('accept-assignment-btn-101'),
            );
            expect(onAccept).toHaveBeenCalledWith(101, 99, 2);

            // Decline
            await fireEvent.press(
                view.getByTestId('decline-assignment-btn-101'),
            );
            expect(onReject).toHaveBeenCalledWith(
                101,
                99,
                'Declined by mobile operator',
                2,
            );
        });

        it('renders clean status badges without in-progress progression buttons for active jobs', async () => {
            // 1. Accepted state
            const acceptedView = await render(
                <JobListItemCard
                    job={{
                        ...mockJob,
                        status: { value: 'accepted', label: 'Accepted' },
                    }}
                />,
            );
            expect(acceptedView.getByText('Accepted')).toBeTruthy();
            expect(
                acceptedView.queryByTestId('action-en-route-btn-101'),
            ).toBeNull();

            await cleanup();

            // 2. En Route state
            const enRouteView = await render(
                <JobListItemCard
                    job={{
                        ...mockJob,
                        status: { value: 'en_route', label: 'En Route' },
                    }}
                />,
            );
            expect(enRouteView.getByText('En Route')).toBeTruthy();
            expect(
                enRouteView.queryByTestId('action-arrive-btn-101'),
            ).toBeNull();

            await cleanup();

            // 3. Arrived state
            const arrivedView = await render(
                <JobListItemCard
                    job={{
                        ...mockJob,
                        status: { value: 'arrived', label: 'Arrived on Site' },
                    }}
                />,
            );
            expect(arrivedView.getByText('Arrived on Site')).toBeTruthy();
            expect(
                arrivedView.queryByTestId('action-start-work-btn-101'),
            ).toBeNull();

            await cleanup();

            // 4. Working state
            const workingView = await render(
                <JobListItemCard
                    job={{
                        ...mockJob,
                        status: { value: 'working', label: 'Working' },
                    }}
                />,
            );
            expect(workingView.getByText('Working')).toBeTruthy();
            expect(
                workingView.queryByTestId('action-complete-btn-101'),
            ).toBeNull();
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
                    icon: '',
                },
            ];

            const sampleWorkOrder: MaintenanceWorkOrder = {
                id: 'WO-8041',
                assetCode: 'CRN-01',
                assetName: 'Crane 1',
                defectTitle: 'Boom slider wear pad adjustment',
                description: 'Adjusted pads',
                severity: 'minor',
                status: 'repaired',
                reportedBy: 'Alex Rivera',
                createdAt: new Date().toISOString(),
            };

            const view = await render(
                <InspectionChecklistTab
                    checks={sampleChecks}
                    isSaved={false}
                    onSaveInspection={onSave}
                    onToggleCheck={onToggle}
                    selectedWorkOrder={sampleWorkOrder}
                />,
            );

            expect(
                view.getByText('Hydraulic cylinders & outrigger rams'),
            ).toBeTruthy();
            expect(
                view.getByText('WO-8041: Boom slider wear pad adjustment'),
            ).toBeTruthy();
            await fireEvent.press(view.getByTestId('check-item-hyd-01'));
            expect(onToggle).toHaveBeenCalledWith('hyd-01');

            await fireEvent.press(view.getByTestId('save-inspection-btn'));
            expect(onSave).toHaveBeenCalledTimes(1);
        });

        it('blocks saving post-repair inspection when no repaired work order is selected', async () => {
            const onSave = jest.fn();
            const onToggle = jest.fn();

            const sampleChecks: TechnicianInspectionCheck[] = [
                {
                    id: 'hyd-01',
                    category: 'hydraulics',
                    label: 'Hydraulic cylinders & outrigger rams',
                    status: 'good',
                    statusLabel: 'Pass',
                    icon: '',
                },
            ];

            const view = await render(
                <InspectionChecklistTab
                    checks={sampleChecks}
                    isSaved={false}
                    onSaveInspection={onSave}
                    onToggleCheck={onToggle}
                    selectedWorkOrder={null}
                />,
            );

            expect(view.getByTestId('no-work-order-banner')).toBeTruthy();
            expect(
                view.getByText('No Repaired Work Order Selected'),
            ).toBeTruthy();

            await fireEvent.press(view.getByTestId('save-inspection-btn'));
            expect(onSave).not.toHaveBeenCalled();
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

        it('supports selecting safety critical severity and renders active work orders with status pills', async () => {
            const onLog = jest.fn();
            const view = await render(
                <MaintenanceWorkOrderTab
                    assetCode="CRN-07"
                    assetName="50t Crane"
                    onLogWorkOrder={onLog}
                    technicianName="Alex Rivera"
                    workOrders={[
                        {
                            id: 'WO-9901',
                            assetCode: 'CRN-07',
                            assetName: '50t Crane',
                            defectTitle: 'Hoist wire rope kink',
                            description: 'Found kink on main hoist wire rope.',
                            severity: 'safety_critical',
                            status: 'in_progress',
                            reportedBy: 'Alex Rivera',
                            createdAt: '2026-09-06T08:00:00.000Z',
                        },
                    ]}
                />,
            );

            // Verify active work order card displays formatted status and severity badge
            expect(view.getByTestId('wo-card-WO-9901')).toBeTruthy();
            expect(view.getByText('WO-9901')).toBeTruthy();
            expect(view.getByText('IN PROGRESS')).toBeTruthy();
            expect(
                view.getAllByText('SAFETY CRITICAL').length,
            ).toBeGreaterThanOrEqual(2);
            expect(view.getByText('Reported by Alex Rivera')).toBeTruthy();

            // Select Safety Critical option in the form
            await fireEvent.press(
                view.getByLabelText('Severity safety critical'),
            );
            await fireEvent.changeText(
                view.getByTestId('wo-title-input'),
                'Hydraulic line rupture',
            );
            await fireEvent.changeText(
                view.getByTestId('wo-desc-input'),
                'High pressure burst near outrigger #3',
            );
            await fireEvent.press(view.getByTestId('submit-work-order-btn'));

            expect(onLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    defectTitle: 'Hydraulic line rupture',
                    severity: 'safety_critical',
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

        it('renders full EquipmentInspectionScreen as Vehicle Maintenance and switches tabs', async () => {
            const view = await render(
                <EquipmentInspectionScreen
                    assetCode="CRN-07"
                    assetName="50-Ton Mobile All-Terrain Crane"
                    technicianName="Alex Rivera"
                />,
            );

            expect(view.getByText('Vehicle Maintenance')).toBeTruthy();
            expect(
                view.getByText('CRN-07 · 50-Ton Mobile All-Terrain Crane'),
            ).toBeTruthy();

            // Default active tab is now Work Orders
            expect(
                view.getByText('Log Maintenance Defect / Work Order'),
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

            // Switch back to Work Orders tab
            await fireEvent.press(view.getByTestId('tab-work-orders'));
            expect(
                view.getByText('Log Maintenance Defect / Work Order'),
            ).toBeTruthy();

            // Switch to Inspection Checklist tab
            await fireEvent.press(view.getByTestId('tab-checklist'));
            expect(
                view.getByText('Hydraulic cylinders & outrigger rams'),
            ).toBeTruthy();
        });

        it('supports explicit asset selection when a job has multiple assigned assets', async () => {
            const onSaveInspection = jest.fn();
            const onLogWorkOrder = jest.fn();
            const onSelectAsset = jest.fn();

            const multipleAssets = [
                {
                    id: 1,
                    dispatch_job_id: 99,
                    operational_asset_id: 101,
                    asset_code: 'CRN-101',
                    asset_name: 'Heavy Crane Unit A',
                    asset_kind: 'heavy_crane',
                    status: 'active',
                },
                {
                    id: 2,
                    dispatch_job_id: 99,
                    operational_asset_id: 202,
                    asset_code: 'TRK-202',
                    asset_name: 'Support Truck B',
                    asset_kind: 'support_truck',
                    status: 'active',
                },
            ];

            const view = await render(
                <EquipmentInspectionScreen
                    assetAssignments={multipleAssets}
                    onLogWorkOrder={onLogWorkOrder}
                    onSaveInspection={onSaveInspection}
                    onSelectAsset={onSelectAsset}
                    technicianName="Alex Rivera"
                />,
            );

            // Verify asset selector rendered with both assets
            expect(view.getByTestId('equipment-asset-selector')).toBeTruthy();
            expect(view.getByText('CRN-101')).toBeTruthy();
            expect(view.getByText('TRK-202')).toBeTruthy();

            // Explicitly select the second asset (TRK-202)
            await fireEvent.press(view.getByTestId('select-asset-202'));
            expect(onSelectAsset).toHaveBeenCalledWith(202);

            // Log a work order for TRK-202
            await fireEvent.changeText(
                view.getByTestId('wo-title-input'),
                'Coolant hose leak',
            );
            await fireEvent.changeText(
                view.getByTestId('wo-desc-input'),
                'Radiator upper hose ruptured',
            );
            await fireEvent.press(view.getByTestId('submit-work-order-btn'));

            // Must be bound explicitly to TRK-202 (id: 202), NOT the first asset (id: 101)
            expect(onLogWorkOrder).toHaveBeenCalledWith(
                expect.objectContaining({
                    assetCode: 'TRK-202',
                    assetName: 'Support Truck B',
                    defectTitle: 'Coolant hose leak',
                }),
                202,
            );

            // Switch to Inspection tab and save inspection
            await fireEvent.press(view.getByTestId('tab-checklist'));
            await fireEvent.press(view.getByTestId('save-inspection-btn'));

            // Must be bound explicitly to TRK-202 (id: 202) and linked work order WO-8041
            expect(onSaveInspection).toHaveBeenCalledWith(
                expect.any(Array),
                202,
                'WO-8041',
            );
        });

        it('blocks inspection and work order submission and renders prompt banner when multi-asset job has no asset explicitly selected', async () => {
            const onSaveInspection = jest.fn();
            const onLogWorkOrder = jest.fn();
            const onSelectAsset = jest.fn();

            const multipleAssets: AssetAssignment[] = [
                {
                    id: 1,
                    dispatch_job_id: 10,
                    operational_asset_id: 101,
                    asset_code: 'CRN-101',
                    asset_name: 'Primary Crane A',
                    asset_kind: 'crane',
                    assigned_at: '2026-08-01T08:00:00Z',
                },
                {
                    id: 2,
                    dispatch_job_id: 10,
                    operational_asset_id: 202,
                    asset_code: 'TRK-202',
                    asset_name: 'Support Truck B',
                    asset_kind: 'truck',
                    assigned_at: '2026-08-01T08:00:00Z',
                },
            ];

            const view = await render(
                <EquipmentInspectionScreen
                    assetAssignments={multipleAssets}
                    onLogWorkOrder={onLogWorkOrder}
                    onSaveInspection={onSaveInspection}
                    onSelectAsset={onSelectAsset}
                    selectedAssetId={null}
                    technicianName="Alex Rivera"
                />,
            );

            // Verify prompt banner rendered
            expect(view.getByTestId('no-asset-selected-banner')).toBeTruthy();
            expect(
                view.getByText(
                    'Multiple assets assigned. Select an asset above to inspect or log work orders.',
                ),
            ).toBeTruthy();

            // Attempt to log a work order without selecting an asset
            await fireEvent.changeText(
                view.getByTestId('wo-title-input'),
                'Coolant hose leak',
            );
            await fireEvent.changeText(
                view.getByTestId('wo-desc-input'),
                'Radiator upper hose ruptured',
            );
            await fireEvent.press(view.getByTestId('submit-work-order-btn'));

            // Must NOT submit work order
            expect(onLogWorkOrder).not.toHaveBeenCalled();

            // Switch to checklist tab and attempt to save inspection
            await fireEvent.press(view.getByTestId('tab-checklist'));
            await fireEvent.press(view.getByTestId('save-inspection-btn'));

            // Must NOT save inspection
            expect(onSaveInspection).not.toHaveBeenCalled();

            // Once user explicitly selects an asset, banner disappears and submission succeeds
            await fireEvent.press(view.getByTestId('select-asset-101'));
            expect(onSelectAsset).toHaveBeenCalledWith(101);

            await fireEvent.press(view.getByTestId('save-inspection-btn'));
            expect(onSaveInspection).toHaveBeenCalledWith(
                expect.any(Array),
                101,
                'WO-8041',
            );
        });

        it('supports end-to-end post-repair verification workflow from work orders tab to checklist and safe release', async () => {
            const onSaveInspection = jest.fn();
            const onOpenDvir = jest.fn();

            const view = await render(
                <EquipmentInspectionScreen
                    assetCode="CRN-07"
                    assetName="50-Ton Mobile All-Terrain Crane"
                    onOpenDvir={onOpenDvir}
                    onSaveInspection={onSaveInspection}
                    technicianName="Alex Rivera"
                />,
            );

            // 1. Verify canonical DVIR banner on Work Orders tab
            expect(
                view.getByTestId('maintenance-canonical-dvir-banner'),
            ).toBeTruthy();
            await fireEvent.press(
                view.getByTestId('maintenance-open-dvir-btn'),
            );
            expect(onOpenDvir).toHaveBeenCalled();

            // 2. Verify repaired work order card has post-repair action button
            expect(view.getByTestId('post-repair-btn-WO-8041')).toBeTruthy();
            expect(
                view.getByTestId('post-repair-pending-WO-8041'),
            ).toBeTruthy();

            // 3. Tapping post-repair routes to checklist tab with linked work order badge
            await fireEvent.press(view.getByTestId('post-repair-btn-WO-8041'));
            expect(view.getByTestId('linked-work-order-badge')).toBeTruthy();
            expect(
                view.getByText('WO-8041: Boom slider wear pad adjustment'),
            ).toBeTruthy();

            // 4. Save post-repair inspection
            await fireEvent.press(view.getByTestId('save-inspection-btn'));
            expect(onSaveInspection).toHaveBeenCalledWith(
                expect.any(Array),
                undefined,
                'WO-8041',
            );

            // 5. Navigate back to Work Orders tab and confirm verified badge
            await fireEvent.press(view.getByTestId('tab-work-orders'));
            expect(
                view.getByTestId('post-repair-verified-WO-8041'),
            ).toBeTruthy();
            expect(view.getByText('Post-Repair: Verified')).toBeTruthy();
        });
    });
});
