import React, { useContext, useEffect, useMemo } from 'react';
import {
    Animated,
    Modal,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Icon } from '../common/Icon';
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
    const { isDarkHud, setMode } = useTheme();

    const formattedRole = userRole
        ? userRole.replaceAll('_', ' ')
        : 'Field worker';

    const panY = useMemo(() => new Animated.Value(0), []);

    useEffect(() => {
        if (visible) {
            panY.setValue(0);
        }
    }, [visible, panY]);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: (_, gestureState) =>
                    gestureState.dy > 5,
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
        [onClose, panY],
    );

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
                        isDarkHud && styles.darkSheet,
                        {
                            paddingBottom: Math.max(24, bottomInset + 16),
                            transform: [{ translateY: panY }],
                        },
                    ]}
                >
                    <View {...panResponder.panHandlers} style={styles.dragZone}>
                        <View
                            style={[
                                styles.handle,
                                isDarkHud && styles.darkHandle,
                            ]}
                        />
                        <View style={styles.sheetHeader}>
                            <Text
                                accessibilityRole="header"
                                style={[
                                    styles.title,
                                    isDarkHud && styles.darkTitle,
                                ]}
                            >
                                Profile
                            </Text>
                            <Pressable
                                accessibilityLabel="Close profile"
                                accessibilityRole="button"
                                onPress={onClose}
                                style={({ pressed }) => [
                                    styles.closeButton,
                                    isDarkHud && styles.darkCloseButton,
                                    pressed && styles.pressed,
                                ]}
                                testID="profile-sheet-close"
                            >
                                <Text
                                    style={[
                                        styles.closeButtonText,
                                        isDarkHud && styles.darkCloseButtonText,
                                    ]}
                                >
                                    Close
                                </Text>
                            </Pressable>
                        </View>
                    </View>

                    <View style={styles.identityRow}>
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
                        <View style={styles.identityCopy}>
                            <Text
                                selectable
                                style={[
                                    styles.name,
                                    isDarkHud && styles.darkName,
                                ]}
                            >
                                {userName || 'Field worker'}
                            </Text>
                            <Text
                                style={[
                                    styles.role,
                                    isDarkHud && styles.darkRole,
                                ]}
                            >
                                {formattedRole}
                            </Text>
                            {assignedAssetLabel ? (
                                <View
                                    style={[
                                        styles.assetBadge,
                                        isDarkHud && styles.darkAssetBadge,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.assetBadgeText,
                                            isDarkHud &&
                                                styles.darkAssetBadgeText,
                                        ]}
                                    >
                                        🚜 {assignedAssetLabel}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    <View
                        style={[
                            styles.divider,
                            isDarkHud && styles.darkDivider,
                        ]}
                    />

                    {/* Display & Lighting (Theme Selector) */}
                    <View style={styles.systemSection}>
                        <Text
                            style={[
                                styles.sectionLabel,
                                isDarkHud && styles.darkSectionLabel,
                            ]}
                        >
                            Display & Lighting
                        </Text>
                        <View
                            style={[
                                styles.themeSelectorCard,
                                isDarkHud && styles.darkThemeSelectorCard,
                            ]}
                            testID="theme-selector-card"
                        >
                            <Pressable
                                accessibilityHint="Switches to high-contrast outdoor daylight theme"
                                accessibilityLabel="Daylight outdoor theme"
                                accessibilityRole="button"
                                accessibilityState={{ selected: !isDarkHud }}
                                onPress={() => setMode('light')}
                                style={({ pressed }) => [
                                    styles.themeOption,
                                    !isDarkHud && styles.themeOptionActive,
                                    pressed && styles.pressed,
                                ]}
                                testID="theme-option-light"
                            >
                                <Icon
                                    color={
                                        !isDarkHud
                                            ? '#D97706'
                                            : isDarkHud
                                              ? '#94A3B8'
                                              : colors.secondary
                                    }
                                    name="sun"
                                    size={18}
                                />
                                <View style={styles.themeOptionCopy}>
                                    <Text
                                        style={[
                                            styles.themeOptionTitle,
                                            !isDarkHud &&
                                                styles.themeOptionTitleActive,
                                            isDarkHud &&
                                                styles.darkThemeOptionTitle,
                                        ]}
                                    >
                                        Daylight
                                    </Text>
                                    <Text
                                        style={[
                                            styles.themeOptionSublabel,
                                            !isDarkHud &&
                                                styles.themeOptionSublabelActive,
                                            isDarkHud &&
                                                styles.darkThemeOptionSublabel,
                                        ]}
                                    >
                                        Outdoor High-Contrast
                                    </Text>
                                </View>
                                {!isDarkHud ? (
                                    <Text style={styles.themeCheckmark}>✓</Text>
                                ) : null}
                            </Pressable>

                            <Pressable
                                accessibilityHint="Switches to low-glare cockpit night HUD theme"
                                accessibilityLabel="Cockpit HUD night theme"
                                accessibilityRole="button"
                                accessibilityState={{ selected: isDarkHud }}
                                onPress={() => setMode('dark_hud')}
                                style={({ pressed }) => [
                                    styles.themeOption,
                                    isDarkHud && styles.themeOptionActiveDark,
                                    pressed && styles.pressed,
                                ]}
                                testID="theme-option-dark"
                            >
                                <Icon
                                    color={
                                        isDarkHud ? '#F59E0B' : colors.secondary
                                    }
                                    name="moon"
                                    size={18}
                                />
                                <View style={styles.themeOptionCopy}>
                                    <Text
                                        style={[
                                            styles.themeOptionTitle,
                                            isDarkHud &&
                                                styles.themeOptionTitleActiveDark,
                                        ]}
                                    >
                                        Cockpit HUD
                                    </Text>
                                    <Text
                                        style={[
                                            styles.themeOptionSublabel,
                                            isDarkHud &&
                                                styles.themeOptionSublabelActiveDark,
                                        ]}
                                    >
                                        Night Ops & In-Cab
                                    </Text>
                                </View>
                                {isDarkHud ? (
                                    <Text style={styles.themeCheckmarkDark}>
                                        ✓
                                    </Text>
                                ) : null}
                            </Pressable>
                        </View>
                    </View>

                    <View
                        style={[
                            styles.divider,
                            isDarkHud && styles.darkDivider,
                        ]}
                    />

                    <View style={styles.systemSection}>
                        <Text
                            style={[
                                styles.sectionLabel,
                                isDarkHud && styles.darkSectionLabel,
                            ]}
                        >
                            System & Sync Health
                        </Text>
                        <View
                            style={[
                                styles.healthCard,
                                isDarkHud && styles.darkHealthCard,
                            ]}
                        >
                            <View style={styles.healthRow}>
                                <Text
                                    style={[
                                        styles.healthLabel,
                                        isDarkHud && styles.darkHealthLabel,
                                    ]}
                                >
                                    Connection:
                                </Text>
                                <View style={styles.statusPill}>
                                    <View
                                        style={[
                                            styles.statusDot,
                                            isOnline === false
                                                ? styles.statusDotOffline
                                                : styles.statusDotOnline,
                                        ]}
                                    />
                                    <Text
                                        style={[
                                            styles.healthValue,
                                            isDarkHud && styles.darkHealthValue,
                                        ]}
                                    >
                                        {isOnline === false
                                            ? 'Offline (Saved locally)'
                                            : 'Online'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.healthRow}>
                                <Text
                                    style={[
                                        styles.healthLabel,
                                        isDarkHud && styles.darkHealthLabel,
                                    ]}
                                >
                                    Outbox Data:
                                </Text>
                                <Text
                                    style={[
                                        styles.healthValue,
                                        isDarkHud && styles.darkHealthValue,
                                        queuedCount > 0 &&
                                            styles.healthValueWarning,
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
                                <Text
                                    style={[
                                        styles.healthLabel,
                                        isDarkHud && styles.darkHealthLabel,
                                    ]}
                                >
                                    Field App:
                                </Text>
                                <Text style={styles.healthValueMuted}>
                                    v1.0.0 (Core-2 Field Mobile)
                                </Text>
                            </View>
                            {queuedCount > 0 &&
                            isOnline !== false &&
                            onSyncNow ? (
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

                    <View
                        style={[
                            styles.divider,
                            isDarkHud && styles.darkDivider,
                        ]}
                    />

                    {signOutConfirmationOpen ? (
                        <View style={styles.confirmation}>
                            <Text style={styles.sectionLabel}>Sign out</Text>
                            <Text style={styles.confirmationTitle}>
                                Sign out of the field app?
                            </Text>
                            {queuedCount > 0 ? (
                                <View style={styles.warningCallout}>
                                    <Text style={styles.warningCalloutText}>
                                        You have {queuedCount} unsynced
                                        action(s) stored on this device. Signing
                                        out will pause syncing until you log
                                        back in.
                                    </Text>
                                </View>
                            ) : (
                                <Text style={styles.confirmationMessage}>
                                    You can sign in again when you need to
                                    access field work.
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
                                isDarkHud && styles.darkSignOutRow,
                                pressed && styles.pressed,
                            ]}
                            testID="account-sign-out-button"
                        >
                            <View style={styles.signOutCopy}>
                                <Text
                                    style={[
                                        styles.signOutTitle,
                                        isDarkHud && styles.darkSignOutTitle,
                                    ]}
                                >
                                    Sign out
                                </Text>
                                <Text
                                    style={[
                                        styles.signOutDescription,
                                        isDarkHud &&
                                            styles.darkSignOutDescription,
                                    ]}
                                >
                                    End this field session on this device.
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.chevron,
                                    isDarkHud && styles.darkChevron,
                                ]}
                            >
                                ›
                            </Text>
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
        minHeight: 48,
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
        minHeight: 48,
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
    darkSheet: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.4)',
    },
    darkHandle: {
        backgroundColor: '#475569',
    },
    darkTitle: {
        color: '#F8FAFC',
    },
    darkCloseButton: {
        borderColor: '#334155',
    },
    darkCloseButtonText: {
        color: '#94A3B8',
    },
    darkAvatarCircle: {
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
        borderColor: '#F59E0B',
    },
    darkAvatarInitials: {
        color: '#F59E0B',
    },
    darkName: {
        color: '#F8FAFC',
    },
    darkRole: {
        color: '#94A3B8',
    },
    darkAssetBadge: {
        backgroundColor: '#090D16',
        borderColor: '#334155',
    },
    darkAssetBadgeText: {
        color: '#F8FAFC',
    },
    darkDivider: {
        backgroundColor: '#334155',
    },
    darkSectionLabel: {
        color: '#94A3B8',
    },
    darkHealthCard: {
        backgroundColor: '#090D16',
        borderColor: '#334155',
    },
    darkHealthLabel: {
        color: '#94A3B8',
    },
    darkHealthValue: {
        color: '#F8FAFC',
    },
    darkSignOutRow: {
        borderColor: '#334155',
    },
    darkSignOutTitle: {
        color: '#F8FAFC',
    },
    darkSignOutDescription: {
        color: '#94A3B8',
    },
    darkChevron: {
        color: '#94A3B8',
    },
    themeSelectorCard: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
        padding: 8,
    },
    darkThemeSelectorCard: {
        backgroundColor: '#090D16',
        borderColor: '#334155',
    },
    themeOption: {
        alignItems: 'center',
        borderColor: 'transparent',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    themeOptionActive: {
        backgroundColor: '#FEF3C7',
        borderColor: '#D97706',
    },
    themeOptionActiveDark: {
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
        borderColor: '#F59E0B',
    },
    themeOptionCopy: {
        flex: 1,
        gap: 2,
    },
    themeOptionTitle: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    themeOptionTitleActive: {
        color: '#D97706',
        fontWeight: '800',
    },
    darkThemeOptionTitle: {
        color: '#F8FAFC',
    },
    themeOptionTitleActiveDark: {
        color: '#F59E0B',
        fontWeight: '800',
    },
    themeOptionSublabel: {
        color: colors.muted,
        fontSize: 11,
    },
    themeOptionSublabelActive: {
        color: '#92400E',
    },
    darkThemeOptionSublabel: {
        color: '#94A3B8',
    },
    themeOptionSublabelActiveDark: {
        color: '#FDE68A',
    },
    themeCheckmark: {
        color: '#D97706',
        fontSize: 14,
        fontWeight: '900',
    },
    themeCheckmarkDark: {
        color: '#F59E0B',
        fontSize: 14,
        fontWeight: '900',
    },
});
