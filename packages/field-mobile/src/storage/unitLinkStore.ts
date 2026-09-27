import type { SQLiteDatabase } from 'expo-sqlite';

/** The unit this operator is linked to on this phone, and since when. */
export interface UnitLink {
    assetCode: string;
    /** ISO time the link was made; post-trips before it don't count. */
    linkedAt: string;
}

export interface UnitLinkStore {
    read(actorId: number): Promise<UnitLink | null>;
    write(actorId: number, link: UnitLink): Promise<void>;
    remove(actorId: number): Promise<void>;
}

function parseUnitLink(json: string): UnitLink | null {
    const value: unknown = JSON.parse(json);

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

// A single ordered queue keeps a late write from undoing a release.
export class SqliteUnitLinkStore implements UnitLinkStore {
    private database: Promise<SQLiteDatabase> | null = null;
    private queue: Promise<unknown> = Promise.resolve();

    private open() {
        this.database ??= import('expo-sqlite')
            .then(async ({ openDatabaseAsync }) => {
                const db = await openDatabaseAsync('core2-unit-link.db');
                await db.execAsync(
                    'CREATE TABLE IF NOT EXISTS unit_links (actor_id INTEGER PRIMARY KEY, link_json TEXT NOT NULL)',
                );

                return db;
            })
            .catch((error: unknown) => {
                this.database = null;

                throw error;
            });

        return this.database;
    }

    private ordered<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.queue.then(operation, operation);
        this.queue = result.catch(() => undefined);

        return result;
    }

    read(actorId: number): Promise<UnitLink | null> {
        return this.ordered(async () => {
            const db = await this.open();
            const row = await db.getFirstAsync<{ link_json: string }>(
                'SELECT link_json FROM unit_links WHERE actor_id = ?',
                actorId,
            );

            return row ? parseUnitLink(row.link_json) : null;
        });
    }

    write(actorId: number, link: UnitLink): Promise<void> {
        return this.ordered(async () => {
            const db = await this.open();
            await db.runAsync(
                'INSERT INTO unit_links (actor_id, link_json) VALUES (?, ?) ON CONFLICT(actor_id) DO UPDATE SET link_json = excluded.link_json',
                actorId,
                JSON.stringify(link),
            );
        });
    }

    remove(actorId: number): Promise<void> {
        return this.ordered(async () => {
            const db = await this.open();
            await db.runAsync(
                'DELETE FROM unit_links WHERE actor_id = ?',
                actorId,
            );
        });
    }
}

export const unitLinkStore: UnitLinkStore = new SqliteUnitLinkStore();
