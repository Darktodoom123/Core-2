import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { DvirScreen } from '../screens/DvirScreen';
import type { AssetAssignment } from '../types/index';
import { takeWalkaroundPhotos } from './dvir-test-photos';

const crane: AssetAssignment = {
    id: 1,
    operational_asset_id: 501,
    asset_code: 'CRN-501',
    asset_name: 'Tadano 50T',
    asset_kind: 'mobile_crane',
    engine_hours: 4820,
};

const renderDvir = (
    props: Partial<React.ComponentProps<typeof DvirScreen>> = {},
) =>
    render(
        <DvirScreen
            assetAssignments={[crane]}
            assetCode="CRN-501"
            initialMode="pre_trip"
            inspectorName="BJ Bello"
            selectedAssetId={501}
            {...props}
        />,
    );

describe('DVIR meter readings are the operator’s, never pre-filled', () => {
    jest.setTimeout(15000);

    it('starts with empty readings and will not complete until engine hours are entered', async () => {
        const onSave = jest.fn();
        const view = await renderDvir({ onSaveInspectionRecord: onSave });

        expect(view.getByTestId('input-odometer').props.value).toBe('');
        expect(view.getByTestId('input-engine-hours').props.value).toBe('');
        expect(view.getByText('Enter the engine hours reading.')).toBeTruthy();
        expect(view.getByTestId('complete-dvir-button')).toBeDisabled();

        await fireEvent.press(view.getByTestId('complete-dvir-button'));
        expect(onSave).not.toHaveBeenCalled();
    });

    it('shows the last recorded reading, labelled, and refuses a lower one', async () => {
        const view = await renderDvir();

        expect(view.getByText('Last recorded: 4,820 hrs')).toBeTruthy();

        await fireEvent.changeText(
            view.getByTestId('input-engine-hours'),
            '4700',
        );

        expect(
            view.getByText(
                "Engine hours can't be lower than the last recorded 4,820 hrs.",
            ),
        ).toBeTruthy();
        expect(view.getByTestId('complete-dvir-button')).toBeDisabled();
    });

    it('rejects readings that are not numbers', async () => {
        const view = await renderDvir();

        await fireEvent.changeText(
            view.getByTestId('input-engine-hours'),
            'abc',
        );
        expect(view.getByText('Engine hours must be a number.')).toBeTruthy();
        expect(view.getByTestId('complete-dvir-button')).toBeDisabled();

        await fireEvent.changeText(
            view.getByTestId('input-engine-hours'),
            '4830',
        );
        await fireEvent.changeText(view.getByTestId('input-odometer'), '-5');
        expect(
            view.getByText('Odometer must be a number of 0 or more.'),
        ).toBeTruthy();
        expect(view.getByTestId('complete-dvir-button')).toBeDisabled();
    });

    it('saves exactly what was entered: a blank odometer stays blank and no remarks are invented', async () => {
        const onSave = jest.fn();
        const view = await renderDvir({ onSaveInspectionRecord: onSave });
        await takeWalkaroundPhotos(view);

        await fireEvent.changeText(
            view.getByTestId('input-engine-hours'),
            '4831.5',
        );
        await fireEvent.press(view.getByTestId('dvir-attestation'));
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                engineHours: 4831.5,
                startingOdometerKm: null,
                remarks: null,
            }),
        );
    });

    it('clears readings and the confirmation when the operator switches unit', async () => {
        const truck: AssetAssignment = {
            id: 2,
            operational_asset_id: 502,
            asset_code: 'TRK-502',
            asset_name: 'Boom Truck',
            asset_kind: 'boom_truck',
        };
        const view = await renderDvir({
            assetAssignments: [crane, truck],
            selectedAssetId: null,
        });

        await fireEvent.press(view.getByTestId('dvir-select-asset-501'));
        await fireEvent.changeText(
            view.getByTestId('input-engine-hours'),
            '4830',
        );
        await fireEvent.changeText(view.getByTestId('input-odometer'), '120');
        await fireEvent.press(view.getByTestId('dvir-attestation'));

        await fireEvent.press(view.getByTestId('dvir-select-asset-502'));

        expect(view.getByTestId('input-engine-hours').props.value).toBe('');
        expect(view.getByTestId('input-odometer').props.value).toBe('');
        expect(
            view.getByTestId('dvir-attestation').props.accessibilityState,
        ).toMatchObject({ checked: false });
        expect(view.getByTestId('complete-dvir-button')).toBeDisabled();
    });
});
