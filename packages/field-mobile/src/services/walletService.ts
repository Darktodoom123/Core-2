import type { ComplianceDocument } from '../types';
import type { FieldApiClient } from './apiClient';
import { durableAttachmentStorage } from './durableAttachmentStorage';

export interface WalletCacheRecord {
    documents: ComplianceDocument[];
    lastSynchronized: string;
    actorId: number;
    scope: string; // e.g. 'personnel' or assetCode
}

// In-memory metadata fallback for test runners or when filesystem is resolving
const inMemoryWalletCache = new Map<string, WalletCacheRecord>();

async function getFs() {
    try {
        let fs: any;

        try {
            fs = await import('expo-file-system/legacy');
        } catch {
            fs = await import('expo-file-system');
        }

        if (fs && (fs.documentDirectory || fs.Paths?.document)) {
            return fs;
        }

        return null;
    } catch {
        return null;
    }
}

function getMetadataPath(
    actorId: number,
    scope: string,
    docDir?: string | null,
): string {
    const actorDir = durableAttachmentStorage.getActorAttachmentDirectory(
        actorId,
        docDir,
    );
    const cleanScope = scope.replace(/[^a-zA-Z0-9_-]/g, '_');

    return `${actorDir}metadata_${cleanScope}.json`;
}

async function readCachedMetadata(
    actorId: number,
    scope: string,
): Promise<WalletCacheRecord | null> {
    const memKey = `${actorId}:${scope}`;
    const fs = await getFs();
    const docDir = fs?.documentDirectory || fs?.Paths?.document?.uri || null;
    const path = getMetadataPath(actorId, scope, docDir);

    if (fs?.readAsStringAsync) {
        try {
            const content = await fs.readAsStringAsync(path);

            if (content) {
                const parsed = JSON.parse(content) as WalletCacheRecord;
                inMemoryWalletCache.set(memKey, parsed);

                return parsed;
            }
        } catch {
            // File does not exist or read failed
        }
    }

    return inMemoryWalletCache.get(memKey) ?? null;
}

async function writeCachedMetadata(record: WalletCacheRecord): Promise<void> {
    const memKey = `${record.actorId}:${record.scope}`;
    inMemoryWalletCache.set(memKey, record);

    const fs = await getFs();
    const docDir = fs?.documentDirectory || fs?.Paths?.document?.uri || null;
    const path = getMetadataPath(record.actorId, record.scope, docDir);
    const actorDir = durableAttachmentStorage.getActorAttachmentDirectory(
        record.actorId,
        docDir,
    );

    if (fs?.writeAsStringAsync) {
        try {
            if (fs.makeDirectoryAsync) {
                await fs.makeDirectoryAsync(actorDir, { intermediates: true });
            }

            await fs.writeAsStringAsync(path, JSON.stringify(record));
        } catch (err) {
            console.warn(
                '[WalletService] Failed to write cached metadata to disk:',
                err,
            );
        }
    }
}

export class WalletService {
    private static userGenerations = new Map<number, number>();

    public static getUserGeneration(userId: number): number {
        return this.userGenerations.get(userId) ?? 0;
    }

    public static bumpUserGeneration(userId: number): number {
        const next = (this.userGenerations.get(userId) ?? 0) + 1;
        this.userGenerations.set(userId, next);

        return next;
    }

    /**
     * Get documents from server or cached store.
     * Reconciles offline availability with durable file storage.
     */
    public static async getDocuments(
        apiClient: FieldApiClient,
        userId: number,
        assetCode?: string,
        forceRefresh: boolean = false,
    ): Promise<ComplianceDocument[]> {
        const scope = assetCode || 'personnel';

        try {
            if (!forceRefresh) {
                const cached = await readCachedMetadata(userId, scope);

                if (cached && cached.documents.length > 0) {
                    // Trigger non-blocking background refresh if online
                    this.fetchAndCache(
                        apiClient,
                        userId,
                        scope,
                        assetCode,
                    ).catch(() => {});

                    return await this.reconcileLocalFiles(cached.documents);
                }
            }

            return await this.fetchAndCache(
                apiClient,
                userId,
                scope,
                assetCode,
            );
        } catch (error) {
            console.warn(
                '[WalletService] Network fetch failed, reading from offline cache:',
                error,
            );
            const cached = await readCachedMetadata(userId, scope);

            if (cached) {
                return await this.reconcileLocalFiles(cached.documents);
            }

            return [];
        }
    }

