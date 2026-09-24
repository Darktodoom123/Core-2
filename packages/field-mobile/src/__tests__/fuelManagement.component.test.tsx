import {
    act,
    cleanup,
    fireEvent,
    render,
    waitFor,
} from '@testing-library/react-native/pure';
import React from 'react';
import * as ImagePicker from 'expo-image-picker';
import { EquipmentInspectionScreen } from '../screens/EquipmentInspectionScreen';
import { FuelScreen } from '../screens/FuelScreen';
import { ApiClientError } from '../services/apiClient';
import { durableAttachmentStorage } from '../services/durableAttachmentStorage';
import { emptyFuelDraft } from '../storage/fuelDraftStore';
import type { FuelDraft, FuelDraftStore } from '../storage/fuelDraftStore';
import type { FuelCommandQueue } from '../hooks/useFuelManagement';
import type { OutboxCommand } from '../types/index';
import type {
    FuelApi,
    FuelOfflineSnapshot,
    MobileFuelRequest,
} from '../types/fuel';

jest.mock('expo-image-picker', () => ({
    requestCameraPermissionsAsync: jest
        .fn()
        .mockResolvedValue({ status: 'granted' }),
    requestMediaLibraryPermissionsAsync: jest
        .fn()
        .mockResolvedValue({ status: 'granted' }),
    launchCameraAsync: jest
        .fn()
        .mockResolvedValue({ canceled: true, assets: [] }),
    launchImageLibraryAsync: jest.fn().mockResolvedValue({
        canceled: false,
        assets: [
            {
                uri: 'file:///fuel-receipt.jpg',
                fileName: 'fuel-receipt.jpg',
                fileSize: 1024,
            },
        ],
    }),
}));

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
    let serverRequests = [...initial];
    const api: jest.Mocked<FuelApi> = {
        fetchFuelOptions: jest.fn().mockResolvedValue({
            can_request: true,
            assets: [request.asset],
            jobs: [],
        }),
        fetchFuelRequests: jest.fn(async () => ({
            items: [...serverRequests],
            nextPage: null,
        })),
        fetchFuelRequest: jest.fn(async (id) =>
            serverRequests.find((item) => item.id === id) ?? request,
        ),
        createFuelRequest: jest.fn(async (payload) => {
            const created = {
                ...request,
                client_request_id: payload.client_request_id,
            };
            serverRequests = [created, ...serverRequests];

            return created;
        }),
        recordFuel: jest.fn(async (id, _payload, receipt) => {
            const updated = {
                ...(serverRequests.find((item) => item.id === id) ?? request),
                status: 'logged' as const,
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
                        has_receipt: !!receipt,
                    },
                ],
            };
            serverRequests = serverRequests.map((item) =>
                item.id === id ? updated : item,
            );

            return updated;
        }),
    };
    const drafts = new Map<number, FuelDraft>();
    const offlineCache = new Map<number, FuelOfflineSnapshot>();
    const store: FuelDraftStore = {
        read: jest.fn(async (id) => drafts.get(id) ?? null),
        write: jest.fn(async (id, value) => {
            drafts.set(id, structuredClone(value));
        }),
        remove: jest.fn(async (id) => {
            drafts.delete(id);
        }),
        readOfflineSnapshot: jest.fn(async (id) =>
            offlineCache.get(id) ?? {
                options: {
                    can_request: true,
                    assets: [request.asset!],
                    jobs: [],
                },
                requests: [...initial],
                nextPage: null,
            },
        ),
        writeOfflineSnapshot: jest.fn(async (id, snapshot) => {
            offlineCache.set(id, structuredClone(snapshot));
        }),
    };

    const commands: OutboxCommand[] = [];
    const listeners = new Set<(items: OutboxCommand[]) => void>();
    let commandSequence = 0;
    const publish = () => {
        for (const listener of listeners) {
            listener([...commands]);
        }
    };
    const addCommand = async (
        type: 'submit_fuel_request' | 'record_fuel_log',
        payload: Record<string, unknown>,
    ): Promise<OutboxCommand> => {
        const existing = commands.find(
            (item) =>
                item.type === type &&
                item.state !== 'completed' &&
                JSON.stringify(item.payload) === JSON.stringify(payload),
        );
        if (existing) {
            return existing;
        }

        commandSequence += 1;
        const id = `00000000-0000-4000-8000-${String(commandSequence).padStart(12, '0')}`;
        const command: OutboxCommand = {
            id,
            actorId: 3,
            type,
            payload,
            payloadHash: JSON.stringify(payload),
            state: 'queued',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            attempts: 0,
        };
        commands.push(command);
        publish();

        return command;
    };
    const commandOutbox: FuelCommandQueue = {
        enqueueSubmitFuelRequest: jest.fn((payload) =>
            addCommand('submit_fuel_request', payload as unknown as Record<string, unknown>),
        ),
        enqueueRecordFuelLog: jest.fn((payload) =>
            addCommand('record_fuel_log', payload as unknown as Record<string, unknown>),
        ),
        getCommand: jest.fn((id) => commands.find((item) => item.id === id)),
        getCommands: jest.fn(() => [...commands]),
        subscribe: jest.fn((listener) => {
            listeners.add(listener);
            listener([...commands]);

            return () => listeners.delete(listener);
        }),
    };
    const syncQueue = jest.fn(async () => {
        for (const command of commands) {
            if (command.state !== 'queued' && command.state !== 'failed') {
                continue;
            }
            command.state = 'syncing';
            command.attempts += 1;
            publish();

            try {
                if (command.type === 'submit_fuel_request') {
                    await api.createFuelRequest(
                        command.payload as unknown as Parameters<FuelApi['createFuelRequest']>[0],
                        command.id,
                    );
                } else {
                    const log = command.payload as unknown as {
                        fuel_request_id: number;
                        details: Parameters<FuelApi['recordFuel']>[1];
                        receipt?: Parameters<FuelApi['recordFuel']>[2];
                    };
                    await api.recordFuel(
                        log.fuel_request_id,
                        log.details,
                        log.receipt,
                        command.id,
                    );
                }
                command.state = 'completed';
                command.completedAt = new Date().toISOString();
                command.error = null;
            } catch (error) {
                command.state = 'failed';
                command.error = {
                    message:
                        error instanceof ApiClientError
                            ? Object.values(error.validationErrors ?? {})
                                  .flat()
                                  .join('\n') || error.message
                            : error instanceof Error
                              ? error.message
                              : 'Sync failed.',
                    code:
                        error instanceof ApiClientError
                            ? `HTTP_${error.status}`
                            : 'NETWORK_ERROR',
                    retryable: true,
                };
            }
            command.updatedAt = new Date().toISOString();
            publish();
        }
    });

    return { api, store, drafts, commandOutbox, syncQueue };
}

