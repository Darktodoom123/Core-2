import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { AssetAssignment } from '../../types/index';

const NOT_RECORDED = 'Not recorded';

const kindLabel = (kind: string): string =>
    kind
        ? kind
              .split('_')
              .map((word, index) =>
                  index === 0
                      ? word.charAt(0).toUpperCase() + word.slice(1)
                      : word,
              )
              .join(' ')
        : NOT_RECORDED;

const machineIcon = (kind: string) =>
    /truck|transport|mover/i.test(kind) ? 'truck' : 'crane';

interface RowProps {
    label: string;
    value: string;
    isLast?: boolean;
}

const Row: React.FC<RowProps> = ({ label, value, isLast = false }) => {
    const styles = useThemedStyles(createStyles);

    return (
        <View style={[styles.row, isLast && styles.rowLast]}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text
                selectable
                style={[
                    styles.rowValue,
                    value === NOT_RECORDED && styles.missing,
                ]}
            >
                {value}
            </Text>
        </View>
    );
};

export interface MachineDetailsProps {
    asset: AssetAssignment;
}

/**
 * The machine as the server knows it. Missing fields read "Not recorded";
 * the profile never shows placeholder specs as if they were real.
 */
export const MachineDetails: React.FC<MachineDetailsProps> = ({ asset }) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const attachments = asset.attachments?.filter(Boolean) ?? [];

    return (
        <>
            <View style={styles.identity} testID="machine-identity">
                <View style={styles.iconWrap}>
                    <Icon
                        color={theme.textPrimary}
                        name={machineIcon(asset.asset_kind)}
                        size={26}
                    />
                </View>
                <View style={styles.identityText}>
                    <Text style={styles.code}>{asset.asset_code}</Text>
                    <Text style={styles.name}>{asset.asset_name}</Text>
                    <Text style={styles.kind}>
                        {kindLabel(asset.asset_kind)}
                    </Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>SPECIFICATIONS</Text>
            <View style={styles.list}>
                <Row label="Model" value={asset.model || NOT_RECORDED} />
                <Row
                    label="Rated capacity"
                    value={asset.rated_capacity || NOT_RECORDED}
                />
                <Row
                    isLast
                    label="Engine hours"
                    value={
                        typeof asset.engine_hours === 'number'
                            ? `${asset.engine_hours.toLocaleString('en-US')} hrs`
                            : NOT_RECORDED
                    }
                />
            </View>

            <Text style={styles.sectionTitle}>ATTACHMENTS</Text>
            <View style={styles.list}>
                {attachments.length > 0 ? (
                    attachments.map((attachment, index) => (
                        <Row
                            isLast={index === attachments.length - 1}
                            key={`${attachment}-${index}`}
                            label={`Attachment ${index + 1}`}
                            value={attachment}
                        />
                    ))
                ) : (
                    <Row isLast label="Fitted" value={NOT_RECORDED} />
                )}
            </View>
        </>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        identity: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 14,
            marginBottom: 14,
            padding: 16,
        },
        iconWrap: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 14,
            height: 52,
            justifyContent: 'center',
            width: 52,
        },
        identityText: {
            flex: 1,
            minWidth: 0,
        },
        code: {
            color: theme.textPrimary,
            fontFamily: 'monospace',
            fontSize: 20,
            fontWeight: '700',
        },
        name: {
            color: theme.textPrimary,
            fontSize: 16,
            fontWeight: '500',
            marginTop: 2,
        },
        kind: {
            color: theme.textSecondary,
            fontSize: 13,
            marginTop: 2,
        },
        sectionTitle: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.6,
            marginBottom: 8,
            marginTop: 4,
        },
        list: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 14,
            borderWidth: 1,
            marginBottom: 14,
            paddingHorizontal: 14,
        },
        row: {
            alignItems: 'center',
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
            flexDirection: 'row',
            gap: 12,
            justifyContent: 'space-between',
            minHeight: 48,
            paddingVertical: 10,
        },
        rowLast: {
            borderBottomWidth: 0,
        },
        rowLabel: {
            color: theme.textSecondary,
            fontSize: 14,
        },
        rowValue: {
            color: theme.textPrimary,
            flexShrink: 1,
            fontSize: 15,
            fontWeight: '700',
            textAlign: 'right',
        },
        missing: {
            color: theme.textSecondary,
            fontWeight: '500',
        },
    });
