import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../nativeStyles';

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
}) => (
    <View
        style={{
            alignItems: 'center',
            height: size,
            justifyContent: 'center',
            width: size,
        }}
    >
        <View
            style={{
                borderColor: color,
                borderTopLeftRadius: size * 0.35,
                borderTopRightRadius: size * 0.35,
                borderWidth: 1.8,
                height: size * 0.58,
                width: size * 0.68,
            }}
        />
        <View
            style={{
                backgroundColor: color,
                borderRadius: 1,
                height: 2,
                marginTop: -1,
                width: size * 0.86,
            }}
        />
        <View
            style={{
                backgroundColor: color,
                borderBottomLeftRadius: size * 0.12,
                borderBottomRightRadius: size * 0.12,
                height: size * 0.18,
                marginTop: 1,
                width: size * 0.26,
            }}
        />
    </View>
);

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
                <Text style={styles.avatarInitials}>{initialsFor(userName)}</Text>
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
                            syncTone === 'attention' && styles.syncMarkAttention,
                        ]}
                        testID="profile-status-dot"
                    />
                </View>
                <Text style={styles.profileRole}>{userRole || 'Field worker'}</Text>
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
    const [isPillVisible, setIsPillVisible] = useState(true);

    useEffect(() => {
        setIsPillVisible(true);

        if (syncTone === 'online') {
            const timer = setTimeout(() => {
                setIsPillVisible(false);
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [syncTone, syncStatusLabel, syncStatusMessage]);

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
        marginBottom: 20,
    },
    appBar: {
        alignItems: 'center',
        borderTopColor: colors.amberBorder,
        borderTopWidth: 1.5,
        justifyContent: 'center',
        minHeight: 52,
        paddingTop: 12,
    },
    screenTitle: {
        alignSelf: 'flex-start',
        color: colors.text,
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: 0.2,
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
        paddingHorizontal: 12,
        paddingVertical: 7,
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
        borderRadius: 6,
        height: 12,
        width: 12,
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
        fontWeight: '800',
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
        flex: 1,
        flexDirection: 'row',
        gap: 10,
        minWidth: 0,
    },
    avatarCircle: {
        alignItems: 'center',
        backgroundColor: colors.amberSoft,
        borderColor: colors.amberBorder,
        borderRadius: 22,
        borderWidth: 1.5,
        height: 44,
        justifyContent: 'center',
        width: 44,
    },
    avatarInitials: {
        color: colors.amberDark,
        fontSize: 13,
        fontWeight: '800',
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
        fontWeight: '800',
    },
    nameStatusDot: {
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    profileRole: {
        color: colors.secondary,
        fontSize: 12,
        marginTop: 2,
        textTransform: 'capitalize',
    },
    headerActions: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    notificationButton: {
        alignItems: 'center',
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderRadius: 10,
        borderWidth: 1.5,
        height: 44,
        justifyContent: 'center',
        position: 'relative',
        width: 44,
    },
    bellIcon: {
        fontSize: 18,
    },
    notificationBadge: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 9,
        height: 18,
        justifyContent: 'center',
        minWidth: 18,
        paddingHorizontal: 4,
        position: 'absolute',
        right: -4,
        top: -4,
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
        minHeight: 44,
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
        minHeight: 44,
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
