import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ConditionRating, TechnicianHandover } from '../../types/index';
import { colors, sharedStyles } from '../nativeStyles';

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
        <View style={styles.sectionCard} testID="handover-section">
            <Text accessibilityRole="header" style={styles.cardHeading}>
                Technician Asset Handover Sign-Off
            </Text>
            <Text style={styles.cardHelper}>
                Formal custody and operational readiness transfer between
                technician and crane operator.
            </Text>

            <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Receiving Operator Name</Text>
                <TextInput
                    accessibilityLabel="Receiving operator name"
                    editable={!complete}
                    onChangeText={setRecipient}
                    style={styles.input}
                    value={recipient}
                    testID="handover-recipient-input"
                />

                <Text style={styles.formLabel}>
                    Asset Operational Condition Rating
                </Text>
                <View style={styles.severityRow}>
                    {(
                        ['excellent', 'good', 'fair', 'out_of_service'] as const
                    ).map((r) => (
                        <Pressable
                            key={r}
                            accessibilityLabel={`Condition rating ${r}`}
                            accessibilityRole="button"
                            disabled={complete}
                            onPress={() => setRating(r)}
                            style={[
                                styles.severityOption,
                                rating === r && styles.severityOptionSelected,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.severityText,
                                    rating === r && styles.severityTextSelected,
                                ]}
                            >
                                {r.replace('_', ' ').toUpperCase()}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={styles.formLabel}>
                    Handover & Pre-Start Remarks
                </Text>
                <TextInput
                    accessibilityLabel="Handover remarks"
                    editable={!complete}
                    multiline
                    numberOfLines={3}
                    onChangeText={setRemarks}
                    style={[styles.input, styles.textArea]}
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
                            pressed && styles.pressed,
                        ]}
                        testID="confirm-handover-btn"
                    >
                        <Text style={sharedStyles.buttonText}>
                            ✓ Sign & Complete Handover
                        </Text>
                    </Pressable>
                ) : (
                    <View style={styles.signedStamp}>
                        <Text style={styles.signedStampTitle}>
                            ✓ HANDOVER COMPLETED
                        </Text>
                        <Text style={styles.signedStampSub}>
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
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    cardHeading: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
    },
    cardHelper: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 12,
        marginTop: 4,
    },
    formGroup: {
        gap: 8,
        marginTop: 8,
    },
    formLabel: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    input: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 14,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 10,
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
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    severityOptionSelected: {
        backgroundColor: colors.amberDark,
        borderColor: colors.amberDark,
    },
    severityText: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '800',
    },
    severityTextSelected: {
        color: colors.white,
    },
    actionButton: {
        backgroundColor: colors.amber,
        marginTop: 8,
        minHeight: 48,
        width: '100%',
    },
    signedStamp: {
        backgroundColor: colors.surface,
        borderColor: colors.greenBorder,
        borderRadius: 8,
        borderWidth: 1.5,
        gap: 4,
        marginTop: 12,
        padding: 12,
    },
    signedStampTitle: {
        color: colors.greenDark,
        fontSize: 14,
        fontWeight: '900',
    },
    signedStampSub: {
        color: colors.secondary,
        fontSize: 12,
    },
    pressed: {
        opacity: 0.78,
    },
});
