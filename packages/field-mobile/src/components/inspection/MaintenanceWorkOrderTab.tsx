import React, { useState } from 'react';
import {
    Image,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useTheme } from '../../theme';
import type {
    MaintenanceSeverity,
    MaintenanceWorkOrder,
} from '../../types/index';
import { PhotoAttachmentPicker } from '../attachments/PhotoAttachmentPicker';
import type { PhotoAttachment } from '../attachments/PhotoAttachmentPicker';
import { sharedStyles } from '../nativeStyles';

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
    const { isDarkHud } = useTheme();
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [severity, setSeverity] = useState<MaintenanceSeverity>('minor');
    const [attachments, setAttachments] = useState<PhotoAttachment[]>([]);
    const [feedback, setFeedback] = useState<string | null>(null);

    const handleAddAttachment = (attachment: PhotoAttachment) => {
        setAttachments((prev) => [...prev, attachment]);
    };

    const handleRemoveAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

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
            attachments: attachments.length > 0 ? attachments : undefined,
        };
        onLogWorkOrder(newOrder);
        setTitle('');
        setDesc('');
        setAttachments([]);
        setFeedback(`Work order ${newOrder.id} logged successfully.`);
    };

    return (
        <View
            style={[styles.sectionCard, isDarkHud && styles.darkSectionCard]}
            testID="work-orders-section"
        >
            <Text
                accessibilityRole="header"
                style={[styles.cardHeading, isDarkHud && styles.darkText]}
            >
                Log Maintenance Defect / Work Order
            </Text>
            <Text style={[styles.cardHelper, isDarkHud && styles.darkHelper]}>
                Create structured repair tickets for defects identified during
                field operations.
            </Text>

            {feedback ? (
                <View
                    style={[
                        styles.feedbackBanner,
                        isDarkHud && styles.darkFeedbackBanner,
                    ]}
                >
                    <Text
                        style={[
                            styles.feedbackText,
                            isDarkHud && styles.darkFeedbackText,
                        ]}
                    >
                        {feedback}
                    </Text>
                </View>
            ) : null}

            <View style={styles.formGroup}>
                <Text style={[styles.formLabel, isDarkHud && styles.darkLabel]}>
                    Defect Title (Required)
                </Text>
                <TextInput
                    accessibilityLabel="Defect title"
                    onChangeText={setTitle}
                    placeholder="e.g. Hydraulic leak on right stabilizer"
                    placeholderTextColor={isDarkHud ? '#64748B' : '#94A3B8'}
                    style={[styles.input, isDarkHud && styles.darkInput]}
                    value={title}
                    testID="wo-title-input"
                />

                <Text style={[styles.formLabel, isDarkHud && styles.darkLabel]}>
                    Severity Level
                </Text>
                <View style={styles.severityRow}>
                    {(
                        [
                            'minor',
                            'major',
                            'safety_critical',
                        ] as MaintenanceSeverity[]
                    ).map((sev) => {
                        const isSelected = severity === sev;

                        return (
                            <Pressable
                                key={sev}
                                accessibilityLabel={`Severity ${sev.replace('_', ' ')}`}
                                accessibilityRole="button"
                                onPress={() => setSeverity(sev)}
                                style={[
                                    styles.severityOption,
                                    isDarkHud && styles.darkSeverityOption,
                                    isSelected && styles.severityOptionSelected,
                                    isSelected &&
                                        isDarkHud &&
                                        (sev === 'safety_critical'
                                            ? styles.darkCriticalSelected
                                            : sev === 'major'
                                              ? styles.darkMajorSelected
                                              : styles.darkMinorSelected),
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.severityText,
                                        isDarkHud && styles.darkSeverityText,
                                        isSelected &&
                                            styles.severityTextSelected,
                                        isSelected &&
                                            isDarkHud &&
                                            (sev === 'safety_critical'
                                                ? styles.darkCriticalText
                                                : sev === 'major'
                                                  ? styles.darkMajorText
                                                  : styles.darkMinorText),
                                    ]}
                                >
                                    {sev.replace('_', ' ').toUpperCase()}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={[styles.formLabel, isDarkHud && styles.darkLabel]}>
                    Detailed Description
                </Text>
                <TextInput
                    accessibilityLabel="Defect description"
                    multiline
                    numberOfLines={3}
                    onChangeText={setDesc}
                    placeholder="Describe component, symptoms, and parts required..."
                    placeholderTextColor={isDarkHud ? '#64748B' : '#94A3B8'}
                    style={[
                        styles.input,
                        styles.textArea,
                        isDarkHud && styles.darkInput,
                    ]}
                    value={desc}
                    testID="wo-desc-input"
                />

                <PhotoAttachmentPicker
                    attachments={attachments}
                    helperText="Photograph the defective component, leak area, or error tag."
                    maxCount={4}
                    onAddAttachment={handleAddAttachment}
                    onRemoveAttachment={handleRemoveAttachment}
                    title="Defect Photo Evidence"
                />

                <Pressable
                    accessibilityLabel="Log maintenance work order"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !title.trim() }}
                    onPress={handleCreate}
                    style={({ pressed }) => [
                        sharedStyles.button,
                        styles.actionButton,
                        isDarkHud && styles.darkActionButton,
                        !title.trim() && styles.buttonDisabled,
                        isDarkHud && !title.trim() && styles.darkButtonDisabled,
                        pressed && title.trim() && styles.pressed,
                    ]}
                    testID="submit-work-order-btn"
                >
                    <Text
                        style={[sharedStyles.buttonText, styles.actionBtnText]}
                    >
                        + Log Work Order
                    </Text>
                </Pressable>
            </View>

            <Text
                accessibilityRole="header"
                style={[
                    styles.cardHeading,
                    isDarkHud && styles.darkText,
                    { marginTop: 24 },
                ]}
            >
                Active &amp; Recent Work Orders
            </Text>
            <View style={styles.woList}>
                {workOrders.map((wo) => (
                    <View
                        key={wo.id}
                        style={[styles.woCard, isDarkHud && styles.darkWoCard]}
                        testID={`wo-card-${wo.id}`}
                    >
                        <View style={styles.woHeader}>
                            <Text
                                style={[
                                    styles.woId,
                                    isDarkHud && styles.darkWoId,
                                ]}
                            >
                                {wo.id}
                            </Text>
                            <Text
                                style={[
                                    styles.woSeverityBadge,
                                    wo.severity === 'safety_critical' &&
                                        (isDarkHud
                                            ? styles.darkWoCritical
                                            : styles.woCritical),
                                    wo.severity === 'major' &&
                                        (isDarkHud
                                            ? styles.darkWoMajor
                                            : styles.woMajor),
                                    wo.severity === 'minor' &&
                                        (isDarkHud
                                            ? styles.darkWoMinor
                                            : styles.woMinor),
                                ]}
                            >
                                {wo.severity.replace('_', ' ').toUpperCase()}
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.woTitle,
                                isDarkHud && styles.darkText,
                            ]}
                        >
                            {wo.defectTitle}
                        </Text>
                        <Text
                            style={[
                                styles.woDesc,
                                isDarkHud && styles.darkHelper,
                            ]}
                        >
                            {wo.description}
                        </Text>

                        {wo.attachments && wo.attachments.length > 0 ? (
                            <View style={styles.cardAttachmentsRow}>
                                {wo.attachments.map((att, attIdx) => (
                                    <Image
                                        key={`${att.uri}-${attIdx}`}
                                        source={{ uri: att.uri }}
                                        style={styles.cardThumbnail}
                                        accessibilityLabel={`Attached defect photo ${attIdx + 1}`}
                                    />
                                ))}
                            </View>
                        ) : null}

                        <Text
                            style={[
                                styles.woMeta,
                                isDarkHud && styles.darkWoMeta,
                            ]}
                        >
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
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    darkSectionCard: {
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
    },
    cardHeading: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
    },
    darkText: {
        color: '#FFFFFF',
    },
    cardHelper: {
        color: '#94A3B8',
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 12,
        marginTop: 4,
    },
    darkHelper: {
        color: '#94A3B8',
    },
    formGroup: {
        gap: 8,
        marginTop: 8,
    },
    formLabel: {
        color: '#CBD5E1',
        fontSize: 13,
        fontWeight: '800',
        marginTop: 4,
    },
    darkLabel: {
        color: '#CBD5E1',
    },
    input: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        borderRadius: 8,
        borderWidth: 1,
        color: '#FFFFFF',
        fontSize: 14,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    darkInput: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        color: '#FFFFFF',
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
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    darkSeverityOption: {
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
    },
    severityOptionSelected: {
        backgroundColor: '#172554',
        borderColor: '#2563EB',
        borderWidth: 1.5,
    },
    darkMinorSelected: {
        backgroundColor: '#172554',
        borderColor: '#2563EB',
        borderWidth: 1.5,
    },
    darkMajorSelected: {
        backgroundColor: '#451A03',
        borderColor: '#D97706',
        borderWidth: 1.5,
    },
    darkCriticalSelected: {
        backgroundColor: '#450A0A',
        borderColor: '#DC2626',
        borderWidth: 1.5,
    },
    severityText: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '800',
    },
    darkSeverityText: {
        color: '#94A3B8',
    },
    severityTextSelected: {
        color: '#FFFFFF',
    },
    darkMinorText: {
        color: '#60A5FA',
        fontWeight: '900',
    },
    darkMajorText: {
        color: '#FBBF24',
        fontWeight: '900',
    },
    darkCriticalText: {
        color: '#F87171',
        fontWeight: '900',
    },
    actionButton: {
        backgroundColor: '#2563EB',
        marginTop: 8,
        minHeight: 48,
        width: '100%',
    },
    darkActionButton: {
        backgroundColor: '#2563EB',
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    buttonDisabled: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderWidth: 1,
    },
    darkButtonDisabled: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    feedbackBanner: {
        backgroundColor: '#06281E',
        borderColor: '#065F46',
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        padding: 10,
    },
    darkFeedbackBanner: {
        backgroundColor: '#06281E',
        borderColor: '#065F46',
    },
    feedbackText: {
        color: '#34D399',
        fontSize: 13,
        fontWeight: '800',
    },
    darkFeedbackText: {
        color: '#34D399',
    },
    woList: {
        gap: 10,
        marginTop: 10,
    },
    woCard: {
        backgroundColor: '#101A2E',
        borderColor: '#1E293B',
        borderRadius: 10,
        borderWidth: 1,
        padding: 14,
    },
    darkWoCard: {
        backgroundColor: '#101A2E',
        borderColor: '#1E293B',
    },
    woHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    woId: {
        color: '#38BDF8',
        fontSize: 13,
        fontWeight: '900',
    },
    darkWoId: {
        color: '#38BDF8',
    },
    woSeverityBadge: {
        borderRadius: 4,
        fontSize: 10,
        fontWeight: '900',
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    woCritical: {
        backgroundColor: '#450A0A',
        color: '#F87171',
    },
    darkWoCritical: {
        backgroundColor: '#450A0A',
        color: '#F87171',
    },
    woMajor: {
        backgroundColor: '#451A03',
        color: '#FBBF24',
    },
    darkWoMajor: {
        backgroundColor: '#451A03',
        color: '#FBBF24',
    },
    woMinor: {
        backgroundColor: '#172554',
        color: '#60A5FA',
    },
    darkWoMinor: {
        backgroundColor: '#172554',
        color: '#60A5FA',
    },
    woTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    woDesc: {
        color: '#94A3B8',
        fontSize: 13,
        lineHeight: 18,
        marginTop: 2,
    },
    woMeta: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
        marginTop: 8,
    },
    darkWoMeta: {
        color: '#64748B',
    },
    cardAttachmentsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginVertical: 8,
    },
    cardThumbnail: {
        borderColor: '#334155',
        borderRadius: 6,
        borderWidth: 1,
        height: 48,
        width: 48,
    },
    pressed: {
        opacity: 0.78,
    },
});
