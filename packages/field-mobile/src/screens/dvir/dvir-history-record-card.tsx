import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../components/nativeStyles';
import { useTheme } from '../../theme';
import type { DvirInspectionRecord } from '../../types/index';
import { dvirSharedStyles } from './dvir-shared-styles';

export interface DvirHistoryRecordCardProps {
    item: DvirInspectionRecord;
}

export const DvirHistoryRecordCard: React.FC<DvirHistoryRecordCardProps> = ({
    item,
}) => {
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                styles.historyCard,
                isDarkHud && styles.darkHistoryCard,
                item.criticalDefectsCount > 0 || item.hasDefects
                    ? isDarkHud
                        ? styles.darkHistoryCardDefect
                        : styles.historyCardDefect
                    : isDarkHud
                      ? styles.darkHistoryCardClean
                      : styles.historyCardClean,
            ]}
            testID={`history-card-${item.id}`}
        >
            <View style={styles.historyCardHeader}>
                <View style={styles.historyRefGroup}>
                    <Text
                        style={[
                            styles.historyTypeBadge,
                            isDarkHud && styles.darkHistoryTypeBadge,
                        ]}
                    >
                        {item.type === 'pre_trip'
                            ? 'PRE-TRIP INSPECTION'
                            : 'POST-TRIP CHECK'}
                    </Text>
                    <Text
                        style={[
                            styles.historyId,
                            isDarkHud && styles.darkHistoryId,
                        ]}
                    >
                        {item.id}
                    </Text>
                </View>
                <View style={styles.statusIndicator}>
                    <View
                        style={[
                            styles.statusDot,
                            item.hasDefects
                                ? styles.statusDotDefect
                                : styles.statusDotClean,
                        ]}
                    />
                    <Text
                        style={[
                            styles.statusText,
                            item.hasDefects
                                ? isDarkHud
                                    ? styles.darkStatusTextDefect
                                    : styles.statusTextDefect
                                : isDarkHud
                                  ? styles.darkStatusTextClean
                                  : styles.statusTextClean,
                        ]}
                    >
                        {item.hasDefects
                            ? `${item.criticalDefectsCount > 0 ? item.criticalDefectsCount : 'Defects'} Logged`
                            : 'Clean Pass'}
                    </Text>
                </View>
            </View>

            <Text
                style={[
                    styles.historyAsset,
                    isDarkHud && dvirSharedStyles.darkHistoryAsset,
                ]}
            >
                {item.assetCode} · {item.assetName}
            </Text>
            <Text
                style={[
                    dvirSharedStyles.historyMeta,
                    isDarkHud && styles.darkHistoryMeta,
                ]}
            >
                Inspector: {item.inspectorName}
            </Text>
            <Text
                style={[
                    dvirSharedStyles.historyMeta,
                    isDarkHud && styles.darkHistoryMeta,
                ]}
            >
                Logged: {new Date(item.completedAt).toLocaleString()}
            </Text>
            {item.remarks ? (
                <Text
                    style={[
                        styles.historyRemarks,
                        isDarkHud && styles.darkHistoryRemarks,
                    ]}
                >
                    "{item.remarks}"
                </Text>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    darkHistoryCard: {
        backgroundColor: '#0F1A2E',
        borderColor: '#1E293B',
    },
    darkHistoryCardClean: {
        borderColor: '#059669',
    },
    darkHistoryCardDefect: {
        borderColor: '#DC2626',
    },
    darkHistoryId: {
        color: '#F8FAFC',
    },
    darkHistoryMeta: {
        color: '#94A3B8',
    },
    darkHistoryRemarks: {
        color: '#94A3B8',
    },
    darkHistoryTypeBadge: {
        color: '#94A3B8',
    },
    darkStatusTextClean: {
        color: '#34D399',
    },
    darkStatusTextDefect: {
        color: '#F87171',
    },
    historyAsset: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
        marginTop: 2,
    },
    historyCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
    },
    historyCardClean: {
        borderColor: '#10B981',
    },
    historyCardDefect: {
        borderColor: '#EF4444',
    },
    historyCardHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    historyId: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    historyRefGroup: {
        gap: 2,
    },
    historyRemarks: {
        color: colors.textSecondary,
        fontStyle: 'italic',
        fontSize: 12,
        marginTop: 6,
    },
    historyTypeBadge: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    statusDot: {
        borderRadius: 4,
        height: 7,
        width: 7,
    },
    statusDotClean: {
        backgroundColor: '#10B981',
    },
    statusDotDefect: {
        backgroundColor: '#EF4444',
    },
    statusIndicator: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    statusTextClean: {
        color: '#059669',
    },
    statusTextDefect: {
        color: '#DC2626',
    },
});
