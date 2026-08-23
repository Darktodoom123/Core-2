import { Check } from 'lucide-react';
import React from 'react';
import { Button, Panel } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { DispatchDetailPageProps } from '@/types/workspace';

export function AssignmentNextAction({
    activation,
    canActivate,
    assignmentSaved,
}: {
    activation: DispatchDetailPageProps['activation'];
    canActivate: boolean;
    assignmentSaved: boolean;
}) {
    return (
        <Panel className="border-brand/40 bg-brand-soft/20 p-4 shadow-2xs">
            <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                    {assignmentSaved
                        ? 'Assignments recorded'
                        : 'Ready for next step'}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                    {activation.ready && canActivate
                        ? 'All prerequisites met. You can now activate this dispatch.'
                        : 'Review the latest readiness and approval state before activation.'}
                </p>
            </div>
        </Panel>
    );
}

export function AssignmentStageSummaries({
    activation,
    canActivate,
    onSelectStep,
}: {
    activation: DispatchDetailPageProps['activation'];
    canActivate: boolean;
    onSelectStep?: (step: 1 | 2 | 3) => void;
}) {
    const blockerCount = activation.blockers.length;

    return (
        <section
            aria-label="Dispatch setup stage summaries"
            className="overflow-hidden rounded-xl border border-line bg-surface shadow-2xs"
        >
            <a
                href="#dispatch-context"
                onClick={(e) => {
                    if (onSelectStep) {
                        e.preventDefault();
                        onSelectStep(1);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }}
                className="flex min-h-16 items-center justify-between gap-4 border-b border-line px-4 py-3 transition-colors hover:bg-surface-subtle sm:px-5"
            >
                <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-strong ring-2 ring-success/20">
                        <Check className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                        <span className="block font-semibold text-ink">
                            Review dispatch details
                        </span>
                        <span className="block truncate text-xs text-ink-soft">
                            Schedule, site, and requirements
                        </span>
                    </span>
                </span>
                <span className="inline-flex shrink-0 items-center text-sm font-medium text-brand-strong">
                    View details
                </span>
            </a>
            {canActivate && (
                <a
                    href="#dispatch-activation"
                    onClick={(e) => {
                        if (onSelectStep) {
                            e.preventDefault();
                            onSelectStep(3);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        } else {
                            const activationPanel = document.getElementById(
                                'dispatch-activation',
                            ) as HTMLDetailsElement | null;
                            activationPanel?.setAttribute('open', '');
                            activationPanel?.scrollIntoView({
                                behavior: 'smooth',
                            });
                        }
                    }}
                    className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-surface-subtle sm:px-5"
                >
                    <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-xs font-semibold text-ink-soft">
                            3
                        </span>
                        <span className="min-w-0">
                            <span className="block font-semibold text-ink">
                                Activate dispatch
                            </span>
                            <span className="block truncate text-xs text-ink-soft">
                                Review readiness and activate when ready
                            </span>
                        </span>
                    </span>
                    <span
                        className={cn(
                            'inline-flex shrink-0 items-center text-sm font-medium',
                            activation.ready
                                ? 'text-success-strong'
                                : 'text-warning-strong',
                        )}
                    >
                        {activation.ready
                            ? 'Ready'
                            : blockerCount > 0
                              ? `${blockerCount} blocker${blockerCount === 1 ? '' : 's'}`
                              : 'Review needed'}
                    </span>
                </a>
            )}
        </section>
    );
}

export function MobileAssignmentActionBar({
    formId,
    selectedCount,
    processing,
    canAssign,
    assignmentSaved,
    assignmentSavedThisVisit,
    activation,
    canActivate,
    jobId,
    onActivationAction,
}: {
    formId: string;
    selectedCount: number;
    processing: boolean;
    canAssign: boolean;
    assignmentSaved: boolean;
    assignmentSavedThisVisit: boolean;
    activation: DispatchDetailPageProps['activation'];
    canActivate: boolean;
    jobId: number;
    onActivationAction: () => void;
}) {
    if (assignmentSaved) {
        const blockerCount = activation.blockers.length;
        const nextActionLabel =
            canActivate && activation.ready
                ? 'Activate dispatch'
                : blockerCount > 0
                  ? `Review ${blockerCount} blocker${blockerCount === 1 ? '' : 's'}`
                  : 'Review activation';

        return (
            <div
                id="mobile-assignment-action-bar"
                className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] xl:hidden"
            >
                <div className="mx-auto flex max-w-[96rem] items-center gap-3">
                    <p className="min-w-0 flex-1 text-sm text-ink-soft">
                        <span className="font-semibold text-success-strong">
                            {assignmentSavedThisVisit ? 'Saved' : 'Assigned'}
                        </span>{' '}
                        {canActivate && activation.ready
                            ? 'Ready for activation.'
                            : 'Continue with readiness review.'}
                    </p>
                    <Button
                        id={`mobile-activation-action-${jobId}`}
                        type="button"
                        variant="primary"
                        className="shrink-0"
                        onClick={onActivationAction}
                    >
                        {nextActionLabel}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div
            id="mobile-assignment-action-bar"
            className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] xl:hidden"
        >
            <div className="mx-auto flex max-w-[96rem] items-center gap-3">
                <p className="min-w-0 flex-1 text-sm text-ink-soft">
                    <span className="font-semibold text-ink">
                        {selectedCount}
                    </span>{' '}
                    selected
                </p>
                <Button
                    type="submit"
                    form={formId}
                    variant="primary"
                    className="shrink-0"
                    disabled={processing || selectedCount === 0 || !canAssign}
                    aria-busy={processing}
                >
                    {processing
                        ? 'Saving…'
                        : selectedCount > 0
                          ? 'Assign resources'
                          : 'Select resources'}
                </Button>
            </div>
        </div>
    );
}
