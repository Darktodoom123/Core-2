import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { colors } from '../../components/nativeStyles';
import { useTheme } from '../../theme';

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
    const { isDarkHud } = useTheme();

    return (
        <Pressable
            accessibilityLabel="Toggle history"
            accessibilityRole="button"
            onPress={onToggle}
            style={({ pressed }) => [
                styles.historyToggleBadge,
                isDarkHud && styles.darkHistoryToggleBadge,
                isHistoryMode && styles.historyToggleBadgeActive,
                isDarkHud &&
                    isHistoryMode &&
                    styles.darkHistoryToggleBadgeActive,
                pressed && styles.historyToggleBadgePressed,
            ]}
            testID="tab-history"
        >
            <Icon
                color={
                    isHistoryMode
                        ? '#FFFFFF'
                        : isDarkHud
                          ? '#FFBF00'
                          : colors.amber
                }
                name="file-text"
                size={14}
            />
            <Text
                style={[
                    styles.historyToggleText,
                    isDarkHud && styles.darkHistoryToggleText,
                    isHistoryMode && styles.historyToggleTextActive,
                ]}
            >
                {isHistoryMode ? 'Form' : `History (${historyCount})`}
            </Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    darkHistoryToggleBadge: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    darkHistoryToggleBadgeActive: {
        backgroundColor: '#332800',
        borderColor: '#FFBF00',
    },
    darkHistoryToggleText: {
        color: '#FFBF00',
    },
    historyToggleBadge: {
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    historyToggleBadgeActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primaryBorder,
    },
    historyToggleBadgePressed: {
        opacity: 0.8,
        transform: [{ scale: 0.94 }],
    },
    historyToggleText: {
        color: colors.amberDark,
        fontSize: 12,
        fontWeight: '700',
    },
    historyToggleTextActive: {
        color: '#FFFFFF',
    },
});
