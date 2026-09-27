import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldApiClient } from '../../services/apiClient';
import type { MySafetyReports } from '../../types/index';

export type MySafetyReportsStatus = 'loading' | 'loaded' | 'error';

/** The operator's own safety reports from the server, loaded on open. */
export function useMySafetyReports(apiClient: FieldApiClient | undefined) {
    const [reports, setReports] = useState<MySafetyReports | null>(null);
    const [status, setStatus] = useState<MySafetyReportsStatus>(
        apiClient ? 'loading' : 'error',
    );
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    const load = useCallback(async () => {
        if (!apiClient) {
            return;
        }

        try {
            const result = await apiClient.fetchMySafetyReports(30);

            if (mounted.current) {
                setReports(result);
                setStatus('loaded');
            }
        } catch {
            if (mounted.current) {
                setStatus('error');
            }
        }
    }, [apiClient]);

    useEffect(() => {
        queueMicrotask(() => void load());
    }, [load]);

    return {
        reports,
        status,
        retry: () => {
            setStatus('loading');
            void load();
        },
    };
}
