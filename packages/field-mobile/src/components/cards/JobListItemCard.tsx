import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
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
    const { isDarkHud } = useTheme();

    return (
        <Pressable
            accessibilityHint="Reviews the job, assignment response, progress, and safety context"
            accessibilityLabel={`Open assignment ${job.reference}`}
            accessibilityRole="button"
            key={job.id}
            onPress={() => onSelectJob(job.id)}
            style={({ pressed }) => [
                styles.cockpitJobCard,
                isDarkHud && styles.darkCockpitJobCard,
                pressed && styles.cardPressed,
            ]}
            testID={`job-card-${job.id}`}
        >
            <Text
                style={[
                    styles.cockpitHeaderLabel,
                    isDarkHud && styles.darkCockpitHeaderLabel,
                ]}
            >
                Active Dispatch Assignment
            </Text>
            <View style={styles.cockpitMainRow}>
                <Text
                    style={[
                        styles.cockpitCodeText,
                        isDarkHud && styles.darkCockpitCodeText,
                    ]}
                >
                    {job.reference}
                </Text>
                <Icon
                    color={isDarkHud ? '#94A3B8' : '#64748B'}
                    name="chevron-right"
                    size={20}
                />
            </View>
            <Text
                style={[
                    styles.cockpitSubText,
                    isDarkHud && styles.darkCockpitSubText,
                ]}
            >
                {job.title}
            </Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    cardPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.985 }],
    },
    cockpitJobCard: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 14,
        borderWidth: 1.5,
        padding: 14,
        ...shadows.sm,
    },
    cockpitHeaderLabel: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 4,
    },
    cockpitMainRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    cockpitCodeText: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.3,
    },
    cockpitSubText: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '500',
    },
    darkCockpitJobCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderRadius: 14,
        borderWidth: 1.5,
        padding: 14,
        ...shadows.sm,
    },
    darkCockpitHeaderLabel: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 4,
    },
    darkCockpitMainRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    darkCockpitCodeText: {
        color: '#F8FAFC',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.3,
    },
    darkCockpitSubText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '500',
    },
});
