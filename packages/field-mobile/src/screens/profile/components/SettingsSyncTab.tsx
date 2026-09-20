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
import { colors } from '../../../components/nativeStyles';
import { projectOutbox } from '../../../services/outboxProjection';
import { useTheme } from '../../../theme';
import type { OutboxCommand } from '../../../types/index';

export interface SettingsSyncTabProps {
    isOnline?: boolean | null;
    isAuthenticated?: boolean;
    lastSuccessfulSyncAt?: string | null;
    queuedCount?: number;
    outboxCommands?: OutboxCommand[];
    pushNotificationsEnabled?: boolean;
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
    pushNotificationsEnabled = true,
    onSyncNow,
    onOpenOutboxDetails,
    onRequestPushPermissions,
    onLogout,
}) => {
    const { isDarkHud, setMode } = useTheme();
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
            <View style={[styles.card, isDarkHud && styles.darkCard]}>
                <Text
                    style={[
                        styles.cardTitle,
                        isDarkHud && styles.darkCardTitle,
                    ]}
                >
                    Display & Lighting
                </Text>
                <Text
                    style={[
                        styles.cardSubtitle,
                        isDarkHud && styles.darkCardSubtitle,
                    ]}
                >
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
                                        : isDarkHud
                                          ? styles.darkThemeIconSquircleInactive
                                          : styles.themeIconSquircleInactive,
                                ]}
                            >
                                <Icon
                                    color={
                                        !isDarkHud
                                            ? '#D97706'
                                            : isDarkHud
                                              ? '#F59E0B'
                                              : colors.secondary
                                    }
                                    name="sun"
                                    size={20}
                                />
                            </View>
                            <View
                                style={[
                                    styles.checkCircle,
                                    !isDarkHud
                                        ? styles.checkCircleActive
                                        : isDarkHud
                                          ? styles.darkCheckCircleInactive
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
                                    isDarkHud && styles.darkThemeOptionTitle,
                                    !isDarkHud && styles.themeOptionTitleActive,
                                ]}
                            >
                                Daylight
                            </Text>
                            <Text
                                style={[
                                    styles.themeOptionSublabel,
                                    isDarkHud && styles.darkThemeOptionSublabel,
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
                                        isDarkHud ? '#F59E0B' : colors.secondary
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
                                    isDarkHud && styles.darkThemeOptionTitle,
                                    isDarkHud &&
                                        styles.themeOptionTitleActiveDark,
                                ]}
                            >
                                Cockpit HUD
                            </Text>
                            <Text
                                style={[
                                    styles.themeOptionSublabel,
                                    isDarkHud && styles.darkThemeOptionSublabel,
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
            <View style={[styles.card, isDarkHud && styles.darkCard]}>
                <Text
                    style={[
                        styles.cardTitle,
                        isDarkHud && styles.darkCardTitle,
                    ]}
                >
                    System & Sync Health
                </Text>
                <Text
                    style={[
                        styles.cardSubtitle,
                        isDarkHud && styles.darkCardSubtitle,
                    ]}
                >
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
                                            ? isDarkHud
                                                ? '#F87171'
                                                : '#DC2626'
                                            : isDarkHud
                                              ? '#34D399'
                                              : '#059669'
                                    }
                                    name="cloud"
                                    size={18}
                                />
                            </View>
                            <Text
                                style={[
                                    styles.healthLabel,
                                    isDarkHud && styles.darkHealthLabel,
                                ]}
                            >
                                Connection
                            </Text>
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

                    <View
                        style={[
                            styles.hairlineDivider,
                            isDarkHud && styles.darkHairlineDivider,
                        ]}
                    />

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
                                            ? '#EF4444'
                                            : pendingCount > 0
                                              ? isDarkHud
                                                  ? '#FBBF24'
                                                  : '#D97706'
                                              : isDarkHud
                                                ? '#34D399'
                                                : '#059669'
                                    }
                                    name="sync"
                                    size={18}
                                />
                            </View>
                            <Text
                                style={[
                                    styles.healthLabel,
                                    isDarkHud && styles.darkHealthLabel,
                                ]}
                            >
                                Outbox Data
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.healthValue,
                                isDarkHud && styles.darkHealthValue,
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
                                    color={isDarkHud ? '#60A5FA' : '#2563EB'}
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
                                    isDarkHud && styles.darkSyncNowBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="sync-outbox-now-btn"
                            >
                                <Icon
                                    color={isDarkHud ? '#FDE68A' : '#B45309'}
                                    name="sync"
                                    size={16}
                                />
                                <Text
                                    style={[
                                        styles.syncNowBtnText,
                                        isDarkHud && styles.darkSyncNowBtnText,
                                    ]}
                                >
                                    Sync Outbox Now ({queuedCount})
                                </Text>
                            </Pressable>
                        </View>
                    ) : null}

                    <View
                        style={[
                            styles.hairlineDivider,
                            isDarkHud && styles.darkHairlineDivider,
                        ]}
                    />

                    {/* Push Alerts Row */}
                    <View style={styles.healthRow}>
                        <View style={styles.healthLeft}>
                            <View
                                style={[
                                    styles.healthSquircle,
                                    pushNotificationsEnabled === false
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
                                        pushNotificationsEnabled === false
                                            ? isDarkHud
                                                ? '#94A3B8'
                                                : '#64748B'
                                            : isDarkHud
                                              ? '#34D399'
                                              : '#059669'
                                    }
                                    name="bell"
                                    size={18}
                                />
                            </View>
                            <Text
                                style={[
                                    styles.healthLabel,
                                    isDarkHud && styles.darkHealthLabel,
                                ]}
                            >
                                Push Alerts
                            </Text>
                        </View>
                        <View style={styles.statusPill}>
                            <View
                                style={[
                                    styles.statusDot,
                                    pushNotificationsEnabled === false
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
                                {pushNotificationsEnabled === false
                                    ? 'Disabled'
                                    : 'Active'}
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
                                <Text
                                    style={[
                                        styles.pushPermBtnText,
                                        isDarkHud && styles.darkPushPermBtnText,
                                    ]}
                                >
                                    Enable Push Alerts
                                </Text>
                            </Pressable>
                        </View>
                    ) : null}

                    <View
                        style={[
                            styles.hairlineDivider,
                            isDarkHud && styles.darkHairlineDivider,
                        ]}
                    />

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
                                    color={isDarkHud ? '#94A3B8' : '#64748B'}
                                    name="smartphone"
                                    size={18}
                                />
                            </View>
                            <Text
                                style={[
                                    styles.healthLabel,
                                    isDarkHud && styles.darkHealthLabel,
                                ]}
                            >
                                Field App Version
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.healthValueMuted,
                                isDarkHud && styles.darkHealthValueMuted,
                            ]}
                        >
                            v1.0.0 (Core-2 Field Mobile)
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
                                color={isDarkHud ? '#F87171' : '#DC2626'}
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
                            <Text
                                style={[
                                    styles.signOutDescription,
                                    isDarkHud && styles.darkSignOutDescription,
                                ]}
                            >
                                End this field session on this device
                            </Text>
                        </View>
                    </View>
                    <Icon
                        color={isDarkHud ? '#94A3B8' : '#64748B'}
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
                    <View
                        style={[
                            styles.confirmDialog,
                            isDarkHud && styles.darkConfirmDialog,
                        ]}
                    >
                        <View style={styles.confirmIconBadge}>
                            <Icon color="#DC2626" name="log-out" size={24} />
                        </View>

                        <Text
                            accessibilityRole="header"
                            style={[
                                styles.confirmTitle,
                                isDarkHud && styles.darkConfirmTitle,
                            ]}
                        >
                            Sign out of the field app?
                        </Text>

                        {queuedCount > 0 ? (
                            <View style={styles.warningCallout}>
                                <Text style={styles.warningCalloutText}>
                                    You have {queuedCount} unsynced action(s)
                                    stored on this device. Signing out will
                                    pause syncing until you log back in.
                                </Text>
                            </View>
                        ) : (
                            <Text
                                style={[
                                    styles.confirmMessage,
                                    isDarkHud && styles.darkConfirmMessage,
                                ]}
                            >
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

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1,
        overflow: 'hidden',
    },
    darkCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    darkCardTitle: {
        color: '#F8FAFC',
    },
    cardSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    darkCardSubtitle: {
        color: '#94A3B8',
    },
    themeSelectorCard: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 14,
    },
    darkThemeSelectorCard: {},
    darkThemeOption: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    themeOption: {
        flex: 1,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
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
        backgroundColor: '#FEF3C7',
    },
    themeIconSquircleActiveDark: {
        backgroundColor: '#78350F40',
    },
    themeIconSquircleInactive: {
        backgroundColor: '#E2E8F0',
    },
    darkThemeIconSquircleInactive: {
        backgroundColor: '#334155',
    },
    checkCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkCircleActive: {
        backgroundColor: '#FEF3C7',
        borderWidth: 1.5,
        borderColor: '#D97706',
    },
    checkCircleActiveDark: {
        backgroundColor: '#78350F',
        borderWidth: 1.5,
        borderColor: '#F59E0B',
    },
    checkCircleInactive: {
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
    },
    darkCheckCircleInactive: {
        borderWidth: 1.5,
        borderColor: '#475569',
    },
    themeOptionActive: {
        borderColor: '#D97706',
        backgroundColor: '#FFFBEB',
    },
    themeOptionActiveDark: {
        borderColor: '#F59E0B',
        backgroundColor: '#78350F26',
    },
    themeOptionCopy: {
        gap: 2,
    },
    themeOptionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    themeOptionTitleActive: {
        color: '#B45309',
    },
    themeOptionTitleActiveDark: {
        color: '#FDE68A',
    },
    darkThemeOptionTitle: {
        color: '#F8FAFC',
    },
    themeOptionSublabel: {
        fontSize: 11,
        color: '#64748B',
    },
    themeOptionSublabelActive: {
        color: '#92400E',
    },
    themeOptionSublabelActiveDark: {
        color: '#FCD34D',
    },
    darkThemeOptionSublabel: {
        color: '#94A3B8',
    },
    themeCheckmark: {
        fontSize: 12,
        fontWeight: '800',
        color: '#D97706',
    },
    themeCheckmarkDark: {
        fontSize: 12,
        fontWeight: '800',
        color: '#F59E0B',
    },
    healthInsetContainer: {
        marginTop: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
        overflow: 'hidden',
    },
    darkHealthInsetContainer: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
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
        backgroundColor: '#ECFDF5',
    },
    darkHealthSquircleSuccess: {
        backgroundColor: '#064E3B60',
    },
    healthSquircleWarning: {
        backgroundColor: '#FEF3C7',
    },
    darkHealthSquircleWarning: {
        backgroundColor: '#78350F60',
    },
    healthSquircleNeutral: {
        backgroundColor: '#F1F5F9',
    },
    darkHealthSquircleNeutral: {
        backgroundColor: '#334155',
    },
    healthSquircleAttention: {
        backgroundColor: '#FEE2E2',
    },
    darkHealthSquircleAttention: {
        backgroundColor: '#7F1D1D60',
    },
    hairlineDivider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 54,
        backgroundColor: '#E2E8F0',
    },
    darkHairlineDivider: {
        backgroundColor: '#334155',
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
        color: '#475569',
    },
    darkHealthLabel: {
        color: '#94A3B8',
    },
    healthValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0F172A',
    },
    darkHealthValue: {
        color: '#F8FAFC',
    },
    healthValueWarning: {
        color: '#D97706',
    },
    darkHealthValueWarning: {
        color: '#FBBF24',
    },
    healthValueAttention: {
        color: '#DC2626',
    },
    darkHealthValueAttention: {
        color: '#F87171',
    },
    healthValueMuted: {
        fontSize: 12,
        color: '#94A3B8',
    },
    darkHealthValueMuted: {
        color: '#64748B',
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
        backgroundColor: '#10B981',
    },
    statusDotOffline: {
        backgroundColor: '#EF4444',
    },
    viewOutboxBtn: {
        minHeight: 44,
        borderRadius: 10,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    darkViewOutboxBtn: {
        backgroundColor: 'rgba(37, 99, 235, 0.15)',
        borderColor: 'rgba(37, 99, 235, 0.35)',
    },
    viewOutboxBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#2563EB',
    },
    darkViewOutboxBtnText: {
        color: '#60A5FA',
    },
    syncNowBtn: {
        minHeight: 48,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    darkSyncNowBtn: {
        backgroundColor: '#78350F',
        borderColor: '#B45309',
    },
    syncNowBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#B45309',
    },
    darkSyncNowBtnText: {
        color: '#FDE68A',
    },
    pushPermBtn: {
        minHeight: 48,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    darkPushPermBtn: {
        backgroundColor: '#334155',
    },
    pushPermBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
    },
    darkPushPermBtnText: {
        color: '#F8FAFC',
    },
    signOutCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#FECACA',
        elevation: 1,
        overflow: 'hidden',
    },
    darkSignOutCard: {
        backgroundColor: '#1E293B',
        borderColor: '#7F1D1D60',
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
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    darkSignOutIconWrap: {
        backgroundColor: '#7F1D1D40',
    },
    signOutCopy: {
        flex: 1,
    },
    signOutTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#DC2626',
    },
    darkSignOutTitle: {
        color: '#F87171',
    },
    signOutDescription: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 1,
    },
    darkSignOutDescription: {
        color: '#94A3B8',
    },
    chevron: {
        fontSize: 18,
        color: '#94A3B8',
        fontWeight: '700',
    },
    darkChevron: {
        color: '#64748B',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.72)',
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
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    darkConfirmDialog: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    confirmIconBadge: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    confirmTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 8,
    },
    darkConfirmTitle: {
        color: '#F8FAFC',
    },
    confirmMessage: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    darkConfirmMessage: {
        color: '#94A3B8',
    },
    warningCallout: {
        backgroundColor: '#FEF3C7',
        borderRadius: 10,
        padding: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    warningCalloutText: {
        fontSize: 13,
        color: '#92400E',
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
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    darkConfirmCancelBtn: {
        backgroundColor: '#334155',
    },
    confirmCancelText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
    },
    darkConfirmCancelText: {
        color: '#E2E8F0',
    },
    confirmSubmitBtn: {
        flex: 1,
        minHeight: 48,
        borderRadius: 10,
        backgroundColor: '#DC2626',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmSubmitText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    pressed: {
        opacity: 0.75,
    },
    pressedCard: {
        transform: [{ scale: 0.98 }],
        opacity: 0.85,
    },
});
