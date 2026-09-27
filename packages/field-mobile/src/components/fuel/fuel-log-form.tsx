import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { fuelNoReceiptReasons } from '../../types/fuel';
import type {
    FuelNoReceiptReason,
    FuelReceiptUpload,
    MobileFuelRequest,
    RecordFuelPayload,
} from '../../types/fuel';
import type { PhotoAttachment } from '../attachments/PhotoAttachmentPicker';
import { Icon } from '../common/Icon';
import {
    FuelButton,
    FuelConnectionPill,
    FuelField,
    FuelFieldError,
    FuelSheet,
    FuelSheetOption,
    FuelUnitField,
    fuelStyles,
} from './fuel-controls';
import { FuelStatusPill } from './fuel-request-detail';

type LogFieldErrors = Partial<
    Record<'receipt' | 'quantity' | 'meter' | 'cost' | 'note', string>
>;

const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;

async function pickReceipt(
    source: 'camera' | 'gallery',
): Promise<PhotoAttachment | null> {
    const permission =
        source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
        Alert.alert(
            source === 'camera'
                ? 'Camera permission required'
                : 'Photo permission required',
            'Allow access in device settings to attach the fuel receipt.',
        );

        return null;
    }

    const launch =
        source === 'camera'
            ? ImagePicker.launchCameraAsync
            : ImagePicker.launchImageLibraryAsync;
    const result = await launch({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
    });
    const asset = result.canceled ? undefined : result.assets?.[0];

    if (!asset) {
        return null;
    }

    return {
        uri: asset.uri,
        fileName: asset.fileName || `fuel-receipt-${Date.now()}.jpg`,
        fileSize: asset.fileSize,
    };
}

function mimeFor(name: string): string {
    const extension = name.split('.').pop()?.toLowerCase();

    return extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
}

