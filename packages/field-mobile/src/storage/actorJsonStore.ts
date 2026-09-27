import type { SQLiteDatabase } from 'expo-sqlite';

/** One saved value per operator on this phone. */
export interface ActorStore<T> {
    read(actorId: number): Promise<T | null>;
    write(actorId: number, value: T): Promise<void>;
    remove(actorId: number): Promise<void>;
}

export interface ActorJsonStoreOptions<T> {
    databaseName: string;
    table: string;
    column: string;
    /** Returns null for a saved value that is no longer readable. */
    parse: (value: unknown) => T | null;
}

// A single ordered queue keeps a late write from undoing a removal.
export class SqliteActorJsonStore<T> implements ActorStore<T> {
    private database: Promise<SQLiteDatabase> | null = null;
    private queue: Promise<unknown> = Promise.resolve();

    constructor(private readonly options: ActorJsonStoreOptions<T>) {}

    private open() {
        const { databaseName, table, column } = this.options;

        this.database ??= import('expo-sqlite')
            .then(async ({ openDatabaseAsync }) => {
                const db = await openDatabaseAsync(databaseName);
                await db.execAsync(
                    `CREATE TABLE IF NOT EXISTS ${table} (actor_id INTEGER PRIMARY KEY, ${column} TEXT NOT NULL)`,
                );

                return db;
            })
            .catch((error: unknown) => {
                this.database = null;

                throw error;
            });

        return this.database;
    }

    private ordered<R>(operation: () => Promise<R>): Promise<R> {
        const result = this.queue.then(operation, operation);
        this.queue = result.catch(() => undefined);

        return result;
    }

    read(actorId: number): Promise<T | null> {
        const { table, column, parse } = this.options;

        return this.ordered(async () => {
            const db = await this.open();
            const row = await db.getFirstAsync<Record<string, string>>(
                `SELECT ${column} FROM ${table} WHERE actor_id = ?`,
                actorId,
            );

            return row ? parse(JSON.parse(row[column])) : null;
        });
    }

    write(actorId: number, value: T): Promise<void> {
        const { table, column } = this.options;

        return this.ordered(async () => {
            const db = await this.open();
            await db.runAsync(
                `INSERT INTO ${table} (actor_id, ${column}) VALUES (?, ?) ON CONFLICT(actor_id) DO UPDATE SET ${column} = excluded.${column}`,
                actorId,
                JSON.stringify(value),
            );
        });
    }

    remove(actorId: number): Promise<void> {
        const { table } = this.options;

        return this.ordered(async () => {
            const db = await this.open();
            await db.runAsync(
                `DELETE FROM ${table} WHERE actor_id = ?`,
                actorId,
            );
        });
    }
}
