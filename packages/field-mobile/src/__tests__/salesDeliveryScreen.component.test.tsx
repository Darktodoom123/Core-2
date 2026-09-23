import { cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import React, { act } from 'react';
import { SalesDeliveryScreen } from '../screens/SalesDeliveryScreen';
import { ThemeProvider } from '../theme';

describe('SalesDeliveryScreen', () => {
    afterEach(async () => {
        await cleanup();
        jest.clearAllMocks();
    });

    it('renders VIN verification, accessories checklist, and confirms sales transfer in Philippine context', async () => {
        const onCompleteDelivery = jest.fn();
        const onBack = jest.fn();

        const view = await render(
            <SalesDeliveryScreen
                clientName="San Miguel Infrastructure Corp."
                deliveryAddress="North-South Commuter Railway (NSCR) Project - Depot Area, Bulacan, PH"
                equipmentName="Caterpillar 320 GC Hydraulic Excavator"
                onBack={onBack}
                onCompleteDelivery={onCompleteDelivery}
                orderReference="SO-2026-0091"
                vinNumber="CAT0320GC88912"
            />,
        );

        expect(view.getByText('Equipment Sales Delivery')).toBeTruthy();
        expect(view.getByText('SO-2026-0091')).toBeTruthy();
        expect(
            view.getByText('Caterpillar 320 GC Hydraulic Excavator'),
        ).toBeTruthy();
        expect(view.getByText(/San Miguel Infrastructure/)).toBeTruthy();
        expect(view.getByText('MATCH')).toBeTruthy();

        // Toggle accessory
        await act(async () => {
            fireEvent.press(view.getByTestId('check-coupler'));
        });

        // Confirm Delivery
        await act(async () => {
            fireEvent.press(view.getByTestId('confirm-sales-delivery-button'));
        });
        expect(onCompleteDelivery).toHaveBeenCalledTimes(1);
        expect(view.getByText('Saved for Synchronization')).toBeTruthy();
        expect(
            view.getByText(/Check synchronization status for server receipt/),
        ).toBeTruthy();
    });

    it('supports Cockpit Dark HUD mode, flags VIN mismatch, and interacts with signature modal', async () => {
        const onCompleteDelivery = jest.fn();
        const onBack = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <SalesDeliveryScreen
                    clientName="EEI Heavy Infra Corp."
                    deliveryAddress="Metro Manila Subway Depot - Valenzuela, PH"
                    equipmentName="Komatsu PC210LC-11 Excavator"
                    onBack={onBack}
                    onCompleteDelivery={onCompleteDelivery}
                    orderReference="SO-2026-0442"
                    vinNumber="KOMPC210LC-99120"
                />
            </ThemeProvider>,
        );

        expect(view.getByTestId('sales-delivery-screen')).toBeTruthy();
        expect(view.getByText('PAID IN FULL · CLEARED')).toBeTruthy();
        expect(view.getByText('SERIAL / VIN VERIFICATION')).toBeTruthy();
        expect(view.getByText('INCLUDED ACCESSORIES & MANUALS')).toBeTruthy();
        expect(view.getByText('BUYER ACCEPTANCE & SIGN-OFF')).toBeTruthy();
        expect(view.getByText('MATCH')).toBeTruthy();

        // Type mismatched VIN
        await act(async () => {
            fireEvent.changeText(
                view.getByTestId('input-vin-number'),
                'WRONG-VIN-12345',
            );
        });
        expect(view.getByText('MISMATCH')).toBeTruthy();

        // Re-type correct VIN
        await act(async () => {
            fireEvent.changeText(
                view.getByTestId('input-vin-number'),
                'KOMPC210LC-99120',
            );
        });
        expect(view.getByText('MATCH')).toBeTruthy();

        // Open signature modal and close via cancel
        await act(async () => {
            fireEvent.press(view.getByTestId('open-sales-signature-button'));
        });
        expect(view.getByTestId('digital-signature-modal')).toBeTruthy();
        await act(async () => {
            fireEvent.press(view.getByTestId('digital-signature-modal-cancel'));
        });

        // Enter delivery notes
        await act(async () => {
            fireEvent.changeText(
                view.getByTestId('input-delivery-notes'),
                'Unloaded at Valenzuela depot site crane bay.',
            );
        });

        // Confirm delivery
        await act(async () => {
            fireEvent.press(view.getByTestId('confirm-sales-delivery-button'));
        });
        expect(onCompleteDelivery).toHaveBeenCalledWith(
            expect.objectContaining({
                verifiedVin: 'KOMPC210LC-99120',
                notes: 'Unloaded at Valenzuela depot site crane bay.',
            }),
        );
    });

    it('requires an explicit assigned asset when the job contains multiple machines', async () => {
        const onCompleteDelivery = jest.fn();
        const view = await render(
            <SalesDeliveryScreen
                assignedAssets={[
                    {
                        asset_code: 'CAT-320-01',
                        asset_name: 'Caterpillar 320 GC Hydraulic Excavator',
                        operational_asset_id: 101,
                    },
                    {
                        asset_code: 'KOM-210-02',
                        asset_name: 'Komatsu PC210LC-11 Excavator',
                        operational_asset_id: 202,
                    },
                ]}
                onCompleteDelivery={onCompleteDelivery}
            />,
        );

        expect(view.getByTestId('sales-asset-selector')).toBeTruthy();
        await act(async () => {
            fireEvent.press(view.getByTestId('confirm-sales-delivery-button'));
        });
        expect(onCompleteDelivery).not.toHaveBeenCalled();
        expect(
            view.getByText(
                'Select the assigned machine covered by this evidence before submitting.',
            ),
        ).toBeTruthy();

        await act(async () => {
            fireEvent.press(view.getByTestId('sales-asset-202'));
        });
        await act(async () => {
            fireEvent.press(view.getByTestId('confirm-sales-delivery-button'));
        });
        expect(onCompleteDelivery).toHaveBeenCalledWith(
            expect.objectContaining({ assetId: 202 }),
        );
    });

    it('applies standard amber brand styling to category header and confirm action in both light and dark mode', async () => {
        const lightView = await render(
            <SalesDeliveryScreen orderReference="SO-2026-0091" />,
        );

        const categoryText = lightView.getByText('Equipment Sales');
        expect(categoryText.props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ color: '#806000' }),
            ]),
        );

        const confirmBtn = lightView.getByTestId(
            'confirm-sales-delivery-button',
        );
        expect(confirmBtn.props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ backgroundColor: '#FFBF00' }),
            ]),
        );

        const darkView = await render(
            <ThemeProvider initialMode="dark_hud">
                <SalesDeliveryScreen orderReference="SO-2026-0091" />
            </ThemeProvider>,
        );

        const darkCategoryText = darkView.getByText('Equipment Sales');
        expect(darkCategoryText.props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ color: '#FFBF00' }),
            ]),
        );
    });

    it('renders delivery photo evidence picker and supports photo attachments', async () => {
        const view = await render(
            <SalesDeliveryScreen orderReference="SO-2026-0091" />,
        );

        expect(view.getByTestId('sales-photo-attachment-picker')).toBeTruthy();
        expect(view.getByText('Delivery Evidence Photos')).toBeTruthy();
    });

    it('renders user-facing sync states: queued, submitting, and failed with retry action', async () => {
        const onRetrySync = jest.fn();

        // 1. Queued / saved on device state
        const queuedView = await render(
            <SalesDeliveryScreen
                orderReference="SO-2026-0091"
                syncStatus="queued"
            />,
        );
        expect(queuedView.getByTestId('sync-status-banner')).toBeTruthy();
        expect(
            queuedView.getByText('Saved on Device (Waiting to Sync)'),
        ).toBeTruthy();

        // 2. Submitting state disables confirm button
        const submittingView = await render(
            <SalesDeliveryScreen
                orderReference="SO-2026-0091"
                syncStatus="submitting"
            />,
        );
        expect(
            submittingView.getByText('Uploading & Synchronizing…'),
        ).toBeTruthy();
        const confirmBtn = submittingView.getByTestId(
            'confirm-sales-delivery-button',
        );
        expect(confirmBtn.props.accessibilityState?.disabled).toBe(true);

        // 3. Failed state with retry button
        const failedView = await render(
            <SalesDeliveryScreen
                onRetrySync={onRetrySync}
                orderReference="SO-2026-0091"
                syncErrorMessage="Network timeout during handover upload."
                syncStatus="failed"
            />,
        );
        expect(failedView.getByText('Submission Failed')).toBeTruthy();
        expect(
            failedView.getByText('Network timeout during handover upload.'),
        ).toBeTruthy();

        const retryBtn = failedView.getByTestId('sync-retry-button');
        await act(async () => {
            fireEvent.press(retryBtn);
        });
        expect(onRetrySync).toHaveBeenCalledTimes(1);

        // 4. Controlled success state is explicitly server-confirmed
        const successView = await render(
            <SalesDeliveryScreen
                orderReference="SO-2026-0091"
                syncStatus="success"
            />,
        );
        expect(successView.getByText('Server Confirmed')).toBeTruthy();
        expect(
            successView.getByText(
                'Operations confirmed receipt of this delivery evidence.',
            ),
        ).toBeTruthy();
    });
});
