import {
    fireEvent,
    render,
    waitFor,
    within,
} from '@testing-library/react-native';
import React from 'react';
import { DvirScreen } from '../screens/DvirScreen';
import { FieldApiClient } from '../services/apiClient';
import { takeWalkaroundPhotos } from './dvir-test-photos';

const SAMPLE_IDS = [
    'DVIR-2026-0831-01',
    'DVIR-2026-0830-02',
    'DVIR-2026-0828-01',
    'DVIR-2026-0818-01',
];

const clientWith = (fetchFn: jest.Mock) =>
    new FieldApiClient({
        baseUrl: 'https://api.example.com',
        getToken: () => 'token',
        fetchFn: fetchFn as unknown as typeof fetch,
    });

const expectNoSampleRecords = (view: Awaited<ReturnType<typeof render>>) => {
    for (const id of SAMPLE_IDS) {
        expect(view.queryByTestId(`history-card-${id}`)).toBeNull();
    }

    expect(view.queryByText(/Alex Rivera/)).toBeNull();
};

describe('DVIR history only shows real inspections', () => {
    jest.setTimeout(15000);

    it('shows no sample inspections and makes no empty claims while loading', async () => {
        const never = jest.fn(() => new Promise(() => undefined));
        const view = await render(
            <DvirScreen apiClient={clientWith(never)} assetCode="CRN-777" />,
        );

        expect(view.getByText('History (0)')).toBeTruthy();
        await fireEvent.press(view.getByTestId('tab-history'));

        expect(view.getByTestId('dvir-history-loading')).toBeTruthy();
        expectNoSampleRecords(view);
        expect(view.queryByText(/No inspections logged today/)).toBeNull();
        expect(view.queryByText(/No prior inspections/)).toBeNull();
    });

    it('says history did not load, without inventing records or empty claims, when the server fails', async () => {
        const failing = jest.fn().mockRejectedValue(new Error('offline'));
        const view = await render(
            <DvirScreen apiClient={clientWith(failing)} assetCode="CRN-777" />,
        );

        await fireEvent.press(view.getByTestId('tab-history'));

        expect(await view.findByText(/DVIR history didn't load/)).toBeTruthy();
        expectNoSampleRecords(view);
        expect(view.queryByText(/No inspections logged today/)).toBeNull();
        expect(view.queryByText(/cached/i)).toBeNull();
    });

    it('offers a retry that loads the real records', async () => {
        const fetchFn = jest
            .fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValue({
                ok: true,
                status: 200,
                text: async () =>
                    JSON.stringify({
                        data: {
                            days: 30,
                            inspections: [
                                {
                                    id: 'DVIR-000042',
                                    type: 'pre_trip',
                                    asset_code: 'CRN-777',
                                    asset_name: '70T Grove Mobile Crane',
                                    inspector_name: 'BJ Bello',
                                    has_defects: false,
                                    critical_defects_count: 0,
                                    completed_at: new Date().toISOString(),
                                    checks: [],
                                },
                            ],
                        },
                    }),
            });
        const view = await render(
            <DvirScreen apiClient={clientWith(fetchFn)} assetCode="CRN-777" />,
        );

        await fireEvent.press(view.getByTestId('tab-history'));
        await fireEvent.press(await view.findByTestId('dvir-history-retry'));

        expect(
            await view.findByTestId('history-card-DVIR-000042'),
        ).toBeTruthy();
        expect(view.queryByText(/DVIR history didn't load/)).toBeNull();
    });

    it('marks an inspection saved on the phone as not yet on the server', async () => {
        const view = await render(
            <DvirScreen
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
                inspectorName="BJ Bello"
            />,
        );
        await takeWalkaroundPhotos(view);

        await fireEvent.changeText(view.getByTestId('input-odometer'), '42200');
        await fireEvent.changeText(
            view.getByTestId('input-engine-hours'),
            '1855.0',
        );
        await fireEvent.press(view.getByTestId('dvir-attestation'));
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        // Nothing reached a server, so the screen must not say it synced.
        expect(view.queryByText(/Synced/)).toBeNull();
        expect(view.getByText('Saved · Back to home')).toBeTruthy();

        await waitFor(() => expect(view.getByText('History (1)')).toBeTruthy());
        await fireEvent.press(view.getByTestId('tab-history'));

        const card = view.getAllByTestId(/^history-card-DVIR-/)[0];
        expect(within(card).getByText('Saved on this phone')).toBeTruthy();
        expectNoSampleRecords(view);
    });
});
