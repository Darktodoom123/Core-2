import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import type { DesignatedEquipmentType } from '../../../utils/equipmentClassification';
import { Icon } from '../../common/Icon';
import { UNIT_TYPE_ORDER, UNIT_TYPES } from './unit-type';

export interface UnitTypePickerProps {
    assetCode?: string;
    onChoose: (type: DesignatedEquipmentType) => void;
}

/** Asked once when the unit's type isn't known, instead of guessing. */
export const UnitTypePicker: React.FC<UnitTypePickerProps> = ({
    assetCode,
    onChoose,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.wrap} testID="unit-type-picker">
            <Text accessibilityRole="header" style={styles.question}>
                {`What kind of unit is ${assetCode || 'this'}?`}
            </Text>
            <Text style={styles.hint}>
                This decides which defects are listed.
            </Text>
            {UNIT_TYPE_ORDER.map((type) => (
                <Pressable
                    accessibilityRole="button"
                    android_ripple={{ color: theme.border }}
                    key={type}
                    onPress={() => onChoose(type)}
                    style={styles.option}
                    testID={`unit-type-${type}`}
                >
                    <View style={styles.icon}>
                        <Icon
                            color={theme.textPrimary}
                            name={UNIT_TYPES[type].icon}
                            size={22}
                        />
                    </View>
                    <View style={styles.text}>
                        <Text style={styles.label}>
                            {UNIT_TYPES[type].label}
                        </Text>
                        <Text style={styles.hint}>{UNIT_TYPES[type].hint}</Text>
                    </View>
                    <Icon
                        color={theme.textSecondary}
                        name="chevron-right"
                        size={18}
                    />
                </Pressable>
            ))}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        wrap: {
            gap: 10,
        },
        question: {
            color: theme.textPrimary,
            fontSize: 18,
            fontWeight: '700',
        },
        option: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 12,
            minHeight: 64,
            paddingHorizontal: 14,
        },
        icon: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 10,
            height: 40,
            justifyContent: 'center',
            width: 40,
        },
        text: {
            flex: 1,
            gap: 2,
        },
        label: {
            color: theme.textPrimary,
            fontSize: 16,
            fontWeight: '700',
        },
        hint: {
            color: theme.textSecondary,
            fontSize: 13,
        },
    });
