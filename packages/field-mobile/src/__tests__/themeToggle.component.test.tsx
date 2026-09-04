import {
    act,
    cleanup,
    fireEvent,
    render,
} from '@testing-library/react-native/pure';
import React from 'react';
import { FieldHeader } from '../components/layout/field-header';
import { ProfileSheet } from '../components/sheets/profile-sheet';
import { ThemeProvider } from '../theme';

describe('Day / Night HUD theme toggle controls', () => {
    afterEach(() => {
        cleanup();
    });

    it('toggles theme from light to dark HUD mode when header sun/moon button is pressed', async () => {
        const onOpenProfile = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="light">
                <FieldHeader
                    profileOpen={false}
                    syncStatusLabel="Synced"
                    syncStatusMessage="Just now"
                    syncTone="online"
                    userName="Alex Reyes"
                    userRole="Master Crane Operator"
                    onOpenProfile={onOpenProfile}
                />
            </ThemeProvider>,
        );

        const toggleBtn = view.getByTestId('theme-mode-toggle');
        expect(toggleBtn).toBeTruthy();
        expect(toggleBtn.props.accessibilityLabel).toBe(
            'Switch to cockpit HUD night mode',
        );

        await act(async () => {
            fireEvent.press(toggleBtn);
        });

        expect(toggleBtn.props.accessibilityLabel).toBe(
            'Switch to daylight outdoor mode',
        );
    });

    it('switches themes using the ProfileSheet display and lighting options', async () => {
        const onClose = jest.fn();
        const onStartSignOut = jest.fn();
        const onCancelSignOut = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="light">
                <ProfileSheet
                    onCancelSignOut={onCancelSignOut}
                    onClose={onClose}
                    onStartSignOut={onStartSignOut}
                    signOutConfirmationOpen={false}
                    userName="Alex Reyes"
                    userRole="Master Crane Operator"
                    visible={true}
                />
            </ThemeProvider>,
        );

        const card = view.getByTestId('theme-selector-card');
        expect(card).toBeTruthy();

        const darkOption = view.getByTestId('theme-option-dark');
        const lightOption = view.getByTestId('theme-option-light');

        expect(lightOption.props.accessibilityState.selected).toBe(true);
        expect(darkOption.props.accessibilityState.selected).toBe(false);

        await act(async () => {
            fireEvent.press(darkOption);
        });

        expect(darkOption.props.accessibilityState.selected).toBe(true);
        expect(lightOption.props.accessibilityState.selected).toBe(false);

        await act(async () => {
            fireEvent.press(lightOption);
        });

        expect(lightOption.props.accessibilityState.selected).toBe(true);
        expect(darkOption.props.accessibilityState.selected).toBe(false);
    });
});
