import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { DvirInspectionRecord } from '../../types/index';
import { DvirHistoryRecordCard } from './dvir-history-record-card';
import { createDvirSharedStyles } from './dvir-shared-styles';

export interface DvirHistoryArchiveProps {
    olderRecords: DvirInspectionRecord[];
    setShowOlderArchive: React.Dispatch<React.SetStateAction<boolean>>;
    showOlderArchive: boolean;
}

export const DvirHistoryArchive: React.FC<DvirHistoryArchiveProps> = ({
    olderRecords,
    setShowOlderArchive,
    showOlderArchive,
}) => {
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View style={dvirSharedStyles.timelineSection}>
            <Pressable
                accessibilityLabel="Toggle 30-day historical archive"
                accessibilityRole="button"
                onPress={() => setShowOlderArchive((prev) => !prev)}
                style={styles.archiveToggleBtn}
                testID="toggle-older-archive"
            >
                <Text style={[styles.archiveToggleText]}>
                    {showOlderArchive
                        ? `▼ Hide 30-Day Archive (${olderRecords.length} Records)`
                        : `▶ Load 30-Day Archive (${olderRecords.length} Older Records)`}
                </Text>
            </Pressable>
            {showOlderArchive ? (
                <View style={[dvirSharedStyles.historyList, { marginTop: 10 }]}>
                    {olderRecords.map((item) => (
                        <DvirHistoryRecordCard item={item} key={item.id} />
                    ))}
                </View>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        archiveToggleBtn: {
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 48,
            paddingVertical: 12,
        },
        archiveToggleText: {
            color: theme.brandAmberText,
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 0.2,
        },
    });
