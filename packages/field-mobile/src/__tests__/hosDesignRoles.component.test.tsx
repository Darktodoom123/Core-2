import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { HosCertifyCard } from '../screens/hos/hos-certify-card';
import { DUTY_STATUS_OPTIONS } from '../screens/hos/hos-constants';
import { HosDutyGraph } from '../screens/hos/hos-duty-graph';
import { HosDutyStatusSelector } from '../screens/hos/hos-duty-status-selector';
import { TIMELINE_HISTORY_DAYS } from '../screens/hos/hos-fixtures';
import { HosShiftLimitBanner } from '../screens/hos/hos-shift-limit-banner';
import { HosStandbyReasonSelector } from '../screens/hos/hos-standby-reason-selector';
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

const textColor = (view: View, text: string) =>
    StyleSheet.flatten(view.getByText(text).props.style).color;

const inTheme = (mode: ThemeMode, node: React.ReactElement) =>
    render(<ThemeProvider initialMode={mode}>{node}</ThemeProvider>);

describe.each(MODES)('HoS design roles (%s)', (mode, theme: ThemeColors) => {
    it('gives each duty status its own category color, never brand gold', async () => {
        const view = await inTheme(
            mode,
            <HosDutyStatusSelector
                selectedStatus="operating"
                setIsSaved={jest.fn()}
                setSelectedStatus={jest.fn()}
            />,
        );

        const card = flat(view, 'duty-option-operating');
        const badge = flat(view, 'duty-badge-operating');
        const standbyBadge = flat(view, 'duty-badge-standby');

        expect(card.backgroundColor).toBe(theme.brandAmberLight);
        expect(card.borderColor).toBe(theme.brandAmber);
        expect(badge.backgroundColor).toBe(theme.dutyOnDuty);
        expect(textColor(view, 'OPR')).toBe(theme.textInverse);
        expect(standbyBadge.borderColor).toBe(theme.dutyStandby);
        expect(standbyBadge.borderColor).not.toBe(badge.backgroundColor);
    });

    it('marks the chosen standby reason with Signal Gold Soft and ink text', async () => {
        const view = await inTheme(
            mode,
            <HosStandbyReasonSelector
                setIsSaved={jest.fn()}
                setStandbyReason={jest.fn()}
                standbyReason="client_delay"
            />,
        );
        const chip = flat(view, 'standby-reason-client_delay');

        expect(chip.backgroundColor).toBe(theme.brandAmberLight);
        expect(chip.borderColor).toBe(theme.brandAmber);
    });

    it('shows the 9.0h DOLE warning in orange and the 10.0h cap in red', async () => {
        const warning = await inTheme(
            mode,
            <HosShiftLimitBanner
                isDoleCapExceeded={false}
                setReliefHandoverOpen={jest.fn()}
            />,
        );
        const warningBanner = flat(warning, 'dole-shift-limit-banner');

        expect(warningBanner.backgroundColor).toBe(theme.warningOrangeLight);
        expect(warningBanner.borderColor).toBe(theme.warningOrange);
        expect(flat(warning, 'hos-relief-handover-btn').backgroundColor).toBe(
            theme.brandAmber,
        );
        expect(textColor(warning, 'Relief Handover')).toBe(theme.surfaceDark);

        const cap = await inTheme(
            mode,
            <HosShiftLimitBanner
                isDoleCapExceeded
                setReliefHandoverOpen={jest.fn()}
            />,
        );
        const capBanner = flat(cap, 'dole-shift-limit-banner');

        expect(capBanner.backgroundColor).toBe(theme.hazardRedLight);
        expect(capBanner.borderColor).toBe(theme.hazardRed);
    });

    it('draws the ELD graph legend with duty category colors', async () => {
        const view = await inTheme(
            mode,
            <HosDutyGraph selectedDay={TIMELINE_HISTORY_DAYS[0]} />,
        );

        expect(flat(view, 'hos-graph-legend-off').backgroundColor).toBe(
            theme.textSecondary,
        );
        expect(flat(view, 'hos-graph-legend-break').backgroundColor).toBe(
            theme.successEmerald,
        );
        expect(flat(view, 'hos-graph-legend-driving').backgroundColor).toBe(
            theme.dutyDriving,
        );
        expect(flat(view, 'hos-graph-legend-on').backgroundColor).toBe(
            theme.dutyOnDuty,
        );
    });

    it('fills the certify action with Signal Gold and dark ink once certified', async () => {
        const props = {
            activeConfig: DUTY_STATUS_OPTIONS[0],
            certCheckScale: new Animated.Value(1),
            handleConfirm: jest.fn(),
            handleToggleCert: jest.fn(),
            isSaved: false,
            pendingDutyState: null,
            remarks: '',
            setIsSaved: jest.fn(),
            setRemarks: jest.fn(),
            stampOpacity: new Animated.Value(1),
            stampScale: new Animated.Value(1),
        };
        const view = await inTheme(
            mode,
            <HosCertifyCard {...props} isCertified />,
        );

        expect(flat(view, 'confirm-hos-btn').backgroundColor).toBe(
            theme.brandAmber,
        );
        expect(textColor(view, '✓ Update & Certify Duty Status')).toBe(
            theme.surfaceDark,
        );
        await fireEvent.press(view.getByTestId('confirm-hos-btn'));
        expect(props.handleConfirm).toHaveBeenCalled();
    });

    it.each([
        [null, 'successEmeraldLight', 'successEmerald'],
        ['syncing', 'actionCobaltLight', 'actionCobalt'],
        ['failed', 'hazardRedLight', 'hazardRed'],
    ] as const)(
        'never shows a %s duty change as accepted green unless the server accepted it',
        async (pendingDutyState, surface, edge) => {
            const view = await inTheme(
                mode,
                <HosCertifyCard
                    activeConfig={DUTY_STATUS_OPTIONS[0]}
                    certCheckScale={new Animated.Value(1)}
                    handleConfirm={jest.fn()}
                    handleToggleCert={jest.fn()}
                    isCertified
                    isSaved
                    pendingDutyState={pendingDutyState}
                    remarks=""
                    setIsSaved={jest.fn()}
                    setRemarks={jest.fn()}
                    stampOpacity={new Animated.Value(1)}
                    stampScale={new Animated.Value(1)}
                />,
            );
            const stamp = flat(view, 'hos-confirmed-stamp');

            expect(stamp.backgroundColor).toBe(theme[surface]);
            expect(stamp.borderColor).toBe(theme[edge]);
        },
    );
});
