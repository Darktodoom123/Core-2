import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type {
    FuelReceiptUpload,
    MobileFuelRequest,
    RecordFuelPayload,
} from '../../types/fuel';
import { PhotoAttachmentPicker } from '../attachments/PhotoAttachmentPicker';
import type { PhotoAttachment } from '../attachments/PhotoAttachmentPicker';
import { FuelButton, FuelField, fuelStyles } from './fuel-controls';

export function FuelLogForm({
    request,
    busy,
    isOnline,
    onSave,
    onCancel,
}: {
    request: MobileFuelRequest;
    busy: boolean;
    isOnline: boolean;
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
    const [remarks, setRemarks] = useState('');
    const [receipt, setReceipt] = useState<PhotoAttachment | null>(null);
    const [error, setError] = useState<string | null>(null);
    const meterType = request.asset?.meter_type;
    const hours = meterType === 'hour_meter' || meterType === 'engine_hours';
    const metered =
        hours || meterType === 'odometer' || meterType === 'odometer_km';

    const save = async () => {
        const liters = Number(quantity);
        const reading = meter.trim() ? Number(meter) : undefined;
        const total = cost.trim() ? Number(cost) : undefined;

        if (!Number.isFinite(liters) || liters < 0.01 || liters > 100000) {
            setError(
                'Enter the actual liters received, between 0.01 and 100,000.',
            );

            return;
        }

        if (
            metered &&
            (reading === undefined ||
                !Number.isFinite(reading) ||
                reading < 0 ||
                (!hours && !Number.isInteger(reading)))
        ) {
            setError(
                hours
                    ? 'Enter a valid engine hour reading.'
                    : 'Enter a whole-number odometer reading in kilometers.',
            );

            return;
        }

        if (total !== undefined && (!Number.isFinite(total) || total < 0)) {
            setError('Enter a valid total cost in PHP.');

            return;
        }

        if (receipt?.fileSize && receipt.fileSize > 15 * 1024 * 1024) {
            setError('Choose a receipt photo smaller than 15 MB.');

            return;
        }

        setError(null);
        const name = receipt?.fileName ?? 'fuel-receipt.jpg';
        const extension = name.split('.').pop()?.toLowerCase();
        const mime =
            extension === 'png'
                ? 'image/png'
                : extension === 'webp'
                  ? 'image/webp'
                  : 'image/jpeg';
        await onSave(
            {
                quantity_litres: liters,
                ...(metered && reading !== undefined
                    ? hours
                        ? { hour_meter: reading }
                        : { odometer_km: reading }
                    : {}),
                ...(total !== undefined ? { total_cost: total } : {}),
                ...(station.trim() ? { fuel_station: station.trim() } : {}),
                ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
            },
            receipt ? { uri: receipt.uri, name, type: mime } : undefined,
        );
    };

    return (
        <View style={fuelStyles.section} testID="fuel-log-form">
            <Text style={[fuelStyles.title, { color: theme.textPrimary }]}>
                Record refueling
            </Text>
            <Text style={[fuelStyles.body, { color: theme.textSecondary }]}>
                {request.reference} · Enter the actual amount received. This
                creates a permanent fuel log.
            </Text>
            <FuelField
                label="Actual quantity (liters)"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                editable={!busy}
            />
            {metered && (
                <FuelField
                    label={hours ? 'Engine hours' : 'Odometer (km)'}
                    value={meter}
                    onChangeText={setMeter}
                    keyboardType={hours ? 'decimal-pad' : 'number-pad'}
                    editable={!busy}
                />
            )}
            <FuelField
                label="Total cost (PHP, optional)"
                value={cost}
                onChangeText={setCost}
                keyboardType="decimal-pad"
                editable={!busy}
            />
            <FuelField
                label="Fuel station or source (optional)"
                value={station}
                onChangeText={setStation}
                maxLength={255}
                editable={!busy}
            />
            <FuelField
                label="Remarks (optional)"
                value={remarks}
                onChangeText={setRemarks}
                maxLength={2000}
                multiline
                editable={!busy}
            />
            <View pointerEvents={busy ? 'none' : 'auto'}>
                <PhotoAttachmentPicker
                    title="Receipt photo (optional)"
                    helperText="Attach a clear receipt or pump photo, up to 15 MB."
                    attachments={receipt ? [receipt] : []}
                    onAddAttachment={setReceipt}
                    onRemoveAttachment={() => setReceipt(null)}
                    maxCount={1}
                />
            </View>
            {error && (
                <Text
                    accessibilityRole="alert"
                    style={{ color: theme.textPrimary }}
                >
                    {error}
                </Text>
            )}
            {!isOnline && (
                <Text style={{ color: theme.textPrimary }}>
                    Reconnect to save this log. Keep this form open to retain
                    your entries.
                </Text>
            )}
            <FuelButton
                title={busy ? 'Saving refueling…' : 'Save refueling'}
                primary
                onPress={() => void save()}
                disabled={busy || !isOnline}
            />
            <FuelButton
                title="Cancel logging"
                onPress={onCancel}
                disabled={busy}
            />
        </View>
    );
}
