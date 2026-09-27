import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { HosSyncBanner } from '../screens/hos/hos-sync-banner';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const flat = (node: { props: Record<string, unknown> }) =>
    StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>);

const renderBanner = (
    mode: ThemeMode,
    props: React.ComponentProps<typeof HosSyncBanner>,
) =>
    render(
        <ThemeProvider initialMode={mode}>
            <HosSyncBanner {...props} />
        </ThemeProvider>,
    );

describe.each(MODES)('HoS sync banner (%s)', (mode, theme: ThemeColors) => {
    it('shows a rejected change in red with the server reason and a way out', async () => {
        const onDiscard = jest.fn();
        const view = await renderBanner(mode, {
            onDiscard,
            summary: {
                problem: {
                    id: 'cmd-1',
                    kind: 'rejected',
                    what: 'Start shift · Operating',
                    reason: 'The duty event cannot occur in the future.',
                },
                waiting: [{ id: 'cmd-2', what: 'Off duty · end shift' }],
            },
        });

        const banner = view.getByTestId('hos-sync-problem');
        expect(flat(banner).backgroundColor).toBe(theme.hazardRedLight);
        expect(banner).toHaveTextContent(/Rejected: Start shift · Operating/);
        expect(banner).toHaveTextContent(
            /The duty event cannot occur in the future\./,
        );
        expect(view.getByTestId('hos-sync-held')).toHaveTextContent(
            '1 later change is on hold until this is discarded.',
        );

        const discard = view.getByTestId('hos-sync-discard');
        expect(flat(discard).minHeight).toBeGreaterThanOrEqual(48);
        await fireEvent.press(discard);
        expect(onDiscard).toHaveBeenCalledWith('cmd-1');
    });

    it('offers a retry, in orange, when a change only failed to send', async () => {
        const onRetry = jest.fn();
        const view = await renderBanner(mode, {
            onRetry,
            summary: {
                problem: {
                    id: 'cmd-1',
                    kind: 'stalled',
                    what: 'Break',
                    reason: null,
                },
                waiting: [],
            },
        });

        expect(flat(view.getByTestId('hos-sync-problem')).backgroundColor).toBe(
            theme.warningOrangeLight,
        );
        expect(view.queryByTestId('hos-sync-discard')).toBeNull();
        await fireEvent.press(view.getByTestId('hos-sync-retry'));
        expect(onRetry).toHaveBeenCalledWith('cmd-1');
    });

    it('says plainly what is still waiting to send', async () => {
        const view = await renderBanner(mode, {
            summary: {
                problem: null,
                waiting: [
                    { id: 'a', what: 'Driving' },
                    { id: 'b', what: 'Off duty · end shift' },
                ],
            },
        });

        expect(view.getByTestId('hos-sync-waiting')).toHaveTextContent(
            /2 duty changes waiting to send · latest: Off duty · end shift/,
        );
    });

    it('shows nothing when every change reached the server', async () => {
        const view = await renderBanner(mode, { summary: null });

        expect(view.queryByTestId('hos-sync-waiting')).toBeNull();
        expect(view.queryByTestId('hos-sync-problem')).toBeNull();
    });
});
