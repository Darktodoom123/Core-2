export interface StoredAttachment {
    uri: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
}

export interface FileSystemLike {
    documentDirectory: string | null;
    EncodingType: {
        Base64: string;
        UTF8: string;
    };
    makeDirectoryAsync: (
        path: string,
        options?: { intermediates?: boolean },
    ) => Promise<void>;
    copyAsync: (options: { from: string; to: string }) => Promise<void>;
    writeAsStringAsync: (
        path: string,
        contents: string,
        options?: { encoding?: any },
    ) => Promise<void>;
    readAsStringAsync: (
        path: string,
        options?: { encoding?: any },
    ) => Promise<string>;
    getInfoAsync: (
        path: string,
    ) => Promise<{ exists: boolean; size?: number; isDirectory?: boolean }>;
    deleteAsync: (
        path: string,
        options?: { idempotent?: boolean },
    ) => Promise<void>;
}

let cachedFileSystem: FileSystemLike | null = null;

/** The photo could not be written to durable device storage. */
export class AttachmentStorageError extends Error {
    constructor(detail: string) {
        super(`Could not save the photo on this device: ${detail}`);
        this.name = 'AttachmentStorageError';
    }
}

/**
 * Adapter over the modern expo-file-system API (File/Directory/Paths). Since
 * SDK 54 the legacy functions live in `expo-file-system/legacy`, and on
 * Android the legacy native module may be absent, so the modern API is used
 * whenever it exists.
 */
export function modernFileSystem(fsModule: any): FileSystemLike | null {
    const { File, Directory, Paths } = fsModule ?? {};

    if (!File || !Directory || !Paths?.document?.uri) {
        return null;
    }

    const isBase64 = (encoding: unknown) =>
        encoding === 'base64' || encoding === fsModule.EncodingType?.Base64;

    return {
        documentDirectory: Paths.document.uri,
        EncodingType: { Base64: 'base64', UTF8: 'utf8' },
        makeDirectoryAsync: async (path, options) => {
            new Directory(path).create({
                intermediates: options?.intermediates ?? false,
                idempotent: true,
            });
        },
        copyAsync: async ({ from, to }) => {
            await new File(from).copy(new File(to));
        },
        writeAsStringAsync: async (path, contents, options) => {
            new File(path).write(contents, {
                encoding: isBase64(options?.encoding) ? 'base64' : 'utf8',
            });
        },
        readAsStringAsync: async (path, options) => {
            const file = new File(path);

            return isBase64(options?.encoding) ? file.base64() : file.text();
        },
        getInfoAsync: async (path) => {
            const file = new File(path);

            if (file.exists) {
                return {
                    exists: true,
                    size: file.size ?? 0,
                    isDirectory: false,
                };
            }

            const directory = new Directory(path);

            return { exists: directory.exists, isDirectory: directory.exists };
        },
        deleteAsync: async (path, options) => {
            const file = new File(path);
            const directory = new Directory(path);
            const target = file.exists
                ? file
                : directory.exists
                  ? directory
                  : null;

            if (target) {
                target.delete();
            } else if (!options?.idempotent) {
                throw new Error(`File not found: ${path}`);
            }
        },
    };
}

/**
 * Loads a module synchronously. Metro bundles these literal `require` calls;
 * lazy `import()` fails in the Android dev client ("Cannot read property
 * 'reload' of undefined"), which left every durable save unwritten. Under the
 * plain Node unit runner the modules are unavailable and this returns null.
 */
