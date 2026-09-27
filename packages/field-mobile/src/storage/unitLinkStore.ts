import { SqliteActorJsonStore } from './actorJsonStore';
import type { ActorStore } from './actorJsonStore';

/** The unit this operator is linked to on this phone, and since when. */
export interface UnitLink {
    assetCode: string;
    /** ISO time the link was made; post-trips before it don't count. */
    linkedAt: string;
}

export type UnitLinkStore = ActorStore<UnitLink>;

function parseUnitLink(value: unknown): UnitLink | null {
    if (
        !value ||
        typeof value !== 'object' ||
        !('assetCode' in value) ||
        typeof value.assetCode !== 'string' ||
        value.assetCode === '' ||
        !('linkedAt' in value) ||
        typeof value.linkedAt !== 'string' ||
        !Number.isFinite(Date.parse(value.linkedAt))
    ) {
        return null;
    }

    return { assetCode: value.assetCode, linkedAt: value.linkedAt };
}

export const unitLinkStore: UnitLinkStore = new SqliteActorJsonStore({
    databaseName: 'core2-unit-link.db',
    table: 'unit_links',
    column: 'link_json',
    parse: parseUnitLink,
});
