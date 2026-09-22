import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    Vibration,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import type { DutyStatus, StandbyReason } from '../../types/index';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { colors, shadows, sharedStyles } from '../nativeStyles';

export interface DutyStatusSelectorModalProps {
    visible: boolean;
    currentDutyStatus: DutyStatus;
    hoursElapsed?: number | null;
    maxShiftHours?: number;
    onClose: () => void;
    onSelectDutyStatus: (
        dutyStatus: DutyStatus,
        standbyReason?: StandbyReason,
        remarks?: string,
    ) => void;
}

interface DutyOption {
    status: DutyStatus;
    badge: string;
    title: string;
    subtitle: string;
    iconName: IconName;
    badgeColor: string;
    badgeTextColor: string;
    borderColor: string;
    bgColor: string;
    darkBgColor: string;
}

const DUTY_OPTIONS: DutyOption[] = [
    {
        status: 'operating',
        badge: 'OPR',
        title: 'On Duty — Crane / Machine Operating',
        subtitle: 'Active site lifting, rigging, crane operations, excavation',
        iconName: 'crane',
        badgeColor: '#D97706',
        badgeTextColor: '#FFFFFF',
        borderColor: '#F59E0B',
        bgColor: '#FFFBEB',
        darkBgColor: 'rgba(245, 158, 11, 0.16)',
    },
    {
        status: 'driving',
        badge: 'DRV',
        title: 'On Duty — Driving / Transit',
        subtitle: 'Transporting crane or equipment on road/highway',
        iconName: 'truck',
        badgeColor: '#2563EB',
        badgeTextColor: '#FFFFFF',
        borderColor: '#3B82F6',
        bgColor: '#EFF6FF',
        darkBgColor: 'rgba(59, 130, 246, 0.16)',
    },
    {
        status: 'standby',
        badge: 'SBY',
        title: 'On Duty — Standby / Delay (Demurrage)',
        subtitle: 'Waiting on client, concrete trucks, permits, or weather',
        iconName: 'clock',
        badgeColor: '#EA580C',
        badgeTextColor: '#FFFFFF',
        borderColor: '#F97316',
        bgColor: '#FFF7ED',
        darkBgColor: 'rgba(249, 115, 22, 0.16)',
    },
    {
        status: 'on_break',
        badge: 'BRK',
        title: 'On Break — Meal / Rest Period',
        subtitle: 'Mandatory rest or lunch pause',
        iconName: 'tools',
        badgeColor: '#059669',
        badgeTextColor: '#FFFFFF',
        borderColor: '#10B981',
        bgColor: '#ECFDF5',
        darkBgColor: 'rgba(16, 185, 129, 0.16)',
    },
    {
        status: 'off_duty',
        badge: 'OFF',
        title: 'Off Duty — Shift Complete',
        subtitle: 'Clocked out from work for the day',
        iconName: 'power',
        badgeColor: '#475569',
        badgeTextColor: '#FFFFFF',
        borderColor: '#64748B',
        bgColor: '#F8FAFC',
        darkBgColor: 'rgba(148, 163, 184, 0.16)',
    },
];

const STANDBY_REASONS: Array<{ reason: StandbyReason; label: string }> = [
    {
        reason: 'client_delay',
        label: 'Client Site Delay (Billable Demurrage)',
    },
    {
        reason: 'waiting_on_concrete',
        label: 'Waiting on Concrete Mixer Pour',
    },
    {
        reason: 'weather_hold',
        label: 'Weather Hold (High Wind / Typhoon Signal)',
    },
    {
        reason: 'site_access_blocked',
        label: 'Site Access / Road Ingress Blocked',
    },
    {
        reason: 'rigging_adjustment',
        label: 'Rigging & Outrigger Ground Re-checking',
    },
    {
        reason: 'mechanical_inspection',
        label: 'Mechanical Safety Walkaround Inspection',
    },
    {
        reason: 'other',
        label: 'Other Operational Standby Reason',
    },
];

export const DutyStatusSelectorModal: React.FC<
    DutyStatusSelectorModalProps