async function renderFuelScreen({
    api,
    store,
    commandOutbox,
    syncQueue,
    isOnline,
}: {
    api: jest.Mocked<FuelApi>;
    store: FuelDraftStore;
    commandOutbox: FuelCommandQueue;
    syncQueue: () => Promise<unknown>;
    isOnline: boolean;
}) {
    return render(
        <FuelScreen
            actorId={3}
            apiClient={api}
            commandOutbox={commandOutbox}
            draftStore={store}
            isOnline={isOnline}
            isOutboxReady
            onBack={jest.fn()}
            syncQueue={syncQueue}
        />,
    );
}

afterEach(async () => {
    await cleanup();
});

it('submits a mobile request only after persisting its retry identity', async () => {
    const { api, store, commandOutbox, syncQueue } = setup();
    const screen = await renderFuelScreen({
        api,
        store,
        commandOutbox,
        syncQueue,
        isOnline: true,
    });
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
        expect.any(String),
    );
    expect(store.write).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
            pending: expect.objectContaining({ quantity_litres: 50 }),
        }),
    );
    expect(store.remove).toHaveBeenCalledWith(3);
});

it('keeps an uncertain fuel request in the outbox and reuses its command id on retry', async () => {
    const { api, store, commandOutbox, syncQueue } = setup();
    api.createFuelRequest.mockRejectedValueOnce(
        new TypeError('Network failed'),
    );
    const screen = await renderFuelScreen({
        api,
        store,
        commandOutbox,
        syncQueue,
        isOnline: true,
    });
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
    await waitFor(() => expect(api.createFuelRequest).toHaveBeenCalledTimes(1));
    const queued = commandOutbox.getCommands()[0];
    expect(queued?.type).toBe('submit_fuel_request');
    expect(queued?.state).toBe('failed');
    expect(queued?.payload).toEqual(
        expect.objectContaining({ quantity_litres: 50, purpose: 'Site work' }),
    );
    await act(async () => {
        await syncQueue();
    });
    await waitFor(() => expect(api.createFuelRequest).toHaveBeenCalledTimes(2));
    expect(api.createFuelRequest.mock.calls[0][0]).toEqual(
        api.createFuelRequest.mock.calls[1][0],
    );
    expect(api.createFuelRequest.mock.calls[0][1]).toBe(
        api.createFuelRequest.mock.calls[1][1],
    );
    expect(commandOutbox.getCommand(queued!.id)?.state).toBe('completed');
});

