import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { StandbyReason } from '../../types/index';
import { createHosSharedStyles } from './hos-shared-styles';
import type { StandbyReasonOption } from './hos-standby-reasons';

export interface HosStandbyReasonSelectorProps {
    /** Reasons for the linked machine; general ones when not linked. */
    options: StandbyReasonOption[];
    /** The operator's pick; nothing is chosen for them. */
    standbyReason: StandbyReason | null;
    /** The linked machine, when there is one. */
    machineLabel?: string | null;
    onChoose: (reason: StandbyReason) => void;
}

export const HosStandbyReasonSelector: React.FC<
    HosStandbyReasonSelectorProps
> = ({ options, standbyReason, machineLabel, onChoose }) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const hosSharedStyles = useThemedStyles(createHosSharedStyles);

    return (
        <View
            style={[hosSharedStyles.sectionCard]}
            testID="standby-reason-section"
        >
            <Text
                accessibilityRole="header"
                style={[hosSharedStyles.sectionTitle]}
            >
                STANDBY REASON
            </Text>
            <Text
                style={[hosSharedStyles.sectionHelper]}
                testID="standby-reason-helper"
            >
                {machineLabel
                    ? `Required. Reasons for ${machineLabel}.`
                    : 'Required. Link to your machine to see reasons for it.'}
            </Text>

            <View accessibilityRole="radiogroup" style={styles.list}>
                {options.map((item) => {
                    const isSelected = standbyReason === item.reason;

                    return (
                        <Pressable
                            key={item.reason}
                            accessibilityLabel={`${item.label}${item.billable ? ', billable to the client' : ''}`}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: isSelected }}
                            onPress={() => onChoose(item.reason)}
                            style={({ pressed }) => [
                                styles.option,
                                isSelected && styles.optionSelected,
                                pressed && hosSharedStyles.pressed,
                            ]}
                            testID={`standby-reason-${item.reason}`}
                        >
                            <Text style={styles.label}>{item.label}</Text>
                            {item.billable ? (
                                <View
                                    style={styles.billable}
                                    testID={`standby-billable-${item.reason}`}
                                >
                                    <Text style={styles.billableText}>
                                        Billable
                                    </Text>
                                </View>
                            ) : null}
                            {isSelected ? (
                                <Icon
                                    color={theme.textPrimary}
                                    name="check"
                                    size={18}
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
        list: {
            gap: 8,
        },
        option: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            minHeight: 52,
            paddingHorizontal: 14,
            paddingVertical: 12,
        },
        optionSelected: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
            borderWidth: 1.5,
        },
        label: {
            color: theme.textPrimary,
            flex: 1,
            fontSize: 15,
            fontWeight: '500',
        },
        billable: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.borderStrong,
            borderRadius: 6,
            borderWidth: 1,
            paddingHorizontal: 6,
            paddingVertical: 2,
        },
        billableText: {
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
        },
    });
