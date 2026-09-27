import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { JobHistoryCard } from '../../components/cards/job-card/job-history-card';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { DispatchJob } from '../../types/index';
import type { JobHistoryState } from './use-job-history';

/** Dispatch → History: the operator's finished jobs, read-only. */
export interface JobHistoryListProps {
    history: JobHistoryState;
    onOpenJob: (job: DispatchJob) => void;
}

export const JobHistoryList: React.FC<JobHistoryListProps> = ({
    history,
    onOpenJob,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const { items, status } = history;

    if (status === 'idle' || status === 'loading') {
        return (
            <View
                accessibilityLiveRegion="polite"
                style={styles.stateCard}
                testID="job-history-loading"
            >
                <ActivityIndicator color={theme.textSecondary} />
                <Text style={styles.stateBody}>Loading job history…</Text>
            </View>
        );
    }

    if (status === 'error') {
        return (
            <View
                accessibilityRole="alert"
                style={[styles.stateCard, styles.errorCard]}
                testID="job-history-error"
            >
                <Icon color={theme.warningOrangeText} name="alert" size={22} />
                <Text style={styles.stateTitle}>Job history didn't load</Text>
                <Text style={styles.stateBody}>
                    Finished jobs come from the server. Check your connection
                    and try again.
                </Text>
                <Pressable
                    accessibilityRole="button"
                    onPress={history.retry}
                    style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.pressed,
                    ]}
                    testID="job-history-retry"
                >
                    <Icon color={theme.textPrimary} name="sync" size={16} />
                    <Text style={styles.secondaryText}>Try again</Text>
                </Pressable>
            </View>
        );
    }

    if (items.length === 0) {
        return (
            <View style={styles.stateCard} testID="job-history-empty">
                <Icon color={theme.textSecondary} name="clipboard" size={22} />
                <Text style={styles.stateTitle}>
                    No finished jobs in the last 30 days
                </Text>
                <Text style={styles.stateBody}>
                    Jobs appear here once they're completed or cancelled.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.list} testID="job-history-list">
            <Text style={styles.windowNote}>Last 30 days</Text>
            {items.map((job) => (
                <JobHistoryCard
                    job={job}
                    key={job.id}
                    onPress={() => onOpenJob(job)}
                />
            ))}
            {history.loadMoreFailed ? (
                <Text accessibilityRole="alert" style={styles.inlineError}>
                    Older jobs didn't load. Try again.
                </Text>
            ) : null}
            {history.hasMore ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ busy: history.isLoadingMore }}
                    disabled={history.isLoadingMore}
                    onPress={history.loadMore}
                    style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.pressed,
                    ]}
                    testID="job-history-load-more"
                >
                    {history.isLoadingMore ? (
                        <ActivityIndicator color={theme.textSecondary} />
                    ) : (
                        <Text style={styles.secondaryText}>
                            Load older jobs
                        </Text>
                    )}
                </Pressable>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        list: {
            gap: 10,
        },
        windowNote: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.4,
        },
        stateCard: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            gap: 8,
            paddingHorizontal: 20,
            paddingVertical: 24,
        },
        errorCard: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
        },
        stateTitle: {
            color: theme.textPrimary,
            fontSize: 16,
            fontWeight: '700',
            textAlign: 'center',
        },
        stateBody: {
            color: theme.textSecondary,
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
        },
        inlineError: {
            color: theme.warningOrangeText,
            fontSize: 13,
            textAlign: 'center',
        },
        secondaryButton: {
            alignItems: 'center',
            alignSelf: 'stretch',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 14,
        },
        secondaryText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        pressed: {
            transform: [{ scale: 0.985 }],
        },
    });
