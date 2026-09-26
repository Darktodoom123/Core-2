import { render } from '@testing-library/react-native/pure';
import '@testing-library/react-native/matchers';
import React from 'react';
import { StyleSheet } from 'react-native';
import { FieldBottomNav } from '../components/layout/field-bottom-nav';
import { SyncStatusPill } from '../components/layout/field-header';
import { ThemeProvider, darkHudThemeColors, lightThemeColors } from '../theme';

const renderNav = (mode: 'light' | 'dark_hud') =>
    render(
        <ThemeProvider initialMode={mode}>
            <FieldBottomNav
                activeItem="profile"
                onSelect={jest.fn()}
                onSosHoldComplete={jest.fn()}
            />
        </ThemeProvider>,
    );

const renderPill = (mode: 'light' | 'dark_hud', tone: 'offline' | 'syncing') =>
    render(
        <ThemeProvider initialMode={mode}>
            <SyncStatusPill label="Offline" message="Queued" tone={tone} />
        </ThemeProvider>,
    );

describe('Bottom nav selected label contrast', () => {
    it('uses gold ink text on the light nav, not plain Signal Gold', async () => {
        const view = await renderNav('light');
        const labelStyle = StyleSheet.flatten(
            view.getByText('Profile').props.style,
        );

        expect(labelStyle.color).toBe(lightThemeColors.brandAmberText);
        expect(labelStyle.fontSize).toBeGreaterThanOrEqual(12);
    });

    it('keeps Signal Gold text in Night Cab, where it has contrast', async () => {
        const view = await renderNav('dark_hud');
        const labelStyle = StyleSheet.flatten(
            view.getByText('Profile').props.style,
        );

        expect(labelStyle.color).toBe(darkHudThemeColors.brandAmberText);
    });
});

describe('Sync pill state colors', () => {
    it('shows offline in the warning family in dark HUD, not a gold tint', async () => {
        const view = await renderPill('dark_hud', 'offline');
        const pillStyle = StyleSheet.flatten(
            view.getByTestId('sync-status-pill').props.style,
        );

        expect(pillStyle.backgroundColor).toBe(
            darkHudThemeColors.warningOrangeLight,
        );
        expect(pillStyle.borderColor).toBe(darkHudThemeColors.warningOrange);
    });

    it('marks syncing with Info Cobalt instead of brand gold', async () => {
        const view = await renderPill('light', 'syncing');
        const markStyle = StyleSheet.flatten(
            view.getByTestId('sync-status-mark').props.style,
        );

        expect(markStyle.backgroundColor).toBe(lightThemeColors.actionCobalt);
    });
});
