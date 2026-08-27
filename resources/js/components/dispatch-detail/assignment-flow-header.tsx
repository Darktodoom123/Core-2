import { Check } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';
import type { DispatchDetailPageProps } from '@/types/workspace';
import { formatResourceCounts } from './dispatch-detail-helpers';

export function AssignmentFlowHeader({
    job,
    activation,
    selectedPersonnelCount,
    selectedAssetCount,
    canActivate,
    hasPendingSelections,
    activeStep,
    onSelectStep,
}: {
    job: DispatchDetailPageProps['job'];
    activation: DispatchDetailPageProps['activation'];
    selectedPersonnelCount: number;
    selectedAssetCount: number;
    canActivate: boolean;
    hasPendingSelections: boolean;
    activeStep: 1 | 2 | 3;
    onSelectStep: (step: 1 | 2 | 3) => void;
}) {
    const hasAssignments =
        job.personnel_assignments.length + job.asset_assignments.length > 0;
    const hasSavedAssignments = hasAssignments && !hasPendingSelections;
    const assignmentStepLabel = hasPendingSelections
        ? `${formatResourceCounts(selectedPersonnelCount, selectedAssetCount)} selected`
        : hasSavedAssignments
          ? `${formatResourceCounts(job.personnel_assignments.length, job.asset_assignments.length)} assigned`
          : 'Select eligible personnel and assets';

    return (
        <section aria-label="Dispatch setup progress" className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 className="text-xl font-semibold text-ink">
                    Prepare this dispatch for activation
                </h2>
                <p className="text-xs font-medium text-ink-soft">
                    {hasSavedAssignments
                        ? activation.ready
                            ? 'Ready to activate'
                            : 'Review needed'
                        : 'Assignments pending'}
                </p>
            </div>

            <nav
                aria-label="Dispatch setup progress"
                className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs"
            >
                <ol className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
                    <li
                        aria-current={activeStep === 1 ? 'step' : undefined}
                        className={cn(
                            activeStep === 1 && 'relative bg-brand-soft/40',
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => onSelectStep(1)}
                            className="group flex min-h-20 w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-subtle sm:px-5"
                        >
                            <span
                                className={cn(
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-xs ring-2',
                                    activeStep === 1
                                        ? 'bg-brand text-brand-contrast ring-brand/30'
                                        : 'bg-success-soft text-success-strong ring-success/20',
                                )}
                            >
                                {activeStep === 1 ? (
                                    '1'
                                ) : (
                                    <Check
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                )}
                            </span>
                            <span className="min-w-0">
                                <span
                                    className={cn(
                                        'block text-[11px] font-semibold tracking-wider uppercase',
                                        activeStep === 1
                                            ? 'text-brand-strong'
                                            : 'text-success-strong',
                                    )}
                                >
                                    {activeStep === 1
                                        ? 'Step 1 · Current step'
                                        : 'Step 1 · Completed'}
                                </span>
                                <span className="block font-semibold text-ink transition-colors group-hover:text-brand-strong">
                                    Review dispatch
                                </span>
                                <span className="block truncate text-xs text-ink-soft">
                                    Context and requirements
                                </span>
                            </span>
                        </button>
                    </li>

                    <li
                        aria-current={activeStep === 2 ? 'step' : undefined}
                        className={cn(
                            activeStep === 2 && 'relative bg-brand-soft/40',
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => onSelectStep(2)}
                            className="group flex min-h-20 w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-subtle sm:px-5"
                        >
                            <span
                                className={cn(
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-xs ring-2',
                                    activeStep === 2
                                        ? 'bg-brand text-brand-contrast ring-brand/30'
                                        : hasAssignments
                                          ? 'bg-success-soft text-success-strong ring-success/20'
                                          : 'border border-line-strong bg-surface text-ink-soft',
                                )}
                            >
                                {activeStep === 2 ? (
                                    '2'
                                ) : hasAssignments ? (
                                    <Check
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    '2'
                                )}
                            </span>
                            <span className="min-w-0">
                                <span
                                    className={cn(
                                        'block text-[11px] font-semibold tracking-wider uppercase',
                                        activeStep === 2
                                            ? 'text-brand-strong'
                                            : 'text-ink-soft',
                                    )}
                                >
                                    {activeStep === 2
                                        ? 'Step 2 · Current step'
                                        : hasAssignments
                                          ? 'Step 2 · Assigned'
                                          : 'Step 2 · Pending'}
                                </span>
                                <span className="block font-semibold text-ink transition-colors group-hover:text-brand-strong">
                                    Assign resources
                                </span>
                                <span
                                    className={cn(
                                        'block truncate text-xs font-medium',
                                        activeStep === 2
                                            ? 'text-brand-strong'
                                            : 'text-ink-soft',
                                    )}
                                >
                                    {assignmentStepLabel}
                                </span>
                            </span>
                        </button>
                    </li>

                    <li
                        id="dispatch-activation-step"
                        aria-current={activeStep === 3 ? 'step' : undefined}
                        className={cn(
                            activeStep === 3 && 'relative bg-brand-soft/40',
                        )}
                    >
                        {canActivate ? (
                            <button
                                type="button"
                                onClick={() => onSelectStep(3)}
                                className="group flex min-h-20 w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-subtle sm:px-5"
                            >
                                <span
                                    className={cn(
                                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-xs ring-2',
                                        activeStep === 3
                                            ? 'bg-brand text-brand-contrast ring-brand/30'
                                            : 'border border-line-strong bg-surface text-ink-soft group-hover:border-brand-strong group-hover:text-brand-strong',
                                    )}
                                >
                                    3
                                </span>
                                <span className="min-w-0">
                                    <span
                                        className={cn(
                                            'block text-[11px] font-semibold tracking-wider uppercase',
                                            activeStep === 3
                                                ? 'text-brand-strong'
                                                : 'text-ink-soft',
                                        )}
                                    >
                                        {activeStep === 3
                                            ? 'Step 3 · Current step'
                                            : 'Step 3 · Next step'}
                                    </span>
                                    <span className="block font-semibold text-ink transition-colors group-hover:text-brand-strong">
                                        Activate dispatch
                                    </span>
                                    <span className="block truncate text-xs text-ink-soft">
                                        {activation.ready
                                            ? 'Ready to activate'
                                            : 'Server readiness check'}
                                    </span>
                                </span>
                            </button>
                        ) : (
                            <div className="flex min-h-20 items-center gap-3.5 px-4 py-3.5 opacity-60 sm:px-5">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-soft">
                                    3
                                </span>
                                <span className="min-w-0">
                                    <span
                                        className={cn(
                                            'block text-[11px] font-semibold tracking-wider uppercase',
                                            activeStep === 3
                                                ? 'text-brand-strong'
                                                : 'text-ink-soft',
                                        )}
                                    >
                                        {activeStep === 3
                                            ? 'Step 3 · Current step'
                                            : 'Step 3 · Next step'}
                                    </span>
                                    <span className="block font-semibold text-ink">
                                        Activate dispatch
                                    </span>
                                    <span
                                        className={cn(
                                            'block truncate text-xs',
                                            activeStep === 3
                                                ? 'text-brand-strong'
                                                : 'text-ink-soft',
                                        )}
                                    >
                                        Requires activation permission
                                    </span>
                                </span>
                            </div>
                        )}
                    </li>
                </ol>
            </nav>
        </section>
    );
}
