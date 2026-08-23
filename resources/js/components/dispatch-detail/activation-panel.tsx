import { router, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { DispatchDetailPageProps } from '@/types/workspace';
import { ActivationPrerequisiteChecklist } from './activation-prerequisite-checklist';

export function ActivationPanel({
    job,
    activation,
}: {
    job: DispatchDetailPageProps['job'];
    activation: DispatchDetailPageProps['activation'];
}) {
    const form = useForm({ version: job.version });
    const { errors } = usePage().props;
    const [attempted, setAttempted] = useState(false);
    const error = attempted
        ? (errors.version ??
          errors.approval ??
          errors.status ??
          errors.personnel ??
          errors.assets ??
          null)
        : null;
    const isStale = attempted && errors.version !== undefined;

    const activate = () => {
        form.post(`/operations/dispatch-jobs/${job.id}/activate`, {
            preserveScroll: true,
            onStart: () => setAttempted(true),
        });
    };

    const refresh = () => {
        setAttempted(false);
        form.clearErrors();
        router.reload({
            only: ['job', 'activation', 'capabilities'],
        });
    };

    return (
        <details
            id="dispatch-activation"
            className="group overflow-hidden rounded-xl border border-line bg-surface"
            aria-busy={form.processing}
        >
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-surface-subtle [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                    <span className="flex items-center gap-2">
                        <span className="font-semibold">Activate dispatch</span>
                        <span
                            className={cn(
                                'rounded-full px-2.5 py-1 text-xs font-medium',
                                activation.ready
                                    ? 'bg-success-soft text-success-strong'
                                    : 'bg-warning-soft text-warning-strong',
                            )}
                        >
                            {activation.ready ? 'Ready' : 'Review needed'}
                        </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-soft">
                        Review readiness and activate when ready
                    </span>
                </span>
                <ChevronDown
                    className="h-5 w-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180"
                    aria-hidden="true"
                />
            </summary>

            <div className="space-y-4 border-t border-line px-4 py-4">
                <div>
                    <p className="text-xs text-ink-soft">
                        Version {job.version} will be rechecked with current
                        approval and asset safety.
                    </p>
                </div>

                <ActivationPrerequisiteChecklist
                    job={job}
                    activation={activation}
                />

                {activation.blockers.length > 0 && (
                    <div className="space-y-1.5 rounded-lg border border-warning/40 bg-warning-soft/30 p-3">
                        <p className="text-xs font-semibold text-warning-strong">
                            Blocking activation reasons
                        </p>
                        <ul className="space-y-1 text-xs text-warning-strong">
                            {activation.blockers.map((blocker) => (
                                <li
                                    key={blocker}
                                    className="flex items-start gap-2"
                                >
                                    <AlertTriangle
                                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                        aria-hidden="true"
                                    />
                                    <span>{blocker}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {error && (
                    <div
                        className="rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger"
                        role="alert"
                        aria-live="assertive"
                        aria-atomic="true"
                    >
                        <p className="font-semibold">
                            {isStale
                                ? 'Dispatch changed — refresh before activating'
                                : 'Activation was blocked'}
                        </p>
                        <p className="mt-1">{error}</p>
                        {isStale && (
                            <Button
                                className="mt-3"
                                variant="secondary"
                                size="sm"
                                onClick={refresh}
                            >
                                <RefreshCw
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Refresh and review
                            </Button>
                        )}
                    </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                        variant="quiet"
                        size="sm"
                        onClick={refresh}
                        disabled={form.processing}
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Refresh readiness
                    </Button>
                    <Button
                        id={`dispatch-activate-${job.id}`}
                        variant="primary"
                        onClick={activate}
                        disabled={form.processing || !activation.ready}
                    >
                        {form.processing
                            ? 'Activating dispatch…'
                            : 'Activate dispatch'}
                    </Button>
                </div>
            </div>
        </details>
    );
}
