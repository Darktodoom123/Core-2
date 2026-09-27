import { useCallback, useEffect, useState } from 'react';
import type { FieldApiClient } from '../services/apiClient';
import type { CommandOutboxManager } from '../services/commandOutbox';
import {
    linkCommandsKey,
    readServerUnitLink,
    reconcileUnitLink,
} from '../services/unitLinkSync';
import type {
    LocalUnitLink,
    ServerUnitLinkSnapshot,
} from '../services/unitLinkSync';
import { unitLinkStore } from '../storage/unitLinkStore';
import type { UnitLink, UnitLinkStore } from '../storage/unitLinkStore';
import type { OutboxCommand } from '../types';

export interface UnitLinkSync {
    /** Ask the server only while signed in and online. */
    canFetch: boolean;
    apiClient: Pick<FieldApiClient, 'fetchUnitLink'>;
    outbox: Pick<
        CommandOutboxManager,
        'enqueueLinkUnit' | 'enqueueReleaseUnit'
    > | null;
    outboxCommands: readonly OutboxCommand[];
}

export interface LinkTarget {
    assetCode: string;
    /** Needed to tell the server; without it the link stays on this phone. */
    assetId?: number | null;
    jobId?: number | null;
}

export interface UnitLinkState {
    /** The link the phone acts on, or null when not linked. */
    unitLink: UnitLink | null;
    link: (target: LinkTarget) => void;
    unlink: () => void;
}

type Tagged<T> = { actorId: number; value: T };

function sameLink(a: UnitLink | null, b: UnitLink | null): boolean {
    return a?.assetCode === b?.assetCode && a?.linkedAt === b?.linkedAt;
}

/**
 * The operator's link to a unit. The server holds it, so another phone
 * sees it too; the phone saves its own copy so a restart or a dead zone
 * keeps it, and sends links and releases through the outbox.
 */
export function useUnitLink(
    actorId: number | null | undefined,
    { canFetch, apiClient, outbox, outboxCommands }: UnitLinkSync,
    store: UnitLinkStore = unitLinkStore,
): UnitLinkState {
    // Tagged with the operator so another sign-in never sees it.
    const [local, setLocal] = useState<Tagged<LocalUnitLink> | null>(null);
    const [server, setServer] = useState<Tagged<ServerUnitLinkSnapshot> | null>(
        null,
    );

    useEffect(() => {
        if (!actorId) {
            return;
        }

        let cancelled = false;

        store
            .read(actorId)
            .then((saved) => {
                if (!cancelled) {
                    // A link or release made meanwhile on this screen wins.
                    setLocal((current) =>
                        current?.actorId === actorId
                            ? current
                            : { actorId, value: { link: saved, changedAt: 0 } },
                    );
                }
            })
            .catch(() => {
                // Storage unavailable: the server answer still applies.
            });

        return () => {
            cancelled = true;
        };
    }, [actorId, store]);

    const commandsKey = linkCommandsKey(outboxCommands);

    useEffect(() => {
        if (!actorId || !canFetch) {
            return;
        }

        let cancelled = false;
        const askedAt = Date.now();

        apiClient
            .fetchUnitLink()
            .then((raw) => {
                // Throws on an unreadable answer, handled below.
                const link = readServerUnitLink(raw);

                if (!cancelled) {
                    setServer({
                        actorId,
                        value: { link, fetchedAt: askedAt },
                    });
                }
            })
            .catch(() => {
                // Keep the last answer; the phone's own view still applies.
            });

        return () => {
            cancelled = true;
        };
    }, [actorId, apiClient, canFetch, commandsKey]);

    const localValue: LocalUnitLink =
        actorId && local?.actorId === actorId
            ? local.value
            : { link: null, changedAt: 0 };
    const serverValue =
        actorId && server?.actorId === actorId ? server.value : null;
    const unitLink = actorId
        ? reconcileUnitLink(localValue, serverValue, outboxCommands)
        : null;

    // Keep the saved copy in step with what the server settled on.
    const settledCode = unitLink?.assetCode ?? null;
    const settledAt = unitLink?.linkedAt ?? null;
    const savedCode = localValue.link?.assetCode ?? null;
    const savedAt = localValue.link?.linkedAt ?? null;

    useEffect(() => {
        const settled =
            settledCode && settledAt
                ? { assetCode: settledCode, linkedAt: settledAt }
                : null;
        const saved =
            savedCode && savedAt
                ? { assetCode: savedCode, linkedAt: savedAt }
                : null;

        if (!actorId || sameLink(settled, saved)) {
            return;
        }

        const write = settled
            ? store.write(actorId, settled)
            : store.remove(actorId);
        void write.catch(() => undefined);
    }, [actorId, savedAt, savedCode, settledAt, settledCode, store]);

    const link = useCallback(
        ({ assetCode, assetId, jobId }: LinkTarget) => {
            if (!assetCode || !actorId) {
                return;
            }

            const next = { assetCode, linkedAt: new Date().toISOString() };
            setLocal({
                actorId,
                value: { link: next, changedAt: Date.now() },
            });
            void store.write(actorId, next).catch(() => undefined);

            if (outbox && assetId) {
                void outbox
                    .enqueueLinkUnit({
                        operational_asset_id: assetId,
                        dispatch_job_id: jobId ?? null,
                        asset_code: assetCode,
                    })
                    .catch(() => undefined);
            }
        },
        [actorId, outbox, store],
    );

    const unlink = useCallback(() => {
        if (!actorId) {
            return;
        }

        const released = unitLink?.assetCode;
        setLocal({ actorId, value: { link: null, changedAt: Date.now() } });
        void store.remove(actorId).catch(() => undefined);

        if (outbox && released) {
            void outbox
                .enqueueReleaseUnit({ asset_code: released })
                .catch(() => undefined);
        }
    }, [actorId, outbox, store, unitLink?.assetCode]);

    return { unitLink, link, unlink };
}