    /**
     * Fetch from network and update cache while preserving valid downloaded local files.
     */
    private static async fetchAndCache(
        apiClient: FieldApiClient,
        userId: number,
        scope: string,
        assetCode?: string,
    ): Promise<ComplianceDocument[]> {
        const startGeneration = this.getUserGeneration(userId);
        let remoteDocs: ComplianceDocument[] = [];

        if (assetCode) {
            remoteDocs = await apiClient.fetchAssetPermits(assetCode);
        } else {
            remoteDocs = await apiClient.fetchPersonnelCredentials();
        }

        if (this.getUserGeneration(userId) !== startGeneration) {
            return [];
        }

        const nowIso = new Date().toISOString();
        const existingRecord = await readCachedMetadata(userId, scope);
        const existingMap = new Map<string, ComplianceDocument>();

        if (existingRecord) {
            for (const doc of existingRecord.documents) {
                existingMap.set(doc.id, doc);
            }
        }

        // Merge remote documents with existing local file persistence.
        // On version mismatch, keep the existing file so offline access is preserved
        // until the operator successfully downloads the new version.
        const mergedDocs: ComplianceDocument[] = remoteDocs.map((remote) => {
            const existing = existingMap.get(remote.id);
            const isSameVersion =
                existing &&
                (!remote.version || existing.version === remote.version);

            if (existing && existing.localFileUri) {
                return {
                    ...remote,
                    localFileUri: existing.localFileUri,
                    isAvailableOffline: isSameVersion
                        ? true
                        : Boolean(existing.isAvailableOffline),
                    lastSynchronized: nowIso,
                };
            }

            return {
                ...remote,
                isAvailableOffline: false,
                lastSynchronized: nowIso,
            };
        });

        const reconciled = await this.reconcileLocalFiles(mergedDocs);

        if (this.getUserGeneration(userId) !== startGeneration) {
            return [];
        }

        await writeCachedMetadata({
            documents: reconciled,
            lastSynchronized: nowIso,
            actorId: userId,
            scope,
        });

        return reconciled;
    }

    /**
     * Reconcile whether local durable files actually exist on disk.
     */
    public static async reconcileLocalFiles(
        docs: ComplianceDocument[],
    ): Promise<ComplianceDocument[]> {
        const fs = await getFs();
        const updated: ComplianceDocument[] = [];

        for (const doc of docs) {
            if (!doc.localFileUri) {
                updated.push({ ...doc, isAvailableOffline: false });
                continue;
            }

            let fileExists = false;

            if (fs?.getInfoAsync) {
                try {
                    const info = await fs.getInfoAsync(doc.localFileUri);
                    fileExists = Boolean(
                        info.exists &&
                        ('size' in info ? (info.size as number) > 0 : true),
                    );
                } catch {
                    fileExists = false;
                }
            } else {
                // In-memory or simulated fallback
                fileExists = Boolean(doc.localFileUri);
            }

            updated.push({
                ...doc,
                isAvailableOffline: fileExists,
                localFileUri: fileExists ? doc.localFileUri : null,
            });
        }

        return updated;
    }