it('restores an offline draft and queues the request without a network call', async () => {
    const { api, store, drafts, commandOutbox, syncQueue } = setup();
    drafts.set(3, {
        ...emptyFuelDraft(),
        quantity: '25',
        purpose: 'Offline work',
    });
    const screen = await renderFuelScreen({
        api,
        store,
        commandOutbox,
        syncQueue,
        isOnline: false,
    });
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
    ).toBeEnabled();
    await fireEvent.press(
        screen.getByRole('button', { name: 'Submit fuel request' }),
    );
    await waitFor(() =>
        expect(
            screen.getByText(
                'Fuel request saved on this device. It will sync when the connection returns.',
            ),
        ).toBeTruthy(),
    );
    expect(commandOutbox.enqueueSubmitFuelRequest).toHaveBeenCalledTimes(1);
    expect(commandOutbox.getCommands()[0]?.state).toBe('queued');
    expect(api.createFuelRequest).not.toHaveBeenCalled();
    expect(store.read).toHaveBeenCalledWith(3);
});

it('surfaces server validation feedback and keeps the rejected payload in Sync status', async () => {
    const { api, store, commandOutbox, syncQueue } = setup();
    api.createFuelRequest.mockRejectedValue(
        new ApiClientError('Invalid', 422, {
            validationErrors: { purpose: ['Explain the fuel purpose.'] },
        }),
    );
    const screen = await renderFuelScreen({
        api,
        store,
        commandOutbox,
        syncQueue,
        isOnline: true,
    });
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
    expect(commandOutbox.getCommands()[0]?.state).toBe('failed');
    expect(commandOutbox.getCommands()[0]?.payload).toEqual(
        expect.objectContaining({ purpose: 'Site work' }),
    );
});

it('records actual liters and engine hours only for a verified request', async () => {
    const { api, store, commandOutbox, syncQueue } = setup([
        { ...request, status: 'verified', can_record: true },
    ]);
    const screen = await renderFuelScreen({
        api,
        store,
        commandOutbox,
        syncQueue,
        isOnline: true,
    });
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
        expect.any(String),
    );
    expect(
        screen.queryByRole('button', { name: 'Record refueling' }),
    ).toBeNull();
});

