import { useForm } from '@inertiajs/react';
import { Fuel, Truck, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui';
import { humanize } from '@/lib/formatters';
import type { AssetViewModel } from '@/types/workspace';

interface CreateFuelRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    assets?: AssetViewModel[];
}

export function CreateFuelRequestModal({
    isOpen,
    onClose,
    assets = [],
}: CreateFuelRequestModalProps) {
    if (!isOpen) {
        return null;
    }

    return <CreateFuelRequestModalContent onClose={onClose} assets={assets} />;
}

function CreateFuelRequestModalContent({
    onClose,
    assets,
}: {
    onClose: () => void;
    assets: AssetViewModel[];
}) {
    const form = useForm({
        operational_asset_id: '',
        dispatch_job_id: '',
        quantity_litres: '',
        fuel_type: 'diesel',
        purpose: '',
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

    const selectedAsset = useMemo(() => {
        if (!form.data.operational_asset_id) {
            return null;
        }

        return (
            assets.find(
                (a) => String(a.id) === String(form.data.operational_asset_id),
            ) ?? null
        );
    }, [assets, form.data.operational_asset_id]);

    const formComplete =
        form.data.quantity_litres.trim() !== '' &&
        Number(form.data.quantity_litres) > 0 &&
        (form.data.operational_asset_id !== '' ||
            form.data.purpose.trim() !== '');

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            purpose:
                data.purpose.trim() !== ''
                    ? data.purpose
                    : selectedAsset
                      ? `Refuel for ${selectedAsset.name || selectedAsset.code} (${humanize(selectedAsset.kind)})`
                      : 'Equipment refueling',
        }));
        form.post('/operations/fuel-requests', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onClose();
            },
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-fuel-request-title"
        >
            <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-line bg-surface p-6 shadow-xl">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-line pb-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                            <Fuel className="h-5 w-5" />
                        </span>
                        <div>
                            <h2
                                id="create-fuel-request-title"
                                className="text-base font-semibold text-ink"
                            >
                                New Refueling Request
                            </h2>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                Submit equipment refueling requests scoped to
                                your fleet baseline and assignments.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                        aria-label="Close dialog"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
                    <div>
                        <label className="block text-xs font-semibold text-ink">
                            Equipment / Asset
                        </label>
                        <select
                            value={form.data.operational_asset_id}
                            onChange={(e) =>
                                form.setData(
                                    'operational_asset_id',
                                    e.target.value,
                                )
                            }
                            className="mt-1.5 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-hidden"
                        >
                            <option value="">
                                -- Select Equipment / Vehicle (Optional) --
                            </option>
                            {assets.map((asset) => (
                                <option key={asset.id} value={asset.id}>
                                    {asset.code} - {asset.name} (
                                    {humanize(asset.kind)}
                                    {asset.registration_number
                                        ? ` · Reg: ${asset.registration_number}`
                                        : ''}
                                    )
                                </option>
                            ))}
                        </select>
                        {form.errors.operational_asset_id && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.operational_asset_id}
                            </p>
                        )}
                    </div>

                    {/* Selected Asset Context Details */}
                    {selectedAsset && (
                        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-subtle p-3 text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-ink">
                                <Truck className="h-4 w-4 text-brand" />
                                <span>{selectedAsset.name}</span>
                            </div>
                            <span className="text-ink-soft">·</span>
                            <div>
                                <span className="text-ink-soft">Type: </span>
                                <span className="font-medium text-ink">
                                    {humanize(selectedAsset.kind)}
                                    {selectedAsset.subtype
                                        ? ` (${selectedAsset.subtype})`
                                        : ''}
                                </span>
                            </div>
                            <span className="text-ink-soft">·</span>
                            <div>
                                <span className="text-ink-soft">Code: </span>
                                <span className="font-mono text-ink tabular-nums">
                                    {selectedAsset.code}
                                </span>
                            </div>
                            {selectedAsset.meter_value && (
                                <>
                                    <span className="text-ink-soft">·</span>
                                    <div>
                                        <span className="text-ink-soft">
                                            Current Meter:{' '}
                                        </span>
                                        <span className="font-medium text-ink tabular-nums">
                                            {selectedAsset.meter_value}{' '}
                                            {selectedAsset.meter_type ===
                                            'hour_meter'
                                                ? 'hrs'
                                                : 'km'}
                                        </span>
                                    </div>
                                </>
                            )}
                            {selectedAsset.baseline_burn_rate && (
                                <>
                                    <span className="text-ink-soft">·</span>
                                    <div>
                                        <span className="text-ink-soft">
                                            Baseline:{' '}
                                        </span>
                                        <span className="font-medium text-ink tabular-nums">
                                            {selectedAsset.baseline_burn_rate}{' '}
                                            {selectedAsset.burn_rate_unit ??
                                                'L/hr'}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-semibold text-ink">
                                Fuel Type *
                            </label>
                            <select
                                value={form.data.fuel_type}
                                onChange={(e) =>
                                    form.setData('fuel_type', e.target.value)
                                }
                                className="mt-1.5 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-hidden"
                            >
                                <option value="diesel">Diesel</option>
                                <option value="gasoline">Gasoline</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-ink">
                                Requested Volume (Litres) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                value={form.data.quantity_litres}
                                onChange={(e) =>
                                    form.setData(
                                        'quantity_litres',
                                        e.target.value,
                                    )
                                }
                                placeholder="e.g. 200.00"
                                className="mt-1.5 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-ink tabular-nums transition-colors placeholder:text-ink-soft focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-hidden"
                            />
                            {form.errors.quantity_litres && (
                                <p className="mt-1 text-xs text-danger">
                                    {form.errors.quantity_litres}
                                </p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-ink">
                            Operational Purpose / Shift Notes
                        </label>
                        <input
                            type="text"
                            value={form.data.purpose}
                            onChange={(e) =>
                                form.setData('purpose', e.target.value)
                            }
                            placeholder="e.g. Concrete pour lift, night shift mobilization"
                            className="mt-1.5 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-soft focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-hidden"
                        />
                        {form.errors.purpose && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.purpose}
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
                            disabled={form.processing || !formComplete}
                        >
                            {form.processing
                                ? 'Submitting…'
                                : 'Submit Refuel Request'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
