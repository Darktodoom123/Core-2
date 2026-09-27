import { fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { DefectSheet } from '../components/inspection/defects/defect-sheet';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const renderSheet = (
    mode: ThemeMode,
    props: Partial<React.ComponentProps<typeof DefectSheet>> = {},
) =>
    render(
        <ThemeProvider initialMode={mode}>
            <DefectSheet
                assetCode="TWR-12"
                onApplyDefects={jest.fn()}
                onChooseUnitType={jest.fn()}
                onClose={jest.fn()}
                selectedDefectIds={[]}
                unitType="tower_crane"
                visible
                {...props}
            />
        </ThemeProvider>,
    );

const flat = (node: { props: Record<string, unknown> }) =>
    StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>);

describe.each(MODES)('Add defects sheet (%s)', (mode, theme: ThemeColors) => {
    it('is fixed to the unit’s type: no switching to other equipment', async () => {
        const view = await renderSheet(mode);

        expect(view.getByTestId('defect-sheet-unit')).toHaveTextContent(
            /TWR-12 · Tower crane/,
        );

        for (const pill of [
            'filter-all',
            'filter-mobile-crane',
            'filter-tower-crane',
            'filter-carrier',
        ]) {
            expect(view.queryByTestId(pill)).toBeNull();
        }

        expect(
            view.getByTestId('category-section-tower_crane_cab'),
        ).toBeTruthy();
        expect(view.queryByTestId('category-section-tires_wheels')).toBeNull();
        expect(view.getByText('Operator Cab & Controls')).toBeTruthy();
    });

    it('asks what kind of unit it is instead of guessing', async () => {
        const onChooseUnitType = jest.fn();
        const view = await renderSheet(mode, {
            assetCode: 'EQP-3',
            onChooseUnitType,
            unitType: null,
        });

        expect(view.getByText('What kind of unit is EQP-3?')).toBeTruthy();
        expect(view.queryByTestId('defects-search-input')).toBeNull();

        await fireEvent.press(view.getByTestId('unit-type-tower_crane'));
        expect(onChooseUnitType).toHaveBeenCalledWith('tower_crane');
    });

    it('offers common problems for the type as quick picks', async () => {
        const view = await renderSheet(mode);
        const picks = view.getByTestId('defect-quick-picks');

        expect(within(picks).getByText('COMMON ON TOWER CRANES')).toBeTruthy();

        await fireEvent.press(
            within(picks).getByTestId('quick-pick-crane_hoist_wire_rope'),
        );

        const chip = flat(
            within(picks).getByTestId('quick-pick-crane_hoist_wire_rope'),
        );
        expect(chip.backgroundColor).toBe(theme.brandAmberLight);
        expect(chip.borderColor).toBe(theme.brandAmber);
        expect(view.getByText('Add 1 defect')).toBeTruthy();
    });

    it('keeps groups collapsed with a count, and opens them on tap', async () => {
        const view = await renderSheet(mode, {
            selectedDefectIds: ['tower_trolley_winch'],
        });

        expect(
            view.queryByTestId('defect-item-tower_trolley_winch'),
        ).toBeNull();
        expect(
            within(
                view.getByTestId('category-section-tower_crane_trolley'),
            ).getByText('1 chosen'),
        ).toBeTruthy();

        await fireEvent.press(
            view.getByTestId('category-toggle-tower_crane_trolley'),
        );

        expect(
            view.getByTestId('defect-item-tower_trolley_winch').props
                .accessibilityState,
        ).toMatchObject({ checked: true });
    });

    it('shows which defects lock the unit before the operator picks them', async () => {
        const view = await renderSheet(mode);

        await fireEvent.press(
            view.getByTestId('category-toggle-tower_crane_jib'),
        );

        const critical = view.getByTestId('defect-item-tower_main_jib_lattice');
        const minor = view.getByTestId('defect-item-tower_catwalk_lifeline');

        expect(within(critical).getByText('CRITICAL')).toBeTruthy();
        expect(within(minor).getByText('ATTENTION')).toBeTruthy();
        expect(
            flat(within(critical).getByTestId('severity-tag')).backgroundColor,
        ).toBe(theme.hazardRedLight);
        expect(
            flat(within(minor).getByTestId('severity-tag')).backgroundColor,
        ).toBe(theme.warningOrangeLight);

        await fireEvent.press(critical);

        expect(
            view.getByText(
                '1 critical defect — the unit will be locked when you submit.',
            ),
        ).toBeTruthy();
    });

    it('searches only within the unit’s own defects', async () => {
        const view = await renderSheet(mode);

        await fireEvent.changeText(
            view.getByTestId('defects-search-input'),
            'tire',
        );
        expect(
            view.getByText('No tower crane defects match “tire”.'),
        ).toBeTruthy();

        await fireEvent.changeText(
            view.getByTestId('defects-search-input'),
            'trolley',
        );
        expect(
            view.getByTestId('defect-item-tower_trolley_winch'),
        ).toBeTruthy();
        expect(view.queryByTestId('defect-quick-picks')).toBeNull();
    });

    it('applies the chosen defects with one gold button', async () => {
        const onApplyDefects = jest.fn();
        const onClose = jest.fn();
        const view = await renderSheet(mode, { onApplyDefects, onClose });

        await fireEvent.press(view.getByTestId('quick-pick-crane_hook_latch'));
        await fireEvent.press(view.getByTestId('quick-pick-crane_lmi_a2b'));

        const done = view.getByTestId('defects-modal-done');
        expect(within(done).getByText('Add 2 defects')).toBeTruthy();
        expect(flat(done).backgroundColor).toBe(theme.brandAmber);
        expect(flat(done).minHeight).toBeGreaterThanOrEqual(52);

        await fireEvent.press(done);
        expect(onApplyDefects).toHaveBeenCalledWith([
            'crane_hook_latch',
            'crane_lmi_a2b',
        ]);
        expect(onClose).toHaveBeenCalled();
    });
});
