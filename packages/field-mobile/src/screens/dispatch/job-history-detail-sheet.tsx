import React from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JobHistoryCard } from '../../components/cards/job-card/job-history-card';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import {
    HistoryDelays,
    HistoryReport,
    HistoryTimeline,
} from './job-history-detail-sections';
import type { JobHistoryDetailState } from './use-job-history-detail';

/** A finished job's record: read-only, with no job actions. */
export const JobHistoryDetailSheet: React.FC<{
    state: JobHistoryDetailState;
}> = ({ state }) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const { job, detail, status } = state;

    if (!job) {
        return null;
    }

    return (
        <Modal
            animationType="slide"
            onRequestClose={state.close}
            presentationStyle="fullScreen"
            visible
        >
            <SafeAreaView
                edges={['top', 'bottom']}
                style={styles.root}
                testID="job-history-detail"
            >
                <View style={styles.header}>
                    <Pressable
                        accessibilityLabel="Close job record"
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={state.close}
                        style={({ pressed }) => [
                            styles.close,
                            pressed && styles.pressed,
                        ]}
                        testID="job-history-detail-close"
                    >
                        <Icon
                            color={theme.textPrimary}
                            name="close"
                            size={20}
                        />
                    </Pressable>
                    <Text accessibilityRole="header" style={styles.title}>
                        Job record
                    </Text>
                </View>
                <ScrollView contentContainerStyle={styles.content}>
                    <JobHistoryCard job={detail?.job ?? job} />
                    {status === 'loading' ? (
                        <View
                            accessibilityLiveRegion="polite"
                            style={styles.state}
                        >
                            <ActivityIndicator color={theme.textSecondary} />
                            <Text style={styles.muted}>
                                Loading job record…
                            </Text>
                        </View>
                    ) : null}
                    {status === 'error' ? (
                        <View accessibilityRole="alert" style={styles.error}>
                            <Text style={styles.errorTitle}>
                                Job details didn't load
                            </Text>
                            <Text style={styles.body}>
                                Check your connection and try again.
                            </Text>
                            <Pressable
                                accessibilityRole="button"
                                onPress={state.retry}
                                style={({ pressed }) => [
                                    styles.retry,
                                    pressed && styles.pressed,
                                ]}
                                testID="job-history-detail-retry"
                            >
                                <Icon
                                    color={theme.textPrimary}
                                    name="sync"
                                    size={16}
                                />
                                <Text style={styles.retryText}>Try again</Text>
                            </Pressable>
                        </View>
                    ) : null}
                    {status === 'loaded' && detail ? (
                        <>
                            <HistoryTimeline steps={detail.timeline} />
                            <HistoryDelays delays={detail.delays} />
                            <HistoryReport report={detail.report} />
                        </>
                    ) : null}
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        root: {
            backgroundColor: theme.canvas,
            flex: 1,
        },
        header: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
            flexDirection: 'row',
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
        },
        close: {
            alignItems: 'center',
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            height: 48,
            justifyContent: 'center',
            width: 48,
        },
        title: {
            color: theme.textPrimary,
            fontSize: 18,
            fontWeight: '700',
        },
        content: {
            gap: 16,
            padding: 16,
            paddingBottom: 32,
        },
        state: {
            alignItems: 'center',
            gap: 8,
            paddingVertical: 24,
        },
        error: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
            borderRadius: 14,
            borderWidth: 1,
            gap: 8,
            padding: 14,
        },
        errorTitle: {
            color: theme.warningOrangeText,
            fontSize: 15,
            fontWeight: '700',
        },
        body: {
            color: theme.textPrimary,
            fontSize: 14,
            lineHeight: 20,
        },
        muted: {
            color: theme.textSecondary,
            fontSize: 14,
        },
        retry: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 48,
        },
        retryText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        pressed: {
            transform: [{ scale: 0.985 }],
        },
    });
