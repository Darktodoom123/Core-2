import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import { Icon } from '../../common/Icon';
import type { IconName } from '../../common/Icon';
import type { ReasonOption } from './delay-reasons';

export interface DelayChoiceChipProps {
    label: string;
    accessibilityLabel: string;
    isSelected: boolean;
    onPress: () => void;
    testID: string;
    icon?: IconName;
    grow?: boolean;
}

/**
 * Single-choice chip for the delay sheet's radio groups. Selection is Signal
 * Gold Soft with ink text, the same as every other selected control.
 */
export const DelayChoiceChip: React.FC<DelayChoiceChipProps> = ({
    label,
    accessibilityLabel,
    isSelected,
    onPress,
    testID,
    icon,
    grow = false,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <Pressable
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            onPress={onPress}
            style={[
                styles.chip,
                grow && styles.chipGrow,
                isSelected && styles.chipSelected,
            ]}
            testID={testID}
        >
            {icon ? (
                <Icon
                    color={isSelected ? theme.textPrimary : theme.textSecondary}
                    name={icon}
                    size={16}
                />
            ) : null}
            <Text
                style={[styles.chipText, isSelected && styles.chipTextSelected]}
            >
                {label}
            </Text>
        </Pressable>
    );
};

export interface DelayReasonCardProps {
    option: ReasonOption;
    isSelected: boolean;
    onSelect: () => void;
}

export const DelayReasonCard: React.FC<DelayReasonCardProps> = ({
    option,
    isSelected,
    onSelect,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <Pressable
            accessibilityLabel={`Select delay reason: ${option.label}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            onPress={onSelect}
            style={[styles.reasonCard, isSelected && styles.chipSelected]}
            testID={`delay-reason-${option.code}`}
        >
            <View style={styles.reasonCardHeader}>
                <Icon
                    color={isSelected ? theme.textPrimary : theme.textSecondary}
                    name={option.icon}
                    size={18}
                />
                <Text
                    style={[
                        styles.reasonLabel,
                        isSelected && styles.reasonLabelSelected,
                    ]}
                >
                    {option.label}
                </Text>
                <View
                    style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleSelected,
                    ]}
                >
                    {isSelected ? <View style={styles.radioInner} /> : null}
                </View>
            </View>
            <Text style={styles.reasonDesc}>{option.description}</Text>
        </Pressable>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        chip: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 10,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 48,
            minWidth: 56,
            paddingHorizontal: 12,
        },
        chipGrow: {
            flex: 1,
        },
        chipSelected: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
        },
        chipText: {
            color: theme.textSecondary,
            fontSize: 14,
            fontWeight: '500',
        },
        chipTextSelected: {
            color: theme.textPrimary,
            fontWeight: '700',
        },
        reasonCard: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            minHeight: 56,
            padding: 12,
        },
        reasonCardHeader: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        reasonLabel: {
            color: theme.textPrimary,
            flex: 1,
            fontSize: 14,
            fontWeight: '500',
        },
        reasonLabelSelected: {
            fontWeight: '700',
        },
        radioCircle: {
            alignItems: 'center',
            borderColor: theme.borderStrong,
            borderRadius: 10,
            borderWidth: 2,
            height: 20,
            justifyContent: 'center',
            width: 20,
        },
        radioCircleSelected: {
            borderColor: theme.brandAmberText,
        },
        radioInner: {
            backgroundColor: theme.brandAmberText,
            borderRadius: 5,
            height: 10,
            width: 10,
        },
        reasonDesc: {
            color: theme.textSecondary,
            fontSize: 13,
            marginLeft: 26,
            marginTop: 4,
        },
    });
