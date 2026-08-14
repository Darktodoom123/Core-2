import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DispatchJob } from '../../types/index';
import { colors } from '../nativeStyles';

export interface JobListItemCardProps {
    job: DispatchJob;
    onSelectJob: (jobId: number) => void;
}

export const JobListItemCard: React.FC<JobListItemCardProps> = ({
    job,
    onSelectJob,
}) => {
    const isPending = job.my_assignment?.response_status === 'pending';
    const assignedAsset = job.asset_assignments?.[0] ?? null;
    const priorityStyle =
        job.priority.value === 'emergency'
            ? styles.emergencyBadge
            : job.priority.value === 'priority'
              ? styles.priorityBadge
              : styles.routineBadge;

    return (
        <Pressable
            accessibilityLabel={`Open assignment ${job.reference}`}
            accessibilityHint="Reviews the job, assignment response, progress, and safety context"
            accessibilityRole="button"
            key={job.id}
            onPress={() => onSelectJob(job.id)}
            style={({ pressed }) => [
                styles.jobCard,
                pressed && styles.cardPressed,
            ]}
            testID={`job-card-${job.id}`}
        >
            <View style={styles.cardTopRow}>
                <Text style={styles.reference}>{job.reference}</Text>
                <View style={styles.badgeRow}>
                    <Text style={[styles.badge, priorityStyle]}>
                        {job.priority.label}
                    </Text>
                    <Text style={[styles.badge, styles.statusBadge]}>
                        {job.status.label} (v{job.version})
                    </Text>
                </View>
            </View>

            <Text style={styles.jobTitle}>
                {job.title} — {job.client}
            </Text>
            <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Site</Text>
                <Text selectable style={styles.detailValue}>
                    {job.site}
                </Text>
            </View>
            {job.scheduled_start ? (
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Starts</Text>
                    <Text selectable style={styles.detailValue}>
                        {new Date(job.scheduled_start).toLocaleString()}
                    </Text>
                </View>
            ) : null}

            {assignedAsset ? (
                <View style={styles.assetSummary}>
                    <View style={styles.assetIcon}>
                        <Text style={styles.assetIconText}>CR</Text>
                    </View>
                    <View style={styles.assetCopy}>
                        <Text style={styles.assetLabel}>
                            {assignedAsset.asset_kind === 'crane'
                                ? 'Assigned crane'
                                : 'Assigned asset'}
                        </Text>
                        <Text selectable style={styles.assetValue}>
                            {assignedAsset.asset_code} ·{' '}
                            {assignedAsset.asset_name}
                        </Text>
                    </View>
                </View>
            ) : null}

            {isPending ? (
                <View
                    style={styles.pendingBadge}
                    testID={`pending-badge-${job.id}`}
                >
                    <Text style={styles.pendingText}>Response pending</Text>
                </View>
            ) : null}

            <View style={styles.cardActionRow}>
                <Text style={styles.actionMeta}>Tap to view job details</Text>
                <Text style={styles.actionBtnText}>Open assignment</Text>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    jobCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        padding: 16,
    },
    cardPressed: {
        backgroundColor: colors.surfaceMuted,
    },
    cardTopRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'space-between',
    },
    reference: {
        color: colors.blueDark,
        flexShrink: 1,
        fontSize: 16,
        fontWeight: '800',
    },
    badgeRow: {
        alignItems: 'flex-end',
        flexDirection: 'row',
        flexShrink: 1,
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'flex-end',
    },
    badge: {
        borderRadius: 12,
        fontSize: 11,
        fontWeight: '800',
        overflow: 'hidden',
        paddingHorizontal: 8,
        paddingVertical: 4,
        textTransform: 'uppercase',
    },
    statusBadge: {
        backgroundColor: colors.blueSoft,
        color: colors.blueDark,
    },
    emergencyBadge: {
        backgroundColor: colors.redSoft,
        color: colors.redDark,
    },
    priorityBadge: {
        backgroundColor: colors.warningSoft,
        color: colors.warningDark,
    },
    routineBadge: {
        backgroundColor: colors.surfaceMuted,
        color: colors.secondary,
    },
    jobTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
        lineHeight: 21,
        marginTop: 12,
    },
    assetSummary: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
        padding: 10,
    },
    assetIcon: {
        alignItems: 'center',
        backgroundColor: colors.amberSoft,
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    assetIconText: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '800',
    },
    assetCopy: {
        flex: 1,
        gap: 2,
    },
    assetLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '800',
    },
    assetValue: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 19,
    },
    detailRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    detailLabel: {
        color: colors.muted,
        fontSize: 13,
        fontWeight: '700',
        width: 48,
    },
    detailValue: {
        color: colors.secondary,
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    pendingBadge: {
        alignSelf: 'flex-start',
        backgroundColor: colors.amberSoft,
        borderColor: colors.amberBorder,
        borderRadius: 6,
        borderWidth: 1,
        marginTop: 12,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    pendingText: {
        color: colors.amberDark,
        fontSize: 12,
        fontWeight: '800',
    },
    cardActionRow: {
        alignItems: 'center',
        borderTopColor: colors.border,
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 16,
        minHeight: 48,
        paddingTop: 10,
    },
    actionMeta: {
        color: colors.muted,
        flex: 1,
        fontSize: 12,
    },
    actionBtnText: {
        color: colors.amberDark,
        fontSize: 14,
        fontWeight: '800',
    },
});
