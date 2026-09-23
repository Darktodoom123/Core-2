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
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

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
        <View style={styles.tabRoot} testID="fuel-section">
            {/* Card 1: Fuel Dispense & Logging Form */}
            <View
                style={[
                    styles.sectionCard,
                    isDarkHud && styles.darkSectionCard,
                ]}
            >
                <View style={styles.cardHeaderRow}>
                    <View style={styles.headerIconWrap}>
                        <Icon
                            color={isDarkHud ? colors.hudAmber : colors.amber}
                            name="fuel"
                            size={18}
                        />
                    </View>
                    <View style={styles.headerTitles}>
                        <Text
                            accessibilityRole="header"
                            style={[
                                styles.cardHeading,
                                isDarkHud && styles.darkText,
                            ]}
                        >
                            Fuel Receipt & Dispense Logging
                        </Text>
                        <Text
                            style={[
                                styles.cardHelper,
                                isDarkHud && styles.darkHelper,
                            ]}
                        >
                            Record diesel consumption and fuel purchase receipts
                            for fleet tracking.
                        </Text>
                    </View>
                </View>

                {feedback ? (
                    <View
                        style={[
                            styles.feedbackBanner,
                            isDarkHud && styles.darkFeedbackBanner,
                        ]}
                    >
                        <Icon
                            color={isDarkHud ? '#34D399' : colors.greenDark}
                            name="check-circle"
                            size={16}
                        />
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
                        <View style={styles.formCol}>
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
                                    isDarkHud ? '#64748B' : colors.muted
                                }
                                style={[
                                    styles.input,
                                    isDarkHud && styles.darkInput,
                                ]}
                                value={liters}
                                testID="fuel-liters-input"
                            />
                        </View>
                        <View style={styles.formCol}>
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
                                    isDarkHud ? '#64748B' : colors.muted
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
                        <View style={styles.formCol}>
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
                                    isDarkHud ? '#64748B' : colors.muted
                                }
                                style={[
                                    styles.input,
                                    isDarkHud && styles.darkInput,
                                ]}
                                value={odo}
                                testID="fuel-odo-input"
                            />
                        </View>
                        <View style={styles.formCol}>
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
                                    isDarkHud ? '#64748B' : colors.muted
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
                        helperText="Upload pump meter photo or paper receipt snapshot."
                        maxCount={1}
                        onAddAttachment={handleAddAttachment}
                        onRemoveAttachment={handleRemoveAttachment}
                        title="Receipt Photo Evidence"
                    />

                    <Pressable
                        accessibilityLabel="Save fuel receipt log"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !liters.trim() }}
                        onPress={handleSave}
                        style={({ pressed }) => [
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
                        <Icon
                            color={isDarkHud ? colors.surfaceDark : '#FFFFFF'}
                            name="fuel"
                            size={16}
                        />
                        <Text
                            style={[
                                styles.actionBtnText,
                                isDarkHud && styles.darkActionBtnText,
                            ]}
                        >
                            Log Fuel Receipt
                        </Text>
                    </Pressable>
                </View>
            </View>

            {/* Card 2: Recent Fuel Logs */}
            <View
                style={[
                    styles.sectionCard,
                    isDarkHud && styles.darkSectionCard,
                ]}
            >
                <View style={styles.cardHeaderRow}>
                    <View style={styles.headerIconWrap}>
                        <Icon
                            color={isDarkHud ? colors.hudAmber : colors.amber}
                            name="clipboard"
                            size={18}
                        />
                    </View>
                    <View style={styles.headerTitles}>
                        <View style={styles.titleWithBadge}>
                            <Text
                                accessibilityRole="header"
                                style={[
                                    styles.cardHeading,
                                    isDarkHud && styles.darkText,
                                ]}
                            >
                                Recent Fuel Logs
                            </Text>
                            <View style={styles.countBadge}>
                                <Text style={styles.countBadgeText}>
                                    {fuelLogs.length}
                                </Text>
                            </View>
                        </View>
                        <Text
                            style={[
                                styles.cardHelper,
                                isDarkHud && styles.darkHelper,
                            ]}
                        >
                            Dispense transaction ledger and receipt history.
                        </Text>
                    </View>
                </View>

                {fuelLogs.length === 0 ? (
                    <View
                        style={[
                            styles.emptyState,
                            isDarkHud && styles.darkEmptyState,
                        ]}
                    >
                        <Icon
                            color={isDarkHud ? '#64748B' : colors.muted}
                            name="fuel"
                            size={28}
                        />
                        <Text
                            style={[
                                styles.emptyStateTitle,
                                isDarkHud && styles.darkText,
                            ]}
                        >
                            No Fuel Records Logged
                        </Text>
                        <Text
                            style={[
                                styles.emptyStateSub,
                                isDarkHud && styles.darkHelper,
                            ]}
                        >
                            Fuel dispense entries and receipt uploads will
                            appear here for audit and cost tracking.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.logList}>
                        {fuelLogs.map((log) => (
                            <View
                                key={log.id}
                                style={[
                                    styles.logCard,
                                    isDarkHud && styles.darkLogCard,
                                ]}
                            >
                                <View style={styles.logHeader}>
                                    <View style={styles.dispenseRow}>
                                        <Icon
                                            color={
                                                isDarkHud
                                                    ? colors.hudAmber
                                                    : colors.amber
                                            }
                                            name="fuel"
                                            size={16}
                                        />
                                        <Text
                                            style={[
                                                styles.logLiters,
                                                isDarkHud &&
                                                    styles.darkLogLiters,
                                            ]}
                                        >
                                            {log.quantityLiters} L Dispensed
                                        </Text>
                                    </View>
                                    {log.fuelCost != null ? (
                                        <View
                                            style={[
                                                styles.costBadge,
                                                isDarkHud &&
                                                    styles.darkCostBadge,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.logCost,
                                                    isDarkHud &&
                                                        styles.darkLogCost,
                                                ]}
                                            >
                                                ${log.fuelCost.toFixed(2)}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                                <View style={styles.logMetaRow}>
                                    <Text
                                        style={[
                                            styles.logMeta,
                                            isDarkHud && styles.darkHelper,
                                        ]}
                                    >
                                        Receipt: {log.receiptNumber} ·{' '}
                                        {log.odometerKm
                                            ? `${log.odometerKm.toLocaleString()} km · `
                                            : ''}
                                        {new Date(
                                            log.loggedAt,
                                        ).toLocaleDateString()}
                                    </Text>
                                </View>
                                {log.receiptPhotoUri ? (
                                    <Image
                                        accessibilityLabel="Receipt photo attachment"
                                        source={{ uri: log.receiptPhotoUri }}
                                        style={styles.receiptThumb}
                                    />
                                ) : null}
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    tabRoot: {
        gap: 14,
    },
    sectionCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
        ...shadows.sm,
    },
    darkSectionCard: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
        shadowColor: 'transparent',
    },
    cardHeaderRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 12,
        marginBottom: 14,
    },
    headerIconWrap: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        height: 36,
        justifyContent: 'center',
        width: 36,
    },
    headerTitles: {
        flex: 1,
    },
    titleWithBadge: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    countBadge: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    countBadgeText: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '800',
    },
    cardHeading: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
    },
    darkText: {
        color: colors.hudText,
    },
    cardHelper: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    darkHelper: {
        color: colors.hudTextDim,
    },
    formGroup: {
        gap: 10,
    },
    formRow: {
        flexDirection: 'row',
        gap: 10,
    },
    formCol: {
        flex: 1,
    },
    formLabel: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 5,
    },
    darkLabel: {
        color: colors.hudTextDim,
    },
    input: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        color: colors.text,
        fontSize: 14,
        minHeight: 44,
        paddingHorizontal: 12,
    },
    darkInput: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
        color: colors.hudText,
    },
    actionButton: {
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: 10,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 48,
        marginTop: 6,
    },
    darkActionButton: {
        backgroundColor: colors.hudAmber,
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    darkActionBtnText: {
        color: colors.surfaceDark,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    darkButtonDisabled: {
        opacity: 0.4,
    },
    feedbackBanner: {
        alignItems: 'center',
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        padding: 10,
    },
    darkFeedbackBanner: {
        backgroundColor: 'rgba(5, 150, 105, 0.15)',
        borderColor: '#059669',
    },
    feedbackText: {
        color: colors.greenDark,
        fontSize: 13,
        fontWeight: '700',
    },
    darkFeedbackText: {
        color: '#34D399',
    },
    emptyState: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        gap: 6,
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 24,
    },
    darkEmptyState: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    emptyStateTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    emptyStateSub: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 16,
        textAlign: 'center',
    },
    logList: {
        gap: 10,
    },
    logCard: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
    },
    darkLogCard: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    logHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    dispenseRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    logLiters: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    darkLogLiters: {
        color: colors.hudText,
    },
    costBadge: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    darkCostBadge: {
        backgroundColor: 'rgba(255, 191, 0, 0.15)',
        borderColor: '#FFBF00',
    },
    logCost: {
        color: colors.amberDark,
        fontSize: 13,
        fontWeight: '800',
    },
    darkLogCost: {
        color: colors.hudAmber,
    },
    logMetaRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    logMeta: {
        color: colors.secondary,
        fontSize: 12,
    },
    receiptThumb: {
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        height: 72,
        marginTop: 10,
        width: 72,
    },
    pressed: {
        opacity: 0.85,
    },
});
