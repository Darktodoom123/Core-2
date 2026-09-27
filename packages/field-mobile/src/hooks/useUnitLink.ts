import { useCallback, useEffect, useState } from 'react';
import { unitLinkStore } from '../storage/unitLinkStore';
import type { UnitLink, UnitLinkStore } from '../storage/unitLinkStore';

export interface UnitLinkState {
    /** The saved link, or null when not linked. */
    unitLink: UnitLink | null;
    link: (assetCode: string) => void;
    unlink: () => void;
}

/**
 * The operator's link to a unit, saved on the phone so an app restart keeps
 * it. Releasing removes it.
 */
export function useUnitLink(
    actorId: number | null | undefined,
    store: UnitLinkStore = unitLinkStore,
): UnitLinkState {
    // Tagged with its operator so another sign-in never sees it.
    const [state, setState] = useState<{
        actorId: number;
        link: UnitLink | null;
    } | null>(null);

    useEffect(() => {
        if (!actorId) {
            return;
        }

        let cancelled = false;

        store
            .read(actorId)
            .then((saved) => {
                if (!cancelled && saved) {
                    // A link or release made meanwhile on this screen wins.
                    setState((current) =>
                        current?.actorId === actorId
                            ? current
                            : { actorId, link: saved },
                    );
                }
            })
            .catch(() => {
                // Storage unavailable: the operator links again.
            });

        return () => {
            cancelled = true;
        };
    }, [actorId, store]);

    const link = useCallback(
        (assetCode: string) => {
            if (!assetCode || !actorId) {
                return;
            }

            const next = { assetCode, linkedAt: new Date().toISOString() };
            setState({ actorId, link: next });
            void store.write(actorId, next).catch(() => undefined);
        },
        [actorId, store],
    );

    const unlink = useCallback(() => {
        if (!actorId) {
            return;
        }

        setState({ actorId, link: null });
        void store.remove(actorId).catch(() => undefined);
    }, [actorId, store]);

    const unitLink = actorId && state?.actorId === actorId ? state.link : null;

    return { unitLink, link, unlink };
}
