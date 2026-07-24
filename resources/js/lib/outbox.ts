export interface OutboxItem {
    id: string;
    commandId: string;
    action: string;
    url: string;
    payload: Record<string, unknown>;
    expectedVersion?: number | null;
    status: 'queued' | 'syncing' | 'failed' | 'conflict' | 'synchronized';
    errorMessage?: string | null;
    conflictData?: Record<string, unknown> | null;
    createdAt: string;
}

const STORAGE_KEY = 'field_ops_outbox_queue_v1';

export function getOutboxQueue(): OutboxItem[] {
    if (typeof window === 'undefined') {
        return [];
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);

        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

export function saveOutboxQueue(queue: OutboxItem[]): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
        // Fallback silently
    }
}

export function queueCommand(
    action: string,
    url: string,
    payload: Record<string, unknown>,
    expectedVersion?: number | null,
): OutboxItem {
    const commandId =
        typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const item: OutboxItem = {
        id: commandId,
        commandId,
        action,
        url,
        payload,
        expectedVersion,
        status: 'queued',
        createdAt: new Date().toISOString(),
    };

    const queue = getOutboxQueue();
    queue.push(item);
    saveOutboxQueue(queue);

    return item;
}

export function updateOutboxItemStatus(
    id: string,
    status: OutboxItem['status'],
    errorMessage?: string | null,
    conflictData?: Record<string, unknown> | null,
): void {
    const queue = getOutboxQueue().map((item) => {
        if (item.id === id) {
            return {
                ...item,
                status,
                errorMessage: errorMessage ?? item.errorMessage,
                conflictData: conflictData ?? item.conflictData,
            };
        }

        return item;
    });

    saveOutboxQueue(queue);
}

export function removeOutboxItem(id: string): void {
    const queue = getOutboxQueue().filter((item) => item.id !== id);
    saveOutboxQueue(queue);
}
