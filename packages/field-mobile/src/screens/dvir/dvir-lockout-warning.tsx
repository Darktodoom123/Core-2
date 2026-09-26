import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
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
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={[styles.lockoutBanner]} testID="dvir-lockout-banner">
            <Icon color={theme.hazardRedText} name="alert" size={20} />
            <View style={styles.lockoutCopy}>
                <Text style={[styles.lockoutTitle]}>
                    DISPATCH LOCKOUT ACTIVE
                </Text>
                <Text style={[styles.lockoutText]}>
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
                            <Icon
                                color={theme.surfaceDark}
                                name="sync"
                                size={16}
                            />
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
                            <Icon
                                color={theme.textPrimary}
                                name="clock"
                                size={16}
                            />
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

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        bannerActionsRow: {
            flexDirection: 'row',
            gap: 8,
            marginTop: 10,
        },
        bannerStandbyBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderWidth: 1,
            minHeight: 48,
            paddingHorizontal: 14,
            borderRadius: 12,
        },
        bannerStandbyBtnText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        bannerSwapBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: theme.brandAmber,
            minHeight: 48,
            paddingHorizontal: 14,
            borderRadius: 12,
        },
        bannerSwapBtnText: {
            color: theme.surfaceDark,
            fontSize: 14,
            fontWeight: '700',
        },
        lockoutBanner: {
            alignItems: 'flex-start',
            backgroundColor: theme.hazardRedLight,
            borderColor: theme.hazardRed,
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
            color: theme.textPrimary,
            fontSize: 13,
            lineHeight: 18,
            marginTop: 2,
        },
        lockoutTitle: {
            color: theme.hazardRedText,
            fontSize: 14,
            fontWeight: '700',
            letterSpacing: 0.3,
        },
    });