it('uploads a selected receipt from the canonical Fuel Management screen', async () => {
    const { api, store, commandOutbox, syncQueue } = setup([
        { ...request, status: 'verified', can_record: true },
    ]);
    const screen = await renderFuelScreen({
        api,
        store,
        commandOutbox,
        syncQueue,
        isOnline: true,
    });
    await waitFor(() =>
        expect(
            screen.getByRole('button', { name: 'View FUEL-10' }),
        ).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'View FUEL-10' }));
    await fireEvent.press(
        screen.getByRole('button', { name: 'Record refueling' }),
    );
    await fireEvent.press(
        screen.getByTestId('fuel-receipt-picker-choose-gallery'),
    );
    await waitFor(() =>
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled(),
    );
    await fireEvent.changeText(
        screen.getByLabelText('Actual quantity (liters)'),
        '49',
    );
    await fireEvent.changeText(screen.getByLabelText('Engine hours'), '100.5');
    await fireEvent.press(screen.getByTestId('fuel-save-log-button'));
    await waitFor(() =>
        expect(api.recordFuel).toHaveBeenCalledWith(
            10,
            { quantity_litres: 49, hour_meter: 100.5 },
            expect.objectContaining({
                uri: expect.stringContaining('/attachments/actor_3/'),
                name: expect.stringContaining('fuel-receipt.jpg'),
                type: 'image/jpeg',
            }),
            expect.any(String),
        ),
    );
    const logCommand = commandOutbox.getCommands().find(
        (item) => item.type === 'record_fuel_log',
    );
    expect(logCommand?.state).toBe('completed');
    expect(
        durableAttachmentStorage.isDurableUri(
            String((logCommand?.payload.receipt as { uri: string }).uri),
        ),
    ).toBe(true);
});

it('keeps an offline fuel log and its receipt in the durable outbox', async () => {
    const { api, store, commandOutbox, syncQueue } = setup([
        { ...request, status: 'verified', can_record: true },
    ]);
    const screen = await renderFuelScreen({
        api,
        store,
        commandOutbox,
        syncQueue,
        isOnline: false,
    });
    await waitFor(() =>
        expect(screen.getByRole('button', { name: 'View FUEL-10' })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'View FUEL-10' }));
    await fireEvent.press(
        screen.getByRole('button', { name: 'Record refueling' }),
    );
    await fireEvent.press(
        screen.getByTestId('fuel-receipt-picker-choose-gallery'),
    );
    await waitFor(() =>
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled(),
    );
    await fireEvent.changeText(
        screen.getByLabelText('Actual quantity (liters)'),
        '49',
    );
    await fireEvent.changeText(screen.getByLabelText('Engine hours'), '100.5');
    await fireEvent.press(screen.getByTestId('fuel-save-log-button'));
    await waitFor(() =>
        expect(
            screen.getByText(
                'Fuel log and receipt saved on this device. They will sync when the connection returns.',
            ),
        ).toBeTruthy(),
    );

    const command = commandOutbox.getCommands().find(
        (item) => item.type === 'record_fuel_log',
    );
    expect(command?.state).toBe('queued');
    expect(
        durableAttachmentStorage.isDurableUri(
            String((command?.payload.receipt as { uri: string }).uri),
        ),
    ).toBe(true);
    expect(api.recordFuel).not.toHaveBeenCalled();
});

it('routes equipment fuel to the live workflow instead of sample logs', async () => {
    const open = jest.fn();
    const screen = await render(
        <EquipmentInspectionScreen assetCode="CRN-2" onOpenFuel={open} />,
    );
    await fireEvent.press(screen.getByTestId('tab-fuel'));
    expect(screen.getByTestId('fuel-management-link')).toBeTruthy();
    expect(screen.queryByText('RCPT-PETRO-9921')).toBeNull();
    expect(screen.queryByText('Fuel Receipt & Dispense Logging')).toBeNull();
    expect(screen.queryByTestId('fuel-liters-input')).toBeNull();
    await fireEvent.press(
        screen.getByRole('button', { name: 'Open Fuel Management' }),
    );
    expect(open).toHaveBeenCalledTimes(1);
});