> = ({
    visible,
    currentDutyStatus,
    hoursElapsed = null,
    maxShiftHours = 10,
    onClose,
    onSelectDutyStatus,
}) => {
    const { isDarkHud } = useTheme();
    const insets = useSafeAreaInsets();
    const [overriddenStatus, setOverriddenStatus] = useState<{
        propStatus: DutyStatus;
        localStatus: DutyStatus;
    } | null>(null);
    const [standbyReason, setStandbyReason] =
        useState<StandbyReason>('client_delay');
    const [remarks, setRemarks] = useState('');

    const selectedStatus: DutyStatus =
        overriddenStatus && overriddenStatus.propStatus === currentDutyStatus
            ? overriddenStatus.localStatus
            : currentDutyStatus;

    const shiftProgressPercent =
        hoursElapsed === null
            ? null
            : Math.min(100, Math.round((hoursElapsed / maxShiftHours) * 100));
    const isShiftNearLimit =
        hoursElapsed !== null && hoursElapsed >= maxShiftHours * 0.8;
    const isShiftExceeded =
        hoursElapsed !== null && hoursElapsed >= maxShiftHours;

    const handleSelectStatus = (status: DutyStatus) => {
        try {
            Vibration.vibrate(30);
        } catch {
            // Ignore on unsupported platforms
        }

        setOverriddenStatus({
            propStatus: currentDutyStatus,
            localStatus: status,
        });
    };

    const handleSelectReason = (reason: StandbyReason) => {
        try {
            Vibration.vibrate(25);
        } catch {
            // Ignore on unsupported platforms
        }

        setStandbyReason(reason);
    };

    const handleConfirm = () => {
        onSelectDutyStatus(
            selectedStatus,
            selectedStatus === 'standby' ? standbyReason : undefined,
            remarks.trim() ? remarks.trim() : undefined,
        );
        onClose();
    };

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            transparent
            visible={visible}
        >
            <View style={styles.backdrop} testID="duty-status-modal-backdrop">
                <View
                    style={[
                        styles.sheetContainer,
                        isDarkHud && styles.darkSheetContainer,
                        { paddingBottom: Math.max(20, insets.bottom + 12) },
                    ]}
                    testID="duty-status-sheet"
                >
                    {/* Sheet Header */}
                    <View style={styles.sheetHeader}>
                        <View
                            style={[
                                styles.handleBar,
                                isDarkHud && styles.darkHandleBar,
                            ]}
                        />
                        <View style={styles.headerRow}>
                            <View style={styles.titleGroup}>
                                <Text
                                    accessibilityRole="header"
                                    style={[
                                        styles.sheetTitle,
                                        isDarkHud && styles.darkSheetTitle,
                                    ]}
                                >
                                    Select Duty Status
                                </Text>
                                <Text
                                    style={[
                                        styles.sheetSubtitle,
                                        isDarkHud && styles.darkSheetSubtitle,
                                    ]}
                                >
                                    Alibaton Heavy Operations · Field Dispatch
                                </Text>
                            </View>
                            <Pressable
                                accessibilityLabel="Close duty status modal"
                                accessibilityRole="button"
                                hitSlop={{
                                    top: 12,
                                    bottom: 12,
                                    left: 12,
                                    right: 12,
                                }}
                                onPress={onClose}
                                style={({ pressed }) => [
                                    styles.closeButton,
                                    isDarkHud && styles.darkCloseButton,
                                    pressed && styles.pressed,
                                ]}
                                testID="close-duty-modal-btn"
                            >
                                <Icon
                                    name="close"
                                    size={18}
                                    color={isDarkHud ? '#F1F5F9' : colors.text}
                                />
                            </Pressable>
                        </View>
                    </View>

                    {/* Shift & Fatigue Clock Gauge */}
                    <View
                        style={[
                            styles.shiftGaugeCard,
                            isShiftExceeded
                                ? isDarkHud
                                    ? styles.darkGaugeExceeded
                                    : styles.gaugeExceeded
                                : isShiftNearLimit
                                  ? isDarkHud
                                      ? styles.darkGaugeWarning
                                      : styles.gaugeWarning
                                  : isDarkHud
                                    ? styles.darkGaugeNormal
                                    : styles.gaugeNormal,
                        ]}
                    >
                        <View style={styles.gaugeHeader}>
                            <View style={styles.gaugeTitleRow}>
                                <Icon
                                    name="clock"
                                    size={15}
                                    color={
                                        isShiftExceeded
                                            ? isDarkHud
                                                ? '#F87171'
                                                : colors.redDark
                                            : isShiftNearLimit
                                              ? isDarkHud
                                                  ? '#FBBF24'
                                                  : colors.warningDark
                                              : isDarkHud
                                                ? '#34D399'
                                                : colors.greenDark
                                    }
                                />
                                <Text
                                    style={[
                                        styles.gaugeTitle,
                                        isDarkHud && styles.darkGaugeTitle,
                                    ]}
                                >
                                    Shift Duty Clock:{' '}
                                    {hoursElapsed === null
                                        ? 'Unavailable'
                                        : `${hoursElapsed.toFixed(1)}h`}{' '}
                                    / {maxShiftHours}h Limit
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.gaugeStatusLabel,
                                    isShiftExceeded
                                        ? isDarkHud
                                            ? styles.darkGaugeStatusExceeded
                                            : styles.gaugeStatusExceeded
                                        : isShiftNearLimit
                                          ? isDarkHud
                                              ? styles.darkGaugeStatusWarning
                                              : styles.gaugeStatusWarning
                                          : isDarkHud
                                            ? styles.darkGaugeStatusNormal
                                            : styles.gaugeStatusNormal,
                                ]}
                            >
                                {hoursElapsed === null
                                    ? 'Unavailable'
                                    : isShiftExceeded
                                      ? 'Limit Reached'
                                      : isShiftNearLimit
                                        ? 'Rest Due Soon'
                                        : 'Normal Duty'}
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.progressBarBackground,
                                isDarkHud && styles.darkProgressBarBackground,
                            ]}
                        >
                            <View
                                style={[
                                    styles.progressBarFill,
                                    { width: `${shiftProgressPercent ?? 0}%` },
                                    isShiftExceeded
                                        ? styles.progressFillRed
                                        : isShiftNearLimit
                                          ? styles.progressFillAmber
                                          : styles.progressFillGreen,
                                ]}
                            />
                        </View>
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        style={styles.scrollView}
                    >
                        <Text
                            style={[
                                styles.sectionLabel,
                                isDarkHud && styles.darkSectionLabel,
                            ]}
                        >
                            CHOOSE OPERATING DUTY
                        </Text>

                        {/* 5 Duty Status Options */}
                        <View style={styles.optionsList}>
                            {DUTY_OPTIONS.map((opt) => {
                                const isSelected =
                                    selectedStatus === opt.status;

                                return (
                                    <Pressable
                                        accessibilityLabel={`${opt.title}${isSelected ? ', selected' : ''}`}
                                        accessibilityRole="radio"
                                        accessibilityState={{
                                            checked: isSelected,
                                        }}
                                        hitSlop={{
                                            top: 6,
                                            bottom: 6,
                                            left: 6,
                                            right: 6,
                                        }}
                                        key={opt.status}
                                        onPress={() =>
                                            handleSelectStatus(opt.status)
                                        }
                                        style={({ pressed }) => [
                                            styles.dutyOptionCard,
                                            isDarkHud
                                                ? styles.darkDutyOptionCard
                                                : styles.lightDutyOptionCard,
                                            isSelected &&
                                                (isDarkHud
                                                    ? [
                                                          styles.darkDutyOptionSelected,
                                                          {
                                                              borderColor:
                                                                  opt.borderColor,
                                                              backgroundColor:
                                                                  opt.darkBgColor,
                                                          },
                                                      ]
                                                    : [
                                                          styles.lightDutyOptionSelected,
                                                          {
                                                              borderColor:
                                                                  opt.borderColor,
                                                              backgroundColor:
                                                                  opt.bgColor,
                                                          },
                                                      ]),
                                            pressed && styles.pressed,
                                        ]}
                                        testID={`duty-option-${opt.status}`}
                                    >
                                        <View
                                            pointerEvents="none"
                                            style={[
                                                styles.statusBadge,
                                                {
                                                    backgroundColor:
                                                        opt.badgeColor,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.statusBadgeText,
                                                    {
                                                        color: opt.badgeTextColor,
                                                    },
                                                ]}
                                            >
                                                {opt.badge}
                                            </Text>
                                        </View>

                                        <View
                                            pointerEvents="none"
                                            style={styles.dutyCopy}
                                        >
                                            <Text
                                                style={[
                                                    styles.dutyTitle,
                                                    isDarkHud &&
                                                        styles.darkDutyTitle,
                                                ]}
                                            >
                                                {opt.title}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.dutySubtitle,
                                                    isDarkHud &&
                                                        styles.darkDutySubtitle,
                                                ]}
                                            >
                                                {opt.subtitle}
                                            </Text>
                                        </View>

                                        <View
                                            pointerEvents="none"
                                            style={[
                                                styles.radioCircle,
                                                isDarkHud &&
                                                    styles.darkRadioCircle,
                                                isSelected && [
                                                    styles.radioCircleSelected,
                                                    {
                                                        borderColor:
                                                            opt.borderColor,
                                                    },
                                                ],
                                            ]}
                                        >
                                            {isSelected ? (
                                                <View
                                                    style={[
                                                        styles.radioDotInner,
                                                        {
                                                            backgroundColor:
                                                                opt.borderColor,
                                                        },
                                                    ]}
                                                />
                                            ) : null}
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* Standby Demurrage Reason Selector (Shown when standby selected) */}
                        {selectedStatus === 'standby' ? (
                            <View
                                style={[
                                    styles.standbySection,
                                    isDarkHud && styles.darkStandbySection,
                                ]}
                                testID="standby-reason-section"
                            >
                                <View style={styles.standbyHeader}>
                                    <Text
                                        style={[
                                            styles.standbySectionTitle,
                                            isDarkHud &&
                                                styles.darkStandbySectionTitle,
                                        ]}
                                    >
                                        STANDBY REASON (DEMURRAGE BILLING)
                                    </Text>
                                    <View style={styles.demurrageBadge}>
                                        <Text style={styles.demurrageBadgeText}>
                                            BILLABLE
                                        </Text>
                                    </View>
                                </View>
                                <Text
                                    style={[
                                        styles.standbyHelper,
                                        isDarkHud && styles.darkStandbyHelper,
                                    ]}
                                >
                                    Select delay cause to automatically attach
                                    to client time logs:
                                </Text>

                                <View style={styles.reasonsList}>
                                    {STANDBY_REASONS.map((r) => {
                                        const isReasonActive =
                                            standbyReason === r.reason;

                                        return (
                                            <Pressable
                                                accessibilityRole="checkbox"
                                                hitSlop={{
                                                    top: 4,
                                                    bottom: 4,
                                                    left: 4,
                                                    right: 4,
                                                }}
                                                key={r.reason}
                                                onPress={() =>
                                                    handleSelectReason(r.reason)
                                                }
                                                style={[
                                                    styles.reasonItem,
                                                    isDarkHud
                                                        ? styles.darkReasonItem
                                                        : styles.lightReasonItem,
                                                    isReasonActive &&
                                                        (isDarkHud
                                                            ? styles.darkReasonItemActive
                                                            : styles.reasonItemActive),
                                                ]}
                                                testID={`reason-${r.reason}`}
                                            >
                                                <Icon
                                                    name={
                                                        isReasonActive
                                                            ? 'check-circle'
                                                            : 'alert'
                                                    }
                                                    size={15}
                                                    color={
                                                        isReasonActive
                                                            ? isDarkHud
                                                                ? '#FBBF24'
                                                                : colors.amberDark
                                                            : isDarkHud
                                                              ? '#64748B'
                                                              : colors.muted
                                                    }
                                                />
                                                <Text
                                                    style={[
                                                        styles.reasonText,
                                                        isDarkHud &&
                                                            styles.darkReasonText,
                                                        isReasonActive &&
                                                            (isDarkHud
                                                                ? styles.darkReasonTextActive
                                                                : styles.reasonTextActive),
                                                    ]}
                                                >
                                                    {r.label}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        ) : null}

                        {/* Remarks Input */}
                        <View style={styles.remarksGroup}>
                            <Text
                                style={[
                                    styles.sectionLabel,
                                    isDarkHud && styles.darkSectionLabel,
                                ]}
                            >
                                OPTIONAL STATUS REMARKS
                            </Text>
                            <TextInput
                                multiline
                                numberOfLines={2}
                                onChangeText={setRemarks}
                                placeholder="Note site conditions, gate instructions, delay details..."
                                placeholderTextColor={
                                    isDarkHud ? '#64748B' : colors.muted
                                }
                                style={[
                                    styles.remarksInput,
                                    isDarkHud && styles.darkRemarksInput,
                                ]}
                                testID="duty-remarks-input"
                                value={remarks}
                            />
                        </View>
                    </ScrollView>

                    {/* Footer Action Button */}
                    <View style={styles.footerActions}>
                        <Pressable
                            accessibilityLabel="Confirm and change duty status"
                            accessibilityRole="button"
                            onPress={handleConfirm}
                            style={({ pressed }) => [
                                sharedStyles.button,
                                styles.confirmButton,
                                isDarkHud && styles.darkConfirmButton,
                                pressed && styles.pressed,
                            ]}
                            testID="confirm-duty-status-btn"
                        >
                            <Icon
                                name="check-circle"
                                size={18}
                                color={isDarkHud ? '#0F172A' : '#FFFFFF'}
                            />
                            <Text
                                style={[
                                    sharedStyles.buttonText,
                                    isDarkHud && styles.darkConfirmButtonText,
                                ]}
                            >
                                Confirm Duty Status
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        paddingTop: 10,
        ...shadows.lg,
    },
    darkSheetContainer: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        borderTopWidth: 1,
    },
    sheetHeader: {
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingBottom: 10,
    },
    handleBar: {
        backgroundColor: colors.border,
        borderRadius: 3,
        height: 4,
        marginBottom: 12,
        width: 44,
    },
    darkHandleBar: {
        backgroundColor: '#334155',
    },
    headerRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    titleGroup: {
        flex: 1,
    },
    sheetTitle: {
        color: colors.text,
        fontSize: 19,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    darkSheetTitle: {
        color: '#F8FAFC',
    },
    sheetSubtitle: {
        color: colors.secondary,
        fontSize: 12,
        marginTop: 2,
    },
    darkSheetSubtitle: {
        color: '#94A3B8',
    },
    closeButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    darkCloseButton: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderWidth: 1,
    },
    shiftGaugeCard: {
        borderRadius: 14,
        borderWidth: 1,
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 12,
    },
    gaugeNormal: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
    },
    gaugeWarning: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
    },
    gaugeExceeded: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    darkGaugeNormal: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderColor: 'rgba(16, 185, 129, 0.35)',
    },
    darkGaugeWarning: {
        backgroundColor: 'rgba(245, 158, 11, 0.14)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    darkGaugeExceeded: {
        backgroundColor: 'rgba(239, 68, 68, 0.16)',
        borderColor: 'rgba(239, 68, 68, 0.45)',
    },
    gaugeHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    gaugeTitleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    gaugeTitle: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    darkGaugeTitle: {
        color: '#F8FAFC',
    },
    gaugeStatusLabel: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    gaugeStatusNormal: {
        color: colors.greenDark,
    },
    gaugeStatusWarning: {
        color: colors.warningDark,
    },
    gaugeStatusExceeded: {
        color: colors.redDark,
    },
    darkGaugeStatusNormal: {
        color: '#34D399',
    },
    darkGaugeStatusWarning: {
        color: '#FBBF24',
    },
    darkGaugeStatusExceeded: {
        color: '#F87171',
    },
    progressBarBackground: {
        backgroundColor: colors.border,
        borderRadius: 4,
        height: 6,
        overflow: 'hidden',
        width: '100%',
    },
    darkProgressBarBackground: {
        backgroundColor: '#334155',
    },
    progressBarFill: {
        borderRadius: 4,
        height: '100%',
    },
    progressFillGreen: {
        backgroundColor: colors.green,
    },
    progressFillAmber: {
        backgroundColor: colors.amber,
    },
    progressFillRed: {
        backgroundColor: colors.red,
    },
    scrollView: {
        flexGrow: 0,
        maxHeight: 440,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    sectionLabel: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.6,
        marginBottom: 8,
        marginTop: 4,
    },
    darkSectionLabel: {
        color: '#94A3B8',
    },
    optionsList: {
        gap: 8,
        marginBottom: 14,
    },
    dutyOptionCard: {
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1.5,
        flexDirection: 'row',
        gap: 12,
        padding: 12,
        ...shadows.sm,
    },
    lightDutyOptionCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
    },
    darkDutyOptionCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    lightDutyOptionSelected: {
        borderWidth: 2,
    },
    darkDutyOptionSelected: {
        borderWidth: 2,
    },
    statusBadge: {
        alignItems: 'center',
        borderRadius: 8,
        height: 36,
        justifyContent: 'center',
        width: 44,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    dutyCopy: {
        flex: 1,
        gap: 2,
    },
    dutyTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    darkDutyTitle: {
        color: '#F8FAFC',
    },
    dutySubtitle: {
        color: colors.secondary,
        fontSize: 11,
        lineHeight: 15,
    },
    darkDutySubtitle: {
        color: '#CBD5E1',
    },
    radioCircle: {
        alignItems: 'center',
        borderColor: colors.borderStrong,
        borderRadius: 11,
        borderWidth: 2,
        height: 22,
        justifyContent: 'center',
        width: 22,
    },
    darkRadioCircle: {
        borderColor: '#475569',
    },
    radioCircleSelected: {
        borderColor: colors.primary,
    },
    radioDotInner: {
        backgroundColor: colors.primary,
        borderRadius: 6,
        height: 12,
        width: 12,
    },
    standbySection: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 14,
        padding: 12,
    },
    darkStandbySection: {
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    standbyHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    standbySectionTitle: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.4,
    },
    darkStandbySectionTitle: {
        color: '#FDE68A',
    },
    demurrageBadge: {
        backgroundColor: colors.amberDark,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    demurrageBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    standbyHelper: {
        color: colors.secondary,
        fontSize: 11,
        marginBottom: 8,
    },
    darkStandbyHelper: {
        color: '#CBD5E1',
    },
    reasonsList: {
        gap: 6,
    },
    reasonItem: {
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 9,
    },
    lightReasonItem: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
    },
    darkReasonItem: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    reasonItemActive: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    darkReasonItemActive: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#F59E0B',
    },
    reasonText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '600',
    },
    darkReasonText: {
        color: '#E2E8F0',
    },
    reasonTextActive: {
        color: colors.amberDark,
        fontWeight: '800',
    },
    darkReasonTextActive: {
        color: '#FDE68A',
        fontWeight: '800',
    },
    remarksGroup: {
        marginTop: 4,
    },
    remarksInput: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        color: colors.text,
        fontSize: 13,
        minHeight: 56,
        paddingHorizontal: 12,
        paddingVertical: 10,
        textAlignVertical: 'top',
    },
    darkRemarksInput: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        color: '#F8FAFC',
    },
    footerActions: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    confirmButton: {
        backgroundColor: colors.amberDark,
        flexDirection: 'row',
        gap: 8,
        minHeight: 52,
        borderRadius: 12,
    },
    darkConfirmButton: {
        backgroundColor: '#F59E0B',
    },
    darkConfirmButtonText: {
        color: '#0F172A',
        fontWeight: '900',
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.985 }],
    },
});
