import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { createDvirSharedStyles } from './dvir-shared-styles';

export interface DvirAttestationProps {
    attested: boolean;
    onToggle: () => void;
}

/**
 * The operator confirms the inspection under their own signed-in account.
 * This replaces a drawn signature the server never stored.
 */
export const DvirAttestation: React.FC<DvirAttestationProps> = ({
    attested,
    onToggle,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View style={[dvirSharedStyles.telemetryCard]}>
            <Text style={[dvirSharedStyles.telemetryHeading]}>
                CONFIRM INSPECTION
            </Text>
            <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: attested }}
                onPress={onToggle}
                style={[styles.row, attested && styles.rowChecked]}
                testID="dvir-attestation"
            >
                <View style={[styles.box, attested && styles.boxChecked]}>
                    {attested ? (
                        <Icon
                            color={theme.surfaceDark}
                            name="check"
                            size={16}
                        />
                    ) : null}
                </View>
                <Text style={styles.label}>
                    I inspected this unit and the answers above are true.
                </Text>
            </Pressable>
            <Text style={styles.hint}>
                Recorded under your account when you finish.
            </Text>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        row: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 12,
            minHeight: 56,
            paddingHorizontal: 14,
            paddingVertical: 10,
        },
        // Selection role: Signal Gold Soft with a gold border.
        rowChecked: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
        },
        box: {
            alignItems: 'center',
            borderColor: theme.borderStrong,
            borderRadius: 6,
            borderWidth: 2,
            height: 24,
            justifyContent: 'center',
            width: 24,
        },
        boxChecked: {
            backgroundColor: theme.brandAmber,
            borderColor: theme.brandAmber,
        },
        label: {
            color: theme.textPrimary,
            flex: 1,
            fontSize: 15,
            fontWeight: '500',
            lineHeight: 21,
        },
        hint: {
            color: theme.textSecondary,
            fontSize: 13,
            marginTop: 8,
        },
    });
