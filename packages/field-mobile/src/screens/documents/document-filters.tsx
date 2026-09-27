import React from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { ComplianceDocument } from '../../types/index';
import { CATEGORIES } from './document-catalog';
import type { AssignedAsset, CategoryFilter } from './document-catalog';

export interface AssetSelectorProps {
    assets: AssignedAsset[];
    activeAssetCode: string;
    onSelect: (assetCode: string) => void;
}

export const AssetSelector: React.FC<AssetSelectorProps> = ({
    assets,
    activeAssetCode,
    onSelect,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.assetSelectorSection}>
            <ScrollView
                contentContainerStyle={styles.rail}
                horizontal
                showsHorizontalScrollIndicator={false}
            >
                {assets.map((asset) => {
                    const isSelected = activeAssetCode === asset.assetCode;

                    return (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            key={asset.assetCode}
                            onPress={() => onSelect(asset.assetCode)}
                            style={[
                                styles.chip,
                                isSelected && styles.chipSelected,
                            ]}
                            testID={`asset-selector-${asset.assetCode}`}
                        >
                            <Icon
                                color={
                                    isSelected
                                        ? theme.textPrimary
                                        : theme.textSecondary
                                }
                                name="truck"
                                size={14}
                            />
                            <Text
                                style={[
                                    styles.chipText,
                                    isSelected && styles.chipTextSelected,
                                ]}
                            >
                                {asset.assetCode}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};

export interface DocumentSearchProps {
    value: string;
    onChange: (value: string) => void;
}

export const DocumentSearch: React.FC<DocumentSearchProps> = ({
    value,
    onChange,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.searchSection}>
            <View style={styles.searchInputWrap}>
                <Icon color={theme.textSecondary} name="search" size={16} />
                <TextInput
                    accessibilityLabel="Search documents"
                    onChangeText={onChange}
                    placeholder="Search permits, cert number, or agency..."
                    placeholderTextColor={theme.textMuted}
                    style={styles.searchInput}
                    testID="docs-search-input"
                    value={value}
                />
                {value.length > 0 ? (
                    <Pressable
                        accessibilityLabel="Clear search text"
                        accessibilityRole="button"
                        onPress={() => onChange('')}
                        style={styles.clearBtn}
                    >
                        <Icon
                            color={theme.textSecondary}
                            name="close"
                            size={16}
                        />
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
};

export interface CategoryRailProps {
    documents: ComplianceDocument[];
    selected: CategoryFilter;
    onSelect: (category: CategoryFilter) => void;
}

export const CategoryRail: React.FC<CategoryRailProps> = ({
    documents,
    selected,
    onSelect,
}) => {
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.categoryRailSection}>
            <ScrollView
                contentContainerStyle={styles.rail}
                horizontal
                showsHorizontalScrollIndicator={false}
            >
                {CATEGORIES.map((category) => {
                    const isSelected = selected === category.key;
                    const count =
                        category.key === 'all'
                            ? documents.length
                            : documents.filter(
                                  (doc) => doc.category === category.key,
                              ).length;

                    return (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            key={category.key}
                            onPress={() => onSelect(category.key)}
                            style={({ pressed }) => [
                                styles.chip,
                                isSelected && styles.chipSelected,
                                pressed && styles.pressed,
                            ]}
                            testID={`filter-${category.key}`}
                        >
                            <Text
                                style={[
                                    styles.chipText,
                                    isSelected && styles.chipTextSelected,
                                ]}
                            >
                                {category.label}
                            </Text>
                            <View
                                style={[
                                    styles.countTag,
                                    isSelected && styles.countTagSelected,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.countTagText,
                                        isSelected &&
                                            styles.countTagTextSelected,
                                    ]}
                                >
                                    {count}
                                </Text>
                            </View>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        assetSelectorSection: {
            paddingTop: 12,
        },
        categoryRailSection: {
            paddingBottom: 4,
        },
        rail: {
            gap: 8,
            paddingHorizontal: 16,
        },
        chip: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 24,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            minHeight: 48,
            paddingHorizontal: 14,
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
        countTag: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 10,
            minWidth: 24,
            paddingHorizontal: 6,
            paddingVertical: 1,
        },
        countTagSelected: {
            backgroundColor: theme.brandAmber,
        },
        countTagText: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
        },
        countTagTextSelected: {
            color: theme.surfaceDark,
        },
        pressed: {
            transform: [{ scale: 0.97 }],
        },
        searchSection: {
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        searchInputWrap: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            minHeight: 48,
            paddingLeft: 14,
        },
        searchInput: {
            color: theme.textPrimary,
            flex: 1,
            fontSize: 16,
            minHeight: 48,
        },
        clearBtn: {
            alignItems: 'center',
            height: 48,
            justifyContent: 'center',
            width: 48,
        },
    });
