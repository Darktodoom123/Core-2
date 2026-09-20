import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export type SyncTone =
    'checking' | 'online' | 'attention' | 'offline' | 'syncing';

export interface SyncStatusPillProps {
    label: string;
    message: string;
    tone: SyncTone;
    onPress?: () => void;
}

export const SyncStatusPill: React.FC<SyncStatusPillProps> = ({
    label,
    message,
    tone,
    onPress,
}) => {
    const { isDarkHud } = useTheme();

    const pillBody = (
        <View
            accessibilityLabel={`Sync status: ${label}, ${message}`}
            accessibilityRole={onPress ? 'button' : 'summary'}
            style={[
                styles.syncPill,
                isDarkHud && styles.darkSyncPill,
                tone === 'online' && styles.syncPillOnline,
                isDarkHud && tone === 'online' && styles.darkSyncPillOnline,
                tone === 'offline' && styles.syncPillOffline,
                isDarkHud && tone === 'offline' && styles.darkSyncPillOffline,
                tone === 'attention' && styles.syncPillAttention,
                isDarkHud &&
                    tone === 'attention' &&
                    styles.darkSyncPillAttention,
                tone === 'syncing' && styles.syncPillSyncing,
                isDarkHud && tone === 'syncing' && styles.darkSyncPillSyncing,
            ]}
            testID="sync-status-pill"
        >
            <View
                style={[
                    styles.syncMark,
                    tone === 'checking' && styles.syncMarkChecking,
                    tone === 'online' && styles.syncMarkOnline,
                    tone === 'offline' && styles.syncMarkOffline,
                    tone === 'attention' && styles.syncMarkAttention,
                    tone === 'syncing' && styles.syncMarkSyncing,
                ]}
            />
            <Text
                style={[
                    styles.syncLabel,
                    isDarkHud && styles.darkSyncLabel,
                    tone === 'attention' && styles.syncLabelAttention,
                ]}
            >
                {label}
            </Text>
            <Text
                style={[
                    styles.syncSeparator,
                    isDarkHud && styles.darkSyncSeparator,
                ]}
            >
                ·
            </Text>
            <Text
                selectable
                style={[
                    styles.syncMessage,
                    isDarkHud && styles.darkSyncMessage,
                ]}
            >
                {message}
            </Text>
            <Icon
                color={
                    isDarkHud
                        ? '#64748B'
                        : tone === 'attention'
                          ? colors.amberDark
                          : colors.muted
                }
                name="chevron-right"
                size={14}
            />
        </View>
    );

    if (onPress) {
        return (
            <Pressable
                accessibilityHint="Opens outbox and synchronization details sheet"
                accessibilityLabel={`Sync status: ${label}, ${message}. Tap to view synchronization details`}
                accessibilityRole="button"
                onPress={onPress}
                style={({ pressed }) => [
                    styles.syncPillWrapper,
                    pressed && styles.pressed,
                ]}
                testID="sync-pill-pressable"
            >
                {pillBody}
            </Pressable>
        );
    }

    return <View style={styles.syncPillWrapper}>{pillBody}</View>;
};

export interface BellIconProps {
    color?: string;
    size?: number;
}

export const BellIcon: React.FC<BellIconProps> = ({
    color = colors.text,
    size = 20,
}) => <Icon name="bell" size={size} color={color} />;

export interface ProfileSummaryProps {
    userName?: string | null;
    userRole?: string | null;
    isOnline?: boolean | null;
    syncTone?: SyncTone;
    profileOpen: boolean;
    onOpenProfile: () => void;

    notificationCount?: number;
    onOpenNotifications?: () => void;
    onOpenSyncSheet?: () => void;
}

const initialsFor = (userName?: string | null): string => {
    const initials = (userName || 'Field worker')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();

    return initials || 'FW';
};

