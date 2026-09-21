import { useForm } from '@inertiajs/react';
import { ShieldAlert } from 'lucide-react';
import type { FormEvent } from 'react';
import React, { useState } from 'react';
import { Button, InlineNotice } from '@/components/ui';
import { FleetInput } from '@/components/workspace/fleet/fleet-input';
import type { AssetStatusValue, AssetViewModel } from '@/types/workspace';

export interface FleetStatusFormProps {
    asset: AssetViewModel;
    canUpdate: boolean;
}

function formatStatusLabel(status: AssetStatusValue): string {
    return status
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function FleetStatusForm({ asset, canUpdate }: FleetStatusFormProps) {
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
            onSuccess: () => {
                const nextStatusLabel = formatStatusLabel(form.data.status);

                form.setDefaults({ status: form.data.status, reason: '' });
                form.reset();
                setSuccessMessage(`Status updated to ${nextStatusLabel}.`);
            },
        });
    };

    if (!canUpdate) {
        return (
            <section
                aria-labelledby={`asset-status-form-heading-${asset.id}`}
                className="border-t border-line pt-5 @lg:border-t-0 @lg:border-l @lg:pt-0 @lg:pl-8"
            >
                <h3
                    id={`asset-status-form-heading-${asset.id}`}
                    className="text-base font-semibold text-ink"
                >
                    Change operational status
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                    Your role does not have authorization to update status for
                    this asset kind.
                </p>
            </section>
        );
    }

    return (
        <section
            aria-labelledby={`asset-status-form-heading-${asset.id}`}
            className="border-t border-line pt-5 @lg:border-t-0 @lg:border-l @lg:pt-0 @lg:pl-8"
        >
            <div>
                <h3
                    id={`asset-status-form-heading-${asset.id}`}
                    className="text-base font-semibold text-ink"
                >
                    Change operational status
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                    Record a lifecycle change for this asset. A reason is
                    required for the audit trail.
                </p>
            </div>

            <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
                {successMessage && (
                    <InlineNotice tone="success" title={successMessage} />
                )}

                <div
                    role="note"
                    className="flex items-start gap-3 rounded-lg bg-surface-subtle p-3.5 text-sm text-ink-soft"
                >
                    <ShieldAlert
                        className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong"
                        aria-hidden="true"
                    />
                    <div>
                        <p className="font-semibold text-ink">
                            Status changes do not clear dispatch blockers
                        </p>
                        <p className="mt-0.5 text-xs leading-5">
                            Transitioning to{' '}
                            <span className="font-semibold text-ink">
                                Ready for Service
                            </span>{' '}
                            or{' '}
                            <span className="font-semibold text-ink">
                                Available
                            </span>{' '}
                            still requires a passing inspection and zero
                            unreleased dispatch-blocking work orders.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
                    <label className="text-sm font-medium text-ink">
                        Target status *
                        <select
                            value={form.data.status}
                            onChange={(e) => {
                                setSuccessMessage(null);
                                form.setData(
                                    'status',
                                    e.target.value as AssetStatusValue,
                                );
                            }}
                            aria-invalid={Boolean(form.errors.status)}
                            aria-describedby={
                                form.errors.status
                                    ? `asset-status-error-${asset.id}`
                                    : undefined
                            }
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
                            <option value="awaiting_parts">
                                Awaiting Parts
                            </option>
                            <option value="unavailable">Unavailable</option>
                        </select>
                    </label>

                    <FleetInput
                        label="Reason for status change"
                        value={form.data.reason}
                        error={form.errors.reason}
                        onChange={(v) => {
                            setSuccessMessage(null);
                            form.setData('reason', v);
                        }}
                        required
                    />
                </div>

                {form.errors.status && (
                    <p
                        id={`asset-status-error-${asset.id}`}
                        role="alert"
                        className="text-xs font-medium text-danger"
                    >
                        {form.errors.status}
                    </p>
                )}

                {form.data.status !== asset.status.value && (
                    <p className="rounded-md bg-brand-soft px-3 py-2 text-xs text-brand-strong">
                        This will change the recorded status from{' '}
                        <span className="font-semibold">
                            {asset.status.label}
                        </span>{' '}
                        to{' '}
                        <span className="font-semibold">
                            {formatStatusLabel(form.data.status)}
                        </span>
                        .
                    </p>
                )}

                <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-ink-soft">
                        The change is recorded with your reason and identity.
                    </p>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={form.processing || !form.data.reason.trim()}
                    >
                        {form.processing ? 'Updating…' : 'Update asset status'}
                    </Button>
                </div>
            </form>
        </section>
    );
}
