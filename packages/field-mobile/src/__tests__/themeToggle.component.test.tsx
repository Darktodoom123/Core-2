import {
    act,
    cleanup,
    fireEvent,
    render,
} from '@testing-library/react-native/pure';
import React from 'react';
import { FieldHeader } from '../components/layout/field-header';
import { SettingsSyncTab } from '../screens/profile/components/SettingsSyncTab';
import { ThemeProvider } from '../theme';

describe('Day / Night HUD theme toggle controls', () => {
    afterEach(() => {
        cleanup();
    });

    it('keeps the light/dark setting out of the header (it lives in Profile)', async () => {
        const view = await render(
            <ThemeProvider initialMode="light">
                <FieldHeader
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

    it('switches themes using the Profile settings display and lighting options', async () => {
        const view = await render(
            <ThemeProvider initialMode="light">
                <SettingsSyncTab isOnline />
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
