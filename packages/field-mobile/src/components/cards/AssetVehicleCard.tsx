import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type { DispatchJob } from '../../types/index';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export type DvirReadinessStatus = 'cleared' | 'pending' | 'defect';

export interface AssetVehicleCardProps {
    assetCode?: string;
    assetName?: string;
    assetKind?: string;
    ratedCapacity?: string;
    attachments?: string[] | string;
    dvirStatus?: DvirReadinessStatus;
    activeJob?: DispatchJob | null;
    dispatchPrefix?: string;
    engineHours?: string | number;
    fuelPercent?: number;
    onChangeUnit?: () => void;
    onPress?: () => void;
}

export const AssetVehicleCard: React.FC<AssetVehicleCardProps> = ({
    assetCode = 'ALB-CRN-050',
    assetName = 'Liebherr LTM 1050-3.1',
    assetKind = 'mobile_crane',
    ratedCapacity = '50T All-Terrain',
    attachments = ['20T Counterweight', 'Jib Extension'],
    dvirStatus = 'cleared',
    activeJob = null,
    dispatchPrefix = '',
    engineHours = '4,820 hrs',
    fuelPercent = 82,
    onChangeUnit,
    onPress,
}) => {
    const { isDarkHud } = useTheme();

    const formattedAttachments = Array.isArray(attachments)
        ? attachments.join(' · ')
        : attachments;

    const getMachineIcon = (): IconName => {
        const kind = (assetKind || '').toLowerCase();

        if (
            kind.includes('truck') ||
            kind.includes('transport') ||
            kind.includes('mover')
        ) {
            return 'truck';
        }

        return 'crane';
    };

    const renderDvirBadge = () => {
        switch (dvirStatus) {
            case 'cleared':
                return (
                    <View
                        style={[
                            styles.dvirBadge,
                            styles.dvirBadgeCleared,
                            isDarkHud && styles.darkDvirBadgeCleared,
                        ]}
                        testID="vehicle-card-dvir-status"
                    >
                        <Icon
                            color={isDarkHud ? '#34D399' : colors.greenDark}
                            name="check-circle"
                            size={13}
                        />
                        <Text
                            style={[
                                styles.dvirBadgeText,
                                styles.dvirBadgeTextCleared,
                                isDarkHud && styles.darkDvirBadgeTextCleared,
                            ]}
                        >
                            DVIR Cleared
                        </Text>
                    </View>
                );
            case 'defect':
                return (
                    <View
                        style={[
                            styles.dvirBadge,
                            styles.dvirBadgeDefect,
                            isDarkHud && styles.darkDvirBadgeDefect,
                        ]}
                        testID="vehicle-card-dvir-status"
                    >
                        <Icon
                            color={isDarkHud ? '#F87171' : colors.redDark}
                            name="alert-circle"
                            size={13}
                        />
                        <Text
                            style={[
                                styles.dvirBadgeText,
                                styles.dvirBadgeTextDefect,
                                isDarkHud && styles.darkDvirBadgeTextDefect,
                            ]}
                        >
                            Defect Flagged
                        </Text>
                    </View>
                );
            case 'pending':
            default:
                return (
                    <View
                        style={[
                            styles.dvirBadge,
                            styles.dvirBadgePending,
                            isDarkHud && styles.darkDvirBadgePending,
                        ]}
                        testID="vehicle-card-dvir-status"
                    >
                        <Icon
                            color={isDarkHud ? '#FBBF24' : colors.amberDark}
                            name="alert"
                            size={13}
                        />
                        <Text
                            style={[
                                styles.dvirBadgeText,
                                styles.dvirBadgeTextPending,
                                isDarkHud && styles.darkDvirBadgeTextPending,
                            ]}
                        >
                            Pre-Trip Due
                        </Text>
                    </View>
                );
        }
    };

    const CardContainer = onPress ? Pressable : View;

    return (
        <CardContainer
            accessibilityHint={
                onPress
                    ? 'Tap to view equipment specifications, DVIR inspection, or setup fleet status'
                    : undefined
            }
            accessibilityLabel={`Assigned Asset ${assetCode}, ${assetName}. Capacity: ${ratedCapacity}. ${activeJob ? `Active Dispatch: ${activeJob.reference}` : 'Yard Standby'}`}
            accessibilityRole={onPress ? 'button' : undefined}
            onPress={onPress}
            style={({ pressed }: { pressed?: boolean } = {}) => [
                styles.card,
                isDarkHud && styles.darkCard,
                pressed && styles.pressed,
            ]}
            testID="hero-vehicle-card"
        >
            {/* Header: Machine Icon, Asset Code, Tonnage, and DVIR Readiness */}
            <View style={styles.headerRow}>
                <View style={styles.machineInfoCol}>
                    <View
                        style={[
                            styles.machineIconBox,
                            isDarkHud && styles.darkMachineIconBox,
                        ]}
                    >
                        <Icon
                            color={isDarkHud ? '#F59E0B' : '#D97706'}
                            name={getMachineIcon()}
                            size={22}
                        />
                    </View>
                    <View style={styles.titleWrap}>
                        <View style={styles.codeLine}>
                            <Text
                                style={[
                                    styles.assetCodeText,
                                    isDarkHud && styles.darkAssetCodeText,
                                ]}
                                testID="vehicle-card-code"
                            >
                                {assetCode}
                            </Text>
                            <View
                                style={[
                                    styles.tonnagePill,
                                    isDarkHud && styles.darkTonnagePill,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.tonnagePillText,
                                        isDarkHud && styles.darkTonnagePillText,
                                    ]}
                                >
                                    {ratedCapacity}
                                </Text>
                            </View>
                        </View>
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.assetNameText,
                                isDarkHud && styles.darkAssetNameText,
                            ]}
                        >
                            {assetName}
                        </Text>
                    </View>
                </View>

                <View style={styles.badgeAndActionsWrap}>
                    {renderDvirBadge()}
                    {onChangeUnit ? (
                        <Pressable
                            accessibilityLabel="Change assigned unit"
                            accessibilityRole="button"
                            onPress={onChangeUnit}
                            style={[
                                styles.changeUnitBtn,
                                isDarkHud && styles.darkChangeUnitBtn,
                            ]}
                            testID="vehicle-card-change-unit-btn"
                        >
                            <Icon
                                color={isDarkHud ? '#F59E0B' : colors.primary}
                                name="sync"
                                size={11}
                            />
                            <Text
                                style={[
                                    styles.changeUnitText,
                                    isDarkHud && styles.darkChangeUnitText,
                                ]}
                            >
                                Change Unit
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            </View>

            {/* Divider */}
            <View style={[styles.divider, isDarkHud && styles.darkDivider]} />

            {/* Rigging & Attachment Setup */}
            <View style={styles.sectionRow} testID="vehicle-card-config">
                <Text
                    style={[
                        styles.sectionLabel,
                        isDarkHud && styles.darkSectionLabel,
                    ]}
                >
                    CONFIGURATION
                </Text>
                <View style={styles.configValueRow}>
                    <Icon
                        color={isDarkHud ? '#94A3B8' : colors.secondary}
                        name="tools"
                        size={14}
                    />
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.configValueText,
                            isDarkHud && styles.darkConfigValueText,
                        ]}
                    >
                        {formattedAttachments || 'Standard Hook Block'}
                    </Text>
                </View>
            </View>

            {/* Active Dispatch / Operational Context */}
            <View style={styles.sectionRow} testID="vehicle-card-dispatch">
                <Text
                    style={[
                        styles.sectionLabel,
                        isDarkHud && styles.darkSectionLabel,
                    ]}
                >
                    {activeJob ? 'ACTIVE DISPATCH' : 'FLEET STATUS'}
                </Text>
                {activeJob ? (
                    <View style={styles.dispatchDetailsWrap}>
                        <View style={styles.dispatchPrimaryRow}>
                            <View
                                style={[
                                    styles.dispatchBadge,
                                    isDarkHud && styles.darkDispatchBadge,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.dispatchBadgeText,
                                        isDarkHud &&
                                            styles.darkDispatchBadgeText,
                                    ]}
                                >
                                    {`${dispatchPrefix}${activeJob.reference}`}
                                </Text>
                            </View>
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.dispatchTitleText,
                                    isDarkHud && styles.darkDispatchTitleText,
                                ]}
                            >
                                {activeJob.title || 'Heavy Lifting Operation'}
                            </Text>
                        </View>
                        {activeJob.client || activeJob.site ? (
                            <View style={styles.dispatchLocationRow}>
                                <Icon
                                    color={
                                        isDarkHud ? '#F59E0B' : colors.primary
                                    }
                                    name="location"
                                    size={13}
                                />
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.dispatchLocationText,
                                        isDarkHud &&
                                            styles.darkDispatchLocationText,
                                    ]}
                                >
                                    {[activeJob.client, activeJob.site]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                ) : (
                    <View style={styles.standbyRow}>
                        <View style={styles.standbyDot} />
                        <Text
                            style={[
                                styles.standbyText,
                                isDarkHud && styles.darkStandbyText,
                            ]}
                        >
                            Yard Standby · Ready for Mobilization
                        </Text>
                    </View>
                )}
            </View>

            {/* Telemetry & Action Footer */}
            <View style={[styles.footerRow, isDarkHud && styles.darkFooterRow]}>
                <View style={styles.telemetryGroup}>
                    {engineHours ? (
                        <View style={styles.telemetryItem}>
                            <Icon
                                color={isDarkHud ? '#94A3B8' : colors.muted}
                                name="clock"
                                size={13}
                            />
                            <Text
                                style={[
                                    styles.telemetryText,
                                    isDarkHud && styles.darkTelemetryText,
                                ]}
                            >
                                {engineHours}
                            </Text>
                        </View>
                    ) : null}
                    {fuelPercent !== undefined ? (
                        <View style={styles.telemetryItem}>
                            <Icon
                                color={isDarkHud ? '#94A3B8' : colors.muted}
                                name="fuel"
                                size={13}
                            />
                            <Text
                                style={[
                                    styles.telemetryText,
                                    isDarkHud && styles.darkTelemetryText,
                                ]}
                            >
                                {fuelPercent}% Fuel
                            </Text>
                        </View>
                    ) : null}
                </View>

                {onPress ? (
                    <View style={styles.actionPromptWrap}>
                        <Text
                            style={[
                                styles.actionPromptText,
                                isDarkHud && styles.darkActionPromptText,
                            ]}
                        >
                            Equipment Setup
                        </Text>
                        <Icon
                            color={isDarkHud ? '#F59E0B' : colors.primary}
                            name="chevron-right"
                            size={14}
                        />
                    </View>
                ) : null}
            </View>
        </CardContainer>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 16,
        borderWidth: 1.5,
        marginBottom: 12,
        padding: 14,
        width: '100%',
        ...shadows.sm,
    },
    darkCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        shadowColor: '#000000',
        shadowOpacity: 0.3,
    },
    pressed: {
        opacity: 0.88,
        transform: [{ scale: 0.99 }],
    },
    headerRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    machineInfoCol: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: 10,
        marginRight: 8,
    },
    machineIconBox: {
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: 10,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    darkMachineIconBox: {
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
    },
    titleWrap: {
        flex: 1,
    },
    codeLine: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    assetCodeText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    darkAssetCodeText: {
        color: '#F8FAFC',
    },
    tonnagePill: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    darkTonnagePill: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    tonnagePillText: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '700',
    },
    darkTonnagePillText: {
        color: '#94A3B8',
    },
    assetNameText: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '500',
        marginTop: 1,
    },
    darkAssetNameText: {
        color: '#94A3B8',
    },
    dvirBadge: {
        alignItems: 'center',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    dvirBadgeCleared: {
        backgroundColor: '#ECFDF5',
    },
    darkDvirBadgeCleared: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    dvirBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    dvirBadgeTextCleared: {
        color: '#047857',
    },
    darkDvirBadgeTextCleared: {
        color: '#34D399',
    },
    dvirBadgePending: {
        backgroundColor: '#FFFBEB',
    },
    darkDvirBadgePending: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    dvirBadgeTextPending: {
        color: '#B45309',
    },
    darkDvirBadgeTextPending: {
        color: '#FBBF24',
    },
    dvirBadgeDefect: {
        backgroundColor: '#FEF2F2',
    },
    darkDvirBadgeDefect: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    dvirBadgeTextDefect: {
        color: '#B91C1C',
    },
    darkDvirBadgeTextDefect: {
        color: '#F87171',
    },
    divider: {
        backgroundColor: colors.borderSubtle,
        height: 1,
        marginVertical: 10,
    },
    darkDivider: {
        backgroundColor: '#334155',
    },
    sectionRow: {
        marginBottom: 8,
    },
    sectionLabel: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.6,
        marginBottom: 3,
    },
    darkSectionLabel: {
        color: '#64748B',
    },
    configValueRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    configValueText: {
        color: colors.textSecondary,
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
    },
    darkConfigValueText: {
        color: '#CBD5E1',
    },
    dispatchDetailsWrap: {
        gap: 3,
    },
    dispatchPrimaryRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    dispatchBadge: {
        backgroundColor: colors.primaryLight,
        borderRadius: 5,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    darkDispatchBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
    },
    dispatchBadgeText: {
        color: colors.primaryDark,
        fontSize: 11,
        fontWeight: '800',
    },
    darkDispatchBadgeText: {
        color: '#F59E0B',
    },
    dispatchTitleText: {
        color: colors.text,
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
    },
    darkDispatchTitleText: {
        color: '#F1F5F9',
    },
    dispatchLocationRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
    },
    dispatchLocationText: {
        color: colors.secondary,
        flex: 1,
        fontSize: 11,
        fontWeight: '500',
    },
    darkDispatchLocationText: {
        color: '#94A3B8',
    },
    standbyRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    standbyDot: {
        backgroundColor: '#10B981',
        borderRadius: 3,
        height: 6,
        width: 6,
    },
    standbyText: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '500',
    },
    darkStandbyText: {
        color: '#94A3B8',
    },
    footerRow: {
        alignItems: 'center',
        borderTopColor: colors.borderSubtle,
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
        paddingTop: 8,
    },
    darkFooterRow: {
        borderTopColor: '#334155',
    },
    telemetryGroup: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
    },
    telemetryItem: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
    },
    telemetryText: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '600',
    },
    darkTelemetryText: {
        color: '#94A3B8',
    },
    actionPromptWrap: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 2,
    },
    actionPromptText: {
        color: colors.primary,
        fontSize: 11,
        fontWeight: '700',
    },
    darkActionPromptText: {
        color: '#F59E0B',
    },
    badgeAndActionsWrap: {
        alignItems: 'flex-end',
        gap: 6,
    },
    changeUnitBtn: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    darkChangeUnitBtn: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    changeUnitText: {
        color: colors.primary,
        fontSize: 11,
        fontWeight: '700',
    },
    darkChangeUnitText: {
        color: '#F59E0B',
    },
});
