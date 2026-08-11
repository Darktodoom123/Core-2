import type { ReactNode } from 'react';
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from 'react';
import { FieldApiClient, ApiClientError } from '../services/apiClient';
import type { User } from '../types/index';
import { resolveApiBaseUrl } from './config';
import { isAuthorizedFieldRole } from './fieldRoles';
import type { TokenStorageProvider } from './tokenStorage';
import { defaultTokenStorage } from './tokenStorage';

export { resolveApiBaseUrl } from './config';

export type AuthStatus =
    | 'uninitialized'
    | 'bootstrapping'
    | 'authenticated'
    | 'unauthenticated'
    | 'suspended';

export const offlineSessionVerificationError =
    'Unable to verify your session. Check your connection and try again.';

export interface AuthState {
    user: User | null;
    status: AuthStatus;
    error: string | null;
    isInitializing: boolean;
    hasPendingRevocation: boolean;
}

export interface AuthContextType extends AuthState {
    login: (
        username: string,
        password: string,
        deviceName?: string,
    ) => Promise<void>;
    logout: () => Promise<boolean>;
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
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
    children,
    baseUrl = resolveApiBaseUrl(),
    tokenStorage = defaultTokenStorage,
    fetchFn,
}) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [status, setStatus] = useState<AuthStatus>('uninitialized');
    const [error, setError] = useState<string | null>(null);
    const [hasPendingRevocation, setHasPendingRevocation] = useState(false);

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

    const clearLocalIdentity = useCallback(() => {
        setUser(null);
        setToken(null);
        setStatus('unauthenticated');
    }, []);

    const revokeStagedToken = useCallback(
        async (tokenToRevoke: string): Promise<boolean> => {
            const revocationClient = new FieldApiClient({
                baseUrl,
                getToken: () => tokenToRevoke,
                fetchFn,
            });

            try {
                await revocationClient.logout();
            } catch (err: unknown) {
                if (!(err instanceof ApiClientError && err.status === 401)) {
                    setHasPendingRevocation(true);
                    setError(
                        'Secure sign-out is pending. Reconnect and retry before signing in again.',
                    );

                    return false;
                }
            }

            try {
                await tokenStorage.clearToken();
                await tokenStorage.clearPendingRevocationToken();
            } catch {
                setHasPendingRevocation(true);
                setError(
                    'The server rejected the previous token, but secure local cleanup is pending. Retry before signing in again.',
                );

                return false;
            }

            setHasPendingRevocation(false);
            setError(null);

            return true;
        },
        [baseUrl, fetchFn, tokenStorage],
    );

    const stageAndRevokeToken = useCallback(
        async (tokenToRevoke: string): Promise<boolean> => {
            try {
                await tokenStorage.stageTokenForRevocation(tokenToRevoke);
                await tokenStorage.clearToken();
            } catch {
                setError(
                    'Secure sign-out could not be prepared. Try again before leaving the app.',
                );

                return false;
            }

            clearLocalIdentity();
            setHasPendingRevocation(true);

            return revokeStagedToken(tokenToRevoke);
        },
        [clearLocalIdentity, revokeStagedToken, tokenStorage],
    );

    const bootstrap = useCallback(async () => {
        setStatus('bootstrapping');
        setError(null);

        try {
            const pendingToken = await tokenStorage.getPendingRevocationToken();

            if (pendingToken) {
                clearLocalIdentity();
                setHasPendingRevocation(true);

                if (!(await revokeStagedToken(pendingToken))) {
                    return;
                }
            }

            let activeToken = token;

            if (!activeToken) {
                activeToken = await tokenStorage.getToken();
            }

            if (!activeToken) {
                setUser(null);
                setToken(null);
                setStatus('unauthenticated');
                setHasPendingRevocation(false);

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
                setHasPendingRevocation(false);
                setError(
                    'This account is suspended. Contact a system administrator.',
                );

                return;
            }

            if (!isAuthorizedFieldRole(meUser.role)) {
                if (await stageAndRevokeToken(activeToken)) {
                    setError(
                        'This account role cannot use the field mobile application.',
                    );
                }

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
                    setHasPendingRevocation(false);
                    setError(
                        err.message ||
                            'Account access is forbidden or suspended.',
                    );

                    return;
                }

                if (err.status === 401) {
                    await tokenStorage.clearToken();
                    setUser(null);
                    setToken(null);
                    setStatus('unauthenticated');
                    setHasPendingRevocation(false);
                    setError('Your session has expired. Please sign in again.');

                    return;
                }
            }

            // Preserve a stored token when identity verification failed because the
            // device is offline or the API is temporarily unavailable. The next
            // bootstrap can retry without forcing the worker to sign in again.
            setUser(null);
            setStatus('unauthenticated');
            setError(offlineSessionVerificationError);
        }
    }, [
        baseUrl,
        clearLocalIdentity,
        fetchFn,
        revokeStagedToken,
        stageAndRevokeToken,
        token,
        tokenStorage,
    ]);

    const login = useCallback(
        async (username: string, password: string, deviceName?: string) => {
            setError(null);

            try {
                const pendingToken =
                    await tokenStorage.getPendingRevocationToken();

                if (pendingToken && !(await revokeStagedToken(pendingToken))) {
                    return;
                }

                const result = await apiClient.login(
                    username,
                    password,
                    deviceName,
                );

                if (!isAuthorizedFieldRole(result.user.role)) {
                    if (await stageAndRevokeToken(result.token)) {
                        setError(
                            'This account role cannot use the field mobile application.',
                        );
                    }

                    return;
                }

                await tokenStorage.setToken(result.token);
                await tokenStorage.clearPendingRevocationToken();
                setToken(result.token);
                setUser(result.user);
                setStatus('authenticated');
                setHasPendingRevocation(false);
            } catch (err: unknown) {
                if (err instanceof ApiClientError) {
                    if (err.status === 403) {
                        setStatus('suspended');
                        setError(
                            err.message ||
                                'This account is suspended. Contact a system administrator.',
                        );

                        return;
                    }

                    if (err.status === 429) {
                        setError(
                            'Too many login attempts. Please wait before trying again.',
                        );

                        return;
                    }

                    setError(
                        err.message || 'The provided credentials are invalid.',
                    );

                    return;
                }

                setError(
                    err instanceof Error &&
                        /fetch failed|network request failed|network error|connectexception|failed to connect/i.test(
                            err.message,
                        )
                        ? 'Unable to reach the field API. Check that the phone and computer are on the same Wi-Fi network, then start Laravel with: php artisan serve --host=0.0.0.0 --port=8000'
                        : err instanceof Error
                          ? err.message
                          : 'An unexpected error occurred during sign in.',
                );
            }
        },
        [apiClient, revokeStagedToken, stageAndRevokeToken, tokenStorage],
    );

    const logout = useCallback(async (): Promise<boolean> => {
        setError(null);

        try {
            const pendingToken = await tokenStorage.getPendingRevocationToken();
            const tokenToRevoke = token ?? pendingToken;

            if (!tokenToRevoke) {
                await tokenStorage.clearToken();
                clearLocalIdentity();
                setHasPendingRevocation(false);

                return true;
            }

            if (pendingToken && !token) {
                clearLocalIdentity();
                setHasPendingRevocation(true);

                return revokeStagedToken(pendingToken);
            }

            return stageAndRevokeToken(tokenToRevoke);
        } catch {
            setError(
                'Secure sign-out could not access protected storage. Try again before leaving the app.',
            );

            return false;
        }
    }, [
        clearLocalIdentity,
        revokeStagedToken,
        stageAndRevokeToken,
        token,
        tokenStorage,
    ]);

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
            status,
            error,
            hasPendingRevocation,
            isInitializing:
                status === 'uninitialized' || status === 'bootstrapping',
            login,
            logout,
            bootstrap,
            clearError,
            apiClient,
        }),
        [
            user,
            status,
            error,
            hasPendingRevocation,
            login,
            logout,
            bootstrap,
            clearError,
            apiClient,
        ],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
};
