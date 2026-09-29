import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAuditPage } from '@/components/workspace/audit/audit-api';
import type { AuditPage } from '@/components/workspace/audit/audit-api';
import type { AiGovernance, SystemHealth } from './admin-dashboard-model';

const HEALTH_POLL_MS = 30_000;

export interface RemoteState<T> {
    data: T | null;
    error: string | null;
    loading: boolean;
    /** When the last successful response arrived, in epoch ms. */
    checkedAt: number | null;
    reload: () => void;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        signal,
    });

    if (!response.ok) {
        throw new Error(`The server answered HTTP ${response.status}.`);
    }

    return (await response.json()) as T;
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Loads a JSON resource, optionally on an interval, and keeps the last good
 * response on screen when a later request fails.
 */
function useRemote<T>(
    load: (signal: AbortSignal) => Promise<T>,
    fallbackError: string,
    enabled: boolean,
    pollMs?: number,
): RemoteState<T> & { setData: (data: T) => void } {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [checkedAt, setCheckedAt] = useState<number | null>(null);
    const [nonce, setNonce] = useState(0);
    const loadRef = useRef(load);

    useEffect(() => {
        loadRef.current = load;
    });

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let controller = new AbortController();
        const run = () => {
            controller.abort();
            controller = new AbortController();
            setLoading(true);
            loadRef
                .current(controller.signal)
                .then((result) => {
                    setData(result);
                    setError(null);
                    setCheckedAt(Date.now());
                })
                .catch((reason: unknown) => {
                    if (!controller.signal.aborted) {
                        setError(errorMessage(reason, fallbackError));
                    }
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setLoading(false);
                    }
                });
        };

        const first = window.setTimeout(run, 0);
        const interval = pollMs ? window.setInterval(run, pollMs) : null;

        return () => {
            window.clearTimeout(first);
            controller.abort();

            if (interval !== null) {
                window.clearInterval(interval);
            }
        };
    }, [enabled, fallbackError, nonce, pollMs]);

    const reload = useCallback(() => setNonce((value) => value + 1), []);

    return { data, error, loading, checkedAt, reload, setData };
}

export function useSystemHealth(): RemoteState<SystemHealth> {
    return useRemote(
        (signal) => getJson<SystemHealth>('/operations/admin/health', signal),
        'The health probe could not be reached.',
        true,
        HEALTH_POLL_MS,
    );
}

export function useAuditSummary(enabled: boolean): RemoteState<AuditPage> {
    return useRemote(
        (signal) => fetchAuditPage({ perPage: 5 }, signal),
        'Recent audit activity could not be loaded.',
        enabled,
    );
}

function csrfToken(): string | undefined {
    return (
        document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
    )?.content;
}

export interface AiGovernanceState extends RemoteState<AiGovernance> {
    saving: boolean;
    saveError: string | null;
    setPaused: (paused: boolean, reason?: string) => Promise<boolean>;
}

export function useAiGovernance(enabled: boolean): AiGovernanceState {
    const remote = useRemote(
        (signal) =>
            getJson<AiGovernance>(
                '/operations/gpt-governance/telemetry',
                signal,
            ),
        'AI usage could not be loaded.',
        enabled,
    );
    const { data, setData, reload } = remote;
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const setPaused = useCallback(
        async (paused: boolean, reason?: string) => {
            setSaving(true);
            setSaveError(null);

            try {
                const token = csrfToken();
                const response = await fetch(
                    '/operations/gpt-circuit-breaker',
                    {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                            ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            paused,
                            reason: reason ?? null,
                        }),
                    },
                );
                const body = (await response.json().catch(() => null)) as {
                    circuit_breaker_active?: boolean;
                    message?: string;
                } | null;

                if (!response.ok) {
                    throw new Error(
                        body?.message ??
                            `AI advice could not be ${paused ? 'paused' : 'resumed'} (HTTP ${response.status}).`,
                    );
                }

                if (data) {
                    setData({
                        ...data,
                        circuit_breaker_active: Boolean(
                            body?.circuit_breaker_active,
                        ),
                    });
                } else {
                    reload();
                }

                return true;
            } catch (error) {
                setSaveError(
                    errorMessage(
                        error,
                        `AI advice could not be ${paused ? 'paused' : 'resumed'}.`,
                    ),
                );

                return false;
            } finally {
                setSaving(false);
            }
        },
        [data, reload, setData],
    );

    return { ...remote, saving, saveError, setPaused };
}
