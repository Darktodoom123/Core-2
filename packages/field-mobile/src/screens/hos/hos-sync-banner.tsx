import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { HosSyncSummary } from './hos-sync-summary';

export interface HosSyncBannerProps {
    summary: HosSyncSummary | null;
    onDiscard?: (commandId: string) => void;
    onRetry?: (commandId: string) => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * One place for duty changes the server hasn't accepted: a rejected or
 * stalled change comes first with its reason and the way out, then what is
 * still waiting to send.
 */
export const HosSyncBanner: React.FC<HosSyncBannerProps> = ({
    summary,
    onDiscard,
    onRetry,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    if (!summary) {
        return null;
    }

    const { problem, waiting } = summary;

    if (problem) {
        const isRejected = problem.kind === 'rejected';
        const held = waiting.length;

        return (
            <View
                accessibilityRole="alert"
                style={[
                    styles.banner,
                    isRejected ? styles.rejected : styles.stalled,
                ]}
                testID="hos-sync-problem"
            >
                <View style={styles.row}>
                    <Icon
                        color={
                            isRejected
                                ? theme.hazardRedText
                                : theme.warningOrangeText
                        }
                        name="alert-circle"
                        size={18}
                    />
                    <View style={styles.copy}>
                        <Text
                            style={[
                                styles.title,
                                isRejected
                                    ? styles.rejectedText
                                    : styles.stalledText,
                            ]}
                        >
                            {isRejected
                                ? `Rejected: ${problem.what}`
                                : `Couldn't send: ${problem.what}`}
                        </Text>
                        {problem.reason ? (
                            <Text style={styles.body}>{problem.reason}</Text>
                        ) : null}
                        {held > 0 ? (
                            <Text style={styles.body} testID="hos-sync-held">
                                {`${plural(held, 'later change')} ${held === 1 ? 'is' : 'are'} on hold until this is ${isRejected ? 'discarded' : 'sent'}.`}
                            </Text>
                        ) : null}
                    </View>
                </View>
                <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                        isRejected
                            ? onDiscard?.(problem.id)
                            : onRetry?.(problem.id)
                    }
                    style={styles.action}
                    testID={isRejected ? 'hos-sync-discard' : 'hos-sync-retry'}
                >
                    <Text style={styles.actionText}>
                        {isRejected ? 'Discard this change' : 'Try again'}
                    </Text>
                </Pressable>
            </View>
        );
    }

    const latest = waiting[waiting.length - 1];

    return (
        <View style={[styles.banner, styles.waiting]} testID="hos-sync-waiting">
            <View style={styles.row}>
                <Icon color={theme.textSecondary} name="clock" size={18} />
                <View style={styles.copy}>
                    <Text style={styles.title}>
                        {waiting.length === 1
                            ? `Waiting to send: ${latest.what}`
                            : `${plural(waiting.length, 'duty change')} waiting to send · latest: ${latest.what}`}
                    </Text>
                    <Text style={styles.body}>
                        Totals update once the server accepts them.
                    </Text>
                </View>
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        banner: {
            borderRadius: 12,
            borderWidth: 1,
            gap: 12,
            marginBottom: 16,
            padding: 14,
        },
        rejected: {
            backgroundColor: theme.hazardRedLight,
            borderColor: theme.hazardRed,
        },
        stalled: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
        },
        waiting: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
        },
        row: {
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: 10,
        },
        copy: {
            flex: 1,
            gap: 4,
        },
        title: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
        },
        rejectedText: {
            color: theme.hazardRedText,
        },
        stalledText: {
            color: theme.warningOrangeText,
        },
        body: {
            color: theme.textPrimary,
            fontSize: 14,
            lineHeight: 20,
        },
        action: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 10,
            justifyContent: 'center',
            minHeight: 48,
        },
        actionText: {
            color: theme.surfaceDark,
            fontSize: 15,
            fontWeight: '700',
        },
    });
