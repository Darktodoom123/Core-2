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
import {
    SafeAreaView,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useAuth, offlineSessionVerificationError } from '../auth/AuthContext';
import { isAuthorizedFieldRole } from '../auth/fieldRoles';
import { LoginScreen } from '../auth/LoginScreen';
import { colors, sharedStyles } from '../components/nativeStyles';
import type { DigitalSignatureData } from '../components/signature/DigitalSignatureModal';
import { EmergencySosButton, EmergencySosSheet } from '../components/sos';
import { defaultNetworkMonitor } from '../connectivity/networkMonitor';
import type { NetworkMonitor } from '../connectivity/networkMonitor';
import { nativeLocationAdapter } from '../native/locationAdapter';
import { AssignedJobsListScreen } from '../screens/AssignedJobsListScreen';
import { JobDetailScreen } from '../screens/JobDetailScreen';
import { ApiClientError } from '../services/apiClient';
import {
    CommandOutboxManager,
    createCommandId,
} from '../services/commandOutbox';
import { LocationSharingService } from '../services/locationService';
import { createDefaultOutboxRepository } from '../storage/outboxRepository';
import type {
    OutboxRepository,
    PayloadHasher,
} from '../storage/outboxRepository';
import type {
    DispatchJob,
    DispatchStatus,
    OutboxCommand,
    ActivateSosIncidentPayload,
    SosConfiguration,
    SosDeliveryState,
    SosIncident,
    SosIncidentCategory,
    ShiftInfo,
    ShiftStatus,
} from '../types/index';

export { isAuthorizedFieldRole } from '../auth/fieldRoles';

const SOS_LOCATION_TIMEOUT_MS = 750;

