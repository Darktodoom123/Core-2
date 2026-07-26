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
let activeSyncPromise: Promise<void> | null = null;

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
        payload: { ...payload, command_id: commandId },
        expectedVersion,
        status: 'queued',
        createdAt: new Date().toISOString(),
    };

    const queue = getOutboxQueue();
    queue.push(item);
    saveOutboxQueue(queue);

    return item;
}

export function syncOutbox(): Promise<void> {
    if (activeSyncPromise !== null) {
        return activeSyncPromise;
    }

    activeSyncPromise = syncOutboxQueue().finally(() => {
        activeSyncPromise = null;
    });

    return activeSyncPromise;
}

async function syncOutboxQueue(): Promise<void> {
    const queue = getOutboxQueue();

    for (const item of queue) {
        if (!['queued', 'failed', 'syncing'].includes(item.status)) {
            continue;
        }

        updateOutboxItemStatus(item.id, 'syncing');

        try {
            const csrf = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content');
            const response = await fetch(item.url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
                    'Idempotency-Key': item.commandId,
                },
                body: JSON.stringify(item.payload),
            });

            if (response.status === 409) {
                updateOutboxItemStatus(
                    item.id,
                    'conflict',
                    'The server rejected this command because the record changed.',
                    {
                        status: response.status,
                    },
                );
            } else if (!response.ok) {
                updateOutboxItemStatus(
                    item.id,
                    'failed',
                    `Server returned HTTP ${response.status}.`,
                );
            } else {
                updateOutboxItemStatus(item.id, 'synchronized');
            }
        } catch {
            updateOutboxItemStatus(
                item.id,
                'failed',
                'Network unavailable; retry when connectivity returns.',
            );
        }
    }
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