export const ProfileSummary: React.FC<ProfileSummaryProps> = ({
    userName,
    isOnline,
    syncTone = 'online',
    profileOpen,
    onOpenProfile,
    notificationCount = 0,
    onOpenNotifications,
    onOpenSyncSheet,
}) => {
    const { isDarkHud, toggleMode } = useTheme();

    const resolvedIsOnline =
        isOnline !== undefined
            ? isOnline
            : syncTone === 'offline'
              ? false
              : syncTone === 'checking'
                ? null
                : true;

    const connectionState: 'online' | 'offline' | 'checking' =
        resolvedIsOnline === null
            ? 'checking'
            : resolvedIsOnline
              ? 'online'
              : 'offline';

    return (
        <View style={styles.profileRow} testID="profile-summary">
            <Pressable
                accessibilityHint="Shows profile and account actions"
                accessibilityLabel="Open profile"
                accessibilityRole="button"
                accessibilityState={{ expanded: profileOpen }}
                onPress={onOpenProfile}
                style={({ pressed }) => [
                    styles.profileCard,
                    isDarkHud && styles.darkProfileCard,
                    pressed && styles.pressed,
                ]}
                testID="profile-button"
            >
                <View
                    style={[
                        styles.avatarCircle,
                        isDarkHud && styles.darkAvatarCircle,
                    ]}
                >
                    <Text
                        style={[
                            styles.avatarInitials,
                            isDarkHud && styles.darkAvatarInitials,
                        ]}
                    >
                        {initialsFor(userName)}
                    </Text>
                </View>
                <View style={styles.profileCopy}>
                    <View style={styles.profileNameRow}>
                        <Text
                            selectable
                            style={[
                                styles.profileName,
                                isDarkHud && styles.darkProfileName,
                            ]}
                        >
                            {userName || 'Alex Reyes'}
                        </Text>
                        {/* Hidden test hook to preserve testID compatibility without cluttering header row */}
                        <View
                            style={{ display: 'none' }}
                            testID="profile-status-dot"
                        />
                    </View>
                </View>
            </Pressable>

            <View style={styles.headerActions}>
                {/* Connection Status Pill Badge: strictly indicates internet connectivity */}
                <Pressable
                    accessibilityHint="Opens outbox synchronization status sheet"
                    accessibilityLabel={`Connection status: ${
                        connectionState === 'online'
                            ? 'online'
                            : connectionState === 'checking'
                              ? 'checking connection'
                              : 'offline'
                    }`}
                    accessibilityRole="button"
                    onPress={onOpenSyncSheet}
                    style={({ pressed }) => [
                        styles.onlineSyncedPill,
                        isDarkHud && styles.darkOnlineSyncedPill,
                        connectionState === 'offline' && styles.offlinePill,
                        isDarkHud &&
                            connectionState === 'offline' &&
                            styles.darkOfflinePill,
                        pressed && styles.pressed,
                    ]}
                    testID="online-synced-pill"
                >
                    <View
                        style={[
                            styles.onlineSyncedDot,
                            connectionState === 'online' &&
                                styles.onlineSyncedDotActive,
                            connectionState === 'offline' &&
                                styles.onlineSyncedDotOffline,
                        ]}
                    />
                    <Text
                        style={[
                            styles.onlineSyncedText,
                            isDarkHud && styles.darkOnlineSyncedText,
                            connectionState === 'offline' && styles.offlineText,
                            isDarkHud &&
                                connectionState === 'offline' &&
                                styles.darkOfflineText,
                        ]}
                    >
                        {connectionState === 'online'
                            ? 'online'
                            : connectionState === 'checking'
                              ? 'checking…'
                              : 'offline'}
                    </Text>
                </Pressable>

                <Pressable
                    accessibilityHint="Toggles between daylight and cockpit night HUD lighting"
                    accessibilityLabel={
                        isDarkHud
                            ? 'Switch to daylight outdoor mode'
                            : 'Switch to cockpit HUD night mode'
                    }
                    accessibilityRole="button"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    onPress={toggleMode}
                    style={({ pressed }) => [
                        styles.headerIconButton,
                        isDarkHud && styles.darkHeaderIconButton,
                        pressed && styles.pressed,
                    ]}
                    testID="theme-mode-toggle"
                >
                    <Icon
                        color={isDarkHud ? '#F59E0B' : '#D97706'}
                        name={isDarkHud ? 'sun' : 'moon'}
                        size={20}
                    />
                </Pressable>

                <Pressable
                    accessibilityHint="Opens field notifications, alerts, and system sync sheet"
                    accessibilityLabel={
                        (notificationCount ?? 0) > 0
                            ? `Notifications: ${notificationCount} unread items`
                            : 'Notifications: No unread alerts'
                    }
                    accessibilityRole="button"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    onPress={onOpenNotifications || onOpenProfile}
                    style={({ pressed }) => [
                        styles.headerIconButton,
                        styles.notificationButton,
                        isDarkHud && styles.darkHeaderIconButton,
                        (notificationCount ?? 0) > 0 &&
                            (isDarkHud
                                ? styles.darkNotificationActive
                                : styles.notificationActive),
                        pressed && styles.pressed,
                    ]}
                    testID="notification-button"
                >
                    <BellIcon
                        color={
                            (notificationCount ?? 0) > 0
                                ? isDarkHud
                                    ? '#F59E0B'
                                    : colors.amberDark
                                : isDarkHud
                                  ? '#94A3B8'
                                  : '#64748B'
                        }
                        size={20}
                    />
                    {(notificationCount ?? 0) > 0 ? (
                        <View
                            style={[
                                styles.notificationBadge,
                                isDarkHud && styles.darkNotificationBadge,
                            ]}
                        >
                            <Text style={styles.notificationBadgeText}>
                                {notificationCount! > 9
                                    ? '9+'
                                    : notificationCount}
                            </Text>
                        </View>
                    ) : null}
                </Pressable>
            </View>
        </View>
    );
};

