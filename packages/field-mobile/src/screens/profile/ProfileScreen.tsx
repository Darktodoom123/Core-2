import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    Vibration,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/common/Icon';
import type { FieldApiClient } from '../../services/apiClient';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { AccountDetailsResponse } from '../../types/account';
import type { OutboxCommand } from '../../types/index';
import { AccountUnavailable } from './components/AccountUnavailable';
import { ActivityTab } from './components/ActivityTab';
import { ConfirmPasswordModal } from './components/ConfirmPasswordModal';
import { EmailChangeModal } from './components/EmailChangeModal';
import { OtpSecurityModal } from './components/OtpSecurityModal';
import { ProfileInfoTab } from './components/ProfileInfoTab';
import { SecurityTab } from './components/SecurityTab';
import { SettingsSyncTab } from './components/SettingsSyncTab';

// Shown instead of the raw network error, which means nothing to an operator.
const REFRESH_FAILED =
    "Couldn't refresh your account. Showing the details last loaded.";

export type ProfileTab = 'profile' | 'security' | 'activity' | 'settings';

export interface ProfileScreenProps {
    apiClient: FieldApiClient;
    initialAccountData?: AccountDetailsResponse | null;
    assignedAssetLabel?: string | null;
    isOnline?: boolean | null;
    queuedCount?: number;
    outboxCommands?: OutboxCommand[];
    /** Null while the device permission is still being checked. */
    pushNotificationsEnabled?: boolean | null;
    onRequestPushPermissions?: () => void;
    onSyncNow?: () => void;
    onOpenOutboxDetails?: () => void;
    onLogout?: () => void;
    onBack: () => void;
    initialTab?: ProfileTab;
    userName?: string | null;
    userRole?: string | null;
    isAuthenticated?: boolean;
    lastSuccessfulSyncAt?: string | null;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
    apiClient,
    initialAccountData = null,
    assignedAssetLabel,
    isOnline = true,
    isAuthenticated = true,
    lastSuccessfulSyncAt,
    queuedCount = 0,
    outboxCommands,
    pushNotificationsEnabled = null,
    onRequestPushPermissions,
    onSyncNow,
    onOpenOutboxDetails,
    onLogout,
    onBack,
    initialTab = 'profile',
    userName,
}) => {
    const { isDarkHud, theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
    const [accountData, setAccountData] =
        useState<AccountDetailsResponse | null>(initialAccountData);
    const [isLoading, setIsLoading] = useState(!initialAccountData);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modals
    const [emailModalVisible, setEmailModalVisible] = useState(false);
    const [otpModalVisible, setOtpModalVisible] = useState(false);
    const [otpAction, setOtpAction] = useState<'enable' | 'disable'>('enable');

    // Confirm password modal for revoking other sessions
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [confirmModalError, setConfirmModalError] = useState<string | null>(
        null,
    );
    const [isRevokingOthers, setIsRevokingOthers] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    const fetchAccountData = useCallback(async () => {
        try {
            const data = await apiClient.getAccountDetails();
            setAccountData(data);
            setError(null);
        } catch {
            setError(REFRESH_FAILED);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [apiClient]);

    useEffect(() => {
        let isMounted = true;

        apiClient
            .getAccountDetails()
            .then((data) => {
                if (isMounted) {
                    setAccountData(data);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setError(REFRESH_FAILED);
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoading(false);
                    setRefreshing(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [apiClient]);

    const handleRefresh = async () => {
        setRefreshing(true);
        setError(null);
        await fetchAccountData();
    };

    const handleConfirmRevokeOtherSessions = async (password: string) => {
        setIsRevokingOthers(true);
        setConfirmModalError(null);

        try {
            const res = await apiClient.revokeOtherSessions({
                currentPassword: password,
            });
            setConfirmModalVisible(false);
            setConfirmModalError(null);
            showToast(
                res.message || 'All other sessions have been signed out.',
            );
            void fetchAccountData();
        } catch (err: any) {
            setConfirmModalError(
                err.message ||
                    'The provided password does not match our records.',
            );
        } finally {
            setIsRevokingOthers(false);
        }
    };

    // Account tabs show only what the server returned. Without it they say
    // so; Settings (theme, sync, sign out) works without the account.
    const needsAccount = activeTab !== 'settings';
    const signedInAs = accountData?.profile.name || userName;

    const handleTabSwitch = (tab: ProfileTab) => {
        if (tab !== activeTab) {
            try {
                // Tactile selection feedback (Apple iOS / Linear HIG)
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const Haptics = require('expo-haptics');
                Haptics.selectionAsync?.();
            } catch {
                try {
                    Vibration.vibrate(8);
                } catch {
                    // Ignore in testing/unsupported environments
                }
            }

            setActiveTab(tab);
        }
    };

    // Bottom inset only: the navigator already pads for the status bar.
    return (
        <SafeAreaView
            edges={['bottom']}
            style={[styles.safeArea, isDarkHud && styles.darkSafeArea]}
            testID="profile-screen"
        >
            {/* Top Bar */}
            <View style={[styles.topBar]}>
                <Pressable
                    accessibilityLabel="Back"
                    accessibilityRole="button"
                    onPress={onBack}
                    style={({ pressed }) => [
                        styles.backBtn,
                        isDarkHud && styles.darkBackBtn,
                        pressed && styles.pressed,
                    ]}
                    testID="profile-screen-back"
                >
                    <Icon color={theme.textPrimary} name="back" size={22} />
                </Pressable>

                <View style={styles.topBarCenter}>
                    <Text
                        accessibilityRole="header"
                        style={[styles.screenTitle]}
                    >
                        Account & Security
                    </Text>
                    <Text style={[styles.screenSubtitle]}>
                        {signedInAs
                            ? `Signed in as ${signedInAs}`
                            : 'Your account'}
                    </Text>
                </View>

                <View
                    style={[
                        styles.statusPill,
                        isDarkHud && styles.darkStatusPill,
                    ]}
                >
                    <View
                        style={[
                            styles.beaconRing,
                            isOnline === false
                                ? styles.beaconRingOffline
                                : styles.beaconRingOnline,
                        ]}
                    >
                        <View
                            style={[
                                styles.statusDot,
                                isOnline === false
                                    ? styles.statusDotOffline
                                    : styles.statusDotOnline,
                            ]}
                        />
                    </View>
                    <Text style={[styles.statusText]}>
                        {isOnline === false ? 'Offline' : 'Online'}
                    </Text>
                </View>
            </View>

            {/* Apple/Linear Continuous Sliding Pill Segmented Navigation */}
            <View style={styles.segmentedTrackWrapper}>
                <View
                    style={[
                        styles.segmentedTrack,
                        isDarkHud && styles.darkSegmentedTrack,
                    ]}
                >
                    <Pressable
                        accessibilityLabel="Profile Tab"
                        accessibilityRole="tab"
                        accessibilityState={{
                            selected: activeTab === 'profile',
                        }}
                        onPress={() => handleTabSwitch('profile')}
                        style={({ pressed }) => [
                            styles.tabPill,
                            activeTab === 'profile' && styles.tabPillActive,
                            activeTab === 'profile' &&
                                isDarkHud &&
                                styles.darkTabPillActive,
                            pressed && styles.tabPillPressed,
                        ]}
                        testID="tab-profile"
                    >
                        <Icon
                            color={
                                activeTab === 'profile'
                                    ? theme.brandAmberText
                                    : theme.textSecondary
                            }
                            name="profile"
                            size={16}
                        />
                        <Text
                            style={[
                                styles.tabBtnText,
                                activeTab === 'profile' &&
                                    styles.tabBtnTextActive,
                            ]}
                        >
                            Profile
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Security Tab"
                        accessibilityRole="tab"
                        accessibilityState={{
                            selected: activeTab === 'security',
                        }}
                        onPress={() => handleTabSwitch('security')}
                        style={({ pressed }) => [
                            styles.tabPill,
                            activeTab === 'security' && styles.tabPillActive,
                            activeTab === 'security' &&
                                isDarkHud &&
                                styles.darkTabPillActive,
                            pressed && styles.tabPillPressed,
                        ]}
                        testID="tab-security"
                    >
                        <Icon
                            color={
                                activeTab === 'security'
                                    ? theme.brandAmberText
                                    : theme.textSecondary
                            }
                            name="shield"
                            size={16}
                        />
                        <Text
                            style={[
                                styles.tabBtnText,
                                activeTab === 'security' &&
                                    styles.tabBtnTextActive,
                            ]}
                        >
                            Security
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Activity Tab"
                        accessibilityRole="tab"
                        accessibilityState={{
                            selected: activeTab === 'activity',
                        }}
                        onPress={() => handleTabSwitch('activity')}
                        style={({ pressed }) => [
                            styles.tabPill,
                            activeTab === 'activity' && styles.tabPillActive,
                            activeTab === 'activity' &&
                                isDarkHud &&
                                styles.darkTabPillActive,
                            pressed && styles.tabPillPressed,
                        ]}
                        testID="tab-activity"
                    >
                        <Icon
                            color={
                                activeTab === 'activity'
                                    ? theme.brandAmberText
                                    : theme.textSecondary
                            }
                            name="clock"
                            size={16}
                        />
                        <Text
                            style={[
                                styles.tabBtnText,
                                activeTab === 'activity' &&
                                    styles.tabBtnTextActive,
                            ]}
                        >
                            Activity
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Settings Tab"
                        accessibilityRole="tab"
                        accessibilityState={{
                            selected: activeTab === 'settings',
                        }}
                        onPress={() => handleTabSwitch('settings')}
                        style={({ pressed }) => [
                            styles.tabPill,
                            activeTab === 'settings' && styles.tabPillActive,
                            activeTab === 'settings' &&
                                isDarkHud &&
                                styles.darkTabPillActive,
                            pressed && styles.tabPillPressed,
                        ]}
                        testID="tab-settings"
                    >
                        <Icon
                            color={
                                activeTab === 'settings'
                                    ? theme.brandAmberText
                                    : theme.textSecondary
                            }
                            name="settings"
                            size={16}
                        />
                        <Text
                            style={[
                                styles.tabBtnText,
                                activeTab === 'settings' &&
                                    styles.tabBtnTextActive,
                            ]}
                        >
                            Settings
                        </Text>
                    </Pressable>
                </View>
            </View>

            {/* Global Toast Alert Banner */}
            {toastMessage ? (
                <View style={styles.toastBanner}>
                    <Text style={styles.toastText}>{toastMessage}</Text>
                </View>
            ) : null}

            {/* Error Banner with Retry */}
            {/* Without account data the unavailable panel says it instead. */}
            {error && accountData ? (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{error}</Text>
                    <Pressable
                        accessibilityLabel="Retry loading profile"
                        onPress={fetchAccountData}
                        style={styles.retryBtn}
                    >
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </Pressable>
                </View>
            ) : null}

            {/* Main Content Area */}
            {needsAccount && isLoading && !refreshing && !accountData ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator
                        color={theme.brandAmberText}
                        size="large"
                    />
                    <Text style={[styles.loadingText]}>
                        Loading account state...
                    </Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            colors={[theme.brandAmber]}
                            onRefresh={handleRefresh}
                            refreshing={refreshing}
                            tintColor={theme.brandAmberText}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                    testID="profile-screen-content"
                >
                    {needsAccount && !accountData ? (
                        <AccountUnavailable
                            isOnline={isOnline}
                            onRetry={handleRefresh}
                        />
                    ) : null}

                    {activeTab === 'profile' && accountData ? (
                        <ProfileInfoTab
                            apiClient={apiClient}
                            assignedAssetLabel={assignedAssetLabel}
                            isOnline={isOnline}
                            onEmailChangeClick={() =>
                                setEmailModalVisible(true)
                            }
                            onPhoneUpdated={(newPhone) => {
                                if (accountData) {
                                    setAccountData({
                                        ...accountData,
                                        profile: {
                                            ...accountData.profile,
                                            phone: newPhone,
                                        },
                                    });
                                }
                            }}
                            profile={accountData.profile}
                        />
                    ) : null}

                    {activeTab === 'security' && accountData ? (
                        <SecurityTab
                            apiClient={apiClient}
                            onOpenOtpModal={(action) => {
                                setOtpAction(action);
                                setOtpModalVisible(true);
                            }}
                            onSecurityUpdated={fetchAccountData}
                            role={accountData.profile.role}
                            security={accountData.security}
                            trustedDevices={accountData.trusted_devices ?? []}
                            userEmail={accountData.profile.email}
                        />
                    ) : null}

                    {activeTab === 'activity' && accountData ? (
                        <ActivityTab
                            apiClient={apiClient}
                            onRevokeOthersClick={() => {
                                setConfirmModalError(null);
                                setConfirmModalVisible(true);
                            }}
                            onSessionsUpdated={fetchAccountData}
                            recentActivity={accountData.recent_activity}
                            sessions={accountData.sessions ?? []}
                        />
                    ) : null}

                    {activeTab === 'settings' ? (
                        <SettingsSyncTab
                            isAuthenticated={isAuthenticated}
                            isOnline={isOnline}
                            lastSuccessfulSyncAt={lastSuccessfulSyncAt}
                            onLogout={onLogout}
                            onOpenOutboxDetails={onOpenOutboxDetails}
                            onRequestPushPermissions={onRequestPushPermissions}
                            onSyncNow={onSyncNow}
                            outboxCommands={outboxCommands}
                            pushNotificationsEnabled={pushNotificationsEnabled}
                            queuedCount={queuedCount}
                        />
                    ) : null}
                </ScrollView>
            )}

            {/* Email Change Re-authentication & Verification Modal */}
            <EmailChangeModal
                apiClient={apiClient}
                currentEmail={accountData?.profile.email ?? ''}
                onClose={() => setEmailModalVisible(false)}
                onSuccess={(newEmail) => {
                    showToast('Email updated and verified successfully.');

                    if (accountData) {
                        setAccountData({
                            ...accountData,
                            profile: {
                                ...accountData.profile,
                                email: newEmail,
                            },
                        });
                    }
                }}
                visible={emailModalVisible}
            />

            {/* 2FA Enable/Disable OTP Wizard Modal */}
            <OtpSecurityModal
                action={otpAction}
                apiClient={apiClient}
                onClose={() => setOtpModalVisible(false)}
                onSuccess={(newStatus) => {
                    showToast(
                        newStatus
                            ? 'Two-factor authentication enabled successfully.'
                            : 'Two-factor authentication disabled.',
                    );

                    if (accountData) {
                        setAccountData({
                            ...accountData,
                            security: {
                                ...accountData.security,
                                email_otp_enabled: newStatus,
                            },
                        });
                    }
                }}
                visible={otpModalVisible}
            />

            {/* Confirm Password Modal for Revoking Other Sessions */}
            <ConfirmPasswordModal
                confirmLabel="Sign Out Others"
                description="Enter your current password to sign out all other web sessions and device trust."
                errorMessage={confirmModalError}
                isDestructive={true}
                isLoading={isRevokingOthers}
                onClose={() => {
                    setConfirmModalError(null);
                    setConfirmModalVisible(false);
                }}
                onConfirm={handleConfirmRevokeOtherSessions}
                title="Sign Out Other Sessions"
                visible={confirmModalVisible}
            />
        </SafeAreaView>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: theme.surfaceHighlight,
        },
        darkSafeArea: {
            backgroundColor: theme.canvas,
        },
        topBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: theme.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        backBtn: {
            width: 48,
            height: 48,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.canvas,
            borderWidth: 1,
            borderColor: theme.border,
        },
        darkBackBtn: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
        },
        topBarCenter: {
            flex: 1,
            marginHorizontal: 12,
        },
        screenTitle: {
            fontSize: 17,
            fontWeight: '800',
            color: theme.textPrimary,
            letterSpacing: -0.3,
        },
        screenSubtitle: {
            fontSize: 12,
            fontWeight: '500',
            color: theme.textSecondary,
        },
        statusPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: theme.canvas,
            borderWidth: 1,
            borderColor: theme.border,
        },
        darkStatusPill: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
        },
        beaconRing: {
            width: 14,
            height: 14,
            borderRadius: 7,
            justifyContent: 'center',
            alignItems: 'center',
        },
        beaconRingOnline: {
            backgroundColor: `${theme.hudGlowEmerald}40`,
        },
        beaconRingOffline: {
            backgroundColor: `${theme.hazardRed}40`,
        },
        statusDot: {
            width: 7,
            height: 7,
            borderRadius: 3.5,
        },
        statusDotOnline: {
            backgroundColor: theme.hudGlowEmerald,
        },
        statusDotOffline: {
            backgroundColor: theme.hazardRed,
        },
        statusText: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.textPrimary,
        },
        segmentedTrackWrapper: {
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 4,
        },
        segmentedTrack: {
            flexDirection: 'row',
            alignItems: 'center',
            height: 48,
            borderRadius: 14,
            padding: 4,
            backgroundColor: theme.canvas,
            borderWidth: 1,
            borderColor: theme.border,
        },
        darkSegmentedTrack: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
        },
        tabPill: {
            flex: 1,
            height: '100%',
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: 'transparent',
        },
        tabPillActive: {
            backgroundColor: theme.surface,
            shadowColor: theme.surfaceDark,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 2,
        },
        darkTabPillActive: {
            backgroundColor: theme.surfaceHighlight,
            borderWidth: 1,
            borderColor: `${theme.brandAmber}59`,
            shadowColor: theme.brandAmberText,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 3,
            elevation: 2,
        },
        tabPillPressed: {
            transform: [{ scale: 0.98 }],
        },
        tabBtnText: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.textSecondary,
        },
        tabBtnTextActive: {
            color: theme.brandAmberText,
            fontWeight: '700',
        },
        toastBanner: {
            backgroundColor: theme.hudGlowEmerald,
            paddingVertical: 10,
            paddingHorizontal: 16,
            marginHorizontal: 16,
            marginTop: 10,
            borderRadius: 8,
        },
        toastText: {
            color: theme.surfaceDark,
            fontSize: 13,
            fontWeight: '600',
            textAlign: 'center',
        },
        errorBanner: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: theme.hazardRedLight,
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginHorizontal: 16,
            marginTop: 10,
            borderRadius: 8,
        },
        errorBannerText: {
            color: theme.hazardRed,
            fontSize: 12,
            fontWeight: '600',
            flex: 1,
        },
        retryBtn: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            backgroundColor: theme.hazardRed,
            borderRadius: 6,
        },
        retryBtnText: {
            color: theme.textOnDark,
            fontSize: 12,
            fontWeight: '700',
        },
        scrollContent: {
            padding: 16,
            gap: 16,
            paddingBottom: 40,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
        },
        loadingText: {
            fontSize: 14,
            color: theme.textSecondary,
        },
        pressed: {
            opacity: 0.75,
        },
    });
