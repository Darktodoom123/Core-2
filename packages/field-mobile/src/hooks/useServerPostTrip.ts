import { useEffect, useState } from 'react';
import { postTripDoneThisShift } from '../screens/hos/hos-post-trip-status';
import type { ServerDvirRecord } from '../screens/hos/hos-post-trip-status';
import type { FieldApiClient } from '../services/apiClient';
import type { OutboxCommand } from '../types';

export interface ServerPostTripInput {
    /** Only ask the server while it can answer (HoS open, signed in, online). */
    canFetch: boolean;
    apiClient: Pick<FieldApiClient, 'fetchDvirInspections'>;
    assetId: number | null | undefined;
    assetCode: string | null | undefined;
    shiftStartedAt: string | null | undefined;
    /** When the unit was last linked; earlier post-trips don't count. */
    linkedAt?: string | null;
    outboxCommands: readonly OutboxCommand[];
}

// Two days covers a shift that started before midnight.
const HISTORY_DAYS = 2;

/**
 * Whether the linked unit's post-trip was done this shift, from the server's
 * DVIR history and this phone's outbox, so it survives a restart or a switch
 * to another phone.
 */
export function useServerPostTrip({
    canFetch,
    apiClient,
    assetId,
    assetCode,
    shiftStartedAt,
    linkedAt,
    outboxCommands,
}: ServerPostTripInput): boolean {
    const [serverInspections, setServerInspections] = useState<
        ServerDvirRecord[]
    >([]);

    useEffect(() => {
        if (!canFetch || !assetId || !shiftStartedAt) {
            return;
        }

        let cancelled = false;

        apiClient
            .fetchDvirInspections(HISTORY_DAYS, assetId)
            .then((result) => {
                if (!cancelled) {
                    setServerInspections(result.inspections ?? []);
                }
            })
            .catch(() => {
                // Offline or failed: the phone's own outbox still counts.
            });

        return () => {
            cancelled = true;
        };
    }, [apiClient, assetId, canFetch, shiftStartedAt]);

    return postTripDoneThisShift({
        assetCode,
        shiftStartedAt,
        linkedAt,
        serverInspections,
        outboxCommands,
    });
}
