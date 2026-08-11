import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, sharedStyles } from '../components/nativeStyles';

export interface InspectionCheckItem {
    id: string;
    label: string;
    status: 'good' | 'attention' | 'fair' | 'pending';
    statusLabel: string;
    icon: string;
}

export const EquipmentInspectionScreen: React.FC = () => {
    const [checks] = useState<InspectionCheckItem[]>([
        {
            id: 'hydraulic',
            label: 'Hydraulic system',
            status: 'attention',
            statusLabel: 'Needs attention',
            icon: '💧',
        },
        {
            id: 'electrical',
            label: 'Electrical system',
            status: 'good',
            statusLabel: 'Good',
            icon: '⚡',
        },
        {
            id: 'tires',
            label: 'Tires & tracks',
            status: 'fair',
            statusLabel: 'Fair',
            icon: '🛞',
        },
        {
            id: 'outriggers',
            label: 'Outriggers & pads',
            status: 'pending',
            statusLabel: 'Pending check',
            icon: '🏗️',
        },
    ]);

    const completedCount = checks.filter((c) => c.status !== 'pending').length;
    const isComplete = completedCount === checks.length;

    return (
        <ScrollView
            accessibilityLabel="Equipment inspection screen"
            contentContainerStyle={styles.container}
        >
            <View style={styles.header}>
                <Text style={styles.pageCategory}>Inspection</Text>
                <Text style={styles.assetTitle}>CRN-07</Text>
                <Text style={styles.assetSubtitle}>50-ton mobile crane</Text>
            </View>

            <View style={styles.checklistCard}>
                <Text accessibilityRole="header" style={styles.cardHeading}>
                    Inspection checks
                </Text>

                {checks.map((item) => {
                    const statusColor =
                        item.status === 'good'
                            ? colors.green
                            : item.status === 'attention'
                              ? colors.red
                              : item.status === 'fair'
                                ? colors.amber
                                : colors.muted;

                    return (
                        <View key={item.id} style={styles.checkRow}>
                            <View style={styles.rowLeft}>
                                <Text style={styles.rowIcon}>{item.icon}</Text>
                                <View>
                                    <Text style={styles.rowLabel}>
                                        {item.label}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.rowStatus,
                                            { color: statusColor },
                                        ]}
                                    >
                                        {item.status === 'attention'
                                            ? '⚠️ '
                                            : item.status === 'good'
                                              ? '✓ '
                                              : ''}
                                        {item.statusLabel}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.chevron}>›</Text>
                        </View>
                    );
                })}
            </View>

            <View style={styles.safetyBlock}>
                <View style={styles.safetyHeader}>
                    <Text style={styles.safetyIcon}>⛔</Text>
                    <View style={styles.safetyTextGroup}>
                        <Text style={styles.safetyTitle}>
                            Equipment cannot be dispatched
                        </Text>
                        <Text style={styles.safetyBody}>
                            Hydraulic leak requires maintenance before site
                            operation.
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.findingsCard}>
                <Text style={styles.findingsTitle}>Findings summary</Text>
                <Text style={styles.findingsBody}>
                    Hydraulic oil leak observed on front right outrigger
                    cylinder. Maintenance ticket #MT-402 open.
                </Text>
            </View>

            <Pressable
                accessibilityLabel="Submit inspection"
                accessibilityRole="button"
                disabled={!isComplete}
                style={[
                    sharedStyles.button,
                    styles.submitButton,
                    !isComplete && styles.disabledButton,
                ]}
            >
                <Text
                    style={[
                        sharedStyles.buttonText,
                        !isComplete && styles.disabledButtonText,
                    ]}
                >
                    Submit inspection
                </Text>
            </Pressable>
            {!isComplete ? (
                <Text style={styles.helperText}>
                    Complete 2 remaining checks before submitting
                </Text>
            ) : null}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        alignSelf: 'center',
        maxWidth: 1040,
        padding: 16,
        paddingBottom: 32,
        width: '100%',
    },
    header: {
        marginBottom: 16,
    },
    pageCategory: {
        color: colors.amber,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    assetTitle: {
        color: colors.text,
        fontSize: 24,
        fontWeight: '800',
        marginTop: 2,
    },
    assetSubtitle: {
        color: colors.secondary,
        fontSize: 14,
        fontWeight: '600',
    },
    checklistCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    cardHeading: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 12,
    },
    checkRow: {
        alignItems: 'center',
        borderColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    rowLeft: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
    },
    rowIcon: {
        fontSize: 20,
    },
    rowLabel: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    rowStatus: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 2,
    },
    chevron: {
        color: colors.muted,
        fontSize: 22,
        fontWeight: '400',
    },
    safetyBlock: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    safetyHeader: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 12,
    },
    safetyIcon: {
        fontSize: 22,
    },
    safetyTextGroup: {
        flex: 1,
    },
    safetyTitle: {
        color: colors.redDark,
        fontSize: 15,
        fontWeight: '800',
    },
    safetyBody: {
        color: colors.redDark,
        fontSize: 13,
        lineHeight: 18,
        marginTop: 4,
    },
    findingsCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    findingsTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 4,
    },
    findingsBody: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
    },
    submitButton: {
        backgroundColor: colors.amber,
        borderRadius: 10,
        minHeight: 48,
    },
    disabledButton: {
        backgroundColor: colors.amberSoft,
        borderColor: colors.amberBorder,
        borderWidth: 1,
    },
    disabledButtonText: {
        color: colors.amberDark,
    },
    helperText: {
        color: colors.secondary,
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    },
});
