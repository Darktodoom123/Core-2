import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { Icon } from '../common/Icon';
import { ReliefClaimButton } from './relief-claim-button';

export interface NoUnitCardProps {
    onClaimRelief: () => void;
}

/**
 * The assigned-vehicle slot when the shift has no unit. Nothing is wrong, so
 * it is a neutral card, not a warning. It makes no inspection claim and uses
 * no duty-status wording (the duty bar above already shows the duty status).
 */
export const NoUnitCard: React.FC<NoUnitCardProps> = ({ onClaimRelief }) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.card} testID="no-unit-card">
            <Text style={styles.eyebrow}>ASSIGNED VEHICLE</Text>
            <View style={styles.row}>
                <View style={styles.iconWrap}>
                    <Icon color={theme.textSecondary} name="crane" size={22} />
                </View>
                <View style={styles.copy}>
                    <Text style={styles.title}>No unit assigned</Text>
                    <Text style={styles.body} testID="empty-assignments-msg">
                        No unit or work is assigned to this shift yet. Pull down
                        to refresh.
                    </Text>
                </View>
            </View>
            <ReliefClaimButton onPress={onClaimRelief} />
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        // Resting card: border only, no shadow.
        card: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            gap: 14,
            marginBottom: 12,
            padding: 16,
        },
        eyebrow: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.8,
        },
        row: {
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: 12,
        },
        iconWrap: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 12,
            height: 44,
            justifyContent: 'center',
            width: 44,
        },
        copy: {
            flex: 1,
            gap: 4,
        },
        title: {
            color: theme.textPrimary,
            fontSize: 18,
            fontWeight: '700',
        },
        body: {
            color: theme.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
    });
