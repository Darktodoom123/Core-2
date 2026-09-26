import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { AssetAssignment } from '../../types/index';
import type { DvirScreenProps } from '../DvirScreen';
import { createDvirSharedStyles } from './dvir-shared-styles';

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
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View
            accessibilityLabel="Select assigned equipment"
            accessibilityRole="radiogroup"
            style={[styles.assetSelectorContainer]}
            testID="dvir-asset-selector"
        >
            <Text style={[styles.assetSelectorLabel]}>Assigned Equipment:</Text>
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
                                isSelected && styles.assetPillActive,
                                pressed && dvirSharedStyles.pressed,
                            ]}
                            testID={`dvir-select-asset-${assignment.operational_asset_id}`}
                        >
                            <Text style={[styles.assetPillCode]}>
                                {assignment.asset_code}
                            </Text>
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.assetPillName,
                                    isSelected && styles.assetPillNameActive,
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

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        assetPill: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 8,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 6,
            minHeight: 48,
            paddingHorizontal: 12,
            paddingVertical: 6,
        },
        assetPillActive: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
        },
        assetPillCode: {
            color: theme.textPrimary,
            fontSize: 13,
            fontWeight: '700',
        },
        assetPillName: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '500',
            maxWidth: 160,
        },
        assetPillNameActive: {
            color: theme.textPrimary,
        },
        assetSelectorContainer: {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
            paddingHorizontal: 16,
            paddingVertical: 10,
        },
        assetSelectorLabel: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            marginBottom: 8,
            textTransform: 'uppercase',
        },
        assetSelectorScroll: {
            flexDirection: 'row',
            gap: 8,
        },
    });
