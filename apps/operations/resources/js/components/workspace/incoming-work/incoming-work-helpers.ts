import type {
    DispatchJobViewModel,
    RentalDispatchHandoffViewModel,
    ServiceRequestViewModel,
} from '@/types/workspace';

export type IncomingWorkItem = {
    key: string;
    mode: 'service' | 'rental';
    sourceLabel: string;
    reference: string;
    client: string;
    detail: string;
    status: string;
    sourceId: number;
    hasEvidence?: boolean;
    evidenceSignee?: string | null;
};

export interface IncomingQueuePage {
    items: IncomingWorkItem[];
    service_requests: ServiceRequestViewModel[];
    rental_handoffs: RentalDispatchHandoffViewModel[];
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
}

export type IncomingFilter = 'all' | 'service' | 'rental';

export function isIncomingQueuePage(
    value: unknown,
): value is IncomingQueuePage {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const page = value as Record<string, unknown>;

    return (
        Array.isArray(page.items) &&
        Array.isArray(page.service_requests) &&
        Array.isArray(page.rental_handoffs) &&
        Number.isInteger(page.total) &&
        Number.isInteger(page.current_page) &&
        Number.isInteger(page.last_page) &&
        Number.isInteger(page.per_page)
    );
}

/**
 * A manual draft for the same client may already cover this order.
 * Client-name similarity only flags a possible match; the dispatcher decides.
 */
export function findPossibleDuplicate(
    clientName: string,
    jobs: DispatchJobViewModel[],
): DispatchJobViewModel | null {
    const client = clientName.trim().toLowerCase();

    if (client === '') {
        return null;
    }

    return (
        jobs.find((job) => {
            const isManual =
                job.source === null ||
                job.source.type === 'manual' ||
                job.source.type === 'direct';
            const jobClient = job.client.trim().toLowerCase();

            return (
                isManual &&
                jobClient !== '' &&
                (jobClient.includes(client) || client.includes(jobClient))
            );
        }) ?? null
    );
}

export function toLocalDateTime(value: string | null): string {
    if (value === null) {
        return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

    return local.toISOString().slice(0, 16);
}

/** `YYYY-MM-DDTHH:mm` in the browser's timezone to an unambiguous ISO string. */
export function localDateTimeToIso(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export function addHours(value: string, hours: number): string {
    if (value === '') {
        return '';
    }

    const date = new Date(value);
    date.setHours(date.getHours() + hours);

    return toLocalDateTime(date.toISOString());
}
