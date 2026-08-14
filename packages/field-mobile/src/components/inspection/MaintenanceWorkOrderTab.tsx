import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type {
    MaintenanceSeverity,
    MaintenanceWorkOrder,
} from '../../types/index';
import { colors, sharedStyles } from '../nativeStyles';

export interface MaintenanceWorkOrderTabProps {
    assetCode: string;
    assetName: string;
    technicianName: string;
    workOrders: MaintenanceWorkOrder[];
    onLogWorkOrder: (workOrder: MaintenanceWorkOrder) => void;
}

export const MaintenanceWorkOrderTab: React.FC<
    MaintenanceWorkOrderTabProps
> = ({ assetCode, assetName, technicianName, workOrders, onLogWorkOrder }) => {
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [severity, setSeverity] = useState<MaintenanceSeverity>('minor');
    const [feedback, setFeedback] = useState<string | null>(null);

    const handleCreate = () => {
        if (!title.trim()) {
            return;
        }

        const newOrder: MaintenanceWorkOrder = {
            id: `WO-${Math.floor(1000 + Math.random() * 9000)}`,
            assetCode,
            assetName,
            defectTitle: title.trim(),
            description: desc.trim() || 'No additional details provided.',
            severity,
            status: 'logged',
            reportedBy: technicianName,
            createdAt: new Date().toISOString(),
        };
        onLogWorkOrder(newOrder);
        setTitle('');
        setDesc('');
        setFeedback(`Work order ${newOrder.id} logged successfully.`);
    };

    return (
        <View style={styles.sectionCard} testID="work-orders-section">
            <Text accessibilityRole="header" style={styles.cardHeading}>
                Log Maintenance Defect / Work Order
            </Text>
            <Text style={styles.cardHelper}>
                Create structured repair tickets for defects identified during
                field operations.
            </Text>

            {feedback ? (
                <View style={styles.feedbackBanner}>
                    <Text style={styles.feedbackText}>{feedback}</Text>
                </View>
            ) : null}

            <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Defect Title (Required)</Text>
                <TextInput
                    accessibilityLabel="Defect title"
                    onChangeText={setTitle}
                    placeholder="e.g. Hydraulic leak on right stabilizer"
                    style={styles.input}
                    value={title}
                    testID="wo-title-input"
                />

                <Text style={styles.formLabel}>Severity Level</Text>
                <View style={styles.severityRow}>
                    {(
                        [
                            'minor',
                            'major',
                            'safety_critical',
                        ] as MaintenanceSeverity[]
                    ).map((sev) => (
                        <Pressable
                            key={sev}
                            accessibilityLabel={`Severity ${sev.replace('_', ' ')}`}
                            accessibilityRole="button"
                            onPress={() => setSeverity(sev)}
                            style={[
                                styles.severityOption,
                                severity === sev &&
                                    styles.severityOptionSelected,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.severityText,
                                    severity === sev &&
                                        styles.severityTextSelected,
                                ]}
                            >
                                {sev.replace('_', ' ').toUpperCase()}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={styles.formLabel}>Detailed Description</Text>
                <TextInput
                    accessibilityLabel="Defect description"
                    multiline
                    numberOfLines={3}
                    onChangeText={setDesc}
                    placeholder="Describe component, symptoms, and parts required..."
                    style={[styles.input, styles.textArea]}
                    value={desc}
                    testID="wo-desc-input"
                />

                <Pressable
                    accessibilityLabel="Log maintenance work order"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !title.trim() }}
                    onPress={handleCreate}
                    style={({ pressed }) => [
                        sharedStyles.button,
                        styles.actionButton,
                        !title.trim() && styles.buttonDisabled,
                        pressed && title.trim() && styles.pressed,
                    ]}
                    testID="submit-work-order-btn"
                >
                    <Text style={sharedStyles.buttonText}>
                        + Log Work Order
                    </Text>
                </Pressable>
            </View>

            <Text
                accessibilityRole="header"
                style={[styles.cardHeading, { marginTop: 20 }]}
            >
                Active & Recent Work Orders
            </Text>
            <View style={styles.woList}>
                {workOrders.map((wo) => (
                    <View
                        key={wo.id}
                        style={styles.woCard}
                        testID={`wo-card-${wo.id}`}
                    >
                        <View style={styles.woHeader}>
                            <Text style={styles.woId}>{wo.id}</Text>
                            <Text
                                style={[
                                    styles.woSeverityBadge,
                                    wo.severity === 'safety_critical' &&
                                        styles.woCritical,
                                    wo.severity === 'major' && styles.woMajor,
                                    wo.severity === 'minor' && styles.woMinor,
                                ]}
                            >
                                {wo.severity.replace('_', ' ').toUpperCase()}
                            </Text>
                        </View>
                        <Text style={styles.woTitle}>{wo.defectTitle}</Text>
                        <Text style={styles.woDesc}>{wo.description}</Text>
                        <Text style={styles.woMeta}>
                            Status: {wo.status.toUpperCase()} · Reported by{' '}
                            {wo.reportedBy}
                        </Text>
                    </View>
                ))}
            </View>
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
    formGroup: {
        gap: 8,
        marginTop: 8,
    },
    formLabel: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
        marginTop: 4,
    },
    input: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 14,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    severityRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    severityOption: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    severityOptionSelected: {
        backgroundColor: colors.amberDark,
        borderColor: colors.amberDark,
    },
    severityText: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '800',
    },
    severityTextSelected: {
        color: colors.white,
    },
    actionButton: {
        backgroundColor: colors.amber,
        marginTop: 8,
        minHeight: 48,
        width: '100%',
    },
    buttonDisabled: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
    },
    feedbackBanner: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        padding: 10,
    },
    feedbackText: {
        color: colors.greenDark,
        fontSize: 13,
        fontWeight: '800',
    },
    woList: {
        gap: 8,
        marginTop: 10,
    },
    woCard: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        padding: 12,
    },
    woHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    woId: {
        color: colors.blueDark,
        fontSize: 13,
        fontWeight: '900',
    },
    woSeverityBadge: {
        borderRadius: 4,
        fontSize: 9,
        fontWeight: '900',
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    woCritical: {
        backgroundColor: colors.redSoft,
        color: colors.redDark,
    },
    woMajor: {
        backgroundColor: colors.warningSoft,
        color: colors.warningDark,
    },
    woMinor: {
        backgroundColor: colors.blueSoft,
        color: colors.blueDark,
    },
    woTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    woDesc: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
        marginTop: 2,
    },
    woMeta: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
        marginTop: 6,
    },
    pressed: {
        opacity: 0.78,
    },
});
