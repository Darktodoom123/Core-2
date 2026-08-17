import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DispatchJob } from '../../types/index';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

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
    const isEmergency = job.priority.value === 'emergency';
    const isPriority = job.priority.value === 'priority';

    const priorityBadgeStyle = isEmergency
        ? styles.emergencyBadge
        : isPriority
          ? styles.priorityBadge
          : styles.routineBadge;

    const priorityTextStyle = isEmergency
        ? styles.emergencyBadgeText
        : isPriority
          ? styles.priorityBadgeText
          : styles.routineBadgeText;

    const isCrane =
        assignedAsset?.asset_kind === 'crane' ||
        assignedAsset?.asset_kind === 'mobile_crane';

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
            {/* Top Row: Reference + Badges */}
            <View style={styles.cardTopRow}>
                <View style={styles.refContainer}>
                    <Text style={styles.reference}>{job.reference}</Text>
                </View>
                <View style={styles.badgeRow}>
                    <View style={[styles.badge, priorityBadgeStyle]}>
                        <Text style={[styles.badgeText, priorityTextStyle]}>
                            {job.priority.label}
                        </Text>
                    </View>
                    <View style={[styles.badge, styles.statusBadge]}>
                        <Text
                            style={[styles.badgeText, styles.statusBadgeText]}
                        >
                            {job.status.label}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Title & Client */}
            <Text style={styles.jobTitle} numberOfLines={2}>
                {job.title}
            </Text>
            <Text style={styles.clientSubtitle}>Client: {job.client}</Text>

            {/* Metadata Rows */}
            <View style={styles.metaContainer}>
                <View style={styles.metaRow}>
                    <Icon name="location" size={15} color={colors.muted} />
                    <Text selectable style={styles.metaValue} numberOfLines={1}>
                        {job.site}
                    </Text>
                </View>

                {job.scheduled_start ? (
                    <View style={styles.metaRow}>
                        <Icon name="clock" size={15} color={colors.muted} />
                        <Text selectable style={styles.metaValue}>
                            {new Date(job.scheduled_start).toLocaleString(
                                undefined,
                                {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                },
                            )}
                        </Text>
                    </View>
                ) : null}
            </View>

            {/* Assigned Asset Box */}
            {assignedAsset ? (
                <View style={styles.assetSummary}>
                    <View style={styles.assetIconBox}>
                        <Icon
                            name={isCrane ? 'crane' : 'truck'}
                            size={20}
                            color={colors.primaryDark}
                        />
                    </View>
                    <View style={styles.assetCopy}>
                        <Text style={styles.assetLabel}>
                            {isCrane ? 'Assigned Crane' : 'Assigned Asset'}
                        </Text>
                        <Text selectable style={styles.assetValue}>
                            {assignedAsset.asset_code} ·{' '}
                            {assignedAsset.asset_name}
                        </Text>
                    </View>
                </View>
            ) : null}

            {/* Response Pending Banner */}
            {isPending ? (
                <View
                    style={styles.pendingBadge}
                    testID={`pending-badge-${job.id}`}
                >
                    <Icon
                        name="alert-circle"
                        size={16}
                        color={colors.amberDark}
                    />
                    <Text style={styles.pendingText}>Response Required</Text>
                </View>
            ) : null}

            {/* Bottom Action Row */}
            <View style={styles.cardActionRow}>
                <Text style={styles.actionMeta}>
                    Tap for details & progression
                </Text>
                <View style={styles.actionButtonWrap}>
                    <Text style={styles.actionBtnText}>Open assignment</Text>
                    <Icon
                        name="chevron-right"
                        size={16}
                        color={colors.primaryDark}
                    />
                </View>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    jobCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 18,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
        ...shadows.md,
    },
    cardPressed: {
        backgroundColor: colors.surfaceMuted,
        transform: [{ scale: 0.985 }],
    },
    cardTopRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'space-between',
    },
    refContainer: {
        backgroundColor: colors.primarySoft,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    reference: {
        color: colors.primaryDark,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    badgeRow: {
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'flex-end',
    },
    badge: {
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: -0.1,
        textTransform: 'uppercase',
    },
    statusBadge: {
        backgroundColor: colors.surfaceMuted,
    },
    statusBadgeText: {
        color: colors.secondary,
    },
    emergencyBadge: {
        backgroundColor: colors.redSoft,
    },
    emergencyBadgeText: {
        color: colors.redDark,
    },
    priorityBadge: {
        backgroundColor: colors.warningSoft,
    },
    priorityBadgeText: {
        color: colors.warningDark,
    },
    routineBadge: {
        backgroundColor: colors.surfaceMuted,
    },
    routineBadgeText: {
        color: colors.muted,
    },
    jobTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.3,
        lineHeight: 22,
        marginTop: 10,
    },
    clientSubtitle: {
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    metaContainer: {
        gap: 6,
        marginTop: 10,
    },
    metaRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    metaValue: {
        color: colors.secondary,
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    assetSummary: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.borderSubtle,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
        padding: 10,
    },
    assetIconBox: {
        alignItems: 'center',
        backgroundColor: colors.primarySoft,
        borderRadius: 10,
        height: 36,
        justifyContent: 'center',
        width: 36,
    },
    assetCopy: {
        flex: 1,
        gap: 1,
    },
    assetLabel: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    assetValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
    pendingBadge: {
        alignItems: 'center',
        backgroundColor: colors.amberSoft,
        borderColor: colors.amberBorder,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        marginTop: 12,
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    pendingText: {
        color: colors.amberDark,
        fontSize: 12,
        fontWeight: '700',
    },
    cardActionRow: {
        alignItems: 'center',
        borderTopColor: colors.borderSubtle,
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingTop: 10,
    },
    actionMeta: {
        color: colors.muted,
        fontSize: 12,
    },
    actionButtonWrap: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 2,
    },
    actionBtnText: {
        color: colors.primaryDark,
        fontSize: 13,
        fontWeight: '700',
    },
});
