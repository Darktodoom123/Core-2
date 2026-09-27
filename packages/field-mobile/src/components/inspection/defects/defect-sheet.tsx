import React, { useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import type { DesignatedEquipmentType } from '../../../utils/equipmentClassification';
import { getEquipmentPresentation } from '../../../utils/equipmentClassification';
import { Icon } from '../../common/Icon';
import { DefectGroup } from './defect-group';
import { DefectQuickPicks } from './defect-quick-picks';
import { defectGroupsFor } from './defect-sets';
import { DefectSheetFooter } from './defect-sheet-footer';
import { UNIT_TYPES } from './unit-type';
import { UnitTypePicker } from './unit-type-picker';

export interface DefectSheetProps {
    visible: boolean;
    /** Null when the unit's type isn't known yet; the operator is asked. */
    unitType: DesignatedEquipmentType | null;
    assetCode?: string;
    selectedDefectIds: string[];
    onChooseUnitType: (type: DesignatedEquipmentType) => void;
    onApplyDefects: (ids: string[]) => void;
    onClose: () => void;
}

/**
 * Add defects for the assigned unit only. The list, quick picks and search
 * follow the unit's type; there is no switching to other equipment.
 */
export const DefectSheet: React.FC<DefectSheetProps> = (props) =>
    props.visible ? <DefectSheetBody {...props} /> : null;

const DefectSheetBody: React.FC<DefectSheetProps> = ({
    unitType,
    assetCode,
    selectedDefectIds,
    onChooseUnitType,
    onApplyDefects,
    onClose,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [selected, setSelected] = useState<string[]>(selectedDefectIds);
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const groups = useMemo(
        () => (unitType ? defectGroupsFor(unitType) : []),
        [unitType],
    );
    const search = query.trim().toLowerCase();
    const visibleGroups = search
        ? groups
              .map((group) => ({
                  ...group,
                  items: group.items.filter(
                      (item) =>
                          item.label.toLowerCase().includes(search) ||
                          group.title.toLowerCase().includes(search),
                  ),
              }))
              .filter((group) => group.items.length > 0)
        : groups;
    const toggleDefect = (id: string) =>
        setSelected((current) =>
            current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id],
        );

    const title = unitType
        ? getEquipmentPresentation(unitType).modalTitle
        : 'Add defects';

    return (
        <Modal animationType="slide" onRequestClose={onClose} visible>
            <SafeAreaView
                edges={['top', 'bottom']}
                style={styles.root}
                testID="defects-modal-container"
            >
                <View style={styles.header}>
                    <Pressable
                        accessibilityLabel="Close without changing defects"
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={onClose}
                        style={styles.close}
                        testID="defects-modal-close"
                    >
                        <Icon
                            color={theme.textPrimary}
                            name="close"
                            size={20}
                        />
                    </Pressable>
                    <View style={styles.headerText}>
                        <Text
                            accessibilityRole="header"
                            style={styles.title}
                            testID="defects-modal-title"
                        >
                            {title}
                        </Text>
                        <View style={styles.unit} testID="defect-sheet-unit">
                            <Icon
                                color={theme.textSecondary}
                                name={
                                    unitType
                                        ? UNIT_TYPES[unitType].icon
                                        : 'crane'
                                }
                                size={14}
                            />
                            <Text style={styles.unitText}>
                                {[
                                    assetCode,
                                    unitType
                                        ? UNIT_TYPES[unitType].label
                                        : null,
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </Text>
                        </View>
                    </View>
                </View>

                {unitType ? (
                    <>
                        <View style={styles.searchWrap}>
                            <Icon
                                color={theme.textSecondary}
                                name="search"
                                size={18}
                            />
                            <TextInput
                                accessibilityLabel="Search defects"
                                onChangeText={setQuery}
                                placeholder={
                                    getEquipmentPresentation(unitType)
                                        .searchPlaceholder
                                }
                                placeholderTextColor={theme.textSecondary}
                                style={styles.search}
                                testID="defects-search-input"
                                value={query}
                            />
                        </View>
                        <ScrollView
                            contentContainerStyle={styles.content}
                            keyboardShouldPersistTaps="handled"
                        >
                            {search ? null : (
                                <DefectQuickPicks
                                    onToggleDefect={toggleDefect}
                                    selectedIds={selected}
                                    unitType={unitType}
                                />
                            )}
                            {search && visibleGroups.length === 0 ? (
                                <Text style={styles.empty}>
                                    {`No ${UNIT_TYPES[unitType].label.toLowerCase()} defects match “${query.trim()}”.`}
                                </Text>
                            ) : null}
                            {search ? null : (
                                <Text style={styles.sectionLabel}>
                                    ALL CHECKS, IN WALKAROUND ORDER
                                </Text>
                            )}
                            {visibleGroups.map((group) => (
                                <DefectGroup
                                    expanded={
                                        Boolean(search) ||
                                        Boolean(expanded[group.key])
                                    }
                                    group={group}
                                    key={group.key}
                                    onToggleDefect={toggleDefect}
                                    onToggleExpanded={(key) =>
                                        setExpanded((current) => ({
                                            ...current,
                                            [key]: !current[key],
                                        }))
                                    }
                                    selectedIds={selected}
                                />
                            ))}
                        </ScrollView>
                        <DefectSheetFooter
                            count={selected.length}
                            onDone={() => {
                                onApplyDefects(selected);
                                onClose();
                            }}
                        />
                    </>
                ) : (
                    <ScrollView contentContainerStyle={styles.content}>
                        <UnitTypePicker
                            assetCode={assetCode}
                            onChoose={onChooseUnitType}
                        />
                    </ScrollView>
                )}
            </SafeAreaView>
        </Modal>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        root: {
            backgroundColor: theme.canvas,
            flex: 1,
        },
        header: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
            flexDirection: 'row',
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
        },
        close: {
            alignItems: 'center',
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            height: 48,
            justifyContent: 'center',
            width: 48,
        },
        headerText: {
            flex: 1,
            gap: 2,
        },
        title: {
            color: theme.textPrimary,
            fontSize: 18,
            fontWeight: '700',
        },
        unit: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 6,
        },
        unitText: {
            color: theme.textSecondary,
            fontSize: 13,
            fontWeight: '500',
        },
        searchWrap: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            marginHorizontal: 16,
            marginTop: 12,
            minHeight: 48,
            paddingHorizontal: 12,
        },
        search: {
            color: theme.textPrimary,
            flex: 1,
            fontSize: 16,
        },
        content: {
            gap: 12,
            padding: 16,
            paddingBottom: 24,
        },
        sectionLabel: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.6,
            marginTop: 6,
        },
        empty: {
            color: theme.textSecondary,
            fontSize: 15,
            textAlign: 'center',
        },
    });
