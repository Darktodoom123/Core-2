import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import type { DispatchJob } from '../../../types/index';
import { formatPHT } from '../../../utils/formatters';
import { Icon } from '../../common/Icon';
import type { IconName } from '../../common/Icon';

export interface JobCardDetailsProps {
    job: DispatchJob;
}

function assetSummary(job: DispatchJob): string | null {
    if (!job.asset_assignments || job.asset_assignments.length === 0) {
        return null;
    }

    return job.asset_assignments
        .map(
            (assignment) =>
                `${assignment.asset_code} · ${assignment.asset_name}`,
        )
        .join('\n');
}

function requirementLines(job: DispatchJob): string[] {
    if (!job.requirements) {
        return [];
    }

    if (Array.isArray(job.requirements)) {
        return job.requirements;
    }

    if (typeof job.requirements === 'object') {
        const text = Object.values(job.requirements)
            .filter(Boolean)
            .join(' · ');

        return text ? [text] : [];
    }

    return [String(job.requirements)];
}

interface DetailRowProps {
    icon: IconName;
    label: string;
    isLast?: boolean;
    children: React.ReactNode;
}

const DetailRow: React.FC<DetailRowProps> = ({
    icon,
    label,
    isLast = false,
    children,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
            <View style={styles.iconCol}>
                <Icon color={theme.textSecondary} name={icon} size={16} />
            </View>
            <View style={styles.detailTextCol}>
                <Text style={styles.detailLabel}>{label}</Text>
                {children}
            </View>
        </View>
    );
};

/** Operational metadata: site, equipment, schedule, and lift scope. */
export const JobCardDetails: React.FC<JobCardDetailsProps> = ({ job }) => {
    const styles = useThemedStyles(createStyles);
    const equipment = assetSummary(job);
    const requirements = requirementLines(job);
    const hasRequirements = requirements.length > 0;

    return (
        <View style={styles.detailsContainer}>
            <DetailRow icon="pin" label="Jobsite Location">
                <Text numberOfLines={2} style={styles.detailValue}>
                    {job.site}
                </Text>
                {job.site_notes ? (
                    <Text numberOfLines={1} style={styles.detailSubNotes}>
                        {job.site_notes}
                    </Text>
                ) : null}
            </DetailRow>

            <DetailRow
                icon="crane"
                isLast={!job.scheduled_start && !hasRequirements}
                label="Assigned Equipment"
            >
                <Text style={styles.detailValue}>
                    {equipment ?? 'No equipment assigned'}
                </Text>
            </DetailRow>

            {job.scheduled_start ? (
                <DetailRow
                    icon="clock"
                    isLast={!hasRequirements}
                    label="Report Time / Schedule"
                >
                    <Text style={styles.detailValue}>
                        {formatPHT(job.scheduled_start, 'datetime')}
                    </Text>
                </DetailRow>
            ) : null}

            {hasRequirements ? (
                <DetailRow
                    icon="file-text"
                    isLast
                    label="Lift Scope & Specifications"
                >
                    {requirements.map((line, index) => (
                        <Text
                            key={index}
                            numberOfLines={
                                Array.isArray(job.requirements) ? undefined : 2
                            }
                            style={styles.detailValue}
                        >
                            {line}
                        </Text>
                    ))}
                </DetailRow>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        detailsContainer: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            marginBottom: 14,
            padding: 12,
        },
        detailRow: {
            alignItems: 'flex-start',
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
            flexDirection: 'row',
            marginBottom: 8,
            paddingBottom: 8,
        },
        detailRowLast: {
            borderBottomWidth: 0,
            marginBottom: 0,
            paddingBottom: 0,
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
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '500',
            marginBottom: 1,
            textTransform: 'uppercase',
        },
        detailValue: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
            lineHeight: 19,
        },
        detailSubNotes: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '500',
            marginTop: 2,
        },
    });
