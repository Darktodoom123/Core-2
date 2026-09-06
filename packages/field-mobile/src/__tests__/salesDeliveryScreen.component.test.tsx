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

    it('applies standard amber brand styling to category header and confirm action in both light and dark mode', async () => {
        const lightView = await render(
            <SalesDeliveryScreen
                orderReference="SO-2026-0091"
            />,
        );

        const categoryText = lightView.getByText('Equipment Sales');
        expect(categoryText.props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ color: '#B45309' }),
            ]),
        );

        const confirmBtn = lightView.getByTestId('confirm-sales-delivery-button');
        expect(confirmBtn.props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ backgroundColor: '#D97706' }),
            ]),
        );

        const darkView = await render(
            <ThemeProvider initialMode="dark_hud">
                <SalesDeliveryScreen
                    orderReference="SO-2026-0091"
                />
            </ThemeProvider>,
        );

        const darkCategoryText = darkView.getByText('Equipment Sales');
        expect(darkCategoryText.props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ color: '#F59E0B' }),
            ]),
        );
    });
});
