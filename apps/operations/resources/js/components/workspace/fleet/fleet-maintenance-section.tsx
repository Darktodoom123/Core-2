import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import React, { useState } from 'react';
import { Button, InlineNotice, Modal } from '@/components/ui';
import { FleetInput } from '@/components/workspace/fleet/fleet-input';
import { formatDateTime } from '@/lib/formatters';
import type { AssetViewModel } from '@/types/workspace';

export interface FleetMaintenanceSectionProps {
    asset: AssetViewModel;
    canMaintain: boolean;
}

export function FleetMaintenanceSection({
    asset,
    canMaintain,
}: FleetMaintenanceSectionProps) {
    const [showOpenForm, setShowOpenForm] = useState(false);
    const [completingOrderId, setCompletingOrderId] = useState<number | null>(
        null,
    );
    const [releasingOrderId, setReleasingOrderId] = useState<number | null>(
        null,
    );
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const openForm = useForm({
        defect: '',
        dispatch_blocking: true,
        remarks: '',
    });

    const completeForm = useForm({
        work_performed: '',
        parts: '',
        remarks: '',
        completed_at: '',
    });

    const releaseForm = useForm({
        work_performed: '',
        parts: '',
        remarks: '',
    });

    const submitOpen = (e: FormEvent) => {
        e.preventDefault();
        openForm.post(`/operations/assets/${asset.id}/maintenance`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setShowOpenForm(false);
                openForm.reset();
                setSuccessMessage('Maintenance work order opened.');
            },
        });
    };

    const submitComplete = (e: FormEvent, orderId: number) => {
        e.preventDefault();
        completeForm.transform((data) => ({
            work_performed: data.work_performed
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line !== ''),
            parts: data.parts
                .split(',')
                .map((p) => p.trim())
                .filter((p) => p !== ''),
            remarks: data.remarks,
            completed_at: data.completed_at ? data.completed_at : null,
        }));
        completeForm.post(`/operations/maintenance/${orderId}/complete`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setCompletingOrderId(null);
                completeForm.reset();
                setSuccessMessage('Repair completion recorded.');
            },
        });
    };

    const submitRelease = (e: FormEvent, orderId: number) => {
        e.preventDefault();
        releaseForm.transform((data) => ({
            work_performed: data.work_performed
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line !== ''),
            parts: data.parts
                .split(',')
                .map((p) => p.trim())
                .filter((p) => p !== ''),
            remarks: data.remarks,
        }));
        releaseForm.post(`/operations/maintenance/${orderId}/release`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setReleasingOrderId(null);
                releaseForm.reset();
                setSuccessMessage('Work order released after verification.');
            },
        });
    };

    const sortedMaintenanceOrders = [...asset.maintenance_work_orders].sort(
        (a, b) => {
            const priority = (
                order: (typeof asset.maintenance_work_orders)[number],
            ) => (order.released_at ? 2 : order.dispatch_blocking ? 0 : 1);
            const priorityDifference = priority(a) - priority(b);

            if (priorityDifference !== 0) {
                return priorityDifference;
            }

            const aDate = new Date(
                a.created_at ?? a.completed_at ?? a.released_at ?? 0,
            ).getTime();
            const bDate = new Date(
                b.created_at ?? b.completed_at ?? b.released_at ?? 0,
            ).getTime();

            return bDate - aDate || b.id - a.id;
        },
    );

    const openWorkOrderDialog = () => {
        setSuccessMessage(null);
        openForm.clearErrors();
        setShowOpenForm(true);
    };

    const closeWorkOrderDialog = () => {
        setShowOpenForm(false);
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                    <h3 className="text-sm font-semibold text-ink">
                        Maintenance work orders
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-ink-soft">
                        Track repair progress and release dispatch blocks only
                        after post-repair verification.
                    </p>
                </div>
                {canMaintain && (
                    <Button variant="primary" onClick={openWorkOrderDialog}>
                        Open maintenance work order
                    </Button>
                )}
            </div>

            {successMessage && (
                <InlineNotice tone="success" title={successMessage} />
            )}

            <Modal
                open={showOpenForm && canMaintain}
                onClose={closeWorkOrderDialog}
                title="Open maintenance work order"
                description={`${asset.code} · ${asset.name}`}
                size="lg"
                closeOnBackdrop={false}
                contentClassName="p-5 sm:p-6"
                footer={
                    <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="max-w-sm text-xs leading-5 text-ink-soft">
                            This creates a maintenance record for the selected
                            asset. You can close this dialog without losing
                            unfinished entries.
                        </p>
                        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
                            <Button
                                variant="secondary"
                                onClick={closeWorkOrderDialog}
                                aria-label="Close work order dialog"
                            >
                                Close
                            </Button>
                            <Button
                                type="submit"
                                form={`maintenance-open-form-${asset.id}`}
                                variant="primary"
                                disabled={
                                    openForm.processing ||
                                    !openForm.data.defect.trim()
                                }
                                className="whitespace-nowrap"
                            >
                                {openForm.processing
                                    ? 'Opening…'
                                    : 'Create work order'}
                            </Button>
                        </div>
                    </div>
                }
            >
                <form
                    id={`maintenance-open-form-${asset.id}`}
                    onSubmit={submitOpen}
                    className="space-y-5"
                    noValidate
                >
                    <div>
                        <h4 className="text-base font-semibold text-ink">
                            Describe the maintenance issue
                        </h4>
                        <p className="mt-1 text-sm leading-5 text-ink-soft">
                            Capture the defect clearly so the repair,
                            inspection, and release trail can be verified later.
                        </p>
                    </div>
                    <div
                        role="note"
                        className="rounded-lg bg-warning-soft p-3.5 text-sm leading-5 text-warning-strong"
                    >
                        A dispatch-blocking order prevents assignment or
                        activation until repair completion, a passing
                        post-repair inspection, and release are all recorded.
                    </div>
                    <FleetInput
                        label="Defect description"
                        value={openForm.data.defect}
                        error={openForm.errors.defect}
                        onChange={(v) => openForm.setData('defect', v)}
                        required
                    />
                    <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink">
                        <input
                            type="checkbox"
                            checked={openForm.data.dispatch_blocking}
                            onChange={(e) =>
                                openForm.setData(
                                    'dispatch_blocking',
                                    e.target.checked,
                                )
                            }
                            className="h-5 w-5 shrink-0 rounded border-line-strong text-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                        />
                        <span>
                            Dispatch blocking
                            <span className="mt-0.5 block text-xs leading-5 font-normal text-ink-soft">
                                The asset cannot be assigned or activated until
                                the order is released.
                            </span>
                        </span>
                    </label>
                    <FleetInput
                        label="Remarks / parts needed"
                        value={openForm.data.remarks}
                        error={openForm.errors.remarks}
                        onChange={(v) => openForm.setData('remarks', v)}
                    />
                </form>
            </Modal>

            {asset.maintenance_work_orders.length === 0 ? (
                <div className="border-y border-dashed border-line py-8 text-center">
                    <p className="text-sm font-medium text-ink">
                        No maintenance work orders recorded for this asset.
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">
                        Open a work order when this asset needs repair or
                        inspection follow-up.
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-line">
                    {sortedMaintenanceOrders.map((order) => {
                        const isUnreleased = !order.released_at;
                        const isCompletingThis = completingOrderId === order.id;
                        const isReleasingThis = releasingOrderId === order.id;
                        const qualifyingInspection = order.completed_at
                            ? [...(asset.inspections ?? [])]
                                  .sort(
                                      (a, b) =>
                                          new Date(
                                              b.completed_at ?? 0,
                                          ).getTime() -
                                              new Date(
                                                  a.completed_at ?? 0,
                                              ).getTime() || b.id - a.id,
                                  )
                                  .find(
                                      (i) =>
                                          i.result === 'passed' &&
                                          i.type === 'post_repair' &&
                                          i.completed_at &&
                                          new Date(i.completed_at).getTime() >=
                                              new Date(
                                                  order.completed_at!,
                                              ).getTime(),
                                  )
                            : null;
                        const verifiedAt = qualifyingInspection?.completed_at
                            ? new Date(
                                  qualifyingInspection.completed_at,
                              ).getTime()
                            : null;
                        const hasSubsequentDefect =
                            verifiedAt !== null &&
                            (asset.inspections.some(
                                (inspection) =>
                                    inspection.result !== 'passed' &&
                                    inspection.completed_at &&
                                    (new Date(
                                        inspection.completed_at,
                                    ).getTime() > verifiedAt ||
                                        (new Date(
                                            inspection.completed_at,
                                        ).getTime() === verifiedAt &&
                                            inspection.id >
                                                qualifyingInspection!.id)),
                            ) ||
                                [
                                    ...(asset.dvir_inspections ?? []),
                                    ...(asset.latest_dvir
                                        ? [asset.latest_dvir]
                                        : []),
                                ].some(
                                    (dvir) =>
                                        (dvir.has_defects ||
                                            dvir.critical_defects_count > 0) &&
                                        dvir.completed_at &&
                                        new Date(dvir.completed_at).getTime() >
                                            verifiedAt,
                                ));

                        return (
                            <li key={order.id} className="space-y-2 py-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-ink">
                                            {order.defect}
                                        </span>
                                        {order.dispatch_blocking && (
                                            <span className="inline-flex items-center text-xs font-semibold text-danger-strong">
                                                Blocking
                                            </span>
                                        )}
                                        {order.completed_at ? (
                                            <>
                                                <span className="text-positive-strong inline-flex items-center text-xs font-semibold">
                                                    Repair Completed:{' '}
                                                    {formatDateTime(
                                                        order.completed_at,
                                                    )}
                                                </span>
                                                {qualifyingInspection &&
                                                !hasSubsequentDefect ? (
                                                    <span className="text-positive-strong inline-flex items-center text-xs font-semibold">
                                                        Post-Repair: Verified
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center text-xs font-semibold text-warning-strong">
                                                        Post-Repair: Awaiting
                                                        Verification
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <span className="inline-flex items-center text-xs font-semibold text-warning-strong">
                                                Pending Repair Completion
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-ink-soft tabular-nums">
                                        {order.released_at
                                            ? `Released: ${formatDateTime(order.released_at, 'Not recorded')}`
                                            : 'Open / In progress'}
                                    </span>
                                </div>

                                {isUnreleased &&
                                    order.completed_at &&
                                    (!qualifyingInspection ||
                                        hasSubsequentDefect) && (
                                        <p className="text-xs text-ink-soft">
                                            In Inspections, record a passing
                                            Post-repair verification before
                                            releasing this work order. Routine
                                            DVIRs do not verify repairs.
                                        </p>
                                    )}

                                {order.work_performed.length > 0 && (
                                    <p className="text-xs text-ink-soft">
                                        Work performed:{' '}
                                        {order.work_performed.join('; ')}
                                    </p>
                                )}
                                {order.parts.length > 0 && (
                                    <p className="text-xs text-ink-soft">
                                        Parts used: {order.parts.join(', ')}
                                    </p>
                                )}

                                {isUnreleased && canMaintain && (
                                    <div className="pt-2">
                                        {!isCompletingThis &&
                                            !isReleasingThis && (
                                                <div className="flex flex-wrap gap-2">
                                                    {!order.completed_at && (
                                                        <Button
                                                            variant="secondary"
                                                            onClick={() => {
                                                                setCompletingOrderId(
                                                                    order.id,
                                                                );
                                                                setReleasingOrderId(
                                                                    null,
                                                                );
                                                            }}
                                                        >
                                                            Record repair
                                                            completion
                                                        </Button>
                                                    )}
                                                    {order.completed_at && (
                                                        <Button
                                                            variant="secondary"
                                                            onClick={() => {
                                                                setReleasingOrderId(
                                                                    order.id,
                                                                );
                                                                setCompletingOrderId(
                                                                    null,
                                                                );
                                                            }}
                                                        >
                                                            Release work order
                                                        </Button>
                                                    )}
                                                </div>
                                            )}

                                        {isCompletingThis && (
                                            <form
                                                onSubmit={(e) =>
                                                    submitComplete(e, order.id)
                                                }
                                                className="mt-3 space-y-3 border-t border-line pt-3"
                                                noValidate
                                            >
                                                <div className="border-l-2 border-brand-strong/50 pl-3 text-sm text-brand-strong">
                                                    Notice: Authoritatively
                                                    record physical repair
                                                    completion details before
                                                    conducting post-repair
                                                    verification in Inspections.
                                                </div>
                                                <label className="block text-sm font-medium text-ink">
                                                    Work performed * (One task
                                                    per line)
                                                    <textarea
                                                        rows={2}
                                                        value={
                                                            completeForm.data
                                                                .work_performed
                                                        }
                                                        onChange={(e) =>
                                                            completeForm.setData(
                                                                'work_performed',
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="mt-1 w-full rounded-lg border border-line-strong bg-surface p-2 text-sm text-ink transition-colors focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                                                    />
                                                </label>
                                                <FleetInput
                                                    label="Parts used (comma separated)"
                                                    value={
                                                        completeForm.data.parts
                                                    }
                                                    onChange={(v) =>
                                                        completeForm.setData(
                                                            'parts',
                                                            v,
                                                        )
                                                    }
                                                />
                                                <FleetInput
                                                    label="Remarks"
                                                    value={
                                                        completeForm.data
                                                            .remarks
                                                    }
                                                    onChange={(v) =>
                                                        completeForm.setData(
                                                            'remarks',
                                                            v,
                                                        )
                                                    }
                                                />
                                                <FleetInput
                                                    label="Completion timestamp (Optional, defaults to now)"
                                                    value={
                                                        completeForm.data
                                                            .completed_at
                                                    }
                                                    onChange={(v) =>
                                                        completeForm.setData(
                                                            'completed_at',
                                                            v,
                                                        )
                                                    }
                                                    placeholder="YYYY-MM-DD HH:MM:SS"
                                                />
                                                {(
                                                    completeForm.errors as Record<
                                                        string,
                                                        string
                                                    >
                                                ).completed_at && (
                                                    <p className="text-xs font-semibold text-danger">
                                                        {
                                                            (
                                                                completeForm.errors as Record<
                                                                    string,
                                                                    string
                                                                >
                                                            ).completed_at
                                                        }
                                                    </p>
                                                )}
                                                {(
                                                    completeForm.errors as Record<
                                                        string,
                                                        string
                                                    >
                                                ).work_performed && (
                                                    <p className="text-xs font-semibold text-danger">
                                                        {
                                                            (
                                                                completeForm.errors as Record<
                                                                    string,
                                                                    string
                                                                >
                                                            ).work_performed
                                                        }
                                                    </p>
                                                )}
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={() =>
                                                            setCompletingOrderId(
                                                                null,
                                                            )
                                                        }
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        type="submit"
                                                        variant="primary"
                                                        disabled={
                                                            completeForm.processing ||
                                                            !completeForm.data.work_performed.trim()
                                                        }
                                                    >
                                                        {completeForm.processing
                                                            ? 'Recording…'
                                                            : 'Record repair completion'}
                                                    </Button>
                                                </div>
                                            </form>
                                        )}

                                        {isReleasingThis && (
                                            <form
                                                onSubmit={(e) =>
                                                    submitRelease(e, order.id)
                                                }
                                                className="mt-3 space-y-3 border-t border-line pt-3"
                                                noValidate
                                            >
                                                <div className="border-l-2 border-warning-strong/50 pl-3 text-sm text-warning-strong">
                                                    Notice: Releasing requires a
                                                    passing safety inspection
                                                    completed after repair was
                                                    completed
                                                    {order.completed_at
                                                        ? ` on ${formatDateTime(order.completed_at)}`
                                                        : ''}
                                                    .
                                                </div>
                                                <label className="block text-sm font-medium text-ink">
                                                    Work performed * (One task
                                                    per line)
                                                    <textarea
                                                        rows={2}
                                                        value={
                                                            releaseForm.data
                                                                .work_performed
                                                        }
                                                        onChange={(e) =>
                                                            releaseForm.setData(
                                                                'work_performed',
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="mt-1 w-full rounded-lg border border-line-strong bg-surface p-2 text-sm text-ink transition-colors focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                                                    />
                                                </label>
                                                <FleetInput
                                                    label="Parts used (comma separated)"
                                                    value={
                                                        releaseForm.data.parts
                                                    }
                                                    onChange={(v) =>
                                                        releaseForm.setData(
                                                            'parts',
                                                            v,
                                                        )
                                                    }
                                                />
                                                {(
                                                    releaseForm.errors as Record<
                                                        string,
                                                        string
                                                    >
                                                ).completed_at && (
                                                    <p className="text-xs font-semibold text-danger">
                                                        {
                                                            (
                                                                releaseForm.errors as Record<
                                                                    string,
                                                                    string
                                                                >
                                                            ).completed_at
                                                        }
                                                    </p>
                                                )}
                                                {(
                                                    releaseForm.errors as Record<
                                                        string,
                                                        string
                                                    >
                                                ).inspection && (
                                                    <p className="text-xs font-semibold text-danger">
                                                        {
                                                            (
                                                                releaseForm.errors as Record<
                                                                    string,
                                                                    string
                                                                >
                                                            ).inspection
                                                        }
                                                    </p>
                                                )}
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={() =>
                                                            setReleasingOrderId(
                                                                null,
                                                            )
                                                        }
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        type="submit"
                                                        variant="primary"
                                                        disabled={
                                                            releaseForm.processing
                                                        }
                                                    >
                                                        {releaseForm.processing
                                                            ? 'Releasing…'
                                                            : 'Confirm release'}
                                                    </Button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
