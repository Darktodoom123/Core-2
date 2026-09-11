import { useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    FileText,
    Fuel,
    Gauge,
    Trash2,
    UploadCloud,
    X,
} from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { humanize } from '@/lib/formatters';
import type { FuelRequestViewModel } from '@/types/workspace';

interface FuelLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: FuelRequestViewModel | null;
}

export function FuelLogModal({ isOpen, onClose, request }: FuelLogModalProps) {
    if (!isOpen || !request) {
        return null;
    }

    return (
        <FuelLogModalContent
            key={request.id}
            onClose={onClose}
            request={request}
        />
    );
}

function FuelLogModalContent({
    onClose,
    request,
}: {
    onClose: () => void;
    request: FuelRequestViewModel;
}) {
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const [manualTotalCostOverride, setManualTotalCostOverride] =
        useState(false);

    const asset = request.asset ?? null;
    const isHourMeter =
        asset?.meter_type === 'hour_meter' ||
        asset?.meter_type === 'engine_hours';
    const meterUnit = isHourMeter ? 'hrs' : 'km';
    const currentMeter = asset?.meter_value
        ? parseFloat(String(asset.meter_value))
        : null;

    const form = useForm({
        status: 'logged',
        quantity_litres: request.quantity_litres
            ? String(request.quantity_litres)
            : '',
        odometer_km:
            !isHourMeter && currentMeter !== null ? String(currentMeter) : '',
        hour_meter:
            isHourMeter && currentMeter !== null ? String(currentMeter) : '',
        price_per_litre: '',
        total_cost: '',
        fuel_station: '',
        remarks: '',
        receipt: null as File | null,
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleVolumeChange = (volume: string) => {
        form.setData('quantity_litres', volume);

        if (!manualTotalCostOverride && form.data.price_per_litre) {
            const v = parseFloat(volume);
            const p = parseFloat(form.data.price_per_litre);

            if (!isNaN(v) && !isNaN(p) && v > 0 && p > 0) {
                form.setData('total_cost', (v * p).toFixed(2));
            }
        }
    };

    const handlePriceChange = (price: string) => {
        form.setData('price_per_litre', price);

        if (!manualTotalCostOverride && form.data.quantity_litres) {
            const v = parseFloat(form.data.quantity_litres);
            const p = parseFloat(price);

            if (!isNaN(v) && !isNaN(p) && v > 0 && p > 0) {
                form.setData('total_cost', (v * p).toFixed(2));
            }
        }
    };

    const handleTotalCostChange = (total: string) => {
        setManualTotalCostOverride(true);
        form.setData('total_cost', total);
    };

    const enteredMeterValue = isHourMeter
        ? parseFloat(form.data.hour_meter)
        : parseFloat(form.data.odometer_km);

    const isMonotonicViolation = useMemo(() => {
        if (currentMeter === null || isNaN(enteredMeterValue)) {
            return false;
        }

        return enteredMeterValue < currentMeter;
    }, [currentMeter, enteredMeterValue]);

    const handleReceiptChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;

        if (!file) {
            form.setData('receipt', null);
            setReceiptPreview(null);

            return;
        }

        form.setData('receipt', file);

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setReceiptPreview(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setReceiptPreview(null);
        }
    };

    const removeReceipt = () => {
        form.setData('receipt', null);
        setReceiptPreview(null);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();

        form.post(`/operations/fuel-requests/${request.id}/status`, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                onClose();
            },
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fuel-log-modal-title"
        >
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-line pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                                <Fuel className="h-4 w-4" />
                            </span>
                            <h2
                                id="fuel-log-modal-title"
                                className="text-lg font-bold text-ink"
                            >
                                Record Refueling Log
                            </h2>
                            <span className="rounded bg-surface-subtle px-2 py-0.5 font-mono text-xs font-semibold text-ink-soft">
                                {request.reference}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-soft">
                            Record final pump dispensing volume, asset meter
                            readings, cost in PHP, and attach the fuel station
                            receipt.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-subtle hover:text-ink focus-visible:outline-none"
                        aria-label="Close dialog"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Asset Context Strip */}
                {asset && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-subtle p-3 text-xs">
                        <div>
                            <span className="text-ink-soft">Equipment: </span>
                            <strong className="text-ink">
                                {asset.name || asset.code}
                            </strong>
                            <span className="text-ink-soft">
                                {' '}
                                ({humanize(asset.kind ?? 'equipment')})
                            </span>
                        </div>
                        {asset.registration_number && (
                            <>
                                <span className="text-ink-soft">·</span>
                                <div>
                                    <span className="text-ink-soft">
                                        Plate/Reg:{' '}
                                    </span>
                                    <span className="font-semibold text-ink">
                                        {asset.registration_number}
                                    </span>
                                </div>
                            </>
                        )}
                        {currentMeter !== null && (
                            <>
                                <span className="text-ink-soft">·</span>
                                <div className="flex items-center gap-1">
                                    <Gauge className="h-3 w-3 text-brand" />
                                    <span className="text-ink-soft">
                                        Current Meter:{' '}
                                    </span>
                                    <span className="font-mono font-bold text-ink">
                                        {currentMeter.toLocaleString()}{' '}
                                        {meterUnit}
                                    </span>
                                </div>
                            </>
                        )}
                        {asset.baseline_burn_rate && (
                            <>
                                <span className="text-ink-soft">·</span>
                                <div>
                                    <span className="text-ink-soft">
                                        Baseline:{' '}
                                    </span>
                                    <span className="font-medium text-ink">
                                        {asset.baseline_burn_rate}{' '}
                                        {asset.burn_rate_unit ?? 'L/hr'}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {/* Dispensed Volume */}
                        <div>
                            <label className="block text-xs font-semibold tracking-wider text-ink uppercase">
                                Dispensed Volume (Litres) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                value={form.data.quantity_litres}
                                onChange={(e) =>
                                    handleVolumeChange(e.target.value)
                                }
                                placeholder="e.g. 150.00"
                                className="mt-1.5 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-ink focus:border-brand focus:outline-none"
                            />
                            {form.errors.quantity_litres && (
                                <p className="mt-1 text-xs text-danger">
                                    {form.errors.quantity_litres}
                                </p>
                            )}
                        </div>

                        {/* Monotonic Meter Reading */}
                        <div>
                            <label className="block text-xs font-semibold tracking-wider text-ink uppercase">
                                {isHourMeter
                                    ? 'Engine Hours Meter (hrs) *'
                                    : 'Odometer Reading (km) *'}
                            </label>
                            <input
                                type="number"
                                step={isHourMeter ? '0.1' : '1'}
                                min="0"
                                value={
                                    isHourMeter
                                        ? form.data.hour_meter
                                        : form.data.odometer_km
                                }
                                onChange={(e) => {
                                    if (isHourMeter) {
                                        form.setData(
                                            'hour_meter',
                                            e.target.value,
                                        );
                                    } else {
                                        form.setData(
                                            'odometer_km',
                                            e.target.value,
                                        );
                                    }
                                }}
                                placeholder={
                                    currentMeter !== null
                                        ? `Min: ${currentMeter}`
                                        : 'Enter meter'
                                }
                                className={`mt-1.5 h-10 w-full rounded-lg border bg-surface px-3 font-mono text-sm text-ink focus:outline-none ${
                                    isMonotonicViolation
                                        ? 'border-danger ring-1 ring-danger/30 focus:border-danger'
                                        : 'border-line-strong focus:border-brand'
                                }`}
                            />
                            {isMonotonicViolation ? (
                                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-danger">
                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                    <span>
                                        Cannot be lower than current meter (
                                        {currentMeter} {meterUnit})
                                    </span>
                                </div>
                            ) : currentMeter !== null ? (
                                <p className="mt-1 text-[11px] text-ink-soft">
                                    Last recorded: {currentMeter} {meterUnit}
                                </p>
                            ) : null}
                            {form.errors.odometer_km && (
                                <p className="mt-1 text-xs text-danger">
                                    {form.errors.odometer_km}
                                </p>
                            )}
                            {form.errors.hour_meter && (
                                <p className="mt-1 text-xs text-danger">
                                    {form.errors.hour_meter}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        {/* Price per Litre */}
                        <div>
                            <label className="block text-xs font-semibold tracking-wider text-ink uppercase">
                                Price / Litre (₱)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.data.price_per_litre}
                                onChange={(e) =>
                                    handlePriceChange(e.target.value)
                                }
                                placeholder="e.g. 58.50"
                                className="mt-1.5 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
                            />
                            {form.errors.price_per_litre && (
                                <p className="mt-1 text-xs text-danger">
                                    {form.errors.price_per_litre}
                                </p>
                            )}
                        </div>

                        {/* Total Cost */}
                        <div>
                            <label className="block text-xs font-semibold tracking-wider text-ink uppercase">
                                Total Cost (₱ PHP)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.data.total_cost}
                                onChange={(e) =>
                                    handleTotalCostChange(e.target.value)
                                }
                                placeholder="e.g. 8775.00"
                                className="mt-1.5 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-ink focus:border-brand focus:outline-none"
                            />
                            {form.errors.total_cost && (
                                <p className="mt-1 text-xs text-danger">
                                    {form.errors.total_cost}
                                </p>
                            )}
                        </div>

                        {/* Fuel Station / Vendor */}
                        <div>
                            <label className="block text-xs font-semibold tracking-wider text-ink uppercase">
                                Fuel Station / Vendor
                            </label>
                            <input
                                type="text"
                                value={form.data.fuel_station}
                                onChange={(e) =>
                                    form.setData('fuel_station', e.target.value)
                                }
                                placeholder="e.g. Petron Depot / Shell"
                                className="mt-1.5 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
                            />
                            {form.errors.fuel_station && (
                                <p className="mt-1 text-xs text-danger">
                                    {form.errors.fuel_station}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Receipt Attachment */}
                    <div>
                        <label className="block text-xs font-semibold tracking-wider text-ink uppercase">
                            Receipt Photo / Invoice Attachment
                        </label>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Attach fuel pump receipt or vendor delivery invoice
                            (Max 15MB, PNG/JPEG/PDF).
                        </p>

                        {!form.data.receipt ? (
                            <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-surface-subtle p-5 text-center transition-colors hover:border-brand-strong hover:bg-brand-soft/20">
                                <UploadCloud className="h-7 w-7 text-ink-soft" />
                                <span className="mt-2 text-xs font-semibold text-ink">
                                    Click or drag receipt photo to upload
                                </span>
                                <span className="mt-0.5 text-[11px] text-ink-soft">
                                    PNG, JPG, HEIC, or PDF up to 15MB
                                </span>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
                                    onChange={handleReceiptChange}
                                    className="hidden"
                                />
                            </label>
                        ) : (
                            <div className="mt-2 flex items-center justify-between rounded-xl border border-line bg-surface p-3">
                                <div className="flex items-center gap-3">
                                    {receiptPreview ? (
                                        <img
                                            src={receiptPreview}
                                            alt="Receipt preview"
                                            className="h-12 w-12 rounded-lg border border-line object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-surface-subtle text-ink-soft">
                                            <FileText className="h-6 w-6" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="max-w-xs truncate text-xs font-semibold text-ink">
                                            {form.data.receipt.name}
                                        </p>
                                        <p className="text-[11px] text-ink-soft">
                                            {(
                                                form.data.receipt.size /
                                                1024 /
                                                1024
                                            ).toFixed(2)}{' '}
                                            MB
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={removeReceipt}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-danger hover:bg-danger-soft/40"
                                    title="Remove receipt"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                        {form.errors.receipt && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.receipt}
                            </p>
                        )}
                    </div>

                    {/* Operational Remarks */}
                    <div>
                        <label className="block text-xs font-semibold tracking-wider text-ink uppercase">
                            Operational Remarks / Notes
                        </label>
                        <textarea
                            rows={2}
                            value={form.data.remarks}
                            onChange={(e) =>
                                form.setData('remarks', e.target.value)
                            }
                            placeholder="Dispensing technician notes, tank level before refuel, unusual conditions..."
                            className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface p-3 text-sm text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                        />
                        {form.errors.remarks && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.remarks}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
                        <Button type="button" variant="quiet" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={
                                form.processing ||
                                !form.data.quantity_litres ||
                                isMonotonicViolation
                            }
                        >
                            {form.processing
                                ? 'Recording Log…'
                                : 'Submit Refueling Log'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
