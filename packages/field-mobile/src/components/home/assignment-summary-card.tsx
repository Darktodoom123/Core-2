import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { splitIntakeJobs } from '../../screens/dispatch/intake-tabs';
import type { IntakeJobs } from '../../screens/dispatch/intake-tabs';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { DispatchJob } from '../../types/index';
import { Icon } from '../common/Icon';

export interface AssignmentSummaryCardProps {
    jobs: DispatchJob[];
    isLoading: boolean;
    onViewOrders: () => void;
    onOpenJob: (job: DispatchJob) => void;
}

/** Counts the same way as the Dispatch tabs, so the two always agree. */
export function summaryLine({
    pending,
    scheduled,
    active,
}: IntakeJobs): string {
    const parts = [`${active.length} active`];

    if (scheduled.length > 0) {
        parts.push(`${scheduled.length} scheduled`);
    }

    if (pending.length > 0) {
        parts.push(
            `${pending.length} response${pending.length === 1 ? '' : 's'} needed`,
        );
    }

    return parts.join(' · ');
}

/**
 * Home's glanceable view of current work: the active job and any responses
 * needed. The full list and its empty state live in Dispatch.
 */
export const AssignmentSummaryCard: React.FC<AssignmentSummaryCardProps> = ({
    jobs,
    isLoading,
    onViewOrders,
    onOpenJob,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const intake = splitIntakeJobs(jobs);
    // Work under way first, then the next scheduled job, then a reply.
    const firstJob =
        intake.active[0] ?? intake.scheduled[0] ?? intake.pending[0];
    const liveCount =
        intake.active.length + intake.scheduled.length + intake.pending.length;

    // With no work there is nothing to summarise: the home NoUnitCard says so,
    // and Dispatch owns the full empty state. Only loading and real work show.
    if (!isLoading && liveCount === 0) {
        return null;
    }

    const renderBody = () => {
        if (isLoading && liveCount === 0) {
            return (
                <View accessibilityLiveRegion="polite" style={styles.inlineRow}>
                    <ActivityIndicator
                        color={theme.textSecondary}
                        size="small"
                    />
                    <Text style={styles.body}>Loading assignments…</Text>
                </View>
            );
        }

        return (
            <>
                <Text style={styles.body}>{summaryLine(intake)}</Text>
                {firstJob ? (
                    <Pressable
                        accessibilityLabel={`Open dispatch assignment ${firstJob.reference || firstJob.id}`}
                        accessibilityRole="button"
                        onPress={() => onOpenJob(firstJob)}
                        style={({ pressed }) => [
                            styles.jobRow,
                            pressed && styles.pressed,
                        ]}
                        testID="home-active-job-pill"
                    >
                        <View style={styles.jobText}>
                            <Text style={styles.jobRef}>
                                {firstJob.reference || `Job #${firstJob.id}`}
                            </Text>
                            <Text numberOfLines={1} style={styles.jobTitle}>
                                {firstJob.title || 'Dispatch Assignment'}
                            </Text>
                        </View>
                        <Icon
                            color={theme.textSecondary}
                            name="chevron-right"
                            size={18}
                        />
                    </Pressable>
                ) : null}
            </>
        );
    };

    return (
        <View style={styles.card} testID="home-assignment-summary-card">
            <View style={styles.header}>
                <View style={styles.inlineRow}>
                    <Icon
                        color={theme.textSecondary}
                        name="clipboard"
                        size={18}
                    />
                    <Text style={styles.title}>Your assignments</Text>
                </View>
                {liveCount > 0 ? (
                    <Pressable
                        accessibilityLabel="View dispatch orders"
                        accessibilityRole="button"
                        onPress={onViewOrders}
                        style={({ pressed }) => [
                            styles.viewOrdersBtn,
                            pressed && styles.pressed,
                        ]}
                        testID="home-view-orders-btn"
                    >
                        <Text style={styles.viewOrdersText}>
                            View Orders ({liveCount})
                        </Text>
                    </Pressable>
                ) : null}
            </View>
            {renderBody()}
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
            gap: 6,
            marginBottom: 8,
            marginHorizontal: 16,
            marginTop: 12,
            padding: 16,
        },
        header: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'space-between',
            marginBottom: 2,
        },
        inlineRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        title: {
            color: theme.textPrimary,
            fontSize: 16,
            fontWeight: '700',
        },
        viewOrdersBtn: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 10,
            borderWidth: 1,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 12,
        },
        viewOrdersText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        body: {
            color: theme.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
        jobRow: {
            alignItems: 'center',
            borderTopColor: theme.border,
            borderTopWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 6,
            minHeight: 48,
            paddingTop: 10,
        },
        jobText: {
            flex: 1,
            marginRight: 8,
        },
        jobRef: {
            color: theme.textPrimary,
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: '700',
        },
        jobTitle: {
            color: theme.textSecondary,
            fontSize: 14,
            marginTop: 2,
        },
        pressed: {
            opacity: 0.8,
        },
    });
