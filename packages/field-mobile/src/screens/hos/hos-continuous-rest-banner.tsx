import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import type { HosComplianceResult } from '../../hooks/useHosCompliance';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { DutyStatus, ShiftInfo, StandbyReason } from '../../types/index';

export interface HosContinuousRestBannerProps {
    breakSuggestion: NonNullable<HosComplianceResult['breakSuggestion']>;
    hosCompliance: HosComplianceResult;
    onUpdateDutyStatus:
        | ((
              dutyStatus: DutyStatus,
              standbyReason?: StandbyReason,
              remarks?: string,
          ) => Promise<boolean | void> | boolean | void)
        | undefined;
    setOverriddenStatus: React.Dispatch<
        React.SetStateAction<{
            propStatus?: DutyStatus;
            localStatus: DutyStatus;
        } | null>
    >;
    shiftInfo: ShiftInfo;
}

export const HosContinuousRestBanner: React.FC<
    HosContinuousRestBannerProps
> = ({
    breakSuggestion,
    hosCompliance,
    onUpdateDutyStatus,
    setOverriddenStatus,
    shiftInfo,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    // Approaching the 4.5h continuous limit is a warning; reaching it is critical.
    const toneText = hosCompliance.isContinuousRestRequired
        ? theme.hazardRedText
        : theme.warningOrangeText;

    return (
        <View
            accessibilityRole="alert"
            style={[
                styles.doleContinuousRestBanner,
                hosCompliance.isContinuousRestRequired &&
                    styles.doleContinuousRestRequiredBanner,
            ]}
            testID="dole-continuous-rest-banner"
        >
            <View style={styles.doleContinuousRestContent}>
                <View style={styles.doleContinuousRestHeader}>
                    <Icon color={toneText} name="clock" size={18} />
                    <Text
                        style={[
                            styles.doleContinuousRestTitle,
                            { color: toneText },
                        ]}
                    >
                        {breakSuggestion.title}
                    </Text>
                    <View
                        style={[styles.continuousPill]}
                        testID="dole-continuous-counter-pill"
                    >
                        <Text style={[styles.continuousPillText]}>
                            {hosCompliance.continuousCounterLabel}
                        </Text>
                    </View>
                </View>
                <Text
                    style={[
                        styles.doleContinuousRestMessage,
                        { color: theme.textPrimary },
                    ]}
                >
                    {breakSuggestion.message}
                </Text>
            </View>
            <Pressable
                accessibilityLabel={breakSuggestion.actionLabel}
                accessibilityRole="button"
                onPress={() => {
                    setOverriddenStatus({
                        propStatus: shiftInfo.dutyStatus,
                        localStatus: 'standby',
                    });

                    if (onUpdateDutyStatus) {
                        void onUpdateDutyStatus('standby');
                    }
                }}
                style={[styles.doleContinuousRestBtn]}
                testID="dole-continuous-break-btn"
            >
                <Text style={[styles.doleContinuousRestBtnText]}>
                    {breakSuggestion.actionLabel}
                </Text>
            </Pressable>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        continuousPill: {
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 6,
            borderWidth: 1,
            paddingHorizontal: 6,
            paddingVertical: 2,
        },
        continuousPillText: {
            color: theme.textPrimary,
            fontFamily: 'monospace',
            fontSize: 12,
            fontWeight: '700',
        },
        doleContinuousRestBanner: {
            alignItems: 'center',
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
            borderRadius: 12,
            borderWidth: 1.5,
            flexDirection: 'row',
            gap: 10,
            justifyContent: 'space-between',
            marginBottom: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
        },
        doleContinuousRestBtn: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 14,
        },
        doleContinuousRestBtnText: {
            color: theme.surfaceDark,
            fontSize: 14,
            fontWeight: '700',
        },
        doleContinuousRestContent: {
            flex: 1,
            gap: 4,
        },
        doleContinuousRestHeader: {
            alignItems: 'center',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
        },
        doleContinuousRestMessage: {
            fontSize: 13,
            fontWeight: '500',
            lineHeight: 16,
        },
        doleContinuousRestRequiredBanner: {
            backgroundColor: theme.hazardRedLight,
            borderColor: theme.hazardRed,
        },
        doleContinuousRestTitle: {
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 0.2,
        },
    });
