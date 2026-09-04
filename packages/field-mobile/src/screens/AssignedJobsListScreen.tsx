import React, { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { AssetVehicleCard } from '../components/cards/AssetVehicleCard';
import { FailedCommandsList } from '../components/cards/FailedCommandsList';
import { JobListItemCard } from '../components/cards/JobListItemCard';
import { ShiftStatusCard } from '../components/cards/ShiftStatusCard';
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
import { DutyStatusSelectorModal } from '../components/sheets/DutyStatusSelectorModal';
import { EndShiftSafeguardModal } from '../components/sheets/EndShiftSafeguardModal';
import { NotificationsSheet } from '../components/sheets/notifications-sheet';
import { OnSiteConfirmationModal } from '../components/sheets/OnSiteConfirmationModal';
import { ProfileSheet } from '../components/sheets/profile-sheet';
import { ReliefHandoverModal } from '../components/sheets/ReliefHandoverModal';
import { useTheme } from '../theme';
import type {
    DispatchJob,
    DutyStatus,
    OutboxCommand,
    ShiftInfo,
    ShiftStatus,
    StandbyReason,
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
    onSelectJob: (jobId: number) => void;
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
    onToggleLocationSharing?: () => void;
    onLogout?: () => void;
    onSyncNow?: () => void;
    onRetryCommand?: (commandId: string) => void;
    onDiscardCommand?: (commandId: string) => void;
}

interface TileItem {
    id: 'hos' | 'dvir' | 'routes' | 'documents' | 'vehicle' | 'forms';
    title: string;
    sublabel: string;
    iconName: IconName;
    bgColor: string;
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
    onToggleShift,
    onChangeDutyStatus,
    onOpenDvir,
    onOpenHos,
    onOpenDocuments,
    onOpenRoutes,
    onOpenVehicle,
    onToggleLocationSharing,
    onLogout,
    onSyncNow,
    onRetryCommand,
    onDiscardCommand,
}) => {
    const { isDarkHud } = useTheme();
    const [dutyModalOpen, setDutyModalOpen] = useState(false);
    const [profileSheetOpen, setProfileSheetOpen] = useState(false);
    const [notificationsSheetOpen, setNotificationsSheetOpen] = useState(false);
    const [signOutConfirmationOpen, setSignOutConfirmationOpen] =
        useState(false);
    const [changeUnitModalOpen, setChangeUnitModalOpen] = useState(false);
    const [endShiftSafeguardOpen, setEndShiftSafeguardOpen] = useState(false);
    const [onSiteConfirmationOpen, setOnSiteConfirmationOpen] = useState(false);
    const [reliefHandoverOpen, setReliefHandoverOpen] = useState(false);
    const [overriddenUnitCode, setOverriddenUnitCode] = useState<string | null>(
        null,
    );
    const [activeNavItem, setActiveNavItem] = useState<FieldNavItem>('today');
    const { width } = useWindowDimensions();
    const isCompact = width < 600;

    const queuedCount = outboxCommands.filter(
        (command) => command.state === 'queued',
    ).length;
    const syncingCount = outboxCommands.filter(
        (command) => command.state === 'syncing',
    ).length;
    const failedCount = outboxCommands.filter(
        (command) => command.state === 'failed',
    ).length;
    const conflictCount = outboxCommands.filter(
        (command) => command.state === 'conflict',
    ).length;
    const failedCommands = outboxCommands.filter(
        (command) => command.state === 'failed',
    );

    const pendingResponseCount = jobs.filter(
        (job) => job.my_assignment?.response_status === 'pending',
    ).length;
    const syncAttentionCount = failedCount + conflictCount;
    const hasOutboxActivity =
        syncAttentionCount > 0 || queuedCount > 0 || syncingCount > 0;

    const syncGuidance =
        conflictCount > 0
            ? `${conflictCount} saved action${conflictCount === 1 ? '' : 's'} need conflict review.`
            : failedCount > 0
              ? `${failedCount} saved action${failedCount === 1 ? '' : 's'} failed. Retry before leaving the app.`
              : isOnline === false
                ? 'Commands stay on this device until the connection returns.'
                : queuedCount > 0
                  ? `${queuedCount} action${queuedCount === 1 ? '' : 's'} saved on this device and waiting to sync.`
                  : syncingCount > 0
                    ? 'Saved actions are syncing now.'
                    : 'Actions sync automatically when the connection is available.';

    const syncStatusLabel =
        isOnline === null
            ? 'Checking connection'
            : isOnline === false
              ? 'Offline'
              : syncAttentionCount > 0
                ? 'Needs review'
                : queuedCount > 0 || syncingCount > 0
                  ? 'Syncing'
                  : 'Synced';

    const syncStatusMessage =
        isOnline === null
            ? 'Checking…'
            : isOnline === true && !hasOutboxActivity
              ? 'Just now'
              : isOnline === false
                ? 'Reconnect to sync'
                : 'Action needed';

    const syncTone: SyncTone =
        isOnline === null
            ? 'checking'
            : isOnline === false
              ? 'offline'
              : syncAttentionCount > 0
                ? 'attention'
                : 'online';

    const workSummary =
        isLoading && jobs.length === 0
            ? 'Loading active assignments...'
            : jobs.length === 0
              ? 'No active assignments'
              : `${jobs.length} ${jobs.length === 1 ? 'active assignment' : 'active assignments'}${pendingResponseCount > 0 ? ` · ${pendingResponseCount} response${pendingResponseCount === 1 ? '' : 's'} needed` : ''}`;

    const currentDuty: DutyStatus = shiftInfo.dutyStatus ?? 'operating';

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

    // Primary Active Vehicle & Dispatch
    const activeJob = jobs[0] || null;
    const primaryAsset = activeJob?.asset_assignments?.[0] || null;
    const assetCode =
        overriddenUnitCode || primaryAsset?.asset_code || 'CRN-101';
    const hoursElapsed = shiftInfo.hoursElapsed ?? 4;
    const isDoleWarning = hoursElapsed >= 9.0 && hoursElapsed < 10.0;
    const isDoleCapExceeded = hoursElapsed >= 10.0;

    // 6 Dashboard Tiles
    const DASHBOARD_TILES: TileItem[] = [
        {
            id: 'hos',
            title: 'HoS',
            sublabel: 'Shift & Hours',
            iconName: 'clock',
            bgColor: '#2563EB',
        },
        {
            id: 'dvir',
            title: 'DVIR',
            sublabel: 'Pre & Post Trip',
            iconName: 'clipboard',
            bgColor: '#059669',
        },
        {
            id: 'routes',
            title: 'Routes',
            sublabel: 'Heavy Transit',
            iconName: 'route',
            bgColor: '#DC2626',
        },
        {
            id: 'documents',
            title: 'Documents',
            sublabel: 'Permits & Certs',
            iconName: 'document',
            bgColor: '#7E22CE',
        },
        {
            id: 'vehicle',
            title: 'Vehicle',
            sublabel: 'Setup & Fleet',
            iconName: 'crane',
            bgColor: '#D97706',
        },
        {
            id: 'forms',
            title: 'Forms',
            sublabel: `${jobs.length} Dispatches`,
            iconName: 'file-text',
            bgColor: '#0284C7',
            badgeCount: jobs.length > 0 ? jobs.length : undefined,
        },
    ];

    const handleTilePress = (tileId: TileItem['id']) => {
        switch (tileId) {
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
                setActiveNavItem('today');
                break;
        }
    };

    const handleOpenProfile = () => {
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
                        tintColor={colors.primary}
                    />
                }
                style={styles.scrollView}
                testID="refresh-control"
            >
                <FieldHeader
                    notificationCount={syncAttentionCount}
                    onOpenNotifications={handleOpenNotifications}
                    onOpenProfile={handleOpenProfile}
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
                                    isDoleCapExceeded ? '#EF4444' : '#F59E0B'
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
                            style={styles.doleHandoverBtn}
                            testID="dole-handover-trigger-btn"
                        >
                            <Text style={styles.doleHandoverBtnText}>
                                Relief Handover
                            </Text>
                        </Pressable>
                    </View>
                ) : null}

                {/* Samsara-Style Persistent Duty Status Bar */}
                <Pressable
                    accessibilityHint="Tap to change active duty status or view shift fatigue gauge"
                    accessibilityLabel={`Duty status: ${getDutyLabel(currentDuty)}, ${(shiftInfo.hoursElapsed ?? 4).toFixed(1)} hours active`}
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
                            <Text style={styles.dutyBadgeText}>
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
                            <Text style={styles.dutyStatusElapsed}>
                                (
                                {Math.floor(shiftInfo.hoursElapsed ?? 4)
                                    .toString()
                                    .padStart(2, '0')}
                                :
                                {Math.round(
                                    ((shiftInfo.hoursElapsed ?? 4) % 1) * 60,
                                )
                                    .toString()
                                    .padStart(2, '0')}{' '}
                                elapsed · 10h limit)
                            </Text>
                        </View>
                    </View>
                    <Icon
                        name="chevron-right"
                        size={18}
                        color={isDarkHud ? '#94A3B8' : colors.muted}
                    />
                </Pressable>

                {/* Assigned Vehicle & Rigging Hero Card */}
                <AssetVehicleCard
                    activeJob={activeJob}
                    assetCode={assetCode}
                    assetKind={primaryAsset?.asset_kind || 'mobile_crane'}
                    assetName={
                        primaryAsset?.asset_name || 'Liebherr LTM 1050-3.1'
                    }
                    attachments={['20T Counterweight', 'Jib Extension']}
                    dispatchPrefix="Ref: "
                    dvirStatus="cleared"
                    engineHours="4,820 hrs"
                    fuelPercent={82}
                    onChangeUnit={() => setChangeUnitModalOpen(true)}
                    onPress={onOpenVehicle}
                    ratedCapacity="50T All-Terrain"
                />

                {/* On-Site Unit Start Safeguard Button when accepted */}
                {activeJob?.status.value === 'accepted' ||
                activeJob?.my_assignment?.response_status === 'accepted' ? (
                    <Pressable
                        accessibilityLabel={`I'm On Site — Start Unit for ${assetCode}`}
                        accessibilityRole="button"
                        onPress={() => setOnSiteConfirmationOpen(true)}
                        style={styles.startUnitBtn}
                        testID="start-unit-on-site-btn"
                    >
                        <Icon color="#FFFFFF" name="location" size={18} />
                        <Text style={styles.startUnitBtnText}>
                            I'm On Site — Start Unit ({assetCode})
                        </Text>
                    </Pressable>
                ) : null}

                {/* 6-Tile Industrial Launcher Grid */}
                <View
                    style={styles.gridContainer}
                    testID="industrial-tile-grid"
                >
                    {DASHBOARD_TILES.map((tile) => (
                        <Pressable
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
                                    size={30}
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

                <ShiftStatusCard
                    locationSharingActive={locationSharingActive}
                    onToggleLocationSharing={onToggleLocationSharing}
                    onToggleShift={() => {
                        if (shiftInfo.status === 'on_shift' && primaryAsset) {
                            setEndShiftSafeguardOpen(true);
                        } else {
                            onToggleShift?.(
                                shiftInfo.status === 'on_shift'
                                    ? 'on_break'
                                    : 'on_shift',
                            );
                        }
                    }}
                    shiftInfo={shiftInfo}
                />

                {activeNavItem === 'route' ? (
                    <PlannedRoutePanel
                        onBackToToday={() => setActiveNavItem('today')}
                    />
                ) : null}

                {activeNavItem === 'today' || activeNavItem === 'profile' ? (
                    <>
                        <View
                            style={[
                                styles.header,
                                isCompact && styles.headerCompact,
                            ]}
                        >
                            <View style={styles.headerCopy}>
                                <Text style={styles.title}>
                                    Your assignments
                                </Text>
                                <Text style={styles.subtitle}>
                                    {workSummary}
                                </Text>
                            </View>
                        </View>

                        <SyncStatusPanel
                            conflictCount={conflictCount}
                            failedCount={failedCount}
                            isOnline={isOnline}
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

                        {error ? (
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
                                <ActivityIndicator color={colors.primary} />
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
                                        size={28}
                                        color={
                                            isDarkHud
                                                ? '#F59E0B'
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
                            {jobs.map((job) => (
                                <JobListItemCard
                                    job={job}
                                    key={job.id}
                                    onSelectJob={onSelectJob}
                                />
                            ))}
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
                hoursElapsed={shiftInfo.hoursElapsed ?? 4}
                maxShiftHours={shiftInfo.maxShiftHours ?? 10}
                onClose={() => setDutyModalOpen(false)}
                onSelectDutyStatus={(status, reason, remarks) => {
                    onChangeDutyStatus?.(status, reason, remarks);
                }}
                visible={dutyModalOpen}
            />

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
                pendingResponseCount={pendingResponseCount}
                queuedCount={queuedCount}
                visible={notificationsSheetOpen}
            />

            <ProfileSheet
                assignedAssetLabel={
                    jobs.flatMap((j) => j.asset_assignments || [])[0]
                        ?.asset_name || null
                }
                isOnline={isOnline}
                onCancelSignOut={handleCancelSignOut}
                onClose={() => handleCloseProfile()}
                onLogout={handleLogout}
                onStartSignOut={handleStartSignOut}
                onSyncNow={onSyncNow}
                queuedCount={queuedCount}
                signOutConfirmationOpen={signOutConfirmationOpen}
                userName={userName}
                userRole={userRole}
                visible={profileSheetOpen}
            />

            {/* On-Site Confirmation Modal */}
            <OnSiteConfirmationModal
                assetCode={assetCode}
                onCancel={() => setOnSiteConfirmationOpen(false)}
                onConfirm={() => {
                    setOnSiteConfirmationOpen(false);

                    if (onToggleLocationSharing && !locationSharingActive) {
                        onToggleLocationSharing();
                    }
                }}
                visible={onSiteConfirmationOpen}
            />

            {/* End Shift Safeguard Intercept Modal */}
            <EndShiftSafeguardModal
                assetCode={assetCode}
                onCancel={() => setEndShiftSafeguardOpen(false)}
                onConfirmReleaseAndClockOut={() => {
                    setEndShiftSafeguardOpen(false);
                    onToggleShift?.('off_shift');
                    onChangeDutyStatus?.('off_duty');
                }}
                visible={endShiftSafeguardOpen}
            />

            {/* Change Unit Override Modal */}
            <ChangeUnitModal
                currentAssetCode={assetCode}
                onClose={() => setChangeUnitModalOpen(false)}
                onConfirmUnitChange={(newUnitCode) => {
                    setOverriddenUnitCode(newUnitCode);
                    setChangeUnitModalOpen(false);
                }}
                visible={changeUnitModalOpen}
            />

            {/* Smart Dual Hot-Seating Relief Handover Modal */}
            <ReliefHandoverModal
                assetCode={assetCode}
                handoverPin="8421"
                mode="outgoing_offer"
                onClose={() => setReliefHandoverOpen(false)}
                onInitiatePushHandover={() => {
                    // Push notification alert dispatched to scheduled incoming relief operator
                }}
                reliefOperatorName="Carlos Reyes (Night Shift)"
                visible={reliefHandoverOpen}
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
    content: {
        alignSelf: 'center',
        maxWidth: 720,
        padding: 16,
        paddingBottom: 110,
        width: '100%',
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
        minHeight: 54,
        paddingHorizontal: 12,
        paddingVertical: 8,
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
        gap: 10,
    },
    dutyBadge: {
        alignItems: 'center',
        borderRadius: 6,
        height: 26,
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
        fontSize: 13,
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
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    tileCard: {
        alignItems: 'center',
        borderRadius: 14,
        flexBasis: '31%',
        flexGrow: 1,
        justifyContent: 'center',
        minHeight: 88,
        padding: 8,
        ...shadows.sm,
    },
    tileIconContainer: {
        alignItems: 'center',
        height: 32,
        justifyContent: 'center',
        marginBottom: 2,
        width: 32,
    },
    tileTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    tileSublabel: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 9,
        fontWeight: '700',
        marginTop: 1,
        textAlign: 'center',
    },
    tileBadgePill: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        paddingHorizontal: 4,
        paddingVertical: 1,
        position: 'absolute',
        right: -6,
        top: -4,
    },
    tileBadgePillText: {
        color: '#0284C7',
        fontSize: 9,
        fontWeight: '900',
    },
    headerCompact: {
        alignItems: 'stretch',
        flexDirection: 'column',
        gap: 12,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    headerCopy: {
        flex: 1,
        paddingRight: 12,
    },
    title: {
        color: colors.text,
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.4,
        lineHeight: 28,
    },
    subtitle: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 2,
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
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 16,
        paddingHorizontal: 24,
        paddingVertical: 36,
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
        borderRadius: 28,
        borderWidth: 1,
        height: 56,
        justifyContent: 'center',
        marginBottom: 16,
        width: 56,
    },
    darkEmptyMark: {
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
        borderColor: '#F59E0B',
    },
    emptyTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    darkEmptyTitle: {
        color: '#F8FAFC',
    },
    emptyText: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 21,
        marginTop: 6,
        maxWidth: 300,
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
    doleCapBanner: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
    },
    darkDoleWarningBanner: {
        backgroundColor: '#1E293B',
        borderColor: '#D97706',
    },
    doleWarningContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    doleWarningText: {
        color: '#92400E',
        fontSize: 12,
        fontWeight: '700',
        flex: 1,
        lineHeight: 16,
    },
    darkDoleWarningText: {
        color: '#FBBF24',
    },
    doleCapText: {
        color: '#991B1B',
    },
    doleHandoverBtn: {
        backgroundColor: '#D97706',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    doleHandoverBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    startUnitBtn: {
        backgroundColor: '#059669',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 10,
        marginBottom: 14,
        ...shadows.sm,
    },
    startUnitBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
});
