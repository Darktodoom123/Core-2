import type { ErrorInfo, ReactNode } from 'react';
import React, {
    Component,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    AppState,
    BackHandler,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { offlineSessionVerificationError } from '../auth/AuthContext';
import { isAuthorizedFieldRole } from '../auth/fieldRoles';
import { LoginScreen } from '../auth/LoginScreen';
import { AssignedJobsListScreen } from '../screens/AssignedJobsListScreen';
import { JobDetailScreen } from '../screens/JobDetailScreen';
import { colors, sharedStyles } from '../components/nativeStyles';
import { defaultNetworkMonitor } from '../connectivity/networkMonitor';
import type { NetworkMonitor } from '../connectivity/networkMonitor';
import { nativeLocationAdapter } from '../native/locationAdapter';
import { ApiClientError } from '../services/apiClient';
import { CommandOutboxManager } from '../services/commandOutbox';
import { LocationSharingService } from '../services/locationService';
import { createDefaultOutboxRepository } from '../storage/outboxRepository';
import type { OutboxRepository } from '../storage/outboxRepository';
import type { PayloadHasher } from '../storage/outboxRepository';
import type {
    DispatchJob,
    DispatchStatus,
    OutboxCommand,
} from '../types/index';

export { isAuthorizedFieldRole } from '../auth/fieldRoles';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    public state: ErrorBoundaryState = { hasError: false };

    public static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        if (__DEV__) {
            console.error('Uncaught mobile boundary error', {
                componentStack: errorInfo.componentStack,
                name: error.name,
            });
        }
    }

    public render() {
        if (this.state.hasError) {
            return (
                <SafeAreaView style={styles.fullScreen}>
                    <View
                        accessible
                        accessibilityLiveRegion="assertive"
                        accessibilityRole="alert"
                        style={styles.centerCard}
                    >
                        <Text style={styles.errorTitle}>
                            Mobile application exception
                        </Text>
                        <Text style={styles.bodyText}>
                            An unexpected error occurred in the field app.
                        </Text>
                        <Pressable
                            accessibilityLabel="Reset application shell"
                            accessibilityRole="button"
                            onPress={() => this.setState({ hasError: false })}
                            style={({ pressed }) => [
                                sharedStyles.button,
                                styles.actionButton,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Text style={sharedStyles.buttonText}>
                                Reset application shell
                            </Text>
                        </Pressable>
                    </View>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}

export interface AppNavigatorProps {
    networkMonitor?: NetworkMonitor;
    outboxHasher?: PayloadHasher;
    outboxRepository?: OutboxRepository;
}

export const AppNavigator: React.FC<AppNavigatorProps> = ({
    networkMonitor,
    outboxHasher,
    outboxRepository,
}) => {
    const {
        user,
        status,
        bootstrap,
        logout,
        isInitializing,
        apiClient,
        error: authError,
    } = useAuth();
    const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
    const [jobs, setJobs] = useState<DispatchJob[]>([]);
    const [jobsError, setJobsError] = useState<string | null>(null);
    const [outboxCommands, setOutboxCommands] = useState<OutboxCommand[]>([]);
    const [isLoadingJobs, setIsLoadingJobs] = useState(false);
    const [isOnline, setIsOnline] = useState<boolean | null>(null);
    const [isOutboxReady, setIsOutboxReady] = useState(false);
    const previousOnlineRef = useRef<boolean | null>(null);
    const { width } = useWindowDimensions();
    const isCompact = width < 600;

    const commandOutbox = useMemo(
        () =>
            new CommandOutboxManager({
                hasher: outboxHasher,
                repository: outboxRepository ?? createDefaultOutboxRepository(),
            }),
        [outboxHasher, outboxRepository],
    );
    const connectivity = useMemo(
        () => networkMonitor ?? defaultNetworkMonitor,
        [networkMonitor],
    );
    const locationService = useMemo(
        () => new LocationSharingService(commandOutbox),
        [commandOutbox],
    );
    const getCurrentLocation = useCallback(
        () => nativeLocationAdapter.getCurrentLocation(),
        [],
    );

    useEffect(
        () => commandOutbox.subscribe(setOutboxCommands),
        [commandOutbox],
    );

    useEffect(() => {
        let active = true;
        const unsubscribe = connectivity.subscribe(setIsOnline);

        void connectivity
            .fetchIsOnline()
            .then((online) => {
                if (active) {
                    setIsOnline(online);
                }
            })
            .catch(() => {
                if (active) {
                    setIsOnline(false);
                }
            });

        return () => {
            active = false;
            unsubscribe();
        };
    }, [connectivity]);

    useEffect(() => {
        const reconnected =
            previousOnlineRef.current === false && isOnline === true;
        previousOnlineRef.current = isOnline;

        if (
            reconnected &&
            status === 'unauthenticated' &&
            authError === offlineSessionVerificationError
        ) {
            queueMicrotask(() => void bootstrap());
        }
    }, [authError, bootstrap, isOnline, status]);

    const handleRequestFailure = useCallback(
        async (err: unknown, fallback: string) => {
            if (
                err instanceof ApiClientError &&
                (err.status === 401 || err.status === 403)
            ) {
                await logout();

                return;
            }

            setJobsError(err instanceof Error ? err.message : fallback);
        },
        [logout],
    );

    const fetchJobs = useCallback(async () => {
        if (status !== 'authenticated' || isOnline !== true) {
            return;
        }

        setIsLoadingJobs(true);
        setJobsError(null);

        try {
            setJobs((await apiClient.fetchAssignedJobs()) || []);
        } catch (error: unknown) {
            await handleRequestFailure(
                error,
                'Failed to fetch assigned dispatches.',
            );
        } finally {
            setIsLoadingJobs(false);
        }
    }, [apiClient, handleRequestFailure, isOnline, status]);

    const syncQueue = useCallback(async () => {
        if (status !== 'authenticated' || isOnline !== true || !isOutboxReady) {
            return;
        }

        const result = await commandOutbox.processQueue(apiClient);

        if (result.requiresAuthentication) {
            await logout();

            return;
        }

        if (result.completed > 0) {
            await fetchJobs();
        }
    }, [
        apiClient,
        commandOutbox,
        fetchJobs,
        isOnline,
        isOutboxReady,
        logout,
        status,
    ]);

    useEffect(() => {
        let active = true;

        if (status === 'authenticated' && user) {
            queueMicrotask(() => {
                if (active) {
                    setIsOutboxReady(false);
                }
            });
            void commandOutbox
                .activateActor(user.id)
                .then(() => {
                    if (active) {
                        setIsOutboxReady(true);
                    }
                })
                .catch(() => {
                    if (active) {
                        setJobsError(
                            'Secure offline storage could not be initialized.',
                        );
                    }
                });
        } else {
            commandOutbox.deactivateActor();
            queueMicrotask(() => {
                if (active) {
                    setIsOutboxReady(false);
                }
            });
        }

        return () => {
            active = false;
        };
    }, [commandOutbox, status, user]);

    useEffect(() => {
        if (status === 'authenticated' && isOnline === true) {
            queueMicrotask(() => void fetchJobs());
        } else if (status !== 'authenticated') {
            queueMicrotask(() => {
                setJobs([]);
                setSelectedJobId(null);
            });
        }
    }, [fetchJobs, isOnline, status]);

    useEffect(() => {
        if (isOnline === true && isOutboxReady) {
            queueMicrotask(() => void syncQueue());
        }
    }, [isOnline, isOutboxReady, syncQueue]);

    useEffect(() => {
        if (isOnline !== true || !isOutboxReady) {
            return;
        }

        const nextRetryAt = commandOutbox.getNextRetryAt();

        if (!nextRetryAt) {
            return;
        }

        const delay = Math.max(0, Date.parse(nextRetryAt) - Date.now());
        const timeout = setTimeout(() => void syncQueue(), delay);

        return () => clearTimeout(timeout);
    }, [commandOutbox, isOnline, isOutboxReady, outboxCommands, syncQueue]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active' && status === 'authenticated' && user) {
                void commandOutbox
                    .activateActor(user.id)
                    .then(() => void syncQueue());
            }
        });

        return () => subscription.remove();
    }, [commandOutbox, status, syncQueue, user]);

    useEffect(() => {
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                if (selectedJobId !== null) {
                    setSelectedJobId(null);

                    return true;
                }

                return false;
            },
        );

        return () => subscription.remove();
    }, [selectedJobId]);

    const handleSelectJob = useCallback(
        (jobId: number) => setSelectedJobId(jobId),
        [],
    );
    const handleBackToList = useCallback(() => setSelectedJobId(null), []);

    const handleAcceptAssignment = useCallback(
        async (jobId: number, assignmentId: number, version: number) => {
            setIsLoadingJobs(true);

            try {
                await commandOutbox.enqueueRespondAssignment(
                    jobId,
                    assignmentId,
                    'accepted',
                    undefined,
                    version,
                );
                await syncQueue();
            } catch (error: unknown) {
                await handleRequestFailure(
                    error,
                    'Failed to accept assignment.',
                );
            } finally {
                setIsLoadingJobs(false);
            }
        },
        [commandOutbox, handleRequestFailure, syncQueue],
    );

    const handleRejectAssignment = useCallback(
        async (
            jobId: number,
            assignmentId: number,
            reason: string,
            version: number,
        ) => {
            setIsLoadingJobs(true);

            try {
                await commandOutbox.enqueueRespondAssignment(
                    jobId,
                    assignmentId,
                    'rejected',
                    reason,
                    version,
                );
                await syncQueue();
            } catch (error: unknown) {
                await handleRequestFailure(
                    error,
                    'Failed to reject assignment.',
                );
            } finally {
                setIsLoadingJobs(false);
            }
        },
        [commandOutbox, handleRequestFailure, syncQueue],
    );

    const handleTransitionStatus = useCallback(
        async (jobId: number, nextStatus: DispatchStatus, version: number) => {
            setIsLoadingJobs(true);

            try {
                await commandOutbox.enqueueTransitionStatus(
                    jobId,
                    nextStatus,
                    version,
                );
                await syncQueue();
            } catch (error: unknown) {
                await handleRequestFailure(error, 'Failed to progress status.');
            } finally {
                setIsLoadingJobs(false);
            }
        },
        [commandOutbox, handleRequestFailure, syncQueue],
    );

    const handleAcceptServerState = useCallback(
        (commandId: string) => {
            void commandOutbox
                .resolveConflictAcceptServer(commandId)
                .then(fetchJobs)
                .catch((error: unknown) =>
                    handleRequestFailure(
                        error,
                        'Failed to accept current server state.',
                    ),
                );
        },
        [commandOutbox, fetchJobs, handleRequestFailure],
    );

    const handleRetryNewVersion = useCallback(
        (commandId: string, newVersion: number) => {
            void commandOutbox
                .resolveConflictWithNewVersion(commandId, newVersion, apiClient)
                .then(fetchJobs)
                .catch((error: unknown) =>
                    handleRequestFailure(
                        error,
                        'Failed to create the reviewed command.',
                    ),
                );
        },
        [apiClient, commandOutbox, fetchJobs, handleRequestFailure],
    );

    const handleRetryCommand = useCallback(
        (commandId: string) => {
            void commandOutbox
                .retryCommand(commandId, apiClient)
                .then(async (result) => {
                    if (result.requiresAuthentication) {
                        await logout();
                    } else if (result.completed > 0) {
                        await fetchJobs();
                    }
                })
                .catch((error: unknown) =>
                    handleRequestFailure(
                        error,
                        'Failed to retry the queued command.',
                    ),
                );
        },
        [apiClient, commandOutbox, fetchJobs, handleRequestFailure, logout],
    );

    const handleDiscardCommand = useCallback(
        (commandId: string) => {
            void commandOutbox
                .discardCommand(commandId)
                .catch((error: unknown) =>
                    handleRequestFailure(
                        error,
                        'Failed to discard the queued command.',
                    ),
                );
        },
        [commandOutbox, handleRequestFailure],
    );

    if (isInitializing) {
        return (
            <SafeAreaView style={styles.fullScreen}>
                <StatusBar
                    barStyle="dark-content"
                    backgroundColor={colors.surface}
                />
                <View
                    accessible
                    accessibilityLiveRegion="polite"
                    accessibilityRole="summary"
                    style={styles.loadingState}
                >
                    <ActivityIndicator color={colors.amber} size="large" />
                    <Text style={styles.loadingText}>
                        Initializing Core 2 Field Mobile…
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    if (status === 'unauthenticated') {
        return <LoginScreen />;
    }

    if (status === 'suspended') {
        return (
            <SafeAreaView style={styles.fullScreen}>
                <View
                    accessibilityLabel="Account suspended"
                    style={styles.centerCard}
                    testID="suspended-screen"
                >
                    <Text style={styles.errorTitle}>Account suspended</Text>
                    <Text style={styles.bodyText}>
                        {authError ||
                            'This account is suspended. Contact a system administrator.'}
                    </Text>
                    <Pressable
                        accessibilityLabel="Back to sign in"
                        accessibilityRole="button"
                        onPress={() => void logout()}
                        style={styles.actionButton}
                    >
                        <Text style={sharedStyles.buttonText}>
                            Back to sign in
                        </Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    if (
        status === 'authenticated' &&
        user &&
        !isAuthorizedFieldRole(user.role)
    ) {
        return (
            <SafeAreaView style={styles.fullScreen}>
                <View
                    accessibilityLabel="Role access restricted"
                    style={styles.centerCard}
                    testID="restricted-role-screen"
                >
                    <Text style={styles.errorTitle}>Access restricted</Text>
                    <Text style={styles.bodyText}>
                        Your user role ({user.role || 'none'}) does not have
                        permission to access the field mobile application.
                    </Text>
                    <Pressable
                        accessibilityLabel="Sign out of field app"
                        accessibilityRole="button"
                        onPress={() => void logout()}
                        style={styles.actionButton}
                        testID="logout-button"
                    >
                        <Text style={sharedStyles.buttonText}>Sign out</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const activeJob = jobs.find((job) => job.id === selectedJobId) || null;

    return (
        <ErrorBoundary>
            <SafeAreaView style={styles.fullScreen}>
                <StatusBar
                    barStyle="dark-content"
                    backgroundColor={colors.surface}
                />
                <View
                    style={styles.appShell}
                    testID={
                        isCompact ? 'compact-app-shell' : 'expanded-app-shell'
                    }
                >
                    <View
                        style={[
                            styles.mainContent,
                            !isCompact && styles.mainContentExpanded,
                        ]}
                    >
                        {selectedJobId !== null && jobsError ? (
                            <View
                                accessible
                                accessibilityLiveRegion="assertive"
                                accessibilityRole="alert"
                                style={styles.commandError}
                                testID="command-error-alert"
                            >
                                <Text style={styles.commandErrorText}>
                                    {jobsError}
                                </Text>
                            </View>
                        ) : null}
                        {selectedJobId === null || !activeJob || !user ? (
                            <AssignedJobsListScreen
                                jobs={jobs}
                                outboxCommands={outboxCommands}
                                isLoading={isLoadingJobs}
                                isOnline={isOnline}
                                userName={user?.name}
                                userRole={user?.role.replaceAll('_', ' ')}
                                error={jobsError}
                                onRefresh={() => void fetchJobs()}
                                onSyncNow={() => void syncQueue()}
                                onRetryCommand={handleRetryCommand}
                                onDiscardCommand={handleDiscardCommand}
                                onSelectJob={handleSelectJob}
                                onLogout={() => void logout()}
                            />
                        ) : (
                            <JobDetailScreen
                                job={activeJob}
                                user={user}
                                outboxCommands={outboxCommands}
                                locationService={locationService}
                                getCurrentLocation={getCurrentLocation}
                                onBackToList={handleBackToList}
                                onAcceptAssignment={handleAcceptAssignment}
                                onRejectAssignment={handleRejectAssignment}
                                onTransitionStatus={handleTransitionStatus}
                                onAcceptServerState={handleAcceptServerState}
                                onRetryNewVersion={handleRetryNewVersion}
                                onLocationQueued={() => void syncQueue()}
                            />
                        )}
                    </View>
                </View>
            </SafeAreaView>
        </ErrorBoundary>
    );
};

const styles = StyleSheet.create({
    fullScreen: {
        backgroundColor: colors.background,
        flex: 1,
    },
    appShell: {
        flex: 1,
    },
    loadingState: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    loadingText: {
        color: colors.secondary,
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
    },
    header: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 72,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerCompact: {
        alignItems: 'stretch',
        flexDirection: 'column',
        gap: 10,
    },
    headerBrand: {
        alignItems: 'center',
        flexDirection: 'row',
        flexShrink: 1,
        gap: 10,
    },
    brandMark: {
        backgroundColor: colors.amber,
        borderRadius: 2,
        height: 28,
        width: 7,
    },
    headerTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
    },
    connectivityPill: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 999,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 32,
        paddingHorizontal: 10,
    },
    connectivityDot: {
        borderRadius: 5,
        height: 10,
        width: 10,
    },
    connectivityChecking: {
        backgroundColor: colors.muted,
    },
    connectivityOnline: {
        backgroundColor: colors.green,
    },
    connectivityPending: {
        backgroundColor: colors.warning,
    },
    connectivityOffline: {
        backgroundColor: colors.red,
    },
    connectivityText: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    userProfile: {
        alignItems: 'center',
        flexDirection: 'row',
        flexShrink: 1,
        gap: 10,
    },
    userProfileCompact: {
        alignItems: 'stretch',
        justifyContent: 'space-between',
    },
    userInfo: {
        alignItems: 'flex-start',
        flexShrink: 1,
    },
    userName: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
        maxWidth: 220,
    },
    roleBadge: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
        textTransform: 'capitalize',
    },
    avatarPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    avatarCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.amberSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitials: {
        color: colors.amberDark,
        fontSize: 12,
        fontWeight: '800',
    },
    logoutButton: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderWidth: 1,
        borderRadius: 8,
        justifyContent: 'center',
        minHeight: 48,
        minWidth: 76,
        paddingHorizontal: 12,
    },
    logoutText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    mainContent: {
        backgroundColor: colors.background,
        flex: 1,
    },
    mainContentExpanded: {
        alignSelf: 'center',
        maxWidth: 720,
        width: '100%',
    },
    commandError: {
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
        borderRadius: 10,
        borderWidth: 1,
        marginHorizontal: 16,
        marginTop: 16,
        padding: 12,
    },
    commandErrorText: {
        color: colors.red,
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 20,
    },
    centerCard: {
        alignSelf: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        margin: 24,
        maxWidth: 440,
        padding: 24,
        width: '90%',
    },
    errorTitle: {
        color: colors.red,
        fontSize: 21,
        fontWeight: '800',
        marginBottom: 10,
    },
    bodyText: {
        color: colors.secondary,
        fontSize: 15,
        lineHeight: 22,
    },
    actionButton: {
        alignSelf: 'flex-start',
        backgroundColor: colors.amber,
        borderRadius: 7,
        marginTop: 18,
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    pressed: {
        opacity: 0.78,
    },
});
