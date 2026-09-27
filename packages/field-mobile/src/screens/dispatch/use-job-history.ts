import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldApiClient } from '../../services/apiClient';
import type { DispatchJob } from '../../types/index';

export type JobHistoryStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface JobHistoryState {
    items: DispatchJob[];
    status: JobHistoryStatus;
    /** A later page failed; the pages already shown stay on screen. */
    loadMoreFailed: boolean;
    hasMore: boolean;
    isLoadingMore: boolean;
    /** Loads the first page once; later calls are no-ops. */
    ensureLoaded: () => void;
    retry: () => void;
    loadMore: () => void;
}

/**
 * Finished jobs from the server, fetched the first time History opens and
 * then page by page. A failed first page is an error, never an empty history.
 */
export function useJobHistory(
    apiClient: FieldApiClient | undefined,
): JobHistoryState {
    const [items, setItems] = useState<DispatchJob[]>([]);
    const [status, setStatus] = useState<JobHistoryStatus>('idle');
    const [nextPage, setNextPage] = useState<number | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [loadMoreFailed, setLoadMoreFailed] = useState(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    const loadFirstPage = useCallback(async () => {
        if (!apiClient) {
            setStatus('error');

            return;
        }

        setStatus('loading');

        try {
            const page = await apiClient.fetchJobHistory(1);

            if (mounted.current) {
                setItems(page.items);
                setNextPage(page.nextPage);
                setStatus('loaded');
            }
        } catch {
            if (mounted.current) {
                setStatus('error');
            }
        }
    }, [apiClient]);

    const loadMore = useCallback(async () => {
        if (!apiClient || nextPage === null || isLoadingMore) {
            return;
        }

        setIsLoadingMore(true);
        setLoadMoreFailed(false);

        try {
            const page = await apiClient.fetchJobHistory(nextPage);

            if (mounted.current) {
                setItems((current) => [...current, ...page.items]);
                setNextPage(page.nextPage);
            }
        } catch {
            if (mounted.current) {
                setLoadMoreFailed(true);
            }
        } finally {
            if (mounted.current) {
                setIsLoadingMore(false);
            }
        }
    }, [apiClient, isLoadingMore, nextPage]);

    return {
        items,
        status,
        loadMoreFailed,
        hasMore: nextPage !== null,
        isLoadingMore,
        ensureLoaded: () => {
            if (status === 'idle') {
                void loadFirstPage();
            }
        },
        retry: () => void loadFirstPage(),
        loadMore: () => void loadMore(),
    };
}
