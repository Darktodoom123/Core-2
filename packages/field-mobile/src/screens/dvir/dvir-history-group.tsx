import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { DvirInspectionRecord } from '../../types/index';
import { DvirHistoryRecordCard } from './dvir-history-record-card';
import { createDvirSharedStyles } from './dvir-shared-styles';

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
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View style={dvirSharedStyles.timelineSection}>
            <View style={styles.timelineSectionHeader}>
                <Text style={[styles.sectionHeading]}>{title}</Text>
                <Text style={[styles.timelineSectionCount]}>
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
                    <Text style={[styles.emptyTimelineText]}>
                        {emptyMessage}
                    </Text>
                </View>
            )}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        emptyTimelineContainer: {
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 18,
        },
        emptyTimelineText: {
            color: theme.textSecondary,
            fontSize: 13,
            lineHeight: 18,
            textAlign: 'center',
        },
        sectionHeading: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.5,
            marginBottom: 0,
        },
        timelineSectionCount: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
        },
        timelineSectionHeader: {
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 2,
        },
    });
