import { fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { DvirScreen } from '../screens/DvirScreen';
import { ThemeProvider } from '../theme';
import type { ThemeMode } from '../theme';
import { takeWalkaroundPhotos } from './dvir-test-photos';

const MODES = ['light', 'dark_hud'] as const;

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

describe.each(MODES)('DVIR walkaround photos (%s)', (mode) => {
    jest.setTimeout(20000);

    it('are optional on a pre-trip: it saves with none taken', async () => {
        const onSave = jest.fn();
        const view = await renderReady(mode, {
            onSaveInspectionRecord: onSave,
        });

        expect(badge(view)).toHaveTextContent(/OPTIONAL/);
        expect(view.queryByTestId('dvir-missing')).toBeNull();
        expect(view.getByTestId('complete-dvir-button')).toBeEnabled();

        await fireEvent.press(view.getByTestId('complete-dvir-button'));
        expect(onSave).toHaveBeenCalled();
    });

    it('are optional on a post-trip too', async () => {
        const view = await renderReady(mode, { initialMode: 'post_trip' });

        for (const check of [
            'post-trip-parking-brake',
            'post-trip-wheel-chocks',
            'post-trip-outriggers',
            'post-trip-hook-secured',
            'post-trip-power-isolated',
        ]) {
            await fireEvent.press(view.getByTestId(`post-trip-${check}-yes`));
        }

        expect(badge(view)).toHaveTextContent(/OPTIONAL/);
        expect(view.queryByTestId('dvir-missing')).toBeNull();
        expect(view.getByTestId('complete-dvir-button')).toBeEnabled();
    });

    it('photos that are taken are sent with the inspection', async () => {
        const commandOutbox = {
            enqueueSubmitDvir: jest.fn().mockResolvedValue({}),
            processQueue: jest.fn().mockResolvedValue({}),
        };
        const view = await renderReady(mode, {
            commandOutbox: commandOutbox as never,
        });

        await takeWalkaroundPhotos(view);
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        const payload = commandOutbox.enqueueSubmitDvir.mock.calls[0][0];
        expect(payload.photos).toHaveLength(4);
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
        expect(view.getByTestId('complete-dvir-button')).toBeEnabled();
    });
});
