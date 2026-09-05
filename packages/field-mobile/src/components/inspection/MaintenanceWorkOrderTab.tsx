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
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

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
        <View style={styles.tabRoot} testID="work-orders-section">
            {/* 1. Log New Work Order Card */}
            <View
                style={[
                    styles.sectionCard,
                    isDarkHud && styles.darkSectionCard,
                ]}
            >
                <View style={styles.cardHeaderRow}>
                    <View style={styles.headerIconWrap}>
                        <Icon
                            color={isDarkHud ? colors.hudAmber : colors.amber}
                            name="tools"
                            size={18}
                        />
                    </View>
                    <View style={styles.headerTitles}>
                        <Text
                            accessibilityRole="header"
                            style={[
                                styles.cardHeading,
                                isDarkHud && styles.darkText,
                            ]}
                        >
                            Log Maintenance Defect / Work Order
                        </Text>
                        <Text
                            style={[
                                styles.cardHelper,
                                isDarkHud && styles.darkHelper,
                            ]}
                        >
                            Create structured repair tickets for defects
                            identified during operations.
                        </Text>
                    </View>
                </View>

                {feedback ? (
                    <View
                        style={[
                            styles.feedbackBanner,
                            isDarkHud && styles.darkFeedbackBanner,
                        ]}
                    >
                        <Icon
                            color={isDarkHud ? '#34D399' : colors.greenDark}
                            name="check-circle"
                            size={16}
                        />
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
                    <Text
                        style={[
                            styles.formLabel,
                            isDarkHud && styles.darkLabel,
                        ]}
                    >
                        Defect Title (Required)
                    </Text>
                    <TextInput
                        accessibilityLabel="Defect title"
                        onChangeText={setTitle}
                        placeholder="e.g. Hydraulic leak on right stabilizer"
                        placeholderTextColor={
                            isDarkHud ? '#64748B' : colors.muted
                        }
                        style={[styles.input, isDarkHud && styles.darkInput]}
                        value={title}
                        testID="wo-title-input"
                    />

                    <Text
                        style={[
                            styles.formLabel,
                            isDarkHud && styles.darkLabel,
                        ]}
                    >
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
                                    style={({ pressed }) => [
                                        styles.severityOption,
                                        isDarkHud && styles.darkSeverityOption,
                                        isSelected &&
                                            styles.severityOptionSelected,
                                        isSelected &&
                                            isDarkHud &&
                                            (sev === 'safety_critical'
                                                ? styles.darkCriticalSelected
                                                : sev === 'major'
                                                  ? styles.darkMajorSelected
                                                  : styles.darkMinorSelected),
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.severityText,
                                            isDarkHud &&
                                                styles.darkSeverityText,
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

                    <Text
                        style={[
                            styles.formLabel,
                            isDarkHud && styles.darkLabel,
                        ]}
                    >
                        Detailed Description
                    </Text>
                    <TextInput
                        accessibilityLabel="Defect description"
                        multiline
                        numberOfLines={3}
                        onChangeText={setDesc}
                        placeholder="Describe component, symptoms, and parts required..."
                        placeholderTextColor={
                            isDarkHud ? '#64748B' : colors.muted
                        }
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
                            styles.actionButton,
                            isDarkHud && styles.darkActionButton,
                            !title.trim() && styles.buttonDisabled,
                            isDarkHud &&
                                !title.trim() &&
                                styles.darkButtonDisabled,
                            pressed && title.trim() && styles.pressed,
                        ]}
                        testID="submit-work-order-btn"
                    >
                        <Text
                            style={[
                                styles.actionBtnText,
                                isDarkHud && styles.darkActionBtnText,
                            ]}
                        >
                            + Log Work Order
                        </Text>
                    </Pressable>
                </View>
            </View>

            {/* 2. Active & Recent Work Orders Card */}
            <View
                style={[
                    styles.sectionCard,
                    isDarkHud && styles.darkSectionCard,
                ]}
            >
                <View style={styles.sectionHeaderRow}>
                    <View style={styles.headerIconWrap}>
                        <Icon
                            color={isDarkHud ? '#60A5FA' : colors.blue}
                            name="clipboard"
                            size={18}
                        />
                    </View>
                    <View style={styles.sectionTitleArea}>
                        <Text
                            accessibilityRole="header"
                            style={[
                                styles.cardHeading,
                                isDarkHud && styles.darkText,
                            ]}
                        >
                            Active & Recent Work Orders
                        </Text>
                        <Text
                            style={[
                                styles.cardHelper,
                                isDarkHud && styles.darkHelper,
                                { marginBottom: 0 },
                            ]}
                        >
                            Logged tickets and repair statuses for this asset
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.countBadge,
                            isDarkHud && styles.darkCountBadge,
                        ]}
                    >
                        <Text
                            style={[
                                styles.countBadgeText,
                                isDarkHud && styles.darkCountBadgeText,
                            ]}
                        >
                            {workOrders.length}
                        </Text>
                    </View>
                </View>

                {workOrders.length === 0 ? (
                    <View
                        style={[
                            styles.emptyState,
                            isDarkHud && styles.darkEmptyState,
                        ]}
                    >
                        <Icon
                            color={isDarkHud ? '#34D399' : colors.greenDark}
                            name="check-circle"
                            size={20}
                        />
                        <Text
                            style={[
                                styles.emptyStateText,
                                isDarkHud && styles.darkText,
                            ]}
                        >
                            No open defects or work orders. Asset is fully
                            operational.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.woList}>
                        {workOrders.map((wo) => {
                            const isResolved = wo.status === 'repaired';

                            return (
                                <View
                                    key={wo.id}
                                    style={[
                                        styles.woCard,
                                        isDarkHud && styles.darkWoCard,
                                    ]}
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
                                        <View style={styles.badgeCluster}>
                                            <View
                                                style={[
                                                    styles.statusPill,
                                                    isResolved
                                                        ? styles.statusResolvedPill
                                                        : styles.statusOpenPill,
                                                    isDarkHud &&
                                                        (isResolved
                                                            ? styles.darkStatusResolvedPill
                                                            : styles.darkStatusOpenPill),
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.statusPillText,
                                                        isResolved
                                                            ? styles.statusResolvedPillText
                                                            : styles.statusOpenPillText,
                                                        isDarkHud &&
                                                            (isResolved
                                                                ? styles.darkStatusResolvedPillText
                                                                : styles.darkStatusOpenPillText),
                                                    ]}
                                                >
                                                    {wo.status.toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text
                                                style={[
                                                    styles.woSeverityBadge,
                                                    wo.severity ===
                                                        'safety_critical' &&
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
                                                {wo.severity
                                                    .replace('_', ' ')
                                                    .toUpperCase()}
                                            </Text>
                                        </View>
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

                                    {wo.attachments &&
                                    wo.attachments.length > 0 ? (
                                        <View style={styles.cardAttachmentsRow}>
                                            {wo.attachments.map(
                                                (att, attIdx) => (
                                                    <Image
                                                        key={`${att.uri}-${attIdx}`}
                                                        source={{
                                                            uri: att.uri,
                                                        }}
                                                        style={
                                                            styles.cardThumbnail
                                                        }
                                                        accessibilityLabel={`Attached defect photo ${attIdx + 1}`}
                                                    />
                                                ),
                                            )}
                                        </View>
                                    ) : null}

                                    <View style={styles.woFooterRow}>
                                        <Text
                                            style={[
                                                styles.woMeta,
                                                isDarkHud && styles.darkWoMeta,
                                            ]}
                                        >
                                            Status: {wo.status.toUpperCase()} ·
                                            Reported by {wo.reportedBy}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.woMetaDate,
                                                isDarkHud && styles.darkWoMeta,
                                            ]}
                                        >
                                            {new Date(
                                                wo.createdAt,
                                            ).toLocaleDateString()}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    tabRoot: {
        gap: 14,
    },
    sectionCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
        ...shadows.sm,
    },
    darkSectionCard: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
        shadowColor: 'transparent',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    sectionHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    headerIconWrap: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        height: 34,
        justifyContent: 'center',
        width: 34,
    },
    headerTitles: {
        flex: 1,
    },
    sectionTitleArea: {
        flex: 1,
    },
    cardHeading: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    darkText: {
        color: colors.hudText,
    },
    cardHelper: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    darkHelper: {
        color: colors.hudTextDim,
    },
    countBadge: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: 'center',
        minWidth: 24,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    darkCountBadge: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    countBadgeText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '800',
    },
    darkCountBadgeText: {
        color: colors.hudText,
    },
    formGroup: {
        gap: 8,
    },
    formLabel: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
    },
    darkLabel: {
        color: colors.hudTextDim,
    },
    input: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        color: colors.text,
        fontSize: 14,
        minHeight: 44,
        paddingHorizontal: 12,
    },
    darkInput: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
        color: colors.hudText,
    },
    textArea: {
        minHeight: 76,
        paddingTop: 10,
        textAlignVertical: 'top',
    },
    severityRow: {
        flexDirection: 'row',
        gap: 8,
    },
    severityOption: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        justifyContent: 'center',
        minHeight: 38,
        paddingVertical: 8,
    },
    darkSeverityOption: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    severityOptionSelected: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
    },
    darkCriticalSelected: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: '#DC2626',
    },
    darkMajorSelected: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#F59E0B',
    },
    darkMinorSelected: {
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        borderColor: '#38BDF8',
    },
    severityText: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
    },
    darkSeverityText: {
        color: colors.hudTextDim,
    },
    severityTextSelected: {
        color: colors.amberDark,
        fontWeight: '800',
    },
    darkCriticalText: {
        color: '#F87171',
    },
    darkMajorText: {
        color: '#FBBF24',
    },
    darkMinorText: {
        color: '#38BDF8',
    },
    actionButton: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 10,
        justifyContent: 'center',
        minHeight: 48,
        marginTop: 8,
    },
    darkActionButton: {
        backgroundColor: colors.hudAmber,
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    darkActionBtnText: {
        color: colors.surfaceDark,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    darkButtonDisabled: {
        opacity: 0.4,
    },
    feedbackBanner: {
        alignItems: 'center',
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
        padding: 10,
    },
    darkFeedbackBanner: {
        backgroundColor: 'rgba(5, 150, 105, 0.2)',
        borderColor: '#059669',
    },
    feedbackText: {
        color: colors.greenDark,
        fontSize: 13,
        fontWeight: '600',
    },
    darkFeedbackText: {
        color: '#34D399',
    },
    woList: {
        gap: 10,
    },
    woCard: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        padding: 14,
    },
    darkWoCard: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    woHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    woId: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    darkWoId: {
        color: colors.hudText,
    },
    badgeCluster: {
        flexDirection: 'row',
        gap: 6,
    },
    statusPill: {
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    statusOpenPill: {
        backgroundColor: colors.amberLight,
    },
    darkStatusOpenPill: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    statusResolvedPill: {
        backgroundColor: colors.greenLight,
    },
    darkStatusResolvedPill: {
        backgroundColor: 'rgba(5, 150, 105, 0.2)',
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: '800',
    },
    statusOpenPillText: {
        color: colors.amberDark,
    },
    darkStatusOpenPillText: {
        color: '#FBBF24',
    },
    statusResolvedPillText: {
        color: colors.greenDark,
    },
    darkStatusResolvedPillText: {
        color: '#34D399',
    },
    woSeverityBadge: {
        borderRadius: 4,
        fontSize: 10,
        fontWeight: '800',
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    woMinor: {
        backgroundColor: colors.surface,
        color: colors.secondary,
    },
    darkWoMinor: {
        backgroundColor: 'rgba(148, 163, 184, 0.2)',
        color: '#94A3B8',
    },
    woMajor: {
        backgroundColor: colors.amberLight,
        color: colors.amberDark,
    },
    darkWoMajor: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        color: '#FBBF24',
    },
    woCritical: {
        backgroundColor: colors.redLight,
        color: colors.redDark,
    },
    darkWoCritical: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        color: '#F87171',
    },
    woTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    woDesc: {
        color: colors.muted,
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 10,
    },
    cardAttachmentsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    cardThumbnail: {
        borderRadius: 6,
        height: 52,
        width: 52,
    },
    woFooterRow: {
        alignItems: 'center',
        borderTopColor: colors.border,
        borderTopWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 8,
    },
    woMeta: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '600',
    },
    woMetaDate: {
        color: colors.muted,
        fontSize: 11,
    },
    darkWoMeta: {
        color: colors.hudTextDim,
    },
    emptyState: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        flexDirection: 'row',
        gap: 10,
        padding: 16,
    },
    darkEmptyState: {
        backgroundColor: colors.surfaceDark,
    },
    emptyStateText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
    },
    pressed: {
        opacity: 0.85,
    },
});
