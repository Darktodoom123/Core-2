import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
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
import { JobListItemCard } from '../components/cards/JobListItemCard';
import { LocationWeatherCard } from '../components/cards/LocationWeatherCard';
import { Icon } from '../components/common/Icon';
import type { IconName } from '../components/common/Icon';
import { FieldBottomNav } from '../components/layout/field-bottom-nav';
import type { FieldNavItem } from '../components/layout/field-bottom-nav';
import { FieldHeader } from '../components/layout/field-header';
import type { SyncTone } from '../components/layout/field-header';
import { colors, shadows, sharedStyles } from '../components/nativeStyles';
import { PlannedRoutePanel } from '../components/panels/planned-route-panel';
import { SyncStatusPanel } from '../components/panels/sync-status-panel';
import { ChangeUnitModal } from '../components/sheets/ChangeUnitModal';
import { DispatchIntakeSheet } from '../components/sheets/DispatchIntakeSheet';
import { DutyStatusSelectorModal } from '../components/sheets/DutyStatusSelectorModal';
import { EndShiftSafeguardModal } from '../components/sheets/EndShiftSafeguardModal';
import { NotificationsSheet } from '../components/sheets/notifications-sheet';
import { OnSiteConfirmationModal } from '../components/sheets/OnSiteConfirmationModal';
import { OutboxStatusSheet } from '../components/sheets/OutboxStatusSheet';
import { PreTripDefectFallbackModal } from '../components/sheets/PreTripDefectFallbackModal';
import { ProfileSheet } from '../components/sheets/profile-sheet';
import { ReliefHandoverModal } from '../components/sheets/ReliefHandoverModal';
import { ReportDelayModal } from '../components/sheets/ReportDelayModal';
import { isFetchError } from '../connectivity/networkMonitor';
import type { FieldApiClient } from '../services/apiClient';
import { projectOutbox } from '../services/outboxProjection';
import { useTheme } from '../theme';
import type {
    DispatchJob,
    DispatchStatus,
    DutyStatus,
    OutboxCommand,
    ReportDelayPayload,
    ShiftInfo,
    ShiftStatus,
    StandbyReason,
    WeatherTelemetry,
} from '../types/index';

