import type { ErrorInfo, ReactNode } from 'react';
import React, {
    Component,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { AppStateStatus } from 'react-native';
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
import { useAuth, offlineSessionVerificationError } from '../auth/AuthContext';
import { isAuthorizedFieldRole } from '../auth/fieldRoles';
import { LoginScreen } from '../auth/LoginScreen';
import { colors, sharedStyles } from '../components/nativeStyles';
import type { DigitalSignatureData } from '../components/signature/DigitalSignatureModal';
import { EmergencySosSheet } from '../components/sos';
import { defaultNetworkMonitor } from '../connectivity/networkMonitor';
import type { NetworkMonitor } from '../connectivity/networkMonitor';
import {
    startBackgroundLocationUpdates,
    stopBackgroundLocationUpdates,
} from '../native/backgroundLocationBridge';
import { nativeLocationAdapter } from '../native/locationAdapter';
import { AssignedJobsListScreen } from '../screens/AssignedJobsListScreen';
import { DispatchOrdersScreen } from '../screens/DispatchOrdersScreen';
import { DocumentsWalletScreen } from '../screens/DocumentsWalletScreen';
import { DvirScreen } from '../screens/DvirScreen';
import { EquipmentInspectionScreen } from '../screens/EquipmentInspectionScreen';
import { FuelScreen } from '../screens/FuelScreen';
import { HeavyCraneDriveModeScreen } from '../screens/HeavyCraneDriveModeScreen';
import { HosScreen } from '../screens/HosScreen';
import { RentalHandoverScreen } from '../screens/RentalHandoverScreen';
import { SalesDeliveryScreen } from '../screens/SalesDeliveryScreen';
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
    DutyStatus,
    OutboxCommand,
    ActivateSosIncidentPayload,
    SosConfiguration,
    SosDeliveryState,
    SosIncident,
    SosIncidentCategory,
    ShiftInfo,
    ShiftStatus,
    StandbyReason,
    WeatherTelemetry,
} from '../types/index';

export { isAuthorizedFieldRole } from '../auth/fieldRoles';

