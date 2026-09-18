import type { ReactNode } from 'react';
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from 'react';
import {
    FieldApiClient,
    ApiClientError,
    isLoginChallenge,
} from '../services/apiClient';
import type { LoginChallengeResult } from '../services/apiClient';
import { getInstallationId } from '../services/notificationService';
import { WalletService } from '../services/walletService';
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

export interface LogoutOptions {
    forgetDevice?: boolean;
    deviceTrustToken?: string | null;
    installationId?: string | null;
    registeredBefore?: string | null;
}

export interface AuthState {
    user: User | null;
    token?: string | null;
    status: AuthStatus;
    error: string | null;
    isInitializing: boolean;
    hasPendingRevocation: boolean;
    isChallenging: boolean;
    challengeData: LoginChallengeResult | null;
    isOffline: boolean;
}

export interface AuthContextType extends AuthState {
    login: (
        username: string,
        password: string,
        deviceName?: string,
    ) => Promise<void>;
    verifyChallenge: (
        code: string,
        trustDevice?: boolean,
        deviceName?: string,
    ) => Promise<void>;
    resendChallenge: () => Promise<void>;
    cancelChallenge: () => void;
    logout: (options?: LogoutOptions) => Promise<boolean>;
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
    const [isChallenging, setIsChallenging] = useState(false);
    const [challengeData, setChallengeData] =
        useState<LoginChallengeResult | null>(null);
    const [isOffline, setIsOffline] = useState(false);

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
        setIsOffline(false);
        setIsChallenging(false);
        setChallengeData(null);
    }, []);

    const revokeStagedToken = useCallback(
        async (
            tokenToRevoke: string,
            logoutOptions?: LogoutOptions,
        ): Promise<boolean> => {
            const revocationClient = new FieldApiClient({
                baseUrl,
                getToken: () => tokenToRevoke,
                fetchFn,
            });

            try {
                let instId = logoutOptions?.installationId;

                if (!instId) {
                    try {
                        instId = await getInstallationId();
                    } catch {
                        instId = undefined;
                    }
                }

                await revocationClient.logout({
                    ...logoutOptions,
                    installationId: instId,
                    registeredBefore:
                        logoutOptions?.registeredBefore ??
                        new Date().toISOString(),
                });
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
        async (
            tokenToRevoke: string,
            logoutOptions?: LogoutOptions,
        ): Promise<boolean> => {
            try {
                if (tokenStorage.clearOfflineSession) {
                    await tokenStorage.clearOfflineSession();
                }

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

            return revokeStagedToken(tokenToRevoke, logoutOptions);
        },
        [clearLocalIdentity, revokeStagedToken, tokenStorage],
    );

    const bootstrap = useCallback(async () => {
        setStatus('bootstrapping');
        setError(null);
        setIsChallenging(false);
        setChallengeData(null);

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
                setIsOffline(false);

                return;
            }

            setToken(activeToken);

            const verifyClient = new FieldApiClient({
                baseUrl,
                getToken: () => activeToken,
                fetchFn,
            });

            try {
                const meUser = await verifyClient.fetchMe();

                if (!meUser.is_active) {
                    await tokenStorage.clearToken();

                    if (tokenStorage.clearOfflineSession) {
                        await tokenStorage.clearOfflineSession();
                    }

                    setUser(null);
                    setToken(null);
                    setStatus('suspended');
                    setHasPendingRevocation(false);
                    setIsOffline(false);
                    setError(
                        'This account is suspended. Contact a system administrator.',
                    );

                    return;
                }

                if (!isAuthorizedFieldRole(meUser.role)) {
                    if (tokenStorage.clearOfflineSession) {
                        await tokenStorage.clearOfflineSession();
                    }

                    if (await stageAndRevokeToken(activeToken)) {
                        setError(
                            'This account role cannot use the field mobile application.',
                        );
                    }

                    return;
                }

                const now = Date.now();

                if (tokenStorage.setOfflineSession) {
                    await tokenStorage.setOfflineSession({
                        user: meUser,
                        verifiedAt: now,
                        allowanceHours: 24,
                        lastObservedTime: now,
                    });
                }

                setUser(meUser);
                setStatus('authenticated');
                setIsOffline(false);
                setHasPendingRevocation(false);
            } catch (err: unknown) {
                if (err instanceof ApiClientError) {
                    if (err.status === 403) {
                        await tokenStorage.clearToken();

                        if (tokenStorage.clearOfflineSession) {
                            await tokenStorage.clearOfflineSession();
                        }

                        setUser(null);
                        setToken(null);
                        setStatus('suspended');
                        setHasPendingRevocation(false);
                        setIsOffline(false);
                        setError(
                            err.message ||
                                'Account access is forbidden or suspended.',
                        );

                        return;
                    }

                    if (err.status === 401) {
                        await tokenStorage.clearToken();

                        if (tokenStorage.clearOfflineSession) {
                            await tokenStorage.clearOfflineSession();
                        }

                        setUser(null);
                        setToken(null);
                        setStatus('unauthenticated');
                        setHasPendingRevocation(false);
                        setIsOffline(false);
                        setError(
                            'Your session has expired. Please sign in again.',
                        );

                        return;
                    }
                }

                // Network or server availability error: inspect bounded offline session
                const offlineSession = tokenStorage.getOfflineSession
                    ? await tokenStorage.getOfflineSession()
                    : null;

                if (offlineSession) {
                    const now = Date.now();

                    // Anti-tamper check: reject clock rollback
                    if (
                        now < offlineSession.verifiedAt ||
                        now < offlineSession.lastObservedTime
                    ) {
                        setUser(null);
                        setStatus('unauthenticated');
                        setIsOffline(false);
                        setError(
                            'Clock tampering detected. Please connect to the internet to verify your identity.',
                        );

                        return;
                    }

                    // 24-hour allowance check
                    const allowanceMs =
                        (offlineSession.allowanceHours || 24) * 60 * 60 * 1000;

                    if (now - offlineSession.verifiedAt > allowanceMs) {
                        // Allowance expired: do NOT clear stored token or outbox, but require online sign-in
                        setUser(null);
                        setStatus('unauthenticated');
                        setIsOffline(false);
                        setError(
                            'Offline access expired. Connect to internet to verify identity.',
                        );

                        return;
                    }

                    // Valid offline session: record lastObservedTime without rolling verifiedAt forward
                    if (tokenStorage.setOfflineSession) {
                        await tokenStorage.setOfflineSession({
                            ...offlineSession,
                            lastObservedTime: now,
                        });
                    }

                    setUser(offlineSession.user);
                    setStatus('authenticated');
                    setIsOffline(true);
                    setError(null);

                    return;
                }

                // Preserve a stored token when identity verification failed because the
                // device is offline or the API is temporarily unavailable. The next
                // bootstrap can retry without forcing the worker to sign in again.
                setUser(null);
                setStatus('unauthenticated');
                setIsOffline(false);
                setError(offlineSessionVerificationError);
            }
        } catch {
            setUser(null);
            setStatus('unauthenticated');
            setIsOffline(false);
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
            setIsChallenging(false);
            setChallengeData(null);

            try {
                const pendingToken =
                    await tokenStorage.getPendingRevocationToken();

                if (pendingToken && !(await revokeStagedToken(pendingToken))) {
                    return;
                }

                const deviceTrustToken = tokenStorage.getDeviceTrustToken
                    ? await tokenStorage.getDeviceTrustToken()
                    : null;

                const result = await apiClient.login(
                    username,
                    password,
                    deviceName,
                    deviceTrustToken,
                );

                if (isLoginChallenge(result)) {
                    setIsChallenging(true);
                    setChallengeData(result);

                    return;
                }

                if (!isAuthorizedFieldRole(result.user.role)) {
                    if (await stageAndRevokeToken(result.token)) {
                        setError(
                            'This account role cannot use the field mobile application.',
                        );
                    }

                    return;
                }

                if (result.trust_token && tokenStorage.setDeviceTrustToken) {
                    await tokenStorage.setDeviceTrustToken(result.trust_token);
                }

                const now = Date.now();

                if (tokenStorage.setOfflineSession) {
                    await tokenStorage.setOfflineSession({
                        user: result.user,
                        verifiedAt: now,
                        allowanceHours: 24,
                        lastObservedTime: now,
                    });
                }

                await tokenStorage.setToken(result.token);
                await tokenStorage.clearPendingRevocationToken();
                setToken(result.token);
                setUser(result.user);
                setStatus('authenticated');
                setIsOffline(false);
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
                        ? 'Unable to reach the field API. Check that the phone and computer are on the same Wi-Fi network, then start Laravel with: php apps/operations/artisan serve --host=0.0.0.0 --port=8000'
                        : err instanceof Error
                          ? err.message
                          : 'An unexpected error occurred during sign in.',
                );
            }
        },
        [apiClient, revokeStagedToken, stageAndRevokeToken, tokenStorage],
    );

    const verifyChallenge = useCallback(
        async (code: string, trustDevice = false, deviceName?: string) => {
            if (!challengeData) {
                setError('No active verification challenge.');

                return;
            }

            setError(null);

            try {
                const result = await apiClient.verifyLoginChallenge(
                    challengeData.challenge_id,
                    code,
                    trustDevice,
                    deviceName,
                );

                if (!isAuthorizedFieldRole(result.user.role)) {
                    if (await stageAndRevokeToken(result.token)) {
                        setError(
                            'This account role cannot use the field mobile application.',
                        );
                    }

                    setIsChallenging(false);
                    setChallengeData(null);

                    return;
                }

                if (result.trust_token && tokenStorage.setDeviceTrustToken) {
                    await tokenStorage.setDeviceTrustToken(result.trust_token);
                }

                const now = Date.now();

                if (tokenStorage.setOfflineSession) {
                    await tokenStorage.setOfflineSession({
                        user: result.user,
                        verifiedAt: now,
                        allowanceHours: 24,
                        lastObservedTime: now,
                    });
                }

                await tokenStorage.setToken(result.token);
                await tokenStorage.clearPendingRevocationToken();
                setToken(result.token);
                setUser(result.user);
                setStatus('authenticated');
                setIsOffline(false);
                setHasPendingRevocation(false);
                setIsChallenging(false);
                setChallengeData(null);
            } catch (err: unknown) {
                if (err instanceof ApiClientError) {
                    if (err.status === 403) {
                        setStatus('suspended');
                        setError(
                            err.message ||
                                'This account is suspended. Contact a system administrator.',
                        );
                        setIsChallenging(false);
                        setChallengeData(null);

                        return;
                    }

                    if (err.status === 429) {
                        setError(
                            'Too many verification attempts. Please wait before trying again.',
                        );

                        return;
                    }

                    setError(
                        err.message ||
                            'Invalid verification code. Please try again.',
                    );

                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : 'An unexpected error occurred during verification.',
                );
            }
        },
        [apiClient, challengeData, stageAndRevokeToken, tokenStorage],
    );

    const resendChallenge = useCallback(async () => {
        if (!challengeData) {
            setError('No active verification challenge.');

            return;
        }

        setError(null);

        try {
            const result = await apiClient.resendLoginChallenge(
                challengeData.challenge_id,
            );

            setChallengeData((prev) =>
                prev
                    ? {
                          ...prev,
                          challenge_id: result.challenge_id,
                          expires_in_seconds: result.expires_in_seconds,
                          cooldown_seconds: result.cooldown_seconds,
                      }
                    : null,
            );
        } catch (err: unknown) {
            if (err instanceof ApiClientError) {
                if (err.status === 429) {
                    setError(
                        'Please wait before requesting another verification code.',
                    );

                    return;
                }

                setError(
                    err.message || 'Unable to resend code. Please try again.',
                );

                return;
            }

            setError('An unexpected error occurred while resending the code.');
        }
    }, [apiClient, challengeData]);

    const cancelChallenge = useCallback(() => {
        setIsChallenging(false);
        setChallengeData(null);
        setError(null);
    }, []);

    const logout = useCallback(
        async (options?: LogoutOptions): Promise<boolean> => {
            setError(null);

            try {
                if (tokenStorage.clearOfflineSession) {
                    await tokenStorage.clearOfflineSession();
                }

                if (user?.id) {
                    await WalletService.clearWalletCache(user.id).catch(
                        () => {},
                    );
                }

                let deviceTrustToken: string | null = null;

                if (options?.forgetDevice && tokenStorage.getDeviceTrustToken) {
                    deviceTrustToken = await tokenStorage.getDeviceTrustToken();

                    if (tokenStorage.clearDeviceTrustToken) {
                        await tokenStorage.clearDeviceTrustToken();
                    }
                }

                const pendingToken =
                    await tokenStorage.getPendingRevocationToken();
                const tokenToRevoke = token ?? pendingToken;

                if (!tokenToRevoke) {
                    await tokenStorage.clearToken();
                    clearLocalIdentity();
                    setHasPendingRevocation(false);
                    setIsOffline(false);

                    return true;
                }

                const logoutOptions: LogoutOptions = {
                    forgetDevice: options?.forgetDevice,
                    deviceTrustToken,
                    installationId: options?.installationId,
                    registeredBefore: options?.registeredBefore,
                };

                if (pendingToken && !token) {
                    clearLocalIdentity();
                    setHasPendingRevocation(true);
                    setIsOffline(false);

                    return revokeStagedToken(pendingToken, logoutOptions);
                }

                setIsOffline(false);

                return stageAndRevokeToken(tokenToRevoke, logoutOptions);
            } catch {
                setError(
                    'Secure sign-out could not access protected storage. Try again before leaving the app.',
                );

                return false;
            }
        },
        [
            clearLocalIdentity,
            revokeStagedToken,
            stageAndRevokeToken,
            token,
            tokenStorage,
            user,
        ],
    );

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
            isChallenging,
            challengeData,
            isOffline,
            isInitializing:
                status === 'uninitialized' || status === 'bootstrapping',
            login,
            verifyChallenge,
            resendChallenge,
            cancelChallenge,
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
            isChallenging,
            challengeData,
            isOffline,
            login,
            verifyChallenge,
            resendChallenge,
            cancelChallenge,
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
