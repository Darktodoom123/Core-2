import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { ALL_DEFECTS } from '../components/inspection/defects/defect-sets';
import { DvirScreen } from '../screens/DvirScreen';
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

const renderDvir = (
    mode: ThemeMode,
    props: Partial<React.ComponentProps<typeof DvirScreen>> = {},
) =>
    render(
        <ThemeProvider initialMode={mode}>
            <DvirScreen
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
                initialMode="pre_trip"
                {...props}
            />
        </ThemeProvider>,
    );

async function addDefect(view: View, id: string) {
    const group = ALL_DEFECTS.find((item) => item.id === id)!.categoryKey;

    await fireEvent.press(view.getByTestId('add-defects-button'));
    await fireEvent.press(view.getByTestId(`category-toggle-${group}`));
    await fireEvent.press(view.getByTestId(`defect-item-${id}`));
    await fireEvent.press(view.getByTestId('defects-modal-done'));
}

describe.each(MODES)('DVIR design roles (%s)', (mode, theme: ThemeColors) => {
    it('shows the dispatch lockout in hazard red, with gold replacement request and neutral standby actions', async () => {
        const view = await renderDvir(mode);
        await fireEvent.press(view.getByTestId('safety-status-unsafe'));

        const banner = flat(view, 'dvir-lockout-banner');
        const swap = flat(view, 'dvir-lockout-request-replacement-btn');
        const standby = flat(view, 'dvir-lockout-standby-btn');

        expect(banner.backgroundColor).toBe(theme.hazardRedLight);
        expect(banner.borderColor).toBe(theme.hazardRed);
        expect(textColor(view, 'UNIT WILL BE LOCKED')).toBe(
            theme.hazardRedText,
        );
        expect(swap.backgroundColor).toBe(theme.brandAmber);
        expect(textColor(view, 'Ask for replacement')).toBe(theme.surfaceDark);
        expect(standby.backgroundColor).toBe(theme.surface);
        expect(swap.minHeight).toBeGreaterThanOrEqual(48);
        expect(standby.minHeight).toBeGreaterThanOrEqual(48);
    });

    it('shows reported defects as warnings and critical defects as hazards', async () => {
        const view = await renderDvir(mode);
        await addDefect(view, 'crane_outriggers_jacks');
        await addDefect(view, 'crane_telescopic_boom');

        const warning = flat(view, 'defect-chip-crane_outriggers_jacks');
        const critical = flat(view, 'defect-chip-crane_telescopic_boom');

        expect([warning.backgroundColor, critical.backgroundColor]).toEqual([
            expect.any(String),
            theme.hazardRedLight,
        ]);
        expect(warning.backgroundColor).not.toBe(theme.brandAmberLight);
        expect(critical.borderColor).toBe(theme.hazardRed);
    });

    it('marks the blocking no-asset notice as a warning, not gold', async () => {
        const view = await renderDvir(mode, { assetCode: 'UNASSIGNED' });
        const banner = flat(view, 'dvir-unassigned-banner');

        expect(banner.backgroundColor).toBe(theme.warningOrangeLight);
        expect(banner.borderColor).toBe(theme.warningOrange);
        expect(
            textColor(
                view,
                'No operational equipment assigned to this shift or dispatch.',
            ),
        ).toBe(theme.warningOrangeText);
    });

    it('selects an asset with Signal Gold Soft and ink text', async () => {
        const view = await renderDvir(mode, {
            assetAssignments: [
                {
                    id: 1,
                    operational_asset_id: 101,
                    asset_code: 'CRN-50',
                    asset_name: '50-Ton Mobile Crane',
                    asset_kind: 'mobile_crane',
                },
                {
                    id: 2,
                    operational_asset_id: 102,
                    asset_code: 'TRK-20',
                    asset_name: 'Support Flatbed Truck',
                    asset_kind: 'truck',
                },
            ],
            assetCode: undefined,
        });
        await fireEvent.press(view.getByTestId('dvir-select-asset-101'));

        const pill = flat(view, 'dvir-select-asset-101');

        expect(pill.backgroundColor).toBe(theme.brandAmberLight);
        expect(pill.borderColor).toBe(theme.brandAmber);
        expect(textColor(view, 'CRN-50')).toBe(theme.textPrimary);
    });

    it('keeps gold for actions, with dark ink on gold fills', async () => {
        const view = await renderDvir(mode);

        expect(flat(view, 'complete-dvir-button').backgroundColor).toBe(
            theme.brandAmber,
        );
        expect(textColor(view, 'Next')).toBe(theme.surfaceDark);

        await fireEvent.press(view.getByTestId('tab-history'));

        expect(flat(view, 'tab-history').backgroundColor).toBe(
            theme.brandAmber,
        );
        expect(textColor(view, 'Form')).toBe(theme.surfaceDark);
    });

    it('draws the screen on the theme canvas', async () => {
        const view = await renderDvir(mode);

        expect(flat(view, 'dvir-screen').backgroundColor).toBe(theme.canvas);
    });
});
