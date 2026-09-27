import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';

export interface FuelEmptyStateProps {
    icon: IconName;
    title: string;
    body: string;
}

/** A calm, bordered empty state so an empty list never reads as a blank page. */
export const FuelEmptyState: React.FC<FuelEmptyStateProps> = ({
    icon,
    title,
    body,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.card} testID="fuel-empty-state">
            <View style={styles.iconWrap}>
                <Icon color={theme.textSecondary} name={icon} size={26} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        card: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            gap: 8,
            paddingHorizontal: 20,
            paddingVertical: 28,
        },
        iconWrap: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 28,
            height: 56,
            justifyContent: 'center',
            marginBottom: 4,
            width: 56,
        },
        title: {
            color: theme.textPrimary,
            fontSize: 17,
            fontWeight: '700',
            textAlign: 'center',
        },
        body: {
            color: theme.textSecondary,
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
        },
    });
