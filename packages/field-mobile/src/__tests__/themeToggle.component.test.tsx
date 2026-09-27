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

    it('keeps the light/dark setting out of the header (it lives in Profile)', async () => {
        const view = await render(
            <ThemeProvider initialMode="light">
                <FieldHeader
                    profileOpen={false}
                    syncStatusLabel="Synced"
                    syncStatusMessage="Just now"
                    syncTone="online"
                    userName="Alex Reyes"
                    userRole="Master Crane Operator"
                    onOpenProfile={jest.fn()}
                />
            </ThemeProvider>,
        );

        expect(view.queryByTestId('theme-mode-toggle')).toBeNull();
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
