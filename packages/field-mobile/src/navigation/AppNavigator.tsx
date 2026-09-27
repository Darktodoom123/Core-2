import React, {
    Component,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import type { AppStateStatus } from 'react-native';
import {
    ActivityIndicator,
    AppState,
    BackHandler,
    Platform,
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
import {
    activeJobs,
    currentJobFor,
} from '../components/cards/job-card/job-lifecycle';
import { colors, sharedStyles } from '../components/nativeStyles';
import { OutboxStatusSheet } from '../components/sheets/OutboxStatusSheet';
import { buildReplacementRequest } from '../components/sheets/replacement-request/replacement-request';
import type { DigitalSignatureData } from '../components/signature/DigitalSignatureModal';
import { EmergencySosSheet } from '../components/sos';
import {
    defaultNetworkMonitor,
    isFetchError,
} from '../connectivity/networkMonitor';
import type { NetworkMonitor } from '../connectivity/networkMonitor';
import { useResumeTracking } from '../hooks/useResumeTracking';
import { useServerPostTrip } from '../hooks/useServerPostTrip';
import { useTrackingPause } from '../hooks/useTrackingPause';
import { useUnitLink } from '../hooks/useUnitLink';
import {
    startBackgroundLocationUpdates,
    stopBackgroundLocationUpdates,
} from '../native/backgroundLocationBridge';
import { nativeLocationAdapter } from '../native/locationAdapter';
import { AssignedJobsListScreen } from '../screens/AssignedJobsListScreen';
import { DispatchOrdersScreen } from '../screens/DispatchOrdersScreen';
import { walletAssets } from '../screens/documents/document-catalog';
import { DocumentsWalletScreen } from '../screens/DocumentsWalletScreen';
import { DvirScreen } from '../screens/DvirScreen';
import { FieldSafetyScreen } from '../screens/FieldSafetyScreen';
import { FuelScreen } from '../screens/FuelScreen';
import {
    planDutyCommand,
    queuedHosCommands,
    serverClockOffsetMs,
} from '../screens/hos/hos-duty-command';
import { hosSyncSummary } from '../screens/hos/hos-sync-summary';
import { HosScreen } from '../screens/HosScreen';
import type {
    ShiftLogEvent,
    TimelineDayHistory,
    TimelineSegment,
} from '../screens/HosScreen';
import { MachineProfileScreen } from '../screens/MachineProfileScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import type {
    RentalCheckoutData,
    RentalReturnData,
} from '../screens/RentalHandoverScreen';
import { RentalHandoverScreen } from '../screens/RentalHandoverScreen';
import { ApiClientError } from '../services/apiClient';
import {
    CommandOutboxManager,
    createCommandId,
} from '../services/commandOutbox';
import { LocationSharingService } from '../services/locationService';
import {
    checkNotificationPermissions,
    clearNotificationTokenCache,
    configureNotificationHandler,
    extractEventFromNotification,
    extractJobIdFromNotification,
    extractTicketIdFromNotification,
    getLastNotificationResponseAsync,
    registerDevicePushToken,
    requestNotificationPermissions,
    revokeDevicePushToken,
    setupNotificationListeners,
} from '../services/notificationService';
import { createDefaultOutboxRepository } from '../storage/outboxRepository';
import type {
    OutboxRepository,
    PayloadHasher,
} from '../storage/outboxRepository';
import type { TrackingPauseStore } from '../storage/trackingPauseStore';
import type { UnitLinkStore } from '../storage/unitLinkStore';
import { useTheme } from '../theme';
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
    ReportDelayPayload,
    SafetyHazardCommandPayload,
    WorkStoppageCommandPayload,
} from '../types/index';
import { resolveDesignatedEquipmentType } from '../utils/equipmentClassification';
import { statusBarAppearance } from './status-bar-appearance';

export { isAuthorizedFieldRole } from '../auth/fieldRoles';

const SOS_LOCATION_TIMEOUT_MS = 4000;

type HistoryRow = Record<string, unknown>;

