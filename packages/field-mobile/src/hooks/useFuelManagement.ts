import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiClientError } from '../services/apiClient';
import { createCommandId } from '../services/commandOutbox';
import { durableAttachmentStorage } from '../services/durableAttachmentStorage';
import { emptyFuelDraft, fuelDraftStore } from '../storage/fuelDraftStore';
import type { FuelDraft, FuelDraftStore } from '../storage/fuelDraftStore';
import type { OutboxCommand } from '../types/index';
import type {
    FuelApi,
    FuelLogCommandPayload,
    FuelOfflineSnapshot,
    FuelOptions,
    FuelReceiptUpload,
    MobileFuelRequest,
    RecordFuelPayload,
} from '../types/fuel';

export interface FuelCommandQueue {
    enqueueSubmitFuelRequest(payload: {
        client_request_id: string;
        quantity_litres: number;
        fuel_type: 'diesel' | 'gasoline';
        purpose: string;
        operational_asset_id?: number;
        dispatch_job_id?: number;
    }): Promise<OutboxCommand>;
    enqueueRecordFuelLog(payload: FuelLogCommandPayload): Promise<OutboxCommand>;
    getCommand(id: string): OutboxCommand | undefined;
    getCommands(): OutboxCommand[];
    subscribe(listener: (commands: OutboxCommand[]) => void): () => void;
}

export interface FuelSubmitResult {
    status: 'queued';
    commandId: string;
    request: MobileFuelRequest | null;
}

export function fuelErrorMessage(error: unknown): string {
    if (error instanceof ApiClientError) {
        const details = Object.values(error.validationErrors ?? {})
            .flat()
            .join('\n');

        return (
            details ||
            (error.status === 401
                ? 'Your session expired. Sign in again to continue.'
                : error.message)
        );
    }

    return 'Could not reach the server. Check your connection and retry.';
}

function isActionableOutboxState(state: OutboxCommand['state'] | undefined) {
    return (
        state === 'failed' ||
        state === 'conflict' ||
        state === 'unresolved' ||
        state === 'expired'
    );
}

