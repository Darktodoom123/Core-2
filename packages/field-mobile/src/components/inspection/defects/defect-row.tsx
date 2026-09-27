import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import { Icon } from '../../common/Icon';
import { defectSeverity } from './defect-sets';
import type { DefectItem } from './defect-types';

export interface DefectRowProps {
    item: DefectItem;
    checked: boolean;
    onToggle: (id: string) => void;
}

/** One defect: a checkbox with its severity, shown before it is picked. */
export const DefectRow: React.FC<DefectRowProps> = ({
    item,
    checked,
    onToggle,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const isCritical = defectSeverity(item) === 'critical';

    return (
        <Pressable
            accessibilityHint={
                isCritical ? 'Critical severity' : 'Needs attention'
            }
            accessibilityLabel={item.label}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            android_ripple={{ color: theme.border }}
            onPress={() => onToggle(item.id)}
            style={styles.row}
            testID={`defect-item-${item.id}`}
        >
            <View style={[styles.box, checked && styles.boxChecked]}>
                {checked ? (
                    <Icon color={theme.surfaceDark} name="check" size={14} />
                ) : null}
            </View>
            <Text style={styles.label}>{item.label}</Text>
            <View
                style={[
                    styles.tag,
                    isCritical ? styles.tagCritical : styles.tagAttention,
                ]}
                testID="severity-tag"
            >
                <Icon
                    color={
                        isCritical
                            ? theme.hazardRedText
                            : theme.warningOrangeText
                    }
                    name={isCritical ? 'alert-circle' : 'alert'}
                    size={11}
                />
                <Text
                    style={[
                        styles.tagText,
                        {
                            color: isCritical
                                ? theme.hazardRedText
                                : theme.warningOrangeText,
                        },
                    ]}
                >
                    {isCritical ? 'CRITICAL' : 'ATTENTION'}
                </Text>
            </View>
        </Pressable>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        row: {
            alignItems: 'center',
            borderTopColor: theme.border,
            borderTopWidth: 1,
            flexDirection: 'row',
            gap: 12,
            minHeight: 56,
            paddingHorizontal: 14,
            paddingVertical: 10,
        },
        box: {
            alignItems: 'center',
            borderColor: theme.borderStrong,
            borderRadius: 6,
            borderWidth: 2,
            height: 22,
            justifyContent: 'center',
            width: 22,
        },
        boxChecked: {
            backgroundColor: theme.brandAmber,
            borderColor: theme.brandAmber,
        },
        label: {
            color: theme.textPrimary,
            flex: 1,
            fontSize: 15,
            lineHeight: 20,
        },
        tag: {
            alignItems: 'center',
            borderRadius: 999,
            flexDirection: 'row',
            gap: 3,
            paddingHorizontal: 7,
            paddingVertical: 3,
        },
        tagCritical: {
            backgroundColor: theme.hazardRedLight,
        },
        tagAttention: {
            backgroundColor: theme.warningOrangeLight,
        },
        tagText: {
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.3,
        },
    });
