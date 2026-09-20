import React, { useMemo, useState } from 'react';
import {
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { AssetVehicleCard } from '../components/cards/AssetVehicleCard';
import { Icon } from '../components/common/Icon';
import type { IconName } from '../components/common/Icon';
import { FieldBottomNav } from '../components/layout/field-bottom-nav';
import type { FieldNavItem } from '../components/layout/field-bottom-nav';
import { colors, shadows } from '../components/nativeStyles';
import { DispatchIntakeSheet } from '../components/sheets/DispatchIntakeSheet';
import { DutyStatusSelectorModal } from '../components/sheets/DutyStatusSelectorModal';
import { EndShiftSafeguardModal } from '../components/sheets/EndShiftSafeguardModal';
import { NotificationsSheet } from '../components/sheets/notifications-sheet';
import { ProfileSheet } from '../components/sheets/profile-sheet';
import { isFetchError } from '../connectivity/networkMonitor';
import { useTheme } from '../theme';
import type {
    DispatchJob,
    DispatchStatus,
    DutyStatus,
    OutboxCommand,
    ShiftInfo,
    ShiftStatus,
    StandbyReason,
} from '../types/index';

export interface OperatorDashboardScreenProps {
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
    onSelectJob: (jobId: number) => void;
    onOpenDvir: () => void;
    onOpenHos?: () => void;
    onOpenDocuments: () => void;
    onOpenRoutes: () => void;
    onOpenVehicle: () => void;
    onOpenForms?: () => void;
    onOpenRental?: () => void;
    onOpenSales?: () => void;
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
    onReleaseUnit?: (assetCode: string) => void;
    onChangeDutyStatus?: (
        dutyStatus: DutyStatus,
        standbyReason?: StandbyReason,
        remarks?: string,
    ) => void;
    onToggleLocationSharing?: () => void;
    onLogout?: () => void;
    onSyncNow?: () => void;
    onRetryCommand?: (commandId: string) => void;
    onDiscardCommand?: (commandId: string) => void;
    pushNotificationsEnabled?: boolean;
    onRequestPushPermissions?: () => void;
    onOpenProfile?: () => void;
    onOpenAccountSettings?: () => void;
}

interface DashboardTileConfig {
    id:
        | 'hos'
        | 'dvir'
        | 'routes'
        | 'documents'
        | 'vehicle'
        | 'forms'
        | 'rental'
        | 'sales';
    title: string;
    iconName: IconName;
    bgColor: string;
    lightHaloBg?: string;
    lightIconColor?: string;
    badgeCount?: number;
    sublabel: string;
    darkBgColor?: string;
    darkBorderColor?: string;
    darkIconColor?: string;
    darkHaloBg?: string;
}

export const OperatorDashboardScreen: React.FC<
    OperatorDashboardScreenProps
> = ({
    jobs,
    outboxCommands,
    isLoading,
    isOnline = null,
    userName = 'Alex Rivera',
    userRole = 'Certified Crane Operator',
    shiftInfo = {
        status: 'on_shift',
        dutyStatus: 'operating',
        startedAt: '08:00 AM',
        hoursElapsed: 4.5,
    },
    error,
    onSosHoldComplete,
    sosDisabled = false,
    onRefresh,
    onSelectJob,
    onOpenDvir,
    onOpenHos,
    onOpenDocuments,
    onOpenRoutes,
    onOpenVehicle,
    onOpenForms,
    onOpenRental,
    onOpenSales,
    onAcceptAssignment,
    onRejectAssignment,
    onTransitionStatus,
    onToggleShift,
    onReleaseUnit,
    onChangeDutyStatus,
    onLogout,
    onSyncNow,
    onRetryCommand,
    pushNotificationsEnabled = true,
    onRequestPushPermissions,
    onOpenProfile,
    onOpenAccountSettings,
}) => {
    const { isDarkHud } = useTheme();
    const { width } = useWindowDimensions();
    const isTablet = width >= 720;
    const [dutyModalOpen, setDutyModalOpen] = useState(false);
    const [profileSheetOpen, setProfileSheetOpen] = useState(false);
    const [notificationsSheetOpen, setNotificationsSheetOpen] = useState(false);
    const [signOutConfirmationOpen, setSignOutConfirmationOpen] =
        useState(false);
    const [endShiftSafeguardOpen, setEndShiftSafeguardOpen] = useState(false);
    const [dispatchIntakeOpen, setDispatchIntakeOpen] = useState(false);
    const [pendingOffDutyRemarks, setPendingOffDutyRemarks] = useState<
        string | undefined
    >(undefined);
    const [activeNavItem, setActiveNavItem] = useState<FieldNavItem>('today');

    const [overriddenDutyStatus, setOverriddenDutyStatus] = useState<{
        propStatus?: DutyStatus;
        localStatus: DutyStatus;
    } | null>(null);

    const currentDuty: DutyStatus =
        overriddenDutyStatus &&
        overriddenDutyStatus.propStatus === shiftInfo.dutyStatus
            ? overriddenDutyStatus.localStatus
            : (shiftInfo.dutyStatus ?? 'operating');

    // Outbox & Sync Counts
    const queuedCount = outboxCommands.filter(
        (c) => c.state === 'queued',
    ).length;
    const failedCount = outboxCommands.filter(
        (c) => c.state === 'failed' || c.state === 'unresolved',
    ).length;
    const conflictCount = outboxCommands.filter(
        (c) => c.state === 'conflict',
    ).length;
    const syncAttentionCount = failedCount + conflictCount;
    const failedCommands = outboxCommands.filter(
        (c) => c.state === 'failed' || c.state === 'unresolved',
    );
    const pendingResponseCount = jobs.filter(
        (j) => j.my_assignment?.response_status === 'pending',
    ).length;

    // Primary Active Job & Machine
    const activeJob = jobs[0] || null;
    const primaryAsset = activeJob?.asset_assignments?.[0] || null;
    const assetCode = primaryAsset?.asset_code || 'ALB-CRN-050';
    const assetName =
        primaryAsset?.asset_name || '50T Tadano All-Terrain Crane';

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

    const getDutyColor = (duty: DutyStatus): string => {
        switch (duty) {
            case 'operating':
                return '#D97706';
            case 'driving':
                return '#2563EB';
            case 'standby':
                return '#EA580C';
            case 'on_break':
                return '#059669';
            case 'off_duty':
                return '#475569';
            default:
                return colors.amberDark;
        }
    };

    const dutyBadgeText = getDutyBadge(currentDuty);
    const dutyLabel = getDutyLabel(currentDuty);
    const dutyColor = getDutyColor(currentDuty);

    // 6 Dashboard Action Tiles Config
    const DASHBOARD_TILES: DashboardTileConfig[] = useMemo(
        () => [
            {
                id: 'hos',
                title: 'Hours of\nService',
                sublabel: 'Shift & Hours',
                iconName: 'clock',
                bgColor: '#D97706',
                lightHaloBg: 'rgba(217, 119, 6, 0.12)',
                lightIconColor: '#D97706',
                darkBgColor: '#1E293B',
                darkBorderColor: 'rgba(245, 158, 11, 0.45)',
                darkIconColor: '#F59E0B',
                darkHaloBg: 'rgba(245, 158, 11, 0.15)',
            },
            {
                id: 'dvir',
                title: 'Vehicle\nInspection',
                sublabel: 'Pre & Post Trip',
                iconName: 'clipboard',
                bgColor: '#059669',
                lightHaloBg: 'rgba(5, 150, 105, 0.12)',
                lightIconColor: '#059669',
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
    const TILE_COLUMNS: DashboardTileConfig[][] = useMemo(() => {
        const byId = (id: DashboardTileConfig['id']) =>
            DASHBOARD_TILES.find((t) => t.id === id)!;

        return [
            [byId('hos'), byId('documents')],
            [byId('dvir'), byId('vehicle')],
            [byId('routes'), byId('forms')],
            [byId('rental'), byId('sales')],
        ];
    }, [DASHBOARD_TILES]);

    const handleTilePress = (tileId: DashboardTileConfig['id']) => {
        switch (tileId) {
            case 'hos':
                if (onOpenHos) {
                    onOpenHos();
                } else {
                    setDutyModalOpen(true);
                }

                break;
            case 'dvir':
                onOpenDvir();
                break;
            case 'routes':
                onOpenRoutes();
                break;
            case 'documents':
                onOpenDocuments();
                break;
            case 'vehicle':
                onOpenVehicle();
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

    return (
        <View
            style={[styles.screenRoot, isDarkHud && styles.darkScreenRoot]}
            testID="operator-dashboard-screen"
        >
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl
                        colors={[colors.amberDark]}
                        onRefresh={onRefresh}
                        refreshing={isLoading}
                        tintColor={colors.amberDark}
                    />
                }
                style={styles.scrollView}
            >
                {/* 1. Top Identity & Status Header */}
                <View
                    style={[
                        styles.topIdentityBar,
                        isDarkHud && styles.darkTopIdentityBar,
                    ]}
                >
                    <View style={styles.identityCopy}>
                        <Text
                            style={[
                                styles.operatorName,
                                isDarkHud && styles.darkOperatorName,
                            ]}
                        >
                            {(userName || 'ALEX RIVERA').toUpperCase()}
                        </Text>
                        <Text style={styles.operatorRole}>
                            {(userRole || 'CRANE OPERATOR').toUpperCase()} · PH
                        </Text>
                    </View>

                    <View style={styles.topActions}>
                        <Pressable
                            accessibilityHint="Opens field notifications, alerts, and system sync sheet"
                            accessibilityLabel={
                                syncAttentionCount > 0
                                    ? `Notifications: ${syncAttentionCount} unread`
                                    : 'Notifications: No unread alerts'
                            }
                            accessibilityRole="button"
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            onPress={() => setNotificationsSheetOpen(true)}
                            style={({ pressed }) => [
                                styles.headerIconButton,
                                isDarkHud && styles.darkHeaderIconButton,
                                syncAttentionCount > 0 &&
                                    (isDarkHud
                                        ? styles.darkNotificationActive
                                        : styles.notificationActive),
                                pressed && styles.pressed,
                            ]}
                            testID="btn-notifications"
                        >
                            <Icon
                                color={
                                    syncAttentionCount > 0
                                        ? isDarkHud
                                            ? '#F59E0B'
                                            : colors.amberDark
                                        : isDarkHud
                                          ? '#94A3B8'
                                          : colors.text
                                }
                                name="bell"
                                size={20}
                            />
                            {syncAttentionCount > 0 ? (
                                <View
                                    style={[
                                        styles.notificationBadge,
                                        isDarkHud &&
                                            styles.darkNotificationBadge,
                                    ]}
                                >
                                    <Text style={styles.notificationBadgeText}>
                                        {syncAttentionCount > 9
                                            ? '9+'
                                            : syncAttentionCount}
                                    </Text>
                                </View>
                            ) : null}
                        </Pressable>

                        <Pressable
                            accessibilityLabel="Operator settings & sync profile"
                            accessibilityRole="button"
                            onPress={handleOpenProfile}
                            style={({ pressed }) => [
                                styles.headerIconButton,
                                isDarkHud && styles.darkHeaderIconButton,
                                pressed && styles.pressed,
                            ]}
                            testID="btn-profile-settings"
                        >
                            <Icon
                                name="settings"
                                size={20}
                                color={isDarkHud ? '#CBD5E1' : colors.text}
                            />
                        </Pressable>
                    </View>
                </View>

                {/* 2. Persistent Duty Status Bar */}
                <Pressable
                    accessibilityHint="Tap to change active duty status or view shift hours"
                    accessibilityLabel={`Current Duty Status: ${dutyLabel}, ${(shiftInfo.hoursElapsed ?? 4.5).toFixed(1)} hours active`}
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
                                { backgroundColor: dutyColor },
                            ]}
                        >
                            <Text style={styles.dutyBadgeText}>
                                {dutyBadgeText}
                            </Text>
                        </View>
                        <View style={styles.dutyStatusCopy}>
                            <Text
                                style={[
                                    styles.dutyStatusTitle,
                                    isDarkHud && styles.darkDutyStatusTitle,
                                ]}
                            >
                                {dutyLabel}
                            </Text>
                            <Text style={styles.dutyStatusElapsed}>
                                (
                                {Math.floor(shiftInfo.hoursElapsed ?? 4.5)
                                    .toString()
                                    .padStart(2, '0')}
                                :
                                {Math.round(
                                    ((shiftInfo.hoursElapsed ?? 4.5) % 1) * 60,
                                )
                                    .toString()
                                    .padStart(2, '0')}{' '}
                                elapsed · 10h max)
                            </Text>
                        </View>
                    </View>
                    <Icon
                        name="chevron-right"
                        size={18}
                        color={isDarkHud ? '#94A3B8' : colors.muted}
                    />
                </Pressable>

                {/* 3. Assigned Vehicle & Dispatch Context Hero Card */}
                <AssetVehicleCard
                    activeJob={activeJob}
                    assetCode={assetCode}
                    assetKind={primaryAsset?.asset_kind || 'mobile_crane'}
                    assetName={assetName}
                    attachments={['20T Counterweight', 'Jib Extension']}
                    dvirStatus="cleared"
                    engineHours="4,820 hrs"
                    fuelPercent={82}
                    onPress={() => {
                        if (activeJob) {
                            onSelectJob(activeJob.id);
                        } else {
                            onOpenForms?.();
                        }
                    }}
                    ratedCapacity="50T All-Terrain"
                    latestDelay={primaryAsset?.latest_delay}
                />

                {error && isOnline !== false && !isFetchError(error) ? (
                    <View style={styles.errorBox}>
                        <Icon name="alert" size={16} color={colors.red} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {/* 4. 2x4 Industrial Action Launcher Grid (Horizontal Swipeable) */}
                <ScrollView
                    contentContainerStyle={[
                        styles.horizontalScrollGrid,
                        isTablet && styles.horizontalScrollGridTablet,
                    ]}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.horizontalScrollWrapper}
                    testID="industrial-tile-grid"
                >
                    {TILE_COLUMNS.map((column, colIdx) => (
                        <View
                            key={`tile-column-${colIdx + 1}`}
                            style={[
                                styles.tileColumn,
                                isTablet && styles.tileColumnTablet,
                            ]}
                            testID={`tile-column-${colIdx + 1}`}
                        >
                            {column.map((tile) => (
                                <Pressable
                                    accessibilityHint={`Opens ${tile.title.replace('\n', ' ')} workspace`}
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
            </ScrollView>

            {/* Bottom Navigation */}
            <FieldBottomNav
                activeItem={activeNavItem}
                onSosHoldComplete={onSosHoldComplete}
                sosDisabled={sosDisabled}
                onSelect={(item) => {
                    if (item === 'route') {
                        onOpenRoutes();
                    } else if (item === 'profile') {
                        handleOpenProfile();
                    } else {
                        setActiveNavItem('today');
                    }
                }}
            />

            {/* Duty Status Selector Modal */}
            <DutyStatusSelectorModal
                currentDutyStatus={currentDuty}
                hoursElapsed={shiftInfo.hoursElapsed ?? 4.5}
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
                conflictedCommands={outboxCommands?.filter(
                    (command) => command.state === 'conflict',
                )}
                jobs={jobs}
                onAcceptAssignment={onAcceptAssignment}
                onClose={() => setDispatchIntakeOpen(false)}
                onOpenRoutes={onOpenRoutes}
                onRejectAssignment={onRejectAssignment}
                onSelectJob={(jobId) => {
                    onSelectJob(jobId);
                    setDispatchIntakeOpen(false);
                }}
                onTransitionStatus={onTransitionStatus}
                visible={dispatchIntakeOpen}
            />

            {/* End Shift Safeguard Intercept Modal */}
            <EndShiftSafeguardModal
                assetCode={assetCode}
                onCancel={() => {
                    setEndShiftSafeguardOpen(false);
                    setPendingOffDutyRemarks(undefined);
                }}
                onConfirmReleaseAndClockOut={() => {
                    setEndShiftSafeguardOpen(false);
                    onReleaseUnit?.(assetCode);
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

            {/* Notifications & Outbox Sheet */}
            <NotificationsSheet
                conflictCount={conflictCount}
                failedCommands={failedCommands}
                failedCount={failedCount}
                isOnline={isOnline}
                onClose={() => setNotificationsSheetOpen(false)}
                onRetryCommand={onRetryCommand}
                onSyncNow={onSyncNow}
                pendingJobs={jobs.filter(
                    (j) => j.my_assignment?.response_status === 'pending',
                )}
                pendingResponseCount={
                    jobs.filter(
                        (j) => j.my_assignment?.response_status === 'pending',
                    ).length
                }
                queuedCount={queuedCount}
                visible={notificationsSheetOpen}
            />

            {/* Profile & Settings Sheet */}
            <ProfileSheet
                assignedAssetLabel={
                    primaryAsset
                        ? `${primaryAsset.asset_code} · ${primaryAsset.asset_name}`
                        : null
                }
                isOnline={isOnline}
                onCancelSignOut={() => setSignOutConfirmationOpen(false)}
                onClose={() => handleCloseProfile()}
                onLogout={() => {
                    handleCloseProfile();
                    onLogout?.();
                }}
                onStartSignOut={() => setSignOutConfirmationOpen(true)}
                onSyncNow={onSyncNow}
                queuedCount={queuedCount}
                signOutConfirmationOpen={signOutConfirmationOpen}
                userName={userName}
                userRole={userRole}
                visible={profileSheetOpen}
                pushNotificationsEnabled={pushNotificationsEnabled}
                onRequestPushPermissions={onRequestPushPermissions}
                onOpenAccountSettings={onOpenAccountSettings || onOpenProfile}
            />
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
    contentContainer: {
        alignSelf: 'center',
        maxWidth: 720,
        padding: 14,
        paddingBottom: 110,
        width: '100%',
    },
    topIdentityBar: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 2,
    },
    darkTopIdentityBar: {},
    identityCopy: {
        gap: 2,
    },
    operatorName: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    darkOperatorName: {
        color: '#F8FAFC',
    },
    operatorRole: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    topActions: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    headerIconButton: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        height: 40,
        justifyContent: 'center',
        position: 'relative',
        width: 40,
        ...shadows.sm,
    },
    darkHeaderIconButton: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    notificationActive: {
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
    },
    darkNotificationActive: {
        backgroundColor: '#1E293B',
        borderColor: '#F59E0B',
    },
    notificationBadge: {
        alignItems: 'center',
        backgroundColor: colors.red,
        borderColor: '#FFFFFF',
        borderRadius: 9,
        borderWidth: 1.5,
        height: 18,
        justifyContent: 'center',
        minWidth: 18,
        paddingHorizontal: 3,
        position: 'absolute',
        right: -4,
        top: -4,
        ...shadows.sm,
    },
    darkNotificationBadge: {
        borderColor: '#0F172A',
    },
    notificationBadgeText: {
        color: colors.white,
        fontSize: 10,
        fontWeight: '900',
    },
    badgeIndicator: {
        backgroundColor: colors.red,
        borderRadius: 4,
        height: 8,
        position: 'absolute',
        right: 6,
        top: 6,
        width: 8,
    },
    dutyStatusBar: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 14,
        borderWidth: 1.5,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        minHeight: 56,
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
        height: 28,
        justifyContent: 'center',
        width: 36,
    },
    dutyBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.5,
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
        marginTop: 1,
    },
    vehicleCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        gap: 6,
        marginBottom: 14,
        padding: 14,
        ...shadows.sm,
    },
    darkVehicleCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    vehicleCardHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    vehicleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    vehicleCardLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
        minWidth: 84,
    },
    vehicleCardValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    darkVehicleCardValue: {
        color: '#F8FAFC',
    },
    siteAccessRow: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 8,
        flexDirection: 'row',
        gap: 6,
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    siteAccessText: {
        color: colors.text,
        fontSize: 11,
        fontWeight: '700',
    },
    syncStateBadge: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 6,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    syncStateDot: {
        borderRadius: 3,
        height: 6,
        width: 6,
    },
    syncDotOnline: {
        backgroundColor: colors.green,
    },
    syncDotAttention: {
        backgroundColor: colors.amber,
    },
    syncDotOffline: {
        backgroundColor: colors.red,
    },
    syncStateText: {
        color: colors.secondary,
        fontSize: 10,
        fontWeight: '700',
    },
    errorBox: {
        alignItems: 'center',
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        padding: 10,
    },
    errorText: {
        color: colors.red,
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    gridContainerTablet: {
        gap: 14,
    },
    horizontalScrollWrapper: {
        marginHorizontal: -16,
        marginBottom: 14,
    },
    horizontalScrollGrid: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 2,
    },
    horizontalScrollGridTablet: {
        gap: 14,
    },
    tileColumn: {
        flexDirection: 'column',
        gap: 10,
        width: 110,
    },
    tileColumnTablet: {
        gap: 12,
        width: 140,
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
        backgroundColor: '#F59E0B',
    },
    tileBadgePillText: {
        color: '#0F172A',
        fontSize: 10,
        fontWeight: '900',
    },
    darkTileBadgePillText: {
        color: '#090D16',
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.985 }],
    },
    pressedTile: {
        opacity: 0.85,
        transform: [{ scale: 0.96 }],
    },
});
