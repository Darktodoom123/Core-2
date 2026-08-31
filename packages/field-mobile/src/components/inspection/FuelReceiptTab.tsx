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
import type { FuelReceiptLog } from '../../types/index';
import { PhotoAttachmentPicker } from '../attachments/PhotoAttachmentPicker';
import type { PhotoAttachment } from '../attachments/PhotoAttachmentPicker';
import { sharedStyles } from '../nativeStyles';

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
    const { isDarkHud } = useTheme();
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
        <View
            style={[styles.sectionCard, isDarkHud && styles.darkSectionCard]}
            testID="fuel-section"
        >
            <Text
                accessibilityRole="header"
                style={[styles.cardHeading, isDarkHud && styles.darkText]}
            >
                Fuel Receipt & Dispense Logging
            </Text>
            <Text style={[styles.cardHelper, isDarkHud && styles.darkHelper]}>
                Record diesel consumption and fuel purchase receipts for fleet
                tracking.
            </Text>

            {feedback ? (
                <View
                    style={[
                        styles.feedbackBanner,
                        isDarkHud && styles.darkFeedbackBanner,
                    ]}
                >
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
                <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                        <Text
                            style={[
                                styles.formLabel,
                                isDarkHud && styles.darkLabel,
                            ]}
                        >
                            Quantity (Liters) *
                        </Text>
                        <TextInput
                            accessibilityLabel="Fuel quantity in liters"
                            keyboardType="numeric"
                            onChangeText={setLiters}
                            placeholder="e.g. 150"
                            placeholderTextColor={
                                isDarkHud ? '#64748B' : '#94A3B8'
                            }
                            style={[
                                styles.input,
                                isDarkHud && styles.darkInput,
                            ]}
                            value={liters}
                            testID="fuel-liters-input"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text
                            style={[
                                styles.formLabel,
                                isDarkHud && styles.darkLabel,
                            ]}
                        >
                            Total Cost ($)
                        </Text>
                        <TextInput
                            accessibilityLabel="Fuel cost in dollars"
                            keyboardType="numeric"
                            onChangeText={setCost}
                            placeholder="e.g. 295.00"
                            placeholderTextColor={
                                isDarkHud ? '#64748B' : '#94A3B8'
                            }
                            style={[
                                styles.input,
                                isDarkHud && styles.darkInput,
                            ]}
                            value={cost}
                            testID="fuel-cost-input"
                        />
                    </View>
                </View>

                <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                        <Text
                            style={[
                                styles.formLabel,
                                isDarkHud && styles.darkLabel,
                            ]}
                        >
                            Odometer / Hours
                        </Text>
                        <TextInput
                            accessibilityLabel="Current odometer kilometers"
                            keyboardType="numeric"
                            onChangeText={setOdo}
                            placeholder="e.g. 42200"
                            placeholderTextColor={
                                isDarkHud ? '#64748B' : '#94A3B8'
                            }
                            style={[
                                styles.input,
                                isDarkHud && styles.darkInput,
                            ]}
                            value={odo}
                            testID="fuel-odo-input"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text
                            style={[
                                styles.formLabel,
                                isDarkHud && styles.darkLabel,
                            ]}
                        >
                            Receipt Number
                        </Text>
                        <TextInput
                            accessibilityLabel="Receipt number"
                            onChangeText={setReceiptNo}
                            placeholder="e.g. RCPT-4402"
                            placeholderTextColor={
                                isDarkHud ? '#64748B' : '#94A3B8'
                            }
                            style={[
                                styles.input,
                                isDarkHud && styles.darkInput,
                            ]}
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
                        isDarkHud && styles.darkActionButton,
                        !liters.trim() && styles.buttonDisabled,
                        isDarkHud &&
                            !liters.trim() &&
                            styles.darkButtonDisabled,
                        pressed && liters.trim() && styles.pressed,
                    ]}
                    testID="log-fuel-btn"
                >
                    <Text
                        style={[sharedStyles.buttonText, styles.actionBtnText]}
                    >
                        + Record Fuel Receipt
                    </Text>
                </Pressable>
            </View>

            <Text
                accessibilityRole="header"
                style={[
                    styles.cardHeading,
                    isDarkHud && styles.darkText,
                    { marginTop: 24 },
                ]}
            >
                Recent Fuel Logs
            </Text>
            <View style={styles.fuelList}>
                {fuelLogs.map((log) => (
                    <View
                        key={log.id}
                        style={[
                            styles.fuelCard,
                            isDarkHud && styles.darkFuelCard,
                        ]}
                        testID={`fuel-card-${log.id}`}
                    >
                        <View style={styles.fuelHeader}>
                            <Text
                                style={[
                                    styles.fuelAmount,
                                    isDarkHud && styles.darkFuelAmount,
                                ]}
                            >
                                {log.quantityLiters} Liters
                            </Text>
                            <Text
                                style={[
                                    styles.fuelReceiptNo,
                                    isDarkHud && styles.darkFuelReceiptNo,
                                ]}
                            >
                                {log.receiptNumber}
                            </Text>
                        </View>

                        {log.receiptPhotoUri ? (
                            <Image
                                source={{ uri: log.receiptPhotoUri }}
                                style={styles.receiptThumbnail}
                                accessibilityLabel={`Receipt photo for ${log.receiptNumber}`}
                            />
                        ) : null}

                        <Text
                            style={[
                                styles.fuelMeta,
                                isDarkHud && styles.darkFuelMeta,
                            ]}
                        >
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
    feedbackBanner: {
        backgroundColor: '#06281E',
        borderColor: '#065F46',
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        padding: 10,
    },
    darkFeedbackBanner: {
        backgroundColor: '#06281E',
        borderColor: '#065F46',
    },
    feedbackText: {
        color: '#34D399',
        fontSize: 13,
        fontWeight: '800',
    },
    darkFeedbackText: {
        color: '#34D399',
    },
    formGroup: {
        gap: 8,
        marginTop: 8,
    },
    formLabel: {
        color: '#CBD5E1',
        fontSize: 13,
        fontWeight: '800',
    },
    darkLabel: {
        color: '#CBD5E1',
    },
    formRow: {
        flexDirection: 'row',
        gap: 12,
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
    actionButton: {
        backgroundColor: '#2563EB',
        marginTop: 8,
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
    buttonDisabled: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderWidth: 1,
    },
    darkButtonDisabled: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    fuelList: {
        gap: 10,
        marginTop: 10,
    },
    fuelCard: {
        backgroundColor: '#101A2E',
        borderColor: '#1E293B',
        borderRadius: 10,
        borderWidth: 1,
        padding: 14,
    },
    darkFuelCard: {
        backgroundColor: '#101A2E',
        borderColor: '#1E293B',
    },
    fuelHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    fuelAmount: {
        color: '#10B981',
        fontSize: 16,
        fontWeight: '900',
    },
    darkFuelAmount: {
        color: '#10B981',
    },
    fuelReceiptNo: {
        color: '#38BDF8',
        fontSize: 13,
        fontWeight: '800',
    },
    darkFuelReceiptNo: {
        color: '#38BDF8',
    },
    fuelMeta: {
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 4,
    },
    darkFuelMeta: {
        color: '#94A3B8',
    },
    receiptThumbnail: {
        borderColor: '#334155',
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
