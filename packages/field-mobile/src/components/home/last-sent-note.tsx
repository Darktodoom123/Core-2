import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { Icon } from '../common/Icon';

export interface LastSentNoteProps {
    /** When the shown jobs and shift were saved from the server. */
    savedAt: string;
}

const timeOf = (iso: string): string => {
    const date = new Date(iso);
    const time = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    return date.toDateString() === new Date().toDateString()
        ? time
        : `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
};

/**
 * Says the home screen shows what dispatch last sent, not live data. Shown
 * only after an offline start, until the server answers again.
 */
export const LastSentNote: React.FC<LastSentNoteProps> = ({ savedAt }) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View
            accessibilityLiveRegion="polite"
            style={styles.note}
            testID="last-sent-note"
        >
            <Icon color={theme.textSecondary} name="cloud" size={16} />
            <Text style={styles.text}>
                Showing what dispatch last sent at {timeOf(savedAt)}. It updates
                when you are back online.
            </Text>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        note: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            marginBottom: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
        },
        text: {
            color: theme.textSecondary,
            flex: 1,
            fontSize: 13,
            lineHeight: 18,
        },
    });
