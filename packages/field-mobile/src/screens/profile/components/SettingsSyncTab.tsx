import React, { useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    Vibration,
    View,
} from 'react-native';
import { Icon } from '../../../components/common/Icon';
import { appVersionLabel } from '../../../services/appVersion';
import { projectOutbox } from '../../../services/outboxProjection';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import type { OutboxCommand } from '../../../types/index';

export interface SettingsSyncTabProps {
    isOnline?: boolean | null;
    isAuthenticated?: boolean;
    lastSuccessfulSyncAt?: string | null;
    queuedCount?: number;
    outboxCommands?: OutboxCommand[];
    /** Null while the device permission is still being checked. */
    pushNotificationsEnabled?: boolean | null;
    onSyncNow?: () => void;
    onOpenOutboxDetails?: () => void;
    onRequestPushPermissions?: () => void;
    onLogout?: () => void;
}

export const SettingsSyncTab: React.FC<SettingsSyncTabProps> = ({
    isOnline = true,
    isAuthenticated = true,
    lastSuccessfulSyncAt,
    queuedCount = 0,
    outboxCommands,
    pushNotificationsEnabled = null,
    onSyncNow,
    onOpenOutboxDetails,
    onRequestPushPermissions,
    onLogout,
}) => {
    const { isDarkHud, setMode, theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [signOutModalVisible, setSignOutModalVisible] = useState(false);

    const projection = useMemo(
        () =>
            outboxCommands
                ? projectOutbox(
                      outboxCommands,
                      isOnline,
                      isAuthenticated,
                      undefined,
                      lastSuccessfulSyncAt,
                  )
                : null,
        [outboxCommands, isOnline, isAuthenticated, lastSuccessfulSyncAt],
    );

    const attentionCount = projection?.counts.attention ?? 0;
    const hasAttention = attentionCount > 0;
    const waitingCount = projection ? projection.counts.waiting : queuedCount;
    const submittingCount = projection?.counts.submitting ?? 0;
    const pendingCount = waitingCount + submittingCount;
    // Only actions that have not reached the server; synced ones are done.
    const unsyncedCount = projection
        ? pendingCount + attentionCount
        : queuedCount;

    let outboxStatusText = '✓ All actions synced';

    if (!isAuthenticated) {
        outboxStatusText = '⚠️ Sign in required to sync';
    } else if (hasAttention) {
        outboxStatusText = `⚠️ ${attentionCount} action${attentionCount > 1 ? 's' : ''} need attention`;
    } else if (submittingCount > 0) {
        outboxStatusText = '⏳ Submitting to dispatch…';
    } else if (waitingCount > 0) {
        outboxStatusText = `⏳ ${waitingCount} unsynced action${waitingCount > 1 ? 's' : ''}`;
    }

    const triggerHaptic = () => {
        try {
            Vibration.vibrate(8);
        } catch {
            // Safe fallback
        }
    };

    return (
        <View style={styles.container} testID="settings-sync-tab">
            {/* Display & Lighting Card */}
            <View style={[styles.card]}>
                <Text style={[styles.cardTitle]}>Display & Lighting</Text>
                <Text style={[styles.cardSubtitle]}>
                    Configure color mode for direct sunlight or dark cabin
                    environments
                </Text>

                <View
                    style={[
                        styles.themeSelectorCard,
                        isDarkHud && styles.darkThemeSelectorCard,
                    ]}
                    testID="theme-selector-card"
                >
                    {/* Daylight Option */}
                    <Pressable
                        accessibilityHint="Switches to high-contrast outdoor daylight theme"
                        accessibilityLabel="Daylight outdoor theme"
                        accessibilityRole="button"
                        accessibilityState={{ selected: !isDarkHud }}
                        onPress={() => {
                            triggerHaptic();
                            setMode('light');
                        }}
                        style={({ pressed }) => [
                            styles.themeOption,
                            isDarkHud && styles.darkThemeOption,
                            !isDarkHud && styles.themeOptionActive,
                            pressed && styles.pressedCard,
                        ]}
                        testID="theme-option-light"
                    >
                        <View style={styles.themeOptionHeader}>
                            <View
                                style={[
                                    styles.themeIconSquircle,
                                    !isDarkHud
                                        ? styles.themeIconSquircleActive
                                        : styles.themeIconSquircleInactive,
                                ]}
                            >
                                <Icon
                                    color={theme.brandAmber}
                                    name="sun"
                                    size={20}
                                />
                            </View>
                            <View
                                style={[
                                    styles.checkCircle,
                                    !isDarkHud
                                        ? styles.checkCircleActive
                                        : styles.checkCircleInactive,
                                ]}
                            >
                                {!isDarkHud ? (
                                    <Text style={styles.themeCheckmark}>✓</Text>
                                ) : null}
                            </View>
                        </View>

                        <View style={styles.themeOptionCopy}>
                            <Text
                                style={[
                                    styles.themeOptionTitle,
                                    !isDarkHud && styles.themeOptionTitleActive,
                                ]}
                            >
                                Daylight
                            </Text>
                            <Text
                                style={[
                                    styles.themeOptionSublabel,
                                    !isDarkHud &&
                                        styles.themeOptionSublabelActive,
                                ]}
                            >
                                Outdoor High-Contrast
                            </Text>
                        </View>
                    </Pressable>

                    {/* Cockpit HUD Option */}
                    <Pressable
                        accessibilityHint="Switches to low-glare cockpit night HUD theme"
                        accessibilityLabel="Cockpit HUD night theme"
                        accessibilityRole="button"
                        accessibilityState={{ selected: isDarkHud }}
                        onPress={() => {
                            triggerHaptic();
                            setMode('dark_hud');
                        }}
                        style={({ pressed }) => [
                            styles.themeOption,
                            isDarkHud && styles.darkThemeOption,
                            isDarkHud && styles.themeOptionActiveDark,
                            pressed && styles.pressedCard,
                        ]}
                        testID="theme-option-dark"
                    >
                        <View style={styles.themeOptionHeader}>
                            <View
                                style={[
                                    styles.themeIconSquircle,
                                    isDarkHud
                                        ? styles.themeIconSquircleActiveDark
                                        : styles.themeIconSquircleInactive,
                                ]}
                            >
                                <Icon
                                    color={
                                        isDarkHud
                                            ? theme.brandAmber
                                            : theme.textSecondary
                                    }
                                    name="moon"
                                    size={20}
                                />
                            </View>
                            <View
                                style={[
                                    styles.checkCircle,
                                    isDarkHud
                                        ? styles.checkCircleActiveDark
                                        : styles.checkCircleInactive,
                                ]}
                            >
                                {isDarkHud ? (
                                    <Text style={styles.themeCheckmarkDark}>
                                        ✓
                                    </Text>
                                ) : null}
                            </View>
                        </View>

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
                    </Pressable>
                </View>
            </View>

            {/* System & Sync Health Card */}
            <View style={[styles.card]}>
                <Text style={[styles.cardTitle]}>System & Sync Health</Text>
                <Text style={[styles.cardSubtitle]}>
                    Local storage cache and network communication state
                </Text>

                <View
                    style={[
                        styles.healthInsetContainer,
                        isDarkHud && styles.darkHealthInsetContainer,
                    ]}
                >
                    {/* Connection Status Row */}
                    <View style={styles.healthRow}>
                        <View style={styles.healthLeft}>
                            <View
                                style={[
                                    styles.healthSquircle,
                                    isOnline === false
                                        ? isDarkHud
                                            ? styles.darkHealthSquircleWarning
                                            : styles.healthSquircleWarning
                                        : isDarkHud
                                          ? styles.darkHealthSquircleSuccess
                                          : styles.healthSquircleSuccess,
                                ]}
                            >
                                <Icon
                                    color={
                                        isOnline === false
                                            ? theme.hazardRed
                                            : theme.successEmerald
                                    }
                                    name="cloud"
                                    size={18}
                                />
                            </View>
                            <Text style={[styles.healthLabel]}>Connection</Text>
                        </View>
                        <View style={styles.statusPill}>
                            <View
                                style={[
                                    styles.statusDot,
                                    isOnline === false
                                        ? styles.statusDotOffline
                                        : styles.statusDotOnline,
                                ]}
                            />
                            <Text style={[styles.healthValue]}>
                                {isOnline === false
                                    ? 'Offline (Saved locally)'
                                    : 'Online'}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.hairlineDivider]} />

                    {/* Outbox Data Row */}
                    <View style={styles.healthRow}>
                        <View style={styles.healthLeft}>
                            <View
                                style={[
                                    styles.healthSquircle,
                                    !isAuthenticated || hasAttention
                                        ? isDarkHud
                                            ? styles.darkHealthSquircleAttention
                                            : styles.healthSquircleAttention
                                        : pendingCount > 0
                                          ? isDarkHud
                                              ? styles.darkHealthSquircleWarning
                                              : styles.healthSquircleWarning
                                          : isDarkHud
                                            ? styles.darkHealthSquircleSuccess
                                            : styles.healthSquircleSuccess,
                                ]}
                            >
                                <Icon
                                    color={
                                        !isAuthenticated || hasAttention
                                            ? theme.hazardRed
                                            : pendingCount > 0
                                              ? theme.brandAmberText
                                              : theme.successEmerald
                                    }
                                    name="sync"
                                    size={18}
                                />
                            </View>
                            <Text style={[styles.healthLabel]}>
                                Outbox Data
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.healthValue,
                                (!isAuthenticated || hasAttention) &&
                                    (isDarkHud
                                        ? styles.darkHealthValueAttention
                                        : styles.healthValueAttention),
                                isAuthenticated &&
                                    !hasAttention &&
                                    pendingCount > 0 &&
                                    (isDarkHud
                                        ? styles.darkHealthValueWarning
                                        : styles.healthValueWarning),
                            ]}
                        >
                            {outboxStatusText}
                        </Text>
                    </View>

                    {onOpenOutboxDetails ? (
                        <View style={styles.syncBtnContainer}>
                            <Pressable
                                accessibilityHint="Opens full outbox synchronization sheet"
                                accessibilityLabel="View full outbox synchronization queue"
                                accessibilityRole="button"
                                onPress={onOpenOutboxDetails}
                                style={({ pressed }) => [
                                    styles.viewOutboxBtn,
                                    isDarkHud && styles.darkViewOutboxBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="open-outbox-sheet-btn"
                            >
                                <Icon
                                    color={theme.dutyDriving}
                                    name="sync"
                                    size={16}
                                />
                                <Text
                                    style={[
                                        styles.viewOutboxBtnText,
                                        isDarkHud &&
                                            styles.darkViewOutboxBtnText,
                                    ]}
                                >
                                    View Outbox Queue →
                                </Text>
                            </Pressable>
                        </View>
                    ) : null}

                    {(pendingCount > 0 || hasAttention) &&
                    isOnline !== false &&
                    onSyncNow ? (
                        <View style={styles.syncBtnContainer}>
                            <Pressable
                                accessibilityLabel="Sync queued outbox items"
                                accessibilityRole="button"
                                onPress={() => {
                                    triggerHaptic();
                                    onSyncNow();
                                }}
                                style={({ pressed }) => [
                                    styles.syncNowBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="sync-outbox-now-btn"
                            >
                                <Icon
                                    color={theme.brandAmberText}
                                    name="sync"
                                    size={16}
                                />
                                <Text style={[styles.syncNowBtnText]}>
                                    Sync Outbox Now ({unsyncedCount})
                                </Text>
                            </Pressable>
                        </View>
                    ) : null}

                    <View style={[styles.hairlineDivider]} />

                    {/* Push Alerts Row */}
                    <View style={styles.healthRow}>
                        <View style={styles.healthLeft}>
                            <View
                                style={[
                                    styles.healthSquircle,
                                    pushNotificationsEnabled !== true
                                        ? isDarkHud
                                            ? styles.darkHealthSquircleNeutral
                                            : styles.healthSquircleNeutral
                                        : isDarkHud
                                          ? styles.darkHealthSquircleSuccess
                                          : styles.healthSquircleSuccess,
                                ]}
                            >
                                <Icon
                                    color={
                                        pushNotificationsEnabled !== true
                                            ? theme.textSecondary
                                            : theme.successEmerald
                                    }
                                    name="bell"
                                    size={18}
                                />
                            </View>
                            <Text style={[styles.healthLabel]}>
                                Push Alerts
                            </Text>
                        </View>
                        <View style={styles.statusPill}>
                            <View
                                style={[
                                    styles.statusDot,
                                    pushNotificationsEnabled !== true
                                        ? styles.statusDotOffline
                                        : styles.statusDotOnline,
                                ]}
                            />
                            <Text style={[styles.healthValue]}>
                                {pushNotificationsEnabled === null
                                    ? 'Checking…'
                                    : pushNotificationsEnabled
                                      ? 'Active'
                                      : 'Disabled'}
                            </Text>
                        </View>
                    </View>

                    {pushNotificationsEnabled === false &&
                    onRequestPushPermissions ? (
                        <View style={styles.syncBtnContainer}>
                            <Pressable
                                accessibilityLabel="Enable push notifications"
                                accessibilityRole="button"
                                onPress={() => {
                                    triggerHaptic();
                                    onRequestPushPermissions();
                                }}
                                style={({ pressed }) => [
                                    styles.pushPermBtn,
                                    isDarkHud && styles.darkPushPermBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="enable-push-btn"
                            >
                                <Text style={[styles.pushPermBtnText]}>
                                    Enable Push Alerts
                                </Text>
                            </Pressable>
                        </View>
                    ) : null}

                    <View style={[styles.hairlineDivider]} />

                    {/* Field App Version Row */}
                    <View style={styles.healthRow}>
                        <View style={styles.healthLeft}>
                            <View
                                style={[
                                    styles.healthSquircle,
                                    isDarkHud
                                        ? styles.darkHealthSquircleNeutral
                                        : styles.healthSquircleNeutral,
                                ]}
                            >
                                <Icon
                                    color={theme.textSecondary}
                                    name="smartphone"
                                    size={18}
                                />
                            </View>
                            <Text style={[styles.healthLabel]}>
                                Field App Version
                            </Text>
                        </View>
                        <Text style={[styles.healthValueMuted]}>
                            {appVersionLabel()}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Standalone Destructive Sign Out Cell */}
            <View
                style={[
                    styles.signOutCard,
                    isDarkHud && styles.darkSignOutCard,
                ]}
            >
                <Pressable
                    accessibilityLabel="Start sign out"
                    accessibilityRole="button"
                    disabled={!onLogout}
                    onPress={() => {
                        triggerHaptic();
                        setSignOutModalVisible(true);
                    }}
                    style={({ pressed }) => [
                        styles.signOutRow,
                        pressed && styles.pressed,
                    ]}
                    testID="btn-sign-out"
                >
                    <View style={styles.signOutLeft}>
                        <View
                            style={[
                                styles.signOutIconWrap,
                                isDarkHud && styles.darkSignOutIconWrap,
                            ]}
                        >
                            <Icon
                                color={theme.hazardRed}
                                name="log-out"
                                size={20}
                            />
                        </View>
                        <View style={styles.signOutCopy}>
                            <Text
                                style={[
                                    styles.signOutTitle,
                                    isDarkHud && styles.darkSignOutTitle,
                                ]}
                            >
                                Sign out
                            </Text>
                            <Text style={[styles.signOutDescription]}>
                                End this field session on this device
                            </Text>
                        </View>
                    </View>
                    <Icon
                        color={theme.textSecondary}
                        name="chevron-right"
                        size={18}
                    />
                </Pressable>
            </View>

            {/* Sign Out Confirmation Modal */}
            <Modal
                animationType="fade"
                onRequestClose={() => setSignOutModalVisible(false)}
                statusBarTranslucent
                transparent
                visible={signOutModalVisible}
            >
                <View
                    accessibilityViewIsModal
                    style={styles.modalOverlay}
                    testID="profile-sign-out-modal"
                >
                    <Pressable
                        accessibilityLabel="Dismiss sign out dialog"
                        onPress={() => setSignOutModalVisible(false)}
                        style={styles.modalScrim}
                    />
                    <View style={[styles.confirmDialog]}>
                        <View style={styles.confirmIconBadge}>
                            <Icon
                                color={theme.hazardRed}
                                name="log-out"
                                size={24}
                            />
                        </View>

                        <Text
                            accessibilityRole="header"
                            style={[styles.confirmTitle]}
                        >
                            Sign out of the field app?
                        </Text>

                        {unsyncedCount > 0 ? (
                            <View style={styles.warningCallout}>
                                <Text style={styles.warningCalloutText}>
                                    You have {unsyncedCount} unsynced action(s)
                                    stored on this device. Signing out will
                                    pause syncing until you log back in.
                                </Text>
                            </View>
                        ) : (
                            <Text style={[styles.confirmMessage]}>
                                You can sign back in when you need to access
                                field work.
                            </Text>
                        )}

                        <View style={styles.confirmActions}>
                            <Pressable
                                accessibilityLabel="Cancel sign out"
                                onPress={() => setSignOutModalVisible(false)}
                                style={({ pressed }) => [
                                    styles.confirmCancelBtn,
                                    isDarkHud && styles.darkConfirmCancelBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="cancel-profile-sign-out"
                            >
                                <Text
                                    style={[
                                        styles.confirmCancelText,
                                        isDarkHud &&
                                            styles.darkConfirmCancelText,
                                    ]}
                                >
                                    Cancel
                                </Text>
                            </Pressable>

                            <Pressable
                                accessibilityLabel="Confirm sign out"
                                onPress={() => {
                                    triggerHaptic();
                                    setSignOutModalVisible(false);
                                    onLogout?.();
                                }}
                                style={({ pressed }) => [
                                    styles.confirmSubmitBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="confirm-profile-sign-out"
                            >
                                <Text style={styles.confirmSubmitText}>
                                    Sign Out
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        container: {
            gap: 16,
        },
        card: {
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.border,
            elevation: 1,
            overflow: 'hidden',
        },
        cardTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.textPrimary,
        },
        cardSubtitle: {
            fontSize: 12,
            color: theme.textSecondary,
            marginTop: 2,
        },
        themeSelectorCard: {
            flexDirection: 'row',
            gap: 12,
            marginTop: 14,
        },
        darkThemeSelectorCard: {},
        darkThemeOption: {
            backgroundColor: theme.textInverse,
            borderColor: theme.border,
        },
        themeOption: {
            flex: 1,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: theme.border,
            backgroundColor: theme.surfaceHighlight,
            minHeight: 96,
            justifyContent: 'space-between',
            gap: 12,
        },
        themeOptionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        themeIconSquircle: {
            width: 36,
            height: 36,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
        },
        themeIconSquircleActive: {
            backgroundColor: theme.brandAmberLight,
        },
        themeIconSquircleActiveDark: {
            backgroundColor: `${theme.brandAmberLight}40`,
        },
        themeIconSquircleInactive: {
            backgroundColor: theme.border,
        },
        checkCircle: {
            width: 22,
            height: 22,
            borderRadius: 11,
            justifyContent: 'center',
            alignItems: 'center',
        },
        checkCircleActive: {
            backgroundColor: theme.brandAmberLight,
            borderWidth: 1.5,
            borderColor: theme.brandAmber,
        },
        checkCircleActiveDark: {
            backgroundColor: theme.brandAmberLight,
            borderWidth: 1.5,
            borderColor: theme.brandAmber,
        },
        checkCircleInactive: {
            borderWidth: 1.5,
            borderColor: theme.borderStrong,
        },
        themeOptionActive: {
            borderColor: theme.brandAmber,
            backgroundColor: theme.brandAmberLight,
        },
        themeOptionActiveDark: {
            borderColor: theme.brandAmber,
            backgroundColor: `${theme.brandAmberLight}26`,
        },
        themeOptionCopy: {
            gap: 2,
        },
        themeOptionTitle: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.textPrimary,
        },
        themeOptionTitleActive: {
            color: theme.brandAmberText,
        },
        themeOptionTitleActiveDark: {
            color: theme.brandAmber,
        },
        themeOptionSublabel: {
            fontSize: 12,
            color: theme.textSecondary,
        },
        themeOptionSublabelActive: {
            color: theme.brandAmberText,
        },
        themeOptionSublabelActiveDark: {
            color: theme.brandAmber,
        },
        themeCheckmark: {
            fontSize: 12,
            fontWeight: '800',
            color: theme.brandAmber,
        },
        themeCheckmarkDark: {
            fontSize: 12,
            fontWeight: '800',
            color: theme.brandAmber,
        },
        healthInsetContainer: {
            marginTop: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surfaceHighlight,
            overflow: 'hidden',
        },
        darkHealthInsetContainer: {
            backgroundColor: theme.textInverse,
            borderColor: theme.border,
        },
        healthLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        healthSquircle: {
            width: 32,
            height: 32,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
        },
        healthSquircleSuccess: {
            backgroundColor: theme.successEmeraldLight,
        },
        darkHealthSquircleSuccess: {
            backgroundColor: `${theme.successEmeraldLight}60`,
        },
        healthSquircleWarning: {
            backgroundColor: theme.brandAmberLight,
        },
        darkHealthSquircleWarning: {
            backgroundColor: `${theme.brandAmberLight}60`,
        },
        healthSquircleNeutral: {
            backgroundColor: theme.canvas,
        },
        darkHealthSquircleNeutral: {
            backgroundColor: theme.border,
        },
        healthSquircleAttention: {
            backgroundColor: theme.hazardRedLight,
        },
        darkHealthSquircleAttention: {
            backgroundColor: `${theme.hazardRedLight}60`,
        },
        hairlineDivider: {
            height: StyleSheet.hairlineWidth,
            marginLeft: 54,
            backgroundColor: theme.border,
        },
        syncBtnContainer: {
            paddingHorizontal: 12,
            paddingBottom: 12,
            paddingTop: 4,
        },
        healthRows: {
            marginTop: 14,
            gap: 12,
        },
        healthRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 12,
            minHeight: 48,
        },
        healthLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.textSecondary,
        },
        healthValue: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.textPrimary,
        },
        healthValueWarning: {
            color: theme.brandAmber,
        },
        darkHealthValueWarning: {
            color: theme.brandAmberText,
        },
        healthValueAttention: {
            color: theme.hazardRed,
        },
        darkHealthValueAttention: {
            color: theme.hazardRedText,
        },
        healthValueMuted: {
            fontSize: 12,
            color: theme.textMuted,
        },
        statusPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        statusDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        statusDotOnline: {
            backgroundColor: theme.hudGlowEmerald,
        },
        statusDotOffline: {
            backgroundColor: theme.hazardRed,
        },
        viewOutboxBtn: {
            minHeight: 44,
            borderRadius: 10,
            backgroundColor: theme.actionCobaltLight,
            borderWidth: 1,
            borderColor: theme.actionCobalt,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 8,
        },
        darkViewOutboxBtn: {
            backgroundColor: `${theme.actionCobalt}26`,
            borderColor: `${theme.actionCobalt}59`,
        },
        viewOutboxBtnText: {
            fontSize: 13,
            fontWeight: '700',
            color: theme.actionCobalt,
        },
        darkViewOutboxBtnText: {
            color: theme.dutyDriving,
        },
        syncNowBtn: {
            minHeight: 48,
            borderRadius: 10,
            backgroundColor: theme.brandAmberLight,
            borderWidth: 1,
            borderColor: theme.brandAmberLight,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            alignItems: 'center',
        },
        syncNowBtnText: {
            fontSize: 13,
            fontWeight: '700',
            color: theme.brandAmberText,
        },
        pushPermBtn: {
            minHeight: 48,
            borderRadius: 10,
            backgroundColor: theme.canvas,
            justifyContent: 'center',
            alignItems: 'center',
        },
        darkPushPermBtn: {
            backgroundColor: theme.border,
        },
        pushPermBtnText: {
            fontSize: 13,
            fontWeight: '700',
            color: theme.textPrimary,
        },
        signOutCard: {
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.hazardRed,
            elevation: 1,
            overflow: 'hidden',
        },
        darkSignOutCard: {
            backgroundColor: theme.surface,
            borderColor: `${theme.hazardRedLight}60`,
        },
        signOutRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: 48,
        },
        signOutLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            flex: 1,
        },
        signOutIconWrap: {
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: theme.hazardRedLight,
            justifyContent: 'center',
            alignItems: 'center',
        },
        darkSignOutIconWrap: {
            backgroundColor: `${theme.hazardRedLight}40`,
        },
        signOutCopy: {
            flex: 1,
        },
        signOutTitle: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.hazardRed,
        },
        darkSignOutTitle: {
            color: theme.hazardRedText,
        },
        signOutDescription: {
            fontSize: 12,
            color: theme.textSecondary,
            marginTop: 1,
        },
        chevron: {
            fontSize: 18,
            color: theme.textMuted,
            fontWeight: '700',
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: `${theme.surfaceDark}B8`,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        modalScrim: {
            ...StyleSheet.absoluteFill,
        },
        confirmDialog: {
            width: '100%',
            maxWidth: 400,
            backgroundColor: theme.surface,
            borderRadius: 24,
            padding: 24,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: theme.surfaceDark,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 8,
        },
        confirmIconBadge: {
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: theme.hazardRedLight,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16,
        },
        confirmTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.textPrimary,
            textAlign: 'center',
            marginBottom: 8,
        },
        confirmMessage: {
            fontSize: 14,
            color: theme.textSecondary,
            textAlign: 'center',
            lineHeight: 20,
            marginBottom: 20,
        },
        warningCallout: {
            backgroundColor: theme.brandAmberLight,
            borderRadius: 10,
            padding: 12,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: theme.brandAmberLight,
        },
        warningCalloutText: {
            fontSize: 13,
            color: theme.brandAmberText,
            lineHeight: 18,
            textAlign: 'center',
            fontWeight: '500',
        },
        confirmActions: {
            flexDirection: 'row',
            gap: 12,
            width: '100%',
        },
        confirmCancelBtn: {
            flex: 1,
            minHeight: 48,
            borderRadius: 10,
            backgroundColor: theme.canvas,
            justifyContent: 'center',
            alignItems: 'center',
        },
        darkConfirmCancelBtn: {
            backgroundColor: theme.border,
        },
        confirmCancelText: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.textSecondary,
        },
        darkConfirmCancelText: {
            color: theme.textPrimary,
        },
        confirmSubmitBtn: {
            flex: 1,
            minHeight: 48,
            borderRadius: 10,
            backgroundColor: theme.hazardRed,
            justifyContent: 'center',
            alignItems: 'center',
        },
        confirmSubmitText: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.textOnDark,
        },
        pressed: {
            opacity: 0.75,
        },
        pressedCard: {
            transform: [{ scale: 0.98 }],
            opacity: 0.85,
        },
    });
