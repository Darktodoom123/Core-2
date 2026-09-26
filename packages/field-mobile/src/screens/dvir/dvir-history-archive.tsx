import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../components/nativeStyles';
import { useTheme } from '../../theme';
import type { DvirInspectionRecord } from '../../types/index';
import { DvirHistoryRecordCard } from './dvir-history-record-card';
import { dvirSharedStyles } from './dvir-shared-styles';

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
    const { isDarkHud } = useTheme();

    return (
        <View style={dvirSharedStyles.timelineSection}>
            <Pressable
                accessibilityLabel="Toggle 30-day historical archive"
                accessibilityRole="button"
                onPress={() => setShowOlderArchive((prev) => !prev)}
                style={styles.archiveToggleBtn}
                testID="toggle-older-archive"
            >
                <Text
                    style={[
                        styles.archiveToggleText,
                        isDarkHud && styles.darkArchiveToggleText,
                    ]}
                >
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

const styles = StyleSheet.create({
    archiveToggleBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    archiveToggleText: {
        color: colors.amberDark,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    darkArchiveToggleText: {
        color: '#FFBF00',
    },
});
