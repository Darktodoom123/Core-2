import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { DvirInspectionRecord } from '../../types/index';
import { createDvirSharedStyles } from './dvir-shared-styles';

export interface DvirHistoryRecordCardProps {
    item: DvirInspectionRecord;
}

export const DvirHistoryRecordCard: React.FC<DvirHistoryRecordCardProps> = ({
    item,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    // Critical defects block dispatch (hazard); other defects need attention.
    const tone =
        item.criticalDefectsCount > 0
            ? 'critical'
            : item.hasDefects
              ? 'defect'
              : 'clean';
    const toneColor = {
        clean: theme.successEmerald,
        defect: theme.warningOrange,
        critical: theme.hazardRed,
    }[tone];
    const toneText = {
        clean: theme.successEmeraldText,
        defect: theme.warningOrangeText,
        critical: theme.hazardRedText,
    }[tone];
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View
            style={[styles.historyCard, { borderColor: toneColor }]}
            testID={`history-card-${item.id}`}
        >
            <View style={styles.historyCardHeader}>
                <View style={styles.historyRefGroup}>
                    <Text style={[styles.historyTypeBadge]}>
                        {item.type === 'pre_trip'
                            ? 'PRE-TRIP INSPECTION'
                            : 'POST-TRIP CHECK'}
                    </Text>
                    <Text style={[styles.historyId]}>{item.id}</Text>
                </View>
                <View style={styles.statusIndicator}>
                    <Icon
                        color={toneColor}
                        name={tone === 'clean' ? 'check-circle' : 'alert'}
                        size={14}
                    />
                    <Text style={[styles.statusText, { color: toneText }]}>
                        {item.hasDefects
                            ? `${item.criticalDefectsCount > 0 ? item.criticalDefectsCount : 'Defects'} Logged`
                            : 'Clean Pass'}
                    </Text>
                </View>
            </View>

            <Text style={[styles.historyAsset]}>
                {item.assetCode} · {item.assetName}
            </Text>
            <Text style={[dvirSharedStyles.historyMeta]}>
                Inspector: {item.inspectorName}
            </Text>
            <Text style={[dvirSharedStyles.historyMeta]}>
                Logged: {new Date(item.completedAt).toLocaleString()}
            </Text>
            {item.syncState === 'on_phone' ? (
                <View style={styles.onPhoneRow}>
                    <Icon color={theme.textSecondary} name="sync" size={13} />
                    <Text style={[dvirSharedStyles.historyMeta]}>
                        Saved on this phone
                    </Text>
                </View>
            ) : null}
            {item.remarks ? (
                <Text style={[styles.historyRemarks]}>"{item.remarks}"</Text>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        onPhoneRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 6,
        },
        historyAsset: {
            color: theme.textPrimary,
            fontSize: 13,
            fontWeight: '700',
            marginTop: 2,
        },
        historyCard: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            padding: 14,
        },
        historyCardHeader: {
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 6,
        },
        historyId: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        historyRefGroup: {
            gap: 2,
        },
        historyRemarks: {
            color: theme.textSecondary,
            fontStyle: 'italic',
            fontSize: 12,
            marginTop: 6,
        },
        historyTypeBadge: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.5,
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
    });
