import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import type { DesignatedEquipmentType } from '../../../utils/equipmentClassification';
import { Icon } from '../../common/Icon';
import { COMMON_DEFECT_IDS, findDefects } from './defect-sets';
import { UNIT_TYPES } from './unit-type';

export interface DefectQuickPicksProps {
    unitType: DesignatedEquipmentType;
    selectedIds: string[];
    onToggleDefect: (id: string) => void;
}

/** The problems most often reported on this type, one tap each. */
export const DefectQuickPicks: React.FC<DefectQuickPicksProps> = ({
    unitType,
    selectedIds,
    onToggleDefect,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const ids = COMMON_DEFECT_IDS[unitType];
    const items = findDefects(ids).sort(
        (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id),
    );

    return (
        <View style={styles.wrap} testID="defect-quick-picks">
            <Text style={styles.heading}>
                {`COMMON ON ${UNIT_TYPES[unitType].plural.toUpperCase()}`}
            </Text>
            <View style={styles.chips}>
                {items.map((item) => {
                    const isSelected = selectedIds.includes(item.id);

                    return (
                        <Pressable
                            accessibilityLabel={item.label}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isSelected }}
                            key={item.id}
                            onPress={() => onToggleDefect(item.id)}
                            style={[
                                styles.chip,
                                isSelected ? styles.chipSelected : null,
                            ]}
                            testID={`quick-pick-${item.id}`}
                        >
                            {isSelected ? (
                                <Icon
                                    color={theme.textPrimary}
                                    name="check"
                                    size={14}
                                />
                            ) : null}
                            <Text numberOfLines={2} style={styles.chipText}>
                                {item.label}
                            </Text>
                            {item.critical ? (
                                <Icon
                                    color={theme.hazardRedText}
                                    name="alert-circle"
                                    size={13}
                                />
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        wrap: {
            gap: 10,
        },
        heading: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.6,
        },
        chips: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        chip: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 6,
            maxWidth: '100%',
            minHeight: 48,
            paddingHorizontal: 12,
            paddingVertical: 8,
        },
        chipSelected: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
        },
        chipText: {
            color: theme.textPrimary,
            flexShrink: 1,
            fontSize: 14,
            fontWeight: '500',
        },
    });
