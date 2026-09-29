import type { AuditEventViewModel } from '@/types/workspace';

export const AUDIT_CATEGORIES = [
    'access',
    'dispatch',
    'fleet',
    'safety',
    'reports',
    'gpt',
    'overrides',
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];
export type AuditCategoryFilter = 'all' | AuditCategory;

export interface AuditQuery {
    category?: AuditCategoryFilter;
    /** A user id, or `system` for events recorded without a signed-in actor. */
    actor?: string;
    /** ISO 8601 bounds, usually the start and end of a local day. */
    from?: string;
    to?: string;
    q?: string;
    page?: number;
    perPage?: number;
}

export interface AuditPage {
    events: AuditEventViewModel[];
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
    counts: Record<AuditCategoryFilter, number>;
    actors: { id: number; name: string }[];
    last_24h_total: number;
}

export function auditQueryString(query: AuditQuery): string {
    const params = new URLSearchParams();

    if (query.category && query.category !== 'all') {
        params.set('category', query.category);
    }

    if (query.actor && query.actor !== 'all') {
        params.set('actor', query.actor);
    }

    if (query.from) {
        params.set('from', query.from);
    }

    if (query.to) {
        params.set('to', query.to);
    }

    if (query.q?.trim()) {
        params.set('q', query.q.trim());
    }

    if (query.page && query.page > 1) {
        params.set('page', String(query.page));
    }

    if (query.perPage) {
        params.set('per_page', String(query.perPage));
    }

    return params.toString();
}

export async function fetchAuditPage(
    query: AuditQuery,
    signal?: AbortSignal,
): Promise<AuditPage> {
    const search = auditQueryString(query);
    const response = await fetch(
        `/operations/audit-events${search ? `?${search}` : ''}`,
        {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            signal,
        },
    );

    if (!response.ok) {
        throw new Error(
            response.status === 403
                ? 'Your account cannot view the audit trail.'
                : response.status === 422
                  ? 'Those filters are not valid. Check the dates and try again.'
                  : `The audit trail could not be loaded (HTTP ${response.status}).`,
        );
    }

    return (await response.json()) as AuditPage;
}
