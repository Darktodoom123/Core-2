import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { FieldApiClient, ApiClientError } from '../services/apiClient.js';
import type { User } from '../types/index.js';
import type { TokenStorageProvider } from './tokenStorage.js';
import { defaultTokenStorage } from './tokenStorage.js';

export type AuthStatus =
  | 'uninitialized'
  | 'bootstrapping'
  | 'authenticated'
  | 'unauthenticated'
  | 'suspended';

export interface AuthState {
  user: User | null;
  token: string | null;
  status: AuthStatus;
  error: string | null;
  isInitializing: boolean;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string, deviceName?: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  clearError: () => void;
  apiClient: FieldApiClient;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
  baseUrl?: string;
  tokenStorage?: TokenStorageProvider;
  fetchFn?: typeof fetch;
  initialToken?: string | null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000',
  tokenStorage = defaultTokenStorage,
  fetchFn,
  initialToken = null,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(initialToken);
  const [status, setStatus] = useState<AuthStatus>('uninitialized');
  const [error, setError] = useState<string | null>(null);

  const apiClient = useMemo(() => {
    return new FieldApiClient({
      baseUrl,
      getToken: () => token,
      fetchFn,
    });
  }, [baseUrl, token, fetchFn]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const bootstrap = useCallback(async () => {
    setStatus('bootstrapping');
    setError(null);

    try {
      let activeToken = token;

      if (!activeToken) {
        activeToken = await tokenStorage.getToken();
      }

      if (!activeToken) {
        setUser(null);
        setToken(null);
        setStatus('unauthenticated');

        return;
      }

      setToken(activeToken);

      const verifyClient = new FieldApiClient({
        baseUrl,
        getToken: () => activeToken,
        fetchFn,
      });

      const meUser = await verifyClient.fetchMe();

      if (!meUser.is_active) {
        await tokenStorage.clearToken();
        setUser(null);
        setToken(null);
        setStatus('suspended');
        setError('This account is suspended. Contact a system administrator.');

        return;
      }

      setUser(meUser);
      setStatus('authenticated');
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 403) {
          await tokenStorage.clearToken();
          setUser(null);
          setToken(null);
          setStatus('suspended');
          setError(err.message || 'Account access is forbidden or suspended.');

          return;
        }

        if (err.status === 401) {
          await tokenStorage.clearToken();
          setUser(null);
          setToken(null);
          setStatus('unauthenticated');
          setError('Your session has expired. Please sign in again.');

          return;
        }
      }

      // Preserve a stored token when identity verification failed because the
      // device is offline or the API is temporarily unavailable. The next
      // bootstrap can retry without forcing the worker to sign in again.
      setUser(null);
      setStatus('unauthenticated');
      setError('Unable to verify your session. Check your connection and try again.');
    }
  }, [baseUrl, token, tokenStorage, fetchFn]);

  const login = useCallback(
    async (email: string, password: string, deviceName?: string) => {
      setError(null);

      try {
        const result = await apiClient.login(email, password, deviceName);
        await tokenStorage.setToken(result.token);
        setToken(result.token);
        setUser(result.user);
        setStatus('authenticated');
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          if (err.status === 403) {
            setStatus('suspended');
            setError(err.message || 'This account is suspended. Contact a system administrator.');

            return;
          }

          if (err.status === 429) {
            setError('Too many login attempts. Please wait before trying again.');

            return;
          }

          setError(err.message || 'The provided credentials are invalid.');

          return;
        }

        setError(err instanceof Error ? err.message : 'An unexpected error occurred during sign in.');
      }
    },
    [apiClient, tokenStorage]
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch {
      // Swallowed on network failure to ensure client session is always revoked locally
    } finally {
      await tokenStorage.clearToken();
      setUser(null);
      setToken(null);
      setStatus('unauthenticated');
      setError(null);
    }
  }, [apiClient, tokenStorage]);

  useEffect(() => {
    if (status === 'uninitialized') {
      queueMicrotask(() => {
        void bootstrap();
      });
    }
  }, [status, bootstrap]);

  const value: AuthContextType = useMemo(
    () => ({
      user,
      token,
      status,
      error,
      isInitializing: status === 'uninitialized' || status === 'bootstrapping',
      login,
      logout,
      bootstrap,
      clearError,
      apiClient,
    }),
    [user, token, status, error, login, logout, bootstrap, clearError, apiClient]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
