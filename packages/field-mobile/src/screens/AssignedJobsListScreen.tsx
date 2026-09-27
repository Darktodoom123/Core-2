import React, { useMemo, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { AssetVehicleCard } from '../components/cards/AssetVehicleCard';
import type { DvirReadinessStatus } from '../components/cards/AssetVehicleCard';
import { FailedCommandsList } from '../components/cards/FailedCommandsList';
import { activeJobs } from '../components/cards/job-card/job-lifecycle';
import { LocationWeatherCard } from '../components/cards/LocationWeatherCard';
import { Icon } from '../components/common/Icon';
import { AssignmentSummaryCard } from '../components/home/assignment-summary-card';
import { NoUnitCard } from '../components/home/no-unit-card';
import { ReliefClaimButton } from '../components/home/relief-claim-button';
import { FieldBottomNav } from '../components/layout/field-bottom-nav';
import type { FieldNavItem } from '../components/layout/field-bottom-nav';
import type { FieldScreen } from '../components/layout/field-bottom-nav';
import { FieldHeader } from '../components/layout/field-header';
import type { SyncTone } from '../components/layout/field-header';
import type { HomeTile } from '../components/layout/home-tile-grid';
import { HomeTileGrid } from '../components/layout/home-tile-grid';
import { colors, shadows } from '../components/nativeStyles';
import { SyncStatusPanel } from '../components/panels/sync-status-panel';
import { DispatchIntakeSheet } from '../components/sheets/DispatchIntakeSheet';
import { NotificationsSheet } from '../components/sheets/notifications-sheet';
import { OnSiteConfirmationModal } from '../components/sheets/OnSiteConfirmationModal';
import { OutboxStatusSheet } from '../components/sheets/OutboxStatusSheet';
import { PreTripDefectFallbackModal } from '../components/sheets/PreTripDefectFallbackModal';
import { ProfileSheet } from '../components/sheets/profile-sheet';
import { ReliefHandoverModal } from '../components/sheets/ReliefHandoverModal';
import { ReplacementRequestSheet } from '../components/sheets/replacement-request/replacement-request-sheet';
import { ReportDelayModal } from '../components/sheets/ReportDelayModal';
import { isFetchError } from '../connectivity/networkMonitor';
import { useHosCompliance } from '../hooks/useHosCompliance';
import type { FieldApiClient } from '../services/apiClient';
import { projectOutbox } from '../services/outboxProjection';
import { useTheme } from '../theme';
import type {
    DispatchJob,
    EquipmentHandoverClaimResponse,
    DispatchStatus,
    DutyStatus,
    OutboxCommand,
    ReportDelayPayload,
    ShiftInfo,
    StandbyReason,
    WeatherTelemetry,
} from '../types/index';
import { DOLE_CAP_HOURS, formatHoursMinutes } from './hos/hos-constants';

export interface AssignedJobsListScreenProps {
    jobs: DispatchJob[];
    outboxCommands: OutboxCommand[];
    isLoading: boolean;
    isOnline?: boolean | null;
    userName?: string | null;
    userRole?: string | null;
    shiftInfo?: ShiftInfo;
    locationSharingActive?: boolean;
    locationTrackingError?: string | null;
    error?: string | null;
    onSosHoldComplete: () => void;
    sosDisabled?: boolean;
    onRefresh: () => void;
    onSelectJob?: (jobId: number) => void;
    onAcceptAssignment?: (
        jobId: number,
        assignmentId: number,
        version: number,
    ) => void;
    onRejectAssignment?: (
        jobId: number,
        assignmentId: number,
        reason: string,
        version: number,
    ) => void;
    onTransitionStatus?: (
        jobId: number,
        nextStatus: DispatchStatus,
        version: number,
    ) => void;
    onChangeDutyStatus?: (
        dutyStatus: DutyStatus,
        standbyReason?: StandbyReason,
        remarks?: string,
    ) => void;
    onOpenDvir?: (mode?: 'pre_trip' | 'post_trip') => void;
    onOpenHos?: () => void;
    onOpenSafety?: () => void;
    onOpenDocuments?: () => void;
    onOpenVehicle?: () => void;
    onOpenFuel?: () => void;
    onOpenForms?: () => void;
    onReleaseUnit?: (assetCode: string) => void;
    isUnitLinked?: boolean;
    onLinkUnit?: (assetCode: string) => void;
    dvirStatus?: DvirReadinessStatus | 'passed';
    /** Asks dispatch for a replacement; the phone never switches units itself. */
    onRequestReplacement?: (note: string) => void;
    /** False when there is no job to send a replacement request with. */
    canRequestReplacement?: boolean;
    preTripDefectLockout?: boolean;
    onOpenRental?: () => void;
    onToggleLocationSharing?: () => void;
    onLogout?: () => void;
    onSyncNow?: () => void;
    onRetryCommand?: (commandId: string) => void;
    onDiscardCommand?: (commandId: string) => void;
    onAcceptServerState?: (commandId: string) => void;
    onRetryNewVersion?: (commandId: string, newVersion: number) => void;
    onReportDelay?: (
        jobId: number,
        payload: ReportDelayPayload,
    ) => Promise<void> | void;
    weather?: WeatherTelemetry | null;
    isLoadingWeather?: boolean;
    weatherError?: string | null;
    onRefreshWeather?: () => void;
    apiClient?: FieldApiClient;
    pushNotificationsEnabled?: boolean;
    onRequestPushPermissions?: () => void;
    onOpenProfile?: () => void;
    onOpenAccountSettings?: () => void;
    lastSuccessfulSyncAt?: string | null;
    isAuthenticated?: boolean;
    onRecaptureAttachment?: (commandId: string, oldUri: string) => void;
}

type TileId =
    'hos' | 'dvir' | 'documents' | 'vehicle' | 'fuel' | 'forms' | 'rental';

type TileItem = HomeTile<TileId>;

export const AssignedJobsListScreen: React.FC<AssignedJobsListScreenProps> = ({
    jobs: allJobs = [],
    outboxCommands = [],
    isLoading,
    isOnline = null,
    userName,
    userRole,
    shiftInfo = {
        status: 'on_shift',
        dutyStatus: 'operating',
        startedAt: '08:00 AM',
        hoursElapsed: 4,
    },
    locationSharingActive = true,
    locationTrackingError = null,
    error,
    onSosHoldComplete,
    sosDisabled = false,
    onRefresh,
    onSelectJob,
    onAcceptAssignment,
    onRejectAssignment,
    onTransitionStatus,
    onChangeDutyStatus,
    onOpenDvir,
    onOpenHos,
    onOpenSafety,
    onOpenDocuments,
    onOpenVehicle,
    onOpenFuel,
    onOpenForms,
    onReleaseUnit,
    isUnitLinked,
    onLinkUnit,
    dvirStatus,
    onRequestReplacement,
    canRequestReplacement = false,
    preTripDefectLockout = false,
    onOpenRental,
    onToggleLocationSharing,
    onLogout,
    onSyncNow,
    onRetryCommand,
    onDiscardCommand,
    onAcceptServerState,
    onRetryNewVersion,
    onReportDelay,
    weather,
    isLoadingWeather = false,
    weatherError,
    onRefreshWeather,
    apiClient,
    pushNotificationsEnabled,
    onRequestPushPermissions,
    onOpenProfile,
    onOpenAccountSettings,
    lastSuccessfulSyncAt,
    isAuthenticated = true,
    onRecaptureAttachment,
}) => {
    const { isDarkHud, theme } = useTheme();
    const [delayModalJob, setDelayModalJob] = useState<DispatchJob | null>(
        null,
    );
    const [profileSheetOpen, setProfileSheetOpen] = useState(false);
    const [notificationsSheetOpen, setNotificationsSheetOpen] = useState(false);
    const [outboxSheetOpen, setOutboxSheetOpen] = useState(false);
    const [signOutConfirmationOpen, setSignOutConfirmationOpen] =
        useState(false);
    const [dispatchIntakeOpen, setDispatchIntakeOpen] = useState(false);
    const [onSiteConfirmationOpen, setOnSiteConfirmationOpen] = useState(false);
    const [reliefHandoverOpen, setReliefHandoverOpen] = useState(false);
    const [reliefHandoverMode, setReliefHandoverMode] = useState<
        'outgoing_offer' | 'incoming_claim'
    >('outgoing_offer');
    const [replacementOpen, setReplacementOpen] = useState(false);
    const [replacementRequested, setReplacementRequested] = useState(false);
    const [defectFallbackModalOpen, setDefectFallbackModalOpen] =
        useState(false);
    const [isLinkedLocal, setIsLinkedLocal] = useState<boolean>(
        isUnitLinked ?? false,
    );
    const [localDvirStatus, setLocalDvirStatus] = useState<
        DvirReadinessStatus | 'passed' | undefined
    >(dvirStatus);
    const [localDefectLockout, setLocalDefectLockout] = useState<
        boolean | null
    >(null);
    const [activeNavItem, setActiveNavItem] = useState<FieldScreen>('today');

    const [prevProps, setPrevProps] = useState({
        isUnitLinked,
        dvirStatus,
        preTripDefectLockout,
    });

    if (
        isUnitLinked !== prevProps.isUnitLinked ||
        dvirStatus !== prevProps.dvirStatus ||
        preTripDefectLockout !== prevProps.preTripDefectLockout
    ) {
        setPrevProps({ isUnitLinked, dvirStatus, preTripDefectLockout });

        if (isUnitLinked !== undefined) {
            setIsLinkedLocal(isUnitLinked);
        }

        if (dvirStatus !== undefined) {
            setLocalDvirStatus(dvirStatus);
        }

        if (preTripDefectLockout !== undefined) {
            setLocalDefectLockout(preTripDefectLockout);
        }
    }

    const projection = useMemo(
        () =>
            projectOutbox(
                outboxCommands,
                isOnline,
                isAuthenticated,
                undefined,
                lastSuccessfulSyncAt,
            ),
        [outboxCommands, isOnline, isAuthenticated, lastSuccessfulSyncAt],
    );

    const queuedCount = outboxCommands.filter(
        (command) => command.state === 'queued',
    ).length;
    const syncingCount = outboxCommands.filter(
        (command) => command.state === 'syncing',
    ).length;
    const failedCount = outboxCommands.filter(
        (command) =>
            command.state === 'failed' || command.state === 'unresolved',
    ).length;
    const conflictCount = outboxCommands.filter(
        (command) => command.state === 'conflict',
    ).length;
    const failedCommands = outboxCommands.filter(
        (command) =>
            command.state === 'failed' || command.state === 'unresolved',
    );

    // Home works only with live jobs; finished ones belong to Dispatch history.
    const jobs = useMemo(() => activeJobs(allJobs), [allJobs]);
    const pendingResponseCount = jobs.filter(
        (job) => job.my_assignment?.response_status === 'pending',
    ).length;
    const syncAttentionCount = failedCount + conflictCount;
    // The bell counts only items for the operator from other people; sync
    // problems are shown once, in the status pill.
    const totalNotificationCount = pendingResponseCount;
    const hasOutboxActivity =
        syncAttentionCount > 0 || queuedCount > 0 || syncingCount > 0;

    const syncGuidance = projection.syncGuidance;
    const syncStatusLabel = projection.headerPill.label;
    const syncStatusMessage = projection.headerPill.message;
    const syncTone: SyncTone = projection.headerPill.tone;

    const [overriddenDutyStatus, setOverriddenDutyStatus] = useState<{
        propStatus?: DutyStatus;
        localStatus: DutyStatus;
    } | null>(null);

    const currentDuty: DutyStatus =
        overriddenDutyStatus &&
        overriddenDutyStatus.propStatus === shiftInfo.dutyStatus
            ? overriddenDutyStatus.localStatus
            : (shiftInfo.dutyStatus ?? 'operating');

    // Duty categories have their own colours; brand gold is never a duty.
    const getDutyColor = (duty: DutyStatus): string => {
        switch (duty) {
            case 'operating':
                return theme.dutyOnDuty;
            case 'driving':
                return theme.dutyDriving;
            case 'standby':
                return theme.dutyStandby;
            case 'on_break':
                return theme.successEmerald;
            default:
                return theme.textSecondary;
        }
    };

    const getDutyLabel = (duty: DutyStatus): string => {
        switch (duty) {
            case 'operating':
                return 'On Duty — Crane Operating';
            case 'driving':
                return 'On Duty — Driving / Transit';
            case 'standby':
                return 'On Duty — Standby / Delay';
            case 'on_break':
                return 'On Break — Rest Period';
            case 'off_duty':
                return 'Off Duty — Shift Complete';
            default:
                return 'On Duty';
        }
    };

    const getDutyBadge = (duty: DutyStatus): string => {
        switch (duty) {
            case 'operating':
                return 'OPR';
            case 'driving':
                return 'DRV';
            case 'standby':
                return 'SBY';
            case 'on_break':
                return 'BRK';
            case 'off_duty':
                return 'OFF';
            default:
                return 'ON';
        }
    };

    // Primary Active Vehicle & Dispatch
    const activeJob = jobs[0] || null;
    const primaryAsset = activeJob?.asset_assignments?.[0] || null;
    // The real unit code, or empty. Callbacks and guards only ever see this.
    const assetCode = primaryAsset?.asset_code || '';
    const effectiveAssetCode = assetCode;
    // Display text only; never sent anywhere as a unit code.
    const unitLabel = assetCode || (activeJob ? 'Assigned unit' : 'No unit');
    const isLinked = isUnitLinked !== undefined ? isUnitLinked : isLinkedLocal;
    // No job and no linked unit: the shift has no unit at all.
    const hasNoUnit = !activeJob && !isLinked;
    const openReliefClaim = () => {
        setReliefHandoverMode('incoming_claim');
        setReliefHandoverOpen(true);
    };
    const currentDvirStatus =
        dvirStatus !== undefined ? dvirStatus : localDvirStatus;
    const isDefectLockout =
        localDefectLockout !== null
            ? localDefectLockout
            : preTripDefectLockout || currentDvirStatus === 'defect';
    const hosCompliance = useHosCompliance(shiftInfo);
    const isDoleWarning = hosCompliance.isDoleWarning;
    const isDoleCapExceeded = hosCompliance.isDoleCapExceeded;
    // One honest line under the duty status: no shift, the DOLE counter,
    // or that the server hasn't sent totals yet.
    const dutySummary =
        currentDuty === 'off_duty'
            ? 'No shift running'
            : hosCompliance.limitCounterHours === null
              ? 'Waiting for server totals'
              : `${formatHoursMinutes(hosCompliance.limitCounterHours)} of ${DOLE_CAP_HOURS}h operating + driving`;

    // Only a claim the server accepted links the unit on this phone.
    const handleHandoverClaimed = (claim: EquipmentHandoverClaimResponse) => {
        setIsLinkedLocal(true);
        onLinkUnit?.(claim.asset_code);
        onRefresh?.();
    };

    // Launcher tiles are navigation, not status: identity is icon + label, and
    // state appears only as a badge (Docs/design/mobile.md, Home screen tiles).
    const DASHBOARD_TILES: TileItem[] = useMemo(
        () => [
            {
                id: 'fuel',
                title: 'Fuel',
                sublabel: 'Requests & Logs',
                iconName: 'fuel',
            },
            {
                id: 'hos',
                title: 'Hours of\nService',
                sublabel: 'Shift & Hours',
                iconName: 'clock',
            },
            {
                id: 'dvir',
                title: 'Vehicle\nInspection',
                sublabel: 'Pre & Post Trip',
                iconName: 'clipboard',
            },
            {
                id: 'documents',
                title: 'Documents',
                sublabel: 'Permits & Certs',
                iconName: 'document',
            },
            {
                id: 'vehicle',
                title: 'Machine\nProfile',
                sublabel: 'Specs & readiness',
                iconName: 'crane',
            },
            {
                id: 'forms',
                title: 'Dispatch',
                sublabel: 'Intake & Orders',
                iconName: 'file-text',
                // Only jobs waiting for the operator's reply, the same
                // count as the Respond tab; read aloud as "N pending".
                badgeCount:
                    pendingResponseCount > 0 ? pendingResponseCount : undefined,
            },
            {
                id: 'rental',
                title: 'Rental\nHandover',
                sublabel: 'Check-in / Out',
                iconName: 'truck',
            },
        ],
        [pendingResponseCount],
    );

    // Lifecycle actions lead the grid; Fuel is a full-width tile below it.
    const GRID_TILE_IDS: TileId[] = [
        'hos',
        'dvir',
        'forms',
        'documents',
        'vehicle',
        'rental',
    ];
    const tileById = (id: TileId): TileItem =>
        DASHBOARD_TILES.find((tile) => tile.id === id)!;
    const gridTiles = GRID_TILE_IDS.map(tileById);
    const fuelTile = tileById('fuel');

    const handleTilePress = (tileId: TileItem['id']) => {
        switch (tileId) {
            case 'fuel':
                onOpenFuel?.();
                break;
            case 'hos':
                onOpenHos?.();

                break;
            case 'dvir':
                onOpenDvir?.('pre_trip');
                break;
            case 'documents':
                onOpenDocuments?.();
                break;
            case 'vehicle':
                onOpenVehicle?.();
                break;
            case 'forms':
                setDispatchIntakeOpen(true);
                onOpenForms?.();
                break;
            case 'rental':
                onOpenRental?.();
                break;
        }
    };

    const handleOpenProfile = () => {
        if (onOpenProfile) {
            onOpenProfile();

            return;
        }

        if (onOpenAccountSettings) {
            onOpenAccountSettings();

            return;
        }

        setProfileSheetOpen(true);
        setSignOutConfirmationOpen(false);
        setActiveNavItem('profile');
    };

    const handleCloseProfile = (nextItem: FieldScreen = 'today') => {
        setProfileSheetOpen(false);
        setSignOutConfirmationOpen(false);
        setActiveNavItem(nextItem);
    };

    const handleStartSignOut = () => {
        setSignOutConfirmationOpen(true);
    };

    const handleCancelSignOut = () => {
        setSignOutConfirmationOpen(false);
    };

    const handleLogout = () => {
        handleCloseProfile();

        if (onLogout) {
            onLogout();
        }
    };

    const handleOpenNotifications = () => {
        setNotificationsSheetOpen(true);
    };

    const handleNavSelect = (item: FieldNavItem) => {
        if (item === 'profile') {
            handleOpenProfile();

            return;
        }

        if (item === 'documents') {
            onOpenDocuments?.();

            return;
        }

        if (item === 'safety') {
            onOpenSafety?.();

            return;
        }

        handleCloseProfile(item);
    };

    return (
        <View style={[styles.screenRoot, isDarkHud && styles.darkScreenRoot]}>
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        colors={[colors.primary]}
                        onRefresh={onRefresh}
                        refreshing={isLoading}
                        tintColor={colors.amber}
                    />
                }
                style={styles.scrollView}
                testID="refresh-control"
            >
                <FieldHeader
                    isOnline={isOnline}
                    notificationCount={totalNotificationCount}
                    onOpenNotifications={handleOpenNotifications}
                    onOpenProfile={handleOpenProfile}
                    onOpenSyncSheet={() => setOutboxSheetOpen(true)}
                    profileOpen={profileSheetOpen}
                    syncStatusLabel={syncStatusLabel}
                    syncStatusMessage={syncStatusMessage}
                    syncTone={syncTone}
                    userName={userName}
                    userRole={userRole}
                />

                {locationTrackingError ? (
                    <View
                        accessibilityRole="alert"
                        style={[
                            styles.errorBox,
                            isDarkHud && styles.darkErrorBox,
                        ]}
                        testID="location-tracking-error"
                    >
                        <Icon
                            color={isDarkHud ? '#FCA5A5' : colors.red}
                            name="alert"
                            size={16}
                        />
                        <Text
                            style={[
                                styles.errorText,
                                isDarkHud && styles.darkErrorText,
                            ]}
                        >
                            {locationTrackingError}
                        </Text>
                    </View>
                ) : null}

                {/* DOLE 4.5-Hour Continuous Operation Rest Prompter Banner */}
                {hosCompliance.breakSuggestion ? (
                    <View
                        accessibilityRole="alert"
                        style={[
                            styles.doleContinuousRestBanner,
                            hosCompliance.isContinuousRestRequired &&
                                styles.doleContinuousRestRequiredBanner,
                            isDarkHud && styles.darkDoleContinuousRestBanner,
                        ]}
                        testID="dole-continuous-rest-banner"
                    >
                        <View style={styles.doleContinuousRestContent}>
                            <View style={styles.doleContinuousRestHeader}>
                                <Icon
                                    color={
                                        hosCompliance.isContinuousRestRequired
                                            ? isDarkHud
                                                ? '#F59E0B'
                                                : '#B45309'
                                            : isDarkHud
                                              ? '#38BDF8'
                                              : '#0284C7'
                                    }
                                    name="clock"
                                    size={18}
                                />
                                <Text
                                    style={[
                                        styles.doleContinuousRestTitle,
                                        isDarkHud &&
                                            styles.darkDoleContinuousRestTitle,
                                    ]}
                                >
                                    {hosCompliance.breakSuggestion.title}
                                </Text>
                                <View
                                    style={[
                                        styles.continuousPill,
                                        isDarkHud && styles.darkContinuousPill,
                                    ]}
                                    testID="dole-continuous-counter-pill"
                                >
                                    <Text
                                        style={[
                                            styles.continuousPillText,
                                            isDarkHud &&
                                                styles.darkContinuousPillText,
                                        ]}
                                    >
                                        {hosCompliance.continuousCounterLabel}
                                    </Text>
                                </View>
                            </View>
                            <Text
                                style={[
                                    styles.doleContinuousRestMessage,
                                    isDarkHud &&
                                        styles.darkDoleContinuousRestMessage,
                                ]}
                            >
                                {hosCompliance.breakSuggestion.message}
                            </Text>
                        </View>
                        <Pressable
                            accessibilityLabel={
                                hosCompliance.breakSuggestion.actionLabel
                            }
                            accessibilityRole="button"
                            onPress={() => {
                                if (onChangeDutyStatus) {
                                    onChangeDutyStatus('on_break');
                                } else {
                                    onOpenHos?.();
                                }
                            }}
                            style={({ pressed }) => [
                                styles.doleContinuousRestBtn,
                                isDarkHud && styles.darkDoleContinuousRestBtn,
                                pressed && styles.pressed,
                            ]}
                            testID="dole-continuous-break-btn"
                        >
                            <Text
                                style={[
                                    styles.doleContinuousRestBtnText,
                                    isDarkHud &&
                                        styles.darkDoleContinuousRestBtnText,
                                ]}
                            >
                                {hosCompliance.breakSuggestion.actionLabel}
                            </Text>
                        </Pressable>
                    </View>
                ) : null}

                {/* DOLE 10-Hour Shift Limit Compliance Warning / Hard Stop Banner */}
                {isDoleWarning || isDoleCapExceeded ? (
                    <View
                        accessibilityRole="alert"
                        style={[
                            styles.doleWarningBanner,
                            isDoleCapExceeded && styles.doleCapBanner,
                            isDarkHud && styles.darkDoleWarningBanner,
                        ]}
                        testID="dole-shift-limit-banner"
                    >
                        <View style={styles.doleWarningContent}>
                            <Icon
                                color={
                                    isDoleCapExceeded
                                        ? '#EF4444'
                                        : colors.warning
                                }
                                name="alert"
                                size={18}
                            />
                            <Text
                                style={[
                                    styles.doleWarningText,
                                    isDoleCapExceeded && styles.doleCapText,
                                    isDarkHud && styles.darkDoleWarningText,
                                ]}
                            >
                                {isDoleCapExceeded
                                    ? '10h Maximum Operating Cap Exceeded — Mandatory Rest Period.'
                                    : 'Approaching 10h Operating Limit — Prepare for Handover or Shift Closure.'}
                            </Text>
                        </View>
                        <Pressable
                            accessibilityLabel="Initiate handover to relief crew"
                            accessibilityRole="button"
                            onPress={() => setReliefHandoverOpen(true)}
                            style={({ pressed }) => [
                                styles.doleHandoverBtn,
                                pressed && styles.pressed,
                            ]}
                            testID="dole-handover-trigger-btn"
                        >
                            <Text style={styles.doleHandoverBtnText}>
                                Relief Handover
                            </Text>
                        </Pressable>
                    </View>
                ) : null}

                {/* Real-time Location Weather Telemetry Card */}
                <LocationWeatherCard
                    canUseCurrentLocation={Boolean(isUnitLinked)}
                    error={weatherError}
                    isLoading={isLoadingWeather}
                    onRefresh={onRefreshWeather}
                    weather={weather}
                />

                {/* Samsara-Style Persistent Duty Status Bar */}
                <Pressable
                    accessibilityHint="Opens Hours of Service"
                    accessibilityLabel={`Duty status: ${getDutyLabel(currentDuty)}, ${dutySummary}`}
                    accessibilityRole="button"
                    onPress={() => onOpenHos?.()}
                    style={({ pressed }) => [
                        styles.dutyStatusBar,
                        isDarkHud && styles.darkDutyStatusBar,
                        pressed && styles.pressed,
                    ]}
                    testID="hero-duty-status-bar"
                >
                    <View style={styles.dutyLeftRow}>
                        <View
                            style={[
                                styles.dutyBadge,
                                { backgroundColor: getDutyColor(currentDuty) },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.dutyBadgeText,
                                    { color: theme.textInverse },
                                ]}
                            >
                                {getDutyBadge(currentDuty)}
                            </Text>
                        </View>
                        <View style={styles.dutyStatusCopy}>
                            <Text
                                style={[
                                    styles.dutyStatusTitle,
                                    isDarkHud && styles.darkDutyStatusTitle,
                                ]}
                            >
                                {getDutyLabel(currentDuty)}
                            </Text>
                            <Text
                                style={[
                                    styles.dutyStatusElapsed,
                                    isDarkHud && styles.darkDutyStatusElapsed,
                                ]}
                            >
                                {dutySummary}
                            </Text>
                        </View>
                    </View>
                    <Icon
                        name="chevron-right"
                        size={18}
                        color={isDarkHud ? '#64748B' : colors.muted}
                    />
                </Pressable>

                {/* Assigned Vehicle & Rigging Hero Card */}
                {hasNoUnit && !isDefectLockout ? (
                    <NoUnitCard onClaimRelief={openReliefClaim} />
                ) : (
                    <AssetVehicleCard
                        activeJob={activeJob}
                        assetCode={effectiveAssetCode}
                        assetKind={primaryAsset?.asset_kind || 'mobile_crane'}
                        assetName={
                            primaryAsset?.asset_name ||
                            (activeJob
                                ? 'Assigned Unit'
                                : 'No Vehicle Assigned')
                        }
                        attachments={
                            primaryAsset?.attachments &&
                            primaryAsset.attachments.length > 0
                                ? primaryAsset.attachments
                                : []
                        }
                        dispatchPrefix="Ref: "
                        dvirStatus={
                            isDefectLockout
                                ? 'defect'
                                : currentDvirStatus === 'cleared' ||
                                    currentDvirStatus === 'passed'
                                  ? 'cleared'
                                  : 'pending'
                        }
                        engineHours={
                            primaryAsset?.engine_hours
                                ? `${primaryAsset.engine_hours.toLocaleString()} hrs`
                                : '-- hrs'
                        }
                        onPress={onOpenVehicle}
                        ratedCapacity={primaryAsset?.rated_capacity || '--'}
                        variant="hero"
                        latestDelay={primaryAsset?.latest_delay}
                    />
                )}

                {/* Dynamic Button Transition on Link / DVIR Lifecycle */}
                {isDefectLockout ? (
                    /* State 4: Defect Malfunction Fallback */
                    <View
                        style={[
                            styles.defectLockoutBanner,
                            isDarkHud && styles.darkDefectLockoutBanner,
                        ]}
                        testID="pre-trip-defect-lockout-banner"
                    >
                        <Pressable
                            accessibilityLabel="View safety lockout fallback details"
                            accessibilityRole="button"
                            onPress={() => setDefectFallbackModalOpen(true)}
                            style={styles.defectLockoutHeaderRow}
                            testID="view-defect-lockout-details-btn"
                        >
                            <View style={styles.defectLockoutBadge}>
                                <Icon color="#FFFFFF" name="alert" size={14} />
                                <Text style={styles.defectLockoutBadgeText}>
                                    SAFETY LOCKOUT
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.defectUnitCode,
                                    isDarkHud && styles.darkDefectUnitCode,
                                ]}
                            >
                                {unitLabel}
                            </Text>
                        </Pressable>
                        <Text
                            style={[
                                styles.defectLockoutNotice,
                                isDarkHud && styles.darkDefectLockoutNotice,
                            ]}
                        >
                            {replacementRequested
                                ? 'Replacement requested. You stay on this unit until dispatch reassigns your job.'
                                : 'Your pre-trip inspection reported a defect. You remain On Duty.'}
                        </Text>
                        <View style={styles.fallbackActionsRow}>
                            <Pressable
                                accessibilityLabel="Ask dispatch for a replacement unit"
                                accessibilityRole="button"
                                onPress={() => setReplacementOpen(true)}
                                style={({ pressed }) => [
                                    styles.fallbackSwapBtn,
                                    isDarkHud && styles.darkFallbackSwapBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="home-request-replacement-btn"
                            >
                                <Icon
                                    color="#FFFFFF"
                                    name="message"
                                    size={14}
                                />
                                <Text style={styles.fallbackSwapBtnText}>
                                    Ask for replacement
                                </Text>
                            </Pressable>
                            <Pressable
                                accessibilityLabel="Switch to standby and await dispatch"
                                accessibilityRole="button"
                                onPress={() => {
                                    setOverriddenDutyStatus({
                                        propStatus: shiftInfo.dutyStatus,
                                        localStatus: 'standby',
                                    });
                                    onChangeDutyStatus?.(
                                        'standby',
                                        'inspection_hold',
                                        'Pre-trip DVIR defect lockout',
                                    );
                                }}
                                style={({ pressed }) => [
                                    styles.fallbackStandbyBtn,
                                    isDarkHud && styles.darkFallbackStandbyBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="fallback-standby-btn"
                            >
                                <Icon
                                    color={isDarkHud ? '#FFBF00' : '#806000'}
                                    name="clock"
                                    size={14}
                                />
                                <Text
                                    style={[
                                        styles.fallbackStandbyBtnText,
                                        isDarkHud &&
                                            styles.darkFallbackStandbyBtnText,
                                    ]}
                                >
                                    Standby / Await Dispatch
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                ) : !isLinked ? (
                    /* State 1: When Unlinked */
                    jobs.length === 0 ? (
                        // With no unit the NoUnitCard above already offers the
                        // relief claim; a swapped-in unit still needs it here.
                        hasNoUnit ? null : (
                            <View style={styles.unlinkedUnitBlock}>
                                <ReliefClaimButton
                                    assetCode={effectiveAssetCode}
                                    onPress={openReliefClaim}
                                />
                            </View>
                        )
                    ) : (
                        <View style={styles.unlinkedUnitBlock}>
                            <Pressable
                                accessibilityLabel={`I'm On Site — Start Unit for ${unitLabel}`}
                                accessibilityRole="button"
                                onPress={() => setOnSiteConfirmationOpen(true)}
                                style={({ pressed }) => [
                                    styles.startUnitBtn,
                                    isDarkHud && styles.darkStartUnitBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="start-unit-on-site-btn"
                            >
                                <Text
                                    style={[
                                        styles.startUnitBtnText,
                                        isDarkHud &&
                                            styles.darkStartUnitBtnText,
                                    ]}
                                >
                                    I'm On Site — Start Unit ({unitLabel})
                                </Text>
                            </Pressable>

                            <ReliefClaimButton
                                assetCode={effectiveAssetCode}
                                onPress={openReliefClaim}
                            />
                        </View>
                    )
                ) : currentDvirStatus === 'cleared' ||
                  currentDvirStatus === 'passed' ? (
                    /* State 3: When Linked & Pre-Trip DVIR is Passed */
                    <View
                        style={[
                            styles.operatingModeContainer,
                            isDarkHud && styles.darkOperatingModeContainer,
                        ]}
                        testID="operating-mode-container"
                    >
                        <View style={styles.operatingStatusRow}>
                            <View style={styles.operatingBadge}>
                                <View style={styles.pulseDot} />
                                <Text style={styles.operatingBadgeText}>
                                    UNIT IN SERVICE · ACTIVE
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.operatingUnitCode,
                                    isDarkHud && styles.darkOperatingUnitCode,
                                ]}
                            >
                                {unitLabel}
                            </Text>
                        </View>
                        <View style={styles.quickActionsRow}>
                            <Pressable
                                accessibilityLabel={
                                    locationSharingActive
                                        ? 'Pause Telemetry'
                                        : 'Resume Telemetry'
                                }
                                accessibilityRole="button"
                                onPress={onToggleLocationSharing}
                                style={({ pressed }) => [
                                    styles.quickActionBtn,
                                    isDarkHud && styles.darkQuickActionBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="quick-action-pause-telemetry-btn"
                            >
                                <Icon
                                    color={
                                        locationSharingActive
                                            ? isDarkHud
                                                ? '#FFBF00'
                                                : '#806000'
                                            : isDarkHud
                                              ? '#10B981'
                                              : '#059669'
                                    }
                                    name="location"
                                    size={14}
                                />
                                <Text
                                    style={[
                                        styles.quickActionBtnText,
                                        isDarkHud &&
                                            styles.darkQuickActionBtnText,
                                    ]}
                                >
                                    {locationSharingActive
                                        ? 'Pause Telemetry'
                                        : 'Resume Telemetry'}
                                </Text>
                            </Pressable>
                            <Pressable
                                accessibilityLabel="Post-Trip DVIR"
                                accessibilityRole="button"
                                onPress={() =>
                                    onOpenDvir
                                        ? onOpenDvir('post_trip')
                                        : undefined
                                }
                                style={({ pressed }) => [
                                    styles.quickActionBtn,
                                    isDarkHud && styles.darkQuickActionBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="quick-action-post-trip-dvir-btn"
                            >
                                <Icon
                                    color={isDarkHud ? '#A78BFA' : '#7C3AED'}
                                    name="clipboard"
                                    size={14}
                                />
                                <Text
                                    style={[
                                        styles.quickActionBtnText,
                                        isDarkHud &&
                                            styles.darkQuickActionBtnText,
                                        {
                                            color: isDarkHud
                                                ? '#C4B5FD'
                                                : '#6D28D9',
                                        },
                                    ]}
                                >
                                    Post-Trip DVIR
                                </Text>
                            </Pressable>
                            <Pressable
                                accessibilityLabel={`Release Unit ${unitLabel}`}
                                accessibilityRole="button"
                                onPress={() => {
                                    setIsLinkedLocal(false);
                                    onReleaseUnit?.(effectiveAssetCode);
                                }}
                                style={({ pressed }) => [
                                    styles.quickActionBtn,
                                    isDarkHud && styles.darkQuickActionBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="quick-action-release-unit-btn"
                            >
                                <Icon
                                    color={isDarkHud ? '#EF4444' : '#DC2626'}
                                    name="shield-check"
                                    size={14}
                                />
                                <Text
                                    style={[
                                        styles.quickActionBtnText,
                                        isDarkHud &&
                                            styles.darkQuickActionBtnText,
                                        {
                                            color: isDarkHud
                                                ? '#EF4444'
                                                : '#DC2626',
                                        },
                                    ]}
                                >
                                    Release Unit
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                ) : (
                    /* State 2: When Linked & Pre-Trip DVIR is Pending */
                    <View
                        style={[
                            styles.dvirPendingBanner,
                            isDarkHud && styles.darkDvirPendingBanner,
                        ]}
                        testID="dvir-pending-banner"
                    >
                        <View style={styles.dvirPendingHeaderRow}>
                            <View
                                style={[
                                    styles.dvirPendingBadge,
                                    isDarkHud && styles.darkDvirPendingBadge,
                                ]}
                            >
                                <Icon
                                    color={isDarkHud ? '#FFBF00' : '#806000'}
                                    name="alert-circle"
                                    size={14}
                                />
                                <Text
                                    style={[
                                        styles.dvirPendingBadgeText,
                                        isDarkHud &&
                                            styles.darkDvirPendingBadgeText,
                                    ]}
                                >
                                    PRE-TRIP PENDING
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.dvirPendingUnitCode,
                                    isDarkHud && styles.darkDvirPendingUnitCode,
                                ]}
                            >
                                {unitLabel}
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.dvirPendingNotice,
                                isDarkHud && styles.darkDvirPendingNotice,
                            ]}
                        >
                            Pre-trip walkaround inspection is required before
                            operation.
                        </Text>
                        <Pressable
                            accessibilityLabel={`Start Pre-Trip DVIR Inspection for ${unitLabel}`}
                            accessibilityRole="button"
                            onPress={() => onOpenDvir?.('pre_trip')}
                            style={({ pressed }) => [
                                styles.startPreTripBtn,
                                isDarkHud && styles.darkStartPreTripBtn,
                                pressed && styles.pressed,
                            ]}
                            testID="start-pre-trip-dvir-btn"
                        >
                            <Icon color="#FFFFFF" name="file-text" size={16} />
                            <Text style={styles.startPreTripBtnText}>
                                Start Pre-Trip DVIR Inspection
                            </Text>
                        </Pressable>
                    </View>
                )}

                <HomeTileGrid
                    onPressTile={handleTilePress}
                    tiles={gridTiles}
                    wideTile={fuelTile}
                />

                {activeNavItem === 'today' || activeNavItem === 'profile' ? (
                    <>
                        <AssignmentSummaryCard
                            isLoading={isLoading}
                            jobs={jobs}
                            onOpenJob={(job) => {
                                onSelectJob?.(job.id);
                                setDispatchIntakeOpen(true);
                            }}
                            onViewOrders={() => setDispatchIntakeOpen(true)}
                        />

                        {/* Hidden/accessible outbox container to keep the main Today dashboard clean */}
                        <View style={styles.accessibleOutbox}>
                            <SyncStatusPanel
                                conflictCount={conflictCount}
                                failedCount={failedCount}
                                isOnline={isOnline}
                                onOpenDetails={() => setOutboxSheetOpen(true)}
                                onSyncNow={onSyncNow}
                                queuedCount={queuedCount}
                                showDetails={hasOutboxActivity}
                                syncGuidance={syncGuidance}
                                syncingCount={syncingCount}
                            />

                            <FailedCommandsList
                                failedCommands={failedCommands}
                                onDiscardCommand={onDiscardCommand}
                                onRetryCommand={onRetryCommand}
                            />
                        </View>

                        {error && isOnline !== false && !isFetchError(error) ? (
                            <View style={styles.errorBox}>
                                <Icon
                                    name="alert"
                                    size={16}
                                    color={colors.red}
                                />
                                <Text
                                    accessible
                                    accessibilityLiveRegion="assertive"
                                    accessibilityRole="alert"
                                    style={styles.errorText}
                                >
                                    {error}
                                </Text>
                            </View>
                        ) : null}
                    </>
                ) : null}
            </ScrollView>

            <FieldBottomNav
                activeItem={activeNavItem}
                onSosHoldComplete={onSosHoldComplete}
                sosDisabled={sosDisabled}
                onSelect={handleNavSelect}
            />

            {/* Dispatch Focused Assignment Intake Sheet */}
            <DispatchIntakeSheet
                apiClient={apiClient}
                conflictedCommands={outboxCommands.filter(
                    (command) => command.state === 'conflict',
                )}
                jobs={allJobs}
                onAcceptAssignment={onAcceptAssignment}
                onAcceptServerState={onAcceptServerState}
                onClose={() => setDispatchIntakeOpen(false)}
                onRejectAssignment={onRejectAssignment}
                onReportDelay={(jobToDelay) => {
                    setDispatchIntakeOpen(false);
                    setDelayModalJob(jobToDelay);
                }}
                onRetryNewVersion={onRetryNewVersion}
                onSelectJob={(jobId) => {
                    onSelectJob?.(jobId);
                    setDispatchIntakeOpen(false);
                }}
                onTransitionStatus={onTransitionStatus}
                visible={dispatchIntakeOpen}
            />

            <NotificationsSheet
                includeSyncItems={false}
                conflictCount={conflictCount}
                failedCommands={failedCommands}
                failedCount={failedCount}
                isOnline={isOnline}
                onAcceptJob={(jobId) => {
                    const targetJob = allJobs.find((j) => j.id === jobId);

                    if (targetJob?.my_assignment?.id && onAcceptAssignment) {
                        onAcceptAssignment(
                            targetJob.id,
                            targetJob.my_assignment.id,
                            targetJob.version,
                        );
                    } else {
                        onSelectJob?.(jobId);
                    }

                    setNotificationsSheetOpen(false);
                }}
                onClose={() => setNotificationsSheetOpen(false)}
                onDeclineJob={(jobId) => {
                    const targetJob = allJobs.find((j) => j.id === jobId);

                    if (targetJob?.my_assignment?.id && onRejectAssignment) {
                        const defaultReason =
                            'Declined by mobile operator via notifications';

                        if (
                            Platform.OS === 'ios' &&
                            process.env.NODE_ENV !== 'test' &&
                            typeof Alert !== 'undefined' &&
                            typeof Alert.prompt === 'function'
                        ) {
                            Alert.prompt(
                                'Decline Assignment',
                                `Specify reason for declining ${targetJob.reference}:`,
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Decline',
                                        style: 'destructive',
                                        onPress: (reason?: string) => {
                                            onRejectAssignment(
                                                targetJob.id,
                                                targetJob.my_assignment!.id,
                                                reason?.trim() || defaultReason,
                                                targetJob.version,
                                            );
                                            setNotificationsSheetOpen(false);
                                        },
                                    },
                                ],
                                'plain-text',
                                defaultReason,
                            );

                            return;
                        }

                        onRejectAssignment(
                            targetJob.id,
                            targetJob.my_assignment.id,
                            defaultReason,
                            targetJob.version,
                        );
                    }

                    setNotificationsSheetOpen(false);
                }}
                onDiscardCommand={onDiscardCommand}
                onRetryCommand={onRetryCommand}
                onSyncNow={onSyncNow}
                pendingJobs={jobs.filter(
                    (j) => j.my_assignment?.response_status === 'pending',
                )}
                pendingResponseCount={pendingResponseCount}
                queuedCount={queuedCount}
                visible={notificationsSheetOpen}
            />

            <ProfileSheet
                assignedAssetLabel={
                    jobs.flatMap((j) => j.asset_assignments || [])[0]
                        ?.asset_name || null
                }
                isAuthenticated={isAuthenticated}
                isOnline={isOnline}
                onCancelSignOut={handleCancelSignOut}
                onClose={() => handleCloseProfile()}
                onLogout={handleLogout}
                onOpenAccountSettings={onOpenAccountSettings || onOpenProfile}
                onOpenOutboxDetails={() => setOutboxSheetOpen(true)}
                onRequestPushPermissions={onRequestPushPermissions}
                onStartSignOut={handleStartSignOut}
                onSyncNow={onSyncNow}
                outboxCommands={outboxCommands}
                pushNotificationsEnabled={pushNotificationsEnabled}
                queuedCount={queuedCount}
                signOutConfirmationOpen={signOutConfirmationOpen}
                userName={userName}
                userRole={userRole}
                visible={profileSheetOpen}
            />

            <OutboxStatusSheet
                commands={outboxCommands}
                isAuthenticated={isAuthenticated}
                isOnline={isOnline}
                lastSuccessfulSyncAt={lastSuccessfulSyncAt}
                onAcceptServerState={onAcceptServerState}
                onClose={() => setOutboxSheetOpen(false)}
                onDiscardCommand={onDiscardCommand}
                onRecaptureAttachment={onRecaptureAttachment}
                onRetryCommand={onRetryCommand}
                onRetryNewVersion={onRetryNewVersion}
                onSignIn={onLogout}
                onSyncNow={onSyncNow}
                userName={userName}
                userRole={userRole}
                visible={outboxSheetOpen}
            />

            {/* On-Site Confirmation Modal */}
            <OnSiteConfirmationModal
                assetCode={effectiveAssetCode || undefined}
                onCancel={() => setOnSiteConfirmationOpen(false)}
                onConfirm={() => {
                    setOnSiteConfirmationOpen(false);
                    setIsLinkedLocal(true);
                    onLinkUnit?.(effectiveAssetCode);

                    if (onToggleLocationSharing && !locationSharingActive) {
                        onToggleLocationSharing();
                    }
                }}
                visible={onSiteConfirmationOpen}
            />

            {/* Smart Dual Hot-Seating Relief Handover Modal */}
            <ReliefHandoverModal
                apiClient={apiClient}
                assetCode={effectiveAssetCode}
                isOnline={isOnline}
                jobId={activeJob?.id ?? null}
                mode={reliefHandoverMode}
                onClaimed={handleHandoverClaimed}
                onClose={() => setReliefHandoverOpen(false)}
                visible={reliefHandoverOpen}
            />

            <ReplacementRequestSheet
                assetCode={effectiveAssetCode}
                canSend={canRequestReplacement}
                onClose={() => setReplacementOpen(false)}
                onSend={(note) => {
                    setDefectFallbackModalOpen(false);
                    setReplacementRequested(true);
                    onRequestReplacement?.(note);
                }}
                visible={replacementOpen}
            />

            {/* Pre-Trip Defect Fallback Modal */}
            <PreTripDefectFallbackModal
                assetCode={effectiveAssetCode || undefined}
                onClose={() => setDefectFallbackModalOpen(false)}
                onStandby={() => {
                    setDefectFallbackModalOpen(false);
                    setOverriddenDutyStatus({
                        propStatus: shiftInfo.dutyStatus,
                        localStatus: 'standby',
                    });
                    onChangeDutyStatus?.(
                        'standby',
                        'inspection_hold',
                        'Pre-trip DVIR defect lockout',
                    );
                }}
                onRequestReplacement={() => {
                    setDefectFallbackModalOpen(false);
                    setReplacementOpen(true);
                }}
                visible={defectFallbackModalOpen}
            />

            {/* Operational Delay Reporting Modal */}
            {delayModalJob ? (
                <ReportDelayModal
                    job={delayModalJob}
                    onClose={() => setDelayModalJob(null)}
                    onNavigateDvir={onOpenDvir}
                    onSubmit={async (payload) => {
                        await onReportDelay?.(delayModalJob.id, payload);
                        setDelayModalJob(null);
                    }}
                    visible={!!delayModalJob}
                />
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    screenRoot: {
        backgroundColor: colors.background,
        flex: 1,
    },
    darkScreenRoot: {
        backgroundColor: '#090D16',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        alignSelf: 'center',
        maxWidth: 720,
        padding: 16,
        paddingBottom: 20,
        width: '100%',
    },
    dutyStatusBar: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 14,
        borderWidth: 1.5,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        marginBottom: 12,
        minHeight: 52,
        paddingHorizontal: 14,
        paddingVertical: 10,
        ...shadows.sm,
    },
    darkDutyStatusBar: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    dutyLeftRow: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: 12,
    },
    dutyBadge: {
        alignItems: 'center',
        borderRadius: 6,
        height: 26,
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    lightDutyBadge: {
        backgroundColor: '#22C55E',
    },
    darkDutyBadge: {
        backgroundColor: '#22C55E',
    },
    dutyBadgeText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    lightDutyBadgeText: {
        color: '#0F172A',
        fontWeight: '900',
    },
    darkDutyBadgeText: {
        color: '#0F172A',
        fontWeight: '900',
    },
    dutyStatusCopy: {
        flex: 1,
    },
    dutyStatusTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    darkDutyStatusTitle: {
        color: '#F8FAFC',
    },
    dutyStatusElapsed: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '600',
    },
    darkDutyStatusElapsed: {
        color: '#94A3B8',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    errorBox: {
        alignItems: 'center',
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
        padding: 12,
    },
    errorText: {
        color: colors.red,
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    darkErrorBox: {
        backgroundColor: 'rgba(127, 29, 29, 0.28)',
        borderColor: '#7F1D1D',
    },
    darkErrorText: {
        color: '#FCA5A5',
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.985 }],
    },
    doleContinuousRestBanner: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
        borderRadius: 12,
        borderWidth: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 12,
        gap: 10,
        ...shadows.sm,
    },
    doleContinuousRestRequiredBanner: {
        backgroundColor: '#FFFBEB',
        borderColor: '#D97706',
    },
    darkDoleContinuousRestBanner: {
        backgroundColor: '#1E293B',
        borderColor: '#F59E0B',
    },
    doleContinuousRestContent: {
        flex: 1,
        gap: 4,
    },
    doleContinuousRestHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    doleContinuousRestTitle: {
        color: '#92400E',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    darkDoleContinuousRestTitle: {
        color: '#FBBF24',
    },
    continuousPill: {
        backgroundColor: '#FDE68A',
        borderColor: '#F59E0B',
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    darkContinuousPill: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#F59E0B',
    },
    continuousPillText: {
        color: '#78350F',
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: '800',
    },
    darkContinuousPillText: {
        color: '#FDE68A',
    },
    doleContinuousRestMessage: {
        color: '#92400E',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
    },
    darkDoleContinuousRestMessage: {
        color: '#FCD34D',
    },
    doleContinuousRestBtn: {
        backgroundColor: '#D97706',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkDoleContinuousRestBtn: {
        backgroundColor: '#F59E0B',
    },
    doleContinuousRestBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    darkDoleContinuousRestBtnText: {
        color: '#0F172A',
    },
    doleWarningBanner: {
        backgroundColor: colors.warningSoft,
        borderColor: colors.warningBorder,
        borderRadius: 12,
        borderWidth: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 12,
        gap: 10,
        ...shadows.sm,
    },
    doleCapBanner: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
    },
    darkDoleWarningBanner: {
        backgroundColor: '#1E293B',
        borderColor: '#FDBA74',
    },
    doleWarningContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    doleWarningText: {
        color: colors.warningDark,
        fontSize: 12,
        fontWeight: '700',
        flex: 1,
        lineHeight: 16,
    },
    darkDoleWarningText: {
        color: '#FDBA74',
    },
    doleCapText: {
        color: '#991B1B',
    },
    doleHandoverBtn: {
        backgroundColor: '#FFBF00',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    doleHandoverBtnText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    startUnitBtn: {
        alignItems: 'center',
        backgroundColor: '#FFBF00',
        borderRadius: 12,
        elevation: 4,
        justifyContent: 'center',
        marginBottom: 14,
        marginTop: 6,
        paddingHorizontal: 16,
        paddingVertical: 14,
        shadowColor: '#FFBF00',
        shadowOffset: { height: 3, width: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    darkStartUnitBtn: {
        backgroundColor: '#FFBF00',
        elevation: 6,
        shadowColor: '#FFBF00',
        shadowOffset: { height: 4, width: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
    },
    startUnitBtnText: {
        color: '#0F172A',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    darkStartUnitBtnText: {
        color: '#0F172A',
        fontWeight: '900',
    },
    // State 2: DVIR Pending Banner
    dvirPendingBanner: {
        backgroundColor: colors.warningSoft,
        borderColor: colors.warningBorder,
        borderWidth: 1.5,
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        marginTop: 6,
        ...shadows.sm,
    },
    darkDvirPendingBanner: {
        backgroundColor: 'rgba(234, 88, 12, 0.14)',
        borderColor: '#FDBA74',
    },
    dvirPendingHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    dvirPendingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.warningSoft,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    darkDvirPendingBadge: {
        backgroundColor: 'rgba(234, 88, 12, 0.2)',
    },
    dvirPendingBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: colors.warningDark,
        letterSpacing: 0.5,
    },
    darkDvirPendingBadgeText: {
        color: '#FDBA74',
    },
    dvirPendingUnitCode: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.warningDark,
    },
    darkDvirPendingUnitCode: {
        color: '#FDBA74',
    },
    dvirPendingNotice: {
        fontSize: 13,
        lineHeight: 18,
        color: colors.warningDark,
        marginBottom: 12,
    },
    darkDvirPendingNotice: {
        color: '#FDBA74',
    },
    startPreTripBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FFBF00',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 10,
        ...shadows.sm,
    },
    darkStartPreTripBtn: {
        backgroundColor: '#FFBF00',
    },
    startPreTripBtnText: {
        color: '#0F172A',
        fontSize: 15,
        fontWeight: '800',
    },
    // State 3: Operating Mode Container
    operatingModeContainer: {
        backgroundColor: '#F0FDF4',
        borderColor: '#10B981',
        borderWidth: 1.5,
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        marginTop: 6,
        ...shadows.sm,
    },
    darkOperatingModeContainer: {
        backgroundColor: '#064E3B25',
        borderColor: '#059669',
    },
    operatingStatusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    operatingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
    },
    operatingBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#065F46',
        letterSpacing: 0.5,
    },
    operatingUnitCode: {
        fontSize: 13,
        fontWeight: '800',
        color: '#065F46',
    },
    darkOperatingUnitCode: {
        color: '#6EE7B7',
    },
    quickActionsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    quickActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    darkQuickActionBtn: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    quickActionBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    darkQuickActionBtnText: {
        color: '#94A3B8',
    },
    // State 4: Defect Lockout Banner
    defectLockoutBanner: {
        backgroundColor: '#FEF2F2',
        borderColor: '#EF4444',
        borderWidth: 1.5,
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        marginTop: 6,
        ...shadows.sm,
    },
    darkDefectLockoutBanner: {
        backgroundColor: '#451A1A30',
        borderColor: '#DC2626',
    },
    defectLockoutHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    defectLockoutBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#DC2626',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    defectLockoutBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    defectUnitCode: {
        fontSize: 13,
        fontWeight: '800',
        color: '#991B1B',
    },
    darkDefectUnitCode: {
        color: '#F87171',
    },
    defectLockoutNotice: {
        fontSize: 13,
        lineHeight: 18,
        color: '#7F1D1D',
        marginBottom: 12,
    },
    darkDefectLockoutNotice: {
        color: '#FECACA',
    },
    fallbackActionsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    fallbackSwapBtn: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#2563EB',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 8,
        ...shadows.sm,
    },
    darkFallbackSwapBtn: {
        backgroundColor: '#3B82F6',
    },
    fallbackSwapBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    fallbackStandbyBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#FFF3C4',
        borderColor: '#FFBF00',
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    darkFallbackStandbyBtn: {
        backgroundColor: '#33280025',
        borderColor: '#FFBF00',
    },
    fallbackStandbyBtnText: {
        color: '#806000',
        fontSize: 12,
        fontWeight: '700',
    },
    darkFallbackStandbyBtnText: {
        color: '#FFBF00',
    },
    unlinkedUnitBlock: {
        gap: 10,
        marginBottom: 12,
        width: '100%',
    },
    accessibleOutbox: {
        height: 1,
        opacity: 0.01,
        overflow: 'hidden',
    },
    srText: {
        color: 'transparent',
        fontSize: 12,
    },
});
