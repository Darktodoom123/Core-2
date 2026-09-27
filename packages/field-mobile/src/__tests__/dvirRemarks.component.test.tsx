import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { DvirScreen } from '../screens/DvirScreen';
import { takeWalkaroundPhotos } from './dvir-test-photos';

const renderReady = async (onSave = jest.fn()) => {
    const view = await render(
        <DvirScreen
            assetCode="CRN-501"
            initialMode="pre_trip"
            inspectorName="BJ Bello"
            onSaveInspectionRecord={onSave}
        />,
    );

    await fireEvent.changeText(view.getByTestId('input-engine-hours'), '1855');
    await fireEvent.press(view.getByTestId('dvir-attestation'));
    await takeWalkaroundPhotos(view);

    return view;
};

describe('DVIR remarks', () => {
    jest.setTimeout(15000);

    it('are optional on a clean pass', async () => {
        const onSave = jest.fn();
        const view = await renderReady(onSave);

        expect(view.getByText('REMARKS · OPTIONAL')).toBeTruthy();
        expect(view.queryByText(/SIGN-OFF/)).toBeNull();
        expect(view.getByTestId('complete-dvir-button')).toBeEnabled();

        await fireEvent.press(view.getByTestId('complete-dvir-button'));
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({ remarks: null }),
        );
    });

    it('are required once the unit is marked unsafe, and say what to write', async () => {
        const onSave = jest.fn();
        const view = await renderReady(onSave);

        await fireEvent.press(view.getByTestId('safety-status-unsafe'));

        expect(view.getByText('REMARKS · REQUIRED')).toBeTruthy();
        expect(
            view.getByText('Describe where the problem is and how bad it is.'),
        ).toBeTruthy();
        expect(view.getByTestId('complete-dvir-button')).toBeDisabled();

        await fireEvent.changeText(
            view.getByTestId('dvir-remarks-input'),
            '   ',
        );
        expect(view.getByTestId('complete-dvir-button')).toBeDisabled();

        await fireEvent.changeText(
            view.getByTestId('dvir-remarks-input'),
            'Hydraulic leak at the rear outrigger, dripping steadily.',
        );
        expect(view.getByTestId('complete-dvir-button')).toBeEnabled();
    });
});
