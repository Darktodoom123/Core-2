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
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type {
    DelayContextType,
    DelayReasonCode,
    DispatchJob,
    ReportDelayPayload,
} from '../../types/index';
import { Icon } from '../common/Icon';
import { DelayChoiceChip, DelayReasonCard } from './report-delay/delay-options';
import {
    ESTIMATE_OPTIONS,
    ON_SITE_REASONS,
    TRANSIT_REASONS,
} from './report-delay/delay-reasons';
import { DvirDefectNotice } from './report-delay/dvir-defect-notice';

export interface ReportDelayModalProps {
    visible: boolean;
    job: DispatchJob;
    initialContext?: DelayContextType;
    onClose: () => void;
    onSubmit: (payload: ReportDelayPayload) => Promise<void> | void;
    onNavigateDvir?: () => void;
}

export const ReportDelayModal: React.FC<ReportDelayModalProps> = ({
    visible,
    job,
    initialContext,
    onClose,
    onSubmit,
    onNavigateDvir,
}) => {
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

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

    const selectContext = (next: DelayContextType) => {
        setContext(next);
        setSelectedReason(null);
    };

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
                <View pointerEvents="none" style={styles.scrim} />
                <View
                    accessibilityViewIsModal
                    style={[
                        styles.sheetContainer,
                        { paddingBottom: Math.max(insets.bottom, 16) },
                    ]}
                    testID="report-delay-sheet"
                >
                    <View style={styles.headerRow}>
                        <View style={styles.headerLeftGroup}>
                            <View style={styles.headerIconWrap}>
                                <Icon
                                    color={theme.warningOrangeText}
                                    name="alert"
                                    size={20}
                                />
                            </View>
                            <View style={styles.headerTitleCopy}>
                                <Text
                                    numberOfLines={1}
                                    style={styles.sheetTitle}
                                >
                                    Report Operational Delay
                                </Text>
                                <Text
                                    ellipsizeMode="tail"
                                    numberOfLines={2}
                                    style={styles.sheetSubtitle}
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
                                color={theme.textSecondary}
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
                        <Text style={styles.sectionHeading}>
                            OPERATIONAL STAGE
                        </Text>
                        <View accessibilityRole="radiogroup" style={styles.row}>
                            <DelayChoiceChip
                                accessibilityLabel="Transit Stage Delay"
                                grow
                                icon="truck"
                                isSelected={context === 'transit'}
                                label="Driving / Transit"
                                onPress={() => selectContext('transit')}
                                testID="context-transit-btn"
                            />
                            <DelayChoiceChip
                                accessibilityLabel="On-Site Stage Delay"
                                grow
                                icon="pin"
                                isSelected={context === 'on_site'}
                                label="On-Site Execution"
                                onPress={() => selectContext('on_site')}
                                testID="context-on_site-btn"
                            />
                        </View>

                        {job.asset_assignments &&
                        job.asset_assignments.length > 1 ? (
                            <View style={styles.sectionMargin}>
                                <Text style={styles.sectionHeading}>
                                    ASSIGNED ASSET AFFECTED
                                </Text>
                                <ScrollView
                                    accessibilityRole="radiogroup"
                                    contentContainerStyle={styles.row}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                >
                                    <DelayChoiceChip
                                        accessibilityLabel="Apply delay to entire dispatch job"
                                        isSelected={selectedAssetId === null}
                                        label="Entire Dispatch Job"
                                        onPress={() => setSelectedAssetId(null)}
                                        testID="asset-chip-whole-job"
                                    />
                                    {job.asset_assignments.map((assignment) => (
                                        <DelayChoiceChip
                                            accessibilityLabel={`Apply delay to ${assignment.asset_code}, ${assignment.asset_name}`}
                                            isSelected={
                                                selectedAssetId ===
                                                assignment.operational_asset_id
                                            }
                                            key={assignment.id}
                                            label={`${assignment.asset_code} (${assignment.asset_name})`}
                                            onPress={() =>
                                                setSelectedAssetId(
                                                    assignment.operational_asset_id,
                                                )
                                            }
                                            testID={`asset-chip-${assignment.operational_asset_id}`}
                                        />
                                    ))}
                                </ScrollView>
                            </View>
                        ) : null}

                        <Text
                            style={[
                                styles.sectionHeading,
                                styles.sectionMargin,
                            ]}
                        >
                            DELAY REASON (REQUIRED)
                        </Text>
                        <View
                            accessibilityRole="radiogroup"
                            style={styles.reasonsList}
                        >
                            {reasons.map((option) => (
                                <DelayReasonCard
                                    isSelected={selectedReason === option.code}
                                    key={option.code}
                                    onSelect={() =>
                                        setSelectedReason(option.code)
                                    }
                                    option={option}
                                />
                            ))}
                        </View>

                        {selectedReason === 'equipment_issue' ? (
                            <DvirDefectNotice
                                onOpenDvir={
                                    onNavigateDvir
                                        ? () => {
                                              onClose();
                                              onNavigateDvir();
                                          }
                                        : undefined
                                }
                            />
                        ) : null}

                        <Text
                            style={[
                                styles.sectionHeading,
                                styles.sectionMargin,
                            ]}
                        >
                            ESTIMATED IMPACT (MINUTES)
                        </Text>
                        <View
                            accessibilityRole="radiogroup"
                            style={styles.minutesRow}
                        >
                            {ESTIMATE_OPTIONS.map((mins) => (
                                <DelayChoiceChip
                                    accessibilityLabel={`${mins} minute estimated impact`}
                                    isSelected={estimatedMinutes === mins}
                                    key={mins}
                                    label={`+${mins}m`}
                                    onPress={() => setEstimatedMinutes(mins)}
                                    testID={`minute-chip-${mins}`}
                                />
                            ))}
                        </View>

                        <Text
                            style={[
                                styles.sectionHeading,
                                styles.sectionMargin,
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
                            placeholderTextColor={theme.textMuted}
                            style={styles.notesInput}
                            testID="delay-notes-input"
                            value={notes}
                        />

                        {errorMsg ? (
                            <View
                                accessibilityLiveRegion="assertive"
                                accessibilityRole="alert"
                                style={styles.errorBox}
                                testID="delay-error"
                            >
                                <Icon
                                    color={theme.hazardRedText}
                                    name="alert"
                                    size={16}
                                />
                                <Text style={styles.errorText}>{errorMsg}</Text>
                            </View>
                        ) : null}
                    </ScrollView>

                    <View style={styles.actionRow}>
                        <Pressable
                            accessibilityLabel="Cancel delay report"
                            accessibilityRole="button"
                            accessibilityState={{ disabled: isSubmitting }}
                            disabled={isSubmitting}
                            onPress={onClose}
                            style={styles.cancelBtn}
                            testID="cancel-delay-btn"
                        >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
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
                                    color={theme.surfaceDark}
                                    size="small"
                                />
                            ) : (
                                <>
                                    <Icon
                                        color={theme.surfaceDark}
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

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        scrim: {
            bottom: 0,
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
            backgroundColor: theme.surfaceDark,
            opacity: 0.65,
        },
        // Floating layer: the one place in this flow that carries a shadow.
        sheetContainer: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            elevation: 16,
            maxHeight: '90%',
            paddingHorizontal: 20,
            paddingTop: 20,
        },
        headerRow: {
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 16,
        },
        headerLeftGroup: {
            alignItems: 'center',
            flex: 1,
            flexDirection: 'row',
            gap: 10,
        },
        headerTitleCopy: {
            flex: 1,
            minWidth: 0,
        },
        headerIconWrap: {
            alignItems: 'center',
            backgroundColor: theme.warningOrangeLight,
            borderRadius: 12,
            height: 40,
            justifyContent: 'center',
            width: 40,
        },
        sheetTitle: {
            color: theme.textPrimary,
            fontSize: 17,
            fontWeight: '700',
        },
        sheetSubtitle: {
            color: theme.textSecondary,
            fontSize: 13,
            fontWeight: '500',
            marginTop: 2,
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
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.5,
            marginBottom: 8,
        },
        sectionMargin: {
            marginTop: 16,
        },
        row: {
            flexDirection: 'row',
            gap: 8,
        },
        reasonsList: {
            gap: 8,
        },
        minutesRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        notesInput: {
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 10,
            borderWidth: 1,
            color: theme.textPrimary,
            fontSize: 16,
            minHeight: 80,
            padding: 12,
            textAlignVertical: 'top',
        },
        errorBox: {
            alignItems: 'center',
            backgroundColor: theme.hazardRedLight,
            borderColor: theme.hazardRed,
            borderRadius: 10,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 6,
            marginTop: 12,
            padding: 10,
        },
        errorText: {
            color: theme.hazardRedText,
            flexShrink: 1,
            fontSize: 13,
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
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'center',
            minHeight: 52,
        },
        cancelBtnText: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
        },
        submitBtn: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            flex: 2,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 52,
        },
        submitBtnDisabled: {
            opacity: 0.6,
        },
        submitBtnText: {
            color: theme.surfaceDark,
            fontSize: 15,
            fontWeight: '700',
        },
    });
