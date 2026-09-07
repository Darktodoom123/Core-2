import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiClientError } from '../services/apiClient';
import { createCommandId } from '../services/commandOutbox';
import { emptyFuelDraft, fuelDraftStore } from '../storage/fuelDraftStore';
import type { FuelDraft, FuelDraftStore } from '../storage/fuelDraftStore';
import type {
    FuelApi,
    FuelOptions,
    FuelReceiptUpload,
    MobileFuelRequest,
    RecordFuelPayload,
} from '../types/fuel';

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

export function useFuelManagement(
    api: FuelApi,
    actorId: number,
    isOnline: boolean | null,
    store: FuelDraftStore = fuelDraftStore,
) {
    const [requests, setRequests] = useState<MobileFuelRequest[]>([]);
    const [options, setOptions] = useState<FuelOptions | null>(null);
    const [draft, setDraft] = useState<FuelDraft>(emptyFuelDraft);
    const [draftReady, setDraftReady] = useState(false);
    const [draftNotice, setDraftNotice] = useState('Loading saved draft…');
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

        const versionRef = requestVersion;

        return () => {
            ignore = true;
            mounted.current = false;
            versionRef.current += 1;
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

    const submit = async (): Promise<MobileFuelRequest | null> => {
        if (mutationLock.current || !draftReady || isOnline !== true) {
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
            const result = await api.createFuelRequest(snapshot.pending!);
            await store.remove(actorId);

            if (mounted.current) {
                setDraft(emptyFuelDraft());
                setNotice(`${result.reference} submitted to the office.`);
                setRequests((items) => [
                    result,
                    ...items.filter((item) => item.id !== result.id),
                ]);
            }

            return result;
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
        if (mutationLock.current || isOnline !== true) {
            return false;
        }

        mutationLock.current = true;
        setBusy(true);
        setError(null);
        setNotice(null);

        try {
            const updated = await api.recordFuel(id, payload, receipt);

            if (mounted.current) {
                setRequests((items) =>
                    items.map((item) => (item.id === id ? updated : item)),
                );
                setNotice('Refueling saved to Fuel Management.');
            }

            return true;
        } catch (e) {
            // Resolve a lost response by reading the canonical record before inviting a retry.
            try {
                const current = await api.fetchFuelRequest(id);

                if (mounted.current) {
                    setRequests((items) =>
                        items.map((item) => (item.id === id ? current : item)),
                    );
                }

                if (current.status === 'logged') {
                    if (mounted.current) {
                        setNotice(
                            'This request already has a saved fuel log. Review the recorded details.',
                        );
                    }

                    return true;
                }
            } catch {
                /* Preserve the original actionable error. */
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