export function FuelLogForm({
    request,
    busy,
    isOnline,
    outboxReady,
    onSave,
    onCancel,
}: {
    request: MobileFuelRequest;
    busy: boolean;
    isOnline: boolean;
    outboxReady: boolean;
    onSave: (
        payload: RecordFuelPayload,
        receipt?: FuelReceiptUpload,
    ) => Promise<boolean>;
    onCancel: () => void;
}) {
    const { theme } = useTheme();
    const [quantity, setQuantity] = useState('');
    const [meter, setMeter] = useState('');
    const [cost, setCost] = useState('');
    const [station, setStation] = useState('');
    const [receiptNumber, setReceiptNumber] = useState('');
    const [remarks, setRemarks] = useState('');
    const [receipt, setReceipt] = useState<PhotoAttachment | null>(null);
    const [picking, setPicking] = useState(false);
    const [reasonSheet, setReasonSheet] = useState(false);
    const [noReceiptReason, setNoReceiptReason] =
        useState<FuelNoReceiptReason | null>(null);
    const [noReceiptNote, setNoReceiptNote] = useState('');
    const [errors, setErrors] = useState<LogFieldErrors>({});
    const meterType = request.asset?.meter_type;
    const hours = meterType === 'hour_meter' || meterType === 'engine_hours';
    const metered =
        hours || meterType === 'odometer' || meterType === 'odometer_km';
    const reasonLabel = fuelNoReceiptReasons.find(
        (reason) => reason.value === noReceiptReason,
    )?.label;
    const locked = busy || picking;

    const attach = async (source: 'camera' | 'gallery') => {
        setPicking(true);

        try {
            const photo = await pickReceipt(source);

            if (photo) {
                setReceipt(photo);
                setNoReceiptReason(null);
                setErrors((current) => ({
                    ...current,
                    receipt: undefined,
                    note: undefined,
                }));
            }
        } catch {
            Alert.alert(
                'Could not attach the photo',
                'Try again, or choose why there is no receipt.',
            );
        } finally {
            setPicking(false);
        }
    };

    const validate = (): LogFieldErrors => {
        const next: LogFieldErrors = {};
        const liters = Number(quantity);
        const reading = meter.trim() ? Number(meter) : undefined;
        const total = cost.trim() ? Number(cost) : undefined;

        if (!receipt && noReceiptReason === null) {
            next.receipt =
                'Attach the receipt photo, or choose why there is no receipt.';
        } else if (
            !receipt &&
            noReceiptReason === 'other' &&
            !noReceiptNote.trim()
        ) {
            next.note = 'Explain why there is no receipt.';
        }

        if (receipt?.fileSize && receipt.fileSize > MAX_RECEIPT_BYTES) {
            next.receipt = 'Choose a receipt photo smaller than 15 MB.';
        }

        if (
            quantity.trim() === '' ||
            !Number.isFinite(liters) ||
            liters < 0.01 ||
            liters > 100000
        ) {
            next.quantity = 'Enter the litres actually received.';
        }

        if (
            metered &&
            (reading === undefined ||
                !Number.isFinite(reading) ||
                reading < 0 ||
                (!hours && !Number.isInteger(reading)))
        ) {
            next.meter = hours
                ? 'Enter the engine hour reading.'
                : 'Enter a whole-number odometer reading in km.';
        }

        if (total !== undefined && (!Number.isFinite(total) || total < 0)) {
            next.cost = 'Enter a valid total cost in PHP.';
        }

        return next;
    };

    const save = async () => {
        const next = validate();
        setErrors(next);

        if (Object.keys(next).length > 0) {
            return;
        }

        const reading = meter.trim() ? Number(meter) : undefined;
        const total = cost.trim() ? Number(cost) : undefined;
        const name = receipt?.fileName ?? 'fuel-receipt.jpg';

        await onSave(
            {
                quantity_litres: Number(quantity),
                ...(metered && reading !== undefined
                    ? hours
                        ? { hour_meter: reading }
                        : { odometer_km: reading }
                    : {}),
                ...(total !== undefined ? { total_cost: total } : {}),
                ...(station.trim() ? { fuel_station: station.trim() } : {}),
                ...(receiptNumber.trim()
                    ? { receipt_number: receiptNumber.trim() }
                    : {}),
                ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
                ...(!receipt && noReceiptReason
                    ? {
                          no_receipt_reason: noReceiptReason,
                          ...(noReceiptNote.trim()
                              ? { no_receipt_note: noReceiptNote.trim() }
                              : {}),
                      }
                    : {}),
            },
            receipt
                ? { uri: receipt.uri, name, type: mimeFor(name) }
                : undefined,
        );
    };

    return (
        <View style={fuelStyles.section} testID="fuel-log-form">
            <Text
                style={[fuelStyles.title, { color: theme.textPrimary }]}
                accessibilityRole="header"
            >
                Record refueling
            </Text>
            <FuelConnectionPill online={isOnline} />

            <View
                style={[
                    fuelStyles.card,
                    styles.context,
                    {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                    },
                ]}
            >
                <View style={{ flex: 1, gap: 6 }}>
                    <FuelStatusPill status="verified" />
                    <Text
                        style={[styles.reference, { color: theme.textPrimary }]}
                    >
                        {request.reference}
                    </Text>
                    {request.asset ? (
                        <Text style={{ color: theme.textPrimary }}>
                            {request.asset.code} · {request.asset.name}
                        </Text>
                    ) : null}
                    <Text style={{ color: theme.textSecondary }}>
                        Requested {request.quantity_litres} L{' '}
                        {request.fuel_type === 'diesel' ? 'diesel' : 'gasoline'}
                        {request.job ? ` · ${request.job.reference}` : ''}
                    </Text>
                </View>
                <Icon
                    name={request.asset ? 'crane' : 'fuel'}
                    size={40}
                    color={theme.textSecondary}
                />
            </View>

            <FuelUnitField
                label="Actual quantity (liters)"
                unit="L"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                editable={!locked}
                error={errors.quantity}
                helper={`Enter what was actually dispensed. Requested: ${request.quantity_litres} L.`}
            />
            {metered && (
                <FuelUnitField
                    label={hours ? 'Engine hours' : 'Odometer (km)'}
                    unit={hours ? 'hr' : 'km'}
                    value={meter}
                    onChangeText={setMeter}
                    keyboardType={hours ? 'decimal-pad' : 'number-pad'}
                    editable={!locked}
                    error={errors.meter}
                    helper={
                        request.asset?.meter_value !== null &&
                        request.asset?.meter_value !== undefined
                            ? `Last recorded: ${request.asset.meter_value}`
                            : undefined
                    }
                />
            )}
            <FuelUnitField
                label="Total cost"
                optional
                unit="PHP"
                value={cost}
                onChangeText={setCost}
                keyboardType="decimal-pad"
                editable={!locked}
                error={errors.cost}
            />
            <FuelField
                label="Fuel source (optional)"
                value={station}
                onChangeText={setStation}
                maxLength={255}
                editable={!locked}
                placeholder="e.g. On-site bowser 04"
            />
            <FuelField
                label="Receipt number (optional)"
                value={receiptNumber}
                onChangeText={setReceiptNumber}
                maxLength={64}
                autoCapitalize="characters"
                editable={!locked}
                placeholder="e.g. OR-01482"
            />

            <View style={fuelStyles.field}>
                <Text style={[styles.group, { color: theme.textPrimary }]}>
                    Receipt photo
                </Text>
                <View
                    style={[
                        fuelStyles.card,
                        {
                            backgroundColor: theme.surface,
                            borderColor: errors.receipt
                                ? theme.hazardRed
                                : theme.border,
                            borderWidth: errors.receipt ? 2 : 1,
                        },
                    ]}
                    testID="fuel-receipt-picker"
                >
                    {receipt ? (
                        <View style={styles.attached}>
                            <Image
                                source={{ uri: receipt.uri }}
                                style={styles.thumb}
                                accessibilityLabel="Receipt photo preview"
                            />
                            <View style={{ flex: 1, gap: 8 }}>
                                <View style={fuelStyles.inlineRow}>
                                    <Icon
                                        name="check-circle"
                                        size={18}
                                        color={theme.successEmerald}
                                    />
                                    <Text
                                        style={{
                                            color: theme.textPrimary,
                                            fontWeight: '700',
                                            flex: 1,
                                        }}
                                        numberOfLines={1}
                                        ellipsizeMode="middle"
                                    >
                                        Photo attached · {receipt.fileName}
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <SmallAction
                                        icon="camera"
                                        title="Retake"
                                        onPress={() => void attach('camera')}
                                        disabled={locked}
                                        testID="fuel-receipt-retake"
                                    />
                                    <SmallAction
                                        icon="trash"
                                        title="Remove"
                                        onPress={() => setReceipt(null)}
                                        disabled={locked}
                                        testID="fuel-receipt-remove"
                                    />
                                </View>
                            </View>
                        </View>
                    ) : noReceiptReason ? (
                        <View style={{ gap: 10 }}>
                            <View style={fuelStyles.inlineRow}>
                                <Icon
                                    name="alert"
                                    size={18}
                                    color={theme.textPrimary}
                                />
                                <Text
                                    style={{
                                        color: theme.textPrimary,
                                        fontWeight: '700',
                                        flex: 1,
                                    }}
                                >
                                    No receipt: {reasonLabel}
                                </Text>
                            </View>
                            <Text
                                style={{
                                    color: theme.textSecondary,
                                    fontSize: 13,
                                }}
                            >
                                The office reviews every refuel logged without a
                                receipt.
                            </Text>
                            <FuelField
                                label={
                                    noReceiptReason === 'other'
                                        ? 'Explain (required)'
                                        : 'Details (optional)'
                                }
                                value={noReceiptNote}
                                onChangeText={setNoReceiptNote}
                                maxLength={2000}
                                multiline
                                editable={!locked}
                                error={errors.note}
                                placeholder="e.g. Bowser sheet number"
                            />
                        </View>
                    ) : (
                        <View style={{ gap: 10 }}>
                            <Text
                                style={{
                                    color: theme.textSecondary,
                                    fontSize: 13,
                                }}
                            >
                                Photograph the whole receipt so the amount and
                                date are readable.
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <FuelButton
                                        title="Take photo"
                                        onPress={() => void attach('camera')}
                                        disabled={locked}
                                        testID="fuel-receipt-picker-take-photo"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <FuelButton
                                        title="Choose photo"
                                        onPress={() => void attach('gallery')}
                                        disabled={locked}
                                        testID="fuel-receipt-picker-choose-gallery"
                                    />
                                </View>
                            </View>
                        </View>
                    )}
                    {!receipt && (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={
                                noReceiptReason
                                    ? 'Change no-receipt reason'
                                    : 'No receipt? Choose a reason'
                            }
                            accessibilityState={{ disabled: locked }}
                            onPress={() => setReasonSheet(true)}
                            disabled={locked}
                            testID="fuel-no-receipt-toggle"
                            style={[
                                styles.reasonRow,
                                { borderTopColor: theme.border },
                            ]}
                        >
                            <Text
                                style={{
                                    flex: 1,
                                    color: theme.textPrimary,
                                    fontWeight: '700',
                                    textDecorationLine: 'underline',
                                }}
                            >
                                {noReceiptReason
                                    ? 'Change reason'
                                    : 'No receipt? Choose a reason'}
                            </Text>
                            <Icon
                                name="chevron-right"
                                size={18}
                                color={theme.textSecondary}
                            />
                        </Pressable>
                    )}
                </View>
                <FuelFieldError message={errors.receipt} />
            </View>

            <FuelField
                label="Remarks (optional)"
                value={remarks}
                onChangeText={setRemarks}
                maxLength={2000}
                multiline
                editable={!locked}
            />

            <View style={{ gap: 10 }}>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {isOnline
                        ? 'Creates a permanent fuel log. The receipt is attached as evidence for the office.'
                        : 'Creates a permanent fuel log. Saved on this device with the receipt and uploaded when you reconnect.'}
                </Text>
                <FuelButton
                    title={busy ? 'Saving refueling…' : 'Save refueling'}
                    primary
                    onPress={() => void save()}
                    disabled={locked || !outboxReady}
                    testID="fuel-save-log-button"
                />
                <FuelButton
                    title="Cancel logging"
                    onPress={onCancel}
                    disabled={busy}
                />
            </View>

            <FuelSheet
                visible={reasonSheet}
                title="Why is there no receipt?"
                onClose={() => setReasonSheet(false)}
                testID="fuel-no-receipt-sheet"
            >
                {fuelNoReceiptReasons.map((reason) => (
                    <FuelSheetOption
                        key={reason.value}
                        title={reason.label}
                        hint={
                            reason.value === 'other'
                                ? 'You will be asked to explain.'
                                : undefined
                        }
                        selected={noReceiptReason === reason.value}
                        onPress={() => {
                            setNoReceiptReason(reason.value);
                            setErrors((current) => ({
                                ...current,
                                receipt: undefined,
                            }));
                            setReasonSheet(false);
                        }}
                        testID={`fuel-no-receipt-${reason.value}`}
                    />
                ))}
                {noReceiptReason && (
                    <FuelButton
                        title="I have a receipt after all"
                        onPress={() => {
                            setNoReceiptReason(null);
                            setNoReceiptNote('');
                            setReasonSheet(false);
                        }}
                    />
                )}
            </FuelSheet>
        </View>
    );
}

function SmallAction({
    icon,
    title,
    onPress,
    disabled,
    testID,
}: {
    icon: 'camera' | 'trash';
    title: string;
    onPress: () => void;
    disabled: boolean;
    testID: string;
}) {
    const { theme } = useTheme();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title} receipt photo`}
            accessibilityState={{ disabled }}
            onPress={onPress}
            disabled={disabled}
            testID={testID}
            style={({ pressed }) => [
                styles.smallAction,
                { borderColor: theme.borderStrong },
                (pressed || disabled) && { opacity: disabled ? 0.5 : 0.8 },
            ]}
        >
            <Icon name={icon} size={16} color={theme.textPrimary} />
            <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>
                {title}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    context: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    reference: { fontSize: 18, fontWeight: '700' },
    group: { fontSize: 15, fontWeight: '700' },
    attached: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    thumb: { width: 72, height: 88, borderRadius: 8 },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        borderTopWidth: 1,
        paddingTop: 6,
    },
    smallAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 48,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
});
