import React, { useContext, useEffect, useRef } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { colors } from '../nativeStyles';

export interface ProfileSheetProps {
    visible: boolean;
    userName?: string | null;
    userRole?: string | null;
    assignedAssetLabel?: string | null;
    isOnline?: boolean | null;
    queuedCount?: number;
    onSyncNow?: () => void;
    signOutConfirmationOpen: boolean;
    onClose: () => void;
    onStartSignOut: () => void;
    onCancelSignOut: () => void;
    onLogout?: () => void;
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

export const ProfileSheet: React.FC<ProfileSheetProps> = ({
    visible,
    userName,
    userRole,
    assignedAssetLabel,
    isOnline,
    queuedCount = 0,
    onSyncNow,
    signOutConfirmationOpen,
    onClose,
    onStartSignOut,
    onCancelSignOut,
    onLogout,
}) => {
    const insets = useContext(SafeAreaInsetsContext);
    const bottomInset = insets?.bottom ?? 0;

    const formattedRole = userRole
        ? userRole.replaceAll('_', ' ')
        : 'Field worker';

    const panY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            panY.setValue(0);
        }
    }, [visible, panY]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 80 || gestureState.vy > 0.5) {
                    Animated.timing(panY, {
                        duration: 150,
                        toValue: 500,
                        useNativeDriver: true,
                    }).start(() => {
                        onClose();
                        panY.setValue(0);
                    });
                } else {
                    Animated.spring(panY, {
                        bounciness: 4,
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        }),
    ).current;

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
            transparent
            visible={visible}
        >
            <View
                accessibilityViewIsModal
                style={styles.modalRoot}
                testID="profile-sheet"
            >
                <Pressable
                    accessibilityLabel="Close profile"
                    accessibilityRole="button"
                    onPress={onClose}
                    style={styles.scrim}
                    testID="profile-sheet-dismiss"
                />
                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            paddingBottom: Math.max(24, bottomInset + 16),
                            transform: [{ translateY: panY }],
                        },
                    ]}
                >
                    <View {...panResponder.panHandlers} style={styles.dragZone}>
                        <View style={styles.handle} />
                        <View style={styles.sheetHeader}>
                            <Text accessibilityRole="header" style={styles.title}>
                                Profile
                            </Text>
                            <Pressable
                                accessibilityLabel="Close profile"
                                accessibilityRole="button"
                                onPress={onClose}
                                style={({ pressed }) => [
                                    styles.closeButton,
                                    pressed && styles.pressed,
                                ]}
                                testID="profile-sheet-close"
                            >
                                <Text style={styles.closeButtonText}>Close</Text>
                            </Pressable>
                        </View>
                    </View>

                    <View style={styles.identityRow}>
                        <View style={styles.avatarCircle}>
                            <Text style={styles.avatarInitials}>
                                {initialsFor(userName)}
                            </Text>
                        </View>
                        <View style={styles.identityCopy}>
                            <Text selectable style={styles.name}>
                                {userName || 'Field worker'}
                            </Text>
                            <Text style={styles.role}>{formattedRole}</Text>
                            {assignedAssetLabel ? (
                                <View style={styles.assetBadge}>
                                    <Text style={styles.assetBadgeText}>
                                        🚜 {assignedAssetLabel}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.systemSection}>
                        <Text style={styles.sectionLabel}>System & Sync Health</Text>
                        <View style={styles.healthCard}>
                            <View style={styles.healthRow}>
                                <Text style={styles.healthLabel}>Connection:</Text>
                                <View style={styles.statusPill}>
                                    <View
                                        style={[
                                            styles.statusDot,
                                            isOnline === false
                                                ? styles.statusDotOffline
                                                : styles.statusDotOnline,
                                        ]}
                                    />
                                    <Text style={styles.healthValue}>
                                        {isOnline === false
                                            ? 'Offline (Saved locally)'
                                            : 'Online'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.healthRow}>
                                <Text style={styles.healthLabel}>Outbox Data:</Text>
                                <Text
                                    style={[
                                        styles.healthValue,
                                        queuedCount > 0 && styles.healthValueWarning,
                                    ]}
                                >
                                    {queuedCount > 0
                                        ? `⏳ ${queuedCount} unsynced action${
                                              queuedCount > 1 ? 's' : ''
                                          }`
                                        : '✓ All actions synced'}
                                </Text>
                            </View>
                            <View style={styles.healthRow}>
                                <Text style={styles.healthLabel}>Field App:</Text>
                                <Text style={styles.healthValueMuted}>
                                    v1.0.0 (Core-2 Field Mobile)
                                </Text>
                            </View>
                            {queuedCount > 0 && isOnline !== false && onSyncNow ? (
                                <Pressable
                                    accessibilityLabel="Sync queued outbox items"
                                    accessibilityRole="button"
                                    onPress={onSyncNow}
                                    style={({ pressed }) => [
                                        styles.quickSyncButton,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text style={styles.quickSyncButtonText}>
                                        Sync outbox now ({queuedCount})
                                    </Text>
                                </Pressable>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {signOutConfirmationOpen ? (
                        <View style={styles.confirmation}>
                            <Text style={styles.sectionLabel}>Sign out</Text>
                            <Text style={styles.confirmationTitle}>
                                Sign out of the field app?
                            </Text>
                            {queuedCount > 0 ? (
                                <View style={styles.warningCallout}>
                                    <Text style={styles.warningCalloutText}>
                                        ⚠️ You have {queuedCount} unsynced action(s) stored on this device. Signing out will pause syncing until you log back in.
                                    </Text>
                                </View>
                            ) : (
                                <Text style={styles.confirmationMessage}>
                                    You can sign in again when you need to access
                                    field work.
                                </Text>
                            )}
                            <View style={styles.confirmationActions}>
                                <Pressable
                                    accessibilityLabel="Cancel sign out"
                                    accessibilityRole="button"
                                    onPress={onCancelSignOut}
                                    style={({ pressed }) => [
                                        styles.actionButton,
                                        pressed && styles.pressed,
                                    ]}
                                    testID="cancel-sign-out-button"
                                >
                                    <Text style={styles.actionButtonText}>
                                        Cancel
                                    </Text>
                                </Pressable>
                                <Pressable
                                    accessibilityLabel="Confirm sign out"
                                    accessibilityRole="button"
                                    disabled={!onLogout}
                                    onPress={onLogout}
                                    style={({ pressed }) => [
                                        styles.actionButton,
                                        styles.signOutButton,
                                        pressed && styles.pressed,
                                    ]}
                                    testID="confirm-sign-out-button"
                                >
                                    <Text style={styles.signOutButtonText}>
                                        Sign out
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    ) : (
                        <Pressable
                            accessibilityLabel="Start sign out"
                            accessibilityRole="button"
                            disabled={!onLogout}
                            onPress={onStartSignOut}
                            style={({ pressed }) => [
                                styles.signOutRow,
                                pressed && styles.pressed,
                            ]}
                            testID="account-sign-out-button"
                        >
                            <View style={styles.signOutCopy}>
                                <Text style={styles.signOutTitle}>
                                    Sign out
                                </Text>
                                <Text style={styles.signOutDescription}>
                                    End this field session on this device.
                                </Text>
                            </View>
                            <Text style={styles.chevron}>›</Text>
                        </Pressable>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalRoot: {
        backgroundColor: 'rgba(15, 23, 42, 0.38)',
        flex: 1,
        justifyContent: 'flex-end',
    },
    scrim: {
        ...StyleSheet.absoluteFill,
    },
    sheet: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        gap: 16,
        paddingBottom: 24,
        paddingHorizontal: 20,
        paddingTop: 10,
        boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.12)',
    },
    dragZone: {
        gap: 12,
        paddingBottom: 4,
    },
    handle: {
        alignSelf: 'center',
        backgroundColor: colors.borderStrong,
        borderRadius: 3,
        height: 5,
        width: 42,
    },
    sheetHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    title: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '800',
    },
    closeButton: {
        alignItems: 'center',
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: 14,
    },
    closeButtonText: {
        color: colors.secondary,
        fontSize: 14,
        fontWeight: '700',
    },
    identityRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
    },
    avatarCircle: {
        alignItems: 'center',
        backgroundColor: colors.amberSoft,
        borderRadius: 28,
        height: 56,
        justifyContent: 'center',
        width: 56,
    },
    avatarInitials: {
        color: colors.amberDark,
        fontSize: 16,
        fontWeight: '800',
    },
    identityCopy: {
        flex: 1,
        gap: 3,
        minWidth: 0,
    },
    name: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
    },
    role: {
        color: colors.secondary,
        fontSize: 14,
        textTransform: 'capitalize',
    },
    assetBadge: {
        alignSelf: 'flex-start',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 6,
        borderWidth: 1,
        marginTop: 2,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    assetBadgeText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '700',
    },
    divider: {
        backgroundColor: colors.border,
        height: 1,
    },
    sectionLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    systemSection: {
        gap: 8,
    },
    healthCard: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        gap: 10,
        padding: 14,
    },
    healthRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    healthLabel: {
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '600',
    },
    healthValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    healthValueWarning: {
        color: colors.warningDark,
        fontWeight: '800',
    },
    healthValueMuted: {
        color: colors.muted,
        fontSize: 12,
    },
    statusPill: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    statusDot: {
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    statusDotOnline: {
        backgroundColor: colors.green,
    },
    statusDotOffline: {
        backgroundColor: colors.warning,
    },
    quickSyncButton: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 8,
        justifyContent: 'center',
        marginTop: 4,
        minHeight: 40,
        paddingHorizontal: 12,
    },
    quickSyncButtonText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    warningCallout: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
    },
    warningCalloutText: {
        color: colors.warningDark,
        fontSize: 13,
        lineHeight: 18,
    },
    signOutRow: {
        alignItems: 'center',
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    signOutCopy: {
        flex: 1,
        gap: 3,
    },
    signOutTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
    },
    signOutDescription: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
    },
    chevron: {
        color: colors.muted,
        fontSize: 26,
        lineHeight: 28,
    },
    confirmation: {
        gap: 10,
    },
    confirmationTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    confirmationMessage: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
    },
    confirmationActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    actionButton: {
        alignItems: 'center',
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        flex: 1,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 12,
    },
    actionButtonText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    signOutButton: {
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
    },
    signOutButtonText: {
        color: colors.redDark,
        fontSize: 14,
        fontWeight: '800',
    },
    pressed: {
        opacity: 0.78,
    },
});