function historyString(row: HistoryRow, key: string): string | null {
    const value = row[key];

    return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function historyDate(row: HistoryRow): Date | null {
    const raw =
        historyString(row, 'occurred_at') ?? historyString(row, 'started_at');

    if (!raw) {
        return null;
    }

    const date = new Date(raw);

    return Number.isNaN(date.getTime()) ? null : date;
}

function historyDuration(row: HistoryRow): number {
    const raw = row.duration_minutes;

    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return Math.max(0, raw);
    }

    const start = historyDate(row);

    if (!start) {
        return 0;
    }

    const endRaw = historyString(row, 'ended_at');
    const end = endRaw ? new Date(endRaw) : new Date();

    if (Number.isNaN(end.getTime())) {
        return 0;
    }

    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

function historyDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatHistoryTime(raw: string | null, fallback = 'Current'): string {
    if (!raw) {
        return fallback;
    }

    const date = new Date(raw);

    if (Number.isNaN(date.getTime())) {
        return fallback;
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatHistoryDuration(minutes: number): string {
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

function mapHosCycleHistory(data: {
    shifts?: unknown[];
    logs?: unknown[];
}): TimelineDayHistory[] {
    const rows = (Array.isArray(data.logs) ? data.logs : []).filter(
        (row): row is HistoryRow => Boolean(row) && typeof row === 'object',
    );
    const shifts = (Array.isArray(data.shifts) ? data.shifts : []).filter(
        (row): row is HistoryRow => Boolean(row) && typeof row === 'object',
    );
    const grouped = new Map<
        string,
        { logs: HistoryRow[]; shifts: HistoryRow[] }
    >();

    for (const row of rows) {
        const date = historyDate(row);

        if (!date) {
            continue;
        }

        const key = historyDateKey(date);
        const group = grouped.get(key) ?? { logs: [], shifts: [] };
        group.logs.push(row);
        grouped.set(key, group);
    }

    for (const row of shifts) {
        const date = historyDate(row);

        if (!date) {
            continue;
        }

        const key = historyDateKey(date);
        const group = grouped.get(key) ?? { logs: [], shifts: [] };
        group.shifts.push(row);
        grouped.set(key, group);
    }

    const todayKey = historyDateKey(new Date());

    return [...grouped.entries()]
        .sort(([left], [right]) => right.localeCompare(left))
        .map(([key, group]) => {
            const parsedDate = new Date(`${key}T12:00:00`);
            const sortedLogs = [...group.logs].sort((left, right) => {
                const leftDate = historyDate(left)?.getTime() ?? 0;
                const rightDate = historyDate(right)?.getTime() ?? 0;

                return leftDate - rightDate;
            });
            const events: ShiftLogEvent[] = sortedLogs.map((row, rowIndex) => {
                const status =
                    historyString(row, 'new_duty_status') ??
                    historyString(row, 'duty_status') ??
                    'off_duty';
                const previous = historyString(
                    row,
                    'previous_duty_status_label',
                );
                const statusLabel =
                    historyString(row, 'new_duty_status_label') ??
                    historyString(row, 'duty_status_label') ??
                    status.replace('_', ' ');
                const observedAt = historyString(row, 'location_observed_at');
                const acceptedAt = historyString(row, 'accepted_at');
                const freshness = historyString(row, 'location_freshness');
                const locationName = historyString(row, 'location_name');
                const location =
                    freshness === 'last_known'
                        ? 'Last known location'
                        : freshness === 'unavailable'
                          ? 'Location unavailable'
                          : (locationName ?? 'GPS position');
                const equipment = historyString(row, 'equipment_code');
                const duration = historyDuration(row);
                const details = `${previous ? `${previous} → ` : ''}${statusLabel}${equipment ? ` · ${equipment}` : ''}`;
                const observationLabel = observedAt
                    ? `Observed ${formatHistoryTime(observedAt)}`
                    : location;
                const acceptedLabel = acceptedAt
                    ? `Accepted ${formatHistoryTime(acceptedAt)}`
                    : 'Accepted by server';

                return {
                    id: String(row.id ?? `${key}-${rowIndex}`),
                    status: status as ShiftLogEvent['status'],
                    startTime: formatHistoryTime(
                        historyString(row, 'occurred_at') ??
                            historyString(row, 'started_at'),
                    ),
                    endTime: formatHistoryTime(historyString(row, 'ended_at')),
                    durationFormatted: formatHistoryDuration(duration),
                    details: `${details} · ${acceptedLabel}`,
                    location: `${location} · ${observationLabel}`,
                    occurrenceTime:
                        historyString(row, 'occurred_at') ??
                        historyString(row, 'started_at'),
                    acceptedTime: acceptedAt,
                    equipmentLabel: equipment,
                    locationStatus:
                        freshness === 'fresh'
                            ? 'fresh'
                            : freshness === 'last_known'
                              ? 'last_known'
                              : 'unavailable',
                    syncStatus: 'accepted',
                };
            });

            const segments: TimelineDayHistory['segments'] = {
                off: [],
                brk: [],
                drv: [],
                on: [],
            };

            for (const row of sortedLogs) {
                const start = historyDate(row);

                if (!start) {
                    continue;
                }

                const endRaw = historyString(row, 'ended_at');
                const end = endRaw ? new Date(endRaw) : new Date();
                const startMinutes = start.getHours() * 60 + start.getMinutes();
                const endMinutes = Math.max(
                    startMinutes + 1,
                    end.getTime() > start.getTime()
                        ? end.getHours() * 60 + end.getMinutes()
                        : startMinutes + historyDuration(row),
                );
                const segment: TimelineSegment = {
                    left: `${Math.min(100, (startMinutes / 1440) * 100)}%`,
                    width: `${Math.max(0.25, Math.min(100, ((endMinutes - startMinutes) / 1440) * 100))}%`,
                };
                const status =
                    historyString(row, 'new_duty_status') ??
                    historyString(row, 'duty_status');

                if (status === 'driving') {
                    segments.drv.push(segment);
                } else if (status === 'on_break') {
                    segments.brk.push(segment);
                } else if (status === 'off_duty') {
                    segments.off.push(segment);
                } else {
                    segments.on.push(segment);
                }
            }

            const driveMinutes = sortedLogs
                .filter(
                    (row) =>
                        historyString(row, 'new_duty_status') === 'driving' ||
                        historyString(row, 'duty_status') === 'driving',
                )
                .reduce((sum, row) => sum + historyDuration(row), 0);
            const onDutyMinutes = sortedLogs
                .filter((row) =>
                    ['operating', 'driving', 'standby'].includes(
                        historyString(row, 'new_duty_status') ??
                            historyString(row, 'duty_status') ??
                            '',
                    ),
                )
                .reduce((sum, row) => sum + historyDuration(row), 0);
            const totalMinutes = sortedLogs.reduce(
                (sum, row) => sum + historyDuration(row),
                0,
            );
            const certification = group.shifts.some(
                (row) => row.is_certified === true,
            )
                ? 'certified'
                : group.shifts.some(
                        (row) => historyString(row, 'status') === 'active',
                    )
                  ? 'active'
                  : 'restart';

            return {
                id: `server-${key}`,
                dayLabel:
                    key === todayKey
                        ? 'Today'
                        : parsedDate.toLocaleDateString([], {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                          }),
                dateFormatted: parsedDate.toLocaleDateString([], {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                }),
                shortDate:
                    key === todayKey
                        ? 'Today'
                        : parsedDate.toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                          }),
                isToday: key === todayKey,
                driveHoursFormatted: formatHistoryDuration(driveMinutes),
                onDutyHoursFormatted: formatHistoryDuration(onDutyMinutes),
                offDutyHoursFormatted: formatHistoryDuration(
                    Math.max(0, 1440 - totalMinutes),
                ),
                totalShiftFormatted: formatHistoryDuration(totalMinutes),
                certificationStatus: certification,
                certifiedByText:
                    certification === 'certified'
                        ? 'Server-accepted and certified'
                        : certification === 'active'
                          ? 'Active shift in progress'
                          : 'No accepted duty interval',
                segments,
                events,
            };
        });
}

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
                message: error.message,
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
    unitLinkStore?: UnitLinkStore;
    trackingPauseStore?: TrackingPauseStore;
}

export const AppNavigator: React.FC<AppNavigatorProps> = ({
    networkMonitor,
    outboxHasher,
    outboxRepository,
    unitLinkStore,
    trackingPauseStore,
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
    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
    const [jobs, setJobs] = useState<DispatchJob[]>([]);
    // Finished jobs are history: they never drive tracking, the unit or the site.
    const liveJobs = useMemo(() => activeJobs(jobs), [jobs]);
    const [jobsError, setJobsError] = useState<string | null>(null);
    const [outboxCommands, setOutboxCommands] = useState<OutboxCommand[]>([]);
    const [isLoadingJobs, setIsLoadingJobs] = useState(false);
    const [isOnline, setIsOnline] = useState<boolean | null>(null);
    const [isOutboxReady, setIsOutboxReady] = useState(false);
    const [profileOutboxSheetOpen, setProfileOutboxSheetOpen] = useState(false);
    const [locationSharingActive, setLocationSharingActive] = useState(false);
    const [locationTrackingError, setLocationTrackingError] = useState<
        string | null
    >(null);
    const [sosSheetOpen, setSosSheetOpen] = useState(false);
    const [activeSosIncident, setActiveSosIncident] =
        useState<SosIncident | null>(null);
    const [sosConfiguration, setSosConfiguration] = useState<SosConfiguration>({
        automatic_retry_window_minutes: 15,
        actions: [],
    });
    const [isSosActivating, setIsSosActivating] = useState(false);
    const { theme } = useTheme();
    const [activeAppView, setActiveAppView] = useState<
        | 'main'
        | 'safety'
        | 'dvir'
        | 'documents'
        | 'inspection'
        | 'fuel'
        | 'hos'
        | 'rental'
        | 'dispatch'
        | 'profile'
    >('main');
    const [dvirInitialMode, setDvirInitialMode] = useState<
        'pre_trip' | 'post_trip'
    >('pre_trip');
    const [fuelFocusRequestId, setFuelFocusRequestId] = useState<number | null>(
        null,
    );
    // Server time minus phone time; keeps duty events on the server's clock.
    const serverClockOffsetRef = useRef(0);
    const [shiftInfo, setShiftInfo] = useState<ShiftInfo>({
        status: 'off_shift',
        dutyStatus: 'off_duty',
        startedAt: null,
        hoursElapsed: undefined,
        shiftElapsedMinutes: null,
        operatingMinutes: null,
        drivingMinutes: null,
        standbyMinutes: null,
        breakMinutes: null,
    });
    const [timelineHistory, setTimelineHistory] = useState<
        TimelineDayHistory[]
    >([]);
    // Unit code of the last post-trip DVIR saved this shift; cleared on release.
    const [postTripDoneFor, setPostTripDoneFor] = useState<string | null>(null);
    // ISO start of the server's active shift; bounds which post-trips count.
    const [shiftStartedAtIso, setShiftStartedAtIso] = useState<string | null>(
        null,
    );
    // Where the DVIR's back button returns to (HoS opens the post-trip).
    const [dvirReturnView, setDvirReturnView] = useState<'main' | 'hos'>(
        'main',
    );
    const [dvirStatus, setDvirStatus] = useState<
        'pending' | 'cleared' | 'passed' | 'defect'
    >('pending');
    const [weather, setWeather] = useState<WeatherTelemetry | null>(null);
    const [isLoadingWeather, setIsLoadingWeather] = useState(false);
    const [weatherError, setWeatherError] = useState<string | null>(null);
    // Null until the device answers; the UI shows "Checking…", not "Active".
    const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState<
        boolean | null
    >(null);
    const [sosResponderNotice, setSosResponderNotice] = useState<{
        incidentId: string;
        reporterName: string;
        category: string;
        dispatchReference?: string;
        receivedAt?: string;
    } | null>(null);
    const hasHandledColdStartRef = useRef<boolean>(false);
    const previousOnlineRef = useRef<boolean | null>(null);
    const lastAuthenticatedUserIdRef = useRef<number | null>(null);

    // Reset push token cache, selected job, and responder notices across logout or account switches
    useEffect(() => {
        if (status !== 'authenticated') {
            queueMicrotask(() => {
                setSosResponderNotice(null);
                setSelectedJobId(null);
                setJobs([]);
                setJobsError(null);
                setActiveAppView('main');
                setTimelineHistory([]);
            });
            clearNotificationTokenCache();
        } else if (
            user?.id &&
            lastAuthenticatedUserIdRef.current !== null &&
            lastAuthenticatedUserIdRef.current !== user.id
        ) {
            // Account switch while remaining authenticated
            queueMicrotask(() => {
                setSosResponderNotice(null);
                setSelectedJobId(null);
                setJobs([]);
                setJobsError(null);
                setActiveAppView('main');
                setTimelineHistory([]);
            });
            clearNotificationTokenCache();
        }

        lastAuthenticatedUserIdRef.current = user?.id ?? null;
    }, [status, user?.id]);

    const handleLogout = useCallback(async () => {
        try {
            await revokeDevicePushToken(apiClient);
        } catch {
            // Best effort push token revocation
        }

        await logout();
    }, [apiClient, logout]);
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
    // Held by the server so every phone agrees; saved on the phone so a
    // restart or a dead zone keeps it. Release removes it.
    const {
        unitLink,
        link: linkUnit,
        unlink: unlinkUnit,
    } = useUnitLink(
        user?.id,
        {
            canFetch: status === 'authenticated' && isOnline === true,
            apiClient,
            outbox: commandOutbox,
            outboxCommands,
        },
        unitLinkStore,
    );
    const isUnitLinked = unitLink !== null;
    const {
        pausedByOperator,
        markPaused: markTrackingPaused,
        clearPause: clearTrackingPause,
    } = useTrackingPause(user?.id, unitLink, trackingPauseStore);
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
        const unsubscribe = connectivity.subscribe((online) => {
            setIsOnline(online);

            if (online === false) {
                setJobsError(null);
            }
        });

        void connectivity
            .fetchIsOnline()
            .then((online) => {
                if (active) {
                    setIsOnline(online);

                    if (online === false) {
                        setJobsError(null);
                    }
                }
            })
            .catch(() => {
                if (active) {
                    setIsOnline(false);
                    setJobsError(null);
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
                await handleLogout();

                return;
            }

            // Suppress fetch and offline errors so field workers are not confused
            if (isFetchError(err) || isOnline === false) {
                return;
            }

            setJobsError(err instanceof Error ? err.message : fallback);
        },
        [handleLogout, isOnline],
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
            if (
                error instanceof ApiClientError &&
                (error.status === 401 || error.status === 403)
            ) {
                await handleLogout();

                return;
            }

            // Offline or network fetch failure: do not show error banner.
            if (isFetchError(error)) {
                return;
            }

            await handleRequestFailure(
                error,
                'Failed to fetch assigned dispatches.',
            );
        } finally {
            setIsLoadingJobs(false);
        }
    }, [apiClient, handleLogout, handleRequestFailure, isOnline, status]);

    // Native mobile push notifications: token lifecycle, foreground data refresh, and authorized notification-tap navigation
    useEffect(() => {
        if (status !== 'authenticated') {
            return;
        }

        configureNotificationHandler();

        // Check permission state and update status
        void checkNotificationPermissions().then((granted) => {
            setPushNotificationsEnabled(granted);
        });

        // Register device push token with backend
        void registerDevicePushToken(
            apiClient,
            undefined,
            Platform.OS === 'ios' ? 'ios' : 'android',
        ).then((res) => {
            if (res.status === 'registered') {
                setPushNotificationsEnabled(true);
            } else if (res.status === 'permission_denied') {
                setPushNotificationsEnabled(false);
            }
        });

        const handleNotificationNavigation = async (
            data: Record<string, unknown> | undefined,
        ) => {
            if (!data) {
                return;
            }

            if (status !== 'authenticated' || !user?.id) {
                return;
            }

            // Verify recipient isolation if recipient_id is present
            const recipientId =
                typeof data.recipient_id === 'number' ||
                typeof data.recipient_id === 'string'
                    ? Number(data.recipient_id)
                    : null;

            if (recipientId !== null && recipientId !== user.id) {
                setJobsError(
                    'This notification was intended for a different user account.',
                );

                return;
            }

            // Best-effort record push opened with backend for audit and lifecycle tracking
            const ticketId = extractTicketIdFromNotification(data);

            if (ticketId) {
                void apiClient
                    .recordPushOpened(ticketId)
                    .catch(() => undefined);
            }

            const event = extractEventFromNotification(data);

            // Handle Emergency SOS alert tap separately from dispatch navigation
            if (event === 'safety.sos_received') {
                const incidentId =
                    typeof data.incident_id === 'string'
                        ? data.incident_id
                        : typeof data.relevance_id === 'string'
                          ? data.relevance_id
                          : null;

                if (!incidentId) {
                    setJobsError(
                        'Emergency incident reference is missing from notification.',
                    );

                    return;
                }

                try {
                    const incident =
                        await apiClient.fetchSosIncident(incidentId);

                    if (!incident) {
                        setJobsError(
                            'Emergency incident was not found or has been removed.',
                        );

                        return;
                    }

                    if (
                        incident.status === 'resolved' ||
                        incident.status === 'cancelled'
                    ) {
                        setJobsError(
                            `Emergency incident #${incident.id.slice(0, 8)} is already ${incident.status}.`,
                        );

                        return;
                    }

                    // DO NOT open operator EmergencySosSheet (that is for reporting SOS, not responding)
                    // DO NOT automatically acknowledge the incident
                    // Set authorized responder notice directing user to Central Safety Desk
                    setSosResponderNotice({
                        incidentId: incident.id,
                        reporterName:
                            incident.reporter?.name || 'Field Operator',
                        category: incident.category || 'Emergency',
                        dispatchReference: incident.dispatch?.reference,
                        receivedAt: incident.received_at ?? undefined,
                    });
                } catch (err: unknown) {
                    const errorStatus =
                        err instanceof ApiClientError ? err.status : null;

                    if (errorStatus === 403) {
                        setJobsError(
                            'You are not authorized to view this emergency incident.',
                        );
                    } else if (errorStatus === 404) {
                        setJobsError(
                            'Emergency incident was not found or has been removed.',
                        );
                    } else {
                        setJobsError(
                            'Failed to fetch emergency incident state. Verify network connection.',
                        );
                    }
                }

                return;
            }

            // Fuel decisions open the request in Fuel Management, not Dispatch.
            if (event === 'fuel.status_changed') {
                const fuelRequestId = Number(data.fuel_request_id);

                setFuelFocusRequestId(
                    Number.isInteger(fuelRequestId) && fuelRequestId > 0
                        ? fuelRequestId
                        : null,
                );
                setActiveAppView('fuel');

                return;
            }

            const targetJobId = extractJobIdFromNotification(data);

            if (targetJobId === null) {
                return;
            }

            // Handle cancellation or release notification taps
            if (
                event === 'dispatch.cancelled' ||
                (event === 'dispatch.reassigned' && data.action === 'released')
            ) {
                if (isOnline === true) {
                    void fetchJobs();
                }

                const ref =
                    typeof data.reference === 'string'
                        ? data.reference
                        : `JOB-${targetJobId}`;
                setJobsError(
                    event === 'dispatch.cancelled'
                        ? `Dispatch job ${ref} was cancelled.`
                        : `You have been released from dispatch job ${ref}.`,
                );

                return;
            }

            try {
                // Verify server state and authorization
                const assignedJobs = await apiClient.fetchAssignedJobs();
                setJobs(assignedJobs || []);

                const isAssigned = (assignedJobs || []).some(
                    (j) => j.id === targetJobId,
                );

                if (isAssigned) {
                    setSelectedJobId(targetJobId);
                    setActiveAppView('dispatch');
                } else {
                    setJobsError(
                        'You are no longer assigned to this dispatch job or it has been cancelled.',
                    );
                }
            } catch {
                // Fallback to currently loaded jobs if offline or network failure
                setJobs((currentJobs) => {
                    const localMatch = currentJobs.some(
                        (j) => j.id === targetJobId,
                    );

                    if (localMatch) {
                        setSelectedJobId(targetJobId);
                        setActiveAppView('dispatch');
                    } else {
                        setJobsError(
                            'Unable to open dispatch job. Check connection or verify your assignment.',
                        );
                    }

                    return currentJobs;
                });
            }
        };

        // Check if cold started from a notification response tap (guarded to run once per app launch)
        if (!hasHandledColdStartRef.current) {
            hasHandledColdStartRef.current = true;
            void getLastNotificationResponseAsync()
                .then((response) => {
                    if (response?.notification?.request?.content?.data) {
                        void handleNotificationNavigation(
                            response.notification.request.content
                                .data as Record<string, unknown>,
                        );
                    }
                })
                .catch(() => {
                    // Tolerate cold start check failures
                });
        }

        // Listen for foreground pushes and background/lock-screen notification taps
        const unsubscribe = setupNotificationListeners({
            onNotificationReceived: () => {
                // Foreground push received: quietly reconcile assigned jobs data without disruptive alerts
                if (isOnline === true) {
                    void fetchJobs();
                }
            },
            onNotificationResponse: (response) => {
                const data = response?.notification?.request?.content?.data as
                    Record<string, unknown> | undefined;
                void handleNotificationNavigation(data);
            },
            onTokenRefresh: () => {
                void registerDevicePushToken(
                    apiClient,
                    undefined,
                    Platform.OS === 'ios' ? 'ios' : 'android',
                );
            },
        });

        return () => {
            unsubscribe();
        };
    }, [
        apiClient,
        fetchJobs,
        isOnline,
        refreshActiveSosIncident,
        status,
        user?.id,
    ]);

    const handleRequestPushPermissions = useCallback(async () => {
        const granted = await requestNotificationPermissions();
        setPushNotificationsEnabled(granted);

        if (granted) {
            void registerDevicePushToken(
                apiClient,
                undefined,
                Platform.OS === 'ios' ? 'ios' : 'android',
            );
        }
    }, [apiClient]);

    const refreshWeather = useCallback(async () => {
        if (!isUnitLinked) {
            return;
        }

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
    }, [apiClient, getCurrentLocation, isUnitLinked]);

    const refreshHosClocks = useCallback(async () => {
        if (status !== 'authenticated' || isOnline !== true) {
            return;
        }

        try {
            const currentShift = await apiClient.fetchCurrentHosShift();

            try {
                const cycleHistory = await apiClient.fetchHosCycleHistory(8);
                setTimelineHistory(mapHosCycleHistory(cycleHistory));
            } catch {
                // Keep the last server-accepted history when the audit request
                // is temporarily unavailable.
            }

            serverClockOffsetRef.current = serverClockOffsetMs(
                currentShift?.clocks?.server_time,
                Date.now(),
            );

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
                setShiftStartedAtIso(clock.started_at ?? null);
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
                        : null,
                    hoursElapsed: clock.hours_elapsed ?? null,
                    currentDutyStartedAt: clock.current_duty_started_at ?? null,
                    lastAcceptedDutyAt: clock.last_accepted_duty_at ?? null,
                    serverTime: clock.server_time ?? null,
                    shiftElapsedMinutes: clock.shift_elapsed_minutes ?? null,
                    operatingMinutes: clock.operating_minutes ?? null,
                    drivingMinutes: clock.driving_minutes ?? null,
                    standbyMinutes: clock.standby_minutes ?? null,
                    breakMinutes: clock.break_minutes ?? null,
                    limitCounterMinutes: clock.limit_counter_minutes ?? null,
                    limitCounterLabel: clock.limit_counter_label ?? null,
                    fatigueStatus: clock.fatigue_status ?? null,
                    doleWarning: clock.dole_warning ?? false,
                });
            } else if (currentShift && !currentShift.clocks?.shift_active) {
                setShiftStartedAtIso(null);
                setShiftInfo({
                    status: 'off_shift',
                    dutyStatus: 'off_duty',
                    startedAt: null,
                    hoursElapsed: null,
                    currentDutyStartedAt: null,
                    lastAcceptedDutyAt: null,
                    serverTime: currentShift.clocks.server_time ?? null,
                    shiftElapsedMinutes: null,
                    operatingMinutes: null,
                    drivingMinutes: null,
                    standbyMinutes: null,
                    breakMinutes: null,
                    limitCounterMinutes: null,
                    limitCounterLabel: null,
                });
            }
        } catch {
            // Keep local shift info if offline or fetch fails
        }
    }, [apiClient, isOnline, status]);

    const syncQueue = useCallback(
        async (refreshViewState = true) => {
            if (
                status !== 'authenticated' ||
                isOnline !== true ||
                !isOutboxReady
            ) {
                return;
            }

            const result = await commandOutbox.processQueue(apiClient);

            if (result.requiresAuthentication) {
                await handleLogout();

                return;
            }

            if (result.completed > 0 && refreshViewState) {
                await fetchJobs();
                await refreshHosClocks();
            }
        },
        [
            apiClient,
            commandOutbox,
            fetchJobs,
            handleLogout,
            refreshHosClocks,
            isOnline,
            isOutboxReady,
            status,
        ],
    );

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
                    await handleLogout();

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
            handleLogout,
            handleRequestFailure,
            isOnline,
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
            if (isOnline === true) {
                queueMicrotask(() => void fetchJobs());
                queueMicrotask(() => void refreshHosClocks());
            }
        } else {
            queueMicrotask(() => {
                setJobs([]);
                setSelectedJobId(null);
                setSelectedAssetId(null);
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
                    setSelectedAssetId(null);

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
        (jobId: number) => {
            setSelectedJobId(jobId);
            const foundJob = jobs.find((j) => j.id === jobId);

            if (
                foundJob?.asset_assignments &&
                foundJob.asset_assignments.length === 1
            ) {
                setSelectedAssetId(
                    foundJob.asset_assignments[0].operational_asset_id,
                );
            } else {
                setSelectedAssetId(null);
            }
        },
        [jobs],
    );

    const handleToggleShift = useCallback(() => {
        // Shift status is server-confirmed HOS state. The outbox banner carries
        // pending or failed intent until the accepted clocks are refreshed.
    }, []);

    const captureDutyLocation = useCallback(async () => {
        const snapshot = await nativeLocationAdapter.getDutyLocationSnapshot();
        let locationName: string | null = null;

        if (snapshot.latitude !== null && snapshot.longitude !== null) {
            try {
                locationName = await Promise.race([
                    nativeLocationAdapter.reverseGeocodeCity(
                        snapshot.latitude,
                        snapshot.longitude,
                    ),
                    new Promise<null>((resolve) =>
                        setTimeout(() => resolve(null), 800),
                    ),
                ]);
            } catch {
                locationName = null;
            }
        }

        return {
            ...snapshot,
            locationName,
        };
    }, []);

    const handleChangeDutyStatus = useCallback(
        async (
            dutyStatus: DutyStatus,
            standbyReason?: StandbyReason,
            remarks?: string,
        ) => {
            if (dutyStatus === 'off_duty') {
                setLocationSharingActive(false);
            }

            try {
                const targetJob =
                    liveJobs.find((job) => job.id === selectedJobId) ??
                    (liveJobs.length === 1 ? liveJobs[0] : null);
                const operationalAssetId =
                    selectedAssetId ??
                    (targetJob?.asset_assignments?.length === 1
                        ? targetJob.asset_assignments[0].operational_asset_id
                        : null);
                const dispatchJobId = targetJob?.id ?? null;
                const plan = planDutyCommand({
                    dutyStatus,
                    shift: {
                        status: shiftInfo.status,
                        dutyStatus: shiftInfo.dutyStatus,
                    },
                    pending: queuedHosCommands(outboxCommands),
                    phoneNowMs: Date.now(),
                    clockOffsetMs: serverClockOffsetRef.current,
                });

                if (plan.kind === null) {
                    return true;
                }

                const occurredAt = plan.occurredAt;
                const location = await captureDutyLocation();
                const locationPayload = {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    accuracy_metres: location.accuracyMetres,
                    location_observed_at: location.observedAt,
                    location_source: location.source,
                    location_name: location.locationName,
                };

                if (plan.kind === 'certify') {
                    await commandOutbox.enqueueCertifyHosShift({
                        operational_asset_id: operationalAssetId,
                        dispatch_job_id: dispatchJobId,
                        certification_statement:
                            'I certify that these duty status entries and hours of service are true, complete, and accurate for this shift.',
                        occurred_at: occurredAt,
                        ...locationPayload,
                        remarks,
                    });
                } else if (plan.kind === 'start') {
                    await commandOutbox.enqueueStartHosShift({
                        operational_asset_id: operationalAssetId,
                        dispatch_job_id: dispatchJobId,
                        duty_status: dutyStatus,
                        occurred_at: occurredAt,
                        ...locationPayload,
                        remarks,
                    });
                } else {
                    await commandOutbox.enqueueChangeHosDutyStatus({
                        operational_asset_id: operationalAssetId,
                        dispatch_job_id: dispatchJobId,
                        duty_status: dutyStatus,
                        standby_reason: standbyReason,
                        occurred_at: occurredAt,
                        ...locationPayload,
                        remarks,
                    });
                }

                await syncQueue();

                return true;
            } catch (error: unknown) {
                await handleRequestFailure(
                    error,
                    'Duty update could not be saved on this device.',
                );

                return false;
            }
        },
        [
            commandOutbox,
            captureDutyLocation,
            handleRequestFailure,
            liveJobs,
            outboxCommands,
            selectedAssetId,
            selectedJobId,
            shiftInfo.dutyStatus,
            shiftInfo.status,
            syncQueue,
        ],
    );

    const activeJob = liveJobs.find((job) => job.id === selectedJobId) || null;
    const currentJob = currentJobFor(jobs, selectedJobId);
    // The unit actually linked, which may not be the job home shows first.
    const linkedAssetCode = unitLink?.assetCode ?? null;
    const { linkedJob, linkedAsset } = useMemo(() => {
        if (!linkedAssetCode) {
            return { linkedJob: null, linkedAsset: null };
        }

        const job =
            jobs.find((candidate) =>
                candidate.asset_assignments?.some(
                    (a) => a.asset_code === linkedAssetCode,
                ),
            ) ?? null;

        return {
            linkedJob: job,
            linkedAsset:
                job?.asset_assignments?.find(
                    (a) => a.asset_code === linkedAssetCode,
                ) ?? null,
        };
    }, [jobs, linkedAssetCode]);
    // Tracking reports the linked unit's job, not whichever job home shows.
    const activeTrackingJob = linkedJob ?? currentJob;
    const activeTrackingAssetId =
        linkedAsset?.operational_asset_id ??
        activeTrackingJob?.asset_assignments?.find(
            (assignment) => assignment.operational_asset_id === selectedAssetId,
        )?.operational_asset_id ??
        (activeTrackingJob?.asset_assignments?.length === 1
            ? activeTrackingJob.asset_assignments[0].operational_asset_id
            : null);

    const resumeTracking = useCallback(() => {
        setLocationTrackingError(null);
        setLocationSharingActive(true);
    }, []);

    // After a restart the saved link comes back; so does tracking.
    useResumeTracking(
        {
            isLinked: isUnitLinked,
            isSharing: locationSharingActive,
            pausedByOperator,
            // Same rule as LocationSharingService.canShareLocation for a job.
            canShare: Boolean(
                user?.is_active &&
                activeTrackingJob?.capabilities?.can_share_location,
            ),
            shiftInfo,
        },
        resumeTracking,
    );

    const handleLocationCaptureIssue = useCallback(
        (error: unknown | null) => {
            if (error === null) {
                setLocationTrackingError(null);
                void syncQueue(false);

                return;
            }

            const errorMessage =
                error instanceof Error ? error.message.toLowerCase() : '';
            const permissionUnavailable = /permission|denied|revoked/.test(
                errorMessage,
            );

            setLocationTrackingError(
                permissionUnavailable
                    ? 'Location access is off. Allow location access in device settings, then resume telemetry.'
                    : 'No GPS fix is available yet. Check device Location Services; telemetry will retry automatically.',
            );

            if (permissionUnavailable) {
                setLocationSharingActive(false);
            }
        },
        [syncQueue],
    );

    // Stops tracking on the phone and tells dispatch sharing is paused.
    const stopTracking = useCallback(() => {
        setLocationSharingActive(false);
        setLocationTrackingError(null);
        locationService.stopAutoTracking();
        void stopBackgroundLocationUpdates().catch(() => undefined);

        if (user && activeTrackingJob) {
            void locationService.pauseSharing(user, activeTrackingJob);
        }
    }, [activeTrackingJob, locationService, user]);

    // The operator's own pause is kept across a restart.
    const handleToggleLocationSharing = useCallback(() => {
        if (locationSharingActive) {
            stopTracking();
            markTrackingPaused();

            return;
        }

        clearTrackingPause();
        resumeTracking();
    }, [
        clearTrackingPause,
        locationSharingActive,
        markTrackingPaused,
        resumeTracking,
        stopTracking,
    ]);

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

    const handleReportDelay = useCallback(
        async (jobId: number, payload: ReportDelayPayload) => {
            setIsLoadingJobs(true);
            let queued = false;

            try {
                const targetJob =
                    jobs.find((j) => j.id === jobId) ||
                    (activeJob?.id === jobId ? activeJob : null);
                const expectedVersion =
                    payload.job_version ?? targetJob?.version;

                await commandOutbox.enqueueReportDelay(
                    {
                        ...payload,
                        dispatch_job_id: jobId,
                        reported_at:
                            payload.reported_at ?? new Date().toISOString(),
                    },
                    expectedVersion,
                );
                queued = true;

                await syncQueue();
            } catch (error: unknown) {
                await handleRequestFailure(
                    error,
                    'Delay report saved locally and will retry.',
                );

                if (!queued) {
                    throw error;
                }
            } finally {
                setIsLoadingJobs(false);
            }
        },
        [activeJob, commandOutbox, handleRequestFailure, jobs, syncQueue],
    );

    /**
     * Ask dispatch for a replacement unit. The phone never switches units by
     * itself: only dispatch can assign one, and the job updates when it does.
     */
    const handleRequestReplacement = useCallback(
        async (note: string) => {
            if (!currentJob) {
                return;
            }

            try {
                await commandOutbox.enqueueReportDelay(
                    buildReplacementRequest({
                        // Only name a unit when the job has exactly one.
                        asset:
                            currentJob.asset_assignments?.length === 1
                                ? currentJob.asset_assignments[0]
                                : null,
                        job: currentJob,
                        note,
                        reportedAt: new Date().toISOString(),
                    }),
                    currentJob.version,
                );
                void syncQueue();
            } catch (error: unknown) {
                await handleRequestFailure(
                    error,
                    'Replacement request saved on this phone and will retry.',
                );
            }
        },
        [commandOutbox, currentJob, handleRequestFailure, syncQueue],
    );

    const handleReportSafetyHazard = useCallback(
        async (payload: SafetyHazardCommandPayload): Promise<string> => {
            const command =
                await commandOutbox.enqueueReportSafetyHazard(payload);

            if (isOnline === true) {
                void syncQueue();
            }

            return command.id;
        },
        [commandOutbox, isOnline, syncQueue],
    );

    const handleIssueWorkStoppage = useCallback(
        async (payload: WorkStoppageCommandPayload): Promise<string> => {
            const command =
                await commandOutbox.enqueueIssueWorkStoppage(payload);

            if (isOnline === true) {
                void syncQueue();
            }

            return command.id;
        },
        [commandOutbox, isOnline, syncQueue],
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
                        await handleLogout();
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
        [
            apiClient,
            commandOutbox,
            fetchJobs,
            handleLogout,
            handleRequestFailure,
        ],
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

    // A rejected duty change holds every later one; once it is discarded
    // or retried, send the rest straight away.
    const handleDiscardDutyChange = useCallback(
        (commandId: string) => {
            void commandOutbox
                .discardCommand(commandId)
                .then(() => syncQueue())
                .catch((error: unknown) =>
                    handleRequestFailure(
                        error,
                        'Failed to discard the duty change.',
                    ),
                );
        },
        [commandOutbox, handleRequestFailure, syncQueue],
    );

    const handleRetryDutyChange = useCallback(
        (commandId: string) => {
            void commandOutbox
                .retryCommand(commandId, apiClient)
                .then(() => syncQueue())
                .catch((error: unknown) =>
                    handleRequestFailure(
                        error,
                        'Failed to retry the duty change.',
                    ),
                );
        },
        [apiClient, commandOutbox, handleRequestFailure, syncQueue],
    );

    const handleRentalCheckout = useCallback(
        async (data: RentalCheckoutData) => {
            const linkedJob =
                (data.jobId ? jobs.find((j) => j.id === data.jobId) : null) ??
                (activeJob?.source?.type === 'rental_reservation'
                    ? activeJob
                    : null);

            const reservationId =
                data.reservationId ??
                (linkedJob?.source?.type === 'rental_reservation'
                    ? linkedJob.source.id
                    : null);

            if (!reservationId) {
                const error = new Error(
                    'Explicit rental reservation must be selected before submitting handover evidence.',
                );
                await handleRequestFailure(
                    error,
                    'Please select an active rental reservation job.',
                );

                throw error;
            }

            const assignments = linkedJob?.asset_assignments ?? [];
            const requestedAssetId = data.assetId ?? selectedAssetId;
            const assetId =
                assignments.length === 0
                    ? (requestedAssetId ?? null)
                    : requestedAssetId !== null &&
                        requestedAssetId !== undefined &&
                        assignments.some(
                            (assignment) =>
                                assignment.operational_asset_id ===
                                requestedAssetId,
                        )
                      ? requestedAssetId
                      : assignments.length === 1
                        ? assignments[0].operational_asset_id
                        : null;

            if (assignments.length > 1 && assetId === null) {
                const error = new Error(
                    'Multiple assets are assigned to this job. Select the asset covered by the rental handover before submitting.',
                );
                await handleRequestFailure(
                    error,
                    'Please select the assigned asset covered by this handover.',
                );

                throw error;
            }

            const photosPayload = (data.photos || []).map((p) => ({
                base64:
                    p.base64 ||
                    (p.uri?.startsWith('data:') ? p.uri : undefined),
                file_path: p.uri,
                label: p.fileName || 'inspection',
            }));

            let queued = false;

            try {
                await commandOutbox.enqueueSubmitRentalHandover({
                    reservation_id: Number(reservationId),
                    dispatch_job_id: linkedJob?.id ?? null,
                    operational_asset_id:
                        assetId !== null ? Number(assetId) : null,
                    handover_type: 'checkout',
                    hour_meter: data.hourMeter,
                    fuel_percent: data.fuelLevelPercent,
                    condition_assessment: data.conditionAssessment || 'good',
                    condition_notes: data.conditionNotes,
                    damage_noted: data.damageNoted ?? false,
                    damage_notes: data.damageNotes,
                    photos: photosPayload,
                    signature: data.signatureBase64,
                    signee_name: data.signeeName,
                    signee_role: data.signeeRole || 'Site Representative',
                });
                queued = true;

                await syncQueue();
            } catch (error: unknown) {
                await handleRequestFailure(
                    error,
                    'Rental checkout evidence queued locally.',
                );

                if (!queued) {
                    throw error;
                }
            }

            if (queued) {
                setActiveAppView('main');
            }
        },
        [
            activeJob,
            commandOutbox,
            handleRequestFailure,
            jobs,
            selectedAssetId,
            syncQueue,
        ],
    );

    const handleRentalReturn = useCallback(
        async (data: RentalReturnData) => {
            const linkedJob =
                (data.jobId ? jobs.find((j) => j.id === data.jobId) : null) ??
                (activeJob?.source?.type === 'rental_reservation'
                    ? activeJob
                    : null);

            const reservationId =
                data.reservationId ??
                (linkedJob?.source?.type === 'rental_reservation'
                    ? linkedJob.source.id
                    : null);

            if (!reservationId) {
                const error = new Error(
                    'Explicit rental reservation must be selected before submitting handover evidence.',
                );
                await handleRequestFailure(
                    error,
                    'Please select an active rental reservation job.',
                );

                throw error;
            }

            const assignments = linkedJob?.asset_assignments ?? [];
            const requestedAssetId = data.assetId ?? selectedAssetId;
            const assetId =
                assignments.length === 0
                    ? (requestedAssetId ?? null)
                    : requestedAssetId !== null &&
                        requestedAssetId !== undefined &&
                        assignments.some(
                            (assignment) =>
                                assignment.operational_asset_id ===
                                requestedAssetId,
                        )
                      ? requestedAssetId
                      : assignments.length === 1
                        ? assignments[0].operational_asset_id
                        : null;

            if (assignments.length > 1 && assetId === null) {
                const error = new Error(
                    'Multiple assets are assigned to this job. Select the asset covered by the rental return before submitting.',
                );
                await handleRequestFailure(
                    error,
                    'Please select the assigned asset covered by this return.',
                );

                throw error;
            }

            const photosPayload = (data.photos || []).map((p) => ({
                base64:
                    p.base64 ||
                    (p.uri?.startsWith('data:') ? p.uri : undefined),
                file_path: p.uri,
                label: p.fileName || 'inspection',
            }));

            let queued = false;

            try {
                await commandOutbox.enqueueSubmitRentalHandover({
                    reservation_id: Number(reservationId),
                    dispatch_job_id: linkedJob?.id ?? null,
                    operational_asset_id:
                        assetId !== null ? Number(assetId) : null,
                    handover_type: 'return',
                    hour_meter: data.hourMeter,
                    fuel_percent: data.fuelLevelPercent,
                    condition_assessment:
                        data.conditionAssessment ||
                        (data.damageNoted ? 'fair' : 'good'),
                    condition_notes: data.conditionNotes,
                    damage_noted: data.damageNoted,
                    damage_notes: data.damageNotes,
                    photos: photosPayload,
                    signature: data.signatureBase64,
                    signee_name: data.signeeName,
                    signee_role: data.signeeRole || 'Site Representative',
                });
                queued = true;

                await syncQueue();
            } catch (error: unknown) {
                await handleRequestFailure(
                    error,
                    'Rental return evidence queued locally.',
                );

                if (!queued) {
                    throw error;
                }
            }

            if (queued) {
                setActiveAppView('main');
            }
        },
        [
            activeJob,
            commandOutbox,
            handleRequestFailure,
            jobs,
            selectedAssetId,
            syncQueue,
        ],
    );

    // The unit comes from the same current job home shows: the opened live
    // job, otherwise the first live one.
    const currentAsset =
        currentJob?.asset_assignments?.find(
            (a) => a.operational_asset_id === selectedAssetId,
        ) ||
        (currentJob?.asset_assignments &&
        currentJob.asset_assignments.length === 1
            ? currentJob.asset_assignments[0]
            : null) ||
        (liveJobs.length === 1 && liveJobs[0]?.asset_assignments?.length === 1
            ? liveJobs[0].asset_assignments[0]
            : null) ||
        null;
    // The real unit code, or empty when there isn't exactly one unit.
    const resolvedAssetCode = currentAsset?.asset_code || '';
    const resolvedAssetName =
        currentAsset?.asset_name ||
        (activeJob?.asset_assignments && activeJob.asset_assignments.length > 1
            ? ''
            : liveJobs.length > 0
              ? 'Heavy Equipment Unit'
              : 'No Equipment Assigned');
    const resolvedOperatorName = user?.name || 'Field Operator';
    const resolvedJobReference = currentJob?.reference || 'NO-DISPATCH';
    const resolvedClientName = currentJob?.client || 'Client Account';

    const walletAssetCode = resolvedAssetCode;

    const serverPostTripDone = useServerPostTrip({
        canFetch:
            activeAppView === 'hos' &&
            status === 'authenticated' &&
            isOnline === true,
        apiClient,
        assetId: linkedAsset?.operational_asset_id,
        assetCode: unitLink?.assetCode,
        shiftStartedAt: shiftStartedAtIso,
        linkedAt: unitLink?.linkedAt,
        outboxCommands,
    });
    const postTripDone =
        unitLink !== null &&
        (postTripDoneFor === unitLink.assetCode || serverPostTripDone);

    // The server needs the unit's id and job, found from the assigned jobs.
    const handleLinkUnit = (assetCode: string) => {
        const job = jobs.find((candidate) =>
            candidate.asset_assignments?.some(
                (a) => a.asset_code === assetCode,
            ),
        );
        const assignment = job?.asset_assignments?.find(
            (a) => a.asset_code === assetCode,
        );

        // A new link starts with tracking on.
        clearTrackingPause();
        linkUnit({
            assetCode,
            assetId: assignment?.operational_asset_id ?? null,
            jobId: job?.id ?? null,
        });
    };

    // One release for home and Hours of Service: unlink and stop tracking.
    const releaseUnit = () => {
        unlinkUnit();
        setPostTripDoneFor(null);
        stopTracking();
        clearTrackingPause();
    };

    // Documents follow the linked unit, not every unit on every job.
    const documentAssets = useMemo(
        () =>
            walletAssets(
                linkedAssetCode
                    ? {
                          assetCode: linkedAssetCode,
                          assetName: linkedAsset?.asset_name ?? undefined,
                      }
                    : null,
                { assetCode: walletAssetCode, assetName: resolvedAssetName },
            ),
        [linkedAssetCode, linkedAsset, walletAssetCode, resolvedAssetName],
    );

    useEffect(() => {
        if (
            !activeTrackingJob ||
            !user ||
            !isUnitLinked ||
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
                    activeTrackingAssetId,
                    15_000,
                    handleLocationCaptureIssue,
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
        activeTrackingAssetId,
        getCurrentLocation,
        handleLocationCaptureIssue,
        locationService,
        locationSharingActive,
        isUnitLinked,
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
                        onPress={() => void handleLogout()}
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
                        onPress={() => void handleLogout()}
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
    const pendingHosCommands = outboxCommands
        .filter(
            (command) =>
                (command.type === 'start_hos_shift' ||
                    command.type === 'change_hos_duty_status' ||
                    command.type === 'certify_hos_shift') &&
                (command.state === 'queued' ||
                    command.state === 'syncing' ||
                    command.state === 'failed'),
        )
        .sort(
            (left, right) =>
                left.createdAt.localeCompare(right.createdAt) ||
                left.id.localeCompare(right.id),
        );
    const pendingHosCommand = pendingHosCommands[pendingHosCommands.length - 1];
    const pendingHosState =
        pendingHosCommand?.state === 'queued' ||
        pendingHosCommand?.state === 'syncing' ||
        pendingHosCommand?.state === 'failed'
            ? pendingHosCommand.state
            : null;
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
        activeSosIncident?.available_actions ??
        (Array.isArray(sosConfiguration?.actions)
            ? sosConfiguration.actions
            : []);

    const statusBar = statusBarAppearance(theme);

    return (
        <ErrorBoundary>
            <SafeAreaView
                edges={['top', 'left', 'right']}
                style={[
                    styles.fullScreen,
                    { backgroundColor: statusBar.backgroundColor },
                ]}
            >
                <StatusBar
                    backgroundColor={statusBar.backgroundColor}
                    barStyle={statusBar.barStyle}
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
                        {selectedJobId !== null &&
                        jobsError &&
                        isOnline !== false &&
                        !isFetchError(jobsError) ? (
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
                        {activeAppView === 'safety' ? (
                            <FieldSafetyScreen
                                actorId={user?.id}
                                apiClient={apiClient}
                                activeSite={currentJob?.site ?? null}
                                commands={outboxCommands.filter(
                                    (command) =>
                                        command.type ===
                                            'report_safety_hazard' ||
                                        command.type === 'issue_work_stoppage',
                                )}
                                isOnline={isOnline}
                                onBack={() => setActiveAppView('main')}
                                onIssueWorkStoppage={handleIssueWorkStoppage}
                                onReportHazard={handleReportSafetyHazard}
                                onRetryCommand={(commandId) =>
                                    void handleRetryCommand(commandId)
                                }
                            />
                        ) : activeAppView === 'hos' ? (
                            <HosScreen
                                activeJobId={currentJob?.id}
                                apiClient={apiClient}
                                // Only a machine the operator has linked to.
                                linkedAssetCode={unitLink?.assetCode ?? null}
                                linkedAssetType={
                                    unitLink
                                        ? resolveDesignatedEquipmentType({
                                              assetCode: unitLink.assetCode,
                                              assetKind:
                                                  linkedAsset?.asset_kind,
                                              assetName:
                                                  linkedAsset?.asset_name,
                                          })
                                        : null
                                }
                                onBack={() => setActiveAppView('main')}
                                onEndShift={() => {
                                    handleToggleShift();
                                    setLocationSharingActive(false);
                                }}
                                onReleaseUnit={releaseUnit}
                                onStartPostTrip={() => {
                                    // Inspect the linked unit, not whichever
                                    // job home happens to show.
                                    if (linkedJob && linkedAsset) {
                                        setSelectedJobId(linkedJob.id);
                                        setSelectedAssetId(
                                            linkedAsset.operational_asset_id,
                                        );
                                    }

                                    setDvirInitialMode('post_trip');
                                    setDvirReturnView('hos');
                                    setActiveAppView('dvir');
                                }}
                                postTripDone={postTripDone}
                                onToggleShift={handleToggleShift}
                                onUpdateDutyStatus={handleChangeDutyStatus}
                                operatorName={resolvedOperatorName}
                                dutySync={hosSyncSummary(outboxCommands)}
                                onDiscardDutyChange={handleDiscardDutyChange}
                                onRetryDutyChange={handleRetryDutyChange}
                                pendingDutyState={pendingHosState}
                                timelineHistory={timelineHistory}
                                shiftInfo={shiftInfo}
                            />
                        ) : activeAppView === 'dvir' ? (
                            <DvirScreen
                                activeJobReference={resolvedJobReference}
                                apiClient={apiClient}
                                assetAssignments={currentJob?.asset_assignments}
                                // Never a display placeholder: an unknown unit
                                // shows the DVIR's no-equipment state instead.
                                assetCode={walletAssetCode}
                                assetKind={currentAsset?.asset_kind}
                                assetName={currentAsset?.asset_name ?? ''}
                                commandOutbox={commandOutbox}
                                initialMode={dvirInitialMode}
                                inspectorName={resolvedOperatorName}
                                returnLabel={
                                    dvirReturnView === 'hos'
                                        ? 'Hours of Service'
                                        : 'home'
                                }
                                onBack={() => {
                                    setActiveAppView(dvirReturnView);
                                    setDvirReturnView('main');
                                }}
                                onSaveInspectionRecord={(record) => {
                                    if (record.type === 'post_trip') {
                                        setPostTripDoneFor(record.assetCode);
                                    }
                                }}
                                onDefectLockout={() => {
                                    stopTracking();
                                    handleChangeDutyStatus(
                                        'standby',
                                        'inspection_hold',
                                        'Pre-trip DVIR defect lockout',
                                    );
                                    setDvirStatus('defect');
                                    unlinkUnit();
                                }}
                                onPreTripPassed={() => {
                                    setDvirStatus('cleared');
                                }}
                                onSelectAsset={(id) => setSelectedAssetId(id)}
                                canRequestReplacement={Boolean(currentJob)}
                                onRequestReplacement={handleRequestReplacement}
                                onSwitchToStandby={() => {
                                    handleChangeDutyStatus(
                                        'standby',
                                        'inspection_hold',
                                        'Pre-trip DVIR defect lockout',
                                    );
                                    setActiveAppView('main');
                                }}
                                operationalAssetId={selectedAssetId}
                                selectedAssetId={selectedAssetId}
                            />
                        ) : activeAppView === 'documents' ? (
                            <DocumentsWalletScreen
                                assetCode={documentAssets[0]?.assetCode}
                                assignedAssets={documentAssets}
                                onBack={() => setActiveAppView('main')}
                                operatorName={resolvedOperatorName}
                            />
                        ) : activeAppView === 'fuel' && user ? (
                            <FuelScreen
                                key={user.id}
                                actorId={user.id}
                                apiClient={apiClient}
                                isOnline={isOnline}
                                commandOutbox={commandOutbox}
                                isOutboxReady={isOutboxReady}
                                syncQueue={() => syncQueue(false)}
                                initialRequestId={fuelFocusRequestId}
                                onBack={() => {
                                    setFuelFocusRequestId(null);
                                    setActiveAppView('main');
                                }}
                            />
                        ) : activeAppView === 'inspection' ? (
                            <MachineProfileScreen
                                assets={
                                    activeJob?.asset_assignments ??
                                    (currentAsset ? [currentAsset] : [])
                                }
                                dvirStatus={dvirStatus}
                                onBack={() => setActiveAppView('main')}
                                onOpenDocuments={() =>
                                    setActiveAppView('documents')
                                }
                                onOpenDvir={() => setActiveAppView('dvir')}
                                onSelectAsset={(id) => setSelectedAssetId(id)}
                                selectedAssetId={selectedAssetId}
                            />
                        ) : activeAppView === 'rental' ? (
                            <RentalHandoverScreen
                                assignedAssets={activeJob?.asset_assignments}
                                actorId={user?.id}
                                assetCode={
                                    currentAsset?.asset_code ||
                                    resolvedAssetCode
                                }
                                assetId={currentAsset?.operational_asset_id}
                                assetName={
                                    currentAsset?.asset_name ||
                                    resolvedAssetName
                                }
                                clientName={
                                    activeJob?.client || resolvedClientName
                                }
                                jobId={activeJob?.id}
                                onBack={() => setActiveAppView('main')}
                                onCompleteCheckout={handleRentalCheckout}
                                onCompleteReturn={handleRentalReturn}
                                reservationId={
                                    activeJob?.source?.type ===
                                    'rental_reservation'
                                        ? activeJob.source.id
                                        : undefined
                                }
                                reservationReference={
                                    activeJob?.source?.reference ||
                                    activeJob?.reference ||
                                    resolvedJobReference
                                }
                            />
                        ) : activeAppView === 'dispatch' ? (
                            <DispatchOrdersScreen
                                apiClient={apiClient}
                                conflictedCommands={outboxCommands?.filter(
                                    (command) => command.state === 'conflict',
                                )}
                                jobs={jobs}
                                onAcceptAssignment={handleAcceptAssignment}
                                onAcceptServerState={handleAcceptServerState}
                                onBack={() => setActiveAppView('main')}
                                onOpenDvir={() => {
                                    setDvirInitialMode('pre_trip');
                                    setActiveAppView('dvir');
                                }}
                                onRejectAssignment={handleRejectAssignment}
                                onRetryNewVersion={handleRetryNewVersion}
                                onSelectJob={handleSelectJob}
                                onSubmitDelay={handleReportDelay}
                                onTransitionStatus={handleTransitionStatus}
                                outboxCommands={outboxCommands}
                            />
                        ) : activeAppView === 'profile' ? (
                            <>
                                <ProfileScreen
                                    apiClient={apiClient}
                                    // The unit the operator is linked to, if any.
                                    assignedAssetLabel={
                                        linkedAssetCode
                                            ? [
                                                  linkedAssetCode,
                                                  linkedAsset?.asset_name,
                                              ]
                                                  .filter(Boolean)
                                                  .join(' · ')
                                            : null
                                    }
                                    isOnline={isOnline}
                                    onBack={() => setActiveAppView('main')}
                                    onLogout={() => void handleLogout()}
                                    onOpenOutboxDetails={() =>
                                        setProfileOutboxSheetOpen(true)
                                    }
                                    onRequestPushPermissions={
                                        handleRequestPushPermissions
                                    }
                                    onSyncNow={() => void syncQueue()}
                                    outboxCommands={outboxCommands}
                                    pushNotificationsEnabled={
                                        pushNotificationsEnabled
                                    }
                                    queuedCount={outboxCommands?.length ?? 0}
                                    userName={user?.name}
                                    userRole={user?.role}
                                    isAuthenticated={status === 'authenticated'}
                                    lastSuccessfulSyncAt={commandOutbox.getLastSuccessfulSyncAt()}
                                />
                                <OutboxStatusSheet
                                    commands={outboxCommands}
                                    isAuthenticated={status === 'authenticated'}
                                    isOnline={isOnline}
                                    lastSuccessfulSyncAt={commandOutbox.getLastSuccessfulSyncAt()}
                                    onAcceptServerState={
                                        handleAcceptServerState
                                    }
                                    onClose={() =>
                                        setProfileOutboxSheetOpen(false)
                                    }
                                    onDiscardCommand={handleDiscardCommand}
                                    onRetryCommand={handleRetryCommand}
                                    onRetryNewVersion={handleRetryNewVersion}
                                    onSignIn={() => void handleLogout()}
                                    onSyncNow={() => void syncQueue()}
                                    userName={user?.name}
                                    userRole={user?.role}
                                    visible={profileOutboxSheetOpen}
                                />
                            </>
                        ) : (
                            <View style={{ flex: 1 }}>
                                {sosResponderNotice && (
                                    <View
                                        testID="sos-responder-notice-banner"
                                        style={{
                                            backgroundColor: '#FEF2F2',
                                            borderColor: '#DC2626',
                                            borderWidth: 1,
                                            borderRadius: 8,
                                            padding: 12,
                                            marginHorizontal: 16,
                                            marginTop: 8,
                                            marginBottom: 4,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontWeight: 'bold',
                                                color: '#B91C1C',
                                                fontSize: 14,
                                            }}
                                        >
                                            EMERGENCY SOS ALERT
                                        </Text>
                                        <Text
                                            style={{
                                                color: '#7F1D1D',
                                                marginTop: 4,
                                                fontSize: 13,
                                            }}
                                        >
                                            Active incident reported by{' '}
                                            {sosResponderNotice.reporterName} (
                                            {sosResponderNotice.category}).
                                            {sosResponderNotice.dispatchReference
                                                ? ` Dispatch: ${sosResponderNotice.dispatchReference}.`
                                                : ''}
                                        </Text>
                                        <Text
                                            style={{
                                                color: '#991B1B',
                                                marginTop: 4,
                                                fontSize: 12,
                                                fontStyle: 'italic',
                                            }}
                                        >
                                            Please use the Central Web Safety
                                            Operations Desk
                                            (/operations/sos-incidents) to
                                            triage, acknowledge, and resolve
                                            this emergency.
                                        </Text>
                                        <Pressable
                                            testID="dismiss-sos-responder-notice"
                                            onPress={() =>
                                                setSosResponderNotice(null)
                                            }
                                            style={{
                                                alignSelf: 'flex-end',
                                                marginTop: 8,
                                                paddingHorizontal: 10,
                                                paddingVertical: 5,
                                                backgroundColor: '#DC2626',
                                                borderRadius: 4,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: '#FFFFFF',
                                                    fontSize: 12,
                                                    fontWeight: '600',
                                                }}
                                            >
                                                Dismiss Notice
                                            </Text>
                                        </Pressable>
                                    </View>
                                )}
                                <AssignedJobsListScreen
                                    apiClient={apiClient}
                                    onSosHoldComplete={handleGlobalSosHold}
                                    sosDisabled={isSosActivating}
                                    error={jobsError}
                                    isLoading={isLoadingJobs}
                                    isOnline={isOnline}
                                    jobs={jobs}
                                    isUnitLinked={
                                        unitLink?.assetCode ===
                                            resolvedAssetCode &&
                                        resolvedAssetCode !== ''
                                    }
                                    onLinkUnit={(assetCode) =>
                                        handleLinkUnit(
                                            assetCode || resolvedAssetCode,
                                        )
                                    }
                                    dvirStatus={dvirStatus}
                                    preTripDefectLockout={
                                        dvirStatus === 'defect'
                                    }
                                    canRequestReplacement={Boolean(currentJob)}
                                    onRequestReplacement={
                                        handleRequestReplacement
                                    }
                                    locationSharingActive={
                                        locationSharingActive
                                    }
                                    locationTrackingError={
                                        locationTrackingError
                                    }
                                    onChangeDutyStatus={handleChangeDutyStatus}
                                    onDiscardCommand={handleDiscardCommand}
                                    onLogout={() => void handleLogout()}
                                    onOpenDocuments={() =>
                                        setActiveAppView('documents')
                                    }
                                    onOpenDvir={(mode) => {
                                        setDvirInitialMode(mode || 'pre_trip');
                                        setActiveAppView('dvir');
                                    }}
                                    onOpenSafety={() =>
                                        setActiveAppView('safety')
                                    }
                                    onOpenForms={() =>
                                        setActiveAppView('dispatch')
                                    }
                                    onOpenHos={() => setActiveAppView('hos')}
                                    onOpenRental={() =>
                                        setActiveAppView('rental')
                                    }
                                    onOpenVehicle={() =>
                                        setActiveAppView('inspection')
                                    }
                                    onOpenFuel={() => setActiveAppView('fuel')}
                                    onOpenProfile={() =>
                                        setActiveAppView('profile')
                                    }
                                    onOpenAccountSettings={() =>
                                        setActiveAppView('profile')
                                    }
                                    onRefresh={() => {
                                        void fetchJobs();
                                        void refreshWeather();
                                        void refreshHosClocks();
                                    }}
                                    onRetryCommand={handleRetryCommand}
                                    onSelectJob={handleSelectJob}
                                    onAcceptAssignment={handleAcceptAssignment}
                                    onAcceptServerState={
                                        handleAcceptServerState
                                    }
                                    onRejectAssignment={handleRejectAssignment}
                                    onReportDelay={handleReportDelay}
                                    onRetryNewVersion={handleRetryNewVersion}
                                    onTransitionStatus={handleTransitionStatus}
                                    onSyncNow={() => void syncQueue()}
                                    onToggleLocationSharing={
                                        handleToggleLocationSharing
                                    }
                                    onReleaseUnit={releaseUnit}
                                    outboxCommands={outboxCommands}
                                    isAuthenticated={status === 'authenticated'}
                                    lastSuccessfulSyncAt={commandOutbox.getLastSuccessfulSyncAt()}
                                    shiftInfo={shiftInfo}
                                    userName={user?.name}
                                    userRole={user?.role.replaceAll('_', ' ')}
                                    weather={weather}
                                    isLoadingWeather={isLoadingWeather}
                                    weatherError={weatherError}
                                    onRefreshWeather={() =>
                                        void refreshWeather()
                                    }
                                />
                            </View>
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
        backgroundColor: colors.primary,
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
