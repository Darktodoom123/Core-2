import React, { useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import type {
    DelayContextType,
    DelayReasonCode,
    DispatchJob,
    ReportDelayPayload,
} from '../../types/index';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { shadows } from '../nativeStyles';

export interface ReportDelayModalProps {
    visible: boolean;
    job: DispatchJob;
    initialContext?: DelayContextType;
    onClose: () => void;
    onSubmit: (payload: ReportDelayPayload) => Promise<void> | void;
    onNavigateDvir?: () => void;
}

interface ReasonOption {
    code: DelayReasonCode;
    label: string;
    description: string;
    icon: IconName;
}

const TRANSIT_REASONS: ReasonOption[] = [
    {
        code: 'traffic',
        label: 'Traffic Congestion',
        description: 'Heavy traffic or escort pace delay',
        icon: 'truck',
    },
    {
        code: 'road_closure',
        label: 'Road Closure / Detour',
        description: 'Road barrier, re-blocking, or construction',
        icon: 'route',
    },
    {
        code: 'low_clearance',
        label: 'Low Clearance Obstruction',
        description: 'Overhead wires, bridge, or structural limit',
        icon: 'alert',
    },
    {
        code: 'site_access_restricted',
        label: 'Site Access Restricted',
        description: 'Gate locked, queue, or permit check',
        icon: 'shield-check',
    },
    {
        code: 'weather',
        label: 'Adverse Weather',
        description: 'Heavy rain, flooding, or reduced visibility',
        icon: 'sun',
    },
    {
        code: 'equipment_issue',
        label: 'Equipment Issue (In Transit)',
        description: 'Vehicle warning, tire issue, or mechanical concern',
        icon: 'tools',
    },
    {
        code: 'other',
        label: 'Other Transit Delay',
        description: 'Unforeseen route delay',
        icon: 'clock',
    },
];

const ON_SITE_REASONS: ReasonOption[] = [
    {
        code: 'site_not_ready',
        label: 'Site Not Prepared',
        description: 'Unstable ground, uncleared pad, or obstructions',
        icon: 'pin',
    },
    {
        code: 'materials_unavailable',
        label: 'Materials / Rigging Missing',
        description: 'Loads, slings, or rigging hardware not ready',
        icon: 'clipboard',
    },
    {
        code: 'awaiting_clearance',
        label: 'Awaiting Safety Clearance',
        description: 'Permit-to-work, engineering, or marshaling sign-off',
        icon: 'shield-check',
    },
    {
        code: 'weather',
        label: 'Weather / Wind Hold',
        description: 'Wind speed exceeds rated crane capacity or storm',
        icon: 'sun',
    },
    {
        code: 'equipment_issue',
        label: 'Equipment Issue (On Site)',
        description: 'Hydraulic, outrigger, or hoist malfunction',
        icon: 'tools',
    },
    {
        code: 'other',
        label: 'Other On-Site Delay',
        description: 'Operational demurrage or unexpected site hold',
        icon: 'clock',
    },
];

const ESTIMATE_OPTIONS = [15, 30, 45, 60, 90, 120];

export const ReportDelayModal: React.FC<ReportDelayModalProps> = ({
    visible,
    job,
    initialContext,
    onClose,
    onSubmit,
    onNavigateDvir,
}) => {
    const insets = useSafeAreaInsets();
    const { isDarkHud } = useTheme();

    const defaultContext: DelayContextType = useMemo(() => {
        if (initialContext) {
            return initialContext;
        }

        return job.status?.value === 'en_route' ? 'transit' : 'on_site';
    }, [initialContext, job.status?.value]);

    const initialAssetId = useMemo(() => {
        if (job.asset_assignments && job.asset_assignments.length === 1) {
            return job.asset_assignments[0].operational_asset_id;
        }

        return null;
    }, [job.asset_assignments]);

    const [context, setContext] = useState<DelayContextType>(defaultContext);
    const [selectedReason, setSelectedReason] =
        useState<DelayReasonCode | null>(null);
    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(
        initialAssetId,
    );
    const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(30);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submitInFlightRef = useRef(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const reasons = context === 'transit' ? TRANSIT_REASONS : ON_SITE_REASONS;

    const handleSubmit = async () => {
        if (submitInFlightRef.current) {
            return;
        }

        if (!selectedReason) {
            setErrorMsg('Please select a delay reason.');

            return;
        }

        setErrorMsg(null);
        submitInFlightRef.current = true;
        setIsSubmitting(true);

        try {
            const payload: ReportDelayPayload = {
                dispatch_job_id: job.id,
                operational_asset_id: selectedAssetId,
                context,
                reason: selectedReason,
                estimated_minutes: estimatedMinutes,
                notes: notes.trim() !== '' ? notes.trim() : null,
                job_version: job.version,
                reported_at: new Date().toISOString(),
            };

            await onSubmit(payload);
            onClose();
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Failed to report delay.';
            setErrorMsg(message);
        } finally {
            submitInFlightRef.current = false;
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            accessibilityViewIsModal
            animationType="slide"
            onRequestClose={onClose}
            transparent
            visible={visible}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
                testID="report-delay-modal"
            >
                <View
                    accessibilityViewIsModal
                    style={[
                        styles.sheetContainer,
                        isDarkHud && styles.darkSheetContainer,
                        { paddingBottom: Math.max(insets.bottom, 16) },
                    ]}
                >
                    {/* Header */}
                    <View style={styles.headerRow}>
                        <View style={styles.headerLeftGroup}>
                            <View
                                style={[
                                    styles.headerIconWrap,
                                    isDarkHud && styles.darkHeaderIconWrap,
                                ]}
                            >
                                <Icon color="#F59E0B" name="alert" size={20} />
                            </View>
                            <View style={styles.headerTitleCopy}>
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.sheetTitle,
                                        isDarkHud && styles.darkSheetTitle,
                                    ]}
                                >
                                    Report Operational Delay
                                </Text>
                                <Text
                                    ellipsizeMode="tail"
                                    numberOfLines={2}
                                    style={[
                                        styles.sheetSubtitle,
                                        isDarkHud && styles.darkSheetSubtitle,
                                    ]}
                                >
                                    {job.reference} · {job.title}
                                </Text>
                            </View>
                        </View>
                        <Pressable
                            accessibilityLabel="Close delay modal"
                            accessibilityRole="button"
                            accessibilityState={{ disabled: isSubmitting }}
                            disabled={isSubmitting}
                            onPress={onClose}
                            style={styles.closeBtn}
                        >
                            <Icon
                                color={isDarkHud ? '#94A3B8' : '#64748B'}
                                name="close"
                                size={20}
                            />
                        </Pressable>
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Context Toggle */}
                        <Text
                            style={[
                                styles.sectionHeading,
                                isDarkHud && styles.darkSectionHeading,
                            ]}
                        >
                            OPERATIONAL STAGE
                        </Text>
                        <View
                            accessibilityRole="radiogroup"
                            style={styles.toggleRow}
                        >
                            <Pressable
                                accessibilityLabel="Transit Stage Delay"
                                accessibilityRole="radio"
                                accessibilityState={{
                                    selected: context === 'transit',
                                }}
                                onPress={() => {
                                    setContext('transit');
                                    setSelectedReason(null);
                                }}
                                style={[
                                    styles.toggleBtn,
                                    context === 'transit' &&
                                        styles.toggleBtnActive,
                                    isDarkHud && styles.darkToggleBtn,
                                    isDarkHud &&
                                        context === 'transit' &&
                                        styles.darkToggleBtnActive,
                                ]}
                                testID="context-transit-btn"
                            >
                                <Icon
                                    color={
                                        context === 'transit'
                                            ? '#FFFFFF'
                                            : isDarkHud
                                              ? '#94A3B8'
                                              : '#64748B'
                                    }
                                    name="truck"
                                    size={16}
                                />
                                <Text
                                    style={[
                                        styles.toggleBtnText,
                                        context === 'transit' &&
                                            styles.toggleBtnTextActive,
                                        isDarkHud && styles.darkToggleBtnText,
                                        isDarkHud &&
                                            context === 'transit' &&
                                            styles.darkToggleBtnTextActive,
                                    ]}
                                >
                                    Driving / Transit
                                </Text>
                            </Pressable>

                            <Pressable
                                accessibilityLabel="On-Site Stage Delay"
                                accessibilityRole="radio"
                                accessibilityState={{
                                    selected: context === 'on_site',
                                }}
                                onPress={() => {
                                    setContext('on_site');
                                    setSelectedReason(null);
                                }}
                                style={[
                                    styles.toggleBtn,
                                    context === 'on_site' &&
                                        styles.toggleBtnActive,
                                    isDarkHud && styles.darkToggleBtn,
                                    isDarkHud &&
                                        context === 'on_site' &&
                                        styles.darkToggleBtnActive,
                                ]}
                                testID="context-on_site-btn"
                            >
                                <Icon
                                    color={
                                        context === 'on_site'
                                            ? '#FFFFFF'
                                            : isDarkHud
                                              ? '#94A3B8'
                                              : '#64748B'
                                    }
                                    name="pin"
                                    size={16}
                                />
                                <Text
                                    style={[
                                        styles.toggleBtnText,
                                        context === 'on_site' &&
                                            styles.toggleBtnTextActive,
                                        isDarkHud && styles.darkToggleBtnText,
                                        isDarkHud &&
                                            context === 'on_site' &&
                                            styles.darkToggleBtnTextActive,
                                    ]}
                                >
                                    On-Site Execution
                                </Text>
                            </Pressable>
                        </View>

                        {/* Multi-Asset Selector */}
                        {job.asset_assignments &&
                        job.asset_assignments.length > 1 ? (
                            <View style={styles.sectionMargin}>
                                <Text
                                    style={[
                                        styles.sectionHeading,
                                        isDarkHud && styles.darkSectionHeading,
                                    ]}
                                >
                                    ASSIGNED ASSET AFFECTED
                                </Text>
                                <ScrollView
                                    accessibilityRole="radiogroup"
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.assetScroll}
                                >
                                    <Pressable
                                        accessibilityLabel="Apply delay to entire dispatch job"
                                        accessibilityRole="radio"
                                        accessibilityState={{
                                            selected: selectedAssetId === null,
                                        }}
                                        onPress={() => setSelectedAssetId(null)}
                                        style={[
                                            styles.assetChip,
                                            selectedAssetId === null &&
                                                styles.assetChipActive,
                                            isDarkHud && styles.darkAssetChip,
                                            isDarkHud &&
                                                selectedAssetId === null &&
                                                styles.darkAssetChipActive,
                                        ]}
                                        testID="asset-chip-whole-job"
                                    >
                                        <Text
                                            style={[
                                                styles.assetChipText,
                                                selectedAssetId === null &&
                                                    styles.assetChipTextActive,
                                                isDarkHud &&
                                                    styles.darkAssetChipText,
                                                isDarkHud &&
                                                    selectedAssetId === null &&
                                                    styles.darkAssetChipTextActive,
                                            ]}
                                        >
                                            Entire Dispatch Job
                                        </Text>
                                    </Pressable>
                                    {job.asset_assignments.map((assignment) => {
                                        const isSelected =
                                            selectedAssetId ===
                                            assignment.operational_asset_id;

                                        return (
                                            <Pressable
                                                accessibilityLabel={`Apply delay to ${assignment.asset_code}, ${assignment.asset_name}`}
                                                accessibilityRole="radio"
                                                accessibilityState={{
                                                    selected: isSelected,
                                                }}
                                                key={assignment.id}
                                                onPress={() =>
                                                    setSelectedAssetId(
                                                        assignment.operational_asset_id,
                                                    )
                                                }
                                                style={[
                                                    styles.assetChip,
                                                    isSelected &&
                                                        styles.assetChipActive,
                                                    isDarkHud &&
                                                        styles.darkAssetChip,
                                                    isDarkHud &&
                                                        isSelected &&
                                                        styles.darkAssetChipActive,
                                                ]}
                                                testID={`asset-chip-${assignment.operational_asset_id}`}
                                            >
                                                <Text
                                                    style={[
                                                        styles.assetChipText,
                                                        isSelected &&
                                                            styles.assetChipTextActive,
                                                        isDarkHud &&
                                                            styles.darkAssetChipText,
                                                        isDarkHud &&
                                                            isSelected &&
                                                            styles.darkAssetChipTextActive,
                                                    ]}
                                                >
                                                    {assignment.asset_code} (
                                                    {assignment.asset_name})
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        ) : null}

                        {/* Reason Selection */}
                        <Text
                            style={[
                                styles.sectionHeading,
                                styles.sectionMargin,
                                isDarkHud && styles.darkSectionHeading,
                            ]}
                        >
                            DELAY REASON (REQUIRED)
                        </Text>
                        <View
                            accessibilityRole="radiogroup"
                            style={styles.reasonsList}
                        >
                            {reasons.map((opt) => {
                                const isSelected = selectedReason === opt.code;

                                return (
                                    <Pressable
                                        accessibilityLabel={`Select delay reason: ${opt.label}`}
                                        accessibilityRole="radio"
                                        accessibilityState={{
                                            selected: isSelected,
                                        }}
                                        key={opt.code}
                                        onPress={() =>
                                            setSelectedReason(opt.code)
                                        }
                                        style={[
                                            styles.reasonCard,
                                            isSelected &&
                                                styles.reasonCardSelected,
                                            isDarkHud && styles.darkReasonCard,
                                            isDarkHud &&
                                                isSelected &&
                                                styles.darkReasonCardSelected,
                                        ]}
                                        testID={`delay-reason-${opt.code}`}
                                    >
                                        <View style={styles.reasonCardHeader}>
                                            <Icon
                                                color={
                                                    isSelected
                                                        ? '#F59E0B'
                                                        : isDarkHud
                                                          ? '#94A3B8'
                                                          : '#64748B'
                                                }
                                                name={opt.icon}
                                                size={18}
                                            />
                                            <Text
                                                style={[
                                                    styles.reasonLabel,
                                                    isSelected &&
                                                        styles.reasonLabelSelected,
                                                    isDarkHud &&
                                                        styles.darkReasonLabel,
                                                    isDarkHud &&
                                                        isSelected &&
                                                        styles.darkReasonLabelSelected,
                                                ]}
                                            >
                                                {opt.label}
                                            </Text>
                                            <View
                                                style={[
                                                    styles.radioCircle,
                                                    isSelected &&
                                                        styles.radioCircleSelected,
                                                    isDarkHud &&
                                                        styles.darkRadioCircle,
                                                    isDarkHud &&
                                                        isSelected &&
                                                        styles.darkRadioCircleSelected,
                                                ]}
                                            >
                                                {isSelected && (
                                                    <View
                                                        style={
                                                            styles.radioInner
                                                        }
                                                    />
                                                )}
                                            </View>
                                        </View>
                                        <Text
                                            style={[
                                                styles.reasonDesc,
                                                isDarkHud &&
                                                    styles.darkReasonDesc,
                                            ]}
                                        >
                                            {opt.description}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* Equipment Issue DVIR Cross-Reference Notice */}
                        {selectedReason === 'equipment_issue' && (
                            <View
                                style={[
                                    styles.dvirNoticeBox,
                                    isDarkHud && styles.darkDvirNoticeBox,
                                ]}
                                testID="dvir-cross-reference-notice"
                            >
                                <View style={styles.dvirNoticeHeader}>
                                    <Icon
                                        color="#F59E0B"
                                        name="alert-circle"
                                        size={16}
                                    />
                                    <Text style={styles.dvirNoticeTitle}>
                                        Equipment Defect Notice
                                    </Text>
                                </View>
                                <Text style={styles.dvirNoticeBody}>
                                    Reporting a delay explains operational
                                    hold-up to dispatch. A delay report does NOT
                                    replace a DVIR defect report and will not
                                    trigger a safety lockout.
                                </Text>
                                {onNavigateDvir && (
                                    <Pressable
                                        accessibilityLabel="Open DVIR walkaround inspection"
                                        accessibilityRole="button"
                                        onPress={() => {
                                            onClose();
                                            onNavigateDvir();
                                        }}
                                        style={styles.dvirLinkBtn}
                                        testID="go-to-dvir-btn"
                                    >
                                        <Icon
                                            color="#0284C7"
                                            name="shield-check"
                                            size={14}
                                        />
                                        <Text style={styles.dvirLinkBtnText}>
                                            Go to DVIR Pre/Post-Trip Inspection
                                        </Text>
                                    </Pressable>
                                )}
                            </View>
                        )}

                        {/* Estimated Minutes */}
                        <Text
                            style={[
                                styles.sectionHeading,
                                styles.sectionMargin,
                                isDarkHud && styles.darkSectionHeading,
                            ]}
                        >
                            ESTIMATED IMPACT (MINUTES)
                        </Text>
                        <View
                            accessibilityRole="radiogroup"
                            style={styles.minutesRow}
                        >
                            {ESTIMATE_OPTIONS.map((mins) => {
                                const isSelected = estimatedMinutes === mins;

                                return (
                                    <Pressable
                                        accessibilityLabel={`${mins} minute estimated impact`}
                                        accessibilityRole="radio"
                                        accessibilityState={{
                                            selected: isSelected,
                                        }}
                                        key={mins}
                                        onPress={() =>
                                            setEstimatedMinutes(mins)
                                        }
                                        style={[
                                            styles.minuteChip,
                                            isSelected &&
                                                styles.minuteChipSelected,
                                            isDarkHud && styles.darkMinuteChip,
                                            isDarkHud &&
                                                isSelected &&
                                                styles.darkMinuteChipSelected,
                                        ]}
                                        testID={`minute-chip-${mins}`}
                                    >
                                        <Text
                                            style={[
                                                styles.minuteChipText,
                                                isSelected &&
                                                    styles.minuteChipTextSelected,
                                                isDarkHud &&
                                                    styles.darkMinuteChipText,
                                                isDarkHud &&
                                                    isSelected &&
                                                    styles.darkMinuteChipTextActive,
                                            ]}
                                        >
                                            +{mins}m
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* Notes Input */}
                        <Text
                            style={[
                                styles.sectionHeading,
                                styles.sectionMargin,
                                isDarkHud && styles.darkSectionHeading,
                            ]}
                        >
                            OPERATIONAL NOTES (OPTIONAL)
                        </Text>
                        <TextInput
                            accessibilityLabel="Delay details and notes"
                            multiline
                            numberOfLines={3}
                            onChangeText={setNotes}
                            placeholder="Provide details on root cause, expected resolution, or site hold notes…"
                            placeholderTextColor={
                                isDarkHud ? '#64748B' : '#94A3B8'
                            }
                            style={[
                                styles.notesInput,
                                isDarkHud && styles.darkNotesInput,
                            ]}
                            testID="delay-notes-input"
                            value={notes}
                        />

                        {errorMsg && (
                            <View
                                accessibilityLiveRegion="assertive"
                                accessibilityRole="alert"
                                style={styles.errorBox}
                                testID="delay-error"
                            >
                                <Icon color="#EF4444" name="alert" size={14} />
                                <Text style={styles.errorText}>{errorMsg}</Text>
                            </View>
                        )}
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.actionRow}>
                        <Pressable
                            accessibilityLabel="Cancel delay report"
                            accessibilityRole="button"
                            accessibilityState={{ disabled: isSubmitting }}
                            disabled={isSubmitting}
                            onPress={onClose}
                            style={[
                                styles.cancelBtn,
                                isDarkHud && styles.darkCancelBtn,
                            ]}
                            testID="cancel-delay-btn"
                        >
                            <Text
                                style={[
                                    styles.cancelBtnText,
                                    isDarkHud && styles.darkCancelBtnText,
                                ]}
                            >
                                Cancel
                            </Text>
                        </Pressable>

                        <Pressable
                            accessibilityLabel="Submit delay report to dispatch"
                            accessibilityRole="button"
                            accessibilityState={{
                                busy: isSubmitting,
                                disabled: isSubmitting,
                            }}
                            disabled={isSubmitting}
                            onPress={handleSubmit}
                            style={[
                                styles.submitBtn,
                                isSubmitting && styles.submitBtnDisabled,
                            ]}
                            testID="submit-delay-btn"
                        >
                            {isSubmitting ? (
                                <ActivityIndicator
                                    color="#FFFFFF"
                                    size="small"
                                />
                            ) : (
                                <>
                                    <Icon
                                        color="#FFFFFF"
                                        name="check"
                                        size={16}
                                    />
                                    <Text style={styles.submitBtnText}>
                                        Report to Dispatch
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        paddingHorizontal: 20,
        paddingTop: 20,
        ...shadows.lg,
    },
    darkSheetContainer: {
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
        borderTopWidth: 1,
    },
    headerRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    headerLeftGroup: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        flex: 1,
    },
    headerTitleCopy: {
        flex: 1,
        minWidth: 0,
    },
    headerIconWrap: {
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        height: 38,
        justifyContent: 'center',
        width: 38,
    },
    darkHeaderIconWrap: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    sheetTitle: {
        color: '#0F172A',
        fontSize: 16,
        fontWeight: '700',
    },
    darkSheetTitle: {
        color: '#F8FAFC',
    },
    sheetSubtitle: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    darkSheetSubtitle: {
        color: '#94A3B8',
    },
    closeBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        minWidth: 48,
    },
    scrollContent: {
        paddingBottom: 16,
    },
    sectionHeading: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    darkSectionHeading: {
        color: '#94A3B8',
    },
    sectionMargin: {
        marginTop: 16,
    },
    toggleRow: {
        flexDirection: 'row',
        gap: 8,
    },
    toggleBtn: {
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderColor: '#CBD5E1',
        borderRadius: 10,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 48,
        paddingVertical: 10,
    },
    toggleBtnActive: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
    },
    darkToggleBtn: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    darkToggleBtnActive: {
        backgroundColor: '#2563EB',
        borderColor: '#3B82F6',
    },
    toggleBtnText: {
        color: '#334155',
        fontSize: 13,
        fontWeight: '600',
    },
    toggleBtnTextActive: {
        color: '#FFFFFF',
    },
    darkToggleBtnText: {
        color: '#94A3B8',
    },
    darkToggleBtnTextActive: {
        color: '#FFFFFF',
    },
    assetScroll: {
        flexDirection: 'row',
    },
    assetChip: {
        backgroundColor: '#F8FAFC',
        borderColor: '#CBD5E1',
        borderRadius: 8,
        borderWidth: 1,
        marginRight: 8,
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    assetChipActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    darkAssetChip: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    darkAssetChipActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: '#60A5FA',
    },
    assetChipText: {
        color: '#475569',
        fontSize: 12,
        fontWeight: '600',
    },
    assetChipTextActive: {
        color: '#1D4ED8',
    },
    darkAssetChipText: {
        color: '#94A3B8',
    },
    darkAssetChipTextActive: {
        color: '#93C5FD',
    },
    reasonsList: {
        gap: 8,
    },
    reasonCard: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 12,
        borderWidth: 1.5,
        minHeight: 56,
        padding: 12,
    },
    reasonCardSelected: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    darkReasonCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    darkReasonCardSelected: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: '#F59E0B',
    },
    reasonCardHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    reasonLabel: {
        color: '#1E293B',
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
    reasonLabelSelected: {
        color: '#92400E',
    },
    darkReasonLabel: {
        color: '#F1F5F9',
    },
    darkReasonLabelSelected: {
        color: '#FCD34D',
    },
    radioCircle: {
        alignItems: 'center',
        borderColor: '#94A3B8',
        borderRadius: 10,
        borderWidth: 1.5,
        height: 18,
        justifyContent: 'center',
        width: 18,
    },
    radioCircleSelected: {
        borderColor: '#F59E0B',
    },
    darkRadioCircle: {
        borderColor: '#64748B',
    },
    darkRadioCircleSelected: {
        borderColor: '#F59E0B',
    },
    radioInner: {
        backgroundColor: '#F59E0B',
        borderRadius: 5,
        height: 10,
        width: 10,
    },
    reasonDesc: {
        color: '#64748B',
        fontSize: 12,
        marginLeft: 26,
        marginTop: 4,
    },
    darkReasonDesc: {
        color: '#94A3B8',
    },
    dvirNoticeBox: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
        borderRadius: 10,
        borderWidth: 1,
        marginTop: 12,
        padding: 12,
    },
    darkDvirNoticeBox: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderColor: '#78350F',
    },
    dvirNoticeHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
        marginBottom: 4,
    },
    dvirNoticeTitle: {
        color: '#B45309',
        fontSize: 12,
        fontWeight: '700',
    },
    dvirNoticeBody: {
        color: '#92400E',
        fontSize: 11,
        lineHeight: 16,
    },
    dvirLinkBtn: {
        alignItems: 'center',
        backgroundColor: '#E0F2FE',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        marginTop: 8,
        minHeight: 48,
        paddingVertical: 8,
    },
    dvirLinkBtnText: {
        color: '#0369A1',
        fontSize: 12,
        fontWeight: '600',
    },
    minutesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    minuteChip: {
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderColor: '#CBD5E1',
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 48,
        minWidth: 50,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    minuteChipSelected: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    darkMinuteChip: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    darkMinuteChipSelected: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#F59E0B',
    },
    minuteChipText: {
        color: '#334155',
        fontSize: 13,
        fontWeight: '600',
    },
    minuteChipTextSelected: {
        color: '#92400E',
    },
    darkMinuteChipText: {
        color: '#94A3B8',
    },
    darkMinuteChipTextActive: {
        color: '#FCD34D',
    },
    notesInput: {
        backgroundColor: '#F8FAFC',
        borderColor: '#CBD5E1',
        borderRadius: 10,
        borderWidth: 1,
        color: '#0F172A',
        fontSize: 13,
        minHeight: 72,
        padding: 12,
        textAlignVertical: 'top',
    },
    darkNotesInput: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        color: '#F8FAFC',
    },
    errorBox: {
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 6,
        marginTop: 12,
        padding: 10,
    },
    errorText: {
        color: '#DC2626',
        fontSize: 12,
        fontWeight: '500',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
        paddingTop: 12,
    },
    cancelBtn: {
        alignItems: 'center',
        borderColor: '#CBD5E1',
        borderRadius: 10,
        borderWidth: 1,
        flex: 1,
        justifyContent: 'center',
        minHeight: 48,
        paddingVertical: 12,
    },
    darkCancelBtn: {
        borderColor: '#334155',
    },
    cancelBtnText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600',
    },
    darkCancelBtnText: {
        color: '#94A3B8',
    },
    submitBtn: {
        alignItems: 'center',
        backgroundColor: '#D97706',
        borderRadius: 10,
        flex: 2,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 52,
        paddingVertical: 12,
    },
    submitBtnDisabled: {
        opacity: 0.6,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
});
