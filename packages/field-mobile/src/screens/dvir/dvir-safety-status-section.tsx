import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../components/nativeStyles';
import { useTheme } from '../../theme';
import type { EquipmentPresentation } from '../../utils/equipmentClassification';
import { dvirSharedStyles } from './dvir-shared-styles';

export interface DvirSafetyStatusSectionProps {
    presentation: EquipmentPresentation;
    safetyStatus: 'safe' | 'unsafe';
    setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
    setSafetyStatus: React.Dispatch<React.SetStateAction<'safe' | 'unsafe'>>;
}

export const DvirSafetyStatusSection: React.FC<
    DvirSafetyStatusSectionProps
> = ({ presentation, safetyStatus, setIsSaved, setSafetyStatus }) => {
    const { isDarkHud } = useTheme();

    return (
        <View style={dvirSharedStyles.formSection}>
            <Text
                style={[
                    dvirSharedStyles.formSectionTitle,
                    isDarkHud && dvirSharedStyles.darkFormSectionTitle,
                ]}
            >
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
                        isDarkHud && dvirSharedStyles.darkToggleCard,
                        safetyStatus === 'safe' &&
                            dvirSharedStyles.toggleCardActive,
                        isDarkHud &&
                            safetyStatus === 'safe' &&
                            dvirSharedStyles.darkToggleCardActive,
                    ]}
                    testID="safety-status-safe"
                >
                    <Text
                        style={[
                            dvirSharedStyles.toggleCardText,
                            isDarkHud && dvirSharedStyles.darkToggleCardText,
                            safetyStatus === 'safe' &&
                                dvirSharedStyles.toggleCardTextActive,
                            isDarkHud &&
                                safetyStatus === 'safe' &&
                                dvirSharedStyles.darkToggleCardTextActive,
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
                        isDarkHud && dvirSharedStyles.darkToggleCard,
                        safetyStatus === 'unsafe' &&
                            styles.toggleCardUnsafeActive,
                        isDarkHud &&
                            safetyStatus === 'unsafe' &&
                            styles.darkToggleCardUnsafeActive,
                    ]}
                    testID="safety-status-unsafe"
                >
                    <Text
                        style={[
                            dvirSharedStyles.toggleCardText,
                            isDarkHud && dvirSharedStyles.darkToggleCardText,
                            safetyStatus === 'unsafe' &&
                                styles.toggleCardUnsafeTextActive,
                            isDarkHud &&
                                safetyStatus === 'unsafe' &&
                                styles.darkToggleCardUnsafeTextActive,
                        ]}
                    >
                        Unsafe
                    </Text>
                </Pressable>
            </View>

            <Text
                style={[
                    styles.safetyHelperNotice,
                    isDarkHud && styles.darkSafetyHelperNotice,
                ]}
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

const styles = StyleSheet.create({
    darkSafetyHelperNotice: {
        color: '#94A3B8',
    },
    darkToggleCardUnsafeActive: {
        backgroundColor: '#450A0A',
        borderColor: '#DC2626',
        borderWidth: 2,
    },
    darkToggleCardUnsafeTextActive: {
        color: '#F87171',
        fontWeight: '800',
    },
    safetyHelperNotice: {
        color: colors.textSecondary,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 8,
    },
    toggleCardUnsafeActive: {
        backgroundColor: '#FEF2F2',
        borderColor: '#DC2626',
        borderWidth: 2,
    },
    toggleCardUnsafeTextActive: {
        color: '#B91C1C',
        fontWeight: '800',
    },
});
