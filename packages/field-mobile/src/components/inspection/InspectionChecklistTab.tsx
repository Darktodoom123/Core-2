import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type { TechnicianInspectionCheck } from '../../types/index';
import { colors } from '../nativeStyles';

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
                        DOLE-OSHC Certified Daily Gauntlet • 48px Glove-Friendly
                        Rockers
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
                            style={[
                                styles.categoryPill,
                                isDarkHud && styles.darkCategoryPill,
                                isActive &&
                                    (isDarkHud
                                        ? styles.darkCategoryPillActive
                                        : styles.categoryPillActive),
                            ]}
                        >
                            <Text
                                style={[
                                    styles.categoryPillText,
                                    isDarkHud && styles.darkCategoryPillText,
                                    isActive &&
                                        (isDarkHud
                                            ? styles.darkCategoryPillTextActive
                                            : styles.categoryPillTextActive),
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
                    <Text style={styles.criticalIcon}>⛔</Text>
                    <View style={styles.criticalCopy}>
                        <Text
                            style={[
                                styles.criticalTitle,
                                isDarkHud && styles.darkCriticalTitle,
                            ]}
                        >
                            CRITICAL DEFECT DETECTED • DISPATCH LOCKOUT
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

            {/* Inspection Checklist Items with 3-State Tactile Rockers */}
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
                                isPass &&
                                    (isDarkHud
                                        ? styles.darkCheckRowPass
                                        : styles.checkRowPass),
                                isAttention &&
                                    (isDarkHud
                                        ? styles.darkCheckRowAttention
                                        : styles.checkRowAttention),
                                isCritical &&
                                    (isDarkHud
                                        ? styles.darkCheckRowCritical
                                        : styles.checkRowCritical),
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
                                    <Text style={styles.checkIcon}>
                                        {item.icon}
                                    </Text>
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
                                                    (isDarkHud
                                                        ? styles.darkStatusAttention
                                                        : styles.statusAttention),
                                                isCritical &&
                                                    (isDarkHud
                                                        ? styles.darkStatusCritical
                                                        : styles.statusCritical),
                                            ]}
                                        >
                                            {item.statusLabel}
                                        </Text>
                                    </View>
                                </View>
                            </Pressable>

                            {/* 3-State Physical-Style Segmented Rocker Controls */}
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
                                        ✓ PASS
                                    </Text>
                                </Pressable>

                                <Pressable
                                    accessibilityLabel={`Mark ${item.label} as Attention`}
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
                                        ⚠ ATTN
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
                                        ⛔ DEFECT
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
        borderColor: colors.borderStrong,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    darkSectionCard: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    headerRow: {
        marginBottom: 12,
    },
    cardHeading: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    darkCardHeading: {
        color: '#F8FAFC',
    },
    cardHelper: {
        color: colors.secondary,
        fontSize: 12,
        marginTop: 2,
    },
    darkCardHelper: {
        color: '#94A3B8',
    },
    categoryRail: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 14,
    },
    categoryPill: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkCategoryPill: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    categoryPillActive: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
    },
    darkCategoryPillActive: {
        backgroundColor: '#78350F',
        borderColor: '#F59E0B',
    },
    categoryPillText: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
    },
    darkCategoryPillText: {
        color: '#94A3B8',
    },
    categoryPillTextActive: {
        color: colors.amberDark,
    },
    darkCategoryPillTextActive: {
        color: '#FBBF24',
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
        backgroundColor: '#7F1D1D',
        borderColor: '#EF4444',
    },
    criticalIcon: {
        fontSize: 20,
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
        color: '#FCA5A5',
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
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 10,
    },
    darkCheckRowContainer: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    checkRowPass: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    darkCheckRowPass: {
        backgroundColor: '#064E3B',
        borderColor: '#059669',
    },
    checkRowAttention: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
    },
    darkCheckRowAttention: {
        backgroundColor: '#451A03',
        borderColor: '#D97706',
    },
    checkRowCritical: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
    },
    darkCheckRowCritical: {
        backgroundColor: '#7F1D1D',
        borderColor: '#EF4444',
    },
    checkHeaderTouch: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    checkLeft: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: 10,
    },
    checkIcon: {
        fontSize: 20,
    },
    checkCopy: {
        flex: 1,
    },
    checkLabel: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    darkCheckLabel: {
        color: '#F8FAFC',
    },
    checkStatus: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
    },
    statusGood: {
        color: colors.greenDark,
    },
    statusAttention: {
        color: colors.warningDark,
    },
    darkStatusAttention: {
        color: '#FBBF24',
    },
    statusCritical: {
        color: colors.redDark,
    },
    darkStatusCritical: {
        color: '#FCA5A5',
    },
    segmentedRockerRail: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 8,
        padding: 3,
        gap: 4,
    },
    darkSegmentedRockerRail: {
        backgroundColor: '#0F172A',
    },
    rockerSegment: {
        flex: 1,
        minHeight: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
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
        fontSize: 11,
        fontWeight: '800',
        color: colors.muted,
    },
    rockerTextPass: {
        color: '#FFFFFF',
    },
    darkRockerTextPass: {
        color: '#0F172A',
    },
    rockerTextAttention: {
        color: '#FFFFFF',
    },
    darkRockerTextAttention: {
        color: '#0F172A',
    },
    rockerTextCritical: {
        color: '#FFFFFF',
    },
    darkRockerTextCritical: {
        color: '#FFFFFF',
    },
    saveButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceDark,
        borderRadius: 10,
        justifyContent: 'center',
        minHeight: 52,
        width: '100%',
    },
    darkSaveButton: {
        backgroundColor: '#10B981',
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    darkSaveButtonText: {
        color: '#0F172A',
    },
    pressed: {
        opacity: 0.85,
    },
});
