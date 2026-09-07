import {
    cleanup,
    fireEvent,
    render,
    waitFor,
} from '@testing-library/react-native/pure';
import React from 'react';
import { EquipmentInspectionScreen } from '../screens/EquipmentInspectionScreen';
import { FuelScreen } from '../screens/FuelScreen';
import { ApiClientError } from '../services/apiClient';
import { emptyFuelDraft } from '../storage/fuelDraftStore';
import type { FuelDraft, FuelDraftStore } from '../storage/fuelDraftStore';
import type { FuelApi, MobileFuelRequest } from '../types/fuel';

const request: MobileFuelRequest = {
    id: 10,
    reference: 'FUEL-10',
    client_request_id: null,
    quantity_litres: '50.00',
    fuel_type: 'diesel',
    purpose: 'Site work',
    status: 'submitted',
    decision_reason: null,
    operational_asset_id: 2,
    dispatch_job_id: null,
    asset: { id: 2, code: 'CRN-2', name: 'Crane', meter_type: 'engine_hours' },
    job: null,
    logs: [],
    can_record: false,
    created_at: '2026-09-07T04:00:00Z',
};

function setup(initial: MobileFuelRequest[] = []) {
    const api: jest.Mocked<FuelApi> = {
        fetchFuelOptions: jest.fn().mockResolvedValue({
            can_request: true,
            assets: [request.asset],
            jobs: [],
        }),
        fetchFuelRequests: jest
            .fn()
            .mockResolvedValue({ items: initial, nextPage: null }),
        fetchFuelRequest: jest.fn().mockResolvedValue(request),
        createFuelRequest: jest.fn().mockResolvedValue(request),
        recordFuel: jest.fn().mockResolvedValue({
            ...request,
            status: 'logged',
            can_record: false,
            logs: [
                {
                    id: 1,
                    quantity_litres: '49.00',
                    recorded_at: '2026-09-07T04:00:00Z',
                    total_cost: '2500',
                    odometer_km: null,
                    hour_meter: '100.5',
                    fuel_station: 'Station',
                    is_anomaly: false,
                    anomaly_reason: null,
                },
            ],
        }),
    };
    const drafts = new Map<number, FuelDraft>();
    const store: FuelDraftStore = {
        read: jest.fn(async (id) => drafts.get(id) ?? null),
        write: jest.fn(async (id, value) => {
            drafts.set(id, structuredClone(value));
        }),
        remove: jest.fn(async (id) => {
            drafts.delete(id);
        }),
    };

    return { api, store, drafts };
}

afterEach(async () => {
    await cleanup();
});

it('submits a mobile request only after persisting its retry identity', async () => {
    const { api, store } = setup();
    const screen = await render(
        <FuelScreen
            actorId={3}
            apiClient={api}
            draftStore={store}
            isOnline
            onBack={jest.fn()}
        />,
    );
    await waitFor(() =>
        expect(
            screen.getByRole('button', { name: 'Request fuel' }),
        ).toBeEnabled(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Request fuel' }));
    await fireEvent.changeText(
        screen.getByLabelText('Requested quantity (liters)'),
        '50',
    );
    await fireEvent.changeText(screen.getByLabelText('Purpose'), 'Site work');
    await fireEvent.press(
        screen.getByRole('button', { name: 'Submit fuel request' }),
    );
    await waitFor(() =>
        expect(
            screen.getByText('FUEL-10 submitted to the office.'),
        ).toBeTruthy(),
    );
    expect(api.createFuelRequest).toHaveBeenCalledWith(
        expect.objectContaining({
            quantity_litres: 50,
            purpose: 'Site work',
            client_request_id: expect.any(String),
        }),
    );
    expect(store.write).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
            pending: expect.objectContaining({ quantity_litres: 50 }),
        }),
    );
    expect(store.remove).toHaveBeenCalledWith(3);
});

