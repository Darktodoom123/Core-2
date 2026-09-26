import {
    durableAttachmentStorage,
    modernFileSystem,
    setFileSystemForTesting,
} from '../services/durableAttachmentStorage';

type FakeEntry = { size: number; kind: 'file' | 'dir' };

/**
 * Loads a fresh copy of the storage service against a fake of the modern
 * expo-file-system API (File / Directory / Paths), the shape SDK 57 ships.
 */
function loadWithModernFileSystem(options: { failCopy?: boolean } = {}) {
    const disk = new Map<string, FakeEntry>([
        ['file:///cache/ImagePicker/receipt.jpg', { size: 2048, kind: 'file' }],
    ]);
    const join = (...parts: (string | { uri: string })[]) => {
        const joined = parts
            .map((part) => (typeof part === 'string' ? part : part.uri))
            .join('/');

        return `file://${joined.slice('file://'.length).replace(/\/{2,}/g, '/')}`;
    };

    class File {
        uri: string;
        constructor(...parts: (string | { uri: string })[]) {
            this.uri = join(...parts);
        }
        get exists() {
            return disk.get(this.uri)?.kind === 'file';
        }
        get size() {
            return disk.get(this.uri)?.size ?? null;
        }
        async copy(to: File) {
            if (options.failCopy) {
                throw new Error('disk full');
            }

            disk.set(to.uri, { ...disk.get(this.uri)!, kind: 'file' });
        }
        write(contents: string) {
            disk.set(this.uri, { size: contents.length, kind: 'file' });
        }
        delete() {
            disk.delete(this.uri);
        }
    }

    class Directory {
        uri: string;
        constructor(...parts: (string | { uri: string })[]) {
            this.uri = join(...parts);
        }
        get exists() {
            return disk.get(this.uri)?.kind === 'dir';
        }
        create() {
            disk.set(this.uri, { size: 0, kind: 'dir' });
        }
        delete() {
            disk.delete(this.uri);
        }
    }

    setFileSystemForTesting(
        modernFileSystem({
            File,
            Directory,
            Paths: { document: { uri: 'file:///data/files/' } },
        }),
    );

    return { storage: durableAttachmentStorage, disk };
}

afterEach(() => {
    setFileSystemForTesting(null);
});

it('copies a receipt into durable storage with the modern file system API', async () => {
    const { storage, disk } = loadWithModernFileSystem();

    const stored = await storage.saveAttachmentDurably(
        {
            uri: 'file:///cache/ImagePicker/receipt.jpg',
            fileName: 'receipt.jpg',
        },
        3,
    );

    expect(stored.uri).toMatch(
        /^file:\/\/\/data\/files\/attachments\/actor_3\/\d+_[a-z0-9]+_receipt\.jpg$/,
    );
    expect(disk.get(stored.uri)).toEqual({ size: 2048, kind: 'file' });
    expect(stored.fileSize).toBe(2048);
});

it('fails loudly instead of returning a path that was never written', async () => {
    const { storage } = loadWithModernFileSystem({ failCopy: true });

    await expect(
        storage.saveAttachmentDurably(
            {
                uri: 'file:///cache/ImagePicker/receipt.jpg',
                fileName: 'receipt.jpg',
            },
            3,
        ),
    ).rejects.toThrow('Could not save the photo on this device: disk full');
});
