export interface TokenStorageProvider {
    getToken(): Promise<string | null>;
    setToken(token: string): Promise<void>;
    clearToken(): Promise<void>;
    getPendingRevocationToken(): Promise<string | null>;
    stageTokenForRevocation(token: string): Promise<void>;
    clearPendingRevocationToken(): Promise<void>;
}

export interface SecureStoreProvider {
    getItemAsync(key: string): Promise<string | null>;
    setItemAsync(key: string, value: string): Promise<void>;
    deleteItemAsync(key: string): Promise<void>;
}

const expoSecureStore: SecureStoreProvider = {
    getItemAsync: async (key) => {
        const secureStore = await import('expo-secure-store');

        return secureStore.getItemAsync(key, {
            keychainService: 'com.core2.fieldmobile.authentication',
        });
    },
    setItemAsync: async (key, value) => {
        const secureStore = await import('expo-secure-store');

        await secureStore.setItemAsync(key, value, {
            keychainAccessible: secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
            keychainService: 'com.core2.fieldmobile.authentication',
        });
    },
    deleteItemAsync: async (key) => {
        const secureStore = await import('expo-secure-store');

        await secureStore.deleteItemAsync(key, {
            keychainService: 'com.core2.fieldmobile.authentication',
        });
    },
};

export class SecureTokenStorage implements TokenStorageProvider {
    private readonly storageKey: string;
    private readonly pendingRevocationStorageKey: string;
    private readonly secureStore: SecureStoreProvider;

    constructor(
        storageKey = 'core2_field_bearer_token',
        secureStore: SecureStoreProvider = expoSecureStore,
    ) {
        this.storageKey = storageKey;
        this.pendingRevocationStorageKey = `${storageKey}_pending_revocation`;
        this.secureStore = secureStore;
    }

    async getToken(): Promise<string | null> {
        return this.secureStore.getItemAsync(this.storageKey);
    }

    async setToken(token: string): Promise<void> {
        await this.secureStore.setItemAsync(this.storageKey, token);
    }

    async clearToken(): Promise<void> {
        await this.secureStore.deleteItemAsync(this.storageKey);
    }

    async getPendingRevocationToken(): Promise<string | null> {
        return this.secureStore.getItemAsync(this.pendingRevocationStorageKey);
    }

    async stageTokenForRevocation(token: string): Promise<void> {
        await this.secureStore.setItemAsync(
            this.pendingRevocationStorageKey,
            token,
        );
    }

    async clearPendingRevocationToken(): Promise<void> {
        await this.secureStore.deleteItemAsync(
            this.pendingRevocationStorageKey,
        );
    }
}

export const defaultTokenStorage: TokenStorageProvider =
    new SecureTokenStorage();
