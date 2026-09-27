import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type {
    JobHistoryDelay,
    JobHistoryReport,
    JobHistoryStep,
} from '../../types/index';

export const historyTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
    title,
    children,
}) => {
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
                {title}
            </Text>
            <View style={styles.card}>{children}</View>
        </View>
    );
};

/** Status steps the server recorded, oldest first. */
export const HistoryTimeline: React.FC<{ steps: JobHistoryStep[] }> = ({
    steps,
}) => {
    const styles = useThemedStyles(createStyles);

    return (
        <Section title="WHAT HAPPENED">
            {steps.length === 0 ? (
                <Text style={styles.muted}>No status steps recorded</Text>
            ) : (
                steps.map((step, index) => (
                    <View
                        key={`${step.status}-${step.at}`}
                        style={[
                            styles.row,
                            index === steps.length - 1 && styles.rowLast,
                        ]}
                    >
                        <Text style={styles.rowLabel}>{step.label}</Text>
                        <Text style={styles.rowValue}>
                            {historyTime(step.at)}
                        </Text>
                    </View>
                ))
            )}
        </Section>
    );
};

export const HistoryDelays: React.FC<{ delays: JobHistoryDelay[] }> = ({
    delays,
}) => {
    const styles = useThemedStyles(createStyles);

    return (
        <Section title="DELAYS">
            {delays.length === 0 ? (
                <Text style={styles.muted}>No delays reported</Text>
            ) : (
                delays.map((delay, index) => (
                    <View
                        key={delay.id}
                        style={[
                            styles.stack,
                            index === delays.length - 1 && styles.rowLast,
                        ]}
                    >
                        <Text style={styles.strong}>{delay.reason_label}</Text>
                        <Text style={styles.muted}>
                            {[
                                delay.context_label,
                                delay.estimated_minutes !== null
                                    ? `About ${delay.estimated_minutes} min`
                                    : null,
                                historyTime(delay.reported_at),
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </Text>
                        {delay.notes ? (
                            <Text style={styles.body}>{delay.notes}</Text>
                        ) : null}
                    </View>
                ))
            )}
        </Section>
    );
};

export const HistoryReport: React.FC<{ report: JobHistoryReport | null }> = ({
    report,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    if (!report) {
        return (
            <Section title="YOUR JOB REPORT">
                <Text style={styles.muted}>
                    You did not submit a job report for this job
                </Text>
            </Section>
        );
    }

    const isRejected = report.status === 'rejected';

    return (
        <Section title="YOUR JOB REPORT">
            <View style={styles.reportHeader}>
                <Icon
                    color={
                        isRejected
                            ? theme.warningOrangeText
                            : theme.textSecondary
                    }
                    name={isRejected ? 'alert' : 'file-text'}
                    size={16}
                />
                <Text
                    style={[
                        styles.strong,
                        isRejected && { color: theme.warningOrangeText },
                    ]}
                >
                    {report.status_label}
                    {report.submitted_at
                        ? ` · ${historyTime(report.submitted_at)}`
                        : ''}
                </Text>
            </View>
            <Text selectable style={styles.body}>
                {report.work_summary}
            </Text>
            {report.remarks ? (
                <Text selectable style={styles.muted}>
                    {report.remarks}
                </Text>
            ) : null}
            {isRejected && report.rejection_reason ? (
                <Text style={[styles.body, { color: theme.warningOrangeText }]}>
                    Returned: {report.rejection_reason}
                </Text>
            ) : null}
        </Section>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        section: {
            gap: 8,
        },
        sectionTitle: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.6,
        },
        card: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 14,
            borderWidth: 1,
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 12,
        },
        row: {
            alignItems: 'center',
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            minHeight: 40,
        },
        rowLast: {
            borderBottomWidth: 0,
        },
        stack: {
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
            gap: 2,
            paddingVertical: 6,
        },
        rowLabel: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '500',
        },
        rowValue: {
            color: theme.textSecondary,
            fontSize: 14,
        },
        reportHeader: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 6,
        },
        strong: {
            color: theme.textPrimary,
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
            lineHeight: 20,
        },
    });
