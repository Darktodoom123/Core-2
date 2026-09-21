import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import React from 'react';
import { Button } from '@/components/ui';
import { FleetInput } from '@/components/workspace/fleet/fleet-input';
import type { AssetStatusValue, AssetViewModel } from '@/types/workspace';

export interface FleetStatusFormProps {
    asset: AssetViewModel;
    canUpdate: boolean;
}

export function FleetStatusForm({ asset, canUpdate }: FleetStatusFormProps) {
    const form = useForm<{
        status: AssetStatusValue;
        reason: string;
    }>({
        status: asset.status.value,
        reason: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(`/operations/assets/${asset.id}/status`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => form.reset(),
        });
    };

    if (!canUpdate) {
        return (
            <div className="border-y border-line py-5 text-sm text-ink-soft">
                Your role does not have authorization to update status for this
                asset kind.
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-5" noValidate>
            <div className="border-y border-line py-4 text-sm text-ink-soft">
                <strong className="text-ink">Dispatch readiness rule:</strong>{' '}
                Transitioning to{' '}
                <span className="font-semibold text-ink">
                    Ready for Service
                </span>{' '}
                or <span className="font-semibold text-ink">Available</span>{' '}
                requires a completed passing inspection and zero unreleased
                dispatch-blocking work orders.
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-medium text-ink">
                    Target status *
                    <select
                        value={form.data.status}
                        onChange={(e) =>
                            form.setData(
                                'status',
                                e.target.value as AssetStatusValue,
                            )
                        }
                        aria-invalid={Boolean(form.errors.status)}
                        className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink transition-colors focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                    >
                        <option value="available">Available</option>
                        <option value="ready_for_service">
                            Ready for Service
                        </option>
                        <option value="under_inspection">
                            Under Inspection
                        </option>
                        <option value="under_maintenance">
                            Under Maintenance
                        </option>
                        <option value="awaiting_parts">Awaiting Parts</option>
                        <option value="unavailable">Unavailable</option>
                    </select>
                </label>

                <FleetInput
                    label="Reason for status change *"
                    value={form.data.reason}
                    error={form.errors.reason}
                    onChange={(v) => form.setData('reason', v)}
                    required
                />
            </div>

            {form.errors.status && (
                <p role="alert" className="text-xs font-medium text-danger">
                    {form.errors.status}
                </p>
            )}

            <div className="flex justify-end border-t border-line pt-4">
                <Button
                    type="submit"
                    variant="primary"
                    disabled={form.processing || !form.data.reason.trim()}
                >
                    {form.processing ? 'Updating…' : 'Update asset status'}
                </Button>
            </div>
        </form>
    );
}
