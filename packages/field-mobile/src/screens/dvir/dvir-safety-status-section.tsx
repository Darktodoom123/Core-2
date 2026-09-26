import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { EquipmentPresentation } from '../../utils/equipmentClassification';
import { createDvirSharedStyles } from './dvir-shared-styles';

export interface DvirSafetyStatusSectionProps {
    presentation: EquipmentPresentation;
    safetyStatus: 'safe' | 'unsafe';
    setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
    setSafetyStatus: React.Dispatch<React.SetStateAction<'safe' | 'unsafe'>>;
}

export const DvirSafetyStatusSection: React.FC<
    DvirSafetyStatusSectionProps
> = ({ presentation, safetyStatus, setIsSaved, setSafetyStatus }) => {
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View style={dvirSharedStyles.formSection}>
            <Text style={[dvirSharedStyles.formSectionTitle]}>
                Choose safety status
            </Text>
            <Text style={dvirSharedStyles.requiredBadge}>Required</Text>

            <View style={dvirSharedStyles.toggleRow}>
                <Pressable
                    accessibilityLabel="Safe to drive"
                    accessibilityRole="button"
                    accessibilityState={{
                        selected: safetyStatus === 'safe',
                    }}
                    onPress={() => {
                        setSafetyStatus('safe');
                        setIsSaved(false);
                    }}
                    style={[
                        dvirSharedStyles.toggleCard,
                        safetyStatus === 'safe' && styles.toggleCardSafeActive,
                    ]}
                    testID="safety-status-safe"
                >
                    <Text
                        style={[
                            dvirSharedStyles.toggleCardText,
                            safetyStatus === 'safe' &&
                                styles.toggleCardSafeTextActive,
                        ]}
                    >
                        {presentation.safetySafeLabel}
                    </Text>
                </Pressable>

                <Pressable
                    accessibilityLabel="Unsafe"
                    accessibilityRole="button"
                    accessibilityState={{
                        selected: safetyStatus === 'unsafe',
                    }}
                    onPress={() => {
                        setSafetyStatus('unsafe');
                        setIsSaved(false);
                    }}
                    style={[
                        dvirSharedStyles.toggleCard,
                        safetyStatus === 'unsafe' &&
                            styles.toggleCardUnsafeActive,
                    ]}
                    testID="safety-status-unsafe"
                >
                    <Text
                        style={[
                            dvirSharedStyles.toggleCardText,
                            safetyStatus === 'unsafe' &&
                                styles.toggleCardUnsafeTextActive,
                        ]}
                    >
                        Unsafe
                    </Text>
                </Pressable>
            </View>

            <Text
                style={[styles.safetyHelperNotice]}
                testID="dvir-safety-disclaimer"
            >
                Pre-trip verification of transit roadworthiness and visible
                mechanical safety. Note: Routine DVIR certification does not
                override open maintenance work orders or specialized lift
                certifications.
            </Text>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        safetyHelperNotice: {
            color: theme.textSecondary,
            fontSize: 12,
            lineHeight: 16,
            marginTop: 8,
        },
        // Status choices use their state colors: cleared green, unsafe red.
        toggleCardSafeActive: {
            backgroundColor: theme.successEmeraldLight,
            borderColor: theme.successEmerald,
            borderWidth: 2,
        },
        toggleCardSafeTextActive: {
            color: theme.successEmeraldText,
        },
        toggleCardUnsafeActive: {
            backgroundColor: theme.hazardRedLight,
            borderColor: theme.hazardRed,
            borderWidth: 2,
        },
        toggleCardUnsafeTextActive: {
            color: theme.hazardRedText,
        },
    });
