import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';

export interface HosShiftLimitBannerProps {
    isDoleCapExceeded: boolean;
    setReliefHandoverOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const HosShiftLimitBanner: React.FC<HosShiftLimitBannerProps> = ({
    isDoleCapExceeded,
    setReliefHandoverOpen,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View
            accessibilityRole="alert"
            style={[
                styles.doleWarningBanner,
                isDoleCapExceeded && styles.doleCapBanner,
            ]}
            testID="dole-shift-limit-banner"
        >
            <View style={styles.doleWarningContent}>
                <Icon
                    color={
                        isDoleCapExceeded
                            ? theme.hazardRedText
                            : theme.warningOrangeText
                    }
                    name="alert"
                    size={18}
                />
                <Text
                    style={[
                        styles.doleWarningText,
                        isDoleCapExceeded && styles.doleCapText,
                    ]}
                >
                    {isDoleCapExceeded
                        ? '10h Maximum Operating Cap Exceeded — Mandatory Rest Period.'
                        : 'Approaching 10h Operating Limit — Prepare for Handover or Shift Closure.'}
                </Text>
            </View>
            <Pressable
                accessibilityLabel="Handover equipment to relief operator"
                accessibilityRole="button"
                onPress={() => setReliefHandoverOpen(true)}
                style={[styles.doleHandoverBtn]}
                testID="hos-relief-handover-btn"
            >
                <Text style={[styles.doleHandoverBtnText]}>
                    Relief Handover
                </Text>
            </Pressable>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        doleCapBanner: {
            backgroundColor: theme.hazardRedLight,
            borderColor: theme.hazardRed,
        },
        doleCapText: {
            color: theme.hazardRedText,
        },
        doleHandoverBtn: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 14,
        },
        doleHandoverBtnText: {
            color: theme.surfaceDark,
            fontSize: 14,
            fontWeight: '700',
        },
        doleWarningBanner: {
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
        doleWarningContent: {
            alignItems: 'center',
            flex: 1,
            flexDirection: 'row',
            gap: 8,
        },
        doleWarningText: {
            color: theme.warningOrangeText,
            flex: 1,
            fontSize: 13,
            fontWeight: '700',
            lineHeight: 16,
        },
    });
