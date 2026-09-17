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
    onOpenDvir?: () => void;
    onStartPostRepair?: (workOrderId: string) => void;
    verifiedWorkOrderIds?: string[];
}

export const MaintenanceWorkOrderTab: React.FC<
    MaintenanceWorkOrderTabProps
> = ({
    assetCode,
    assetName,
    technicianName,
    workOrders,
    onLogWorkOrder,
    onOpenDvir,
    onStartPostRepair,
    verifiedWorkOrderIds,
}) => {
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
            {/* Canonical DVIR Banner for Routine Operator Inspections */}
            <View
                style={[
                    styles.canonicalDvirCard,
                    isDarkHud && styles.darkCanonicalDvirCard,
                ]}
                testID="maintenance-canonical-dvir-banner"
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
                        Daily Pre-Trip & Post-Trip walkaround inspections are
                        performed in Create DVIR.
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
                        testID="maintenance-open-dvir-btn"
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
                            const isCritical = sev === 'safety_critical';
                            const isMajor = sev === 'major';

                            return (
                                <Pressable
                                    key={sev}
                                    accessibilityLabel={`Severity ${sev.replace('_', ' ')}`}
                                    accessibilityRole="button"
                                    onPress={() => setSeverity(sev)}
                                    style={({ pressed }) => [
                                        styles.severityOption,
                                        isDarkHud && styles.darkSeverityOption,
                                        isCritical &&
                                            (isDarkHud
                                                ? styles.darkCriticalUnselected
                                                : styles.criticalUnselected),
                                        isSelected &&
                                            (isCritical
                                                ? styles.criticalSelected
                                                : isMajor
                                                  ? styles.majorSelected
                                                  : styles.minorSelected),
                                        isSelected &&
                                            isDarkHud &&
                                            (isCritical
                                                ? styles.darkCriticalSelected
                                                : isMajor
                                                  ? styles.darkMajorSelected
                                                  : styles.darkMinorSelected),
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <View style={styles.severityInner}>
                                        <Icon
                                            color={
                                                isSelected
                                                    ? isDarkHud
                                                        ? isCritical
                                                            ? '#F87171'
                                                            : isMajor
                                                              ? '#FBBF24'
                                                              : '#38BDF8'
                                                        : isCritical
                                                          ? colors.redDark
                                                          : isMajor
                                                            ? colors.amberDark
                                                            : colors.blueDark
                                                    : isDarkHud
                                                      ? isCritical
                                                          ? '#EF4444'
                                                          : colors.hudTextDim
                                                      : isCritical
                                                        ? colors.red
                                                        : colors.muted
                                            }
                                            name={
                                                isCritical
                                                    ? 'alert'
                                                    : isMajor
                                                      ? 'alert-circle'
                                                      : 'tools'
                                            }
                                            size={13}
                                        />
                                        <Text
                                            style={[
                                                styles.severityText,
                                                isDarkHud &&
                                                    styles.darkSeverityText,
                                                isCritical &&
                                                    (isDarkHud
                                                        ? styles.darkCriticalUnselectedText
                                                        : styles.criticalUnselectedText),
                                                isSelected &&
                                                    (isCritical
                                                        ? styles.criticalText
                                                        : isMajor
                                                          ? styles.majorText
                                                          : styles.minorText),
                                                isSelected &&
                                                    isDarkHud &&
                                                    (isCritical
                                                        ? styles.darkCriticalText
                                                        : isMajor
                                                          ? styles.darkMajorText
                                                          : styles.darkMinorText),
                                            ]}
                                        >
                                            {sev === 'safety_critical'
                                                ? 'SAFETY CRITICAL'
                                                : sev.toUpperCase()}
                                        </Text>
                                    </View>
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
                            const isRepaired = wo.status === 'repaired';
                            const isInProgress = wo.status === 'in_progress';

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
                                                    isRepaired
                                                        ? styles.statusResolvedPill
                                                        : isInProgress
                                                          ? styles.statusProgressPill
                                                          : styles.statusOpenPill,
                                                    isDarkHud &&
                                                        (isRepaired
                                                            ? styles.darkStatusResolvedPill
                                                            : isInProgress
                                                              ? styles.darkStatusProgressPill
                                                              : styles.darkStatusOpenPill),
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.statusPillText,
                                                        isRepaired
                                                            ? styles.statusResolvedPillText
                                                            : isInProgress
                                                              ? styles.statusProgressPillText
                                                              : styles.statusOpenPillText,
                                                        isDarkHud &&
                                                            (isRepaired
                                                                ? styles.darkStatusResolvedPillText
                                                                : isInProgress
                                                                  ? styles.darkStatusProgressPillText
                                                                  : styles.darkStatusOpenPillText),
                                                    ]}
                                                >
                                                    {wo.status
                                                        .replace('_', ' ')
                                                        .toUpperCase()}
                                                </Text>
                                            </View>
                                            <View
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
                                                {wo.severity ===
                                                    'safety_critical' && (
                                                    <Icon
                                                        color={
                                                            isDarkHud
                                                                ? '#F87171'
                                                                : colors.redDark
                                                        }
                                                        name="alert"
                                                        size={10}
                                                    />
                                                )}
                                                <Text
                                                    style={[
                                                        styles.woSeverityText,
                                                        wo.severity ===
                                                            'safety_critical' &&
                                                            (isDarkHud
                                                                ? styles.darkWoCriticalText
                                                                : styles.woCriticalText),
                                                        wo.severity ===
                                                            'major' &&
                                                            (isDarkHud
                                                                ? styles.darkWoMajorText
                                                                : styles.woMajorText),
                                                        wo.severity ===
                                                            'minor' &&
                                                            (isDarkHud
                                                                ? styles.darkWoMinorText
                                                                : styles.woMinorText),
                                                    ]}
                                                >
                                                    {wo.severity
                                                        .replace('_', ' ')
                                                        .toUpperCase()}
                                                </Text>
                                            </View>
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

                                    <View
                                        style={[
                                            styles.woFooterRow,
                                            isDarkHud && styles.darkWoFooterRow,
                                        ]}
                                    >
                                        <Text
                                            ellipsizeMode="tail"
                                            numberOfLines={1}
                                            style={[
                                                styles.woMeta,
                                                isDarkHud && styles.darkWoMeta,
                                            ]}
                                        >
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

                                    {/* Post-Repair Action & Verification Status */}
                                    <View
                                        style={[
                                            styles.postRepairRow,
                                            isDarkHud &&
                                                styles.darkPostRepairRow,
                                        ]}
                                    >
                                        {isRepaired ? (
                                            verifiedWorkOrderIds?.includes(
                                                wo.id,
                                            ) ? (
                                                <View
                                                    style={[
                                                        styles.postRepairVerifiedBadge,
                                                        isDarkHud &&
                                                            styles.darkPostRepairVerifiedBadge,
                                                    ]}
                                                    testID={`post-repair-verified-${wo.id}`}
                                                >
                                                    <Icon
                                                        color={
                                                            isDarkHud
                                                                ? '#34D399'
                                                                : colors.greenDark
                                                        }
                                                        name="check-circle"
                                                        size={14}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.postRepairVerifiedText,
                                                            isDarkHud &&
                                                                styles.darkPostRepairVerifiedText,
                                                        ]}
                                                    >
                                                        Post-Repair: Verified
                                                    </Text>
                                                </View>
                                            ) : (
                                                <View
                                                    style={
                                                        styles.postRepairPendingRow
                                                    }
                                                >
                                                    <View
                                                        style={[
                                                            styles.postRepairPendingBadge,
                                                            isDarkHud &&
                                                                styles.darkPostRepairPendingBadge,
                                                        ]}
                                                        testID={`post-repair-pending-${wo.id}`}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.postRepairPendingText,
                                                                isDarkHud &&
                                                                    styles.darkPostRepairPendingText,
                                                            ]}
                                                        >
                                                            Awaiting Post-Repair
                                                            Inspection
                                                        </Text>
                                                    </View>
                                                    {onStartPostRepair ? (
                                                        <Pressable
                                                            accessibilityLabel={`Perform post-repair inspection for ${wo.id}`}
                                                            accessibilityRole="button"
                                                            onPress={() =>
                                                                onStartPostRepair(
                                                                    wo.id,
                                                                )
                                                            }
                                                            style={({
                                                                pressed,
                                                            }) => [
                                                                styles.postRepairBtn,
                                                                isDarkHud &&
                                                                    styles.darkPostRepairBtn,
                                                                pressed &&
                                                                    styles.pressed,
                                                            ]}
                                                            testID={`post-repair-btn-${wo.id}`}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.postRepairBtnText,
                                                                    isDarkHud &&
                                                                        styles.darkPostRepairBtnText,
                                                                ]}
                                                            >
                                                                Perform
                                                                Inspection
                                                            </Text>
                                                        </Pressable>
                                                    ) : null}
                                                </View>
                                            )
                                        ) : (
                                            <Text
                                                style={[
                                                    styles.postRepairHelperNote,
                                                    isDarkHud &&
                                                        styles.darkPostRepairHelperNote,
                                                ]}
                                            >
                                                Repair completion required
                                                before post-repair verification.
                                            </Text>
                                        )}
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
        minHeight: 50,
        paddingHorizontal: 4,
        paddingVertical: 6,
    },
    darkSeverityOption: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    criticalUnselected: {
        backgroundColor: '#FEF2F2',
        borderColor: colors.redBorder,
    },
    darkCriticalUnselected: {
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: 'rgba(239, 68, 68, 0.35)',
    },
    minorSelected: {
        backgroundColor: colors.blueLight,
        borderColor: colors.blue,
        borderWidth: 1.5,
    },
    majorSelected: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amber,
        borderWidth: 1.5,
    },
    criticalSelected: {
        backgroundColor: colors.redLight,
        borderColor: colors.red,
        borderWidth: 1.5,
    },
    darkMinorSelected: {
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        borderColor: '#38BDF8',
        borderWidth: 1.5,
    },
    darkMajorSelected: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#F59E0B',
        borderWidth: 1.5,
    },
    darkCriticalSelected: {
        backgroundColor: 'rgba(239, 68, 68, 0.25)',
        borderColor: '#EF4444',
        borderWidth: 1.5,
    },
    severityInner: {
        alignItems: 'center',
        gap: 3,
        justifyContent: 'center',
    },
    severityText: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.2,
        lineHeight: 12,
        textAlign: 'center',
    },
    darkSeverityText: {
        color: colors.hudTextDim,
    },
    criticalUnselectedText: {
        color: colors.redDark,
    },
    darkCriticalUnselectedText: {
        color: '#F87171',
    },
    minorText: {
        color: colors.blueDark,
        fontWeight: '800',
    },
    majorText: {
        color: colors.amberDark,
        fontWeight: '800',
    },
    criticalText: {
        color: colors.redDark,
        fontWeight: '800',
    },
    darkMinorText: {
        color: '#38BDF8',
        fontWeight: '800',
    },
    darkMajorText: {
        color: '#FBBF24',
        fontWeight: '800',
    },
    darkCriticalText: {
        color: '#F87171',
        fontWeight: '800',
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
        overflow: 'hidden',
        padding: 14,
    },
    darkWoCard: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    woHeader: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    woId: {
        color: colors.text,
        flexShrink: 0,
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    darkWoId: {
        color: colors.hudText,
    },
    badgeCluster: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'flex-end',
    },
    statusPill: {
        alignItems: 'center',
        borderRadius: 4,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    statusOpenPill: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
    },
    darkStatusOpenPill: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    statusProgressPill: {
        backgroundColor: colors.blueLight,
        borderColor: colors.blueBorder,
    },
    darkStatusProgressPill: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 0.4)',
    },
    statusResolvedPill: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    darkStatusResolvedPill: {
        backgroundColor: 'rgba(5, 150, 105, 0.2)',
        borderColor: 'rgba(5, 150, 105, 0.4)',
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
    statusProgressPillText: {
        color: colors.blueDark,
    },
    darkStatusProgressPillText: {
        color: '#60A5FA',
    },
    statusResolvedPillText: {
        color: colors.greenDark,
    },
    darkStatusResolvedPillText: {
        color: '#34D399',
    },
    woSeverityBadge: {
        alignItems: 'center',
        borderRadius: 4,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    woSeverityText: {
        fontSize: 10,
        fontWeight: '800',
    },
    woMinor: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
    },
    darkWoMinor: {
        backgroundColor: 'rgba(148, 163, 184, 0.15)',
        borderColor: 'rgba(148, 163, 184, 0.25)',
    },
    woMinorText: {
        color: colors.secondary,
    },
    darkWoMinorText: {
        color: '#94A3B8',
    },
    woMajor: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
    },
    darkWoMajor: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    woMajorText: {
        color: colors.amberDark,
    },
    darkWoMajorText: {
        color: '#FBBF24',
    },
    woCritical: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
    },
    darkWoCritical: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    woCriticalText: {
        color: colors.redDark,
    },
    darkWoCriticalText: {
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
        gap: 8,
        justifyContent: 'space-between',
        paddingTop: 8,
    },
    darkWoFooterRow: {
        borderTopColor: colors.hudBorder,
    },
    woMeta: {
        color: colors.secondary,
        flex: 1,
        flexShrink: 1,
        fontSize: 11,
        fontWeight: '600',
    },
    woMetaDate: {
        color: colors.muted,
        flexShrink: 0,
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
    canonicalDvirCard: {
        alignItems: 'center',
        backgroundColor: colors.blueLight,
        borderColor: colors.blueBorder,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
        padding: 14,
    },
    darkCanonicalDvirCard: {
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    canonicalDvirTextWrap: {
        flex: 1,
    },
    canonicalDvirTitle: {
        color: colors.blueDark,
        fontSize: 14,
        fontWeight: '700',
    },
    darkCanonicalDvirTitle: {
        color: '#60A5FA',
    },
    canonicalDvirSubtitle: {
        color: colors.secondary,
        fontSize: 12,
        marginTop: 2,
    },
    darkCanonicalDvirSubtitle: {
        color: colors.hudTextDim,
    },
    openDvirBtn: {
        alignItems: 'center',
        backgroundColor: colors.blue,
        borderRadius: 8,
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    darkOpenDvirBtn: {
        backgroundColor: '#2563EB',
    },
    openDvirBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    darkOpenDvirBtnText: {
        color: '#FFFFFF',
    },
    postRepairRow: {
        borderTopColor: colors.border,
        borderTopWidth: StyleSheet.hairlineWidth,
        marginTop: 10,
        paddingTop: 10,
    },
    darkPostRepairRow: {
        borderTopColor: colors.hudBorder,
    },
    postRepairVerifiedBadge: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkPostRepairVerifiedBadge: {
        backgroundColor: 'rgba(5, 150, 105, 0.2)',
        borderColor: '#059669',
    },
    postRepairVerifiedText: {
        color: colors.greenDark,
        fontSize: 12,
        fontWeight: '700',
    },
    darkPostRepairVerifiedText: {
        color: '#34D399',
    },
    postRepairPendingRow: {
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
    },
    postRepairPendingBadge: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    darkPostRepairPendingBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    postRepairPendingText: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '700',
    },
    darkPostRepairPendingText: {
        color: '#FBBF24',
    },
    postRepairBtn: {
        alignItems: 'center',
        backgroundColor: colors.blue,
        borderRadius: 6,
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    darkPostRepairBtn: {
        backgroundColor: '#2563EB',
    },
    postRepairBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    darkPostRepairBtnText: {
        color: '#FFFFFF',
    },
    postRepairHelperNote: {
        color: colors.muted,
        fontSize: 11,
        fontStyle: 'italic',
    },
    darkPostRepairHelperNote: {
        color: colors.hudTextDim,
    },
});
