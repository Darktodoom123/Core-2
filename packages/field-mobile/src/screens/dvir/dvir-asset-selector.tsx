import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../components/nativeStyles';
import { useTheme } from '../../theme';
import type { AssetAssignment } from '../../types/index';
import type { DvirScreenProps } from '../DvirScreen';
import { dvirSharedStyles } from './dvir-shared-styles';

export interface DvirAssetSelectorProps {
    activeSelectedAssetId: number | null;
    assetAssignments: AssetAssignment[];
    onSelectAsset: DvirScreenProps['onSelectAsset'];
    setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
    setUncontrolledAssetId: React.Dispatch<React.SetStateAction<number | null>>;
    setUserSelectedAssetId: React.Dispatch<React.SetStateAction<number | null>>;
}

export const DvirAssetSelector: React.FC<DvirAssetSelectorProps> = ({
    activeSelectedAssetId,
    assetAssignments,
    onSelectAsset,
    setIsSaved,
    setUncontrolledAssetId,
    setUserSelectedAssetId,
}) => {
    const { isDarkHud } = useTheme();

    return (
        <View
            accessibilityLabel="Select assigned equipment"
            accessibilityRole="radiogroup"
            style={[
                styles.assetSelectorContainer,
                isDarkHud && styles.darkAssetSelectorContainer,
            ]}
            testID="dvir-asset-selector"
        >
            <Text
                style={[
                    styles.assetSelectorLabel,
                    isDarkHud && styles.darkAssetSelectorLabel,
                ]}
            >
                Assigned Equipment:
            </Text>
            <ScrollView
                contentContainerStyle={styles.assetSelectorScroll}
                horizontal
                showsHorizontalScrollIndicator={false}
            >
                {assetAssignments.map((assignment) => {
                    const isSelected =
                        assignment.operational_asset_id ===
                        activeSelectedAssetId;

                    return (
                        <Pressable
                            key={assignment.operational_asset_id}
                            accessibilityLabel={`Select ${assignment.asset_code} ${assignment.asset_name}`}
                            accessibilityRole="radio"
                            accessibilityState={{
                                selected: isSelected,
                            }}
                            onPress={() => {
                                setUserSelectedAssetId(
                                    assignment.operational_asset_id,
                                );
                                setUncontrolledAssetId(
                                    assignment.operational_asset_id,
                                );
                                onSelectAsset?.(
                                    assignment.operational_asset_id,
                                );
                                setIsSaved(false);
                            }}
                            style={({ pressed }) => [
                                styles.assetPill,
                                isDarkHud && styles.darkAssetPill,
                                isSelected && styles.assetPillActive,
                                isDarkHud &&
                                    isSelected &&
                                    styles.darkAssetPillActive,
                                pressed && dvirSharedStyles.pressed,
                            ]}
                            testID={`dvir-select-asset-${assignment.operational_asset_id}`}
                        >
                            <Text
                                style={[
                                    styles.assetPillCode,
                                    isDarkHud && styles.darkAssetPillCode,
                                    isSelected && styles.assetPillCodeActive,
                                    isDarkHud &&
                                        isSelected &&
                                        styles.darkAssetPillCodeActive,
                                ]}
                            >
                                {assignment.asset_code}
                            </Text>
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.assetPillName,
                                    isDarkHud && styles.darkAssetPillName,
                                    isSelected && styles.assetPillNameActive,
                                    isDarkHud &&
                                        isSelected &&
                                        styles.darkAssetPillNameActive,
                                ]}
                            >
                                {assignment.asset_name}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    assetPill: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    assetPillActive: {
        backgroundColor: colors.amberDark,
        borderColor: colors.amberDark,
    },
    assetPillCode: {
        color: colors.amber,
        fontSize: 13,
        fontWeight: '800',
    },
    assetPillCodeActive: {
        color: '#FFFFFF',
    },
    assetPillName: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '500',
        maxWidth: 160,
    },
    assetPillNameActive: {
        color: '#FFFFFF',
    },
    assetSelectorContainer: {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    assetSelectorLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    assetSelectorScroll: {
        flexDirection: 'row',
        gap: 8,
    },
    darkAssetPill: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    darkAssetPillActive: {
        backgroundColor: colors.hudAmber,
        borderColor: colors.hudAmber,
    },
    darkAssetPillCode: {
        color: colors.hudText,
    },
    darkAssetPillCodeActive: {
        color: colors.surfaceDark,
    },
    darkAssetPillName: {
        color: colors.hudTextDim,
    },
    darkAssetPillNameActive: {
        color: colors.surfaceDark,
    },
    darkAssetSelectorContainer: {
        backgroundColor: colors.hudSurface,
        borderBottomColor: colors.hudBorder,
    },
    darkAssetSelectorLabel: {
        color: colors.hudTextDim,
    },
});
