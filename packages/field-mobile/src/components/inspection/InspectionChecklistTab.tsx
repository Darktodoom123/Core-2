import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TechnicianInspectionCheck } from '../../types/index';
import { colors, sharedStyles } from '../nativeStyles';

export interface InspectionChecklistTabProps {
    checks: TechnicianInspectionCheck[];
    onToggleCheck: (id: string) => void;
    onSaveInspection: () => void;
    isSaved: boolean;
}

export const InspectionChecklistTab: React.FC<InspectionChecklistTabProps> = ({
    checks,
    onToggleCheck,
    onSaveInspection,
    isSaved,
}) => {
    const hasCriticalDefect = checks.some((c) => c.status === 'critical');

    return (
        <View style={styles.sectionCard} testID="checklist-section">
            <Text accessibilityRole="header" style={styles.cardHeading}>
                Asset Safety & Mechanical Inspection
            </Text>
            <Text style={styles.cardHelper}>
                Tap any item to cycle status: Pass (Good) → Needs Attention →
                Critical Defect
            </Text>

            {hasCriticalDefect ? (
                <View
                    style={styles.criticalBanner}
                    testID="critical-defect-banner"
                >
                    <Text style={styles.criticalIcon}>⛔</Text>
                    <View style={styles.criticalCopy}>
                        <Text style={styles.criticalTitle}>
                            CRITICAL DEFECT DETECTED
                        </Text>
                        <Text style={styles.criticalBody}>
                            Asset is locked from dispatch until defect is
                            resolved and work order closed.
                        </Text>
                    </View>
                </View>
            ) : null}

            <View style={styles.checkList}>
                {checks.map((item) => {
                    const isPass = item.status === 'good';
                    const isAttention = item.status === 'attention';
                    const isCritical = item.status === 'critical';

                    return (
                        <Pressable
                            key={item.id}
                            accessibilityLabel={`${item.label}: ${item.statusLabel}`}
                            accessibilityRole="button"
                            onPress={() => onToggleCheck(item.id)}
                            style={({ pressed }) => [
                                styles.checkRow,
                                isPass && styles.checkRowPass,
                                isAttention && styles.checkRowAttention,
                                isCritical && styles.checkRowCritical,
                                pressed && styles.pressed,
                            ]}
                            testID={`check-item-${item.id}`}
                        >
                            <View style={styles.checkLeft}>
                                <Text style={styles.checkIcon}>
                                    {item.icon}
                                </Text>
                                <View style={styles.checkCopy}>
                                    <Text style={styles.checkLabel}>
                                        {item.label}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.checkStatus,
                                            isPass && styles.statusGood,
                                            isAttention &&
                                                styles.statusAttention,
                                            isCritical && styles.statusCritical,
                                        ]}
                                    >
                                        {item.statusLabel}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.cycleBadge}>
                                <Text style={styles.cycleBadgeText}>
                                    Tap to change
                                </Text>
                            </View>
                        </Pressable>
                    );
                })}
            </View>

            <Pressable
                accessibilityLabel="Save asset inspection results"
                accessibilityRole="button"
                onPress={onSaveInspection}
                style={({ pressed }) => [
                    sharedStyles.button,
                    styles.saveButton,
                    pressed && styles.pressed,
                ]}
                testID="save-inspection-btn"
            >
                <Text style={sharedStyles.buttonText}>
                    {isSaved
                        ? '✓ Inspection Saved to Outbox'
                        : 'Save Inspection Checklist'}
                </Text>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    sectionCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    cardHeading: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
    },
    cardHelper: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 12,
        marginTop: 4,
    },
    criticalBanner: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
        padding: 12,
    },
    criticalIcon: {
        fontSize: 20,
    },
    criticalCopy: {
        flex: 1,
    },
    criticalTitle: {
        color: colors.redDark,
        fontSize: 13,
        fontWeight: '900',
    },
    criticalBody: {
        color: colors.redDark,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    checkList: {
        gap: 8,
        marginBottom: 16,
    },
    checkRow: {
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 56,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    checkRowPass: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    checkRowAttention: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
    },
    checkRowCritical: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
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
    statusCritical: {
        color: colors.redDark,
    },
    cycleBadge: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    cycleBadgeText: {
        color: colors.secondary,
        fontSize: 10,
        fontWeight: '800',
    },
    saveButton: {
        backgroundColor: colors.amber,
        minHeight: 48,
        width: '100%',
    },
    pressed: {
        opacity: 0.78,
    },
});
