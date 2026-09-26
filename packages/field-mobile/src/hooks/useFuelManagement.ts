import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiClientError } from '../services/apiClient';
import { createCommandId } from '../services/commandOutbox';
import {
    AttachmentStorageError,
    durableAttachmentStorage,
} from '../services/durableAttachmentStorage';
import { emptyFuelDraft, fuelDraftStore } from '../storage/fuelDraftStore';
import type { FuelDraft, FuelDraftStore } from '../storage/fuelDraftStore';
import type {
    CreateFuelPayload,
    FuelApi,
    FuelLogCommandPayload,
    FuelOfflineSnapshot,
    FuelOptions,
    FuelReceiptUpload,
    MobileFuelRequest,
    RecordFuelPayload,
    WithdrawFuelPayload,
} from '../types/fuel';
import type { OutboxCommand } from '../types/index';

export interface FuelCommandQueue {
    enqueueSubmitFuelRequest(
        payload: CreateFuelPayload,
    ): Promise<OutboxCommand>;
    enqueueRecordFuelLog(
        payload: FuelLogCommandPayload,
    ): Promise<OutboxCommand>;
    enqueueWithdrawFuelRequest?(
        payload: WithdrawFuelPayload,
    ): Promise<OutboxCommand>;
    getCommand(id: string): OutboxCommand | undefined;
    getCommands(): OutboxCommand[];
    subscribe(listener: (commands: OutboxCommand[]) => void): () => void;
}

export interface FuelSubmitResult {
    status: 'queued';
    commandId: string;
    request: MobileFuelRequest | null;
}

/** A request that is still in the on-device outbox and not yet on the server. */
export interface QueuedFuelRequest {
    commandId: string;
    state: OutboxCommand['state'];
    payload: CreateFuelPayload;
    error: string | null;
    createdAt: string;
}

export interface FuelFieldErrors {
    quantity?: string;
    purpose?: string;
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

