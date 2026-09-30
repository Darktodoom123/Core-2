import { useEffect, useRef, useState } from 'react';
import { isIncomingQueuePage } from './incoming-work-helpers';
import type { IncomingQueuePage } from './incoming-work-helpers';

/**
 * Loads one server page of incoming Core 1 work. `refreshKey` changes whenever
 * the workspace props reload (for example after a dispatch is created), so the
 * converted order drops out of the list without a manual refresh.
 */
export function useIncomingQueue({
    refreshKey,
    focusServiceRequestId,
    onTotalChange,
}: {
    refreshKey: unknown;
    focusServiceRequestId?: number | null;
    onTotalChange?: (total: number) => void;
}) {
    const [page, setPage] = useState(1);
    const [retry, setRetry] = useState(0);
    const [result, setResult] = useState<IncomingQueuePage | null>(null);
    const [pending, setPending] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const onTotalChangeRef = useRef(onTotalChange);

    useEffect(() => {
        onTotalChangeRef.current = onTotalChange;
    }, [onTotalChange]);

    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            setPending(true);
            setError(null);

            try {
                const params = new URLSearchParams({ page: String(page) });

                if (focusServiceRequestId) {
                    params.set(
                        'focus_service_request_id',
                        String(focusServiceRequestId),
                    );
                }

                const response = await fetch(
                    `/operations/dispatch-desk/incoming?${params}`,
                    {
                        credentials: 'same-origin',
                        headers: { Accept: 'application/json' },
                        signal: controller.signal,
                    },
                );

                if (!response.ok) {
                    throw new Error('Incoming queue failed');
                }

                const body: unknown = await response.json();

                if (!isIncomingQueuePage(body)) {
                    throw new Error('Incoming queue response was invalid');
                }

                if (!controller.signal.aborted) {
                    setResult(body);
                    onTotalChangeRef.current?.(body.total);

                    if (body.current_page !== page) {
                        setPage(body.current_page);
                    }
                }
            } catch {
                if (!controller.signal.aborted) {
                    setError(
                        "Couldn't load the orders from Core 1. Try again.",
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setPending(false);
                }
            }
        };

        void load();

        return () => controller.abort();
    }, [page, retry, refreshKey, focusServiceRequestId]);

    return {
        page,
        setPage,
        result,
        pending,
        error,
        retry: () => setRetry((value) => value + 1),
    };
}
