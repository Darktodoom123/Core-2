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
import { createHosSharedStyles } from './hos-shared-styles';
import type { DutyStatusOptionConfig } from './hos-types';

export interface HosCertifyCardProps {
    activeConfig: DutyStatusOptionConfig;
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
    // Only a server-accepted change is green; pending is informational, failed is critical.
    const stampTone =
        pendingDutyState === 'failed'
            ? {
                  surface: theme.hazardRedLight,
                  edge: theme.hazardRed,
                  text: theme.hazardRedText,
              }
            : pendingDutyState
              ? {
                    surface: theme.actionCobaltLight,
                    edge: theme.actionCobalt,
                    text: theme.textPrimary,
                }
              : {
                    surface: theme.successEmeraldLight,
                    edge: theme.successEmerald,
                    text: theme.successEmeraldText,
                };
    const hosSharedStyles = useThemedStyles(createHosSharedStyles);

    return (
        <View style={[hosSharedStyles.sectionCard]}>
            <Text style={[styles.inputLabel]}>
                Duty Transition Remarks &amp; Notes
            </Text>
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
                    accessibilityLabel="Update and certify duty status"
                    accessibilityRole="button"
                    disabled={!isCertified}
                    onPress={handleConfirm}
                    style={({ pressed }) => [
                        styles.actionButton,
                        !isCertified && styles.actionButtonDisabled,
                        pressed && hosSharedStyles.actionButtonPressed,
                    ]}
                    testID="confirm-hos-btn"
                >
                    <Text style={[styles.actionBtnText]}>
                        ✓ Update &amp; Certify Duty Status
                    </Text>
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
                            ? '⚠ DUTY STATUS NOT ACCEPTED'
                            : pendingDutyState
                              ? '↻ DUTY STATUS PENDING SYNC'
                              : '✓ DUTY STATUS UPDATED & CERTIFIED'}
                    </Text>
                    <Text
                        style={[
                            styles.signedStampSub,
                            { color: theme.textPrimary },
                        ]}
                    >
                        {pendingDutyState === 'failed'
                            ? 'Review the failed action in Outbox.'
                            : pendingDutyState
                              ? `Waiting for server acceptance · ${activeConfig.title}`
                              : `Accepted: ${activeConfig.title} (${new Date().toLocaleTimeString()})`}
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
