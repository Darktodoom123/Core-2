import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import type { ConditionRating, TechnicianHandover } from '../../types/index';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export interface HandoverTabProps {
    assetCode: string;
    technicianName: string;
    onCompleteHandover: (handover: TechnicianHandover) => void;
}

export const HandoverTab: React.FC<HandoverTabProps> = ({
    assetCode,
    technicianName,
    onCompleteHandover,
}) => {
    const { isDarkHud } = useTheme();
    const [complete, setComplete] = useState(false);
    const [recipient, setRecipient] = useState(
        'Marcus Vance (Lead Crane Operator)',
    );
    const [rating, setRating] = useState<ConditionRating>('excellent');
    const [remarks, setRemarks] = useState(
        'Asset inspected, fueled 100%, and handed over in full working order with load charts.',
    );

    const handleConfirm = () => {
        if (!recipient.trim()) {
            return;
        }

        setComplete(true);
        onCompleteHandover({
            id: `HO-${Date.now().toString().slice(-6)}`,
            assetCode,
            technicianName,
            recipientName: recipient.trim(),
            handoverType: 'tech_to_operator',
            conditionRating: rating,
            remarks,
            signatureConfirmed: true,
            timestamp: new Date().toISOString(),
        });
    };

    return (
        <View style={styles.tabRoot} testID="handover-section">
            <View
                style={[
                    styles.sectionCard,
                    isDarkHud && styles.darkSectionCard,
                ]}
            >
                <View style={styles.cardHeaderRow}>
                    <View style={styles.headerIconWrap}>
                        <Icon
                            color={isDarkHud ? colors.hudAmber : colors.amber}
                            name="signature"
                            size={18}
                        />
                    </View>
                    <View style={styles.headerTitles}>
                        <Text
                            accessibilityRole="header"
                            style={[
                                styles.cardHeading,
                                isDarkHud && styles.darkText,
                            ]}
                        >
                            Technician Asset Handover Sign-Off
                        </Text>
                        <Text
                            style={[
                                styles.cardHelper,
                                isDarkHud && styles.darkHelper,
                            ]}
                        >
                            Formal custody and operational readiness transfer
                            between technician and crane operator.
                        </Text>
                    </View>
                </View>

                {/* Handover Status Banner */}
                <View
                    style={[
                        styles.statusBanner,
                        complete
                            ? styles.statusBannerPassed
                            : styles.statusBannerPending,
                        isDarkHud &&
                            (complete
                                ? styles.darkStatusBannerPassed
                                : styles.darkStatusBannerPending),
                    ]}
                >
                    <Icon
                        color={
                            complete
                                ? isDarkHud
                                    ? '#34D399'
                                    : colors.greenDark
                                : isDarkHud
                                  ? '#FBBF24'
                                  : colors.amberDark
                        }
                        name={complete ? 'check-circle' : 'alert-circle'}
                        size={16}
                    />
                    <Text
                        style={[
                            styles.statusBannerText,
                            complete && styles.statusBannerTextPassed,
                            isDarkHud &&
                                (complete
                                    ? styles.darkStatusBannerTextPassed
                                    : styles.darkStatusBannerTextPending),
                        ]}
                    >
                        {complete
                            ? '✓ CUSTODY TRANSFERRED & DIGITALLY CONFIRMED'
                            : 'PENDING OPERATOR ACCEPTANCE · CUSTODY TRANSFER'}
                    </Text>
                </View>

                {/* Asset & Custody Meta */}
                <View
                    style={[
                        styles.assetMetaRow,
                        isDarkHud && styles.darkAssetMetaRow,
                    ]}
                >
                    <View style={styles.metaBadge}>
                        <Icon
                            color={isDarkHud ? colors.hudAmber : colors.amber}
                            name="truck"
                            size={14}
                        />
                        <Text
                            style={[
                                styles.metaBadgeText,
                                isDarkHud && styles.darkText,
                            ]}
                        >
                            Asset {assetCode}
                        </Text>
                    </View>
                    <View style={styles.metaBadge}>
                        <Icon
                            color={isDarkHud ? '#94A3B8' : colors.secondary}
                            name="profile"
                            size={14}
                        />
                        <Text
                            style={[
                                styles.metaBadgeText,
                                isDarkHud && styles.darkHelper,
                            ]}
                        >
                            From: {technicianName}
                        </Text>
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text
                        style={[
                            styles.formLabel,
                            isDarkHud && styles.darkLabel,
                        ]}
                    >
                        Receiving Operator Name
                    </Text>
                    <TextInput
                        accessibilityLabel="Receiving operator name"
                        editable={!complete}
                        onChangeText={setRecipient}
                        placeholderTextColor={
                            isDarkHud ? '#64748B' : colors.muted
                        }
                        style={[
                            styles.input,
                            isDarkHud && styles.darkInput,
                            complete && styles.inputDisabled,
                        ]}
                        value={recipient}
                        testID="handover-recipient-input"
                    />

                    <Text
                        style={[
                            styles.formLabel,
                            isDarkHud && styles.darkLabel,
                        ]}
                    >
                        Asset Operational Condition Rating
                    </Text>
                    <View style={styles.severityRow}>
                        {(
                            [
                                'excellent',
                                'good',
                                'fair',
                                'out_of_service',
                            ] as const
                        ).map((r) => {
                            const isSelected = rating === r;

                            return (
                                <Pressable
                                    key={r}
                                    accessibilityLabel={`Condition rating ${r}`}
                                    accessibilityRole="button"
                                    disabled={complete}
                                    onPress={() => setRating(r)}
                                    style={({ pressed }) => [
                                        styles.severityOption,
                                        isDarkHud && styles.darkSeverityOption,
                                        isSelected &&
                                            (r === 'excellent'
                                                ? styles.excellentSelected
                                                : r === 'good'
                                                  ? styles.goodSelected
                                                  : r === 'fair'
                                                    ? styles.fairSelected
                                                    : styles.oosSelected),
                                        isSelected &&
                                            isDarkHud &&
                                            (r === 'excellent'
                                                ? styles.darkExcellentSelected
                                                : r === 'good'
                                                  ? styles.darkGoodSelected
                                                  : r === 'fair'
                                                    ? styles.darkFairSelected
                                                    : styles.darkOosSelected),
                                        pressed && !complete && styles.pressed,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.severityText,
                                            isDarkHud &&
                                                styles.darkSeverityText,
                                            isSelected &&
                                                styles.severityTextSelected,
                                            isSelected &&
                                                (r === 'excellent'
                                                    ? styles.excellentText
                                                    : r === 'good'
                                                      ? styles.goodText
                                                      : r === 'fair'
                                                        ? styles.fairText
                                                        : styles.oosText),
                                            isSelected &&
                                                isDarkHud &&
                                                (r === 'excellent'
                                                    ? styles.darkExcellentText
                                                    : r === 'good'
                                                      ? styles.darkGoodText
                                                      : r === 'fair'
                                                        ? styles.darkFairText
                                                        : styles.darkOosText),
                                        ]}
                                    >
                                        {r.replace('_', ' ').toUpperCase()}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    <Text
                        style={[
                            styles.formLabel,
                            isDarkHud && styles.darkLabel,
                        ]}
                    >
                        Handover & Pre-Start Remarks
                    </Text>
                    <TextInput
                        accessibilityLabel="Handover remarks"
                        editable={!complete}
                        multiline
                        numberOfLines={3}
                        onChangeText={setRemarks}
                        placeholderTextColor={
                            isDarkHud ? '#64748B' : colors.muted
                        }
                        style={[
                            styles.input,
                            styles.textArea,
                            isDarkHud && styles.darkInput,
                            complete && styles.inputDisabled,
                        ]}
                        value={remarks}
                        testID="handover-remarks-input"
                    />

                    {!complete ? (
                        <Pressable
                            accessibilityLabel="Complete technician asset handover"
                            accessibilityRole="button"
                            onPress={handleConfirm}
                            style={({ pressed }) => [
                                styles.actionButton,
                                isDarkHud && styles.darkActionButton,
                                pressed && styles.pressed,
                            ]}
                            testID="confirm-handover-btn"
                        >
                            <Icon
                                color={
                                    isDarkHud ? colors.surfaceDark : '#FFFFFF'
                                }
                                name="check"
                                size={18}
                            />
                            <Text
                                style={[
                                    styles.actionBtnText,
                                    isDarkHud && styles.darkActionBtnText,
                                ]}
                            >
                                Sign & Complete Handover
                            </Text>
                        </Pressable>
                    ) : (
                        <View
                            style={[
                                styles.signedStamp,
                                isDarkHud && styles.darkSignedStamp,
                            ]}
                        >
                            <View style={styles.stampHeader}>
                                <Icon
                                    color={
                                        isDarkHud ? '#34D399' : colors.greenDark
                                    }
                                    name="check-circle"
                                    size={20}
                                />
                                <Text
                                    style={[
                                        styles.signedStampTitle,
                                        isDarkHud &&
                                            styles.darkSignedStampTitle,
                                    ]}
                                >
                                    HANDOVER COMPLETED & SIGNED
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.signedStampSub,
                                    isDarkHud && styles.darkSignedStampSub,
                                ]}
                            >
                                Custody officially transferred from{' '}
                                {technicianName} to {recipient}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    tabRoot: {
        gap: 14,
    },
    sectionCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
        ...shadows.sm,
    },
    darkSectionCard: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
        shadowColor: 'transparent',
    },
    cardHeaderRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 12,
        marginBottom: 14,
    },
    headerIconWrap: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        height: 36,
        justifyContent: 'center',
        width: 36,
    },
    headerTitles: {
        flex: 1,
    },
    cardHeading: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
    },
    darkText: {
        color: colors.hudText,
    },
    cardHelper: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    darkHelper: {
        color: colors.hudTextDim,
    },
    statusBanner: {
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    statusBannerPending: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
    },
    statusBannerPassed: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    darkStatusBannerPending: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: '#F59E0B',
    },
    darkStatusBannerPassed: {
        backgroundColor: 'rgba(5, 150, 105, 0.15)',
        borderColor: '#059669',
    },
    statusBannerText: {
        color: colors.amberDark,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    statusBannerTextPassed: {
        color: colors.greenDark,
    },
    darkStatusBannerTextPending: {
        color: '#FBBF24',
    },
    darkStatusBannerTextPassed: {
        color: '#34D399',
    },
    assetMetaRow: {
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 14,
        paddingBottom: 12,
    },
    darkAssetMetaRow: {
        borderBottomColor: colors.hudBorder,
    },
    metaBadge: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    metaBadgeText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
    },
    formGroup: {
        gap: 10,
    },
    formLabel: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 2,
    },
    darkLabel: {
        color: colors.hudTextDim,
    },
    input: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        color: colors.text,
        fontSize: 14,
        minHeight: 44,
        paddingHorizontal: 12,
    },
    darkInput: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
        color: colors.hudText,
    },
    inputDisabled: {
        opacity: 0.75,
    },
    textArea: {
        minHeight: 80,
        paddingTop: 10,
        textAlignVertical: 'top',
    },
    severityRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    severityOption: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 38,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    darkSeverityOption: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    severityOptionSelected: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
    },
    excellentSelected: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    goodSelected: {
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderColor: '#0284C7',
    },
    fairSelected: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
    },
    oosSelected: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: '#DC2626',
    },
    darkExcellentSelected: {
        backgroundColor: 'rgba(5, 150, 105, 0.2)',
        borderColor: '#059669',
    },
    darkGoodSelected: {
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        borderColor: '#38BDF8',
    },
    darkFairSelected: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#F59E0B',
    },
    darkOosSelected: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: '#DC2626',
    },
    severityText: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
    },
    darkSeverityText: {
        color: colors.hudTextDim,
    },
    severityTextSelected: {
        fontWeight: '800',
    },
    excellentText: {
        color: colors.greenDark,
    },
    goodText: {
        color: '#0369A1',
    },
    fairText: {
        color: colors.amberDark,
    },
    oosText: {
        color: '#B91C1C',
    },
    darkExcellentText: {
        color: '#34D399',
    },
    darkGoodText: {
        color: '#38BDF8',
    },
    darkFairText: {
        color: '#FBBF24',
    },
    darkOosText: {
        color: '#F87171',
    },
    actionButton: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 10,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 48,
        marginTop: 10,
    },
    darkActionButton: {
        backgroundColor: colors.hudAmber,
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    darkActionBtnText: {
        color: colors.surfaceDark,
    },
    signedStamp: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 12,
        padding: 14,
    },
    darkSignedStamp: {
        backgroundColor: 'rgba(5, 150, 105, 0.15)',
        borderColor: '#059669',
    },
    stampHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        marginBottom: 4,
    },
    signedStampTitle: {
        color: colors.greenDark,
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    darkSignedStampTitle: {
        color: '#34D399',
    },
    signedStampSub: {
        color: colors.greenDark,
        fontSize: 12,
        lineHeight: 16,
    },
    darkSignedStampSub: {
        color: '#6EE7B7',
    },
    pressed: {
        opacity: 0.85,
    },
});