function loadModule(name: 'expo-file-system' | 'expo-file-system/legacy'): any {
    try {
        if (name === 'expo-file-system') {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            return require('expo-file-system');
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('expo-file-system/legacy');
    } catch {
        return null;
    }
}

/** True inside the React Native runtime (device, emulator, or Jest RN preset). */
function isReactNativeRuntime(): boolean {
    return (
        typeof navigator !== 'undefined' &&
        (navigator as { product?: string }).product === 'ReactNative'
    );
}

/** Test seam: lets tests supply a file system adapter directly. */
export function setFileSystemForTesting(fs: FileSystemLike | null): void {
    cachedFileSystem = fs;
}

async function resolveFileSystem(): Promise<FileSystemLike | null> {
    if (cachedFileSystem !== null) {
        return cachedFileSystem;
    }

    try {
        const modern = modernFileSystem(loadModule('expo-file-system'));

        if (modern) {
            cachedFileSystem = modern;

            return cachedFileSystem;
        }

        const legacy: any = loadModule('expo-file-system/legacy');

        if (legacy?.documentDirectory && legacy.copyAsync) {
            cachedFileSystem = {
                documentDirectory: legacy.documentDirectory,
                EncodingType: legacy.EncodingType || {
                    Base64: 'base64',
                    UTF8: 'utf8',
                },
                makeDirectoryAsync: legacy.makeDirectoryAsync,
                copyAsync: legacy.copyAsync,
                writeAsStringAsync: legacy.writeAsStringAsync,
                readAsStringAsync: legacy.readAsStringAsync,
                getInfoAsync: legacy.getInfoAsync,
                deleteAsync: legacy.deleteAsync,
            };

            return cachedFileSystem;
        }

        return null;
    } catch {
        return null;
    }
}

export class DurableAttachmentStorage {
    private inMemoryStorage = new Map<
        string,
        { content?: string; size: number }
    >();

    /**
     * Get root durable attachments directory for an actor
     */
    public getActorAttachmentDirectory(
        actorId: number | string,
        baseDir?: string | null,
    ): string {
        const root =
            baseDir ||
            cachedFileSystem?.documentDirectory ||
            'file:///data/user/0/com.core2.fieldmobile/files/';

        return `${root}attachments/actor_${actorId}/`;
    }

    /**
     * Copy a temporary photo or write base64 data to durable app storage.
     * Guaranteed to survive app restart and OS cache purging.
     */
    public async saveAttachmentDurably(
        source: { uri?: string; base64?: string; fileName?: string },
        actorId: number | string,
    ): Promise<StoredAttachment> {
        const fs = await resolveFileSystem();
        const actorDir = this.getActorAttachmentDirectory(
            actorId,
            fs?.documentDirectory,
        );
        const timestamp = Date.now();
        const rand = Math.random().toString(36).substring(2, 9);
        const cleanName = (source.fileName || 'photo.jpg').replace(
            /[^a-zA-Z0-9._-]/g,
            '_',
        );
        const fileName = `${timestamp}_${rand}_${cleanName}`;
        const destUri = `${actorDir}${fileName}`;

        if (fs?.makeDirectoryAsync) {
            try {
                await fs.makeDirectoryAsync(actorDir, {
                    intermediates: true,
                });

                if (source.base64) {
                    const rawBase64 = source.base64.includes(';base64,')
                        ? source.base64.split(';base64,')[1]
                        : source.base64;
                    await fs.writeAsStringAsync(destUri, rawBase64, {
                        encoding: fs.EncodingType.Base64,
                    });
                } else if (source.uri) {
                    await fs.copyAsync({
                        from: source.uri,
                        to: destUri,
                    });
                }

                const info = await fs.getInfoAsync(destUri);

                if (!info.exists) {
                    throw new Error('The copied file was not found.');
                }

                return {
                    uri: destUri,
                    fileName,
                    fileSize:
                        info.exists && 'size' in info
                            ? (info.size as number)
                            : undefined,
                };
            } catch (error) {
                // A native write failed. Surface it: returning a path that was
                // never written would queue an upload that can never succeed.
                throw new AttachmentStorageError(
                    error instanceof Error ? error.message : String(error),
                );
            }
        }

        if (isReactNativeRuntime()) {
            // On a device a missing file system means the photo cannot be
            // kept; fail instead of queueing an upload with no file behind it.
            throw new AttachmentStorageError('file storage is unavailable.');
        }

        // Pure Node / Unit test runner fallback
        this.inMemoryStorage.set(destUri, {
            content: source.base64,
            size: source.base64?.length || 1024,
        });

        return {
            uri: destUri,
            fileName,
            fileSize: source.base64?.length || 1024,
        };
    }

    /**
     * Remove all durable attachments for a specific actor (Account Isolation Cleanup)
     */
    public async cleanupActorAttachments(
        actorId: number | string,
    ): Promise<void> {
        const fs = await resolveFileSystem();
        const actorDir = this.getActorAttachmentDirectory(
            actorId,
            fs?.documentDirectory,
        );

        if (fs?.deleteAsync) {
            try {
                await fs.deleteAsync(actorDir, { idempotent: true });
            } catch {
                // Ignore cleanup errors
            }
        }

        for (const key of this.inMemoryStorage.keys()) {
            if (key.includes(`/actor_${actorId}/`)) {
                this.inMemoryStorage.delete(key);
            }
        }
    }

    /**
     * Extract all attachment URIs referenced within a command payload.
     * Traverses arrays, objects, photos, attachments, signatures, and check structures.
     */
    public extractAttachmentUris(
        payload?: Record<string, unknown> | null,
    ): string[] {
        if (!payload || typeof payload !== 'object') {
            return [];
        }

        const uris = new Set<string>();

        const inspect = (val: unknown): void => {
            if (!val) {
                return;
            }

            if (typeof val === 'string') {
                if (
                    val.startsWith('file://') ||
                    val.startsWith('content://') ||
                    this.isDurableUri(val)
                ) {
                    uris.add(val);
                }

                return;
            }

            if (Array.isArray(val)) {
                for (const item of val) {
                    inspect(item);
                }

                return;
            }

            if (typeof val === 'object') {
                const obj = val as Record<string, unknown>;

                if (typeof obj.uri === 'string') {
                    inspect(obj.uri);
                }

                if (typeof obj.file_path === 'string') {
                    inspect(obj.file_path);
                }

                if (typeof obj.path === 'string') {
                    inspect(obj.path);
                }

                if (typeof obj.url === 'string') {
                    inspect(obj.url);
                }

                for (const key of Object.keys(obj)) {
                    inspect(obj[key]);
                }
            }
        };

        inspect(payload);

        return Array.from(uris);
    }

    /**
     * Check if a durable attachment URI is referenced by any command in the given list.
     * Evaluates all retained commands including failed, conflicted, authentication-blocked, and dependent commands.
     */
    public isAttachmentReferenced(
        uri: string,
        commands: Array<{ id?: string; payload?: Record<string, unknown> }>,
        excludeCommandId?: string,
    ): boolean {
        if (!uri) {
            return false;
        }

        for (const cmd of commands) {
            if (excludeCommandId && cmd.id === excludeCommandId) {
                continue;
            }

            const uris = this.extractAttachmentUris(cmd.payload);

            if (uris.includes(uri)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Delete a single durable attachment, ensuring it is not referenced by any other command.
     * Returns true if deleted, false if deletion was blocked due to active references.
     */
    public async deleteAttachment(
        uri: string,
        commandsToCheck?: Array<{
            id?: string;
            payload?: Record<string, unknown>;
        }>,
        excludeCommandId?: string,
    ): Promise<boolean> {
        if (
            commandsToCheck &&
            this.isAttachmentReferenced(uri, commandsToCheck, excludeCommandId)
        ) {
            return false;
        }

        const fs = await resolveFileSystem();

        if (fs?.deleteAsync) {
            try {
                await fs.deleteAsync(uri, { idempotent: true });
            } catch {
                // Ignore
            }
        }

        this.inMemoryStorage.delete(uri);

        return true;
    }

    /**
     * Check if a durable attachment exists on disk or in simulated memory storage
     */
    public async attachmentExists(uri: string): Promise<boolean> {
        if (!uri) {
            return false;
        }

        const fs = await resolveFileSystem();

        if (fs?.getInfoAsync) {
            try {
                const info = await fs.getInfoAsync(uri);

                return Boolean(info && info.exists);
            } catch {
                return this.inMemoryStorage.has(uri);
            }
        }

        return this.inMemoryStorage.has(uri);
    }

    /**
     * Verify whether a URI is located in durable storage
     */
    public isDurableUri(uri: string): boolean {
        return uri.includes('/attachments/actor_');
    }
}

export const durableAttachmentStorage = new DurableAttachmentStorage();