    /**
     * Explicit user action: Download document attachment to durable application storage.
     * Prevents partial/corrupted downloads by writing to temporary file first.
     */
    public static async makeAvailableOffline(
        document: ComplianceDocument,
        userId: number,
        apiClient: FieldApiClient,
        assetCode?: string,
    ): Promise<ComplianceDocument> {
        if (!document.fileUri) {
            throw new Error(
                'Document does not have an attachment to download.',
            );
        }

        const startGeneration = this.getUserGeneration(userId);
        const scope = assetCode || 'personnel';
        const fs = await getFs();
        const docDir =
            fs?.documentDirectory || fs?.Paths?.document?.uri || null;
        const actorDir = durableAttachmentStorage.getActorAttachmentDirectory(
            userId,
            docDir,
        );

        if (fs?.makeDirectoryAsync) {
            try {
                await fs.makeDirectoryAsync(actorDir, { intermediates: true });
            } catch {
                // Directory exists or fallback
            }
        }

        const cleanScope = scope.replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeDocId = document.id.replace(/[^a-zA-Z0-9_-]/g, '_');
        const ver = document.version ? `_v${document.version}` : '';
        const ext = document.fileType?.includes('png')
            ? '.png'
            : document.fileType?.includes('jpeg') ||
                document.fileType?.includes('jpg')
              ? '.jpg'
              : '.pdf';
        const targetFilename = `wallet_${cleanScope}_doc_${safeDocId}${ver}${ext}`;
        const destUri = `${actorDir}${targetFilename}`;
        const tempUri = `${actorDir}${targetFilename}.downloading`;
        const oldLocalUri = document.localFileUri;

        try {
            // Clean up any stale partial download first
            if (fs?.deleteAsync) {
                await fs.deleteAsync(tempUri, { idempotent: true });
            }

            const downloadHeaders = apiClient.getHeaders();

            if (fs?.downloadAsync) {
                let result = await fs.downloadAsync(document.fileUri, tempUri, {
                    headers: downloadHeaders,
                });

                if (result.status === 401 || result.status === 403) {
                    const refreshedHeaders = apiClient.getHeaders();
                    result = await fs.downloadAsync(document.fileUri, tempUri, {
                        headers: refreshedHeaders,
                    });
                }

                if (result.status >= 400) {
                    throw new Error(
                        `Server returned status ${result.status} while downloading document.`,
                    );
                }

                if (this.getUserGeneration(userId) !== startGeneration) {
                    await fs.deleteAsync(tempUri, { idempotent: true });

                    throw new Error('User session changed during download.');
                }

                // Move from temp to final destination
                if (fs.moveAsync) {
                    await fs.moveAsync({ from: tempUri, to: destUri });
                } else if (fs.copyAsync) {
                    await fs.copyAsync({ from: tempUri, to: destUri });
                    await fs.deleteAsync(tempUri, { idempotent: true });
                }
            } else {
                if (this.getUserGeneration(userId) !== startGeneration) {
                    throw new Error('User session changed during download.');
                }

                // Simulated durable write for tests
                await durableAttachmentStorage.saveAttachmentDurably(
                    {
                        uri: destUri,
                        fileName: targetFilename,
                        base64: 'JVBERi0xLjQKJcTl8uXrp...',
                    },
                    userId,
                );
            }

            if (this.getUserGeneration(userId) !== startGeneration) {
                if (fs?.deleteAsync) {
                    await fs.deleteAsync(destUri, { idempotent: true });
                }

                throw new Error('User session changed during download.');
            }

            // Only delete old local file if replacement succeeded and URI differs
            if (oldLocalUri && oldLocalUri !== destUri) {
                await durableAttachmentStorage
                    .deleteAttachment(oldLocalUri)
                    .catch(() => {});
            }

            const updatedDoc: ComplianceDocument = {
                ...document,
                isAvailableOffline: true,
                localFileUri: destUri,
            };

            // Update metadata cache
            const cached = await readCachedMetadata(userId, scope);

            if (cached && this.getUserGeneration(userId) === startGeneration) {
                const newDocs = cached.documents.map((d) =>
                    d.id === document.id ? updatedDoc : d,
                );
                await writeCachedMetadata({
                    ...cached,
                    documents: newDocs,
                });
            }

            return updatedDoc;
        } catch (error) {
            // Ensure temp file is removed on error
            if (fs?.deleteAsync) {
                try {
                    await fs.deleteAsync(tempUri, { idempotent: true });
                } catch {
                    // Ignore cleanup error
                }
            }

            console.error(
                '[WalletService] Failed to make document available offline:',
                error,
            );

            throw error;
        }
    }

    /**
     * Remove local offline copy without deleting the backend record.
     */
    public static async removeOfflineCopy(
        document: ComplianceDocument,
        userId: number,
        assetCode?: string,
    ): Promise<ComplianceDocument> {
        const scope = assetCode || 'personnel';

        if (document.localFileUri) {
            await durableAttachmentStorage.deleteAttachment(
                document.localFileUri,
            );
        }

        const updatedDoc: ComplianceDocument = {
            ...document,
            isAvailableOffline: false,
            localFileUri: null,
        };

        const cached = await readCachedMetadata(userId, scope);

        if (cached) {
            const newDocs = cached.documents.map((d) =>
                d.id === document.id ? updatedDoc : d,
            );
            await writeCachedMetadata({
                ...cached,
                documents: newDocs,
            });
        }

        return updatedDoc;
    }

    /**
     * Clear all wallet metadata and attachments for a specific user upon logout/switch.
     */
    public static async clearWalletCache(userId: number): Promise<void> {
        this.bumpUserGeneration(userId);

        // Clear in-memory
        for (const key of inMemoryWalletCache.keys()) {
            if (key.startsWith(`${userId}:`)) {
                inMemoryWalletCache.delete(key);
            }
        }

        // Clean up durable disk attachments
        await durableAttachmentStorage.cleanupActorAttachments(userId);
    }
}
