import { fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { DvirScreen } from '../screens/DvirScreen';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';
import { takeWalkaroundPhotos } from './dvir-test-photos';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const renderReady = async (
    mode: ThemeMode,
    props: Partial<React.ComponentProps<typeof DvirScreen>> = {},
) => {
    const view = await render(
        <ThemeProvider initialMode={mode}>
            <DvirScreen
                assetCode="CRN-501"
                assetKind="crane"
                initialMode="pre_trip"
                inspectorName="BJ Bello"
                {...props}
            />
        </ThemeProvider>,
    );

    await fireEvent.changeText(view.getByTestId('input-engine-hours'), '1855');
    await fireEvent.press(view.getByTestId('dvir-attestation'));

    return view;
};

const badge = (view: Awaited<ReturnType<typeof renderReady>>) =>
    view.getByTestId('dvir-walkaround-photos-requirement');

const flat = (node: { props: Record<string, unknown> }) =>
    StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>);

describe.each(MODES)(
    'DVIR walkaround photos (%s)',
    (mode, theme: ThemeColors) => {
        jest.setTimeout(20000);

        it('are required for a clean pre-trip, with a count of what is missing', async () => {
            const onSave = jest.fn();
            const view = await renderReady(mode, {
                onSaveInspectionRecord: onSave,
            });

            expect(badge(view)).toHaveTextContent(/REQUIRED · 0 of 4/);
            expect(flat(badge(view)).backgroundColor).toBe(
                theme.warningOrangeLight,
            );
            expect(view.getByTestId('complete-dvir-button')).toBeDisabled();
            expect(view.getByTestId('dvir-missing')).toHaveTextContent(
                /Still needed: 4 walkaround photos$/,
            );

            await takeWalkaroundPhotos(view);
            expect(view.queryByTestId('dvir-missing')).toBeNull();

            expect(badge(view)).toHaveTextContent(/REQUIRED · 4 of 4/);
            expect(flat(badge(view)).backgroundColor).toBe(
                theme.surfaceHighlight,
            );
            expect(view.getByTestId('complete-dvir-button')).toBeEnabled();

            await fireEvent.press(view.getByTestId('complete-dvir-button'));
            expect(onSave).toHaveBeenCalled();
        });

        it('never block reporting an unsafe unit', async () => {
            const onSave = jest.fn();
            const view = await renderReady(mode, {
                onSaveInspectionRecord: onSave,
            });

            await fireEvent.press(view.getByTestId('safety-status-unsafe'));
            await fireEvent.changeText(
                view.getByTestId('dvir-remarks-input'),
                'Hoist brake slipping; camera not working.',
            );

            expect(badge(view)).toHaveTextContent(/OPTIONAL/);
            expect(view.getByTestId('complete-dvir-button')).toBeEnabled();

            await fireEvent.press(view.getByTestId('complete-dvir-button'));
            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({ hasDefects: true }),
            );
        });

        it('are required on a clean post-trip too, to record the unit as it was parked', async () => {
            const view = await renderReady(mode, { initialMode: 'post_trip' });

            for (const check of [
                'post-trip-parking-brake',
                'post-trip-wheel-chocks',
                'post-trip-outriggers',
                'post-trip-hook-secured',
                'post-trip-power-isolated',
            ]) {
                await fireEvent.press(
                    view.getByTestId(`post-trip-${check}-yes`),
                );
            }

            expect(badge(view)).toHaveTextContent(/REQUIRED · 0 of 4/);
            expect(view.getByTestId('complete-dvir-button')).toBeDisabled();
            expect(view.getByTestId('dvir-missing')).toHaveTextContent(
                /Still needed: 4 walkaround photos$/,
            );

            await takeWalkaroundPhotos(view);
            expect(view.getByTestId('complete-dvir-button')).toBeEnabled();
        });

        it('never block a post-trip that reports a problem', async () => {
            const view = await renderReady(mode, { initialMode: 'post_trip' });

            await fireEvent.press(
                view.getByTestId('post-trip-post-trip-outriggers-no'),
            );

            expect(badge(view)).toHaveTextContent(/OPTIONAL/);
        });

        it('mark taken photos with a tick and text, and offer a 48dp remove button', async () => {
            const view = await renderReady(mode);

            await takeWalkaroundPhotos(view);

            const slot = view.getByTestId('dvir-walkaround-photos');
            expect(within(slot).getByText('Front')).toBeTruthy();
            expect(
                flat(view.getByTestId('remove-front')).width,
            ).toBeGreaterThanOrEqual(48);

            await fireEvent.press(view.getByTestId('remove-front'));
            expect(badge(view)).toHaveTextContent(/REQUIRED · 3 of 4/);
            expect(view.getByTestId('complete-dvir-button')).toBeDisabled();
        });
    },
);
