import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import type { IconName } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';

export type MachineDvirStatus = 'pending' | 'cleared' | 'passed' | 'defect';

export interface MachineReadinessProps {
    status: MachineDvirStatus;
    onOpenDvir?: () => void;
}

interface ReadinessCopy {
    label: string;
    detail: string;
    icon: IconName;
    tone: 'success' | 'warning' | 'critical';
}

const COPY: Record<MachineDvirStatus, ReadinessCopy> = {
    cleared: {
        label: 'Cleared for operation',
        detail: "Today's pre-trip inspection passed.",
        icon: 'check-circle',
        tone: 'success',
    },
    passed: {
        label: 'Cleared for operation',
        detail: "Today's pre-trip inspection passed.",
        icon: 'check-circle',
        tone: 'success',
    },
    pending: {
        label: 'Pre-trip inspection due',
        detail: 'Complete the walkaround before operating this machine.',
        icon: 'alert',
        tone: 'warning',
    },
    defect: {
        label: 'Locked out: under maintenance',
        detail: 'A critical defect was reported. Do not operate this machine until maintenance releases it.',
        icon: 'alert-circle',
        tone: 'critical',
    },
};

/** Whether the operator may use this machine now, and what to do if not. */
export const MachineReadiness: React.FC<MachineReadinessProps> = ({
    status,
    onOpenDvir,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const copy = COPY[status];
    const colors = {
        success: {
            bg: theme.successEmeraldLight,
            edge: theme.successEmerald,
            text: theme.successEmeraldText,
        },
        warning: {
            bg: theme.warningOrangeLight,
            edge: theme.warningOrange,
            text: theme.warningOrangeText,
        },
        critical: {
            bg: theme.hazardRedLight,
            edge: theme.hazardRed,
            text: theme.hazardRedText,
        },
    }[copy.tone];

    return (
        <View
            accessibilityRole={copy.tone === 'success' ? 'summary' : 'alert'}
            style={[
                styles.card,
                { backgroundColor: colors.bg, borderColor: colors.edge },
            ]}
            testID="machine-readiness"
        >
            <View style={styles.row}>
                <Icon color={colors.text} name={copy.icon} size={20} />
                <Text style={[styles.label, { color: colors.text }]}>
                    {copy.label}
                </Text>
            </View>
            <Text style={styles.detail}>{copy.detail}</Text>
            {status === 'pending' && onOpenDvir ? (
                <Pressable
                    accessibilityLabel="Start pre-trip inspection"
                    accessibilityRole="button"
                    onPress={onOpenDvir}
                    style={({ pressed }) => [
                        styles.primary,
                        pressed && styles.pressed,
                    ]}
                    testID="machine-start-dvir-btn"
                >
                    <Icon
                        color={theme.surfaceDark}
                        name="clipboard"
                        size={16}
                    />
                    <Text style={styles.primaryText}>
                        Start pre-trip inspection
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        card: {
            borderRadius: 14,
            borderWidth: 1.5,
            gap: 8,
            marginBottom: 14,
            padding: 14,
        },
        row: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        label: {
            flex: 1,
            fontSize: 16,
            fontWeight: '700',
        },
        detail: {
            color: theme.textPrimary,
            fontSize: 14,
            lineHeight: 20,
        },
        primary: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            marginTop: 4,
            minHeight: 52,
        },
        primaryText: {
            color: theme.surfaceDark,
            fontSize: 15,
            fontWeight: '700',
        },
        pressed: {
            opacity: 0.85,
        },
    });
