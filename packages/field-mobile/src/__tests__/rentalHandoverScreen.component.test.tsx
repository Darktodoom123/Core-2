import { cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import React, { act } from 'react';
import { RentalHandoverScreen } from '../screens/RentalHandoverScreen';
import { ThemeProvider } from '../theme';

describe('RentalHandoverScreen', () => {
    afterEach(async () => {
        await cleanup();
        jest.clearAllMocks();
    });

    it('renders checkout tabs and confirms outbound handover in Philippine context', async () => {
        const onCompleteCheckout = jest.fn();
        const onBack = jest.fn();

        const view = await render(
            <RentalHandoverScreen
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
                clientName="DMCI Construction & Power Inc."
                mode="checkout"
                onBack={onBack}
                onCompleteCheckout={onCompleteCheckout}
                reservationReference="REN-2026-0412"
            />,
        );

        expect(view.getByText('Rental Checkout')).toBeTruthy();
        expect(view.getByText('ALB-CRN-050')).toBeTruthy();
        expect(view.getByText('50T Tadano All-Terrain Crane')).toBeTruthy();
        expect(view.getByText(/DMCI Construction/)).toBeTruthy();
        expect(view.getByText('DOLE-OSHC CERTIFIED')).toBeTruthy();

        // Confirm Checkout
        await act(async () => {
            fireEvent.press(view.getByTestId('confirm-handover-button'));
        });
        expect(onCompleteCheckout).toHaveBeenCalledTimes(1);
    });

    it('renders return check-in mode with condition diff damage inspection in Philippine context', async () => {
        const onCompleteReturn = jest.fn();
        const onBack = jest.fn();

        const view = await render(
            <RentalHandoverScreen
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
                clientName="EEI Corporation Philippines"
                mode="return"
                onBack={onBack}
                onCompleteReturn={onCompleteReturn}
                reservationReference="REN-2026-0412"
            />,
        );

        expect(view.getByText('Return Check-in')).toBeTruthy();
        expect(
            view.getByText('RETURN CONDITION & DAMAGE INSPECTION'),
        ).toBeTruthy();

        // Trigger damage inspection toggle
        await act(async () => {
            fireEvent.press(view.getByTestId('toggle-damage-diff'));
        });

        // Confirm Return
        await act(async () => {
            fireEvent.press(view.getByTestId('confirm-handover-button'));
        });
        expect(onCompleteReturn).toHaveBeenCalledTimes(1);
    });

    it('supports Cockpit Dark HUD mode and switching tabs between checkout and return', async () => {
        const onBack = jest.fn();
        const onCompleteCheckout = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <RentalHandoverScreen
                    assetCode="ALB-CRN-050"
                    assetName="50T Tadano All-Terrain Crane"
                    clientName="First Balfour Construction"
                    mode="checkout"
                    onBack={onBack}
                    onCompleteCheckout={onCompleteCheckout}
                    reservationReference="REN-2026-0888"
                />
            </ThemeProvider>,
        );

        expect(view.getByTestId('rental-handover-screen')).toBeTruthy();
        expect(view.getByText('Rental Checkout')).toBeTruthy();
        expect(view.getByText('Checkout Handover')).toBeTruthy();
        expect(view.getByText('HOUR METER & FLUID LEVELS')).toBeTruthy();
        expect(view.getByText('CUSTOMER SIGN-OFF')).toBeTruthy();

        // Switch to return tab
        await act(async () => {
            fireEvent.press(view.getByTestId('tab-return'));
        });
        expect(
            view.getAllByText(/Return Check-in/).length,
        ).toBeGreaterThanOrEqual(1);
        expect(
            view.getByText('RETURN CONDITION & DAMAGE INSPECTION'),
        ).toBeTruthy();

        // Switch back to checkout tab
        await act(async () => {
            fireEvent.press(view.getByTestId('tab-checkout'));
        });
        expect(view.getByText('Rental Checkout')).toBeTruthy();
        expect(view.getByText('Checkout Handover')).toBeTruthy();

        // Open signature modal and close via cancel
        await act(async () => {
            fireEvent.press(view.getByTestId('open-signature-button'));
        });
        expect(view.getByTestId('digital-signature-modal')).toBeTruthy();
        await act(async () => {
            fireEvent.press(view.getByTestId('digital-signature-modal-cancel'));
        });
    });

    it('applies standard amber brand styling to category header and confirm action in both light and dark mode', async () => {
        const lightView = await render(
            <RentalHandoverScreen
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
                clientName="DMCI Construction"
                mode="checkout"
                reservationReference="REN-2026-0412"
            />,
        );

        const categoryText = lightView.getByText('Rental Handover');
        expect(categoryText.props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ color: '#B45309' }),
            ]),
        );

        const confirmBtn = lightView.getByTestId('confirm-handover-button');
        expect(confirmBtn.props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ backgroundColor: '#D97706' }),
            ]),
        );

        const darkView = await render(
            <ThemeProvider initialMode="dark_hud">
                <RentalHandoverScreen
                    assetCode="ALB-CRN-050"
                    assetName="50T Tadano All-Terrain Crane"
                    clientName="DMCI Construction"
                    mode="checkout"
                    reservationReference="REN-2026-0412"
                />
            </ThemeProvider>,
        );

        const darkCategoryText = darkView.getByText('Rental Handover');
        expect(darkCategoryText.props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ color: '#F59E0B' }),
            ]),
        );
    });

    it('renders user-facing sync states: queued, submitting, and failed with retry action', async () => {
        const onRetrySync = jest.fn();

        // 1. Queued / saved on device state
        const queuedView = await render(
            <RentalHandoverScreen
                reservationReference="REN-2026-0412"
                syncStatus="queued"
            />,
        );
        expect(queuedView.getByTestId('sync-status-banner')).toBeTruthy();
        expect(
            queuedView.getByText('Saved on Device (Waiting to Sync)'),
        ).toBeTruthy();

        // 2. Submitting state disables confirm button
        const submittingView = await render(
            <RentalHandoverScreen
                reservationReference="REN-2026-0412"
                syncStatus="submitting"
            />,
        );
        expect(
            submittingView.getByText('Uploading & Synchronizing…'),
        ).toBeTruthy();
        const confirmBtn = submittingView.getByTestId(
            'confirm-handover-button',
        );
        expect(confirmBtn.props.accessibilityState?.disabled).toBe(true);

        // 3. Failed state with retry button
        const failedView = await render(
            <RentalHandoverScreen
                onRetrySync={onRetrySync}
                reservationReference="REN-2026-0412"
                syncErrorMessage="Failed to sync handover record."
                syncStatus="failed"
            />,
        );
        expect(failedView.getByText('Submission Failed')).toBeTruthy();
        expect(
            failedView.getByText('Failed to sync handover record.'),
        ).toBeTruthy();

        const retryBtn = failedView.getByTestId('sync-retry-button');
        await act(async () => {
            fireEvent.press(retryBtn);
        });
        expect(onRetrySync).toHaveBeenCalledTimes(1);

        // 4. Success state
        const successView = await render(
            <RentalHandoverScreen
                reservationReference="REN-2026-0412"
                syncStatus="success"
            />,
        );
        expect(successView.getByText('Submitted Successfully')).toBeTruthy();
    });
});
