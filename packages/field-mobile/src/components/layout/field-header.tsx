import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export type SyncTone = 'checking' | 'online' | 'attention' | 'offline';

export interface SyncStatusPillProps {
    label: string;
    message: string;
    tone: SyncTone;
}

export const SyncStatusPill: React.FC<SyncStatusPillProps> = ({
    label,
    message,
    tone,
}) => (
    <View
        accessibilityLabel={`Sync status: ${label}, ${message}`}
        accessibilityRole="summary"
        style={[
            styles.syncPill,
            tone === 'online' && styles.syncPillOnline,
            tone === 'offline' && styles.syncPillOffline,
            tone === 'attention' && styles.syncPillAttention,
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
            ]}
        />
        <Text style={styles.syncLabel}>{label}</Text>
        <Text style={styles.syncSeparator}>·</Text>
        <Text style={styles.syncMessage} selectable>
            {message}
        </Text>
    </View>
);

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
    syncTone?: SyncTone;
    profileOpen: boolean;
    onOpenProfile: () => void;

    notificationCount?: number;
    onOpenNotifications?: () => void;
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
    userRole,
    syncTone = 'online',
    profileOpen,
    onOpenProfile,
    notificationCount = 0,
    onOpenNotifications,
}) => (
    <View style={styles.profileRow} testID="profile-summary">
        <Pressable
            accessibilityLabel="Open profile"
            accessibilityHint="Shows profile and account actions"
            accessibilityRole="button"
            accessibilityState={{ expanded: profileOpen }}
            onPress={onOpenProfile}
            style={({ pressed }) => [
                styles.profileCard,
                pressed && styles.pressed,
            ]}
            testID="profile-button"
        >
            <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>
                    {initialsFor(userName)}
                </Text>
            </View>
            <View style={styles.profileCopy}>
                <View style={styles.profileNameRow}>
                    <Text style={styles.profileName} selectable>
                        {userName || 'Field worker'}
                    </Text>
                    <View
                        accessibilityLabel={`Status dot: ${syncTone}`}
                        style={[
                            styles.nameStatusDot,
                            syncTone === 'checking' && styles.syncMarkChecking,
                            syncTone === 'online' && styles.syncMarkOnline,
                            syncTone === 'offline' && styles.syncMarkOffline,
                            syncTone === 'attention' &&
                                styles.syncMarkAttention,
                        ]}
                        testID="profile-status-dot"
                    />
                </View>
                <Text style={styles.profileRole}>
                    {userRole || 'Field worker'}
                </Text>
            </View>
        </Pressable>

        <Pressable
            accessibilityLabel={
                notificationCount > 0
                    ? `Notifications: ${notificationCount} unread`
                    : 'Notifications'
            }
            accessibilityHint="Opens field notifications and sync alerts"
            accessibilityRole="button"
            onPress={onOpenNotifications || onOpenProfile}
            style={({ pressed }) => [
                styles.notificationButton,
                pressed && styles.pressed,
            ]}
            testID="notification-button"
        >
            <BellIcon color={colors.amberDark} size={20} />
            {notificationCount > 0 ? (
                <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                        {notificationCount > 9 ? '9+' : notificationCount}
                    </Text>
                </View>
            ) : null}
        </Pressable>
    </View>
);

export interface FieldHeaderProps {
    userName?: string | null;
    userRole?: string | null;
    syncStatusLabel: string;
    syncStatusMessage: string;
    syncTone: SyncTone;
    profileOpen: boolean;
    onOpenProfile: () => void;
    notificationCount?: number;
    onOpenNotifications?: () => void;
}

export const FieldHeader: React.FC<FieldHeaderProps> = ({
    userName,
    userRole,
    syncStatusLabel,
    syncStatusMessage,
    syncTone,
    profileOpen,
    onOpenProfile,
    notificationCount,
    onOpenNotifications,
}) => {
    const [dismissedOnline, setDismissedOnline] = useState<string | null>(null);
    const onlineKey = `${syncStatusLabel}-${syncStatusMessage}`;
    const isPillVisible =
        syncTone !== 'online' || dismissedOnline !== onlineKey;

    useEffect(() => {
        if (syncTone === 'online') {
            const timer = setTimeout(() => {
                setDismissedOnline(onlineKey);
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [syncTone, onlineKey]);

    return (
        <View style={styles.header} testID="field-header">
            {isPillVisible ? (
                <SyncStatusPill
                    label={syncStatusLabel}
                    message={syncStatusMessage}
                    tone={syncTone}
                />
            ) : null}

            {userName || userRole ? (
                <ProfileSummary
                    userName={userName}
                    userRole={userRole}
                    syncTone={syncTone}
                    profileOpen={profileOpen}
                    onOpenProfile={onOpenProfile}
                    notificationCount={notificationCount}
                    onOpenNotifications={onOpenNotifications}
                />
            ) : null}

            <View style={styles.appBar}>
                <Text accessibilityRole="header" style={styles.screenTitle}>
                    TODAY'S WORK
                </Text>
            </View>
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
    syncPill: {
        alignItems: 'center',
        alignSelf: 'stretch',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        minHeight: 40,
        paddingHorizontal: 14,
        paddingVertical: 6,
        ...shadows.sm,
    },
    syncPillOnline: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    syncPillOffline: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
    },
    syncPillAttention: {
        backgroundColor: colors.warningSoft,
        borderColor: colors.warningBorder,
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
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: 12,
        minWidth: 0,
        paddingHorizontal: 12,
        paddingVertical: 10,
        ...shadows.sm,
    },
    avatarCircle: {
        alignItems: 'center',
        backgroundColor: colors.primarySoft,
        borderColor: colors.primaryBorder,
        borderRadius: 22,
        borderWidth: 1,
        height: 44,
        justifyContent: 'center',
        width: 44,
    },
    avatarInitials: {
        color: colors.primaryDark,
        fontSize: 14,
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
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.2,
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
    notificationButton: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        height: 48,
        justifyContent: 'center',
        position: 'relative',
        width: 48,
        ...shadows.sm,
    },
    bellIcon: {
        fontSize: 18,
    },
    notificationBadge: {
        alignItems: 'center',
        backgroundColor: colors.red,
        borderRadius: 9,
        height: 18,
        justifyContent: 'center',
        minWidth: 18,
        paddingHorizontal: 4,
        position: 'absolute',
        right: -3,
        top: -3,
        ...shadows.sm,
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
