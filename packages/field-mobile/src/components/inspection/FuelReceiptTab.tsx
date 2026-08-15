import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { FuelReceiptLog } from '../../types/index';
import {
    PhotoAttachmentPicker,
    type PhotoAttachment,
} from '../attachments/PhotoAttachmentPicker';
import { colors, sharedStyles } from '../nativeStyles';

export interface FuelReceiptTabProps {
    assetCode: string;
    fuelLogs: FuelReceiptLog[];
    onLogFuelReceipt: (fuelLog: FuelReceiptLog) => void;
}

export const FuelReceiptTab: React.FC<FuelReceiptTabProps> = ({
    assetCode,
    fuelLogs,
    onLogFuelReceipt,
}) => {
    const [liters, setLiters] = useState('');
    const [cost, setCost] = useState('');
    const [odo, setOdo] = useState('');
    const [receiptNo, setReceiptNo] = useState('');
    const [attachments, setAttachments] = useState<PhotoAttachment[]>([]);
    const [feedback, setFeedback] = useState<string | null>(null);

    const handleAddAttachment = (attachment: PhotoAttachment) => {
        setAttachments([attachment]);
    };

    const handleRemoveAttachment = () => {
        setAttachments([]);
    };

    const handleSave = () => {
        const qty = parseFloat(liters);

        if (isNaN(qty) || qty <= 0) {
            return;
        }

        const newLog: FuelReceiptLog = {
            id: `FL-${Math.floor(100 + Math.random() * 900)}`,
            assetCode,
            quantityLiters: qty,
            fuelCost: cost ? parseFloat(cost) : undefined,
            odometerKm: odo ? parseInt(odo, 10) : undefined,
            receiptNumber:
                receiptNo.trim() || `RCPT-${Date.now().toString().slice(-6)}`,
            receiptPhotoUri: attachments[0]?.uri || null,
            loggedAt: new Date().toISOString(),
        };
        onLogFuelReceipt(newLog);
        setLiters('');
        setCost('');
        setOdo('');
        setReceiptNo('');
        setAttachments([]);
        setFeedback(
            `Fuel receipt logged: ${newLog.quantityLiters}L (${newLog.receiptNumber}).`,
        );
    };

    return (
        <View style={styles.sectionCard} testID="fuel-section">
            <Text accessibilityRole="header" style={styles.cardHeading}>
                Fuel Receipt & Dispense Logging
            </Text>
            <Text style={styles.cardHelper}>
                Record diesel consumption and fuel purchase receipts for fleet
                tracking.
            </Text>

            {feedback ? (
                <View style={styles.feedbackBanner}>
                    <Text style={styles.feedbackText}>{feedback}</Text>
                </View>
            ) : null}

            <View style={styles.formGroup}>
                <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>
                            Quantity (Liters) *
                        </Text>
                        <TextInput
                            accessibilityLabel="Fuel quantity in liters"
                            keyboardType="numeric"
                            onChangeText={setLiters}
                            placeholder="e.g. 150"
                            style={styles.input}
                            value={liters}
                            testID="fuel-liters-input"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>Total Cost ($)</Text>
                        <TextInput
                            accessibilityLabel="Fuel cost in dollars"
                            keyboardType="numeric"
                            onChangeText={setCost}
                            placeholder="e.g. 295.00"
                            style={styles.input}
                            value={cost}
                            testID="fuel-cost-input"
                        />
                    </View>
                </View>

                <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>Odometer / Hours</Text>
                        <TextInput
                            accessibilityLabel="Current odometer kilometers"
                            keyboardType="numeric"
                            onChangeText={setOdo}
                            placeholder="e.g. 42200"
                            style={styles.input}
                            value={odo}
                            testID="fuel-odo-input"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>Receipt Number</Text>
                        <TextInput
                            accessibilityLabel="Receipt number"
                            onChangeText={setReceiptNo}
                            placeholder="e.g. RCPT-4402"
                            style={styles.input}
                            value={receiptNo}
                            testID="fuel-receipt-input"
                        />
                    </View>
                </View>

                <PhotoAttachmentPicker
                    attachments={attachments}
                    helperText="Photograph the fuel dispenser slip or station invoice."
                    maxCount={1}
                    onAddAttachment={handleAddAttachment}
                    onRemoveAttachment={handleRemoveAttachment}
                    title="Receipt Photo Evidence"
                />

                <Pressable
                    accessibilityLabel="Record fuel log"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !liters.trim() }}
                    onPress={handleSave}
                    style={({ pressed }) => [
                        sharedStyles.button,
                        styles.actionButton,
                        !liters.trim() && styles.buttonDisabled,
                        pressed && liters.trim() && styles.pressed,
                    ]}
                    testID="log-fuel-btn"
                >
                    <Text style={sharedStyles.buttonText}>
                        + Log Fuel Receipt
                    </Text>
                </Pressable>
            </View>

            <Text
                accessibilityRole="header"
                style={[styles.cardHeading, { marginTop: 20 }]}
            >
                Fuel Transaction History
            </Text>
            <View style={styles.fuelList}>
                {fuelLogs.map((log) => (
                    <View
                        key={log.id}
                        style={styles.fuelCard}
                        testID={`fuel-log-${log.id}`}
                    >
                        <View style={styles.fuelHeader}>
                            <Text style={styles.fuelAmount}>
                                {log.quantityLiters} Liters
                            </Text>
                            <Text style={styles.fuelReceiptNo}>
                                {log.receiptNumber}
                            </Text>
                        </View>

                        {log.receiptPhotoUri ? (
                            <Image
                                source={{ uri: log.receiptPhotoUri }}
                                style={styles.receiptThumbnail}
                                accessibilityLabel={`Fuel receipt photo for ${log.receiptNumber}`}
                            />
                        ) : null}

                        <Text style={styles.fuelMeta}>
                            {log.fuelCost
                                ? `$${log.fuelCost.toFixed(2)} · `
                                : ''}
                            {log.odometerKm
                                ? `Odo: ${log.odometerKm} km · `
                                : ''}
                            {new Date(log.loggedAt).toLocaleDateString()}
                        </Text>
                    </View>
                ))}
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
    feedbackBanner: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        padding: 10,
    },
    feedbackText: {
        color: colors.greenDark,
        fontSize: 13,
        fontWeight: '800',
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
    formRow: {
        flexDirection: 'row',
        gap: 12,
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
    actionButton: {
        backgroundColor: colors.amber,
        marginTop: 8,
        minHeight: 48,
        width: '100%',
    },
    buttonDisabled: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
    },
    fuelList: {
        gap: 8,
        marginTop: 10,
    },
    fuelCard: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        padding: 12,
    },
    fuelHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    fuelAmount: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '900',
    },
    fuelReceiptNo: {
        color: colors.blueDark,
        fontSize: 13,
        fontWeight: '800',
    },
    fuelMeta: {
        color: colors.secondary,
        fontSize: 12,
        marginTop: 4,
    },
    receiptThumbnail: {
        borderColor: colors.borderStrong,
        borderRadius: 6,
        borderWidth: 1,
        height: 64,
        marginVertical: 6,
        width: 64,
    },
    pressed: {
        opacity: 0.78,
    },
});
