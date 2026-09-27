import React from 'react';
import {
    Animated,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { DutyStatus } from '../../types/index';
import { createHosSharedStyles } from './hos-shared-styles';
import type { DutyStatusOptionConfig } from './hos-types';

export interface HosCertifyCardProps {
    activeConfig: DutyStatusOptionConfig;
    /** Why the change can't be confirmed yet, shown on the button. */
    blockedLabel?: string | null;
    /** The status the server last accepted. */
    currentStatus: DutyStatus;
    certCheckScale: Animated.Value;
    handleConfirm: () => void;
    handleToggleCert: () => void;
    isCertified: boolean;
    isSaved: boolean;
    pendingDutyState: 'queued' | 'syncing' | 'failed' | null;
    remarks: string;
    setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
    setRemarks: React.Dispatch<React.SetStateAction<string>>;
    stampOpacity: Animated.Value;
    stampScale: Animated.Value;
}

export const HosCertifyCard: React.FC<HosCertifyCardProps> = ({
    activeConfig,
    blockedLabel = null,
    currentStatus,
    certCheckScale,
    handleConfirm,
    handleToggleCert,
    isCertified,
    isSaved,
    pendingDutyState,
    remarks,
    setIsSaved,
    setRemarks,
    stampOpacity,
    stampScale,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    // Green only once the server reports the new status; until then the
    // change is waiting, and a refused change is red.
    const isAccepted =
        !pendingDutyState && currentStatus === activeConfig.status;
    const stampTone =
        pendingDutyState === 'failed'
            ? {
                  surface: theme.hazardRedLight,
                  edge: theme.hazardRed,
                  text: theme.hazardRedText,
              }
            : isAccepted
              ? {
                    surface: theme.successEmeraldLight,
                    edge: theme.successEmerald,
                    text: theme.successEmeraldText,
                }
              : {
                    surface: theme.surfaceHighlight,
                    edge: theme.borderStrong,
                    text: theme.textPrimary,
                };
    const isCurrent = currentStatus === activeConfig.status;
    const isOffDuty = activeConfig.status === 'off_duty';
    const canConfirm = isCertified && !isCurrent && !blockedLabel;
    const actionLabel = isCurrent
        ? 'This is your current status'
        : blockedLabel
          ? blockedLabel
          : isOffDuty
            ? 'End shift & go off duty'
            : `Change to ${activeConfig.title}`;
    const hosSharedStyles = useThemedStyles(createHosSharedStyles);

    return (
        <View style={[hosSharedStyles.sectionCard]}>
            <Text style={[styles.inputLabel]}>Remarks · optional</Text>
            <TextInput
                accessibilityLabel="Duty transition remarks"
                multiline
                numberOfLines={3}
                onChangeText={(txt) => {
                    setRemarks(txt);
                    setIsSaved(false);
                }}
                placeholder="e.g. Lift completed at Taguig site; transitioning to road transit back to yard."
                placeholderTextColor={theme.textMuted}
                style={[styles.input]}
                value={remarks}
                testID="hos-remarks-input"
            />

            {/* Legal Operator Certification */}
            <Pressable
                accessibilityLabel="Legal certification of hours of service"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isCertified }}
                onPress={handleToggleCert}
                style={styles.certCheckRow}
                testID="hos-cert-check"
            >
                <Animated.View
                    style={[
                        styles.certBox,
                        isCertified && styles.certBoxChecked,
                        { transform: [{ scale: certCheckScale }] },
                    ]}
                >
                    {isCertified ? (
                        <Text style={[styles.certCheckMark]}>✓</Text>
                    ) : null}
                </Animated.View>
                <Text style={[styles.certCheckLabel]}>
                    I certify that these duty status entries and hours of
                    service are true, complete, and accurate for this shift.
                </Text>
            </Pressable>

            {/* Update & Certify Duty Status Action Button / Stamp */}
            {!isSaved ? (
                <Pressable
                    accessibilityLabel={actionLabel}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canConfirm }}
                    disabled={!canConfirm}
                    onPress={handleConfirm}
                    style={({ pressed }) => [
                        styles.actionButton,
                        !canConfirm && styles.actionButtonDisabled,
                        pressed && hosSharedStyles.actionButtonPressed,
                    ]}
                    testID="confirm-hos-btn"
                >
                    <Text style={[styles.actionBtnText]}>{actionLabel}</Text>
                </Pressable>
            ) : (
                <Animated.View
                    style={[
                        styles.signedStamp,
                        {
                            backgroundColor: stampTone.surface,
                            borderColor: stampTone.edge,
                        },
                        {
                            opacity: stampOpacity,
                            transform: [{ scale: stampScale }],
                        },
                    ]}
                    testID="hos-confirmed-stamp"
                >
                    <Text
                        style={[
                            styles.signedStampTitle,
                            { color: stampTone.text },
                        ]}
                    >
                        {pendingDutyState === 'failed'
                            ? 'Not accepted'
                            : isAccepted
                              ? 'Accepted by the server'
                              : 'Waiting for the server'}
                    </Text>
                    <Text
                        style={[
                            styles.signedStampSub,
                            { color: theme.textPrimary },
                        ]}
                    >
                        {pendingDutyState === 'failed'
                            ? 'See the message at the top of this screen.'
                            : activeConfig.title}
                    </Text>
                </Animated.View>
            )}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        actionBtnText: {
            color: theme.surfaceDark,
            fontSize: 15,
            fontWeight: '700',
        },
        actionButton: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            justifyContent: 'center',
            minHeight: 52,
            width: '100%',
        },
        actionButtonDisabled: {
            opacity: 0.45,
        },
        certBox: {
            alignItems: 'center',
            borderColor: theme.borderStrong,
            borderRadius: 6,
            borderWidth: 2,
            height: 24,
            justifyContent: 'center',
            width: 24,
        },
        certBoxChecked: {
            backgroundColor: theme.brandAmber,
            borderColor: theme.brandAmber,
        },
        certCheckLabel: {
            color: theme.textSecondary,
            flex: 1,
            fontSize: 13,
            lineHeight: 16,
        },
        certCheckMark: {
            color: theme.surfaceDark,
            fontSize: 14,
            fontWeight: '700',
        },
        certCheckRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 10,
            marginBottom: 14,
            minHeight: 48,
            paddingHorizontal: 2,
        },
        input: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            color: theme.textPrimary,
            fontSize: 16,
            marginBottom: 14,
            minHeight: 68,
            paddingHorizontal: 14,
            paddingVertical: 11,
            textAlignVertical: 'top',
        },
        inputLabel: {
            color: theme.textPrimary,
            fontSize: 13,
            fontWeight: '700',
            marginBottom: 8,
        },
        signedStamp: {
            borderRadius: 12,
            borderWidth: 1.5,
            padding: 14,
        },
        signedStampSub: {
            fontSize: 12,
            fontWeight: '500',
            marginTop: 2,
        },
        signedStampTitle: {
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 0.5,
        },
    });
