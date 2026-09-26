import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme } from '../../theme';

export interface HosShiftLimitBannerProps {
    isDoleCapExceeded: boolean;
    setReliefHandoverOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const HosShiftLimitBanner: React.FC<HosShiftLimitBannerProps> = ({
    isDoleCapExceeded,
    setReliefHandoverOpen,
}) => {
    const { isDarkHud } = useTheme();

    return (
        <View
            accessibilityRole="alert"
            style={[
                styles.doleWarningBanner,
                isDoleCapExceeded && styles.doleCapBanner,
                isDarkHud &&
                    (isDoleCapExceeded
                        ? styles.darkDoleCapBanner
                        : styles.darkDoleWarningBanner),
            ]}
            testID="dole-shift-limit-banner"
        >
            <View style={styles.doleWarningContent}>
                <Icon
                    color={
                        isDoleCapExceeded
                            ? '#EF4444'
                            : isDarkHud
                              ? '#FFBF00'
                              : '#806000'
                    }
                    name="alert"
                    size={18}
                />
                <Text
                    style={[
                        styles.doleWarningText,
                        isDoleCapExceeded && styles.doleCapText,
                        isDarkHud &&
                            (isDoleCapExceeded
                                ? styles.darkDoleCapText
                                : styles.darkDoleWarningText),
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
                style={[
                    styles.doleHandoverBtn,
                    isDarkHud && styles.darkDoleHandoverBtn,
                ]}
                testID="hos-relief-handover-btn"
            >
                <Text
                    style={[
                        styles.doleHandoverBtnText,
                        isDarkHud && styles.darkDoleHandoverBtnText,
                    ]}
                >
                    Relief Handover
                </Text>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    darkDoleCapBanner: {
        backgroundColor: '#1E293B',
        borderColor: '#EF4444',
    },
    darkDoleCapText: {
        color: '#F87171',
    },
    darkDoleHandoverBtn: {
        backgroundColor: '#FFBF00',
    },
    darkDoleHandoverBtnText: {
        color: '#090D16',
    },
    darkDoleWarningBanner: {
        backgroundColor: '#1E293B',
        borderColor: '#FFBF00',
    },
    darkDoleWarningText: {
        color: '#FFBF00',
    },
    doleCapBanner: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
    },
    doleCapText: {
        color: '#991B1B',
    },
    doleHandoverBtn: {
        backgroundColor: '#FFBF00',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    doleHandoverBtnText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    doleWarningBanner: {
        alignItems: 'center',
        backgroundColor: '#FFF3C4',
        borderColor: '#FFBF00',
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
        color: '#806000',
        flex: 1,
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 16,
    },
});
