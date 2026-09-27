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
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
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
    const { isDarkHud, theme } = useTheme();
    const styles = useThemedStyles(createStyles);
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
            <View style={[styles.card]}>
                <View style={styles.identityTopRow}>
                    <View style={[styles.avatarSquircle]}>
                        <Text style={[styles.avatarInitials]}>
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
                        <Text numberOfLines={1} style={[styles.name]}>
                            {profile.name}
                        </Text>
                        <Text numberOfLines={1} style={[styles.username]}>
                            @{profile.username}
                        </Text>
                        <View style={styles.badgeRow}>
                            <View style={[styles.roleBadge]}>
                                <Icon
                                    color={theme.brandAmberText}
                                    name="profile"
                                    size={12}
                                />
                                <Text style={[styles.roleBadgeText]}>
                                    {profile.role_label ||
                                        profile.role ||
                                        'Field Operator'}
                                </Text>
                            </View>

                            <View
                                style={[
                                    styles.statusBadge,
                                    profile.account_status === 'active'
                                        ? styles.statusBadgeActive
                                        : styles.statusBadgeSuspended,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.statusBadgeText,
                                        profile.account_status === 'active'
                                            ? styles.statusBadgeTextActive
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
                        <View style={[styles.stationIconWrap]}>
                            <Icon
                                color={theme.brandAmberText}
                                name="crane"
                                size={18}
                            />
                        </View>
                        <View style={styles.stationCopy}>
                            <Text style={[styles.stationLabel]}>
                                Assigned Rig / Station
                            </Text>
                            <Text
                                numberOfLines={1}
                                style={[styles.stationValue]}
                            >
                                {assignedAssetLabel || 'No unit linked'}
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
                            {assignedAssetLabel ? 'In-Cab' : 'Not linked'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Contact Information Card */}
            <View style={[styles.card]}>
                <Text style={[styles.sectionHeader]}>
                    Contact & Communication
                </Text>

                {/* Email row */}
                <View style={styles.contactRow}>
                    <View style={styles.contactLeft}>
                        <View style={[styles.contactIconWrap]}>
                            <Icon
                                color={theme.actionCobalt}
                                name="mail"
                                size={18}
                            />
                        </View>
                        <View style={styles.contactCopy}>
                            <Text style={[styles.fieldLabel]}>
                                Email Address
                            </Text>
                            <Text numberOfLines={1} style={[styles.fieldValue]}>
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
                        <Text style={[styles.changeBtnText]}>Change</Text>
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
                            <View style={[styles.contactIconWrap]}>
                                <Icon
                                    color={theme.actionCobalt}
                                    name="phone"
                                    size={18}
                                />
                            </View>
                            <View style={styles.contactCopy}>
                                <Text style={[styles.fieldLabel]}>
                                    Mobile Phone Number
                                </Text>
                                {!isEditingPhone ? (
                                    <Text
                                        style={[
                                            styles.fieldValue,
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
                                <Text style={[styles.changeBtnText]}>Edit</Text>
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
                                placeholderTextColor={theme.textMuted}
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
                                    <Text style={[styles.phoneCancelBtnText]}>
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
                                            color={theme.surfaceDark}
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
            <View style={[styles.card]}>
                <Pressable
                    accessibilityLabel="Toggle permissions list"
                    onPress={() => setPermissionsExpanded(!permissionsExpanded)}
                    style={styles.permissionsHeader}
                    testID="toggle-permissions-btn"
                >
                    <View style={styles.permissionsHeaderLeft}>
                        <Text
                            style={[styles.sectionHeader, { marginBottom: 0 }]}
                        >
                            Assigned Permissions ({permissions.length})
                        </Text>
                        <Text style={[styles.permissionsSubtitle]}>
                            Governed by central RBAC policy
                        </Text>
                    </View>
                    <Icon
                        color={theme.textSecondary}
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
                                <Text style={[styles.permPillText]}>
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

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        container: {
            gap: 16,
        },
        feedbackBanner: {
            borderRadius: 10,
            padding: 12,
        },
        feedbackSuccess: {
            backgroundColor: theme.successEmeraldLight,
            borderWidth: 1,
            borderColor: theme.successEmerald,
        },
        feedbackError: {
            backgroundColor: theme.hazardRedLight,
            borderWidth: 1,
            borderColor: theme.hazardRed,
        },
        feedbackText: {
            fontSize: 13,
            fontWeight: '600',
        },
        feedbackSuccessText: {
            color: theme.successEmeraldText,
        },
        feedbackErrorText: {
            color: theme.hazardRedText,
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
        identityTopRow: {
            flexDirection: 'row',
            gap: 14,
            alignItems: 'center',
        },
        avatarSquircle: {
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: theme.brandAmberLight,
            borderWidth: 2.5,
            borderColor: theme.brandAmber,
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
        },
        avatarInitials: {
            fontSize: 22,
            fontWeight: '800',
            color: theme.brandAmberText,
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
            backgroundColor: `${theme.hudGlowEmerald}40`,
        },
        beaconPulseOffline: {
            backgroundColor: `${theme.hazardRed}40`,
        },
        avatarStatusDot: {
            width: 12,
            height: 12,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: theme.surface,
        },
        avatarOnlineDot: {
            backgroundColor: theme.hudGlowEmerald,
        },
        avatarOfflineDot: {
            backgroundColor: theme.hazardRed,
        },
        identityMeta: {
            flex: 1,
            gap: 2,
        },
        name: {
            fontSize: 18,
            fontWeight: '800',
            color: theme.textPrimary,
        },
        username: {
            fontSize: 13,
            color: theme.textSecondary,
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
            backgroundColor: theme.brandAmberLight,
        },
        roleBadgeText: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.brandAmberText,
            textTransform: 'capitalize',
        },
        statusBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
        },
        statusBadgeActive: {
            backgroundColor: theme.successEmeraldLight,
        },
        statusBadgeSuspended: {
            backgroundColor: theme.hazardRedLight,
        },
        statusBadgeText: {
            fontSize: 12,
            fontWeight: '700',
        },
        statusBadgeTextActive: {
            color: theme.successEmeraldText,
        },
        statusBadgeTextSuspended: {
            color: theme.hazardRedText,
        },
        cardDivider: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.border,
            marginVertical: 14,
            marginLeft: 48,
        },
        darkDivider: {
            backgroundColor: theme.border,
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
            backgroundColor: theme.brandAmberLight,
            justifyContent: 'center',
            alignItems: 'center',
        },
        stationCopy: {
            flex: 1,
        },
        stationLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        stationValue: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.textPrimary,
            marginTop: 2,
        },
        inCabBadge: {
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
        },
        lightInCabBadge: {
            backgroundColor: theme.successEmeraldLight,
        },
        darkInCabBadge: {
            backgroundColor: theme.successEmeraldLight,
        },
        lightStandbyBadge: {
            backgroundColor: theme.canvas,
        },
        darkStandbyBadge: {
            backgroundColor: theme.border,
        },
        inCabBadgeText: {
            fontSize: 12,
            fontWeight: '700',
        },
        lightInCabText: {
            color: theme.successEmeraldText,
        },
        darkInCabText: {
            color: theme.successEmeraldText,
        },
        lightStandbyText: {
            color: theme.textSecondary,
        },
        darkStandbyText: {
            color: theme.textSecondary,
        },
        sectionHeader: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.textPrimary,
            marginBottom: 12,
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
            backgroundColor: theme.actionCobaltLight,
            justifyContent: 'center',
            alignItems: 'center',
        },
        contactCopy: {
            flex: 1,
        },
        fieldLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.textSecondary,
        },
        fieldValue: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.textPrimary,
            marginTop: 2,
        },
        unsetText: {
            color: theme.textMuted,
            fontStyle: 'italic',
        },
        verifiedPill: {
            fontSize: 12,
            color: theme.successEmerald,
            fontWeight: '700',
            marginTop: 4,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: theme.successEmeraldLight,
            alignSelf: 'flex-start',
        },
        darkVerifiedPill: {
            backgroundColor: theme.successEmeraldLight,
            color: theme.successEmeraldText,
        },
        changeBtn: {
            minHeight: 48,
            paddingHorizontal: 14,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.canvas,
        },
        darkChangeBtn: {
            backgroundColor: theme.border,
        },
        changeBtnText: {
            fontSize: 13,
            fontWeight: '700',
            color: theme.textPrimary,
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
            borderColor: theme.borderStrong,
            borderRadius: 10,
            backgroundColor: theme.surfaceHighlight,
            paddingHorizontal: 12,
            fontSize: 15,
            color: theme.textPrimary,
        },
        darkPhoneInput: {
            backgroundColor: theme.textInverse,
            borderColor: theme.border,
            color: theme.textPrimary,
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
            backgroundColor: theme.canvas,
        },
        darkPhoneCancelBtn: {
            backgroundColor: theme.border,
        },
        phoneCancelBtnText: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.textSecondary,
        },
        phoneSaveBtn: {
            minHeight: 48,
            paddingHorizontal: 16,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
        },
        lightPhoneSaveBtn: {
            backgroundColor: theme.brandAmber,
        },
        darkPhoneSaveBtn: {
            backgroundColor: theme.brandAmber,
        },
        phoneSaveBtnText: {
            fontSize: 13,
            fontWeight: '700',
            color: theme.surfaceDark,
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
            color: theme.textSecondary,
        },
        expandChevron: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.textSecondary,
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
            backgroundColor: theme.canvas,
        },
        darkPermPill: {
            backgroundColor: theme.border,
        },
        permPillText: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.textPrimary,
        },
        disabledBtn: {
            opacity: 0.5,
        },
        pressed: {
            opacity: 0.75,
        },
    });
