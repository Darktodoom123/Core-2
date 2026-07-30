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
import { isAuthorizedFieldRole } from '../auth/fieldRoles';
import { LoginScreen } from '../auth/LoginScreen';
import { AssignedJobsListScreen } from '../components/AssignedJobsListScreen';
import { JobDetailScreen } from '../components/JobDetailScreen';
import { colors, sharedStyles } from '../components/nativeStyles';
import { ApiClientError } from '../services/apiClient';
import {
    CommandOutboxManager,
    createCommandId,
} from '../services/commandOutbox';
import { LocationSharingService } from '../services/locationService';
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

export const AppNavigator: React.FC = () => {
    const {
        user,
        status,
        logout,
        isInitializing,
        apiClient,
        error: authError,
    } = useAuth();
    const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
    const [jobs, setJobs] = useState<DispatchJob[]>([]);
    const [outboxCommands, setOutboxCommands] = useState<OutboxCommand[]>([]);
    const [isLoadingJobs, setIsLoadingJobs] = useState(false);
    const [jobsError, setJobsError] = useState<string | null>(null);
    const previousUserId = useRef<number | null>(null);
    const { width } = useWindowDimensions();
    const isCompact = width < 600;

    const commandOutbox = useMemo(() => new CommandOutboxManager(), []);
    const locationService = useMemo(
        () => new LocationSharingService(commandOutbox),
        [commandOutbox],
    );

    useEffect(
        () => commandOutbox.subscribe(setOutboxCommands),
        [commandOutbox],
    );

    useEffect(() => {
        const currentUserId =
            status === 'authenticated' ? (user?.id ?? null) : null;

        if (previousUserId.current !== currentUserId) {
            commandOutbox.clearAll();
            previousUserId.current = currentUserId;
        }
    }, [commandOutbox, status, user?.id]);

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
        if (status !== 'authenticated') {
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
    }, [apiClient, handleRequestFailure, status]);

    useEffect(() => {
        if (status === 'authenticated') {
            queueMicrotask(() => void fetchJobs());
        } else {
            queueMicrotask(() => {
                setJobs([]);
                setSelectedJobId(null);
            });
        }
    }, [fetchJobs, status]);

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
                const updated = await apiClient.respondAssignment(
                    jobId,
                    assignmentId,
                    'accepted',
                    undefined,
                    version,
                    createCommandId(),
                );
                setJobs((previous) =>
                    previous.map((job) =>
                        job.id === updated.id ? updated : job,
                    ),
                );
            } catch (error: unknown) {
                await handleRequestFailure(
                    error,
                    'Failed to accept assignment.',
                );
            } finally {
                setIsLoadingJobs(false);
            }
        },
        [apiClient, handleRequestFailure],
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
                const updated = await apiClient.respondAssignment(
                    jobId,
                    assignmentId,
                    'rejected',
                    reason,
                    version,
                    createCommandId(),
                );
                setJobs((previous) =>
                    previous.map((job) =>
                        job.id === updated.id ? updated : job,
                    ),
                );
            } catch (error: unknown) {
                await handleRequestFailure(
                    error,
                    'Failed to reject assignment.',
                );
            } finally {
                setIsLoadingJobs(false);
            }
        },
        [apiClient, handleRequestFailure],
    );

    const handleTransitionStatus = useCallback(
        async (jobId: number, nextStatus: DispatchStatus, version: number) => {
            setIsLoadingJobs(true);

            try {
                const updated = await apiClient.transitionStatus(
                    jobId,
                    nextStatus,
                    version,
                    createCommandId(),
                );
                setJobs((previous) =>
                    previous.map((job) =>
                        job.id === updated.id ? updated : job,
                    ),
                );
            } catch (error: unknown) {
                await handleRequestFailure(error, 'Failed to progress status.');
            } finally {
                setIsLoadingJobs(false);
            }
        },
        [apiClient, handleRequestFailure],
    );

    const handleAcceptServerState = useCallback(
        (commandId: string) => {
            commandOutbox.resolveConflictAcceptServer(commandId);
            void fetchJobs();
        },
        [commandOutbox, fetchJobs],
    );

    const handleRetryNewVersion = useCallback(
        (commandId: string, newVersion: number) => {
            void commandOutbox.resolveConflictWithNewVersion(
                commandId,
                newVersion,
                apiClient,
            );
            void fetchJobs();
        },
        [apiClient, commandOutbox, fetchJobs],
    );

    if (isInitializing) {
        return (
            <SafeAreaView style={styles.fullScreen}>
                <StatusBar
                    barStyle="dark-content"
                    backgroundColor={colors.background}
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
                    backgroundColor={colors.background}
                />
                <View
                    style={styles.appShell}
                    testID={
                        isCompact ? 'compact-app-shell' : 'expanded-app-shell'
                    }
                >
                    <View
                        style={[
                            styles.header,
                            isCompact && styles.headerCompact,
                        ]}
                    >
                        <View
                            style={[
                                styles.headerBrand,
                                isCompact && styles.headerBrandCompact,
                            ]}
                        >
                            <Text style={styles.headerTitle}>
                                Core 2 Mobile
                            </Text>
                            {selectedJobId !== null ? (
                                <Pressable
                                    accessibilityLabel="Back to assigned jobs list"
                                    accessibilityRole="button"
                                    onPress={handleBackToList}
                                    style={styles.backButton}
                                >
                                    <Text style={styles.backButtonText}>
                                        Back to jobs
                                    </Text>
                                </Pressable>
                            ) : null}
                        </View>
                        <View
                            style={[
                                styles.userProfile,
                                isCompact && styles.userProfileCompact,
                            ]}
                        >
                            <View style={styles.userInfo}>
                                <Text style={styles.userName}>
                                    {user?.name}
                                </Text>
                                <Text style={styles.roleBadge}>
                                    {user?.role}
                                </Text>
                            </View>
                            <Pressable
                                accessibilityLabel="Sign out of field app"
                                accessibilityRole="button"
                                onPress={() => void logout()}
                                style={styles.logoutButton}
                                testID="logout-button"
                            >
                                <Text style={styles.logoutText}>Sign out</Text>
                            </Pressable>
                        </View>
                    </View>
                    <View
                        style={[
                            styles.mainContent,
                            !isCompact && styles.mainContentExpanded,
                        ]}
                    >
                        {selectedJobId === null || !activeJob || !user ? (
                            <AssignedJobsListScreen
                                jobs={jobs}
                                outboxCommands={outboxCommands}
                                isLoading={isLoadingJobs}
                                error={jobsError}
                                onRefresh={() => void fetchJobs()}
                                onSelectJob={handleSelectJob}
                            />
                        ) : (
                            <JobDetailScreen
                                job={activeJob}
                                user={user}
                                outboxCommands={outboxCommands}
                                locationService={locationService}
                                onBackToList={handleBackToList}
                                onAcceptAssignment={handleAcceptAssignment}
                                onRejectAssignment={handleRejectAssignment}
                                onTransitionStatus={handleTransitionStatus}
                                onAcceptServerState={handleAcceptServerState}
                                onRetryNewVersion={handleRetryNewVersion}
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
        backgroundColor: colors.surfaceDark,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 72,
        paddingHorizontal: 16,
        paddingVertical: 10,
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
    headerBrandCompact: {
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    headerTitle: {
        color: colors.amber,
        fontSize: 18,
        fontWeight: '800',
    },
    backButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceDarkElevated,
        borderRadius: 7,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 12,
    },
    backButtonText: {
        color: colors.textOnDark,
        fontSize: 13,
        fontWeight: '700',
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
        alignItems: 'flex-end',
        flexShrink: 1,
    },
    userName: {
        color: colors.textOnDark,
        fontSize: 13,
        fontWeight: '700',
        maxWidth: 220,
        textAlign: 'right',
    },
    roleBadge: {
        color: colors.mutedOnDark,
        fontSize: 10,
        marginTop: 2,
        textTransform: 'uppercase',
    },
    logoutButton: {
        alignItems: 'center',
        backgroundColor: colors.red,
        borderRadius: 7,
        justifyContent: 'center',
        minHeight: 48,
        minWidth: 76,
        paddingHorizontal: 10,
    },
    logoutText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800',
    },
    mainContent: {
        backgroundColor: colors.background,
        flex: 1,
    },
    mainContentExpanded: {
        alignSelf: 'center',
        maxWidth: 1040,
        width: '100%',
    },
    centerCard: {
        alignSelf: 'center',
        backgroundColor: colors.surfaceDark,
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
        color: colors.textOnDark,
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
