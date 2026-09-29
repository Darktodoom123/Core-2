import { useEffect, useState } from 'react';
import { fetchAuditPage } from './audit-api';
import type { AuditPage, AuditQuery } from './audit-api';

const SEARCH_DEBOUNCE_MS = 300;

export interface AuditEventsState {
    page: AuditPage | null;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

/**
 * Server-side audit query. The last good page stays on screen while the next
 * one loads, and a newer query cancels the one in flight.
 */
export function useAuditEvents(query: AuditQuery): AuditEventsState {
    const [page, setPage] = useState<AuditPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nonce, setNonce] = useState(0);
    const [search, setSearch] = useState(query.q ?? '');

    useEffect(() => {
        const timer = window.setTimeout(
            () => setSearch(query.q ?? ''),
            SEARCH_DEBOUNCE_MS,
        );

        return () => window.clearTimeout(timer);
    }, [query.q]);

    const { category, actor, from, to, page: pageNumber, perPage } = query;

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setLoading(true);

            fetchAuditPage(
                {
                    category,
                    actor,
                    from,
                    to,
                    q: search,
                    page: pageNumber,
                    perPage,
                },
                controller.signal,
            )
                .then((result) => {
                    setPage(result);
                    setError(null);
                })
                .catch((reason: unknown) => {
                    if (!controller.signal.aborted) {
                        setError(
                            reason instanceof Error
                                ? reason.message
                                : 'The audit trail could not be loaded.',
                        );
                    }
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setLoading(false);
                    }
                });
        }, 0);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [category, actor, from, to, search, pageNumber, perPage, nonce]);

    return {
        page,
        loading,
        error,
        reload: () => setNonce((value) => value + 1),
    };
}