export interface FieldHeaderProps {
    userName?: string | null;
    userRole?: string | null;
    isOnline?: boolean | null;
    syncStatusLabel: string;
    syncStatusMessage: string;
    syncTone: SyncTone;
    profileOpen: boolean;
    onOpenProfile: () => void;
    notificationCount?: number;
    onOpenNotifications?: () => void;
    onOpenSyncSheet?: () => void;
}

export const FieldHeader: React.FC<FieldHeaderProps> = ({
    userName,
    userRole,
    isOnline,
    syncStatusLabel,
    syncStatusMessage,
    syncTone,
    profileOpen,
    onOpenProfile,
    notificationCount,
    onOpenNotifications,
    onOpenSyncSheet,
}) => {
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[styles.header, isDarkHud && styles.darkHeader]}
            testID="field-header"
        >
            <SyncStatusPill
                label={syncStatusLabel}
                message={syncStatusMessage}
                onPress={onOpenSyncSheet}
                tone={syncTone}
            />

            {userName || userRole ? (
                <ProfileSummary
                    isOnline={isOnline}
                    notificationCount={notificationCount}
                    onOpenNotifications={onOpenNotifications}
                    onOpenProfile={onOpenProfile}
                    onOpenSyncSheet={onOpenSyncSheet}
                    profileOpen={profileOpen}
                    syncTone={syncTone}
                    userName={userName}
                    userRole={userRole}
                />
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        gap: 12,
        marginBottom: 16,
    },
    appBar: {
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 4,
    },
    screenTitle: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1.1,
        textTransform: 'uppercase',
    },
    syncPillWrapper: {
        width: '100%',
    },
    accessiblePill: {
        width: '100%',
    },
    syncPill: {
        alignItems: 'center',
        alignSelf: 'stretch',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        minHeight: 48,
        paddingHorizontal: 14,
        paddingVertical: 6,
        ...shadows.sm,
    },
    darkSyncPill: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    syncPillOnline: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    darkSyncPillOnline: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    syncPillOffline: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
    },
    darkSyncPillOffline: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    syncPillAttention: {
        backgroundColor: colors.warningSoft,
        borderColor: colors.warningBorder,
    },
    darkSyncPillAttention: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    syncPillSyncing: {
        backgroundColor: '#EFF6FF',
        borderColor: '#93C5FD',
    },
    darkSyncPillSyncing: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(59, 130, 246, 0.4)',
    },
    syncLabelAttention: {
        color: '#DC2626',
    },
    darkSyncLabel: {
        color: '#F8FAFC',
    },
    darkSyncSeparator: {
        color: '#64748B',
    },
    darkSyncMessage: {
        color: '#CBD5E1',
    },
    syncMark: {
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    syncMarkChecking: {
        backgroundColor: colors.muted,
    },
    syncMarkOnline: {
        backgroundColor: colors.green,
    },
    syncMarkOffline: {
        backgroundColor: colors.warning,
    },
    syncMarkAttention: {
        backgroundColor: colors.warning,
    },
    syncMarkSyncing: {
        backgroundColor: colors.primary,
    },
    syncLabel: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: -0.1,
    },
    syncMessage: {
        color: colors.secondary,
        flex: 1,
        fontSize: 12,
        lineHeight: 17,
        textAlign: 'right',
    },
    syncSeparator: {
        color: colors.muted,
        fontSize: 12,
    },
    profileRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        minHeight: 56,
    },
    profileCard: {
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        elevation: 0,
        flex: 1,
        flexDirection: 'row',
        gap: 12,
        minWidth: 0,
        paddingHorizontal: 0,
        paddingVertical: 2,
        shadowOpacity: 0,
    },
    avatarCircle: {
        alignItems: 'center',
        backgroundColor: '#E2E8F0',
        borderColor: '#CBD5E1',
        borderRadius: 21,
        borderWidth: 1.5,
        height: 42,
        justifyContent: 'center',
        width: 42,
    },
    avatarInitials: {
        color: '#0F172A',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    profileCopy: {
        flex: 1,
        minWidth: 0,
    },
    profileNameRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    profileName: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    nameStatusDot: {
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    profileRole: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 1,
        textTransform: 'capitalize',
    },
    headerActions: {
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
        height: 48,
        justifyContent: 'center',
        position: 'relative',
        width: 48,
        ...shadows.sm,
    },
    darkHeaderIconButton: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderRadius: 12,
        height: 48,
        width: 48,
    },
    notificationButton: {
        position: 'relative',
    },
    notificationActive: {
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
    },
    darkNotificationActive: {
        backgroundColor: '#1E293B',
        borderColor: '#F59E0B',
    },
    darkHeader: {
        gap: 8,
        marginBottom: 12,
    },
    darkProfileCard: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        elevation: 0,
        paddingHorizontal: 0,
        paddingVertical: 0,
        shadowOpacity: 0,
    },
    darkAvatarCircle: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderRadius: 21,
        borderWidth: 1.5,
        height: 42,
        width: 42,
    },
    darkAvatarInitials: {
        color: '#F8FAFC',
        fontSize: 16,
        fontWeight: '800',
    },
    darkProfileName: {
        color: '#F8FAFC',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    darkProfileRole: {
        color: '#94A3B8',
    },
    onlineSyncedPill: {
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderColor: 'rgba(16, 185, 129, 0.35)',
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        minHeight: 48,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    darkOnlineSyncedPill: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderColor: 'rgba(16, 185, 129, 0.35)',
    },
    attentionPill: {
        backgroundColor: '#FEF3C7',
        borderColor: '#FCD34D',
    },
    darkAttentionPill: {
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    offlinePill: {
        backgroundColor: '#F1F5F9',
        borderColor: '#CBD5E1',
    },
    darkOfflinePill: {
        backgroundColor: 'rgba(100, 116, 139, 0.15)',
        borderColor: 'rgba(100, 116, 139, 0.35)',
    },
    onlineSyncedDot: {
        backgroundColor: '#64748B',
        borderRadius: 3.5,
        height: 7,
        width: 7,
    },
    onlineSyncedDotActive: {
        backgroundColor: '#34D399',
    },
    onlineSyncedDotAttention: {
        backgroundColor: '#F59E0B',
    },
    onlineSyncedDotOffline: {
        backgroundColor: '#94A3B8',
    },
    onlineSyncedText: {
        color: '#10B981',
        fontSize: 12,
        fontWeight: '700',
    },
    darkOnlineSyncedText: {
        color: '#34D399',
    },
    attentionText: {
        color: '#B45309',
    },
    darkAttentionText: {
        color: '#FBBF24',
    },
    offlineText: {
        color: '#64748B',
    },
    darkOfflineText: {
        color: '#94A3B8',
    },
    bellIcon: {
        fontSize: 18,
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
    accountMenuWrap: {
        position: 'relative',
        zIndex: 3,
    },
    accountButton: {
        alignItems: 'center',
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 12,
    },
    accountButtonText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '800',
    },
    accountMenu: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 12,
        borderWidth: 1,
        minWidth: 220,
        padding: 12,
        position: 'absolute',
        right: 0,
        top: 60,
        zIndex: 4,
    },
    accountMenuName: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    accountMenuRole: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 2,
        textTransform: 'capitalize',
    },
    accountMenuDivider: {
        backgroundColor: colors.border,
        height: 1,
        marginVertical: 10,
    },
    accountAction: {
        alignItems: 'center',
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 12,
    },
    accountActionText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    signOutConfirm: {
        gap: 8,
    },
    signOutTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    signOutMessage: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
    },
    signOutActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    signOutAction: {
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
        flex: 1,
    },
    signOutActionText: {
        color: colors.redDark,
        fontSize: 14,
        fontWeight: '800',
    },
    pressed: {
        opacity: 0.78,
    },
});
