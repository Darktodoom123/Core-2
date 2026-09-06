import { useForm } from '@inertiajs/react';
import { ShieldAlert, Wrench, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { AssetViewModel } from '@/types/workspace';

interface SafetyLockoutBannerProps {
    lockout: AssetViewModel['lockout'];
    assetId?: number;
    assetCode: string;
    maintenanceWorkOrders?: AssetViewModel['maintenance_work_orders'];
    onClearSuccess?: () => void;
    className?: string;
}

export function SafetyLockoutBanner({
    lockout,
    assetCode,
    maintenanceWorkOrders = [],
    onClearSuccess,
    className,
}: SafetyLockoutBannerProps) {
    const [showClearModal, setShowClearModal] = useState(false);

    // Find the active blocking work order if present
    const activeBlockingOrder = maintenanceWorkOrders.find(
        (o) => o.dispatch_blocking && !o.released_at,
    );

    const form = useForm({
        work_performed: ['Defect inspected and safety clearance verified'],
        parts: [] as string[],
        remarks: '',
        managerial_override: true,
        override_reason: '',
    });

    if (!lockout?.is_locked_out) {
        return null;
    }

    const handleSubmitRelease = (e: FormEvent) => {
        e.preventDefault();

        const workOrderId = activeBlockingOrder?.id;

        if (!workOrderId) {
            // If no explicit work order id, close modal
            setShowClearModal(false);

            return;
        }

        form.post(`/maintenance/${workOrderId}/release`, {
            preserveScroll: true,
            onSuccess: () => {
                setShowClearModal(false);
                form.reset();
                onClearSuccess?.();
            },
        });
    };

    return (
        <>
            <div
                className={cn(
                    'rounded-xl border border-danger/40 bg-danger-soft/60 p-4 text-ink shadow-xs',
                    className,
                )}
                role="alert"
                aria-live="assertive"
            >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger text-white shadow-xs">
                            <ShieldAlert className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold tracking-wide text-danger-strong uppercase">
                                    DISPATCH SAFETY LOCKOUT ACTIVE
                                </h4>
                                <span className="py-0.2 rounded bg-danger-strong px-1.5 text-[10px] font-bold text-white uppercase">
                                    Unavailable
                                </span>
                            </div>
                            <p className="mt-1 text-xs font-medium text-ink">
                                {lockout.lockout_reason ||
                                    'Equipment is locked out following critical DVIR safety defects or an active maintenance order.'}
                            </p>
                            <p className="mt-0.5 text-[11px] text-ink-soft">
                                This asset is restricted from dispatch
                                assignments until safety clearance and
                                verification sign-off is completed.
                            </p>
                        </div>
                    </div>

                    {lockout.can_override && activeBlockingOrder && (
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setShowClearModal(true)}
                            className="shrink-0"
                        >
                            <Wrench className="mr-1.5 h-3.5 w-3.5" />
                            Resolve &amp; Clear Lockout
                        </Button>
                    )}
                </div>
            </div>

            {/* Resolve Lockout Modal */}
            {showClearModal && activeBlockingOrder && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="clear-lockout-title"
                >
                    <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-line pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-strong">
                                    <Wrench className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3
                                        id="clear-lockout-title"
                                        className="text-base font-bold text-ink"
                                    >
                                        Safety Lockout Resolution
                                    </h3>
                                    <p className="text-xs text-ink-soft">
                                        Asset:{' '}
                                        <strong className="text-ink">
                                            {assetCode}
                                        </strong>{' '}
                                        · Work Order #{activeBlockingOrder.id}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowClearModal(false)}
                                className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-subtle hover:text-ink focus:outline-none"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form
                            onSubmit={handleSubmitRelease}
                            className="mt-4 space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Defect Description
                                </label>
                                <div className="mt-1 max-h-24 overflow-y-auto rounded-lg border border-line bg-surface-subtle p-2.5 font-mono text-[11px] whitespace-pre-wrap text-ink-soft">
                                    {activeBlockingOrder.defect}
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="work-performed-input"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Work Performed / Remediation Taken *
                                </label>
                                <textarea
                                    id="work-performed-input"
                                    required
                                    rows={3}
                                    value={form.data.work_performed.join('\n')}
                                    onChange={(e) =>
                                        form.setData(
                                            'work_performed',
                                            e.target.value
                                                .split('\n')
                                                .filter(Boolean),
                                        )
                                    }
                                    placeholder="List mechanical repairs, component replacements, hydraulic adjustments, or safety tests conducted…"
                                    className="mt-1 w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink placeholder:text-ink-soft focus:border-line-strong focus:outline-none"
                                />
                                {form.errors.work_performed && (
                                    <p className="mt-1 text-xs text-danger">
                                        {form.errors.work_performed}
                                    </p>
                                )}
                            </div>

                            <div className="rounded-lg border border-line bg-surface-subtle p-3">
                                <label className="flex cursor-pointer items-start gap-2.5">
                                    <input
                                        type="checkbox"
                                        checked={form.data.managerial_override}
                                        onChange={(e) =>
                                            form.setData(
                                                'managerial_override',
                                                e.target.checked,
                                            )
                                        }
                                        className="mt-0.5 rounded border-line text-brand focus:ring-brand"
                                    />
                                    <div>
                                        <span className="text-xs font-semibold text-ink">
                                            Managerial Safety Clearance Override
                                        </span>
                                        <p className="text-[11px] leading-relaxed text-ink-soft">
                                            Authorize return to service without
                                            awaiting secondary DVIR walkaround
                                            submission. Audit trail will log
                                            your user ID as certifying verifier.
                                        </p>
                                    </div>
                                </label>

                                {form.data.managerial_override && (
                                    <div className="mt-3">
                                        <label
                                            htmlFor="override-reason-input"
                                            className="block text-xs font-semibold text-ink"
                                        >
                                            Managerial Justification / Sign-off
                                            Remarks *
                                        </label>
                                        <input
                                            id="override-reason-input"
                                            type="text"
                                            required
                                            value={form.data.override_reason}
                                            onChange={(e) =>
                                                form.setData(
                                                    'override_reason',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="e.g. Visual re-inspection verified; hydraulics holding pressure at 250 bar"
                                            className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink focus:outline-none"
                                        />
                                        {form.errors.override_reason && (
                                            <p className="mt-1 text-xs text-danger">
                                                {form.errors.override_reason}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 border-t border-line pt-4">
                                <Button
                                    variant="quiet"
                                    type="button"
                                    onClick={() => setShowClearModal(false)}
                                    disabled={form.processing}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    type="submit"
                                    disabled={form.processing}
                                >
                                    {form.processing
                                        ? 'Clearing Lockout…'
                                        : 'Sign Off & Return to Service'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
