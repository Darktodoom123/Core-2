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
import { useTheme } from '../../theme';
import type { AccountDetailsResponse } from '../../types/account';
import { ActivityTab } from './components/ActivityTab';
import { ConfirmPasswordModal } from './components/ConfirmPasswordModal';
import { EmailChangeModal } from './components/EmailChangeModal';
import { OtpSecurityModal } from './components/OtpSecurityModal';
import { ProfileInfoTab } from './components/ProfileInfoTab';
import { SecurityTab } from './components/SecurityTab';
import { SettingsSyncTab } from './components/SettingsSyncTab';

export type ProfileTab = 'profile' | 'security' | 'activity' | 'settings';

export interface ProfileScreenProps {
    apiClient: FieldApiClient;
    initialAccountData?: AccountDetailsResponse | null;
    assignedAssetLabel?: string | null;
    isOnline?: boolean | null;
    queuedCount?: number;
    pushNotificationsEnabled?: boolean;
    onRequestPushPermissions?: () => void;
    onSyncNow?: () => void;
    onLogout?: () => void;
    onBack: () => void;
    initialTab?: ProfileTab;
    userName?: string | null;
    userRole?: string | null;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
    apiClient,
    initialAccountData = null,
    assignedAssetLabel,
    isOnline = true,
    queuedCount = 0,
    pushNotificationsEnabled = true,
    onRequestPushPermissions,
    onSyncNow,
    onLogout,
    onBack,
    initialTab = 'profile',
    userName,
    userRole,
}) => {
    const { isDarkHud } = useTheme();
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
        } catch (err: any) {
            setError(err.message || 'Failed to load profile details.');
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
            .catch((err: any) => {
                if (isMounted) {
                    setError(err.message || 'Failed to load profile details.');
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

    // Fallback profile data if API call is loading or in offline mode
    const resolvedProfile = accountData?.profile ?? {
        name: userName || 'Field Operator',
        username: userName?.toLowerCase().replace(/\s+/g, '.') || 'operator',
        email: 'operator@core2.test',
        email_verified: true,
        phone: null,
        role: userRole || 'crane_operator',
        role_label: userRole?.replaceAll('_', ' ') || 'Crane Operator',
        account_status: 'active' as const,
        account_status_label: 'Active',
        permissions: ['dispatch.read', 'dvir.execute', 'hos.log'],
    };

    const resolvedSecurity = accountData?.security ?? {
        email_otp_enabled: false,
        has_verified_email: true,
    };

    const resolvedTrustedDevices = accountData?.trusted_devices ?? [];
    const resolvedSessions = accountData?.sessions ?? [];
    const resolvedActivity = accountData?.recent_activity ?? {
        data: [],
        current_page: 1,
        last_page: 1,
        prev_page_url: null,
        next_page_url: null,
        total: 0,
    };

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

    return (
        <SafeAreaView
            edges={['top', 'bottom']}
            style={[styles.safeArea, isDarkHud && styles.darkSafeArea]}
            testID="profile-screen"
        >
            {/* Top Bar */}
            <View style={[styles.topBar, isDarkHud && styles.darkTopBar]}>
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
                    <Icon
                        color={isDarkHud ? '#F8FAFC' : '#0F172A'}
                        name="back"
                        size={22}
                    />
                </Pressable>

                <View style={styles.topBarCenter}>
                    <Text
                        accessibilityRole="header"
                        style={[
                            styles.screenTitle,
                            isDarkHud && styles.darkScreenTitle,
                        ]}
                    >
                        Account & Security
                    </Text>
                    <Text
                        style={[
                            styles.screenSubtitle,
                            isDarkHud && styles.darkScreenSubtitle,
                        ]}
                    >
                        Core-2 Identity Parity
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
                    <Text
                        style={[
                            styles.statusText,
                            isDarkHud && styles.darkStatusText,
                        ]}
                    >
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
                                    ? isDarkHud
                                        ? '#F59E0B'
                                        : '#D97706'
                                    : isDarkHud
                                      ? '#94A3B8'
                                      : '#64748B'
                            }
                            name="profile"
                            size={16}
                        />
                        <Text
                            style={[
                                styles.tabBtnText,
                                isDarkHud && styles.darkTabBtnText,
                                activeTab === 'profile' &&
                                    styles.tabBtnTextActive,
                                activeTab === 'profile' &&
                                    isDarkHud &&
                                    styles.darkTabBtnTextActive,
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
                                    ? isDarkHud
                                        ? '#F59E0B'
                                        : '#D97706'
                                    : isDarkHud
                                      ? '#94A3B8'
                                      : '#64748B'
                            }
                            name="shield"
                            size={16}
                        />
                        <Text
                            style={[
                                styles.tabBtnText,
                                isDarkHud && styles.darkTabBtnText,
                                activeTab === 'security' &&
                                    styles.tabBtnTextActive,
                                activeTab === 'security' &&
                                    isDarkHud &&
                                    styles.darkTabBtnTextActive,
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
                                    ? isDarkHud
                                        ? '#F59E0B'
                                        : '#D97706'
                                    : isDarkHud
                                      ? '#94A3B8'
                                      : '#64748B'
                            }
                            name="clock"
                            size={16}
                        />
                        <Text
                            style={[
                                styles.tabBtnText,
                                isDarkHud && styles.darkTabBtnText,
                                activeTab === 'activity' &&
                                    styles.tabBtnTextActive,
                                activeTab === 'activity' &&
                                    isDarkHud &&
                                    styles.darkTabBtnTextActive,
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
                                    ? isDarkHud
                                        ? '#F59E0B'
                                        : '#D97706'
                                    : isDarkHud
                                      ? '#94A3B8'
                                      : '#64748B'
                            }
                            name="settings"
                            size={16}
                        />
                        <Text
                            style={[
                                styles.tabBtnText,
                                isDarkHud && styles.darkTabBtnText,
                                activeTab === 'settings' &&
                                    styles.tabBtnTextActive,
                                activeTab === 'settings' &&
                                    isDarkHud &&
                                    styles.darkTabBtnTextActive,
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
            {error ? (
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
            {isLoading && !refreshing && !accountData ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator
                        color={isDarkHud ? '#F59E0B' : '#D97706'}
                        size="large"
                    />
                    <Text
                        style={[
                            styles.loadingText,
                            isDarkHud && styles.darkLoadingText,
                        ]}
                    >
                        Loading account state...
                    </Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            colors={['#D97706']}
                            onRefresh={handleRefresh}
                            refreshing={refreshing}
                            tintColor={isDarkHud ? '#F59E0B' : '#D97706'}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {activeTab === 'profile' ? (
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
                            profile={resolvedProfile}
                        />
                    ) : null}

                    {activeTab === 'security' ? (
                        <SecurityTab
                            apiClient={apiClient}
                            onOpenOtpModal={(action) => {
                                setOtpAction(action);
                                setOtpModalVisible(true);
                            }}
                            onSecurityUpdated={fetchAccountData}
                            role={resolvedProfile.role}
                            security={resolvedSecurity}
                            trustedDevices={resolvedTrustedDevices}
                            userEmail={resolvedProfile.email}
                        />
                    ) : null}

                    {activeTab === 'activity' ? (
                        <ActivityTab
                            apiClient={apiClient}
                            onRevokeOthersClick={() => {
                                setConfirmModalError(null);
                                setConfirmModalVisible(true);
                            }}
                            onSessionsUpdated={fetchAccountData}
                            recentActivity={resolvedActivity}
                            sessions={resolvedSessions}
                        />
                    ) : null}

                    {activeTab === 'settings' ? (
                        <SettingsSyncTab
                            isOnline={isOnline}
                            onLogout={onLogout}
                            onRequestPushPermissions={onRequestPushPermissions}
                            onSyncNow={onSyncNow}
                            pushNotificationsEnabled={pushNotificationsEnabled}
                            queuedCount={queuedCount}
                        />
                    ) : null}
                </ScrollView>
            )}

            {/* Email Change Re-authentication & Verification Modal */}
            <EmailChangeModal
                apiClient={apiClient}
                currentEmail={resolvedProfile.email}
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

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    darkSafeArea: {
        backgroundColor: '#090D16',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    darkTopBar: {
        backgroundColor: '#1E293B',
        borderBottomColor: '#334155',
    },
    backBtn: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    darkBackBtn: {
        backgroundColor: '#27354A',
        borderColor: '#334155',
    },
    topBarCenter: {
        flex: 1,
        marginHorizontal: 12,
    },
    screenTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.3,
    },
    darkScreenTitle: {
        color: '#F8FAFC',
    },
    screenSubtitle: {
        fontSize: 11,
        fontWeight: '500',
        color: '#64748B',
    },
    darkScreenSubtitle: {
        color: '#94A3B8',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    darkStatusPill: {
        backgroundColor: '#27354A',
        borderColor: '#334155',
    },
    beaconRing: {
        width: 14,
        height: 14,
        borderRadius: 7,
        justifyContent: 'center',
        alignItems: 'center',
    },
    beaconRingOnline: {
        backgroundColor: 'rgba(16, 185, 129, 0.25)',
    },
    beaconRingOffline: {
        backgroundColor: 'rgba(239, 68, 68, 0.25)',
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    statusDotOnline: {
        backgroundColor: '#10B981',
    },
    statusDotOffline: {
        backgroundColor: '#EF4444',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    darkStatusText: {
        color: '#E2E8F0',
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
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    darkSegmentedTrack: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
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
        backgroundColor: '#FFFFFF',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    darkTabPillActive: {
        backgroundColor: '#27354A',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.35)',
        shadowColor: '#F59E0B',
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
        color: '#64748B',
    },
    darkTabBtnText: {
        color: '#94A3B8',
    },
    tabBtnTextActive: {
        color: '#B45309',
        fontWeight: '700',
    },
    darkTabBtnTextActive: {
        color: '#FDE68A',
        fontWeight: '700',
    },
    toastBanner: {
        backgroundColor: '#10B981',
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginHorizontal: 16,
        marginTop: 10,
        borderRadius: 8,
    },
    toastText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    errorBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginHorizontal: 16,
        marginTop: 10,
        borderRadius: 8,
    },
    errorBannerText: {
        color: '#DC2626',
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
    },
    retryBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: '#DC2626',
        borderRadius: 6,
    },
    retryBtnText: {
        color: '#FFFFFF',
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
        color: '#64748B',
    },
    darkLoadingText: {
        color: '#94A3B8',
    },
    pressed: {
        opacity: 0.75,
    },
});
