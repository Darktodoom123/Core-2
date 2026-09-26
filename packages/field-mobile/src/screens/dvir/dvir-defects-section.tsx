import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import type { DefectItem } from '../../components/inspection/DvirDefectsModal';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { EquipmentPresentation } from '../../utils/equipmentClassification';
import { createDvirSharedStyles } from './dvir-shared-styles';

export interface DvirDefectsSectionProps {
    handleRemoveDefect: (id: string) => void;
    presentation: EquipmentPresentation;
    selectedDefectIds: string[];
    selectedDefects: DefectItem[];
    setIsDefectsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DvirDefectsSection: React.FC<DvirDefectsSectionProps> = ({
    handleRemoveDefect,
    presentation,
    selectedDefectIds,
    selectedDefects,
    setIsDefectsModalOpen,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View style={dvirSharedStyles.formSection}>
            <Text
                style={[dvirSharedStyles.formSectionTitle]}
                testID="dvir-defects-section-title"
            >
                {presentation.defectsSectionTitle.replace('Add ', 'Add new ')}
            </Text>
            <Text style={[styles.helperNotice]}>
                {presentation.safetyDisclaimer}
            </Text>

            <Pressable
                accessibilityLabel={`Add ${presentation.shortLabel.toLowerCase()} defects`}
                accessibilityRole="button"
                onPress={() => setIsDefectsModalOpen(true)}
                style={({ pressed }) => [
                    styles.addDefectsBtn,
                    selectedDefectIds.length > 0 && styles.addDefectsBtnActive,
                    pressed && dvirSharedStyles.pressed,
                ]}
                testID="add-defects-button"
            >
                <Text
                    style={[
                        styles.addDefectsBtnText,
                        selectedDefectIds.length > 0 &&
                            styles.addDefectsBtnTextActive,
                    ]}
                >
                    {selectedDefectIds.length > 0
                        ? `Edit defects (${selectedDefectIds.length} added)`
                        : 'Add defects'}
                </Text>
            </Pressable>

            {/* Selected Defect Tags / Chips */}
            {selectedDefects.length > 0 ? (
                <View style={styles.defectChipsContainer}>
                    {selectedDefects.map((defect) => (
                        <View
                            key={defect.id}
                            style={[
                                styles.defectChip,
                                defect.critical
                                    ? styles.defectChipCritical
                                    : styles.defectChipNormal,
                            ]}
                            testID={`defect-chip-${defect.id}`}
                        >
                            <Icon
                                color={
                                    defect.critical
                                        ? theme.hazardRedText
                                        : theme.warningOrangeText
                                }
                                name="alert"
                                size={14}
                            />
                            <Text
                                numberOfLines={1}
                                style={[styles.defectChipText]}
                            >
                                {defect.label}
                            </Text>
                            <Pressable
                                accessibilityLabel={`Remove defect ${defect.label}`}
                                accessibilityRole="button"
                                hitSlop={8}
                                onPress={() => handleRemoveDefect(defect.id)}
                                style={styles.removeChipBtn}
                            >
                                <Icon
                                    color={theme.textPrimary}
                                    name="close"
                                    size={14}
                                />
                            </Pressable>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        addDefectsBtn: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.brandAmber,
            borderRadius: 12,
            borderWidth: 1.5,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 16,
            width: '100%',
        },
        addDefectsBtnActive: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
        },
        addDefectsBtnText: {
            color: theme.brandAmberText,
            fontSize: 15,
            fontWeight: '700',
        },
        addDefectsBtnTextActive: {
            color: theme.textPrimary,
        },
        defectChip: {
            alignItems: 'center',
            borderRadius: 8,
            flexDirection: 'row',
            gap: 6,
            paddingLeft: 10,
            paddingVertical: 4,
        },
        defectChipCritical: {
            backgroundColor: theme.hazardRedLight,
            borderColor: theme.hazardRed,
            borderWidth: 1,
        },
        defectChipNormal: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
            borderWidth: 1,
        },
        defectChipText: {
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
        },
        defectChipsContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
        },
        helperNotice: {
            color: theme.textSecondary,
            fontSize: 13,
            lineHeight: 18,
            marginBottom: 12,
            marginTop: 2,
        },
        // 32dp plus the 8dp hitSlop on each side gives a 48dp target.
        removeChipBtn: {
            alignItems: 'center',
            height: 32,
            justifyContent: 'center',
            width: 32,
        },
    });
