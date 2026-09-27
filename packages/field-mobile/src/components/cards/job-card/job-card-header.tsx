import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import type { DispatchJob } from '../../../types/index';
import { Icon } from '../../common/Icon';
import { jobStatusTone } from './job-status-tone';

export interface JobCardHeaderProps {
    job: DispatchJob;
    isPendingResponse: boolean;
    onSelectJob?: (jobId: number) => void;
}

export const JobCardHeader: React.FC<JobCardHeaderProps> = ({
    job,
    isPendingResponse,
    onSelectJob,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const currentStatus = job.status?.value || 'scheduled';
    const statusLabel = job.status?.label || currentStatus.toUpperCase();
    const priorityValue = job.priority?.value || 'routine';
    const priorityLabel = job.priority?.label || 'ROUTINE';
    const isEmergency = priorityValue === 'emergency';
    const tone = jobStatusTone(theme, currentStatus, isPendingResponse);

    return (
        <Pressable
            accessibilityHint="Toggles or selects job"
            accessibilityLabel={`View details for ${job.reference}`}
            accessibilityRole="button"
            onPress={() => onSelectJob?.(job.id)}
            style={({ pressed }) => [
                styles.headerPressable,
                pressed && styles.headerPressed,
            ]}
        >
            <View style={styles.headerRow}>
                <View style={styles.headerLeftGroup}>
                    <View style={styles.refPill}>
                        <Text style={styles.refText}>{job.reference}</Text>
                    </View>
                    {priorityValue !== 'routine' ? (
                        <View
                            style={[
                                styles.priorityPill,
                                isEmergency
                                    ? styles.priorityEmergency
                                    : styles.priorityHigh,
                            ]}
                            testID={`job-priority-${job.id}`}
                        >
                            <Text
                                style={[
                                    styles.priorityText,
                                    isEmergency
                                        ? styles.priorityEmergencyText
                                        : styles.priorityHighText,
                                ]}
                            >
                                {priorityLabel}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <View
                    style={[
                        styles.statusBadge,
                        {
                            backgroundColor: tone.background,
                            borderColor: tone.border,
                        },
                    ]}
                    testID={`job-status-badge-${job.id}`}
                >
                    <Icon color={tone.text} name={tone.icon} size={12} />
                    <Text style={[styles.statusText, { color: tone.text }]}>
                        {isPendingResponse ? 'ACTION REQ' : statusLabel}
                    </Text>
                </View>
            </View>

            <View style={styles.titleSection}>
                <Text style={styles.jobTitle}>{job.title}</Text>
                <Text style={styles.clientName}>{job.client}</Text>
            </View>
        </Pressable>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        headerPressable: {
            marginBottom: 12,
        },
        headerPressed: {
            opacity: 0.85,
        },
        headerRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        headerLeftGroup: {
            alignItems: 'center',
            flexDirection: 'row',
            flexShrink: 1,
            gap: 8,
        },
        refPill: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 6,
            borderWidth: 1,
            paddingHorizontal: 8,
            paddingVertical: 3,
        },
        refText: {
            color: theme.textPrimary,
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 0.2,
        },
        priorityPill: {
            borderRadius: 6,
            borderWidth: 1,
            paddingHorizontal: 7,
            paddingVertical: 3,
        },
        priorityHigh: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
        },
        priorityEmergency: {
            backgroundColor: theme.hazardRedLight,
            borderColor: theme.hazardRed,
        },
        priorityText: {
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
        },
        priorityHighText: {
            color: theme.warningOrangeText,
        },
        priorityEmergencyText: {
            color: theme.hazardRedText,
        },
        statusBadge: {
            alignItems: 'center',
            borderRadius: 20,
            borderWidth: 1,
            flexDirection: 'row',
            flexShrink: 0,
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 4,
        },
        statusText: {
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.3,
        },
        titleSection: {
            marginTop: 2,
        },
        jobTitle: {
            color: theme.textPrimary,
            fontSize: 18,
            fontWeight: '700',
            letterSpacing: -0.3,
            lineHeight: 24,
        },
        clientName: {
            color: theme.textSecondary,
            fontSize: 14,
            fontWeight: '500',
            marginTop: 2,
        },
    });