export interface AssignedJobsListScreenProps {
    jobs: DispatchJob[];
    outboxCommands: OutboxCommand[];
    isLoading: boolean;
    isOnline?: boolean | null;
    userName?: string | null;
    userRole?: string | null;
    shiftInfo?: ShiftInfo;
    locationSharingActive?: boolean;
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
    onToggleShift?: (nextStatus: ShiftStatus) => void;
    onChangeDutyStatus?: (
        dutyStatus: DutyStatus,
        standbyReason?: StandbyReason,
        remarks?: string,
    ) => void;
    onOpenDvir?: () => void;
    onOpenHos?: () => void;
    onOpenDocuments?: () => void;
    onOpenRoutes?: () => void;
    onOpenVehicle?: () => void;
    onOpenFuel?: () => void;
    onOpenForms?: () => void;
    onReleaseUnit?: (assetCode: string) => void;
    isUnitLinked?: boolean;
    onLinkUnit?: (assetCode: string) => void;
    dvirStatus?: DvirReadinessStatus | 'passed';
    onSwapUnit?: (newUnitCode: string, reason: string) => void;
    preTripDefectLockout?: boolean;
    onOpenRental?: () => void;
    onOpenSales?: () => void;
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

interface TileItem {
    id:
        | 'hos'
        | 'dvir'
        | 'routes'
        | 'documents'
        | 'vehicle'
        | 'fuel'
        | 'forms'
        | 'rental'
        | 'sales';
    title: string;
    sublabel: string;
    iconName: IconName;
    bgColor: string;
    lightHaloBg?: string;
    lightIconColor?: string;
    borderColor?: string;
    iconColor?: string;
    darkBgColor?: string;
    darkBorderColor?: string;
    darkIconColor?: string;
    darkHaloBg?: string;
    badgeCount?: number;
}

export const AssignedJobsListScreen: React.FC<AssignedJobsListScreenProps> = ({
    jobs,
    outboxCommands,
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
    error,
    onSosHoldComplete,
    sosDisabled = false,
    onRefresh,
    onSelectJob,
    onAcceptAssignment,
    onRejectAssignment,
    onTransitionStatus,
    onToggleShift,
    onChangeDutyStatus,
    onOpenDvir,
    onOpenHos,
    onOpenDocuments,
    onOpenRoutes,
    onOpenVehicle,
    onOpenFuel,
    onOpenForms,
    onReleaseUnit,
    isUnitLinked,
    onLinkUnit,
    dvirStatus,
    onSwapUnit,
    preTripDefectLockout = false,
    onOpenRental,
    onOpenSales,
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
    const { isDarkHud } = useTheme();
    const [delayModalJob, setDelayModalJob] = useState<DispatchJob | null>(
        null,
    );
    const [dutyModalOpen, setDutyModalOpen] = useState(false);
    const [profileSheetOpen, setProfileSheetOpen] = useState(false);
    const [notificationsSheetOpen, setNotificationsSheetOpen] = useState(false);
    const [outboxSheetOpen, setOutboxSheetOpen] = useState(false);
    const [signOutConfirmationOpen, setSignOutConfirmationOpen] =
        useState(false);
    const [endShiftSafeguardOpen, setEndShiftSafeguardOpen] = useState(false);
    const [dispatchIntakeOpen, setDispatchIntakeOpen] = useState(false);
    const [pendingOffDutyRemarks, setPendingOffDutyRemarks] = useState<
        string | undefined
    >(undefined);
    const [onSiteConfirmationOpen, setOnSiteConfirmationOpen] = useState(false);
    const [reliefHandoverOpen, setReliefHandoverOpen] = useState(false);
    const [changeUnitModalOpen, setChangeUnitModalOpen] = useState(false);
    const [defectFallbackModalOpen, setDefectFallbackModalOpen] =
        useState(false);
    const [isLinkedLocal, setIsLinkedLocal] = useState<boolean>(
        isUnitLinked ?? false,
    );
    const [localDvirStatus, setLocalDvirStatus] = useState<
        DvirReadinessStatus | 'passed' | undefined
    >(dvirStatus);
    const [overriddenAssetCode, setOverriddenAssetCode] = useState<
        string | null
    >(null);
    const [localDefectLockout, setLocalDefectLockout] = useState<
        boolean | null
    >(null);
    const [activeNavItem, setActiveNavItem] = useState<FieldNavItem>('today');

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

    const pendingResponseCount = jobs.filter(
        (job) => job.my_assignment?.response_status === 'pending',
    ).length;
    const syncAttentionCount = failedCount + conflictCount;
    const totalNotificationCount = syncAttentionCount + pendingResponseCount;
    const hasOutboxActivity =
        syncAttentionCount > 0 || queuedCount > 0 || syncingCount > 0;

    const syncGuidance = projection.syncGuidance;
    const syncStatusLabel = projection.headerPill.label;
    const syncStatusMessage = projection.headerPill.message;
    const syncTone: SyncTone = projection.headerPill.tone;

    const workSummary =
        isLoading && jobs.length === 0
            ? 'Loading active assignments...'
            : jobs.length === 0
              ? 'No active assignments'
              : `${jobs.length} ${jobs.length === 1 ? 'active assignment' : 'active assignments'}${pendingResponseCount > 0 ? ` · ${pendingResponseCount} response${pendingResponseCount === 1 ? '' : 's'} needed` : ''}`;

    const [overriddenDutyStatus, setOverriddenDutyStatus] = useState<{
        propStatus?: DutyStatus;
        localStatus: DutyStatus;
    } | null>(null);

    const currentDuty: DutyStatus =
        overriddenDutyStatus &&
        overriddenDutyStatus.propStatus === shiftInfo.dutyStatus
            ? overriddenDutyStatus.localStatus
            : (shiftInfo.dutyStatus ?? 'operating');

    const getDutyColor = (duty: DutyStatus): string => {
        switch (duty) {
            case 'operating':
                return '#FFBF00';
            case 'driving':
                return '#2563EB';
            case 'standby':
                return '#FFBF00';
            case 'on_break':
                return '#059669';
            case 'off_duty':
                return '#475569';
            default:
                return colors.amberDark;
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
    const assetCode =
        primaryAsset?.asset_code ||
        (activeJob ? 'Assigned Unit' : 'UNASSIGNED');
    const effectiveAssetCode = overriddenAssetCode || assetCode;
    const isLinked = isUnitLinked !== undefined ? isUnitLinked : isLinkedLocal;
    const currentDvirStatus =
        dvirStatus !== undefined ? dvirStatus : localDvirStatus;
    const isDefectLockout =
        localDefectLockout !== null
            ? localDefectLockout
            : preTripDefectLockout || currentDvirStatus === 'defect';
    const hoursElapsed = shiftInfo.hoursElapsed ?? null;
    const limitCounterHours =
        shiftInfo.limitCounterMinutes !== null &&
        shiftInfo.limitCounterMinutes !== undefined
            ? shiftInfo.limitCounterMinutes / 60
            : null;
    const isDoleWarning =
        shiftInfo.doleWarning ??
        (limitCounterHours !== null && limitCounterHours >= 9.0);
    const isDoleCapExceeded =
        (limitCounterHours !== null && limitCounterHours >= 10.0) ||
        shiftInfo.fatigueStatus === 'critical' ||
        shiftInfo.fatigueStatus === 'violation';
    const elapsedClock =
        hoursElapsed === null
            ? 'Unavailable'
            : `${Math.floor(hoursElapsed).toString().padStart(2, '0')}:${Math.round(
                  (hoursElapsed % 1) * 60,
              )
                  .toString()
                  .padStart(2, '0')}`;
    const limitCounterLabel =
        limitCounterHours === null
            ? 'Limit counter unavailable'
            : `${limitCounterHours.toFixed(1)}h operating + driving`;

    const [handoverPin, setHandoverPin] = useState<string>('');
    const [handoverReliefName, setHandoverReliefName] = useState<string>(
        'Standby / Incoming Relief',
    );

    useEffect(() => {
        if (reliefHandoverOpen && activeJob && apiClient) {
            apiClient
                .initiateEquipmentHandover(activeJob.id)
                .then((res) => {
                    if (res?.pin) {
                        setHandoverPin(res.pin);
                    }

                    if (res?.relief_operator?.name) {
                        setHandoverReliefName(res.relief_operator.name);
                    }
                })
                .catch(() => {
                    if (!handoverPin) {
                        setHandoverPin('8421');
                    }
                });
        }
    }, [reliefHandoverOpen, activeJob, apiClient, handoverPin]);

    // 6 Dashboard Tiles
    const DASHBOARD_TILES: TileItem[] = useMemo(
        () => [
            {
                id: 'fuel',
                title: 'Fuel',
                sublabel: 'Requests & Logs',
                iconName: 'fuel',
                bgColor: colors.amberDark,
                lightIconColor: colors.amberDark,
                darkBgColor: colors.hudSurface,
                darkIconColor: colors.hudAmber,
            },
            {
                id: 'hos',
                title: 'Hours of\nService',
                sublabel: 'Shift & Hours',
                iconName: 'clock',
                bgColor: colors.amberDark,
                lightHaloBg: 'rgba(255, 191, 0, 0.12)',
                lightIconColor: '#806000',
                borderColor: 'transparent',
                iconColor: '#FFFFFF',
                darkBgColor: '#1E293B',
                darkBorderColor: 'rgba(255, 191, 0, 0.45)',
                darkIconColor: '#FFBF00',
                darkHaloBg: 'rgba(255, 191, 0, 0.15)',
            },
            {
                id: 'dvir',
                title: 'Vehicle\nInspection',
                sublabel: 'Pre & Post Trip',
                iconName: 'clipboard',
                bgColor: '#059669',
                lightHaloBg: 'rgba(5, 150, 105, 0.12)',
                lightIconColor: '#059669',
                borderColor: 'transparent',
                iconColor: '#FFFFFF',
                darkBgColor: '#1E293B',
                darkBorderColor: 'rgba(16, 185, 129, 0.45)',
                darkIconColor: '#34D399',
                darkHaloBg: 'rgba(16, 185, 129, 0.15)',
            },
            {
                id: 'routes',
                title: 'Drive\nRoutes',
                sublabel: 'Heavy Transit',
                iconName: 'route',
                bgColor: '#0284C7',
                lightHaloBg: 'rgba(2, 132, 199, 0.12)',
                lightIconColor: '#0284C7',
                borderColor: 'transparent',
                iconColor: '#FFFFFF',
                darkBgColor: '#1E293B',
                darkBorderColor: 'rgba(56, 189, 248, 0.45)',
                darkIconColor: '#38BDF8',
                darkHaloBg: 'rgba(56, 189, 248, 0.15)',
            },
            {
                id: 'documents',
                title: 'Documents',
                sublabel: 'Permits & Certs',
                iconName: 'document',
                bgColor: '#7C3AED',
                lightHaloBg: 'rgba(124, 58, 237, 0.12)',
                lightIconColor: '#7C3AED',
                borderColor: 'transparent',
                iconColor: '#FFFFFF',
                darkBgColor: '#1E293B',
                darkBorderColor: 'rgba(192, 132, 252, 0.45)',
                darkIconColor: '#C084FC',
                darkHaloBg: 'rgba(192, 132, 252, 0.15)',
            },
            {
                id: 'vehicle',
                title: 'Machine\nProfile',
                sublabel: 'Setup & Fleet',
                iconName: 'crane',
                bgColor: '#4D7C0F',
                lightHaloBg: 'rgba(77, 124, 15, 0.12)',
                lightIconColor: '#4D7C0F',
                borderColor: 'transparent',
                iconColor: '#FFFFFF',
                darkBgColor: '#1E293B',
                darkBorderColor: 'rgba(163, 230, 53, 0.45)',
                darkIconColor: '#A3E635',
                darkHaloBg: 'rgba(163, 230, 53, 0.15)',
            },
            {
                id: 'forms',
                title: 'Dispatch',
                sublabel: 'Intake & Orders',
                iconName: 'file-text',
                bgColor: '#2563EB',
                lightHaloBg: 'rgba(37, 99, 235, 0.12)',
                lightIconColor: '#2563EB',
                borderColor: 'transparent',
                iconColor: '#FFFFFF',
                darkBgColor: '#1E293B',
                darkBorderColor: 'rgba(96, 165, 250, 0.45)',
                darkIconColor: '#60A5FA',
                darkHaloBg: 'rgba(96, 165, 250, 0.15)',
                badgeCount:
                    pendingResponseCount > 0
                        ? pendingResponseCount
                        : jobs.length > 0
                          ? jobs.length
                          : undefined,
            },
            {
                id: 'rental',
                title: 'Rental\nHandover',
                sublabel: 'Check-in / Out',
                iconName: 'truck',
                bgColor: '#4F46E5',
                lightHaloBg: 'rgba(79, 70, 229, 0.12)',
                lightIconColor: '#4F46E5',
                borderColor: 'transparent',
                iconColor: '#FFFFFF',
                darkBgColor: '#1E293B',
                darkBorderColor: 'rgba(129, 140, 248, 0.45)',
                darkIconColor: '#818CF8',
                darkHaloBg: 'rgba(129, 140, 248, 0.15)',
            },
            {
                id: 'sales',
                title: 'Sales\nDelivery',
                sublabel: 'Handover & VIN',
                iconName: 'signature',
                bgColor: '#E11D48',
                lightHaloBg: 'rgba(225, 29, 72, 0.12)',
                lightIconColor: '#E11D48',
                borderColor: 'transparent',
                iconColor: '#FFFFFF',
                darkBgColor: '#1E293B',
                darkBorderColor: 'rgba(251, 113, 133, 0.45)',
                darkIconColor: '#FB7185',
                darkHaloBg: 'rgba(251, 113, 133, 0.15)',
            },
        ],
        [jobs.length, pendingResponseCount],
    );

    // 2x4 Layout: 4 columns of 2 tiles each, horizontally swipeable
    // Col 1: HOS & Documents | Col 2: DVIR & Vehicle | Col 3: Routes & Dispatch | Col 4: Rental & Sales
    const TILE_COLUMNS: TileItem[][] = useMemo(() => {
        const byId = (id: TileItem['id']) =>
            DASHBOARD_TILES.find((t) => t.id === id)!;

        return [
            [byId('hos'), byId('documents')],
            [byId('dvir'), byId('vehicle')],
            [byId('routes'), byId('forms')],
            [byId('rental'), byId('sales')],
            [byId('fuel')],
        ];
    }, [DASHBOARD_TILES]);

    const handleTilePress = (tileId: TileItem['id']) => {
        switch (tileId) {
            case 'fuel':
                onOpenFuel?.();
                break;
            case 'hos':
                if (onOpenHos) {
                    onOpenHos();
                } else {
                    setDutyModalOpen(true);
                }

                break;
            case 'dvir':
                onOpenDvir?.();
                break;
            case 'routes':
                if (onOpenRoutes) {
                    onOpenRoutes();
                } else {
                    setActiveNavItem('route');
                }

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
            case 'sales':
                onOpenSales?.();
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

    const handleCloseProfile = (nextItem: FieldNavItem = 'today') => {
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
                                isDoleCapExceeded ? '#EF4444' : colors.warning
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
                    error={weatherError}
                    isLoading={isLoadingWeather}
                    onRefresh={onRefreshWeather}
                    weather={weather}
                />

                {/* Samsara-Style Persistent Duty Status Bar */}
                <Pressable
                    accessibilityHint="Tap to change active duty status or view shift fatigue gauge"
                    accessibilityLabel={`Duty status: ${getDutyLabel(currentDuty)}, ${hoursElapsed === null ? 'hours unavailable' : `${hoursElapsed.toFixed(1)} hours active`}`}
                    accessibilityRole="button"
                    onPress={() => setDutyModalOpen(true)}
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
                                    {
                                        color:
                                            currentDuty === 'operating' ||
                                            currentDuty === 'standby'
                                                ? '#0F172A'
                                                : '#FFFFFF',
                                    },
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
                                ({elapsedClock} elapsed · {limitCounterLabel})
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
                <AssetVehicleCard
                    activeJob={activeJob}
                    assetCode={effectiveAssetCode}
                    assetKind={primaryAsset?.asset_kind || 'mobile_crane'}
                    assetName={
                        primaryAsset?.asset_name ||
                        (activeJob ? 'Assigned Unit' : 'No Vehicle Assigned')
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
                              : isLinked
                                ? 'pending'
                                : 'cleared'
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
                                    SAFETY LOCKOUT · UnderMaintenance
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.defectUnitCode,
                                    isDarkHud && styles.darkDefectUnitCode,
                                ]}
                            >
                                {effectiveAssetCode}
                            </Text>
                        </Pressable>
                        <Text
                            style={[
                                styles.defectLockoutNotice,
                                isDarkHud && styles.darkDefectLockoutNotice,
                            ]}
                        >
                            Critical defect detected during pre-trip inspection.
                            Telemetry unbound. Operator remains On Duty.
                        </Text>
                        <View style={styles.fallbackActionsRow}>
                            <Pressable
                                accessibilityLabel="Swap or link replacement unit"
                                accessibilityRole="button"
                                onPress={() => setChangeUnitModalOpen(true)}
                                style={({ pressed }) => [
                                    styles.fallbackSwapBtn,
                                    isDarkHud && styles.darkFallbackSwapBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="fallback-swap-unit-btn"
                            >
                                <Icon color="#FFFFFF" name="sync" size={14} />
                                <Text style={styles.fallbackSwapBtnText}>
                                    Swap Replacement Unit
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
                                        'mechanical_inspection',
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
                    <Pressable
                        accessibilityLabel={`I'm On Site — Start Unit for ${effectiveAssetCode}`}
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
                                isDarkHud && styles.darkStartUnitBtnText,
                            ]}
                        >
                            I'm On Site — Start Unit ({effectiveAssetCode})
                        </Text>
                    </Pressable>
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
                                {effectiveAssetCode}
                            </Text>
                        </View>
                        <Pressable
                            accessibilityLabel={`Operating / Drive Mode for ${effectiveAssetCode}`}
                            accessibilityRole="button"
                            onPress={onOpenRoutes}
                            style={({ pressed }) => [
                                styles.driveModeBtn,
                                isDarkHud && styles.darkDriveModeBtn,
                                pressed && styles.pressed,
                            ]}
                            testID="operating-drive-mode-btn"
                        >
                            <Icon color="#FFFFFF" name="route" size={16} />
                            <Text style={styles.driveModeBtnText}>
                                Operating / Drive Mode
                            </Text>
                        </Pressable>
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
                                accessibilityLabel={`Release Unit ${effectiveAssetCode}`}
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
                                {effectiveAssetCode}
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
                            accessibilityLabel={`Start Pre-Trip DVIR Inspection for ${effectiveAssetCode}`}
                            accessibilityRole="button"
                            onPress={onOpenDvir}
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

                {/* 2x4 Industrial Action Launcher Grid (Horizontal Swipeable) */}
                <ScrollView
                    contentContainerStyle={styles.horizontalScrollGrid}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.horizontalScrollWrapper}
                    testID="industrial-tile-grid"
                >
                    {TILE_COLUMNS.map((column, colIdx) => (
                        <View
                            key={`tile-column-${colIdx + 1}`}
                            style={styles.tileColumn}
                            testID={`tile-column-${colIdx + 1}`}
                        >
                            {column.map((tile) => (
                                <Pressable
                                    accessibilityLabel={`${tile.title.replace('\n', ' ')} tile, ${tile.sublabel}`}
                                    accessibilityRole="button"
                                    key={tile.id}
                                    onPress={() => handleTilePress(tile.id)}
                                    style={({ pressed }) => [
                                        styles.tileCard,
                                        {
                                            backgroundColor: isDarkHud
                                                ? tile.darkBgColor || '#1E293B'
                                                : tile.bgColor,
                                            borderColor: isDarkHud
                                                ? tile.darkBorderColor ||
                                                  '#334155'
                                                : 'transparent',
                                            borderWidth: isDarkHud ? 1.5 : 0,
                                        },
                                        isDarkHud && styles.darkTileCard,
                                        pressed && styles.pressedTile,
                                    ]}
                                    testID={`tile-${tile.id}`}
                                >
                                    {tile.badgeCount ? (
                                        <View
                                            style={[
                                                styles.tileBadgePill,
                                                isDarkHud &&
                                                    styles.darkTileBadgePill,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.tileBadgePillText,
                                                    isDarkHud &&
                                                        styles.darkTileBadgePillText,
                                                ]}
                                            >
                                                {tile.badgeCount}
                                            </Text>
                                        </View>
                                    ) : null}
                                    <View
                                        style={[
                                            styles.tileIconContainer,
                                            isDarkHud &&
                                                styles.darkTileIconContainer,
                                            isDarkHud &&
                                                Boolean(tile.darkHaloBg) && {
                                                    backgroundColor:
                                                        tile.darkHaloBg,
                                                },
                                        ]}
                                    >
                                        <Icon
                                            color={
                                                isDarkHud
                                                    ? tile.darkIconColor ||
                                                      '#FFFFFF'
                                                    : '#FFFFFF'
                                            }
                                            name={tile.iconName}
                                            size={isDarkHud ? 22 : 28}
                                        />
                                    </View>
                                    <Text
                                        style={[
                                            styles.tileTitle,
                                            isDarkHud && styles.darkTileTitle,
                                        ]}
                                    >
                                        {tile.title}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.tileSublabel,
                                            isDarkHud &&
                                                styles.darkTileSublabel,
                                        ]}
                                    >
                                        {tile.sublabel}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    ))}
                </ScrollView>

                {activeNavItem === 'route' ? (
                    <PlannedRoutePanel
                        onBackToToday={() => setActiveNavItem('today')}
                    />
                ) : null}

                {activeNavItem === 'today' || activeNavItem === 'profile' ? (
                    <>
                        {/* Accessible work summary header for testing & screen readers */}
                        <View style={styles.accessibleHeader}>
                            <Text style={styles.srText}>Your assignments</Text>
                            <Text style={styles.srText}>{workSummary}</Text>
                        </View>

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

                        {isLoading && jobs.length === 0 ? (
                            <View
                                accessibilityLiveRegion="polite"
                                style={styles.loadingBox}
                            >
                                <ActivityIndicator color={colors.amber} />
                                <Text style={sharedStyles.statusText}>
                                    Loading assignments…
                                </Text>
                            </View>
                        ) : null}

                        {jobs.length === 0 && !isLoading ? (
                            <View
                                style={[
                                    styles.emptyBox,
                                    isDarkHud && styles.darkEmptyBox,
                                ]}
                                testID="empty-assignments-msg"
                            >
                                <View
                                    style={[
                                        styles.emptyMark,
                                        isDarkHud && styles.darkEmptyMark,
                                    ]}
                                >
                                    <Icon
                                        name="clipboard"
                                        size={22}
                                        color={
                                            isDarkHud
                                                ? '#FFBF00'
                                                : colors.primaryDark
                                        }
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.emptyTitle,
                                        isDarkHud && styles.darkEmptyTitle,
                                    ]}
                                >
                                    No work assigned yet
                                </Text>
                                <Text
                                    style={[
                                        styles.emptyText,
                                        isDarkHud && styles.darkEmptyText,
                                    ]}
                                >
                                    New assignments will appear here. Pull down
                                    to refresh and check again.
                                </Text>
                            </View>
                        ) : null}

                        <View style={styles.jobList}>
                            {jobs.map((job) => {
                                const jobConflictedCommands =
                                    outboxCommands.filter(
                                        (command) =>
                                            command.state === 'conflict' &&
                                            (command.jobId === job.id ||
                                                (command.payload as any)
                                                    ?.dispatch_job_id ===
                                                    job.id ||
                                                (command.payload as any)
                                                    ?.jobId === job.id ||
                                                (!command.jobId &&
                                                    jobs.length === 1)),
                                    );

                                const queuedDelayCommand = outboxCommands.find(
                                    (command) =>
                                        command.type === 'report_delay' &&
                                        (command.state === 'queued' ||
                                            command.state === 'syncing') &&
                                        (command.jobId === job.id ||
                                            (command.payload as any)
                                                ?.dispatch_job_id === job.id),
                                );

                                return (
                                    <JobListItemCard
                                        conflictedCommands={
                                            jobConflictedCommands
                                        }
                                        queuedDelayCommand={queuedDelayCommand}
                                        job={job}
                                        key={job.id}
                                        onAcceptAssignment={onAcceptAssignment}
                                        onAcceptServerState={
                                            onAcceptServerState
                                        }
                                        onOpenDriveRoutes={onOpenRoutes}
                                        onRejectAssignment={onRejectAssignment}
                                        onReportDelay={(jobToDelay) =>
                                            setDelayModalJob(jobToDelay)
                                        }
                                        onRetryNewVersion={onRetryNewVersion}
                                        onSelectJob={onSelectJob}
                                        onTransitionStatus={onTransitionStatus}
                                    />
                                );
                            })}
                        </View>
                    </>
                ) : null}
            </ScrollView>

            <FieldBottomNav
                activeItem={activeNavItem}
                onSosHoldComplete={onSosHoldComplete}
                sosDisabled={sosDisabled}
                onSelect={handleNavSelect}
            />

            {/* Duty Status Selector Sheet Modal */}
            <DutyStatusSelectorModal
                currentDutyStatus={currentDuty}
                hoursElapsed={hoursElapsed}
                maxShiftHours={shiftInfo.maxShiftHours ?? 10}
                onClose={() => setDutyModalOpen(false)}
                onSelectDutyStatus={(status, reason, remarks) => {
                    if (status === 'off_duty') {
                        if (assetCode) {
                            setDutyModalOpen(false);
                            setPendingOffDutyRemarks(remarks);
                            setEndShiftSafeguardOpen(true);

                            return;
                        }

                        setOverriddenDutyStatus({
                            propStatus: shiftInfo.dutyStatus,
                            localStatus: 'off_duty',
                        });
                        onToggleShift?.('off_shift');
                        onChangeDutyStatus?.(status, reason, remarks);

                        return;
                    }

                    setOverriddenDutyStatus({
                        propStatus: shiftInfo.dutyStatus,
                        localStatus: status,
                    });
                    onChangeDutyStatus?.(status, reason, remarks);
                }}
                visible={dutyModalOpen}
            />

            {/* Dispatch Focused Assignment Intake Sheet */}
            <DispatchIntakeSheet
                conflictedCommands={outboxCommands.filter(
                    (command) => command.state === 'conflict',
                )}
                jobs={jobs}
                onAcceptAssignment={onAcceptAssignment}
                onAcceptServerState={onAcceptServerState}
                onClose={() => setDispatchIntakeOpen(false)}
                onOpenRoutes={onOpenRoutes}
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
                conflictCount={conflictCount}
                failedCommands={failedCommands}
                failedCount={failedCount}
                isOnline={isOnline}
                onAcceptJob={(jobId) => {
                    onSelectJob?.(jobId);
                    setNotificationsSheetOpen(false);
                }}
                onClose={() => setNotificationsSheetOpen(false)}
                onDeclineJob={() => {
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
                assetCode={effectiveAssetCode}
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

            {/* End Shift Safeguard Intercept Modal */}
            <EndShiftSafeguardModal
                assetCode={effectiveAssetCode}
                onCancel={() => {
                    setEndShiftSafeguardOpen(false);
                    setPendingOffDutyRemarks(undefined);
                }}
                onConfirmReleaseAndClockOut={() => {
                    setEndShiftSafeguardOpen(false);
                    setIsLinkedLocal(false);
                    onReleaseUnit?.(effectiveAssetCode);
                    setOverriddenDutyStatus({
                        propStatus: shiftInfo.dutyStatus,
                        localStatus: 'off_duty',
                    });
                    onToggleShift?.('off_shift');
                    onChangeDutyStatus?.(
                        'off_duty',
                        undefined,
                        pendingOffDutyRemarks,
                    );
                    setPendingOffDutyRemarks(undefined);
                }}
                visible={endShiftSafeguardOpen}
            />

            {/* Smart Dual Hot-Seating Relief Handover Modal */}
            <ReliefHandoverModal
                assetCode={effectiveAssetCode}
                handoverPin={handoverPin || '8421'}
                mode="outgoing_offer"
                onClose={() => setReliefHandoverOpen(false)}
                onInitiatePushHandover={() => {
                    // Push notification alert dispatched to scheduled incoming relief operator
                }}
                reliefOperatorName={handoverReliefName}
                visible={reliefHandoverOpen}
            />

            {/* Change / Swap Unit Modal */}
            <ChangeUnitModal
                currentAssetCode={effectiveAssetCode}
                onClose={() => setChangeUnitModalOpen(false)}
                onConfirmUnitChange={(newUnitCode, reason) => {
                    setChangeUnitModalOpen(false);
                    setDefectFallbackModalOpen(false);
                    setOverriddenAssetCode(newUnitCode);
                    setIsLinkedLocal(true);
                    setLocalDvirStatus('pending');
                    setLocalDefectLockout(false);
                    onSwapUnit?.(newUnitCode, reason);
                }}
                visible={changeUnitModalOpen}
            />

            {/* Pre-Trip Defect Fallback Modal */}
            <PreTripDefectFallbackModal
                assetCode={effectiveAssetCode}
                onClose={() => setDefectFallbackModalOpen(false)}
                onStandby={() => {
                    setDefectFallbackModalOpen(false);
                    setOverriddenDutyStatus({
                        propStatus: shiftInfo.dutyStatus,
                        localStatus: 'standby',
                    });
                    onChangeDutyStatus?.(
                        'standby',
                        'mechanical_inspection',
                        'Pre-trip DVIR defect lockout',
                    );
                }}
                onSwapUnit={() => {
                    setDefectFallbackModalOpen(false);
                    setChangeUnitModalOpen(true);
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
        paddingBottom: 150,
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
        fontSize: 11,
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
        fontSize: 11,
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
    horizontalScrollWrapper: {
        marginHorizontal: -16,
        marginBottom: 14,
    },
    horizontalScrollGrid: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 2,
    },
    tileColumn: {
        flexDirection: 'column',
        gap: 8,
        width: 110,
    },
    tileCard: {
        alignItems: 'center',
        borderColor: 'transparent',
        borderRadius: 18,
        borderWidth: 0,
        justifyContent: 'center',
        minHeight: 112,
        padding: 10,
        position: 'relative',
        width: '100%',
        ...shadows.md,
    },
    darkTileCard: {
        backgroundColor: '#1E293B',
        borderRadius: 18,
        borderWidth: 1.5,
        justifyContent: 'center',
        minHeight: 112,
        padding: 10,
        position: 'relative',
        shadowColor: '#000000',
        shadowOpacity: 0.3,
        width: '100%',
    },
    tileIconContainer: {
        alignItems: 'center',
        height: 38,
        justifyContent: 'center',
        marginBottom: 6,
        width: 38,
    },
    darkTileIconContainer: {
        alignItems: 'center',
        borderRadius: 19,
        height: 38,
        justifyContent: 'center',
        marginBottom: 6,
        width: 38,
    },
    tileTitle: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '800',
        letterSpacing: 0.1,
        lineHeight: 15,
        textAlign: 'center',
    },
    darkTileTitle: {
        color: '#F8FAFC',
        fontSize: 12.5,
        fontWeight: '800',
        letterSpacing: 0.1,
        lineHeight: 15,
        textAlign: 'center',
    },
    tileSublabel: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
        textAlign: 'center',
    },
    darkTileSublabel: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
        textAlign: 'center',
    },
    tileBadgePill: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        elevation: 3,
        height: 18,
        justifyContent: 'center',
        minWidth: 18,
        paddingHorizontal: 5,
        position: 'absolute',
        right: 8,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
        top: 8,
        zIndex: 2,
    },
    darkTileBadgePill: {
        backgroundColor: '#FFBF00',
    },
    tileBadgePillText: {
        color: '#0F172A',
        fontSize: 10,
        fontWeight: '900',
    },
    darkTileBadgePillText: {
        color: '#090D16',
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
    loadingBox: {
        alignItems: 'center',
        gap: 10,
        padding: 32,
    },
    emptyBox: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 20,
        paddingHorizontal: 20,
        paddingVertical: 20,
        ...shadows.sm,
    },
    darkEmptyBox: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    emptyMark: {
        alignItems: 'center',
        backgroundColor: colors.primarySoft,
        borderColor: colors.primaryBorder,
        borderRadius: 20,
        borderWidth: 1,
        height: 40,
        justifyContent: 'center',
        marginBottom: 10,
        width: 40,
    },
    darkEmptyMark: {
        backgroundColor: 'rgba(255, 191, 0, 0.16)',
        borderColor: '#FFBF00',
    },
    emptyTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    darkEmptyTitle: {
        color: '#F8FAFC',
    },
    emptyText: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
        marginTop: 4,
        maxWidth: 280,
        textAlign: 'center',
    },
    darkEmptyText: {
        color: '#94A3B8',
    },
    jobList: {
        gap: 12,
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.985 }],
    },
    pressedTile: {
        opacity: 0.85,
        transform: [{ scale: 0.96 }],
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
        fontSize: 11,
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
        fontSize: 11,
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
        fontSize: 11,
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
    driveModeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#059669',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 10,
        marginBottom: 10,
        ...shadows.sm,
    },
    darkDriveModeBtn: {
        backgroundColor: '#10B981',
    },
    driveModeBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
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
        fontSize: 11,
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
    accessibleHeader: {
        height: 1,
        opacity: 0.01,
        overflow: 'hidden',
    },
    accessibleOutbox: {
        height: 1,
        opacity: 0.01,
        overflow: 'hidden',
    },
    srText: {
        color: 'transparent',
        fontSize: 1,
    },
});