    if (error instanceof AttachmentStorageError) {
        return error.message;
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

const FUEL_COMMAND_TYPES = new Set<OutboxCommand['type']>([
    'submit_fuel_request',
    'record_fuel_log',
    'withdraw_fuel_request',
]);

const DEVICE_QUEUE_NOTICE_MARKER = 'on this device';

function hasDraftContent(draft: FuelDraft): boolean {
    return Boolean(draft.quantity || draft.purpose || draft.pending);
}

/**
 * Picks the operator's current unit and job: the server-resolved active
 * assignment first, otherwise the only assigned unit/job.
 */
export function defaultFuelContext(options: FuelOptions | null): {
    assetId: number | null;
    jobId: number | null;
} {
    if (!options) {
        return { assetId: null, jobId: null };
    }

    const assetIds = options.assets.map((asset) => asset.id);
    const serverAsset = options.defaults?.operational_asset_id ?? null;
    const assetId =
        serverAsset !== null && assetIds.includes(serverAsset)
            ? serverAsset
            : assetIds.length === 1
              ? assetIds[0]
              : null;
    const jobs = options.jobs.filter(
        (job) =>
            assetId === null || job.operational_asset_ids.includes(assetId),
    );
    const serverJob = options.defaults?.dispatch_job_id ?? null;
    const jobId =
        serverJob !== null && jobs.some((job) => job.id === serverJob)
            ? serverJob
            : jobs.length === 1
              ? jobs[0].id
              : null;

    return { assetId, jobId };
}

function queuedFromCommands(commands: OutboxCommand[]): QueuedFuelRequest[] {
    return commands
        .filter(
            (command) =>
                command.type === 'submit_fuel_request' &&
                command.state !== 'completed',
        )
        .map((command) => ({
            commandId: command.id,
            state: command.state,
            payload: command.payload as unknown as CreateFuelPayload,
            error: command.error?.message ?? null,
            createdAt: command.createdAt,
        }));
}

function pendingIdsFor(
    commands: OutboxCommand[],
    type: OutboxCommand['type'],
): number[] {
    return commands
        .filter(
            (command) => command.type === type && command.state !== 'completed',
        )
        .map((command) => Number(command.payload.fuel_request_id))
        .filter((id) => Number.isFinite(id));
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
    const [restoredDraft, setRestoredDraft] = useState<{
        savedAt: string | null;
    } | null>(null);
    const [cacheNotice, setCacheNotice] = useState<string | null>(null);
    const [cacheWritableReady, setCacheWritableReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FuelFieldErrors>({});
    const [notice, setNotice] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [nextPage, setNextPage] = useState<number | null>(null);
    const [outboxCommands, setOutboxCommands] = useState<OutboxCommand[]>(() =>
        commandOutbox.getCommands(),
    );
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
                    setRestoredDraft(
                        saved && hasDraftContent(saved)
                            ? { savedAt: saved.savedAt ?? null }
                            : null,
                    );
                    setDraftNotice(
                        saved && hasDraftContent(saved)
                            ? 'Draft restored from this device.'
                            : '',
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

    // Fill the operator's current unit/job into an untouched draft. A draft the
    // operator edited (or restored) is never overwritten.
    useEffect(() => {
        if (!draftReady || !options) {
            return;
        }

        queueMicrotask(() => {
            setDraft((value) => {
                if (
                    hasDraftContent(value) ||
                    value.savedAt ||
                    value.assetId !== null ||
                    value.jobId !== null
                ) {
                    return value;
                }

                const defaults = defaultFuelContext(options);

                if (defaults.assetId === null && defaults.jobId === null) {
                    return value;
                }

                return {
                    ...value,
                    assetId: defaults.assetId,
                    jobId: defaults.jobId,
                };
            });
        });
    }, [draftReady, options]);

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
                            hasDraftContent(draft)
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
                        FUEL_COMMAND_TYPES.has(command.type) &&
                        command.state === 'completed',
                )
                .map((command) => command.id),
        );

        return commandOutbox.subscribe((commands) => {
            let shouldRefresh = false;

            for (const command of commands) {
                if (
                    FUEL_COMMAND_TYPES.has(command.type) &&
                    command.state === 'completed' &&
                    !completedFuelCommands.has(command.id)
                ) {
                    completedFuelCommands.add(command.id);
                    shouldRefresh = true;
                }
            }

            if (mounted.current) {
                setOutboxCommands(commands);

                if (shouldRefresh) {
                    // "Saved on this device" is no longer true once the command synced.
                    setNotice((current) =>
                        current?.includes(DEVICE_QUEUE_NOTICE_MARKER)
                            ? 'Synced with the office.'
                            : current,
                    );
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

        setFieldErrors((current) => ({
            ...current,
            ...('quantity' in patch ? { quantity: undefined } : {}),
            ...('purpose' in patch ? { purpose: undefined } : {}),
        }));
        setDraft((value) => ({
            ...value,
            ...patch,
            savedAt: new Date().toISOString(),
        }));
    };

    const discardDraft = async () => {
        if (mutationLock.current || draft.pending) {
            return;
        }

        const defaults = defaultFuelContext(options);
        setDraft({
            ...emptyFuelDraft(),
            assetId: defaults.assetId,
            jobId: defaults.jobId,
        });
        setRestoredDraft(null);
        setFieldErrors({});
        await store.remove(actorId).catch(() => undefined);
    };

    const validateDraft = (): FuelFieldErrors => {
        const errors: FuelFieldErrors = {};
        const quantity = Number(draft.quantity);

        if (
            draft.quantity.trim() === '' ||
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            quantity > 100000
        ) {
            errors.quantity = 'Enter the litres you need (0.01 – 100,000).';
        }

        if (!draft.purpose.trim()) {
            errors.purpose = 'Say what the fuel is for.';
        }

        return errors;
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

        if (!draft.pending) {
            const errors = validateDraft();

            if (errors.quantity || errors.purpose) {
                setFieldErrors(errors);
                setError('Check the highlighted fields.');

                return null;
            }
        }

        mutationLock.current = true;
        setBusy(true);
        setError(null);
        setFieldErrors({});
        setNotice(null);
        let snapshot = draft;

        try {
            snapshot = {
                ...draft,
                pending: draft.pending ?? {
                    client_request_id: await createCommandId(),
                    quantity_litres: Number(draft.quantity),
                    fuel_type: draft.fuelType,
                    purpose: draft.purpose.trim(),
                    ...(draft.assetId
                        ? { operational_asset_id: draft.assetId }
                        : {}),
                    ...(draft.jobId ? { dispatch_job_id: draft.jobId } : {}),
                    ...(draft.urgency && draft.urgency !== 'normal'
                        ? { urgency: draft.urgency }
                        : {}),
                    ...(draft.neededBy ? { needed_by: draft.neededBy } : {}),
                    ...(draft.levelPercent !== null &&
                    draft.levelPercent !== undefined
                        ? { current_fuel_level_percent: draft.levelPercent }
                        : {}),
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
                const defaults = defaultFuelContext(options);
                setDraft({
                    ...emptyFuelDraft(),
                    assetId: defaults.assetId,
                    jobId: defaults.jobId,
                });
                setRestoredDraft(null);
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
                            ...items.filter((item) => item.id !== request?.id),
                        ]);
                        setNextPage(page.nextPage);

                        if (request) {
                            setNotice(
                                `${request.reference} submitted to the office.`,
                            );
                        }
                    } else if (isActionableOutboxState(state?.state)) {
                        // The queued item card shows the server's reason next to
                        // the request; the banner only points to it.
                        setNotice(null);
                        setError(
                            'The office could not accept this request. See the item marked "Needs attention" below.',
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

        if (!receipt && !payload.no_receipt_reason) {
            setError(
                'Capture the fuel receipt, or choose why there is no receipt.',
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
                        : durableReceipt
                          ? 'Fuel log and receipt saved on this device. They will sync when the connection returns.'
                          : 'Fuel log saved on this device. It will sync when the connection returns.',
                );
            }

            if (isOnline === true) {
                try {
                    await syncQueue();
                    const state = commandOutbox.getCommand(command.id);

                    if (state?.state === 'completed') {
                        const updated = await api.fetchFuelRequest(id);
                        setRequests((items) =>
                            items.map((item) =>
                                item.id === id ? updated : item,
                            ),
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

    const withdraw = async (id: number, reason?: string): Promise<boolean> => {
        if (
            mutationLock.current ||
            !isOutboxReady ||
            !commandOutbox.enqueueWithdrawFuelRequest
        ) {
            return false;
        }

        const request = requests.find((item) => item.id === id);

        if (!request?.can_withdraw) {
            setError(
                'This request can no longer be withdrawn. Refresh to see its latest status.',
            );

            return false;
        }

        mutationLock.current = true;
        setBusy(true);
        setError(null);
        setNotice(null);

        try {
            const command = await commandOutbox.enqueueWithdrawFuelRequest({
                fuel_request_id: id,
                ...(reason?.trim() ? { reason: reason.trim() } : {}),
            });

            if (isOnline === true) {
                try {
                    await syncQueue();
                    const state = commandOutbox.getCommand(command.id);

                    if (state?.state === 'completed') {
                        const updated = await api.fetchFuelRequest(id);
                        setRequests((items) =>
                            items.map((item) =>
                                item.id === id ? updated : item,
                            ),
                        );
                        setNotice(`${updated.reference} was withdrawn.`);
                    } else if (isActionableOutboxState(state?.state)) {
                        setError(
                            state?.error?.message ??
                                'The withdrawal needs attention in Sync status.',
                        );
                    }
                } catch {
                    // The durable command remains queued for the normal retry loop.
                }
            } else if (mounted.current) {
                setNotice(
                    'Withdrawal saved on this device. It will sync when the connection returns.',
                );
            }

            return true;
        } catch (e) {
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
        restoredDraft,
        cacheNotice,
        error,
        fieldErrors,
        notice,
        loading,
        busy,
        nextPage,
        queuedRequests: queuedFromCommands(outboxCommands),
        pendingWithdrawIds: pendingIdsFor(
            outboxCommands,
            'withdraw_fuel_request',
        ),
        pendingLogIds: pendingIdsFor(outboxCommands, 'record_fuel_log'),
        refresh,
        loadMore,
        updateDraft,
        discardDraft,
        submit,
        record,
        withdraw,
        dismissNotice: () => setNotice(null),
    };
}
