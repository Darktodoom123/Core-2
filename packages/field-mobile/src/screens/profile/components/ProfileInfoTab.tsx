import React, { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Icon } from '../../../components/common/Icon';
import type { FieldApiClient } from '../../../services/apiClient';
import { useTheme } from '../../../theme';
import type { AccountProfileData } from '../../../types/account';

export interface ProfileInfoTabProps {
    profile: AccountProfileData;
    assignedAssetLabel?: string | null;
    isOnline?: boolean | null;
    apiClient: FieldApiClient;
    onPhoneUpdated: (newPhone: string | null) => void;
    onEmailChangeClick: () => void;
}

const initialsFor = (name?: string | null): string => {
    const initials = (name || 'Field Operator')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();

    return initials || 'FO';
};

export const ProfileInfoTab: React.FC<ProfileInfoTabProps> = ({
    profile,
    assignedAssetLabel,
    isOnline,
    apiClient,
    onPhoneUpdated,
    onEmailChangeClick,
}) => {
    const { isDarkHud } = useTheme();
    const [isEditingPhone, setIsEditingPhone] = useState(false);
    const [prevPhone, setPrevPhone] = useState(profile.phone);
    const [phoneInput, setPhoneInput] = useState(profile.phone || '');
    const [isSavingPhone, setIsSavingPhone] = useState(false);
    const [phoneFeedback, setPhoneFeedback] = useState<string | null>(null);
    const [permissionsExpanded, setPermissionsExpanded] = useState(false);

    if (profile.phone !== prevPhone) {
        setPrevPhone(profile.phone);

        if (!isEditingPhone) {
            setPhoneInput(profile.phone || '');
        }
    }

    const handleSavePhone = async () => {
        setIsSavingPhone(true);
        setPhoneFeedback(null);

        try {
            const trimmed = phoneInput.trim() || null;
            await apiClient.updateAccountProfile({ phone: trimmed });
            onPhoneUpdated(trimmed);
            setIsEditingPhone(false);
            setPhoneFeedback('Phone number updated successfully.');
            setTimeout(() => setPhoneFeedback(null), 3000);
        } catch (err: any) {
            setPhoneFeedback(err.message || 'Failed to update phone number.');
        } finally {
            setIsSavingPhone(false);
        }
    };

    const handleCancelEditPhone = () => {
        setPhoneInput(profile.phone || '');
        setIsEditingPhone(false);
        setPhoneFeedback(null);
    };

    const permissions = profile.permissions || [];

    return (
        <View style={styles.container} testID="profile-info-tab">
            {phoneFeedback ? (
                <View
                    style={[
                        styles.feedbackBanner,
                        phoneFeedback.includes('successfully')
                            ? styles.feedbackSuccess
                            : styles.feedbackError,
                    ]}
                >
                    <Text
                        style={[
                            styles.feedbackText,
                            phoneFeedback.includes('successfully')
                                ? styles.feedbackSuccessText
                                : styles.feedbackErrorText,
                        ]}
                    >
                        {phoneFeedback}
                    </Text>
                </View>
            ) : null}

            {/* Operator Identity Card */}
            <View style={[styles.card, isDarkHud && styles.darkCard]}>
                <View style={styles.identityTopRow}>
                    <View
                        style={[
                            styles.avatarSquircle,
                            isDarkHud && styles.darkAvatarSquircle,
                        ]}
                    >
                        <Text
                            style={[
                                styles.avatarInitials,
                                isDarkHud && styles.darkAvatarInitials,
                            ]}
                        >
                            {initialsFor(profile.name)}
                        </Text>
                        <View
                            style={[
                                styles.beaconPulseRing,
                                isOnline === false
                                    ? styles.beaconPulseOffline
                                    : styles.beaconPulseOnline,
                            ]}
                        >
                            <View
                                style={[
                                    styles.avatarStatusDot,
                                    isOnline === false
                                        ? styles.avatarOfflineDot
                                        : styles.avatarOnlineDot,
                                ]}
                            />
                        </View>
                    </View>

                    <View style={styles.identityMeta}>
                        <Text
                            numberOfLines={1}
                            style={[styles.name, isDarkHud && styles.darkName]}
                        >
                            {profile.name}
                        </Text>
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.username,
                                isDarkHud && styles.darkUsername,
                            ]}
                        >
                            @{profile.username}
                        </Text>
                        <View style={styles.badgeRow}>
                            <View
                                style={[
                                    styles.roleBadge,
                                    isDarkHud && styles.darkRoleBadge,
                                ]}
                            >
                                <Icon
                                    color={isDarkHud ? '#F59E0B' : '#D97706'}
                                    name="profile"
                                    size={12}
                                />
                                <Text
                                    style={[
                                        styles.roleBadgeText,
                                        isDarkHud && styles.darkRoleBadgeText,
                                    ]}
                                >
                                    {profile.role_label ||
                                        profile.role ||
                                        'Field Operator'}
                                </Text>
                            </View>

                            <View
                                style={[
                                    styles.statusBadge,
                                    profile.account_status === 'active'
                                        ? isDarkHud
                                            ? styles.darkStatusBadgeActive
                                            : styles.statusBadgeActive
                                        : isDarkHud
                                          ? styles.darkStatusBadgeSuspended
                                          : styles.statusBadgeSuspended,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.statusBadgeText,
                                        profile.account_status === 'active'
                                            ? isDarkHud
                                                ? styles.darkStatusBadgeTextActive
                                                : styles.statusBadgeTextActive
                                            : isDarkHud
                                              ? styles.darkStatusBadgeTextSuspended
                                              : styles.statusBadgeTextSuspended,
                                    ]}
                                >
                                    {profile.account_status_label || 'Active'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View
                    style={[
                        styles.cardDivider,
                        isDarkHud && styles.darkDivider,
                    ]}
                />

                {/* Assigned Rig / Crane Section */}
                <View style={styles.stationRow}>
                    <View style={styles.stationLeft}>
                        <View
                            style={[
                                styles.stationIconWrap,
                                isDarkHud && styles.darkStationIconWrap,
                            ]}
                        >
                            <Icon
                                color={isDarkHud ? '#F59E0B' : '#D97706'}
                                name="crane"
                                size={18}
                            />
                        </View>
                        <View style={styles.stationCopy}>
                            <Text
                                style={[
                                    styles.stationLabel,
                                    isDarkHud && styles.darkStationLabel,
                                ]}
                            >
                                Assigned Rig / Station
                            </Text>
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.stationValue,
                                    isDarkHud && styles.darkStationValue,
                                ]}
                            >
                                {assignedAssetLabel ||
                                    'In-Cab Standby (Unassigned)'}
                            </Text>
                        </View>
                    </View>

                    <View
                        style={[
                            styles.inCabBadge,
                            assignedAssetLabel
                                ? isDarkHud
                                    ? styles.darkInCabBadge
                                    : styles.lightInCabBadge
                                : isDarkHud
                                  ? styles.darkStandbyBadge
                                  : styles.lightStandbyBadge,
                        ]}
                    >
                        <Text
                            style={[
                                styles.inCabBadgeText,
                                assignedAssetLabel
                                    ? isDarkHud
                                        ? styles.darkInCabText
                                        : styles.lightInCabText
                                    : isDarkHud
                                      ? styles.darkStandbyText
                                      : styles.lightStandbyText,
                            ]}
                        >
                            {assignedAssetLabel ? 'In-Cab' : 'Standby'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Contact Information Card */}
            <View style={[styles.card, isDarkHud && styles.darkCard]}>
                <Text
                    style={[
                        styles.sectionHeader,
                        isDarkHud && styles.darkSectionHeader,
                    ]}
                >
                    Contact & Communication
                </Text>

                {/* Email row */}
                <View style={styles.contactRow}>
                    <View style={styles.contactLeft}>
                        <View
                            style={[
                                styles.contactIconWrap,
                                isDarkHud && styles.darkContactIconWrap,
                            ]}
                        >
                            <Icon
                                color={isDarkHud ? '#93C5FD' : '#2563EB'}
                                name="mail"
                                size={18}
                            />
                        </View>
                        <View style={styles.contactCopy}>
                            <Text
                                style={[
                                    styles.fieldLabel,
                                    isDarkHud && styles.darkFieldLabel,
                                ]}
                            >
                                Email Address
                            </Text>
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.fieldValue,
                                    isDarkHud && styles.darkFieldValue,
                                ]}
                            >
                                {profile.email}
                            </Text>
                            {profile.email_verified ? (
                                <Text
                                    style={[
                                        styles.verifiedPill,
                                        isDarkHud && styles.darkVerifiedPill,
                                    ]}
                                >
                                    ✓ Verified
                                </Text>
                            ) : null}
                        </View>
                    </View>

                    <Pressable
                        accessibilityLabel="Change email address"
                        accessibilityRole="button"
                        onPress={onEmailChangeClick}
                        style={({ pressed }) => [
                            styles.changeBtn,
                            isDarkHud && styles.darkChangeBtn,
                            pressed && styles.pressed,
                        ]}
                        testID="btn-change-email"
                    >
                        <Text
                            style={[
                                styles.changeBtnText,
                                isDarkHud && styles.darkChangeBtnText,
                            ]}
                        >
                            Change
                        </Text>
                    </Pressable>
                </View>

                <View
                    style={[
                        styles.cardDivider,
                        isDarkHud && styles.darkDivider,
                    ]}
                />

                {/* Phone row */}
                <View style={styles.phoneSection}>
                    <View style={styles.phoneTopRow}>
                        <View style={styles.contactLeft}>
                            <View
                                style={[
                                    styles.contactIconWrap,
                                    isDarkHud && styles.darkContactIconWrap,
                                ]}
                            >
                                <Icon
                                    color={isDarkHud ? '#93C5FD' : '#2563EB'}
                                    name="phone"
                                    size={18}
                                />
                            </View>
                            <View style={styles.contactCopy}>
                                <Text
                                    style={[
                                        styles.fieldLabel,
                                        isDarkHud && styles.darkFieldLabel,
                                    ]}
                                >
                                    Mobile Phone Number
                                </Text>
                                {!isEditingPhone ? (
                                    <Text
                                        style={[
                                            styles.fieldValue,
                                            isDarkHud && styles.darkFieldValue,
                                            !profile.phone && styles.unsetText,
                                        ]}
                                    >
                                        {profile.phone ||
                                            'No phone number linked'}
                                    </Text>
                                ) : null}
                            </View>
                        </View>

                        {!isEditingPhone ? (
                            <Pressable
                                accessibilityLabel="Edit phone number"
                                accessibilityRole="button"
                                onPress={() => setIsEditingPhone(true)}
                                style={({ pressed }) => [
                                    styles.changeBtn,
                                    isDarkHud && styles.darkChangeBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID="profile-edit-phone-btn"
                            >
                                <Text
                                    style={[
                                        styles.changeBtnText,
                                        isDarkHud && styles.darkChangeBtnText,
                                    ]}
                                >
                                    Edit
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>

                    {isEditingPhone ? (
                        <View style={styles.phoneEditForm}>
                            <TextInput
                                accessibilityLabel="Mobile phone input"
                                autoFocus
                                keyboardType="phone-pad"
                                maxLength={32}
                                onChangeText={setPhoneInput}
                                placeholder="+1 555 123 4567"
                                placeholderTextColor={
                                    isDarkHud ? '#64748B' : '#94A3B8'
                                }
                                style={[
                                    styles.phoneInput,
                                    isDarkHud && styles.darkPhoneInput,
                                ]}
                                testID="profile-phone-input"
                                value={phoneInput}
                            />
                            <View style={styles.phoneEditActions}>
                                <Pressable
                                    accessibilityLabel="Cancel editing phone"
                                    disabled={isSavingPhone}
                                    onPress={handleCancelEditPhone}
                                    style={({ pressed }) => [
                                        styles.phoneCancelBtn,
                                        isDarkHud && styles.darkPhoneCancelBtn,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.phoneCancelBtnText,
                                            isDarkHud &&
                                                styles.darkPhoneCancelBtnText,
                                        ]}
                                    >
                                        Cancel
                                    </Text>
                                </Pressable>
                                <Pressable
                                    accessibilityLabel="Save phone number"
                                    disabled={isSavingPhone}
                                    onPress={handleSavePhone}
                                    style={({ pressed }) => [
                                        styles.phoneSaveBtn,
                                        isDarkHud
                                            ? styles.darkPhoneSaveBtn
                                            : styles.lightPhoneSaveBtn,
                                        isSavingPhone && styles.disabledBtn,
                                        pressed && styles.pressed,
                                    ]}
                                    testID="btn-save-phone"
                                >
                                    {isSavingPhone ? (
                                        <ActivityIndicator
                                            color="#FFFFFF"
                                            size="small"
                                        />
                                    ) : (
                                        <Text style={styles.phoneSaveBtnText}>
                                            Save Phone
                                        </Text>
                                    )}
                                </Pressable>
                            </View>
                        </View>
                    ) : null}
                </View>
            </View>

            {/* Operational Permissions Card */}
            <View style={[styles.card, isDarkHud && styles.darkCard]}>
                <Pressable
                    accessibilityLabel="Toggle permissions list"
                    onPress={() => setPermissionsExpanded(!permissionsExpanded)}
                    style={styles.permissionsHeader}
                    testID="toggle-permissions-btn"
                >
                    <View style={styles.permissionsHeaderLeft}>
                        <Text
                            style={[
                                styles.sectionHeader,
                                isDarkHud && styles.darkSectionHeader,
                                { marginBottom: 0 },
                            ]}
                        >
                            Assigned Permissions ({permissions.length})
                        </Text>
                        <Text
                            style={[
                                styles.permissionsSubtitle,
                                isDarkHud && styles.darkPermissionsSubtitle,
                            ]}
                        >
                            Governed by central RBAC policy
                        </Text>
                    </View>
                    <Icon
                        color={isDarkHud ? '#94A3B8' : '#64748B'}
                        name={
                            permissionsExpanded ? 'chevron-up' : 'chevron-down'
                        }
                        size={18}
                    />
                </Pressable>

                {permissionsExpanded ? (
                    <View style={styles.permissionsPillGrid}>
                        {permissions.map((perm) => (
                            <View
                                key={perm}
                                style={[
                                    styles.permPill,
                                    isDarkHud && styles.darkPermPill,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.permPillText,
                                        isDarkHud && styles.darkPermPillText,
                                    ]}
                                >
                                    {perm}
                                </Text>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    feedbackBanner: {
        borderRadius: 10,
        padding: 12,
    },
    feedbackSuccess: {
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    feedbackError: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    feedbackText: {
        fontSize: 13,
        fontWeight: '600',
    },
    feedbackSuccessText: {
        color: '#047857',
    },
    feedbackErrorText: {
        color: '#B91C1C',
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
    identityTopRow: {
        flexDirection: 'row',
        gap: 14,
        alignItems: 'center',
    },
    avatarSquircle: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: '#FEF3C7',
        borderWidth: 2.5,
        borderColor: '#F59E0B',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    darkAvatarSquircle: {
        backgroundColor: '#78350F',
        borderColor: '#F59E0B',
    },
    avatarInitials: {
        fontSize: 22,
        fontWeight: '800',
        color: '#92400E',
    },
    darkAvatarInitials: {
        color: '#FDE68A',
    },
    beaconPulseRing: {
        position: 'absolute',
        bottom: -3,
        right: -3,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    beaconPulseOnline: {
        backgroundColor: 'rgba(16, 185, 129, 0.25)',
    },
    beaconPulseOffline: {
        backgroundColor: 'rgba(239, 68, 68, 0.25)',
    },
    avatarStatusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    avatarOnlineDot: {
        backgroundColor: '#10B981',
    },
    avatarOfflineDot: {
        backgroundColor: '#EF4444',
    },
    identityMeta: {
        flex: 1,
        gap: 2,
    },
    name: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
    },
    darkName: {
        color: '#F8FAFC',
    },
    username: {
        fontSize: 13,
        color: '#64748B',
    },
    darkUsername: {
        color: '#94A3B8',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 6,
        alignItems: 'center',
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: '#FEF3C7',
    },
    darkRoleBadge: {
        backgroundColor: '#78350F',
    },
    roleBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#B45309',
        textTransform: 'capitalize',
    },
    darkRoleBadgeText: {
        color: '#FDE68A',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statusBadgeActive: {
        backgroundColor: '#DCFCE7',
    },
    darkStatusBadgeActive: {
        backgroundColor: '#064E3B',
    },
    statusBadgeSuspended: {
        backgroundColor: '#FEE2E2',
    },
    darkStatusBadgeSuspended: {
        backgroundColor: '#7F1D1D',
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    statusBadgeTextActive: {
        color: '#15803D',
    },
    darkStatusBadgeTextActive: {
        color: '#6EE7B7',
    },
    statusBadgeTextSuspended: {
        color: '#B91C1C',
    },
    darkStatusBadgeTextSuspended: {
        color: '#FCA5A5',
    },
    cardDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#E2E8F0',
        marginVertical: 14,
        marginLeft: 48,
    },
    darkDivider: {
        backgroundColor: '#334155',
    },
    stationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    stationLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    stationIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    darkStationIconWrap: {
        backgroundColor: '#78350F',
    },
    stationCopy: {
        flex: 1,
    },
    stationLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    darkStationLabel: {
        color: '#94A3B8',
    },
    stationValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
        marginTop: 2,
    },
    darkStationValue: {
        color: '#F8FAFC',
    },
    inCabBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    lightInCabBadge: {
        backgroundColor: '#DCFCE7',
    },
    darkInCabBadge: {
        backgroundColor: '#064E3B',
    },
    lightStandbyBadge: {
        backgroundColor: '#F1F5F9',
    },
    darkStandbyBadge: {
        backgroundColor: '#334155',
    },
    inCabBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    lightInCabText: {
        color: '#166534',
    },
    darkInCabText: {
        color: '#6EE7B7',
    },
    lightStandbyText: {
        color: '#64748B',
    },
    darkStandbyText: {
        color: '#94A3B8',
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 12,
    },
    darkSectionHeader: {
        color: '#F8FAFC',
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    contactLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    contactIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    darkContactIconWrap: {
        backgroundColor: '#1E3A8A',
    },
    contactCopy: {
        flex: 1,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    darkFieldLabel: {
        color: '#94A3B8',
    },
    fieldValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0F172A',
        marginTop: 2,
    },
    darkFieldValue: {
        color: '#F8FAFC',
    },
    unsetText: {
        color: '#94A3B8',
        fontStyle: 'italic',
    },
    verifiedPill: {
        fontSize: 11,
        color: '#059669',
        fontWeight: '700',
        marginTop: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: '#ECFDF5',
        alignSelf: 'flex-start',
    },
    darkVerifiedPill: {
        backgroundColor: '#064E3B',
        color: '#6EE7B7',
    },
    changeBtn: {
        minHeight: 48,
        paddingHorizontal: 14,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
    },
    darkChangeBtn: {
        backgroundColor: '#334155',
    },
    changeBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
    },
    darkChangeBtnText: {
        color: '#F8FAFC',
    },
    phoneSection: {
        gap: 10,
    },
    phoneTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    phoneEditForm: {
        marginTop: 6,
        gap: 8,
    },
    phoneInput: {
        minHeight: 48,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 12,
        fontSize: 15,
        color: '#0F172A',
    },
    darkPhoneInput: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        color: '#F8FAFC',
    },
    phoneEditActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    phoneCancelBtn: {
        minHeight: 48,
        paddingHorizontal: 14,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
    },
    darkPhoneCancelBtn: {
        backgroundColor: '#334155',
    },
    phoneCancelBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    darkPhoneCancelBtnText: {
        color: '#94A3B8',
    },
    phoneSaveBtn: {
        minHeight: 48,
        paddingHorizontal: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lightPhoneSaveBtn: {
        backgroundColor: '#D97706',
    },
    darkPhoneSaveBtn: {
        backgroundColor: '#F59E0B',
    },
    phoneSaveBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    permissionsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 48,
    },
    permissionsHeaderLeft: {
        gap: 2,
    },
    permissionsSubtitle: {
        fontSize: 12,
        color: '#64748B',
    },
    darkPermissionsSubtitle: {
        color: '#94A3B8',
    },
    expandChevron: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B',
    },
    darkExpandChevron: {
        color: '#94A3B8',
    },
    permissionsPillGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 12,
    },
    permPill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
    },
    darkPermPill: {
        backgroundColor: '#334155',
    },
    permPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#334155',
    },
    darkPermPillText: {
        color: '#E2E8F0',
    },
    disabledBtn: {
        opacity: 0.5,
    },
    pressed: {
        opacity: 0.75,
    },
});
