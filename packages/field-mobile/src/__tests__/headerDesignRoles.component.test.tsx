import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { FieldHeader } from '../components/layout/field-header';
import type { FieldHeaderProps } from '../components/layout/field-header';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

type View = Awaited<ReturnType<typeof render>>;

const flat = (view: View, testID: string) => {
    const style = view.getByTestId(testID).props.style;

    return StyleSheet.flatten(
        typeof style === 'function' ? style({ pressed: false }) : style,
    );
};

const renderHeader = (mode: ThemeMode, props: Partial<FieldHeaderProps> = {}) =>
    render(
        <ThemeProvider initialMode={mode}>
            <FieldHeader
                isOnline
                onOpenProfile={jest.fn()}
                syncStatusLabel="Synced"
                syncStatusMessage="Up to date"
                syncTone="online"
                userName="BJ Bello"
                {...props}
            />
        </ThemeProvider>,
    );

describe.each(MODES)(
    'Field header design roles (%s)',
    (mode, theme: ThemeColors) => {
        it('keeps the bell neutral and shows unread items with a gold count badge', async () => {
            const view = await renderHeader(mode, { notificationCount: 3 });

            const bell = flat(view, 'notification-button');
            const badge = flat(view, 'notification-badge');

            expect(bell.backgroundColor).toBe(theme.surface);
            expect(bell.borderColor).toBe(theme.border);
            expect(badge.backgroundColor).toBe(theme.brandAmber);
            expect(
                StyleSheet.flatten(view.getByText('3').props.style).color,
            ).toBe(theme.surfaceDark);
        });

        it('has one status control: no separate connection pill or theme toggle', async () => {
            const view = await renderHeader(mode);

            expect(view.getByTestId('sync-status-pill')).toBeTruthy();
            expect(view.queryByTestId('online-synced-pill')).toBeNull();
            // The light/dark setting lives in the Profile sheet.
            expect(view.queryByTestId('theme-mode-toggle')).toBeNull();
        });

        it('shows offline in the status pill as a warning', async () => {
            const view = await renderHeader(mode, {
                isOnline: false,
                syncStatusLabel: 'Offline',
                syncStatusMessage: 'Reconnect to sync',
                syncTone: 'offline',
            });
            const pill = flat(view, 'sync-status-pill');

            expect(pill.backgroundColor).toBe(theme.warningOrangeLight);
            expect(pill.borderColor).toBe(theme.warningOrange);
        });

        it('draws resting header buttons with a border and no shadow', async () => {
            const view = await renderHeader(mode, { notificationCount: 1 });

            for (const id of ['notification-button']) {
                const button = flat(view, id);

                expect(button.borderWidth).toBe(1);
                expect(button.elevation ?? 0).toBe(0);
                expect(button.shadowOpacity ?? 0).toBe(0);
                expect(
                    button.minHeight ?? button.height,
                ).toBeGreaterThanOrEqual(48);
            }
        });
    },
);
