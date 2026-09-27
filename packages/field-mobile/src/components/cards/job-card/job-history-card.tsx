import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import type { DispatchJob } from '../../../types/index';
import { Icon } from '../../common/Icon';

const dateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

const dateOnly = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });

/**
 * When the job finished, as the server recorded it. Without a recorded finish
 * time the card says when it was scheduled, labelled as such.
 */
export function jobHistoryTimeLabel(job: DispatchJob): string | null {
    if (job.status?.value === 'completed' && job.completed_at) {
        return `Completed ${dateTime(job.completed_at)}`;
    }

    if (job.status?.value === 'cancelled' && job.cancelled_at) {
        return `Cancelled ${dateTime(job.cancelled_at)}`;
    }

    return job.scheduled_start
        ? `Scheduled ${dateOnly(job.scheduled_start)}`
        : null;
}

export interface JobHistoryCardProps {
    job: DispatchJob;
    /** Opens the job's record; the card itself never changes the job. */
    onPress?: () => void;
}

/** A finished job: read-only, with no job actions. */
export const JobHistoryCard: React.FC<JobHistoryCardProps> = ({
    job,
    onPress,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const isCompleted = job.status?.value === 'completed';
    const timeLabel = jobHistoryTimeLabel(job);
    const place = [job.client, job.site].filter(Boolean).join(' · ');

    const content = (
        <>
            <View style={styles.topRow}>
                <Text selectable style={styles.reference}>
                    {job.reference || `Job #${job.id}`}
                </Text>
                <View
                    style={[
                        styles.pill,
                        isCompleted ? styles.pillDone : styles.pillNeutral,
                    ]}
                    testID={`job-history-status-${job.id}`}
                >
                    <Icon
                        color={
                            isCompleted
                                ? theme.successEmeraldText
                                : theme.textSecondary
                        }
                        name={isCompleted ? 'check-circle' : 'close'}
                        size={13}
                    />
                    <Text
                        style={[
                            styles.pillText,
                            isCompleted
                                ? styles.pillTextDone
                                : styles.pillTextNeutral,
                        ]}
                    >
                        {isCompleted ? 'Completed' : 'Cancelled'}
                    </Text>
                </View>
            </View>
            {job.title ? (
                <Text numberOfLines={2} style={styles.title}>
                    {job.title}
                </Text>
            ) : null}
            {place ? (
                <Text numberOfLines={2} style={styles.meta}>
                    {place}
                </Text>
            ) : null}
            {timeLabel ? (
                <View style={styles.timeRow}>
                    <Icon color={theme.textSecondary} name="clock" size={13} />
                    <Text style={styles.meta}>{timeLabel}</Text>
                </View>
            ) : null}
        </>
    );

    if (!onPress) {
        return (
            <View style={styles.card} testID={`job-history-card-${job.id}`}>
                {content}
            </View>
        );
    }

    return (
        <Pressable
            accessibilityHint="Opens what happened on this job"
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            testID={`job-history-card-${job.id}`}
        >
            {content}
        </Pressable>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        card: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 14,
            borderWidth: 1,
            gap: 4,
            padding: 14,
        },
        topRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'space-between',
        },
        reference: {
            color: theme.textPrimary,
            flexShrink: 1,
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: '700',
        },
        pill: {
            alignItems: 'center',
            borderRadius: 999,
            flexDirection: 'row',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
        },
        pillDone: {
            backgroundColor: theme.successEmeraldLight,
        },
        pillNeutral: {
            backgroundColor: theme.surfaceHighlight,
        },
        pillText: {
            fontSize: 12,
            fontWeight: '700',
        },
        pillTextDone: {
            color: theme.successEmeraldText,
        },
        pillTextNeutral: {
            color: theme.textSecondary,
        },
        title: {
            color: theme.textPrimary,
            fontSize: 16,
            fontWeight: '700',
        },
        meta: {
            color: theme.textSecondary,
            fontSize: 13,
            lineHeight: 18,
        },
        pressed: {
            transform: [{ scale: 0.985 }],
        },
        timeRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 6,
            marginTop: 2,
        },
    });
