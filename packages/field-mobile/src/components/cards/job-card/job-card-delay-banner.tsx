import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import type { DispatchJob, OutboxCommand } from '../../../types/index';
import { formatPHT } from '../../../utils/formatters';
import { Icon } from '../../common/Icon';

export interface JobCardDelayBannerProps {
    job: DispatchJob;
    queuedDelayCommand?: OutboxCommand;
}

interface DelaySummary {
    reason: string;
    minutes: number | null;
    notes: string | null;
}

const asText = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value : null;

const asMinutes = (value: unknown): number | null =>
    typeof value === 'number' && value > 0 ? value : null;

function summarize(source: Record<string, unknown>): DelaySummary {
    return {
        reason: asText(source.reason_label) ?? asText(source.reason) ?? 'Delay',
        minutes: asMinutes(source.estimated_minutes),
        notes: asText(source.notes),
    };
}

const minutesSuffix = (minutes: number | null) =>
    minutes ? ` (+${minutes}m)` : '';

/**
 * A delay still in the outbox is shown as waiting to send (cobalt, info) and
 * never as reported: only the server's `latest_delay` is a reported delay
 * (orange, warning).
 */
export const JobCardDelayBanner: React.FC<JobCardDelayBannerProps> = ({
    job,
    queuedDelayCommand,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    if (queuedDelayCommand) {
        const delay = summarize(queuedDelayCommand.payload);

        return (
            <View
                style={[styles.banner, styles.queuedBanner]}
                testID={`queued-delay-banner-${job.id}`}
            >
                <View style={styles.header}>
                    <Icon color={theme.actionCobalt} name="sync" size={14} />
                    <Text style={[styles.title, styles.queuedTitle]}>
                        Delay waiting to send: {delay.reason}
                        {minutesSuffix(delay.minutes)}
                    </Text>
                </View>
                {delay.notes ? (
                    <Text
                        numberOfLines={2}
                        style={[styles.notes, styles.queuedNotes]}
                    >
                        {delay.notes}
                    </Text>
                ) : null}
            </View>
        );
    }

    if (!job.latest_delay) {
        return null;
    }

    const delay = summarize(
        job.latest_delay as unknown as Record<string, unknown>,
    );
    const reportedAt = job.latest_delay.reported_at
        ? ` · ${formatPHT(job.latest_delay.reported_at, 'time')}`
        : '';

    return (
        <View
            style={[styles.banner, styles.reportedBanner]}
            testID={`delay-status-banner-${job.id}`}
        >
            <View style={styles.header}>
                <Icon color={theme.warningOrangeText} name="alert" size={14} />
                <Text style={[styles.title, styles.reportedTitle]}>
                    Delay Reported: {delay.reason}
                    {minutesSuffix(delay.minutes)}
                    {reportedAt}
                </Text>
            </View>
            {delay.notes ? (
                <Text
                    numberOfLines={2}
                    style={[styles.notes, styles.reportedNotes]}
                >
                    {delay.notes}
                </Text>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        banner: {
            borderRadius: 10,
            borderWidth: 1,
            padding: 10,
        },
        queuedBanner: {
            backgroundColor: theme.actionCobaltLight,
            borderColor: theme.actionCobalt,
        },
        reportedBanner: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
        },
        header: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 6,
        },
        title: {
            flexShrink: 1,
            flexWrap: 'wrap',
            fontSize: 13,
            fontWeight: '700',
        },
        queuedTitle: {
            color: theme.textPrimary,
        },
        reportedTitle: {
            color: theme.warningOrangeText,
        },
        notes: {
            fontSize: 13,
            marginTop: 4,
        },
        queuedNotes: {
            color: theme.textSecondary,
        },
        reportedNotes: {
            color: theme.textPrimary,
        },
    });
