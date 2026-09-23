import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type {
    MaintenanceWorkOrder,
    TechnicianInspectionCheck,
} from '../../types/index';
import { colors, shadows } from '../nativeStyles';

export interface InspectionChecklistTabProps {
    checks: TechnicianInspectionCheck[];
    onToggleCheck: (id: string) => void;
    onSaveInspection: () => void;
    isSaved: boolean;
    onOpenDvir?: () => void;
    onSetCheckStatus?: (
        id: string,
        status: 'good' | 'attention' | 'critical',
    ) => void;
    selectedWorkOrder?: MaintenanceWorkOrder | null;
    availableWorkOrders?: MaintenanceWorkOrder[];
    onSelectWorkOrder?: (woId: string) => void;
    onBackToWorkOrders?: () => void;
}

export const InspectionChecklistTab: React.FC<InspectionChecklistTabProps> = ({
    checks,
    onToggleCheck,
    onSaveInspection,
    isSaved,
    onOpenDvir,
    onSetCheckStatus,
    selectedWorkOrder,
    onBackToWorkOrders,
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
            {/* Canonical DVIR Redirect Card for routine inspections */}
            <View
                style={[
                    styles.canonicalDvirCard,
                    isDarkHud && styles.darkCanonicalDvirCard,
                ]}
                testID="canonical-dvir-redirect-card"
            >
                <View style={styles.canonicalDvirTextWrap}>
                    <Text
                        style={[
                            styles.canonicalDvirTitle,
                            isDarkHud && styles.darkCanonicalDvirTitle,
                        ]}
                    >
                        Routine Daily Inspection
                    </Text>
                    <Text
                        style={[
                            styles.canonicalDvirSubtitle,
                            isDarkHud && styles.darkCanonicalDvirSubtitle,
                        ]}
                    >
                        Daily Pre-Trip & Post-Trip operator inspections have
                        moved to Create DVIR.
                    </Text>
                </View>
                {onOpenDvir ? (
                    <Pressable
                        accessibilityLabel="Open Create DVIR"
                        accessibilityRole="button"
                        onPress={onOpenDvir}
                        style={({ pressed }) => [
                            styles.openDvirBtn,
                            isDarkHud && styles.darkOpenDvirBtn,
                            pressed && styles.pressed,
                        ]}
                        testID="open-canonical-dvir-btn"
                    >
                        <Text
                            style={[
                                styles.openDvirBtnText,
                                isDarkHud && styles.darkOpenDvirBtnText,
                            ]}
                        >
                            Open Create DVIR
                        </Text>
                    </Pressable>
                ) : null}
            </View>

            <View style={styles.headerRow}>
                <View>
                    <Text
                        accessibilityRole="header"
                        style={[
                            styles.cardHeading,
                            isDarkHud && styles.darkCardHeading,
                        ]}
                    >
                        POST-REPAIR SAFETY & MECHANICAL VERIFICATION
                    </Text>
                    <Text
                        style={[
                            styles.cardHelper,
                            isDarkHud && styles.darkCardHelper,
                        ]}
                    >
                        Work-Order Linked Verification Required for Safe Release
                    </Text>
                </View>
            </View>

            {/* Linked Work Order Status Banner */}
            {selectedWorkOrder ? (
                <View
                    style={[
                        styles.linkedWoBanner,
                        isDarkHud && styles.darkLinkedWoBanner,
                    ]}
                    testID="linked-work-order-badge"
                >
                    <View style={styles.linkedWoTextWrap}>
                        <Text
                            style={[
                                styles.linkedWoTag,
                                isDarkHud && styles.darkLinkedWoTag,
                            ]}
                        >
                            LINKED WORK ORDER (REPAIRED)
                        </Text>
                        <Text
                            style={[
                                styles.linkedWoTitle,
                                isDarkHud && styles.darkLinkedWoTitle,
                            ]}
                        >
                            {selectedWorkOrder.id}:{' '}
                            {selectedWorkOrder.defectTitle}
                        </Text>
                        <Text
                            style={[
                                styles.linkedWoSubtitle,
                                isDarkHud && styles.darkLinkedWoSubtitle,
                            ]}
                        >
                            Status: REPAIRED · Post-repair sign-off required for
                            release
                        </Text>
                    </View>
                    {onBackToWorkOrders ? (
                        <Pressable
                            accessibilityLabel="Change linked work order"
                            accessibilityRole="button"
                            onPress={onBackToWorkOrders}
                            style={({ pressed }) => [
                                styles.changeWoBtn,
                                isDarkHud && styles.darkChangeWoBtn,
                                pressed && styles.pressed,
                            ]}
                            testID="change-work-order-btn"
                        >
                            <Text
                                style={[
                                    styles.changeWoBtnText,
                                    isDarkHud && styles.darkChangeWoBtnText,
                                ]}
                            >
                                Change
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : (
                <View
                    style={[
                        styles.noWoBanner,
                        isDarkHud && styles.darkNoWoBanner,
                    ]}
                    testID="no-work-order-banner"
                >
                    <View style={styles.noWoTextWrap}>
                        <Text
                            style={[
                                styles.noWoTitle,
                                isDarkHud && styles.darkNoWoTitle,
                            ]}
                        >
                            No Repaired Work Order Selected
                        </Text>
                        <Text
                            style={[
                                styles.noWoSubtitle,
                                isDarkHud && styles.darkNoWoSubtitle,
                            ]}
                        >
                            Post-repair verification requires a completed repair
                            work order. Select a repaired work order to proceed.
                        </Text>
                    </View>
                    {onBackToWorkOrders ? (
                        <Pressable
                            accessibilityLabel="Go to work orders"
                            accessibilityRole="button"
                            onPress={onBackToWorkOrders}
                            style={({ pressed }) => [
                                styles.goToWoBtn,
                                isDarkHud && styles.darkGoToWoBtn,
                                pressed && styles.pressed,
                            ]}
                            testID="go-to-work-orders-btn"
                        >
                            <Text
                                style={[
                                    styles.goToWoBtnText,
                                    isDarkHud && styles.darkGoToWoBtnText,
                                ]}
                            >
                                View Work Orders
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            )}

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
                accessibilityState={{ disabled: !selectedWorkOrder }}
                disabled={!selectedWorkOrder}
                onPress={selectedWorkOrder ? onSaveInspection : undefined}
                style={({ pressed }) => [
                    styles.saveButton,
                    isDarkHud && styles.darkSaveButton,
                    !selectedWorkOrder && styles.saveButtonDisabled,
                    isDarkHud &&
                        !selectedWorkOrder &&
                        styles.darkSaveButtonDisabled,
                    pressed && selectedWorkOrder && styles.pressed,
                ]}
                testID="save-inspection-btn"
            >
                <Text
                    style={[
                        styles.saveButtonText,
                        isDarkHud && styles.darkSaveButtonText,
                        !selectedWorkOrder && styles.saveButtonDisabledText,
                    ]}
                >
                    {isSaved
                        ? '✓ Inspection Saved & Synchronized'
                        : selectedWorkOrder
                          ? 'SAVE POST-REPAIR INSPECTION'
                          : 'SELECT REPAIRED WORK ORDER TO SAVE'}
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
        backgroundColor: colors.primary,
        borderColor: colors.primaryBorder,
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
        backgroundColor: 'rgba(255, 191, 0, 0.12)',
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
        color: '#FFBF00',
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
        backgroundColor: colors.primary,
    },
    darkRockerSegmentAttention: {
        backgroundColor: '#FFBF00',
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
        backgroundColor: colors.primary,
        borderRadius: 10,
        justifyContent: 'center',
        minHeight: 50,
        width: '100%',
    },
    darkSaveButton: {
        backgroundColor: colors.hudAmber,
    },
    saveButtonText: {
        color: '#0F172A',
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
    canonicalDvirCard: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
        marginBottom: 16,
        padding: 14,
    },
    darkCanonicalDvirCard: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    canonicalDvirTextWrap: {
        flex: 1,
    },
    canonicalDvirTitle: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    darkCanonicalDvirTitle: {
        color: colors.hudText,
    },
    canonicalDvirSubtitle: {
        color: colors.muted,
        fontSize: 11,
        lineHeight: 15,
        marginTop: 2,
    },
    darkCanonicalDvirSubtitle: {
        color: colors.hudTextDim,
    },
    openDvirBtn: {
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: 8,
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    darkOpenDvirBtn: {
        backgroundColor: colors.hudAmber,
    },
    openDvirBtnText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '700',
    },
    darkOpenDvirBtnText: {
        color: colors.surfaceDark,
        fontSize: 12,
        fontWeight: '800',
    },
    linkedWoBanner: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
        marginBottom: 14,
        padding: 12,
    },
    darkLinkedWoBanner: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    linkedWoTextWrap: {
        flex: 1,
    },
    linkedWoTag: {
        color: colors.blueDark,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    darkLinkedWoTag: {
        color: '#60A5FA',
    },
    linkedWoTitle: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
        marginTop: 2,
    },
    darkLinkedWoTitle: {
        color: colors.hudText,
    },
    linkedWoSubtitle: {
        color: colors.secondary,
        fontSize: 11,
        marginTop: 2,
    },
    darkLinkedWoSubtitle: {
        color: colors.hudTextDim,
    },
    changeWoBtn: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkChangeWoBtn: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
    },
    changeWoBtnText: {
        color: colors.text,
        fontSize: 11,
        fontWeight: '700',
    },
    darkChangeWoBtnText: {
        color: colors.hudText,
    },
    noWoBanner: {
        alignItems: 'center',
        backgroundColor: '#FFF3C4',
        borderColor: '#FFBF00',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
        marginBottom: 14,
        padding: 12,
    },
    darkNoWoBanner: {
        backgroundColor: 'rgba(255, 191, 0, 0.15)',
        borderColor: 'rgba(255, 191, 0, 0.4)',
    },
    noWoTextWrap: {
        flex: 1,
    },
    noWoTitle: {
        color: '#806000',
        fontSize: 13,
        fontWeight: '700',
    },
    darkNoWoTitle: {
        color: '#FFBF00',
    },
    noWoSubtitle: {
        color: '#806000',
        fontSize: 11,
        marginTop: 2,
    },
    darkNoWoSubtitle: {
        color: colors.hudTextDim,
    },
    goToWoBtn: {
        backgroundColor: '#FFBF00',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkGoToWoBtn: {
        backgroundColor: '#332800',
    },
    goToWoBtnText: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '700',
    },
    darkGoToWoBtnText: {
        color: '#FFFFFF',
    },
    saveButtonDisabled: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
        opacity: 0.6,
    },
    darkSaveButtonDisabled: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
        opacity: 0.5,
    },
    saveButtonDisabledText: {
        color: colors.muted,
    },
});
