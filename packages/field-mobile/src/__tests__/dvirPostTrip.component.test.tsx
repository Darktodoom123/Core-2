import { fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { DvirScreen } from '../screens/DvirScreen';
import { ThemeProvider } from '../theme';
import { lightThemeColors as theme } from '../theme/tokens';

const renderPostTrip = async (
    props: Partial<React.ComponentProps<typeof DvirScreen>> = {},
) => {
    const view = await render(
        <ThemeProvider initialMode="light">
            <DvirScreen
                assetCode="CRN-501"
                assetKind="crane"
                initialMode="post_trip"
                inspectorName="BJ Bello"
                {...props}
            />
        </ThemeProvider>,
    );

    await fireEvent.changeText(view.getByTestId('input-engine-hours'), '1855');
    await fireEvent.press(view.getByTestId('dvir-attestation'));

    return view;
};

type View = Awaited<ReturnType<typeof renderPostTrip>>;

const MOBILE_CRANE_CHECKS = [
    'post-trip-parking-brake',
    'post-trip-wheel-chocks',
    'post-trip-outriggers',
    'post-trip-hook-secured',
    'post-trip-power-isolated',
];

const answerAll = async (view: View, ids: string[]) => {
    for (const id of ids) {
        await fireEvent.press(view.getByTestId(`post-trip-${id}-yes`));
    }
};

const flat = (node: { props: Record<string, unknown> }) =>
    StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>);

describe('DVIR post-trip parked & secured checks', () => {
    jest.setTimeout(20000);

    it('start unanswered and block submitting until each one is answered', async () => {
        const view = await renderPostTrip();

        for (const id of MOBILE_CRANE_CHECKS) {
            for (const answer of ['yes', 'no']) {
                expect(
                    view.getByTestId(`post-trip-${id}-${answer}`).props
                        .accessibilityState,
                ).toMatchObject({ checked: false });
            }
        }

        expect(view.getByTestId('parked-secured-hint')).toHaveTextContent(
            'Answer each check · 5 left',
        );
        expect(view.getByTestId('complete-dvir-button')).toBeDisabled();

        await answerAll(view, MOBILE_CRANE_CHECKS.slice(0, 4));
        expect(view.getByTestId('complete-dvir-button')).toBeDisabled();

        await answerAll(view, MOBILE_CRANE_CHECKS.slice(4));
        expect(view.getByTestId('parked-secured-hint')).toHaveTextContent(
            'All checks answered',
        );
        expect(view.getByTestId('complete-dvir-button')).toBeEnabled();
    });

    it('sends what the operator answered, as passes', async () => {
        const onSave = jest.fn();
        const view = await renderPostTrip({ onSaveInspectionRecord: onSave });

        await answerAll(view, MOBILE_CRANE_CHECKS);
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        const record = onSave.mock.calls[0][0];
        const shutdown = record.checks.filter((c: { id: string }) =>
            c.id.startsWith('post-trip-'),
        );

        expect(shutdown.map((c: { id: string }) => c.id)).toEqual(
            MOBILE_CRANE_CHECKS,
        );
        expect(
            shutdown.every((c: { status: string }) => c.status === 'good'),
        ).toBe(true);
        expect(record.hasDefects).toBe(false);
    });

    it('treats a No as a reported defect: the unit will be locked and remarks are required', async () => {
        const onSave = jest.fn();
        const view = await renderPostTrip({ onSaveInspectionRecord: onSave });

        await answerAll(view, MOBILE_CRANE_CHECKS);
        await fireEvent.press(
            view.getByTestId('post-trip-post-trip-outriggers-no'),
        );

        expect(
            flat(view.getByTestId('post-trip-post-trip-outriggers-no'))
                .backgroundColor,
        ).toBe(theme.hazardRedLight);
        expect(view.getByTestId('dvir-lockout-banner')).toBeTruthy();
        expect(view.getByText('REMARKS · REQUIRED')).toBeTruthy();
        expect(view.getByTestId('complete-dvir-button')).toBeDisabled();

        await fireEvent.changeText(
            view.getByTestId('dvir-remarks-input'),
            'Rear left outrigger will not retract.',
        );
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        const record = onSave.mock.calls[0][0];
        expect(record.hasDefects).toBe(true);
        expect(
            record.checks.find(
                (c: { id: string }) => c.id === 'post-trip-outriggers',
            ),
        ).toMatchObject({ status: 'critical' });
    });

    it('asks a tower crane about its own shutdown, not brakes, chocks or outriggers', async () => {
        const view = await renderPostTrip({
            assetCode: 'TWR-12',
            assetKind: 'tower_crane',
        });
        const card = view.getByTestId('dvir-parked-secured');

        expect(
            within(card).getByTestId('post-trip-check-post-trip-slew-free'),
        ).toBeTruthy();

        for (const id of [
            'post-trip-parking-brake',
            'post-trip-wheel-chocks',
            'post-trip-outriggers',
        ]) {
            expect(view.queryByTestId(`post-trip-check-${id}`)).toBeNull();
        }
    });
});
