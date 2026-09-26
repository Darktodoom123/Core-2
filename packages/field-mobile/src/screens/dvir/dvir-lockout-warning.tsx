import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { colors } from '../../components/nativeStyles';
import { useTheme } from '../../theme';
import type { DvirScreenProps } from '../DvirScreen';

export interface DvirLockoutWarningProps {
    mode: 'pre_trip' | 'post_trip' | 'history';
    onBack: DvirScreenProps['onBack'];
    onSwitchToStandby: DvirScreenProps['onSwitchToStandby'];
    setChangeUnitModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DvirLockoutWarning: React.FC<DvirLockoutWarningProps> = ({
    mode,
    onBack,
    onSwitchToStandby,
    setChangeUnitModalOpen,
}) => {
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                styles.lockoutBanner,
                isDarkHud && styles.darkLockoutBanner,
            ]}
            testID="dvir-lockout-banner"
        >
            <Icon
                color={isDarkHud ? '#EF4444' : '#DC2626'}
                name="alert"
                size={20}
            />
            <View style={styles.lockoutCopy}>
                <Text
                    style={[
                        styles.lockoutTitle,
                        isDarkHud && styles.darkLockoutTitle,
                    ]}
                >
                    DISPATCH LOCKOUT ACTIVE
                </Text>
                <Text
                    style={[
                        styles.lockoutText,
                        isDarkHud && styles.darkLockoutText,
                    ]}
                >
                    Vehicle marked unsafe or contains critical defects. Machine
                    is locked from dispatch until verified by a certified
                    mechanic.
                </Text>
                {mode === 'pre_trip' ? (
                    <View style={styles.bannerActionsRow}>
                        <Pressable
                            accessibilityLabel="Swap or link replacement unit"
                            accessibilityRole="button"
                            onPress={() => setChangeUnitModalOpen(true)}
                            style={styles.bannerSwapBtn}
                            testID="dvir-lockout-swap-unit-btn"
                        >
                            <Icon color="#FFFFFF" name="sync" size={12} />
                            <Text style={styles.bannerSwapBtnText}>
                                Swap Replacement Unit
                            </Text>
                        </Pressable>
                        <Pressable
                            accessibilityLabel="Switch to standby and await dispatch"
                            accessibilityRole="button"
                            onPress={() => {
                                onSwitchToStandby?.();
                                onBack?.();
                            }}
                            style={styles.bannerStandbyBtn}
                            testID="dvir-lockout-standby-btn"
                        >
                            <Icon color="#806000" name="clock" size={12} />
                            <Text style={styles.bannerStandbyBtnText}>
                                Standby
                            </Text>
                        </Pressable>
                    </View>
                ) : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    bannerActionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    bannerStandbyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.warningSoft,
        borderColor: colors.warningBorder,
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    bannerStandbyBtnText: {
        color: colors.warningDark,
        fontSize: 12,
        fontWeight: '700',
    },
    bannerSwapBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#2563EB',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    bannerSwapBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    darkLockoutBanner: {
        backgroundColor: '#450A0A',
        borderColor: '#DC2626',
    },
    darkLockoutText: {
        color: '#FECACA',
    },
    darkLockoutTitle: {
        color: '#FCA5A5',
    },
    lockoutBanner: {
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        borderColor: '#EF4444',
        borderRadius: 12,
        borderWidth: 1.5,
        flexDirection: 'row',
        gap: 12,
        padding: 14,
    },
    lockoutCopy: {
        flex: 1,
    },
    lockoutText: {
        color: '#B91C1C',
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    lockoutTitle: {
        color: '#991B1B',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
});
