import React, { useState } from 'react';
import {
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { Icon } from '../components/common/Icon';
import type { IconName } from '../components/common/Icon';
import { FieldBottomNav } from '../components/layout/field-bottom-nav';
import type { FieldNavItem } from '../components/layout/field-bottom-nav';
import { colors, shadows } from '../components/nativeStyles';
import { DutyStatusSelectorModal } from '../components/sheets/DutyStatusSelectorModal';
import { NotificationsSheet } from '../components/sheets/notifications-sheet';
import { ProfileSheet } from '../components/sheets/profile-sheet';
import { useTheme } from '../theme';
import type {
    DispatchJob,
    DutyStatus,
    OutboxCommand,
    ShiftInfo,
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
    onRefresh: () => void;
    onSelectJob: (jobId: number) => void;
    onOpenDvir: () => void;
    onOpenDocuments: () => void;
    onOpenRoutes: () => void;
    onOpenVehicle: () => void;
    onOpenForms: () => void;
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
}

interface DashboardTileConfig {
    id: 'hos' | 'dvir' | 'routes' | 'documents' | 'vehicle' | 'forms';
    title: string;
    iconName: IconName;
    bgColor: string;
    badgeCount?: number;
    sublabel: string;
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
    onRefresh,
    onSelectJob,
    onOpenDvir,
    onOpenDocuments,
    onOpenRoutes,
    onOpenVehicle,
    onOpenForms,
    onChangeDutyStatus,
    onLogout,
    onSyncNow,
    onRetryCommand,
}) => {
    const { isDarkHud } = useTheme();
    const { width } = useWindowDimensions();
    const isTablet = width >= 720;
    const [dutyModalOpen, setDutyModalOpen] = useState(false);
    const [profileSheetOpen, setProfileSheetOpen] = useState(false);
    const [notificationsSheetOpen, setNotificationsSheetOpen] = useState(false);
    const [signOutConfirmationOpen, setSignOutConfirmationOpen] =
        useState(false);
    const [activeNavItem, setActiveNavItem] = useState<FieldNavItem>('today');

    const currentDuty: DutyStatus = shiftInfo.dutyStatus ?? 'operating';

    // Outbox & Sync Counts
    const queuedCount = outboxCommands.filter(
        (c) => c.state === 'queued',
    ).length;
    const failedCount = outboxCommands.filter(
        (c) => c.state === 'failed',
    ).length;
    const conflictCount = outboxCommands.filter(
        (c) => c.state === 'conflict',
    ).length;
    const syncAttentionCount = failedCount + conflictCount;
    const failedCommands = outboxCommands.filter((c) => c.state === 'failed');

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
    const DASHBOARD_TILES: DashboardTileConfig[] = [
        {
            id: 'hos',
            title: 'HoS',
            sublabel: 'Shift & Hours',
            iconName: 'clock',
            bgColor: '#2563EB', // Blue
        },
        {
            id: 'dvir',
            title: 'DVIR',
            sublabel: 'Pre & Post Trip',
            iconName: 'clipboard',
            bgColor: '#059669', // Green
        },
        {
            id: 'routes',
            title: 'Routes',
            sublabel: 'Heavy Transit',
            iconName: 'route',
            bgColor: '#DC2626', // Red
        },
        {
            id: 'documents',
            title: 'Documents',
            sublabel: 'Permits & Certs',
            iconName: 'document',
            bgColor: '#7E22CE', // Purple
        },
        {
            id: 'vehicle',
            title: 'Vehicle',
            sublabel: 'Setup & Fleet',
            iconName: 'crane',
            bgColor: '#D97706', // Yellow / Amber
        },
        {
            id: 'forms',
            title: 'Forms',
            sublabel: `${jobs.length} Dispatches`,
            iconName: 'file-text',
            bgColor: '#0284C7', // Cyan / Blue
            badgeCount: jobs.length > 0 ? jobs.length : undefined,
        },
    ];

    const handleTilePress = (tileId: DashboardTileConfig['id']) => {
        switch (tileId) {
            case 'hos':
                setDutyModalOpen(true);
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
                onOpenForms();
                break;
        }
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
                            accessibilityLabel="Notifications and alerts"
                            accessibilityRole="button"
                            onPress={() => setNotificationsSheetOpen(true)}
                            style={styles.headerIconButton}
                            testID="btn-notifications"
                        >
                            <Icon
                                name="bell"
                                size={20}
                                color={isDarkHud ? '#CBD5E1' : colors.text}
                            />
                            {syncAttentionCount > 0 ? (
                                <View style={styles.badgeIndicator} />
                            ) : null}
                        </Pressable>

                        <Pressable
                            accessibilityLabel="Operator settings & sync profile"
                            accessibilityRole="button"
                            onPress={() => setProfileSheetOpen(true)}
                            style={styles.headerIconButton}
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
                <Pressable
                    accessibilityLabel={`Assigned Asset: ${assetCode}, ${assetName}. Active Dispatch: ${activeJob?.reference || 'None'}`}
                    accessibilityRole="button"
                    onPress={() => {
                        if (activeJob) {
                            onSelectJob(activeJob.id);
                        } else {
                            onOpenForms();
                        }
                    }}
                    style={({ pressed }) => [
                        styles.vehicleCard,
                        isDarkHud && styles.darkVehicleCard,
                        pressed && styles.pressed,
                    ]}
                    testID="hero-vehicle-card"
                >
                    <View style={styles.vehicleCardHeader}>
                        <View style={styles.vehicleRow}>
                            <Text style={styles.vehicleCardLabel}>Vehicle</Text>
                            <Text
                                style={[
                                    styles.vehicleCardValue,
                                    isDarkHud && styles.darkVehicleCardValue,
                                ]}
                            >
                                {assetCode}
                            </Text>
                        </View>

                        <View style={styles.syncStateBadge}>
                            <View
                                style={[
                                    styles.syncStateDot,
                                    isOnline === false
                                        ? styles.syncDotOffline
                                        : syncAttentionCount > 0
                                          ? styles.syncDotAttention
                                          : styles.syncDotOnline,
                                ]}
                            />
                            <Text style={styles.syncStateText}>
                                {isOnline === false
                                    ? 'Offline'
                                    : syncAttentionCount > 0
                                      ? 'Needs Review'
                                      : 'Synced'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.vehicleRow}>
                        <Text style={styles.vehicleCardLabel}>Attachment</Text>
                        <Text
                            style={[
                                styles.vehicleCardValue,
                                isDarkHud && styles.darkVehicleCardValue,
                            ]}
                        >
                            20T Counterweight · Jib Extension
                        </Text>
                    </View>

                    <View style={styles.vehicleRow}>
                        <Text style={styles.vehicleCardLabel}>
                            Shipping IDs
                        </Text>
                        <Text
                            style={[
                                styles.vehicleCardValue,
                                isDarkHud && styles.darkVehicleCardValue,
                            ]}
                        >
                            {activeJob?.reference || 'No Active Dispatch'}
                        </Text>
                    </View>

                    {activeJob ? (
                        <View style={styles.siteAccessRow}>
                            <Icon
                                name="location"
                                size={14}
                                color={colors.amberDark}
                            />
                            <Text
                                numberOfLines={1}
                                style={styles.siteAccessText}
                            >
                                {activeJob.site} — {activeJob.client}
                            </Text>
                        </View>
                    ) : null}
                </Pressable>

                {error ? (
                    <View style={styles.errorBox}>
                        <Icon name="alert" size={16} color={colors.red} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {/* 4. The 6-Tile Industrial Action Grid (2x3 Grid) */}
                <View
                    style={[
                        styles.gridContainer,
                        isTablet && styles.gridContainerTablet,
                    ]}
                    testID="industrial-tile-grid"
                >
                    {DASHBOARD_TILES.map((tile) => (
                        <Pressable
                            accessibilityHint={`Opens ${tile.title} workspace`}
                            accessibilityLabel={`${tile.title} tile, ${tile.sublabel}`}
                            accessibilityRole="button"
                            key={tile.id}
                            onPress={() => handleTilePress(tile.id)}
                            style={({ pressed }) => [
                                styles.tileCard,
                                { backgroundColor: tile.bgColor },
                                pressed && styles.pressedTile,
                            ]}
                            testID={`tile-${tile.id}`}
                        >
                            <View style={styles.tileIconContainer}>
                                <Icon
                                    name={tile.iconName}
                                    size={36}
                                    color="#FFFFFF"
                                />
                                {tile.badgeCount ? (
                                    <View style={styles.tileBadgePill}>
                                        <Text style={styles.tileBadgePillText}>
                                            {tile.badgeCount}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                            <Text style={styles.tileTitle}>{tile.title}</Text>
                            <Text style={styles.tileSublabel}>
                                {tile.sublabel}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </ScrollView>

            {/* Bottom Navigation */}
            <FieldBottomNav
                activeItem={activeNavItem}
                onSelect={(item) => {
                    if (item === 'route') {
                        onOpenRoutes();
                    } else if (item === 'profile') {
                        setProfileSheetOpen(true);
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
                    onChangeDutyStatus?.(status, reason, remarks);
                }}
                visible={dutyModalOpen}
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
                onClose={() => setProfileSheetOpen(false)}
                onLogout={() => {
                    setProfileSheetOpen(false);
                    onLogout?.();
                }}
                onStartSignOut={() => setSignOutConfirmationOpen(true)}
                onSyncNow={onSyncNow}
                queuedCount={queuedCount}
                signOutConfirmationOpen={signOutConfirmationOpen}
                userName={userName}
                userRole={userRole}
                visible={profileSheetOpen}
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
        paddingBottom: 36,
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
        borderRadius: 10,
        borderWidth: 1,
        height: 38,
        justifyContent: 'center',
        width: 38,
        ...shadows.sm,
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
    tileCard: {
        alignItems: 'center',
        borderRadius: 18,
        flexBasis: '31%',
        flexGrow: 1,
        justifyContent: 'center',
        minHeight: 112,
        padding: 12,
        ...shadows.md,
    },
    tileIconContainer: {
        alignItems: 'center',
        height: 44,
        justifyContent: 'center',
        marginBottom: 4,
        width: 44,
    },
    tileTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    tileSublabel: {
        color: 'rgba(255, 255, 255, 0.82)',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
        textAlign: 'center',
    },
    tileBadgePill: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1,
        position: 'absolute',
        right: -6,
        top: -4,
    },
    tileBadgePillText: {
        color: '#0284C7',
        fontSize: 10,
        fontWeight: '900',
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
