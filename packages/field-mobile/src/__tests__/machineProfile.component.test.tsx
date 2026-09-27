import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { MachineProfileScreen } from '../screens/MachineProfileScreen';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';
import type { AssetAssignment } from '../types/index';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const crane: AssetAssignment = {
    id: 1,
    operational_asset_id: 501,
    asset_code: 'CRN-501',
    asset_name: 'Tadano 50T All-Terrain',
    asset_kind: 'mobile_crane',
    model: 'ATF 50G-3',
    rated_capacity: '50T',
    engine_hours: 4820,
    attachments: ['Jib extension'],
};

const truck: AssetAssignment = {
    id: 2,
    operational_asset_id: 502,
    asset_code: 'TRK-502',
    asset_name: 'Boom Truck',
    asset_kind: 'boom_truck',
};

type View = Awaited<ReturnType<typeof render>>;

const flat = (view: View, testID: string) => {
    const style = view.getByTestId(testID).props.style;

    return StyleSheet.flatten(
        typeof style === 'function' ? style({ pressed: false }) : style,
    );
};

const renderProfile = (
    mode: ThemeMode,
    props: Partial<React.ComponentProps<typeof MachineProfileScreen>> = {},
) =>
    render(
        <ThemeProvider initialMode={mode}>
            <MachineProfileScreen
                assets={[crane]}
                dvirStatus="cleared"
                onBack={jest.fn()}
                onOpenDocuments={jest.fn()}
                onOpenDvir={jest.fn()}
                {...props}
            />
        </ThemeProvider>,
    );

describe.each(MODES)('Machine profile (%s)', (mode, theme: ThemeColors) => {
    it('is about the machine: no fuel, handover, post-repair or work order tabs', async () => {
        const view = await renderProfile(mode);

        expect(view.getByText('CRN-501')).toBeTruthy();
        expect(view.getByText('Tadano 50T All-Terrain')).toBeTruthy();
        expect(view.getByText('50T')).toBeTruthy();
        expect(view.getByText('4,820 hrs')).toBeTruthy();
        expect(view.getByText('Jib extension')).toBeTruthy();

        for (const id of ['tab-fuel', 'tab-handover', 'tab-work-orders']) {
            expect(view.queryByTestId(id)).toBeNull();
        }

        expect(view.queryByText(/Post-Repair/)).toBeNull();
        expect(view.queryByText(/WO-8041/)).toBeNull();
    });

    it('never invents values the server did not send', async () => {
        const view = await renderProfile(mode, { assets: [truck] });

        expect(view.getAllByText('Not recorded').length).toBeGreaterThanOrEqual(
            3,
        );
        expect(view.queryByText(/4,820/)).toBeNull();
    });

    it('says plainly when no machine is assigned', async () => {
        const view = await renderProfile(mode, { assets: [] });

        expect(view.getByText('No machine assigned')).toBeTruthy();
        expect(view.queryByTestId('machine-readiness')).toBeNull();
        expect(view.queryByText(/CRN-07/)).toBeNull();
    });

    it('shows a due pre-trip in orange with a gold action to start it', async () => {
        const onOpenDvir = jest.fn();
        const view = await renderProfile(mode, {
            dvirStatus: 'pending',
            onOpenDvir,
        });

        expect(flat(view, 'machine-readiness').borderColor).toBe(
            theme.warningOrange,
        );
        expect(flat(view, 'machine-start-dvir-btn').backgroundColor).toBe(
            theme.brandAmber,
        );

        await fireEvent.press(view.getByTestId('machine-start-dvir-btn'));
        expect(onOpenDvir).toHaveBeenCalled();
    });

    it('shows a cleared unit in green and a defect lockout in red', async () => {
        const cleared = await renderProfile(mode, { dvirStatus: 'cleared' });

        expect(flat(cleared, 'machine-readiness').borderColor).toBe(
            theme.successEmerald,
        );

        const defect = await renderProfile(mode, { dvirStatus: 'defect' });

        expect(flat(defect, 'machine-readiness').borderColor).toBe(
            theme.hazardRed,
        );
        expect(defect.getByText(/Locked out/)).toBeTruthy();
    });

    it('reports defects through the DVIR and links to the unit documents', async () => {
        const onOpenDvir = jest.fn();
        const onOpenDocuments = jest.fn();
        const view = await renderProfile(mode, { onOpenDocuments, onOpenDvir });
        const report = flat(view, 'machine-report-defect-btn');

        expect(report.backgroundColor).toBe(theme.surface);
        expect(report.minHeight).toBeGreaterThanOrEqual(48);

        await fireEvent.press(view.getByTestId('machine-report-defect-btn'));
        await fireEvent.press(view.getByTestId('machine-documents-btn'));
        expect(onOpenDvir).toHaveBeenCalled();
        expect(onOpenDocuments).toHaveBeenCalled();
    });

    it('lets the operator pick between assigned machines with Signal Gold Soft', async () => {
        const onSelectAsset = jest.fn();
        const view = await renderProfile(mode, {
            assets: [crane, truck],
            onSelectAsset,
            selectedAssetId: 501,
        });
        const selected = flat(view, 'machine-select-501');

        expect(selected.backgroundColor).toBe(theme.brandAmberLight);
        expect(selected.borderColor).toBe(theme.brandAmber);

        await fireEvent.press(view.getByTestId('machine-select-502'));
        expect(onSelectAsset).toHaveBeenCalledWith(502);
    });
});