async function captureBoundedEmergencyLocation(
    getLocation: () => Promise<{
        latitude: number;
        longitude: number;
        accuracyMetres?: number | null;
    }>,
): Promise<{
    latitude: number;
    longitude: number;
    accuracy_metres?: number | null;
    captured_at: string;
} | null> {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    try {
        const location = await Promise.race([
            getLocation(),
            new Promise<null>((resolve) => {
                timeout = setTimeout(
                    () => resolve(null),
                    SOS_LOCATION_TIMEOUT_MS,
                );
            }),
        ]);

        if (!location) {
            return null;
        }

        return {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy_metres: location.accuracyMetres ?? null,
            captured_at: new Date().toISOString(),
        };
    } catch {
        return null;
    } finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
}

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
    const [locationSharingActive, setLocationSharingActive] = useState(true);
    const [sosSheetOpen, setSosSheetOpen] = useState(false);
    const [activeSosIncident, setActiveSosIncident] =
        useState<SosIncident | null>(null);
    const [sosConfiguration, setSosConfiguration] = useState<SosConfiguration>({
        automatic_retry_window_minutes: 15,
        actions: [],
    });
    const [isSosActivating, setIsSosActivating] = useState(false);
    const [shiftInfo, setShiftInfo] = useState<ShiftInfo>({
        status: 'on_shift',
        startedAt: '08:00 AM',
        hoursElapsed: 4,
    });
    const previousOnlineRef = useRef<boolean | null>(null);
    const { width } = useWindowDimensions();
    const isCompact = width < 600;
    const insets = useSafeAreaInsets();

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

    const refreshActiveSosIncident = useCallback(async () => {
        if (status !== 'authenticated') {
            return;
        }

        try {
            setActiveSosIncident(await apiClient.fetchActiveSosIncident());
        } catch {
            // SOS refresh is best-effort. The local delivery state remains
            // visible until the server can be reached again.
        }
    }, [apiClient, status]);

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
        if (status !== 'authenticated' || !user) {
            return;
        }

        let active = true;
        queueMicrotask(() => {
            if (!active) {
                return;
            }

            void refreshActiveSosIncident();
            void apiClient
                .fetchSosConfiguration()
                .then((configuration) => {
                    if (!active) {
                        return;
                    }

                    setSosConfiguration(configuration);
                    commandOutbox.setSosRetryWindowMs(
                        configuration.automatic_retry_window_minutes *
                            60 *
                            1000,
                    );
                })
                .catch(() => undefined);
        });

        return () => {
            active = false;
        };
    }, [apiClient, commandOutbox, refreshActiveSosIncident, status, user]);

    useEffect(() => {
        if (
            status !== 'authenticated' ||
            !activeSosIncident ||
            activeSosIncident.status === 'resolved' ||
            activeSosIncident.status === 'cancelled'
        ) {
            return;
        }

        const interval = setInterval(() => {
            if (isOnline === true) {
                void refreshActiveSosIncident();
            }
        }, 30_000);

        return () => clearInterval(interval);
    }, [activeSosIncident, isOnline, refreshActiveSosIncident, status]);

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

    const handleActivateSos = useCallback(
        async (payload: ActivateSosIncidentPayload) => {
            setIsSosActivating(true);

            try {
                const command = await commandOutbox.enqueueActivateSos(payload);

                // Start the server attempt before location enrichment. GPS is
                // useful context, never a prerequisite for an emergency alert.
                const processPromise =
                    isOnline === true
                        ? commandOutbox.processQueue(apiClient)
                        : Promise.resolve(null);
                const locationPromise =
                    captureBoundedEmergencyLocation(getCurrentLocation);
                const result = await processPromise;

                if (result?.requiresAuthentication) {
                    await logout();

                    return;
                }

                if (result && result.completed > 0) {
                    const incident = await apiClient.fetchActiveSosIncident();
                    setActiveSosIncident(incident);

                    const location = await locationPromise;

                    if (incident && location) {
                        try {
                            setActiveSosIncident(
                                await apiClient.updateSosLocation(
                                    incident.id,
                                    location,
                                    command.id,
                                ),
                            );
                        } catch {
                            // Delivery remains truthful; an optional location
                            // enrichment failure does not undo the alert.
                        }
                    }
                }
            } catch (error: unknown) {
                await handleRequestFailure(
                    error,
                    'Emergency SOS could not be saved on this device.',
                );
            } finally {
                setIsSosActivating(false);
            }
        },
        [
            apiClient,
            commandOutbox,
            getCurrentLocation,
            handleRequestFailure,
            isOnline,
            logout,
        ],
    );

    const handleClassifySos = useCallback(
        async (category: SosIncidentCategory) => {
            if (!activeSosIncident) {
                return;
            }

            try {
                setActiveSosIncident(
                    await apiClient.classifySosIncident(
                        activeSosIncident.id,
                        category,
                        await createCommandId(),
                    ),
                );
            } catch (error: unknown) {
                await handleRequestFailure(
                    error,
                    'SOS classification could not be saved. The alert remains active.',
                );
            }
        },
        [activeSosIncident, apiClient, handleRequestFailure],
    );

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

    const handleToggleShift = useCallback((nextStatus: ShiftStatus) => {
        setShiftInfo((prev) => ({
            ...prev,
            status: nextStatus,
        }));
    }, []);

    const handleToggleLocationSharing = useCallback(() => {
        setLocationSharingActive((prev) => !prev);
    }, []);

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
        async (
            jobId: number,
            nextStatus: DispatchStatus,
            version: number,
            signatureData?: DigitalSignatureData,
        ) => {
            setIsLoadingJobs(true);

            try {
                if (nextStatus === 'completed' && signatureData) {
                    await commandOutbox.enqueueSubmitJobReport(jobId, {
                        dispatch_job_id: jobId,
                        work_summary:
                            signatureData.workSummary ||
                            'Dispatched crane and site operational tasks completed in full.',
                        remarks: `Signed off by: ${signatureData.signerName} (${signatureData.signerRole})`,
                        ending_meter_value: signatureData.endingMeterValue,
                        meter_type: signatureData.meterType,
                        signer_name: signatureData.signerName,
                        signer_role: signatureData.signerRole,
                        signed_at: signatureData.signedAt,
                    });
                }

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

    const activeJob = jobs.find((job) => job.id === selectedJobId) || null;
    const handleGlobalSosHold = useCallback(() => {
        setSosSheetOpen(true);

        if (activeSosIncident) {
            return;
        }

        void handleActivateSos({
            category: 'unclassified',
            device_activated_at: new Date().toISOString(),
            dispatch_job_id: activeJob?.id ?? null,
            operational_asset_id:
                activeJob?.asset_assignments?.[0]?.operational_asset_id ?? null,
            location: null,
        });
    }, [activeJob, activeSosIncident, handleActivateSos]);

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

    const latestSosCommand = outboxCommands
        .filter((command) => command.type === 'activate_sos')
        .sort((left, right) =>
            right.createdAt.localeCompare(left.createdAt),
        )[0];
    const sosDeliveryState: SosDeliveryState = activeSosIncident
        ? activeSosIncident.delivery_state
        : isSosActivating
          ? 'sending'
          : latestSosCommand?.state === 'completed'
            ? 'delivered'
            : latestSosCommand?.state === 'expired' ||
                latestSosCommand?.error?.code === 'SOS_EXPIRED'
              ? 'expired'
              : latestSosCommand?.state === 'queued' ||
                  latestSosCommand?.state === 'syncing' ||
                  latestSosCommand?.state === 'failed'
                ? isOnline === false
                    ? 'not_delivered_offline'
                    : latestSosCommand?.error?.code ===
                        'NETWORK_RETRY_SCHEDULED'
                      ? 'retrying'
                      : 'sending'
                : 'preparing';
    const emergencyActions =
        activeSosIncident?.available_actions ?? sosConfiguration.actions;

    return (
        <ErrorBoundary>
            <SafeAreaView
                edges={['top', 'left', 'right']}
                style={styles.fullScreen}
            >
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
                                error={jobsError}
                                isLoading={isLoadingJobs}
                                isOnline={isOnline}
                                jobs={jobs}
                                locationSharingActive={locationSharingActive}
                                onDiscardCommand={handleDiscardCommand}
                                onLogout={() => void logout()}
                                onRefresh={() => void fetchJobs()}
                                onRetryCommand={handleRetryCommand}
                                onSelectJob={handleSelectJob}
                                onSyncNow={() => void syncQueue()}
                                onToggleLocationSharing={
                                    handleToggleLocationSharing
                                }
                                onToggleShift={handleToggleShift}
                                outboxCommands={outboxCommands}
                                shiftInfo={shiftInfo}
                                userName={user?.name}
                                userRole={user?.role.replaceAll('_', ' ')}
                            />
                        ) : (
                            <JobDetailScreen
                                getCurrentLocation={getCurrentLocation}
                                job={activeJob}
                                locationService={locationService}
                                onAcceptAssignment={handleAcceptAssignment}
                                onAcceptServerState={handleAcceptServerState}
                                onBackToList={handleBackToList}
                                onLocationQueued={() => void syncQueue()}
                                onRejectAssignment={handleRejectAssignment}
                                onRetryNewVersion={handleRetryNewVersion}
                                onTransitionStatus={handleTransitionStatus}
                                outboxCommands={outboxCommands}
                                user={user}
                            />
                        )}
                    </View>
                </View>
                <View
                    style={[
                        styles.sosAffordance,
                        { bottom: Math.max(96, 72 + insets.bottom + 16) },
                    ]}
                >
                    <EmergencySosButton
                        disabled={isSosActivating}
                        onHoldComplete={handleGlobalSosHold}
                    />
                </View>
                <EmergencySosSheet
                    actions={emergencyActions}
                    activeIncident={activeSosIncident}
                    deliveryState={sosDeliveryState}
                    isOnline={isOnline}
                    jobs={jobs}
                    onActivate={handleActivateSos}
                    onClassify={handleClassifySos}
                    onClose={() => setSosSheetOpen(false)}
                    visible={sosSheetOpen}
                />
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
    sosAffordance: {
        bottom: 96,
        position: 'absolute',
        right: 16,
        zIndex: 50,
    },
    mainContent: {
        flex: 1,
    },
    mainContentExpanded: {
        alignSelf: 'center',
        maxWidth: 1040,
        width: '100%',
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
    centerCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        margin: 16,
        padding: 24,
    },
    errorTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 8,
    },
    bodyText: {
        color: colors.secondary,
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 16,
    },
    actionButton: {
        backgroundColor: colors.amber,
        minHeight: 48,
        width: '100%',
    },
    commandError: {
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
        borderRadius: 8,
        borderWidth: 1,
        margin: 16,
        marginBottom: 0,
        padding: 12,
    },
    commandErrorText: {
        color: colors.redDark,
        fontSize: 14,
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.78,
    },
});
