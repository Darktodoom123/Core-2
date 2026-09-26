import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';

export interface DvirHistoryToggleProps {
    historyCount: number;
    isHistoryMode: boolean;
    onToggle: () => void;
}

/** Header button that switches between the DVIR form and its history. */
export const DvirHistoryToggle: React.FC<DvirHistoryToggleProps> = ({
    historyCount,
    isHistoryMode,
    onToggle,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <Pressable
            accessibilityLabel="Toggle history"
            accessibilityRole="button"
            onPress={onToggle}
            style={({ pressed }) => [
                styles.historyToggleBadge,
                isHistoryMode && styles.historyToggleBadgeActive,
                pressed && styles.historyToggleBadgePressed,
            ]}
            testID="tab-history"
        >
            <Icon
                color={isHistoryMode ? theme.surfaceDark : theme.brandAmberText}
                name="file-text"
                size={14}
            />
            <Text
                style={[
                    styles.historyToggleText,
                    isHistoryMode && styles.historyToggleTextActive,
                ]}
            >
                {isHistoryMode ? 'Form' : `History (${historyCount})`}
            </Text>
        </Pressable>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        historyToggleBadge: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 6,
            minHeight: 48,
            paddingHorizontal: 12,
        },
        historyToggleBadgeActive: {
            backgroundColor: theme.brandAmber,
            borderColor: theme.brandAmber,
        },
        historyToggleBadgePressed: {
            opacity: 0.8,
            transform: [{ scale: 0.94 }],
        },
        historyToggleText: {
            color: theme.brandAmberText,
            fontSize: 12,
            fontWeight: '700',
        },
        historyToggleTextActive: {
            color: theme.surfaceDark,
        },
    });