const SOS_LOCATION_TIMEOUT_MS = 4000;

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
    const [activeAppView, setActiveAppView] = useState<
        | 'main'
        | 'dvir'
        | 'documents'
        | 'inspection'
        | 'fuel'
        | 'hos'
        | 'routes'
        | 'rental'
        | 'sales'
        | 'dispatch'
    >('main');
    const [shiftInfo, setShiftInfo] = useState<ShiftInfo>({
        status: 'on_shift',
        dutyStatus: 'operating',
        startedAt: '08:00 AM',
        hoursElapsed: 4,
    });
    const [isUnitLinked, setIsUnitLinked] = useState<boolean>(false);
    const [dvirStatus, setDvirStatus] = useState<
        'pending' | 'cleared' | 'passed' | 'defect'
    >('pending');
    const [overriddenAssetCode, setOverriddenAssetCode] = useState<
        string | null
    >(null);
    const [weather, setWeather] = useState<WeatherTelemetry | null>(null);
    const [isLoadingWeather, setIsLoadingWeather] = useState(false);
    const [weatherError, setWeatherError] = useState<string | null>(null);
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
        (isStationary = false) =>
            nativeLocationAdapter.getCurrentLocation(isStationary),
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

    const refreshWeather = useCallback(async () => {
        setIsLoadingWeather(true);
        setWeatherError(null);

        try {
            let lat: number;
            let lon: number;

            try {
                const loc = await getCurrentLocation(false);

                if (
                    loc?.latitude === undefined ||
                    loc?.longitude === undefined ||
                    loc?.latitude === null ||
                    loc?.longitude === null
                ) {
                    throw new Error('Device GPS location is unavailable.');
                }

                lat = loc.latitude;
                lon = loc.longitude;
            } catch (geoErr) {
                const raw =
                    geoErr instanceof Error ? geoErr.message.toLowerCase() : '';
                let friendly =
                    'Turn on GPS or step into an open area, then tap retry.';

                if (
                    raw.includes('permission') ||
                    raw.includes('denied') ||
                    raw.includes('settings')
                ) {
                    friendly =
                        'Allow location in your phone settings to see site wind and safety.';
                }

                setWeatherError(friendly);
                setWeather(null);

                return;
            }

            try {
                const [cityResult, weatherResult] = await Promise.allSettled([
                    nativeLocationAdapter.reverseGeocodeCity(lat, lon),
                    apiClient.fetchLocationWeather(lat, lon),
                ]);

                if (weatherResult.status === 'rejected') {
                    throw weatherResult.reason;
                }

                const data = weatherResult.value;
                const localCity =
                    cityResult.status === 'fulfilled' ? cityResult.value : null;

                if (localCity && localCity.trim() !== '') {
                    data.location_name = localCity.trim();
                } else if (
                    !data.location_name ||
                    data.location_name.trim() === ''
                ) {
                    data.location_name = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
                }

                setWeather(data);
                setWeatherError(null);
            } catch {
                setWeatherError(
                    'Check your Wi-Fi or cellular data, then tap retry.',
                );
                setWeather(null);
            }
        } finally {
            setIsLoadingWeather(false);
        }
    }, [apiClient, getCurrentLocation]);

    const refreshHosClocks = useCallback(async () => {
        if (status !== 'authenticated' || isOnline !== true) {
            return;
        }

        try {
            const currentShift = await apiClient.fetchCurrentHosShift();

            if (currentShift?.clocks && currentShift.clocks.shift_active) {
                const clock = currentShift.clocks;
                const statusMap: Record<string, DutyStatus> = {
                    operating: 'operating',
                    driving: 'driving',
                    standby: 'standby',
                    on_break: 'on_break',
                    off_duty: 'off_duty',
                };
                const dutyStatus: DutyStatus =
                    statusMap[clock.current_duty_status] ?? 'operating';
                const nextShiftStatus: ShiftStatus =
                    dutyStatus === 'off_duty'
                        ? 'off_shift'
                        : dutyStatus === 'on_break'
                          ? 'on_break'
                          : dutyStatus === 'standby'
                            ? 'standby'
                            : 'on_shift';

                setShiftInfo({
                    status: nextShiftStatus,
                    dutyStatus,
                    startedAt: clock.started_at
                        ? new Date(clock.started_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                          })
                        : '08:00 AM',
                    hoursElapsed: clock.hours_elapsed ?? 0,
                });
            } else if (currentShift && !currentShift.clocks?.shift_active) {
                setShiftInfo({
                    status: 'off_shift',
                    dutyStatus: 'off_duty',
                    startedAt: '--:--',
                    hoursElapsed: 0,
                });
            }
        } catch {
            // Keep local shift info if offline or fetch fails
        }
    }, [apiClient, isOnline, status]);

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

                    if (incident && !incident.location) {
                        const location = await locationPromise;

                        if (location) {
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
        async (category: SosIncidentCategory, note?: string) => {
            if (!activeSosIncident) {
                return;
            }

            try {
                setActiveSosIncident(
                    await apiClient.classifySosIncident(
                        activeSosIncident.id,
                        category,
                        await createCommandId(),
                        note,
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
        if (status === 'authenticated') {
            queueMicrotask(() => void refreshWeather());

            if (isOnline === true) {
                queueMicrotask(() => void fetchJobs());
                queueMicrotask(() => void refreshHosClocks());
            }
        } else {
            queueMicrotask(() => {
                setJobs([]);
                setSelectedJobId(null);
                setWeather(null);
                setWeatherError(null);
            });
        }
    }, [fetchJobs, isOnline, refreshHosClocks, refreshWeather, status]);

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
                    .then(() => void syncQueue())
                    .catch((error: unknown) => {
                        console.warn(
                            'Failed to reactivate outbox on app resume:',
                            error,
                        );
                    });
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

                if (activeAppView !== 'main') {
                    setActiveAppView('main');

                    return true;
                }

                return false;
            },
        );

        return () => subscription.remove();
    }, [activeAppView, selectedJobId]);

    const handleSelectJob = useCallback(
        (jobId: number) => setSelectedJobId(jobId),
        [],
    );

    const handleToggleShift = useCallback((nextStatus: ShiftStatus) => {
        setShiftInfo((prev) => ({
            ...prev,
            status: nextStatus,
        }));
    }, []);

    const handleChangeDutyStatus = useCallback(
        async (
            dutyStatus: DutyStatus,
            standbyReason?: StandbyReason,
            remarks?: string,
        ) => {
            const nextShiftStatus: ShiftStatus =
                dutyStatus === 'off_duty'
                    ? 'off_shift'
                    : dutyStatus === 'on_break'
                      ? 'on_break'
                      : dutyStatus === 'standby'
                        ? 'standby'
                        : 'on_shift';

            setShiftInfo((prev) => ({
                ...prev,
                status: nextShiftStatus,
                dutyStatus,
            }));

            if (dutyStatus === 'off_duty') {
                setLocationSharingActive(false);
            }

            try {
                if (dutyStatus === 'off_duty') {
                    await apiClient.certifyHosShift({
                        certification_statement:
                            'I certify that these duty status entries and hours of service are true, complete, and accurate for this shift.',
                        remarks,
                    });
                } else {
                    await apiClient.updateHosDutyStatus({
                        duty_status: dutyStatus,
                        standby_reason: standbyReason,
                        remarks,
                    });
                }

                await refreshHosClocks();
            } catch {
                // Offline fallback - state is preserved locally
            }
        },
        [apiClient, refreshHosClocks],
    );

    const activeJob = jobs.find((job) => job.id === selectedJobId) || null;
    const activeTrackingJob = activeJob || jobs[0] || null;

    const handleToggleLocationSharing = useCallback(() => {
        setLocationSharingActive((prev) => {
            const next = !prev;
            if (!next) {
                locationService.stopAutoTracking();
                void stopBackgroundLocationUpdates().catch(() => undefined);
                if (user && activeTrackingJob) {
                    void locationService.pauseSharing(user, activeTrackingJob);
                }
            }
            return next;
        });
    }, [activeTrackingJob, locationService, user]);

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

    const currentAsset =
        activeJob?.asset_assignments?.[0] ||
        jobs[0]?.asset_assignments?.[0] ||
        null;
    const resolvedAssetCode =
        overriddenAssetCode ||
        currentAsset?.asset_code ||
        (jobs.length > 0 ? 'Assigned Unit' : 'UNASSIGNED');
    const resolvedAssetName =
        currentAsset?.asset_name ||
        (jobs.length > 0 ? 'Heavy Equipment Unit' : 'No Equipment Assigned');
    const resolvedOperatorName = user?.name || 'Field Operator';
    const resolvedJobReference =
        activeJob?.reference || jobs[0]?.reference || 'NO-DISPATCH';
    const resolvedClientName =
        activeJob?.client || jobs[0]?.client || 'Client Account';

    useEffect(() => {
        if (
            !activeTrackingJob ||
            !user ||
            !getCurrentLocation ||
            !locationSharingActive ||
            !locationService.canShareLocation(user, activeTrackingJob)
        ) {
            locationService.stopAutoTracking();
            void stopBackgroundLocationUpdates().catch(() => undefined);
            return;
        }

        let disposed = false;
        const context = { actorId: user.id, jobId: activeTrackingJob.id };
        const startForegroundTracking = () => {
            if (!disposed) {
                locationService.startAutoTracking(
                    user,
                    activeTrackingJob,
                    getCurrentLocation,
                );
            }
        };
        const syncBackgroundTracking = (nextState: AppStateStatus) => {
            if (disposed) {
                return;
            }

            if (nextState === 'active') {
                void stopBackgroundLocationUpdates().catch(() => undefined);
                startForegroundTracking();

                return;
            }

            locationService.stopAutoTracking();
            void startBackgroundLocationUpdates(context).catch(() => undefined);
        };

        if (AppState.currentState === 'active') {
            startForegroundTracking();
        } else {
            syncBackgroundTracking(AppState.currentState);
        }

        const subscription = AppState.addEventListener(
            'change',
            syncBackgroundTracking,
        );

        return () => {
            disposed = true;
            subscription.remove();
            locationService.stopAutoTracking();
            void stopBackgroundLocationUpdates().catch(() => undefined);
        };
    }, [
        activeTrackingJob,
        getCurrentLocation,
        locationService,
        locationSharingActive,
        user,
    ]);

    const handleGlobalSosHold = useCallback(() => {
        setSosSheetOpen(true);
    }, []);

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
                style={[
                    styles.fullScreen,
                    (activeAppView === 'dvir' ||
                        activeAppView === 'inspection' ||
                        activeAppView === 'hos' ||
                        activeAppView === 'routes') &&
                        styles.darkFullScreen,
                ]}
            >
                <StatusBar
                    barStyle={
                        activeAppView === 'dvir' ||
                        activeAppView === 'inspection' ||
                        activeAppView === 'hos' ||
                        activeAppView === 'routes'
                            ? 'light-content'
                            : 'dark-content'
                    }
                    backgroundColor={
                        activeAppView === 'dvir' ||
                        activeAppView === 'inspection' ||
                        activeAppView === 'hos' ||
                        activeAppView === 'routes'
                            ? '#0F172A'
                            : colors.surface
                    }
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
                        {activeAppView === 'hos' ? (
                            <HosScreen
                                activeJobId={activeJob?.id || jobs[0]?.id}
                                apiClient={apiClient}
                                linkedAssetCode={
                                    currentAsset?.asset_code || null
                                }
                                onBack={() => setActiveAppView('main')}
                                onEndShift={() => {
                                    handleToggleShift('off_shift');
                                    setLocationSharingActive(false);
                                }}
                                onReleaseUnit={() => {
                                    setLocationSharingActive(false);
                                }}
                                onToggleShift={handleToggleShift}
                                onUpdateDutyStatus={handleChangeDutyStatus}
                                operatorName={resolvedOperatorName}
                                shiftInfo={shiftInfo}
                                userRole={
                                    user?.role
                                        ? user.role.replaceAll('_', ' ')
                                        : 'Field Operator'
                                }
                            />
                        ) : activeAppView === 'dvir' ? (
                            <DvirScreen
                                activeJobReference={resolvedJobReference}
                                apiClient={apiClient}
                                assetCode={resolvedAssetCode}
                                assetKind={
                                    currentAsset?.asset_kind || 'mobile_crane'
                                }
                                assetName={resolvedAssetName}
                                commandOutbox={commandOutbox}
                                inspectorName={resolvedOperatorName}
                                onBack={() => setActiveAppView('main')}
                                onDefectLockout={(_defectiveCode) => {
                                    setLocationSharingActive(false);
                                    locationService.stopAutoTracking();
                                    void stopBackgroundLocationUpdates().catch(
                                        () => undefined,
                                    );
                                    if (user && activeTrackingJob) {
                                        void locationService.pauseSharing(
                                            user,
                                            activeTrackingJob,
                                        );
                                    }
                                    handleChangeDutyStatus(
                                        'standby',
                                        'mechanical_inspection',
                                        'Pre-trip DVIR defect lockout',
                                    );
                                    setDvirStatus('defect');
                                    setIsUnitLinked(false);
                                }}
                                onPreTripPassed={() => {
                                    setDvirStatus('cleared');
                                }}
                                onSwapUnit={(newUnitCode) => {
                                    setOverriddenAssetCode(newUnitCode);
                                    setIsUnitLinked(true);
                                    setDvirStatus('pending');
                                    setLocationSharingActive(true);
                                }}
                                onSwitchToStandby={() => {
                                    handleChangeDutyStatus(
                                        'standby',
                                        'mechanical_inspection',
                                        'Pre-trip DVIR defect lockout',
                                    );
                                    setActiveAppView('main');
                                }}
                            />
                        ) : activeAppView === 'documents' ? (
                            <DocumentsWalletScreen
                                assetCode={resolvedAssetCode}
                                onBack={() => setActiveAppView('main')}
                                operatorName={resolvedOperatorName}
                            />
                        ) : activeAppView === 'fuel' && user ? (
                            <FuelScreen
                                key={user.id}
                                actorId={user.id}
                                apiClient={apiClient}
                                isOnline={isOnline}
                                onBack={() => setActiveAppView('main')}
                            />
                        ) : activeAppView === 'inspection' ? (
                            <EquipmentInspectionScreen
                                assetCode={resolvedAssetCode}
                                assetName={resolvedAssetName}
                                onBack={() => setActiveAppView('main')}
                                onOpenDvir={() => setActiveAppView('dvir')}
                                onOpenFuel={() => setActiveAppView('fuel')}
                                technicianName={resolvedOperatorName}
                            />
                        ) : activeAppView === 'routes' ? (
                            <HeavyCraneDriveModeScreen
                                activeJob={activeJob || jobs[0] || null}
                                assetCode={resolvedAssetCode}
                                assetName={resolvedAssetName}
                                jobs={jobs}
                                onArrived={(jobId, version) => {
                                    handleTransitionStatus(
                                        jobId,
                                        'arrived',
                                        version,
                                    );
                                    setActiveAppView('main');
                                }}
                                onBack={() => setActiveAppView('main')}
                                operatorName={resolvedOperatorName}
                            />
                        ) : activeAppView === 'rental' ? (
                            <RentalHandoverScreen
                                assetCode={resolvedAssetCode}
                                assetName={resolvedAssetName}
                                clientName={resolvedClientName}
                                onBack={() => setActiveAppView('main')}
                                onCompleteCheckout={() =>
                                    setActiveAppView('main')
                                }
                                onCompleteReturn={() =>
                                    setActiveAppView('main')
                                }
                            />
                        ) : activeAppView === 'sales' ? (
                            <SalesDeliveryScreen
                                clientName={resolvedClientName}
                                equipmentName={resolvedAssetName}
                                orderReference={resolvedJobReference}
                                onBack={() => setActiveAppView('main')}
                                onCompleteDelivery={() =>
                                    setActiveAppView('main')
                                }
                            />
                        ) : activeAppView === 'dispatch' ? (
                            <DispatchOrdersScreen
                                conflictedCommands={outboxCommands?.filter(
                                    (command) => command.state === 'conflict',
                                )}
                                jobs={jobs}
                                onAcceptAssignment={handleAcceptAssignment}
                                onAcceptServerState={handleAcceptServerState}
                                onBack={() => setActiveAppView('main')}
                                onOpenRoutes={() => setActiveAppView('routes')}
                                onRejectAssignment={handleRejectAssignment}
                                onRetryNewVersion={handleRetryNewVersion}
                                onSelectJob={handleSelectJob}
                                onTransitionStatus={handleTransitionStatus}
                            />
                        ) : (
                            <AssignedJobsListScreen
                                apiClient={apiClient}
                                onSosHoldComplete={handleGlobalSosHold}
                                sosDisabled={isSosActivating}
                                error={jobsError}
                                isLoading={isLoadingJobs}
                                isOnline={isOnline}
                                jobs={jobs}
                                isUnitLinked={isUnitLinked}
                                onLinkUnit={(_code) => {
                                    setIsUnitLinked(true);
                                    setLocationSharingActive(true);
                                }}
                                dvirStatus={dvirStatus}
                                preTripDefectLockout={dvirStatus === 'defect'}
                                onSwapUnit={(newUnitCode) => {
                                    setOverriddenAssetCode(newUnitCode);
                                    setIsUnitLinked(true);
                                    setDvirStatus('pending');
                                    setLocationSharingActive(true);
                                }}
                                locationSharingActive={locationSharingActive}
                                onChangeDutyStatus={handleChangeDutyStatus}
                                onDiscardCommand={handleDiscardCommand}
                                onLogout={() => void logout()}
                                onOpenDocuments={() =>
                                    setActiveAppView('documents')
                                }
                                onOpenDvir={() => setActiveAppView('dvir')}
                                onOpenForms={() => setActiveAppView('dispatch')}
                                onOpenHos={() => setActiveAppView('hos')}
                                onOpenRental={() => setActiveAppView('rental')}
                                onOpenRoutes={() => setActiveAppView('routes')}
                                onOpenSales={() => setActiveAppView('sales')}
                                onOpenVehicle={() =>
                                    setActiveAppView('inspection')
                                }
                                onOpenFuel={() => setActiveAppView('fuel')}
                                onRefresh={() => {
                                    void fetchJobs();
                                    void refreshWeather();
                                    void refreshHosClocks();
                                }}
                                onRetryCommand={handleRetryCommand}
                                onSelectJob={handleSelectJob}
                                onAcceptAssignment={handleAcceptAssignment}
                                onAcceptServerState={handleAcceptServerState}
                                onRejectAssignment={handleRejectAssignment}
                                onRetryNewVersion={handleRetryNewVersion}
                                onTransitionStatus={handleTransitionStatus}
                                onSyncNow={() => void syncQueue()}
                                onToggleLocationSharing={
                                    handleToggleLocationSharing
                                }
                                onReleaseUnit={() => {
                                    setIsUnitLinked(false);
                                    setLocationSharingActive(false);
                                    locationService.stopAutoTracking();
                                    void stopBackgroundLocationUpdates().catch(
                                        () => undefined,
                                    );
                                    if (user && activeTrackingJob) {
                                        void locationService.pauseSharing(
                                            user,
                                            activeTrackingJob,
                                        );
                                    }
                                }}
                                onToggleShift={handleToggleShift}
                                outboxCommands={outboxCommands}
                                shiftInfo={shiftInfo}
                                userName={user?.name}
                                userRole={user?.role.replaceAll('_', ' ')}
                                weather={weather}
                                isLoadingWeather={isLoadingWeather}
                                weatherError={weatherError}
                                onRefreshWeather={() => void refreshWeather()}
                            />
                        )}
                    </View>
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
                    onGetLocation={getCurrentLocation}
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
    darkFullScreen: {
        backgroundColor: '#090E1A',
        flex: 1,
    },
    appShell: {
        flex: 1,
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
