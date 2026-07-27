export interface TokenStorageProvider {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
}

export class MemoryTokenStorage implements TokenStorageProvider {
  private token: string | null = null;

  async getToken(): Promise<string | null> {
    return this.token;
  }

  async setToken(token: string): Promise<void> {
    this.token = token;
  }

  async clearToken(): Promise<void> {
    this.token = null;
  }
}

export class SecureTokenStorage implements TokenStorageProvider {
  private readonly storageKey: string;
  private memoryFallback: MemoryTokenStorage;

  constructor(storageKey = 'core2_field_bearer_token') {
    this.storageKey = storageKey;
    this.memoryFallback = new MemoryTokenStorage();
  }

  async getToken(): Promise<string | null> {
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).ExpoSecureStore) {
        return await (globalThis as any).ExpoSecureStore.getItemAsync(this.storageKey);
      }
    } catch {
      // Fallback on native storage error or missing module
    }

    return this.memoryFallback.getToken();
  }

  async setToken(token: string): Promise<void> {
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).ExpoSecureStore) {
        await (globalThis as any).ExpoSecureStore.setItemAsync(this.storageKey, token);

        return;
      }
    } catch {
      // Fallback on native storage error or missing module
    }

    await this.memoryFallback.setToken(token);
  }

  async clearToken(): Promise<void> {
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).ExpoSecureStore) {
        await (globalThis as any).ExpoSecureStore.deleteItemAsync(this.storageKey);

        return;
      }
    } catch {
      // Fallback on native storage error or missing module
    }

    await this.memoryFallback.clearToken();
  }
}

export const defaultTokenStorage: TokenStorageProvider = new SecureTokenStorage();

