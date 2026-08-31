import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import type { ConditionRating, TechnicianHandover } from '../../types/index';
import { sharedStyles } from '../nativeStyles';

export interface HandoverTabProps {
    assetCode: string;
    technicianName: string;
    onCompleteHandover: (handover: TechnicianHandover) => void;
}

export const HandoverTab: React.FC<HandoverTabProps> = ({
    assetCode,
    technicianName,
    onCompleteHandover,
}) => {
    const { isDarkHud } = useTheme();
    const [complete, setComplete] = useState(false);
    const [recipient, setRecipient] = useState(
        'Marcus Vance (Lead Crane Operator)',
    );
    const [rating, setRating] = useState<ConditionRating>('excellent');
    const [remarks, setRemarks] = useState(
        'Asset inspected, fueled 100%, and handed over in full working order with load charts.',
    );

    const handleConfirm = () => {
        if (!recipient.trim()) {
            return;
        }

        setComplete(true);
        onCompleteHandover({
            id: `HO-${Date.now().toString().slice(-6)}`,
            assetCode,
            technicianName,
            recipientName: recipient.trim(),
            handoverType: 'tech_to_operator',
            conditionRating: rating,
            remarks,
            signatureConfirmed: true,
            timestamp: new Date().toISOString(),
        });
    };

    return (
        <View
            style={[styles.sectionCard, isDarkHud && styles.darkSectionCard]}
            testID="handover-section"
        >
            <Text
                accessibilityRole="header"
                style={[styles.cardHeading, isDarkHud && styles.darkText]}
            >
                Technician Asset Handover Sign-Off
            </Text>
            <Text style={[styles.cardHelper, isDarkHud && styles.darkHelper]}>
                Formal custody and operational readiness transfer between
                technician and crane operator.
            </Text>

            <View style={styles.formGroup}>
                <Text style={[styles.formLabel, isDarkHud && styles.darkLabel]}>
                    Receiving Operator Name
                </Text>
                <TextInput
                    accessibilityLabel="Receiving operator name"
                    editable={!complete}
                    onChangeText={setRecipient}
                    placeholderTextColor={isDarkHud ? '#64748B' : '#94A3B8'}
                    style={[styles.input, isDarkHud && styles.darkInput]}
                    value={recipient}
                    testID="handover-recipient-input"
                />

                <Text style={[styles.formLabel, isDarkHud && styles.darkLabel]}>
                    Asset Operational Condition Rating
                </Text>
                <View style={styles.severityRow}>
                    {(
                        ['excellent', 'good', 'fair', 'out_of_service'] as const
                    ).map((r) => {
                        const isSelected = rating === r;

                        return (
                            <Pressable
                                key={r}
                                accessibilityLabel={`Condition rating ${r}`}
                                accessibilityRole="button"
                                disabled={complete}
                                onPress={() => setRating(r)}
                                style={[
                                    styles.severityOption,
                                    isDarkHud && styles.darkSeverityOption,
                                    isSelected && styles.severityOptionSelected,
                                    isSelected &&
                                        isDarkHud &&
                                        (r === 'excellent'
                                            ? styles.darkExcellentSelected
                                            : r === 'good'
                                              ? styles.darkGoodSelected
                                              : r === 'fair'
                                                ? styles.darkFairSelected
                                                : styles.darkOosSelected),
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
                                            (r === 'excellent'
                                                ? styles.darkExcellentText
                                                : r === 'good'
                                                  ? styles.darkGoodText
                                                  : r === 'fair'
                                                    ? styles.darkFairText
                                                    : styles.darkOosText),
                                    ]}
                                >
                                    {r.replace('_', ' ').toUpperCase()}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={[styles.formLabel, isDarkHud && styles.darkLabel]}>
                    Handover & Pre-Start Remarks
                </Text>
                <TextInput
                    accessibilityLabel="Handover remarks"
                    editable={!complete}
                    multiline
                    numberOfLines={3}
                    onChangeText={setRemarks}
                    placeholderTextColor={isDarkHud ? '#64748B' : '#94A3B8'}
                    style={[
                        styles.input,
                        styles.textArea,
                        isDarkHud && styles.darkInput,
                    ]}
                    value={remarks}
                    testID="handover-remarks-input"
                />

                {!complete ? (
                    <Pressable
                        accessibilityLabel="Complete technician asset handover"
                        accessibilityRole="button"
                        onPress={handleConfirm}
                        style={({ pressed }) => [
                            sharedStyles.button,
                            styles.actionButton,
                            isDarkHud && styles.darkActionButton,
                            pressed && styles.pressed,
                        ]}
                        testID="confirm-handover-btn"
                    >
                        <Text
                            style={[
                                sharedStyles.buttonText,
                                styles.actionBtnText,
                            ]}
                        >
                            ✓ Sign & Complete Handover
                        </Text>
                    </Pressable>
                ) : (
                    <View
                        style={[
                            styles.signedStamp,
                            isDarkHud && styles.darkSignedStamp,
                        ]}
                    >
                        <Text
                            style={[
                                styles.signedStampTitle,
                                isDarkHud && styles.darkSignedStampTitle,
                            ]}
                        >
                            ✓ HANDOVER COMPLETED
                        </Text>
                        <Text
                            style={[
                                styles.signedStampSub,
                                isDarkHud && styles.darkSignedStampSub,
                            ]}
                        >
                            Transferred from {technicianName} to {recipient}
                        </Text>
                    </View>
                )}
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
        minHeight: 70,
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
    darkExcellentSelected: {
        backgroundColor: '#06281E',
        borderColor: '#059669',
        borderWidth: 1.5,
    },
    darkGoodSelected: {
        backgroundColor: '#172554',
        borderColor: '#2563EB',
        borderWidth: 1.5,
    },
    darkFairSelected: {
        backgroundColor: '#451A03',
        borderColor: '#D97706',
        borderWidth: 1.5,
    },
    darkOosSelected: {
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
    darkExcellentText: {
        color: '#34D399',
        fontWeight: '900',
    },
    darkGoodText: {
        color: '#60A5FA',
        fontWeight: '900',
    },
    darkFairText: {
        color: '#FBBF24',
        fontWeight: '900',
    },
    darkOosText: {
        color: '#F87171',
        fontWeight: '900',
    },
    actionButton: {
        backgroundColor: '#2563EB',
        marginTop: 12,
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
    signedStamp: {
        backgroundColor: '#06281E',
        borderColor: '#059669',
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 12,
        padding: 12,
    },
    darkSignedStamp: {
        backgroundColor: '#06281E',
        borderColor: '#059669',
    },
    signedStampTitle: {
        color: '#34D399',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    darkSignedStampTitle: {
        color: '#34D399',
    },
    signedStampSub: {
        color: '#6EE7B7',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    darkSignedStampSub: {
        color: '#6EE7B7',
    },
    pressed: {
        opacity: 0.78,
    },
});