it('retains a frozen request and reuses its UUID after an uncertain network response', async () => {
    const { api, store } = setup();
    api.createFuelRequest.mockRejectedValueOnce(
        new TypeError('Network failed'),
    );
    const screen = await render(
        <FuelScreen
            actorId={3}
            apiClient={api}
            draftStore={store}
            isOnline
            onBack={jest.fn()}
        />,
    );
    await waitFor(() =>
        expect(
            screen.getByRole('button', { name: 'Request fuel' }),
        ).toBeEnabled(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Request fuel' }));
    await fireEvent.changeText(
        screen.getByLabelText('Requested quantity (liters)'),
        '50',
    );
    await fireEvent.changeText(screen.getByLabelText('Purpose'), 'Site work');
    await fireEvent.press(
        screen.getByRole('button', { name: 'Submit fuel request' }),
    );
    await waitFor(() =>
        expect(
            screen.getByRole('button', { name: 'Retry saved request' }),
        ).toBeEnabled(),
    );
    expect(screen.getByLabelText('Purpose').props.editable).toBe(false);
    await fireEvent.press(
        screen.getByRole('button', { name: 'Retry saved request' }),
    );
    await waitFor(() => expect(api.createFuelRequest).toHaveBeenCalledTimes(2));
    expect(api.createFuelRequest.mock.calls[0][0]).toEqual(
        api.createFuelRequest.mock.calls[1][0],
    );
});

it('keeps offline drafts local and restores them only for their account', async () => {
    const { api, store, drafts } = setup();
    drafts.set(3, {
        ...emptyFuelDraft(),
        quantity: '25',
        purpose: 'Offline work',
    });
    const screen = await render(
        <FuelScreen
            actorId={3}
            apiClient={api}
            draftStore={store}
            isOnline={false}
            onBack={jest.fn()}
        />,
    );
    await waitFor(() =>
        expect(
            screen.getByRole('button', { name: 'Continue fuel draft' }),
        ).toBeEnabled(),
    );
    await fireEvent.press(
        screen.getByRole('button', { name: 'Continue fuel draft' }),
    );
    expect(screen.getByLabelText('Purpose').props.value).toBe('Offline work');
    expect(
        screen.getByRole('button', { name: 'Submit fuel request' }),
    ).toBeDisabled();
    expect(api.createFuelRequest).not.toHaveBeenCalled();
    expect(store.read).toHaveBeenCalledWith(3);
});

it('shows field validation errors without clearing entered values', async () => {
    const { api, store } = setup();
    api.createFuelRequest.mockRejectedValue(
        new ApiClientError('Invalid', 422, {
            validationErrors: { purpose: ['Explain the fuel purpose.'] },
        }),
    );
    const screen = await render(
        <FuelScreen
            actorId={3}
            apiClient={api}
            draftStore={store}
            isOnline
            onBack={jest.fn()}
        />,
    );
    await waitFor(() =>
        expect(
            screen.getByRole('button', { name: 'Request fuel' }),
        ).toBeEnabled(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Request fuel' }));
    await fireEvent.changeText(
        screen.getByLabelText('Requested quantity (liters)'),
        '50',
    );
    await fireEvent.changeText(screen.getByLabelText('Purpose'), 'Site work');
    await fireEvent.press(
        screen.getByRole('button', { name: 'Submit fuel request' }),
    );
    await waitFor(() =>
        expect(screen.getByText('Explain the fuel purpose.')).toBeTruthy(),
    );
    expect(screen.getByLabelText('Purpose').props.value).toBe('Site work');
    expect(screen.getByLabelText('Purpose').props.editable).toBe(true);
});

it('records actual liters and engine hours only for a verified request', async () => {
    const { api, store } = setup([
        { ...request, status: 'verified', can_record: true },
    ]);
    const screen = await render(
        <FuelScreen
            actorId={3}
            apiClient={api}
            draftStore={store}
            isOnline
            onBack={jest.fn()}
        />,
    );
    await waitFor(() =>
        expect(
            screen.getByRole('button', { name: 'View FUEL-10' }),
        ).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'View FUEL-10' }));
    await fireEvent.press(
        screen.getByRole('button', { name: 'Record refueling' }),
    );
    await fireEvent.changeText(
        screen.getByLabelText('Actual quantity (liters)'),
        '49',
    );
    await fireEvent.changeText(screen.getByLabelText('Engine hours'), '100.5');
    await fireEvent.press(
        screen.getByRole('button', { name: 'Save refueling' }),
    );
    await waitFor(() =>
        expect(
            screen.getByText('Refueling saved to Fuel Management.'),
        ).toBeTruthy(),
    );
    expect(api.recordFuel).toHaveBeenCalledWith(
        10,
        { quantity_litres: 49, hour_meter: 100.5 },
        undefined,
    );
    expect(
        screen.queryByRole('button', { name: 'Record refueling' }),
    ).toBeNull();
});

it('routes equipment fuel to the live workflow instead of sample logs', async () => {
    const open = jest.fn();
    const screen = await render(
        <EquipmentInspectionScreen assetCode="CRN-2" onOpenFuel={open} />,
    );
    await fireEvent.press(screen.getByTestId('tab-fuel'));
    expect(screen.queryByText('RCPT-PETRO-9921')).toBeNull();
    await fireEvent.press(
        screen.getByRole('button', { name: 'Open Fuel Management' }),
    );
    expect(open).toHaveBeenCalledTimes(1);
});
