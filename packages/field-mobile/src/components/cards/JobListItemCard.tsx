import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type {
    DispatchJob,
    DispatchStatus,
    OutboxCommand,
} from '../../types/index';
import { formatPHT } from '../../utils/formatters';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';
import { CommandConflictBanner } from '../panels/CommandConflictBanner';

export interface JobListItemCardProps {
    job: DispatchJob;
    conflictedCommands?: OutboxCommand[];
    onAcceptServerState?: (commandId: string) => void;
    onRetryNewVersion?: (commandId: string, newVersion: number) => void;
    onSelectJob?: (jobId: number) => void;
    onAcceptAssignment?: (
        jobId: number,
        assignmentId: number,
        version: number,
    ) => void;
    onRejectAssignment?: (
        jobId: number,
        assignmentId: number,
        reason: string,
        version: number,
    ) => void;
    onTransitionStatus?: (
        jobId: number,
        nextStatus: DispatchStatus,
        version: number,
    ) => void;
    onOpenDriveRoutes?: () => void;
}

export const JobListItemCard: React.FC<JobListItemCardProps> = ({
    job,
    conflictedCommands,
    onAcceptServerState,
    onRetryNewVersion,
    onSelectJob,
    onAcceptAssignment,
    onRejectAssignment,
}) => {
    const { isDarkHud } = useTheme();

    const isPendingAssignment =
        job.my_assignment?.response_status === 'pending';
    const primaryAsset = job.asset_assignments?.[0] || null;
    const currentStatus = job.status?.value || 'scheduled';
    const statusLabel = job.status?.label || currentStatus.toUpperCase();
    const priorityLabel = job.priority?.label || 'ROUTINE';
    const priorityValue = job.priority?.value || 'routine';

    const getStatusTheme = (
        status: DispatchStatus,
        isPending: boolean,
    ): { bg: string; text: string; dot: string } => {
        if (isPending) {
            return {
                bg: isDarkHud ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7',
                text: isDarkHud ? '#FCD34D' : '#B45309',
                dot: '#F59E0B',
            };
        }

        switch (status) {
            case 'dispatched':
            case 'scheduled':
                return {
                    bg: isDarkHud ? 'rgba(59, 130, 246, 0.18)' : '#DBEAFE',
                    text: isDarkHud ? '#93C5FD' : '#1D4ED8',
                    dot: '#3B82F6',
                };
            case 'accepted':
                return {
                    bg: isDarkHud ? 'rgba(124, 58, 237, 0.18)' : '#EDE9FE',
                    text: isDarkHud ? '#C4B5FD' : '#6D28D9',
                    dot: '#8B5CF6',
                };
            case 'en_route':
                return {
                    bg: isDarkHud ? 'rgba(2, 132, 199, 0.18)' : '#E0F2FE',
                    text: isDarkHud ? '#7DD3FC' : '#0369A1',
                    dot: '#0284C7',
                };
            case 'arrived':
                return {
                    bg: isDarkHud ? 'rgba(13, 148, 136, 0.18)' : '#CCFBF1',
                    text: isDarkHud ? '#5EEAD4' : '#0F766E',
                    dot: '#0D9488',
                };
            case 'working':
                return {
                    bg: isDarkHud ? 'rgba(217, 119, 6, 0.18)' : '#FFEDD5',
                    text: isDarkHud ? '#FDBA74' : '#C2410C',
                    dot: '#EA580C',
                };
            case 'completed':
                return {
                    bg: isDarkHud ? 'rgba(16, 185, 129, 0.18)' : '#D1FAE5',
                    text: isDarkHud ? '#6EE7B7' : '#047857',
                    dot: '#10B981',
                };
            default:
                return {
                    bg: isDarkHud ? 'rgba(100, 116, 139, 0.18)' : '#F1F5F9',
                    text: isDarkHud ? '#CBD5E1' : '#475569',
                    dot: '#64748B',
                };
        }
    };

    const statusTheme = getStatusTheme(currentStatus, isPendingAssignment);

    // Format scope requirements
    const formatRequirements = (): string | null => {
        if (!job.requirements) {
            return null;
        }

        if (Array.isArray(job.requirements)) {
            return job.requirements.join(' · ');
        }

        if (typeof job.requirements === 'object') {
            return Object.values(job.requirements).filter(Boolean).join(' · ');
        }

        return String(job.requirements);
    };

    const requirementsText = formatRequirements();

    return (
        <Pressable
            accessibilityLabel={`Dispatch assignment ${job.reference}, ${job.title}`}
            onPress={() => onSelectJob?.(job.id)}
            style={[styles.cardRoot, isDarkHud && styles.darkCardRoot]}
            testID={`job-card-${job.id}`}
        >
            {/* Conflict Resolution Banner (when outbox commands have version conflicts) */}
            {conflictedCommands &&
            conflictedCommands.length > 0 &&
            onAcceptServerState &&
            onRetryNewVersion ? (
                <CommandConflictBanner
                    conflictedCommands={conflictedCommands}
                    onAcceptServerState={onAcceptServerState}
                    onRetryNewVersion={onRetryNewVersion}
                />
            ) : null}

            {/* 1. Header Bar: Ref, Priority, Status */}
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
                        <View
                            style={[
                                styles.refPill,
                                isDarkHud && styles.darkRefPill,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.refText,
                                    isDarkHud && styles.darkRefText,
                                ]}
                            >
                                {job.reference}
                            </Text>
                        </View>
                        {priorityValue !== 'routine' && (
                            <View
                                style={[
                                    styles.priorityPill,
                                    priorityValue === 'emergency'
                                        ? styles.priorityEmergency
                                        : styles.priorityHigh,
                                ]}
                            >
                                <Text style={styles.priorityText}>
                                    {priorityLabel}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View
                        style={[
                            styles.statusBadge,
                            { backgroundColor: statusTheme.bg },
                        ]}
                    >
                        <View
                            style={[
                                styles.statusDot,
                                { backgroundColor: statusTheme.dot },
                            ]}
                        />
                        <Text
                            style={[
                                styles.statusText,
                                { color: statusTheme.text },
                            ]}
                        >
                            {isPendingAssignment ? 'ACTION REQ' : statusLabel}
                        </Text>
                    </View>
                </View>

                {/* 2. Job Title & Client */}
                <View style={styles.titleSection}>
                    <Text
                        style={[
                            styles.jobTitle,
                            isDarkHud && styles.darkJobTitle,
                        ]}
                    >
                        {job.title}
                    </Text>
                    <Text
                        style={[
                            styles.clientName,
                            isDarkHud && styles.darkClientName,
                        ]}
                    >
                        {job.client}
                    </Text>
                </View>
            </Pressable>

            {/* 3. Operational Metadata Grid */}
            <View
                style={[
                    styles.detailsContainer,
                    isDarkHud && styles.darkDetailsContainer,
                ]}
            >
                {/* Site Location */}
                <View style={styles.detailRow}>
                    <View style={styles.iconCol}>
                        <Icon
                            color={isDarkHud ? '#38BDF8' : '#0284C7'}
                            name="pin"
                            size={16}
                        />
                    </View>
                    <View style={styles.detailTextCol}>
                        <Text
                            style={[
                                styles.detailLabel,
                                isDarkHud && styles.darkDetailLabel,
                            ]}
                        >
                            Jobsite Location
                        </Text>
                        <Text
                            numberOfLines={2}
                            style={[
                                styles.detailValue,
                                isDarkHud && styles.darkDetailValue,
                            ]}
                        >
                            {job.site}
                        </Text>
                        {job.site_notes ? (
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.detailSubNotes,
                                    isDarkHud && styles.darkDetailSubNotes,
                                ]}
                            >
                                {job.site_notes}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {/* Assigned Crane / Machine */}
                <View style={styles.detailRow}>
                    <View style={styles.iconCol}>
                        <Icon
                            color={isDarkHud ? '#F59E0B' : '#D97706'}
                            name="crane"
                            size={16}
                        />
                    </View>
                    <View style={styles.detailTextCol}>
                        <Text
                            style={[
                                styles.detailLabel,
                                isDarkHud && styles.darkDetailLabel,
                            ]}
                        >
                            Assigned Equipment
                        </Text>
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.detailValue,
                                isDarkHud && styles.darkDetailValue,
                            ]}
                        >
                            {primaryAsset
                                ? `${primaryAsset.asset_code} · ${primaryAsset.asset_name}`
                                : 'CRN-101 · Liebherr LTM 1050-3.1'}
                        </Text>
                    </View>
                </View>

                {/* Report Time / Schedule */}
                {job.scheduled_start ? (
                    <View style={styles.detailRow}>
                        <View style={styles.iconCol}>
                            <Icon
                                color={isDarkHud ? '#94A3B8' : '#64748B'}
                                name="clock"
                                size={16}
                            />
                        </View>
                        <View style={styles.detailTextCol}>
                            <Text
                                style={[
                                    styles.detailLabel,
                                    isDarkHud && styles.darkDetailLabel,
                                ]}
                            >
                                Report Time / Schedule
                            </Text>
                            <Text
                                style={[
                                    styles.detailValue,
                                    isDarkHud && styles.darkDetailValue,
                                ]}
                            >
                                {formatPHT(job.scheduled_start, 'datetime')}
                            </Text>
                        </View>
                    </View>
                ) : null}

                {/* Scope & Requirements */}
                {requirementsText ? (
                    <View style={styles.detailRowLast}>
                        <View style={styles.iconCol}>
                            <Icon
                                color={isDarkHud ? '#A78BFA' : '#7C3AED'}
                                name="file-text"
                                size={16}
                            />
                        </View>
                        <View style={styles.detailTextCol}>
                            <Text
                                style={[
                                    styles.detailLabel,
                                    isDarkHud && styles.darkDetailLabel,
                                ]}
                            >
                                Lift Scope & Specifications
                            </Text>
                            {Array.isArray(job.requirements) ? (
                                job.requirements.map((req, idx) => (
                                    <Text
                                        key={idx}
                                        style={[
                                            styles.detailValue,
                                            isDarkHud && styles.darkDetailValue,
                                        ]}
                                    >
                                        {req}
                                    </Text>
                                ))
                            ) : (
                                <Text
                                    numberOfLines={2}
                                    style={[
                                        styles.detailValue,
                                        isDarkHud && styles.darkDetailValue,
                                    ]}
                                >
                                    {requirementsText}
                                </Text>
                            )}
                        </View>
                    </View>
                ) : null}
            </View>

            {/* 4. Initial Assignment Response Actions (Accept / Decline) */}
            {isPendingAssignment ? (
                <View style={styles.actionsContainer}>
                    <View style={styles.pendingActionBlock}>
                        <View
                            style={[
                                styles.pendingBanner,
                                isDarkHud && styles.darkPendingBanner,
                            ]}
                        >
                            <Icon
                                color={isDarkHud ? '#F59E0B' : '#D97706'}
                                name="alert-circle"
                                size={15}
                            />
                            <Text
                                style={[
                                    styles.pendingBannerText,
                                    isDarkHud && styles.darkPendingBannerText,
                                ]}
                            >
                                Operator assignment requires confirmation
                            </Text>
                        </View>
                        <View style={styles.twoButtonRow}>
                            <Pressable
                                accessibilityLabel={`Accept dispatch ${job.reference}`}
                                accessibilityRole="button"
                                onPress={() => {
                                    if (job.my_assignment?.id) {
                                        onAcceptAssignment?.(
                                            job.id,
                                            job.my_assignment.id,
                                            job.version,
                                        );
                                    }
                                }}
                                style={({ pressed }) => [
                                    styles.btnAccept,
                                    pressed && styles.btnPressed,
                                ]}
                                testID={`accept-assignment-btn-${job.id}`}
                            >
                                <Icon color="#FFFFFF" name="check" size={16} />
                                <Text style={styles.btnAcceptText}>
                                    Accept Dispatch
                                </Text>
                            </Pressable>

                            <Pressable
                                accessibilityLabel={`Decline dispatch ${job.reference}`}
                                accessibilityRole="button"
                                onPress={() => {
                                    if (job.my_assignment?.id) {
                                        onRejectAssignment?.(
                                            job.id,
                                            job.my_assignment.id,
                                            'Declined by mobile operator',
                                            job.version,
                                        );
                                    }
                                }}
                                style={({ pressed }) => [
                                    styles.btnDecline,
                                    isDarkHud && styles.darkBtnDecline,
                                    pressed && styles.btnPressed,
                                ]}
                                testID={`decline-assignment-btn-${job.id}`}
                            >
                                <Icon
                                    color={isDarkHud ? '#F87171' : '#DC2626'}
                                    name="close"
                                    size={16}
                                />
                                <Text
                                    style={[
                                        styles.btnDeclineText,
                                        isDarkHud && styles.darkBtnDeclineText,
                                    ]}
                                >
                                    Decline
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            ) : null}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    cardRoot: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 16,
        borderWidth: 1.5,
        marginBottom: 14,
        overflow: 'hidden',
        padding: 16,
        ...shadows.sm,
    },
    darkCardRoot: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    headerPressable: {
        marginBottom: 12,
    },
    headerPressed: {
        opacity: 0.85,
    },
    headerRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    headerLeftGroup: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    refPill: {
        backgroundColor: '#F1F5F9',
        borderColor: '#CBD5E1',
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    darkRefPill: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    refText: {
        color: '#0F172A',
        fontFamily: 'monospace',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    darkRefText: {
        color: '#F8FAFC',
    },
    priorityPill: {
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    priorityHigh: {
        backgroundColor: '#FEF3C7',
    },
    priorityEmergency: {
        backgroundColor: '#FEE2E2',
    },
    priorityText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    statusBadge: {
        alignItems: 'center',
        borderRadius: 20,
        flexDirection: 'row',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    statusDot: {
        borderRadius: 3,
        height: 6,
        width: 6,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    titleSection: {
        marginTop: 2,
    },
    jobTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.3,
        lineHeight: 24,
    },
    darkJobTitle: {
        color: '#F8FAFC',
    },
    clientName: {
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '600',
        marginTop: 2,
    },
    darkClientName: {
        color: '#94A3B8',
    },
    detailsContainer: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 14,
        padding: 12,
    },
    darkDetailsContainer: {
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
    },
    detailRow: {
        alignItems: 'flex-start',
        borderBottomColor: '#E2E8F0',
        borderBottomWidth: 1,
        flexDirection: 'row',
        marginBottom: 8,
        paddingBottom: 8,
    },
    detailRowLast: {
        alignItems: 'flex-start',
        flexDirection: 'row',
    },
    iconCol: {
        alignItems: 'center',
        marginTop: 2,
        width: 24,
    },
    detailTextCol: {
        flex: 1,
    },
    detailLabel: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 1,
        textTransform: 'uppercase',
    },
    darkDetailLabel: {
        color: '#94A3B8',
    },
    detailValue: {
        color: '#1E293B',
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 18,
    },
    darkDetailValue: {
        color: '#F1F5F9',
    },
    detailSubNotes: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    darkDetailSubNotes: {
        color: '#94A3B8',
    },
    actionsContainer: {
        marginTop: 2,
    },
    pendingActionBlock: {
        gap: 8,
    },
    pendingBanner: {
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkPendingBanner: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    pendingBannerText: {
        color: '#92400E',
        fontSize: 11,
        fontWeight: '600',
    },
    darkPendingBannerText: {
        color: '#FCD34D',
    },
    twoButtonRow: {
        flexDirection: 'row',
        gap: 10,
    },
    btnAccept: {
        alignItems: 'center',
        backgroundColor: '#059669',
        borderRadius: 10,
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    btnAcceptText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    btnDecline: {
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderColor: '#FCA5A5',
        borderRadius: 10,
        borderWidth: 1.5,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    darkBtnDecline: {
        borderColor: '#7F1D1D',
    },
    btnDeclineText: {
        color: '#DC2626',
        fontSize: 14,
        fontWeight: '700',
    },
    darkBtnDeclineText: {
        color: '#F87171',
    },
    btnPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.985 }],
    },
});
