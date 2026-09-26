import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { HosClocksCard } from '../screens/hos/hos-clocks-card';
import type { HosClocksCardProps } from '../screens/hos/hos-clocks-card';
import { ThemeProvider } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';

const baseProps: HosClocksCardProps = {
    breakCountdownHours: 3.5,
    cycleHoursElapsed: 20,
    cycleHoursLimit: 70,
    cycleRemainingHours: 50,
    driveRemainingHours: 6,
    durationBreakdown: [['Driving', 2]],
    hasServerClock: true,
    hoursElapsed: 3,
    isDoleCapExceeded: false,
    isDoleWarning: false,
    limitCounterHours: 3,
    maxDriveHours: 8,
    maxShiftHours: 10,
    shiftInfo: { status: 'on_shift' },
    shiftProgressPercent: 30,
    shiftRemainingHours: 7,
    userRole: 'operator',
};

const CLOCKS = ['drive', 'shift', 'cycle', 'break'] as const;

function renderCard(
    overrides: Partial<HosClocksCardProps> = {},
    mode: 'light' | 'dark_hud' = 'light',
) {
    return render(
        <ThemeProvider initialMode={mode}>
            <HosClocksCard {...baseProps} {...overrides} />
        </ThemeProvider>,
    );
}

function valueStyle(
    view: Awaited<ReturnType<typeof renderCard>>,
    clock: string,
) {
    return StyleSheet.flatten(
        view.getByTestId(`hos-clock-${clock}-value`).props.style,
    );
}

describe('HosClocksCard state colors', () => {
    it.each([
        ['light', lightThemeColors],
        ['dark_hud', darkHudThemeColors],
    ] as const)(
        'draws healthy clock values in ink, with no decorative gold or purple, in %s mode',
        async (mode, theme) => {
            const view = await renderCard({}, mode);

            for (const clock of CLOCKS) {
                const style = valueStyle(view, clock);

                expect(style.color).toBe(theme.textPrimary);
                expect(style.fontWeight).toBe('700');
                expect(
                    view.queryByTestId(`hos-clock-${clock}-alert`),
                ).toBeNull();
            }
        },
    );

    it.each([
        ['light', lightThemeColors],
        ['dark_hud', darkHudThemeColors],
    ] as const)(
        'turns a clock Caution Orange with an alert icon when an hour or less remains in %s mode',
        async (mode, theme) => {
            const view = await renderCard({ driveRemainingHours: 0.75 }, mode);

            expect(valueStyle(view, 'drive').color).toBe(
                theme.warningOrangeText,
            );
            expect(view.getByTestId('hos-clock-drive-alert')).toBeTruthy();
            expect(valueStyle(view, 'shift').color).toBe(theme.textPrimary);
        },
    );

    it('turns an exhausted clock hazard red', async () => {
        const view = await renderCard({ shiftRemainingHours: 0 });

        expect(valueStyle(view, 'shift').color).toBe(
            lightThemeColors.hazardRedText,
        );
        expect(view.getByTestId('hos-clock-shift-alert')).toBeTruthy();
    });

    it('keeps unavailable clocks neutral', async () => {
        const view = await renderCard({ cycleRemainingHours: null });

        expect(valueStyle(view, 'cycle').color).toBe(
            lightThemeColors.textPrimary,
        );
        expect(view.queryByTestId('hos-clock-cycle-alert')).toBeNull();
    });

    describe('DOLE 9.0h warning and 10.0h cap', () => {
        function gaugeColor(view: Awaited<ReturnType<typeof renderCard>>) {
            return StyleSheet.flatten(
                view.getByTestId('hos-shift-gauge-fill').props.style,
            ).backgroundColor;
        }

        function counterColor(view: Awaited<ReturnType<typeof renderCard>>) {
            return StyleSheet.flatten(
                view.getByTestId('hos-limit-counter-value').props.style,
            ).color;
        }

        it('stays green below the DOLE warning even when most of a long shift window is used', async () => {
            const view = await renderCard({
                limitCounterHours: 8.5,
                shiftProgressPercent: 88,
            });

            expect(gaugeColor(view)).toBe(lightThemeColors.successEmerald);
            expect(counterColor(view)).toBe(lightThemeColors.textPrimary);
            expect(view.queryByTestId('hos-limit-counter-alert')).toBeNull();
        });

        it.each([
            ['light', lightThemeColors],
            ['dark_hud', darkHudThemeColors],
        ] as const)(
            'turns Caution Orange at the 9.0h DOLE warning in %s mode',
            async (mode, theme) => {
                const view = await renderCard(
                    {
                        isDoleWarning: true,
                        limitCounterHours: 9.2,
                        shiftProgressPercent: 40,
                    },
                    mode,
                );

                expect(gaugeColor(view)).toBe(theme.warningOrange);
                expect(counterColor(view)).toBe(theme.warningOrangeText);
                expect(
                    view.getByTestId('hos-limit-counter-alert'),
                ).toBeTruthy();
            },
        );

        it('turns hazard red at the 10.0h DOLE cap, even when the warning flag is also set', async () => {
            const view = await renderCard({
                isDoleCapExceeded: true,
                isDoleWarning: true,
                limitCounterHours: 10,
            });

            expect(gaugeColor(view)).toBe(lightThemeColors.hazardRed);
            expect(counterColor(view)).toBe(lightThemeColors.hazardRedText);
            expect(view.getByTestId('hos-limit-counter-alert')).toBeTruthy();
        });
    });
});

describe('HosClocksCard accepted duration breakdown', () => {
    it('labels a duration server accepted only when the server has reported one', async () => {
        const view = await renderCard({
            durationBreakdown: [
                ['Driving', 2],
                ['Standby', null],
            ],
        });

        expect(view.getAllByText('server accepted')).toHaveLength(1);
        expect(view.getAllByText('not synced yet')).toHaveLength(1);
    });
});
