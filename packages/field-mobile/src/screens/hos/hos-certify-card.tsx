import React from 'react';
import {
    Animated,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useTheme } from '../../theme';
import { hosSharedStyles } from './hos-shared-styles';
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
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                hosSharedStyles.sectionCard,
                isDarkHud && hosSharedStyles.darkSectionCard,
            ]}
        >
            <Text
                style={[styles.inputLabel, isDarkHud && styles.darkInputLabel]}
            >
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
                placeholderTextColor={isDarkHud ? '#64748B' : '#94A3B8'}
                style={[styles.input, isDarkHud && styles.darkInput]}
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
                        isDarkHud && styles.darkCertBox,
                        isCertified &&
                            (isDarkHud
                                ? styles.darkCertBoxChecked
                                : styles.certBoxChecked),
                        { transform: [{ scale: certCheckScale }] },
                    ]}
                >
                    {isCertified ? (
                        <Text
                            style={[
                                styles.certCheckMark,
                                isDarkHud && styles.darkCertCheckMark,
                            ]}
                        >
                            ✓
                        </Text>
                    ) : null}
                </Animated.View>
                <Text
                    style={[
                        styles.certCheckLabel,
                        isDarkHud && styles.darkCertCheckLabel,
                    ]}
                >
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
                        isDarkHud && styles.darkActionButton,
                        !isCertified &&
                            (isDarkHud
                                ? styles.darkActionButtonDisabled
                                : styles.actionButtonDisabled),
                        pressed && hosSharedStyles.actionButtonPressed,
                    ]}
                    testID="confirm-hos-btn"
                >
                    <Text
                        style={[
                            styles.actionBtnText,
                            isDarkHud &&
                                isCertified &&
                                styles.darkActionBtnText,
                        ]}
                    >
                        ✓ Update &amp; Certify Duty Status
                    </Text>
                </Pressable>
            ) : (
                <Animated.View
                    style={[
                        styles.signedStamp,
                        isDarkHud && styles.darkSignedStamp,
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
                            isDarkHud && styles.darkSignedStampTitle,
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
                            isDarkHud && styles.darkSignedStampSub,
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

const styles = StyleSheet.create({
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    actionButton: {
        alignItems: 'center',
        backgroundColor: '#FFBF00',
        borderRadius: 12,
        elevation: 3,
        justifyContent: 'center',
        minHeight: 52,
        shadowColor: '#FFBF00',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        width: '100%',
    },
    actionButtonDisabled: {
        backgroundColor: '#94A3B8',
        elevation: 0,
        opacity: 0.6,
        shadowOpacity: 0,
    },
    certBox: {
        alignItems: 'center',
        borderColor: '#94A3B8',
        borderRadius: 6,
        borderWidth: 2,
        height: 24,
        justifyContent: 'center',
        width: 24,
    },
    certBoxChecked: {
        backgroundColor: '#FFBF00',
        borderColor: '#FFBF00',
    },
    certCheckLabel: {
        color: '#475569',
        flex: 1,
        fontSize: 12,
        lineHeight: 16,
    },
    certCheckMark: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
    },
    certCheckRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 14,
        minHeight: 44,
        paddingHorizontal: 2,
    },
    darkActionBtnText: {
        color: '#090D16',
    },
    darkActionButton: {
        backgroundColor: '#FFBF00',
        shadowColor: '#FFBF00',
    },
    darkActionButtonDisabled: {
        backgroundColor: '#334155',
        elevation: 0,
        opacity: 0.6,
        shadowOpacity: 0,
    },
    darkCertBox: {
        borderColor: '#475569',
    },
    darkCertBoxChecked: {
        backgroundColor: '#FFBF00',
        borderColor: '#FFBF00',
    },
    darkCertCheckLabel: {
        color: '#94A3B8',
    },
    darkCertCheckMark: {
        color: '#090D16',
    },
    darkInput: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        color: '#FFFFFF',
    },
    darkInputLabel: {
        color: '#CBD5E1',
    },
    darkSignedStamp: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderColor: '#10B981',
    },
    darkSignedStampSub: {
        color: '#A7F3D0',
    },
    darkSignedStampTitle: {
        color: '#34D399',
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E1',
        borderRadius: 10,
        borderWidth: 1,
        color: '#0F172A',
        fontSize: 13.5,
        marginBottom: 14,
        minHeight: 68,
        paddingHorizontal: 14,
        paddingVertical: 11,
        textAlignVertical: 'top',
    },
    inputLabel: {
        color: '#334155',
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 8,
    },
    signedStamp: {
        backgroundColor: '#ECFDF5',
        borderColor: '#059669',
        borderRadius: 10,
        borderWidth: 1.5,
        padding: 14,
    },
    signedStampSub: {
        color: '#047857',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    signedStampTitle: {
        color: '#065F46',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
});
