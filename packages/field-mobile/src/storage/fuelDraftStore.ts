import type { SQLiteDatabase } from 'expo-sqlite';
import type { CreateFuelPayload } from '../types/fuel';

export interface FuelDraft {
    quantity: string;
    purpose: string;
    fuelType: 'diesel' | 'gasoline';
    assetId: number | null;
    jobId: number | null;
    pending: CreateFuelPayload | null;
}

export const emptyFuelDraft = (): FuelDraft => ({
    quantity: '',
    purpose: '',
    fuelType: 'diesel',
    assetId: null,
    jobId: null,
    pending: null,
});

export interface FuelDraftStore {
    read(actorId: number): Promise<FuelDraft | null>;
    write(actorId: number, draft: FuelDraft): Promise<void>;
    remove(actorId: number): Promise<void>;
}

// A single ordered queue prevents a late autosave from resurrecting a submitted draft.
export class SqliteFuelDraftStore implements FuelDraftStore {
    private database: Promise<SQLiteDatabase> | null = null;
    private queue: Promise<unknown> = Promise.resolve();

    private open() {
        this.database ??= import('expo-sqlite')
            .then(async ({ openDatabaseAsync }) => {
                const db = await openDatabaseAsync('core2-fuel-drafts.db');
                await db.execAsync(
                    'CREATE TABLE IF NOT EXISTS fuel_drafts (actor_id INTEGER PRIMARY KEY, draft_json TEXT NOT NULL)',
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

    read(actorId: number): Promise<FuelDraft | null> {
        return this.ordered(async () => {
            const db = await this.open();
            const row = await db.getFirstAsync<{ draft_json: string }>(
                'SELECT draft_json FROM fuel_drafts WHERE actor_id = ?',
                actorId,
            );

            if (!row) {
                return null;
            }

            const value: unknown = JSON.parse(row.draft_json);

            if (
                !value ||
                typeof value !== 'object' ||
                !('quantity' in value) ||
                typeof value.quantity !== 'string' ||
                !('purpose' in value) ||
                typeof value.purpose !== 'string'
            ) {
                throw new Error('The saved fuel draft could not be read.');
            }

            return value as FuelDraft;
        });
    }

    write(actorId: number, draft: FuelDraft): Promise<void> {
        return this.ordered(async () => {
            const db = await this.open();
            await db.runAsync(
                'INSERT INTO fuel_drafts (actor_id, draft_json) VALUES (?, ?) ON CONFLICT(actor_id) DO UPDATE SET draft_json = excluded.draft_json',
                actorId,
                JSON.stringify(draft),
            );
        });
    }

    remove(actorId: number): Promise<void> {
        return this.ordered(async () => {
            const db = await this.open();
            await db.runAsync(
                'DELETE FROM fuel_drafts WHERE actor_id = ?',
                actorId,
            );
        });
    }
}

export const fuelDraftStore = new SqliteFuelDraftStore();
