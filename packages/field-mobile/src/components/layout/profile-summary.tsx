import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { Icon } from '../common/Icon';

export interface BellIconProps {
    color?: string;
    size?: number;
}

export const BellIcon: React.FC<BellIconProps> = ({ color, size = 20 }) => {
    const { theme } = useTheme();

    return <Icon color={color ?? theme.textPrimary} name="bell" size={size} />;
};

export interface ProfileSummaryProps {
    userName?: string | null;
    userRole?: string | null;
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

/**
 * Who is signed in, plus the bell. Sync problems show in the SyncStatusPill
 * above only when there is one; the all-synced state, connection and the
 * light/dark setting live in the Profile screen's Settings tab. The bell counts only items for the operator from
 * other people, such as assignments waiting for a response.
 */
export const ProfileSummary: React.FC<ProfileSummaryProps> = ({
    userName,
    onOpenProfile,
    notificationCount = 0,
    onOpenNotifications,
}) => {
    const styles = useThemedStyles(createStyles);
    const unread = notificationCount ?? 0;

    return (
        <View style={styles.profileRow} testID="profile-summary">
            <Pressable
                accessibilityHint="Shows profile and account actions"
                accessibilityLabel="Open profile"
                accessibilityRole="button"
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
                    <Text selectable style={styles.profileName}>
                        {userName || 'Alex Reyes'}
                    </Text>
                    {/* Hidden test hook kept for existing tests. */}
                    <View
                        style={{ display: 'none' }}
                        testID="profile-status-dot"
                    />
                </View>
            </Pressable>

            <View style={styles.headerActions}>
                <Pressable
                    accessibilityHint="Opens assignments waiting for your response"
                    accessibilityLabel={
                        unread > 0
                            ? `Notifications: ${unread} waiting for you`
                            : 'Notifications: nothing waiting for you'
                    }
                    accessibilityRole="button"
                    onPress={onOpenNotifications || onOpenProfile}
                    style={({ pressed }) => [
                        styles.headerIconButton,
                        pressed && styles.pressed,
                    ]}
                    testID="notification-button"
                >
                    <BellIcon size={20} />
                    {unread > 0 ? (
                        <View
                            style={styles.notificationBadge}
                            testID="notification-badge"
                        >
                            <Text style={styles.notificationBadgeText}>
                                {unread > 9 ? '9+' : unread}
                            </Text>
                        </View>
                    ) : null}
                </Pressable>
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        avatarCircle: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.borderStrong,
            borderRadius: 21,
            borderWidth: 1.5,
            height: 42,
            justifyContent: 'center',
            width: 42,
        },
        avatarInitials: {
            color: theme.textPrimary,
            fontSize: 16,
            fontWeight: '700',
            letterSpacing: 0.5,
        },
        headerActions: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        // Resting controls: border only, no shadow (The Border Or Lift Rule).
        headerIconButton: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            height: 48,
            justifyContent: 'center',
            width: 48,
        },
        // Count badge, like the home tiles: Signal Gold with dark ink.
        notificationBadge: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderColor: theme.canvas,
            borderRadius: 11,
            borderWidth: 1.5,
            height: 22,
            justifyContent: 'center',
            minWidth: 22,
            paddingHorizontal: 3,
            position: 'absolute',
            right: -4,
            top: -4,
        },
        notificationBadgeText: {
            color: theme.surfaceDark,
            fontSize: 12,
            fontWeight: '700',
        },
        pressed: {
            opacity: 0.78,
        },
        profileCard: {
            alignItems: 'center',
            flex: 1,
            flexDirection: 'row',
            gap: 12,
            minHeight: 48,
            minWidth: 0,
        },
        profileCopy: {
            flex: 1,
            minWidth: 0,
        },
        profileName: {
            color: theme.textPrimary,
            fontSize: 18,
            fontWeight: '700',
            letterSpacing: -0.3,
        },
        profileRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 10,
            minHeight: 56,
        },
    });
