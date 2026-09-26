import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import type { DefectItem } from '../../components/inspection/DvirDefectsModal';
import { colors } from '../../components/nativeStyles';
import { useTheme } from '../../theme';
import type { EquipmentPresentation } from '../../utils/equipmentClassification';
import { dvirSharedStyles } from './dvir-shared-styles';

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
    const { isDarkHud } = useTheme();

    return (
        <View style={dvirSharedStyles.formSection}>
            <Text
                style={[
                    dvirSharedStyles.formSectionTitle,
                    isDarkHud && dvirSharedStyles.darkFormSectionTitle,
                ]}
                testID="dvir-defects-section-title"
            >
                {presentation.defectsSectionTitle.replace('Add ', 'Add new ')}
            </Text>
            <Text
                style={[
                    styles.helperNotice,
                    isDarkHud && styles.darkHelperNotice,
                ]}
            >
                {presentation.safetyDisclaimer}
            </Text>

            <Pressable
                accessibilityLabel={`Add ${presentation.shortLabel.toLowerCase()} defects`}
                accessibilityRole="button"
                onPress={() => setIsDefectsModalOpen(true)}
                style={({ pressed }) => [
                    styles.addDefectsBtn,
                    isDarkHud && styles.darkAddDefectsBtn,
                    selectedDefectIds.length > 0 && styles.addDefectsBtnActive,
                    isDarkHud &&
                        selectedDefectIds.length > 0 &&
                        styles.darkAddDefectsBtnActive,
                    pressed && dvirSharedStyles.pressed,
                ]}
                testID="add-defects-button"
            >
                <Text
                    style={[
                        styles.addDefectsBtnText,
                        isDarkHud && styles.darkAddDefectsBtnText,
                        selectedDefectIds.length > 0 &&
                            styles.addDefectsBtnTextActive,
                        isDarkHud &&
                            selectedDefectIds.length > 0 &&
                            styles.darkAddDefectsBtnTextActive,
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
                                    ? isDarkHud
                                        ? styles.darkDefectChipCritical
                                        : styles.defectChipCritical
                                    : isDarkHud
                                      ? styles.darkDefectChipNormal
                                      : styles.defectChipNormal,
                            ]}
                        >
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.defectChipText,
                                    isDarkHud && styles.darkDefectChipText,
                                ]}
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
                                    color={
                                        isDarkHud
                                            ? '#FFFFFF'
                                            : defect.critical
                                              ? '#991B1B'
                                              : colors.amberDark
                                    }
                                    name="close"
                                    size={12}
                                />
                            </Pressable>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    addDefectsBtn: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.primaryBorder,
        borderRadius: 8,
        borderWidth: 1.5,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 16,
        width: '100%',
    },
    addDefectsBtnActive: {
        backgroundColor: colors.amberLight,
        borderColor: colors.primaryBorder,
    },
    addDefectsBtnText: {
        color: colors.amber,
        fontSize: 15,
        fontWeight: '800',
    },
    addDefectsBtnTextActive: {
        color: colors.amberDark,
    },
    darkAddDefectsBtn: {
        backgroundColor: 'transparent',
        borderColor: '#FFBF00',
    },
    darkAddDefectsBtnActive: {
        backgroundColor: '#332800',
        borderColor: '#FFBF00',
    },
    darkAddDefectsBtnText: {
        color: '#FFBF00',
    },
    darkAddDefectsBtnTextActive: {
        color: '#FFBF00',
    },
    darkDefectChipCritical: {
        backgroundColor: '#7F1D1D',
        borderColor: '#DC2626',
        borderWidth: 1,
    },
    darkDefectChipNormal: {
        backgroundColor: '#332800',
        borderColor: '#332800',
        borderWidth: 1,
    },
    darkDefectChipText: {
        color: '#F8FAFC',
    },
    darkHelperNotice: {
        color: '#94A3B8',
    },
    defectChip: {
        alignItems: 'center',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    defectChipCritical: {
        backgroundColor: '#FEE2E2',
        borderColor: '#FECACA',
        borderWidth: 1,
    },
    defectChipNormal: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderWidth: 1,
    },
    defectChipText: {
        color: colors.text,
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
        color: colors.textSecondary,
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 12,
        marginTop: 2,
    },
    removeChipBtn: {
        padding: 2,
    },
});
