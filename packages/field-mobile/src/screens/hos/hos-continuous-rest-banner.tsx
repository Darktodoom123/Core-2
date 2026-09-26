import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import type { HosComplianceResult } from '../../hooks/useHosCompliance';
import { useTheme } from '../../theme';
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
    const { isDarkHud } = useTheme();

    return (
        <View
            accessibilityRole="alert"
            style={[
                styles.doleContinuousRestBanner,
                hosCompliance.isContinuousRestRequired &&
                    styles.doleContinuousRestRequiredBanner,
                isDarkHud && styles.darkDoleContinuousRestBanner,
            ]}
            testID="dole-continuous-rest-banner"
        >
            <View style={styles.doleContinuousRestContent}>
                <View style={styles.doleContinuousRestHeader}>
                    <Icon
                        color={
                            hosCompliance.isContinuousRestRequired
                                ? isDarkHud
                                    ? '#F59E0B'
                                    : '#B45309'
                                : isDarkHud
                                  ? '#38BDF8'
                                  : '#0284C7'
                        }
                        name="clock"
                        size={18}
                    />
                    <Text
                        style={[
                            styles.doleContinuousRestTitle,
                            isDarkHud && styles.darkDoleContinuousRestTitle,
                        ]}
                    >
                        {breakSuggestion.title}
                    </Text>
                    <View
                        style={[
                            styles.continuousPill,
                            isDarkHud && styles.darkContinuousPill,
                        ]}
                        testID="dole-continuous-counter-pill"
                    >
                        <Text
                            style={[
                                styles.continuousPillText,
                                isDarkHud && styles.darkContinuousPillText,
                            ]}
                        >
                            {hosCompliance.continuousCounterLabel}
                        </Text>
                    </View>
                </View>
                <Text
                    style={[
                        styles.doleContinuousRestMessage,
                        isDarkHud && styles.darkDoleContinuousRestMessage,
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
                style={[
                    styles.doleContinuousRestBtn,
                    isDarkHud && styles.darkDoleContinuousRestBtn,
                ]}
                testID="dole-continuous-break-btn"
            >
                <Text
                    style={[
                        styles.doleContinuousRestBtnText,
                        isDarkHud && styles.darkDoleContinuousRestBtnText,
                    ]}
                >
                    {breakSuggestion.actionLabel}
                </Text>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    continuousPill: {
        backgroundColor: '#FDE68A',
        borderColor: '#F59E0B',
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    continuousPillText: {
        color: '#78350F',
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: '800',
    },
    darkContinuousPill: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#F59E0B',
    },
    darkContinuousPillText: {
        color: '#FDE68A',
    },
    darkDoleContinuousRestBanner: {
        backgroundColor: '#1E293B',
        borderColor: '#F59E0B',
    },
    darkDoleContinuousRestBtn: {
        backgroundColor: '#F59E0B',
    },
    darkDoleContinuousRestBtnText: {
        color: '#0F172A',
    },
    darkDoleContinuousRestMessage: {
        color: '#FCD34D',
    },
    darkDoleContinuousRestTitle: {
        color: '#FBBF24',
    },
    doleContinuousRestBanner: {
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
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
        backgroundColor: '#D97706',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    doleContinuousRestBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
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
        color: '#92400E',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
    },
    doleContinuousRestRequiredBanner: {
        backgroundColor: '#FFFBEB',
        borderColor: '#D97706',
    },
    doleContinuousRestTitle: {
        color: '#92400E',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
});
