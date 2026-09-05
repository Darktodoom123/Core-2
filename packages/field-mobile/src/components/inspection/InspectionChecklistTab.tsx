import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type { TechnicianInspectionCheck } from '../../types/index';
import { colors, shadows } from '../nativeStyles';

export interface InspectionChecklistTabProps {
    checks: TechnicianInspectionCheck[];
    onToggleCheck: (id: string) => void;
    onSaveInspection: () => void;
    isSaved: boolean;
    onSetCheckStatus?: (
        id: string,
        status: 'good' | 'attention' | 'critical',
    ) => void;
}

export const InspectionChecklistTab: React.FC<InspectionChecklistTabProps> = ({
    checks,
    onToggleCheck,
    onSaveInspection,
    isSaved,
    onSetCheckStatus,
}) => {
    const { isDarkHud } = useTheme();
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const hasCriticalDefect = checks.some((c) => c.status === 'critical');

    const categories = [
        { key: 'all', label: `ALL (${checks.length})` },
        {
            key: 'hydraulics',
            label: `HYDRAULICS (${checks.filter((c) => c.category === 'hydraulics').length})`,
        },
        {
            key: 'structural',
            label: `STRUCTURAL (${checks.filter((c) => c.category === 'structural').length})`,
        },
        {
            key: 'electrical',
            label: `ELECTRICAL (${checks.filter((c) => c.category === 'electrical').length})`,
        },
        {
            key: 'tires_tracks',
            label: `TIRES (${checks.filter((c) => c.category === 'tires_tracks').length})`,
        },
    ];

    const filteredChecks =
        selectedCategory === 'all'
            ? checks
            : checks.filter((c) => c.category === selectedCategory);

    return (
        <View
            style={[styles.sectionCard, isDarkHud && styles.darkSectionCard]}
            testID="checklist-section"
        >
            <View style={styles.headerRow}>
                <View>
                    <Text
                        accessibilityRole="header"
                        style={[
                            styles.cardHeading,
                            isDarkHud && styles.darkCardHeading,
                        ]}
                    >
                        PRE-OP SAFETY & MECHANICAL INSPECTION
                    </Text>
                    <Text
                        style={[
                            styles.cardHelper,
                            isDarkHud && styles.darkCardHelper,
                        ]}
                    >
                        DOLE-OSHC Certified Daily Pre-Operational Inspection
                    </Text>
                </View>
            </View>

            {/* Horizontal Category Selector Rail */}
            <View style={styles.categoryRail}>
                {categories.map((cat) => {
                    const isActive = selectedCategory === cat.key;

                    return (
                        <Pressable
                            key={cat.key}
                            accessibilityRole="button"
                            onPress={() => setSelectedCategory(cat.key)}
                            style={({ pressed }) => [
                                styles.categoryPill,
                                isDarkHud && styles.darkCategoryPill,
                                isActive && styles.categoryPillActive,
                                isDarkHud &&
                                    isActive &&
                                    styles.darkCategoryPillActive,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.categoryPillText,
                                    isDarkHud && styles.darkCategoryPillText,
                                    isActive && styles.categoryPillTextActive,
                                    isDarkHud &&
                                        isActive &&
                                        styles.darkCategoryPillTextActive,
                                ]}
                            >
                                {cat.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {hasCriticalDefect ? (
                <View
                    style={[
                        styles.criticalBanner,
                        isDarkHud && styles.darkCriticalBanner,
                    ]}
                    testID="critical-defect-banner"
                >
                    <View style={styles.criticalCopy}>
                        <Text
                            style={[
                                styles.criticalTitle,
                                isDarkHud && styles.darkCriticalTitle,
                            ]}
                        >
                            CRITICAL DEFECT DETECTED · DISPATCH LOCKOUT
                        </Text>
                        <Text
                            style={[
                                styles.criticalBody,
                                isDarkHud && styles.darkCriticalBody,
                            ]}
                        >
                            Asset is locked from field dispatch until defect is
                            verified and work order is signed off.
                        </Text>
                    </View>
                </View>
            ) : null}

            {/* Checklist items container */}
            <View style={styles.checkList}>
                {filteredChecks.map((item) => {
                    const isPass = item.status === 'good';
                    const isAttention = item.status === 'attention';
                    const isCritical = item.status === 'critical';

                    return (
                        <View
                            key={item.id}
                            style={[
                                styles.checkRowContainer,
                                isDarkHud && styles.darkCheckRowContainer,
                                isPass && styles.checkRowPass,
                                isDarkHud && isPass && styles.darkCheckRowPass,
                                isAttention && styles.checkRowAttention,
                                isDarkHud &&
                                    isAttention &&
                                    styles.darkCheckRowAttention,
                                isCritical && styles.checkRowCritical,
                                isDarkHud &&
                                    isCritical &&
                                    styles.darkCheckRowCritical,
                            ]}
                        >
                            <Pressable
                                accessibilityLabel={`${item.label}: ${item.statusLabel}`}
                                accessibilityRole="button"
                                onPress={() => onToggleCheck(item.id)}
                                style={({ pressed }) => [
                                    styles.checkHeaderTouch,
                                    pressed && styles.pressed,
                                ]}
                                testID={`check-item-${item.id}`}
                            >
                                <View style={styles.checkLeft}>
                                    {item.icon ? (
                                        <Text style={styles.checkIcon}>
                                            {item.icon}
                                        </Text>
                                    ) : null}
                                    <View style={styles.checkCopy}>
                                        <Text
                                            style={[
                                                styles.checkLabel,
                                                isDarkHud &&
                                                    styles.darkCheckLabel,
                                            ]}
                                        >
                                            {item.label}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.checkStatus,
                                                isPass && styles.statusGood,
                                                isAttention &&
                                                    styles.statusAttention,
                                                isDarkHud &&
                                                    isAttention &&
                                                    styles.darkStatusAttention,
                                                isCritical &&
                                                    styles.statusCritical,
                                                isDarkHud &&
                                                    isCritical &&
                                                    styles.darkStatusCritical,
                                            ]}
                                        >
                                            {item.statusLabel}
                                        </Text>
                                    </View>
                                </View>
                            </Pressable>

                            {/* Glove-Friendly Tri-State Rocker Segmented Control */}
                            <View
                                style={[
                                    styles.segmentedRockerRail,
                                    isDarkHud && styles.darkSegmentedRockerRail,
                                ]}
                            >
                                <Pressable
                                    accessibilityLabel={`Mark ${item.label} as Pass`}
                                    accessibilityRole="button"
                                    onPress={() => {
                                        if (onSetCheckStatus) {
                                            onSetCheckStatus(item.id, 'good');
                                        } else {
                                            if (!isPass) {
                                                onToggleCheck(item.id);
                                            }
                                        }
                                    }}
                                    style={[
                                        styles.rockerSegment,
                                        isPass && styles.rockerSegmentPass,
                                        isDarkHud &&
                                            isPass &&
                                            styles.darkRockerSegmentPass,
                                    ]}
                                    testID={`rocker-pass-${item.id}`}
                                >
                                    <Text
                                        style={[
                                            styles.rockerText,
                                            isPass && styles.rockerTextPass,
                                            isDarkHud &&
                                                isPass &&
                                                styles.darkRockerTextPass,
                                        ]}
                                    >
                                        PASS
                                    </Text>
                                </Pressable>

                                <Pressable
                                    accessibilityLabel={`Mark ${item.label} as Attention Needed`}
                                    accessibilityRole="button"
                                    onPress={() => {
                                        if (onSetCheckStatus) {
                                            onSetCheckStatus(
                                                item.id,
                                                'attention',
                                            );
                                        } else {
                                            if (!isAttention) {
                                                onToggleCheck(item.id);
                                            }
                                        }
                                    }}
                                    style={[
                                        styles.rockerSegment,
                                        isAttention &&
                                            styles.rockerSegmentAttention,
                                        isDarkHud &&
                                            isAttention &&
                                            styles.darkRockerSegmentAttention,
                                    ]}
                                    testID={`rocker-attn-${item.id}`}
                                >
                                    <Text
                                        style={[
                                            styles.rockerText,
                                            isAttention &&
                                                styles.rockerTextAttention,
                                            isDarkHud &&
                                                isAttention &&
                                                styles.darkRockerTextAttention,
                                        ]}
                                    >
                                        ATTN
                                    </Text>
                                </Pressable>

                                <Pressable
                                    accessibilityLabel={`Mark ${item.label} as Critical Defect`}
                                    accessibilityRole="button"
                                    onPress={() => {
                                        if (onSetCheckStatus) {
                                            onSetCheckStatus(
                                                item.id,
                                                'critical',
                                            );
                                        } else {
                                            if (!isCritical) {
                                                onToggleCheck(item.id);
                                            }
                                        }
                                    }}
                                    style={[
                                        styles.rockerSegment,
                                        isCritical &&
                                            styles.rockerSegmentCritical,
                                        isDarkHud &&
                                            isCritical &&
                                            styles.darkRockerSegmentCritical,
                                    ]}
                                    testID={`rocker-defect-${item.id}`}
                                >
                                    <Text
                                        style={[
                                            styles.rockerText,
                                            isCritical &&
                                                styles.rockerTextCritical,
                                            isDarkHud &&
                                                isCritical &&
                                                styles.darkRockerTextCritical,
                                        ]}
                                    >
                                        DEFECT
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    );
                })}
            </View>

            {/* 52px Primary Action Button */}
            <Pressable
                accessibilityLabel="Save asset inspection results"
                accessibilityRole="button"
                onPress={onSaveInspection}
                style={({ pressed }) => [
                    styles.saveButton,
                    isDarkHud && styles.darkSaveButton,
                    pressed && styles.pressed,
                ]}
                testID="save-inspection-btn"
            >
                <Text
                    style={[
                        styles.saveButtonText,
                        isDarkHud && styles.darkSaveButtonText,
                    ]}
                >
                    {isSaved
                        ? '✓ Inspection Saved & Synchronized'
                        : 'SAVE INSPECTION CHECKLIST'}
                </Text>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    sectionCard: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        marginBottom: 16,
        padding: 16,
        ...shadows.sm,
    },
    darkSectionCard: {
        backgroundColor: colors.hudSurface,
        shadowColor: 'transparent',
    },
    headerRow: {
        marginBottom: 12,
    },
    cardHeading: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    darkCardHeading: {
        color: colors.hudText,
    },
    cardHelper: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 2,
    },
    darkCardHelper: {
        color: colors.hudTextDim,
    },
    categoryRail: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 14,
    },
    categoryPill: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkCategoryPill: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    categoryPillActive: {
        backgroundColor: colors.amber,
        borderColor: colors.amber,
    },
    darkCategoryPillActive: {
        backgroundColor: colors.hudAmber,
        borderColor: colors.hudAmber,
    },
    categoryPillText: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
    },
    darkCategoryPillText: {
        color: colors.hudTextDim,
    },
    categoryPillTextActive: {
        color: '#FFFFFF',
    },
    darkCategoryPillTextActive: {
        color: colors.surfaceDark,
    },
    criticalBanner: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        marginBottom: 14,
        padding: 12,
    },
    darkCriticalBanner: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: '#DC2626',
    },
    criticalCopy: {
        flex: 1,
    },
    criticalTitle: {
        color: colors.redDark,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    darkCriticalTitle: {
        color: '#F87171',
    },
    criticalBody: {
        color: colors.redDark,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    darkCriticalBody: {
        color: '#FECACA',
    },
    checkList: {
        gap: 10,
        marginBottom: 16,
    },
    checkRowContainer: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        padding: 12,
    },
    darkCheckRowContainer: {
        backgroundColor: colors.surfaceDark,
    },
    checkRowPass: {
        backgroundColor: colors.greenLight,
    },
    darkCheckRowPass: {
        backgroundColor: 'rgba(5, 150, 105, 0.12)',
    },
    checkRowAttention: {
        backgroundColor: colors.amberLight,
    },
    darkCheckRowAttention: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
    },
    checkRowCritical: {
        backgroundColor: colors.redLight,
    },
    darkCheckRowCritical: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
    },
    checkHeaderTouch: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    checkLeft: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: 10,
    },
    checkIcon: {
        fontSize: 18,
    },
    checkCopy: {
        flex: 1,
    },
    checkLabel: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    darkCheckLabel: {
        color: colors.hudText,
    },
    checkStatus: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    statusGood: {
        color: colors.greenDark,
    },
    statusAttention: {
        color: colors.amberDark,
    },
    darkStatusAttention: {
        color: '#FBBF24',
    },
    statusCritical: {
        color: colors.redDark,
    },
    darkStatusCritical: {
        color: '#F87171',
    },
    segmentedRockerRail: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 4,
        padding: 3,
    },
    darkSegmentedRockerRail: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    rockerSegment: {
        alignItems: 'center',
        borderRadius: 6,
        flex: 1,
        justifyContent: 'center',
        minHeight: 38,
    },
    rockerSegmentPass: {
        backgroundColor: colors.green,
    },
    darkRockerSegmentPass: {
        backgroundColor: '#10B981',
    },
    rockerSegmentAttention: {
        backgroundColor: colors.amber,
    },
    darkRockerSegmentAttention: {
        backgroundColor: '#F59E0B',
    },
    rockerSegmentCritical: {
        backgroundColor: colors.red,
    },
    darkRockerSegmentCritical: {
        backgroundColor: '#EF4444',
    },
    rockerText: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '800',
    },
    rockerTextPass: {
        color: '#FFFFFF',
    },
    darkRockerTextPass: {
        color: colors.surfaceDark,
    },
    rockerTextAttention: {
        color: '#FFFFFF',
    },
    darkRockerTextAttention: {
        color: colors.surfaceDark,
    },
    rockerTextCritical: {
        color: '#FFFFFF',
    },
    darkRockerTextCritical: {
        color: '#FFFFFF',
    },
    saveButton: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 10,
        justifyContent: 'center',
        minHeight: 50,
        width: '100%',
    },
    darkSaveButton: {
        backgroundColor: colors.hudAmber,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    darkSaveButtonText: {
        color: colors.surfaceDark,
    },
    pressed: {
        opacity: 0.85,
    },
});