export function useFuelManagement(
    api: FuelApi,
    actorId: number,
    isOnline: boolean | null,
    commandOutbox: FuelCommandQueue,
    isOutboxReady: boolean,
    syncQueue: () => Promise<unknown>,
    store: FuelDraftStore = fuelDraftStore,
) {
    const [requests, setRequests] = useState<MobileFuelRequest[]>([]);
    const [options, setOptions] = useState<FuelOptions | null>(null);
    const [draft, setDraft] = useState<FuelDraft>(emptyFuelDraft);
    const [draftReady, setDraftReady] = useState(false);
    const [draftNotice, setDraftNotice] = useState('Loading saved draft…');
    const [cacheNotice, setCacheNotice] = useState<string | null>(null);
    const [cacheWritableReady, setCacheWritableReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [nextPage, setNextPage] = useState<number | null>(null);
    const mounted = useRef(true);
    const requestVersion = useRef(0);
    const mutationLock = useRef(false);

    useEffect(() => {
        mounted.current = true;
        let ignore = false;

        void store
            .read(actorId)
            .then((saved) => {
                if (!ignore) {
                    setDraft(saved ?? emptyFuelDraft());
                    setDraftReady(true);
                    setDraftNotice(
                        saved ? 'Draft restored from this device.' : '',
                    );
                }
            })
            .catch(() => {
                if (!ignore) {
                    setDraftNotice(
                        'Device storage is unavailable. Fuel submission is disabled until the draft can be saved.',
                    );
                }
            });

        void store
            .readOfflineSnapshot(actorId)
            .then((snapshot) => {
                if (ignore) {
                    return;
                }

                if (snapshot) {
                    setRequests(snapshot.requests);
                    setOptions(snapshot.options);
                    setNextPage(snapshot.nextPage);
                }

                setCacheWritableReady(true);
            })
            .catch(() => {
                if (!ignore) {
                    setCacheNotice(
                        'Saved fuel records could not be read from this device. Reconnect to reload them.',
                    );
                }
            });

        return () => {
            ignore = true;
            mounted.current = false;
            requestVersion.current += 1;
        };
    }, [actorId, store]);

    useEffect(() => {
        if (!draftReady) {
            return;
        }

        let ignore = false;
        const timer = setTimeout(() => {
            void store
                .write(actorId, draft)
                .then(() => {
                    if (!ignore) {
                        setDraftNotice(
                            draft.quantity || draft.purpose || draft.pending
                                ? 'Draft saved on this device.'
                                : '',
                        );
                    }
                })
                .catch(() => {
                    if (!ignore) {
                        setDraftNotice(
                            'Draft could not be saved on this device. Keep this screen open and retry.',
                        );
                    }
                });
        }, 250);

        return () => {
            ignore = true;
            clearTimeout(timer);
        };
    }, [actorId, draft, draftReady, store]);

    useEffect(() => {
        if (!cacheWritableReady) {
            return;
        }

        let ignore = false;
        const snapshot: FuelOfflineSnapshot = { options, requests, nextPage };
        void store
            .writeOfflineSnapshot(actorId, snapshot)
            .then(() => {
                if (!ignore) {
                    setCacheNotice(null);
                }
            })
            .catch(() => {
                if (!ignore) {
                    setCacheNotice(
                        'Fuel updates are available now but could not be cached for offline use.',
                    );
                }
            });

        return () => {
            ignore = true;
        };
    }, [actorId, cacheWritableReady, nextPage, options, requests, store]);

    const refresh = useCallback(async () => {
        if (isOnline !== true) {
            return;
        }

        const version = ++requestVersion.current;
        setLoading(true);

        try {
            const [page, available] = await Promise.all([
                api.fetchFuelRequests(),
                api.fetchFuelOptions(),
            ]);

            if (mounted.current && version === requestVersion.current) {
                setRequests(page.items);
                setNextPage(page.nextPage);
                setOptions(available);
                setCacheWritableReady(true);
                setError(null);
            }
        } catch (e) {
            if (mounted.current && version === requestVersion.current) {
                setError(fuelErrorMessage(e));
            }
        } finally {
            if (mounted.current && version === requestVersion.current) {
                setLoading(false);
            }
        }
    }, [api, isOnline]);

    useEffect(() => {
        queueMicrotask(() => {
            void refresh();
        });
    }, [refresh]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                void refresh();
            }
        });

        return () => subscription.remove();
    }, [refresh]);

    useEffect(() => {
        const completedFuelCommands = new Set(
            commandOutbox
                .getCommands()
                .filter(
                    (command) =>
                        (command.type === 'submit_fuel_request' ||
                            command.type === 'record_fuel_log') &&
                        command.state === 'completed',
                )
                .map((command) => command.id),
        );

        return commandOutbox.subscribe((commands) => {
            let shouldRefresh = false;

            for (const command of commands) {
                if (
                    (command.type === 'submit_fuel_request' ||
                        command.type === 'record_fuel_log') &&
                    command.state === 'completed' &&
                    !completedFuelCommands.has(command.id)
                ) {
                    completedFuelCommands.add(command.id);
                    shouldRefresh = true;
                }
            }

            if (shouldRefresh && isOnline === true) {
                void refresh();
            }
        });
    }, [commandOutbox, isOnline, refresh]);

    const loadMore = async () => {
        if (!nextPage || loading || isOnline !== true) {
            return;
        }

        const version = ++requestVersion.current;
        setLoading(true);

        try {
            const page = await api.fetchFuelRequests(nextPage);

            if (mounted.current && version === requestVersion.current) {
                setRequests((items) => [
                    ...items,
                    ...page.items.filter(
                        (item) =>
                            !items.some((existing) => existing.id === item.id),
                    ),
                ]);
                setNextPage(page.nextPage);
            }
        } catch (e) {
            if (mounted.current) {
                setError(fuelErrorMessage(e));
            }
        } finally {
            if (mounted.current && version === requestVersion.current) {
                setLoading(false);
            }
        }
    };

    const updateDraft = (patch: Partial<FuelDraft>) => {
        if (mutationLock.current || draft.pending) {
            return;
        }

        setDraft((value) => ({ ...value, ...patch }));
    };

    const submit = async (): Promise<FuelSubmitResult | null> => {
        if (
            mutationLock.current ||
            !draftReady ||
            !isOutboxReady ||
            options?.can_request !== true
        ) {
            return null;
        }

        const quantity = Number(draft.quantity);

        if (
            !draft.pending &&
            (!Number.isFinite(quantity) ||
                quantity <= 0 ||
                quantity > 100000 ||
                !draft.purpose.trim())
        ) {
            setError(
                'Enter a quantity between 0.01 and 100,000 liters and a purpose.',
            );

            return null;
        }

        mutationLock.current = true;
        setBusy(true);
        setError(null);
        setNotice(null);
        let snapshot = draft;

        try {
            snapshot = {
                ...draft,
                pending: draft.pending ?? {
                    client_request_id: await createCommandId(),
                    quantity_litres: quantity,
                    fuel_type: draft.fuelType,
                    purpose: draft.purpose.trim(),
                    ...(draft.assetId
                        ? { operational_asset_id: draft.assetId }
                        : {}),
                    ...(draft.jobId ? { dispatch_job_id: draft.jobId } : {}),
                },
            };
            await store.write(actorId, snapshot);

            if (!mounted.current) {
                return null;
            }

            setDraft(snapshot);
            const command = await commandOutbox.enqueueSubmitFuelRequest(
                snapshot.pending!,
            );
            await store.remove(actorId);

            if (mounted.current) {
                setDraft(emptyFuelDraft());
                setNotice('Fuel request saved to the on-device sync queue.');
            }

            let request: MobileFuelRequest | null = null;

            if (isOnline === true) {
                try {
                    await syncQueue();
                    const state = commandOutbox.getCommand(command.id);

                    if (state?.state === 'completed') {
                        const page = await api.fetchFuelRequests();
                        request =
                            page.items.find(
                                (item) =>
                                    item.client_request_id ===
                                    snapshot.pending?.client_request_id,
                            ) ?? null;
                        setRequests((items) => [
                            ...(request ? [request] : []),
                            ...items.filter(
                                (item) => item.id !== request?.id,
                            ),
                        ]);
                        setNextPage(page.nextPage);

                        if (request) {
                            setNotice(`${request.reference} submitted to the office.`);
                        }
                    } else if (isActionableOutboxState(state?.state)) {
                        setError(
                            state?.error?.message ??
                                'The fuel request needs attention in Sync status.',
                        );
                    }
                } catch {
                    // The durable command remains queued for the normal retry loop.
                }
            } else if (mounted.current) {
                setNotice(
                    'Fuel request saved on this device. It will sync when the connection returns.',
                );
            }

            return { status: 'queued', commandId: command.id, request };
        } catch (e) {
            if (e instanceof ApiClientError && e.status === 422) {
                snapshot = { ...snapshot, pending: null };
                await store.write(actorId, snapshot).catch(() => undefined);

                if (mounted.current) {
                    setDraft(snapshot);
                }
            }

            if (mounted.current) {
                setError(fuelErrorMessage(e));
            }

            return null;
        } finally {
            mutationLock.current = false;

            if (mounted.current) {
                setBusy(false);
            }
        }
    };

    const record = async (
        id: number,
        payload: RecordFuelPayload,
        receipt?: FuelReceiptUpload,
    ): Promise<boolean> => {
        if (mutationLock.current || !isOutboxReady) {
            return false;
        }

        const request = requests.find((item) => item.id === id);

        if (!request?.can_record || request.status !== 'verified') {
            setError(
                'This request is not verified for fuel logging. Refresh Fuel Management before recording refueling.',
            );

            return false;
        }

        mutationLock.current = true;
        setBusy(true);
        setError(null);
        setNotice(null);
        let durableReceipt: FuelReceiptUpload | undefined;

        try {
            if (receipt) {
                const stored =
                    await durableAttachmentStorage.saveAttachmentDurably(
                        { uri: receipt.uri, fileName: receipt.name },
                        actorId,
                    );
                durableReceipt = {
                    uri: stored.uri,
                    name: stored.fileName,
                    type: receipt.type,
                };
            }

            const command = await commandOutbox.enqueueRecordFuelLog({
                fuel_request_id: id,
                details: payload,
                receipt: durableReceipt,
            });

            if (mounted.current) {
                setNotice(
                    isOnline === true
                        ? 'Fuel log queued for synchronization.'
                        : 'Fuel log and receipt saved on this device. They will sync when the connection returns.',
                );
            }

            if (isOnline === true) {
                try {
                    await syncQueue();
                    const state = commandOutbox.getCommand(command.id);

                    if (state?.state === 'completed') {
                        const updated = await api.fetchFuelRequest(id);
                        setRequests((items) =>
                            items.map((item) => (item.id === id ? updated : item)),
                        );

                        if (updated.status === 'logged') {
                            setNotice(
                                durableReceipt
                                    ? 'Refueling and receipt saved to Fuel Management.'
                                    : 'Refueling saved to Fuel Management.',
                            );
                        }
                    } else if (isActionableOutboxState(state?.state)) {
                        setError(
                            state?.error?.message ??
                                'The fuel log needs attention in Sync status.',
                        );
                    }
                } catch {
                    // Keep the staged file and command for automatic retry.
                }
            }

            return true;
        } catch (e) {
            if (durableReceipt) {
                await durableAttachmentStorage.deleteAttachment(
                    durableReceipt.uri,
                    commandOutbox.getCommands(),
                );
            }

            if (mounted.current) {
                setError(fuelErrorMessage(e));
            }

            return false;
        } finally {
            mutationLock.current = false;

            if (mounted.current) {
                setBusy(false);
            }
        }
    };

    return {
        requests,
        options,
        draft,
        draftReady,
        draftNotice,
        cacheNotice,
        error,
        notice,
        loading,
        busy,
        nextPage,
        refresh,
        loadMore,
        updateDraft,
        submit,
        record,
    };
}
