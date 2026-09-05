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
    variant?: 'detailed' | 'hero';
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
    variant = 'detailed',
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
                            size={12}
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
                            size={12}
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
                            size={12}
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

    if (variant === 'hero') {
        return (
            <CardContainer
                accessibilityHint={
                    onPress
                        ? 'Tap to view equipment specifications or setup fleet status'
                        : undefined
                }
                accessibilityLabel={`Assigned vehicle hero card ${assetCode}, ${assetName}`}
                accessibilityRole={onPress ? 'button' : undefined}
                onPress={onPress}
                style={({ pressed }: { pressed?: boolean } = {}) => [
                    styles.heroCardRoot,
                    isDarkHud && styles.darkHeroCardRoot,
                    pressed && styles.pressed,
                ]}
                testID="hero-vehicle-card"
            >
                <Text
                    style={[
                        styles.heroCardSubtitle,
                        isDarkHud && styles.darkHeroCardSubtitle,
                    ]}
                >
                    Assigned vehicle hero card
                </Text>
                <Text
                    style={[
                        styles.heroUnitCode,
                        isDarkHud && styles.darkHeroUnitCode,
                    ]}
                    testID="vehicle-card-code"
                >
                    {assetCode}
                </Text>
                <Text
                    style={[
                        styles.heroModelText,
                        isDarkHud && styles.darkHeroModelText,
                    ]}
                >
                    {assetName}
                </Text>

                <View style={styles.heroFooterRow}>
                    <View style={styles.heroTelematicsGroup}>
                        <View style={styles.heroTeleItem}>
                            <Icon
                                name="fuel"
                                size={18}
                                color={
                                    isDarkHud ? colors.hudTextDim : colors.muted
                                }
                            />
                            <View style={styles.heroTeleTextCol}>
                                <Text
                                    style={[
                                        styles.heroTeleValue,
                                        isDarkHud && styles.darkHeroTeleValue,
                                    ]}
                                >
                                    {fuelPercent !== undefined
                                        ? `${fuelPercent.toFixed(1)}%`
                                        : '32.0%'}
                                </Text>
                                <Text
                                    style={[
                                        styles.heroTeleLabel,
                                        !isDarkHud && styles.lightHeroTeleLabel,
                                    ]}
                                >
                                    Fuel level
                                </Text>
                            </View>
                        </View>

                        <View style={styles.heroTeleItem}>
                            <Icon
                                name="engine"
                                size={18}
                                color={
                                    isDarkHud ? colors.hudTextDim : colors.muted
                                }
                            />
                            <View style={styles.heroTeleTextCol}>
                                <Text
                                    style={[
                                        styles.heroTeleValue,
                                        isDarkHud && styles.darkHeroTeleValue,
                                    ]}
                                >
                                    Engine
                                </Text>
                                <Text
                                    style={[
                                        styles.heroTeleLabel,
                                        !isDarkHud && styles.lightHeroTeleLabel,
                                    ]}
                                >
                                    Hours
                                </Text>
                            </View>
                        </View>
                    </View>

                    {onChangeUnit ? (
                        <Pressable
                            accessibilityLabel="Change assigned unit"
                            accessibilityRole="button"
                            onPress={onChangeUnit}
                            style={[
                                styles.heroChangeUnitBtn,
                                isDarkHud && styles.darkHeroChangeUnitBtn,
                            ]}
                            testID="vehicle-card-change-unit-btn"
                        >
                            <Text
                                style={[
                                    styles.heroChangeUnitText,
                                    isDarkHud && styles.darkHeroChangeUnitText,
                                ]}
                            >
                                Change Unit
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            </CardContainer>
        );
    }

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
                            color={isDarkHud ? colors.hudAmber : colors.amber}
                            name={getMachineIcon()}
                            size={20}
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
                                color={
                                    isDarkHud ? colors.hudAmber : colors.amber
                                }
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
                        color={isDarkHud ? colors.hudTextDim : colors.muted}
                        name="tools"
                        size={13}
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
                                        isDarkHud
                                            ? colors.hudAmber
                                            : colors.amber
                                    }
                                    name="location"
                                    size={12}
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
                                color={
                                    isDarkHud ? colors.hudTextDim : colors.muted
                                }
                                name="clock"
                                size={12}
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
                                color={
                                    isDarkHud ? colors.hudTextDim : colors.muted
                                }
                                name="fuel"
                                size={12}
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
                            color={isDarkHud ? colors.hudAmber : colors.amber}
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
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 12,
        padding: 14,
        width: '100%',
        ...shadows.sm,
    },
    darkCard: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
        shadowColor: 'transparent',
    },
    pressed: {
        opacity: 0.9,
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
        backgroundColor: colors.amberLight,
        borderRadius: 8,
        height: 38,
        justifyContent: 'center',
        width: 38,
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
        gap: 6,
    },
    assetCodeText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    darkAssetCodeText: {
        color: colors.hudText,
    },
    tonnagePill: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    darkTonnagePill: {
        backgroundColor: colors.surfaceDark,
    },
    tonnagePillText: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '700',
    },
    darkTonnagePillText: {
        color: colors.hudTextDim,
    },
    assetNameText: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    darkAssetNameText: {
        color: colors.hudTextDim,
    },
    badgeAndActionsWrap: {
        alignItems: 'flex-end',
        gap: 6,
    },
    dvirBadge: {
        alignItems: 'center',
        borderRadius: 6,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    dvirBadgeCleared: {
        backgroundColor: colors.greenLight,
    },
    darkDvirBadgeCleared: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    dvirBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    dvirBadgeTextCleared: {
        color: colors.greenDark,
    },
    darkDvirBadgeTextCleared: {
        color: '#34D399',
    },
    dvirBadgePending: {
        backgroundColor: colors.amberLight,
    },
    darkDvirBadgePending: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    dvirBadgeTextPending: {
        color: colors.amberDark,
    },
    darkDvirBadgeTextPending: {
        color: '#FBBF24',
    },
    dvirBadgeDefect: {
        backgroundColor: colors.redLight,
    },
    darkDvirBadgeDefect: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    dvirBadgeTextDefect: {
        color: colors.redDark,
    },
    darkDvirBadgeTextDefect: {
        color: '#F87171',
    },
    changeUnitBtn: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 3,
        paddingVertical: 2,
    },
    darkChangeUnitBtn: {},
    changeUnitText: {
        color: colors.amber,
        fontSize: 10,
        fontWeight: '700',
    },
    darkChangeUnitText: {
        color: colors.hudAmber,
    },
    divider: {
        backgroundColor: colors.borderSubtle,
        height: StyleSheet.hairlineWidth,
        marginVertical: 10,
    },
    darkDivider: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    sectionRow: {
        marginBottom: 8,
    },
    sectionLabel: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.6,
        marginBottom: 4,
    },
    darkSectionLabel: {
        color: colors.hudTextDim,
    },
    configValueRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    configValueText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
    },
    darkConfigValueText: {
        color: colors.hudText,
    },
    dispatchDetailsWrap: {
        gap: 4,
    },
    dispatchPrimaryRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    dispatchBadge: {
        backgroundColor: colors.amberLight,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    darkDispatchBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    dispatchBadgeText: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '800',
    },
    darkDispatchBadgeText: {
        color: colors.hudAmber,
    },
    dispatchTitleText: {
        color: colors.text,
        flex: 1,
        fontSize: 13,
        fontWeight: '700',
    },
    darkDispatchTitleText: {
        color: colors.hudText,
    },
    dispatchLocationRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
    },
    dispatchLocationText: {
        color: colors.muted,
        fontSize: 12,
    },
    darkDispatchLocationText: {
        color: colors.hudTextDim,
    },
    standbyRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    standbyDot: {
        backgroundColor: colors.green,
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    standbyText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    darkStandbyText: {
        color: colors.hudTextDim,
    },
    footerRow: {
        alignItems: 'center',
        borderTopColor: colors.borderSubtle,
        borderTopWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
        paddingTop: 10,
    },
    darkFooterRow: {
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    telemetryGroup: {
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
        color: colors.hudTextDim,
    },
    actionPromptWrap: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 2,
    },
    actionPromptText: {
        color: colors.amber,
        fontSize: 12,
        fontWeight: '700',
    },
    darkActionPromptText: {
        color: colors.hudAmber,
    },
    heroCardRoot: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
        ...shadows.sm,
    },
    darkHeroCardRoot: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
        shadowColor: 'transparent',
    },
    heroCardSubtitle: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    darkHeroCardSubtitle: {
        color: colors.hudTextDim,
    },
    heroUnitCode: {
        color: colors.amber,
        fontSize: 20,
        fontWeight: '900',
        marginTop: 2,
    },
    darkHeroUnitCode: {
        color: colors.hudAmber,
    },
    heroModelText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
        marginTop: 2,
    },
    darkHeroModelText: {
        color: colors.hudText,
    },
    heroFooterRow: {
        alignItems: 'center',
        borderTopColor: colors.borderSubtle,
        borderTopWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 10,
    },
    heroTelematicsGroup: {
        flexDirection: 'row',
        gap: 16,
    },
    heroTeleItem: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    heroTeleTextCol: {},
    heroTeleValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    darkHeroTeleValue: {
        color: colors.hudText,
    },
    heroTeleLabel: {
        color: colors.muted,
        fontSize: 10,
    },
    lightHeroTeleLabel: {
        color: colors.muted,
    },
    heroChangeUnitBtn: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 6,
        justifyContent: 'center',
        minHeight: 32,
        paddingHorizontal: 10,
    },
    darkHeroChangeUnitBtn: {
        backgroundColor: colors.surfaceDark,
    },
    heroChangeUnitText: {
        color: colors.text,
        fontSize: 11,
        fontWeight: '700',
    },
    darkHeroChangeUnitText: {
        color: colors.hudText,
    },
});
