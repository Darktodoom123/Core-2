import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import { Icon } from '../../common/Icon';
import { DefectRow } from './defect-row';
import { groupDisplayTitle } from './defect-sets';
import type { DefectCategoryGroup } from './defect-types';

export interface DefectGroupProps {
    group: DefectCategoryGroup;
    expanded: boolean;
    selectedIds: string[];
    onToggleExpanded: (key: string) => void;
    onToggleDefect: (id: string) => void;
}

/** A collapsible area of the unit, showing how many defects are chosen in it. */
export const DefectGroup: React.FC<DefectGroupProps> = ({
    group,
    expanded,
    selectedIds,
    onToggleExpanded,
    onToggleDefect,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const chosen = group.items.filter((item) =>
        selectedIds.includes(item.id),
    ).length;

    return (
        <View style={styles.card} testID={`category-section-${group.key}`}>
            <Pressable
                accessibilityLabel={`${groupDisplayTitle(group)}, ${group.items.length} checks${chosen ? `, ${chosen} chosen` : ''}`}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                android_ripple={{ color: theme.border }}
                onPress={() => onToggleExpanded(group.key)}
                style={styles.header}
                testID={`category-toggle-${group.key}`}
            >
                <Text style={styles.title}>{groupDisplayTitle(group)}</Text>
                {chosen > 0 ? (
                    <View style={styles.count}>
                        <Text style={styles.countText}>{chosen} chosen</Text>
                    </View>
                ) : (
                    <Text style={styles.total}>{group.items.length}</Text>
                )}
                <Icon
                    color={theme.textSecondary}
                    name={expanded ? 'chevron-down' : 'chevron-right'}
                    size={18}
                />
            </Pressable>
            {expanded
                ? group.items.map((item) => (
                      <DefectRow
                          checked={selectedIds.includes(item.id)}
                          item={item}
                          key={item.id}
                          onToggle={onToggleDefect}
                      />
                  ))
                : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        card: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 14,
            borderWidth: 1,
            overflow: 'hidden',
        },
        header: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 10,
            minHeight: 56,
            paddingHorizontal: 14,
        },
        title: {
            color: theme.textPrimary,
            flex: 1,
            fontSize: 16,
            fontWeight: '700',
        },
        total: {
            color: theme.textSecondary,
            fontSize: 13,
        },
        // Selection count uses Signal Gold Soft (selection, not action).
        count: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: 8,
            paddingVertical: 2,
        },
        countText: {
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
        },
    });
