import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../components/nativeStyles';
import { useTheme } from '../../theme';
import type { DvirInspectionRecord } from '../../types/index';
import { DvirHistoryRecordCard } from './dvir-history-record-card';
import { dvirSharedStyles } from './dvir-shared-styles';

export interface DvirHistoryGroupProps {
    emptyMessage: string;
    records: DvirInspectionRecord[];
    title: string;
}

export const DvirHistoryGroup: React.FC<DvirHistoryGroupProps> = ({
    emptyMessage,
    records,
    title,
}) => {
    const { isDarkHud } = useTheme();

    return (
        <View style={dvirSharedStyles.timelineSection}>
            <View style={styles.timelineSectionHeader}>
                <Text
                    style={[
                        styles.sectionHeading,
                        isDarkHud && styles.darkSectionHeading,
                    ]}
                >
                    {title}
                </Text>
                <Text
                    style={[
                        styles.timelineSectionCount,
                        isDarkHud && styles.darkTimelineSectionCount,
                    ]}
                >
                    {records.length}
                </Text>
            </View>
            {records.length > 0 ? (
                <View style={dvirSharedStyles.historyList}>
                    {records.map((item) => (
                        <DvirHistoryRecordCard item={item} key={item.id} />
                    ))}
                </View>
            ) : (
                <View style={styles.emptyTimelineContainer}>
                    <Text
                        style={[
                            styles.emptyTimelineText,
                            isDarkHud && styles.darkEmptyTimelineText,
                        ]}
                    >
                        {emptyMessage}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    darkEmptyTimelineText: {
        color: '#64748B',
    },
    darkSectionHeading: {
        color: '#94A3B8',
    },
    darkTimelineSectionCount: {
        color: '#94A3B8',
    },
    emptyTimelineContainer: {
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 18,
    },
    emptyTimelineText: {
        color: colors.muted,
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
    sectionHeading: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 0,
    },
    timelineSectionCount: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    timelineSectionHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 2,
    },
});
