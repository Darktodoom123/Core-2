import { useCallback, useEffect, useState } from 'react';
import { trackingPauseStore } from '../storage/trackingPauseStore';
import type {
    TrackingPause,
    TrackingPauseStore,
} from '../storage/trackingPauseStore';
import type { UnitLink } from '../storage/unitLinkStore';

export interface TrackingPauseState {
    /** Undefined until the saved pause has been read. */
    pausedByOperator: boolean | undefined;
    markPaused: () => void;
    clearPause: () => void;
}

/**
 * A pause counts for the unit it was made on. It is matched by unit, not
 * by time, because the link time can come from the server's clock; linking
 * or releasing clears it instead.
 */
export function pauseAppliesTo(
    pause: TrackingPause | null,
    link: UnitLink | null,
): boolean {
    return (
        pause !== null && link !== null && pause.assetCode === link.assetCode
    );
}

/**
 * The operator's own "Pause Telemetry", saved on the phone so a restart
 * does not turn tracking back on behind their back.
 */
export function useTrackingPause(
    actorId: number | null | undefined,
    unitLink: UnitLink | null,
    store: TrackingPauseStore = trackingPauseStore,
): TrackingPauseState {
    // Tagged with the operator so another sign-in never sees it.
    const [saved, setSaved] = useState<{
        actorId: number;
        pause: TrackingPause | null;
    } | null>(null);

    useEffect(() => {
        if (!actorId) {
            return;
        }

        let cancelled = false;
        const settle = (pause: TrackingPause | null) => {
            if (!cancelled) {
                // A pause or resume made meanwhile on this screen wins.
                setSaved((current) =>
                    current?.actorId === actorId ? current : { actorId, pause },
                );
            }
        };

        store
            .read(actorId)
            .then(settle)
            // Storage unavailable: behave as if nothing was paused.
            .catch(() => settle(null));

        return () => {
            cancelled = true;
        };
    }, [actorId, store]);

    const markPaused = useCallback(() => {
        if (!actorId || !unitLink) {
            return;
        }

        const pause = {
            assetCode: unitLink.assetCode,
            pausedAt: new Date().toISOString(),
        };
        setSaved({ actorId, pause });
        store.write(actorId, pause).catch(() => undefined);
    }, [actorId, store, unitLink]);

    const clearPause = useCallback(() => {
        if (!actorId) {
            return;
        }

        setSaved({ actorId, pause: null });
        store.remove(actorId).catch(() => undefined);
    }, [actorId, store]);

    return {
        pausedByOperator:
            actorId && saved?.actorId === actorId
                ? pauseAppliesTo(saved.pause, unitLink)
                : undefined,
        markPaused,
        clearPause,
    };
}
