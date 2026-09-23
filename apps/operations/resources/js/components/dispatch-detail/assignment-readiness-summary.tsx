import React from 'react';
import type { DispatchDetailPageProps } from '@/types/workspace';

export function AssignmentReadinessSummary({
    activation,
    personnelCount,
    assetCount,
    hasPendingSelections,
    onReview,
}: {
    activation: DispatchDetailPageProps['activation'];
    personnelCount: number;
    assetCount: number;
    hasPendingSelections: boolean;
    onReview: () => void;
}) {
    return (
        <section
            aria-label="Saved dispatch readiness"
            className="rounded-lg border border-line bg-surface px-4 py-3 text-sm"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="font-semibold text-ink">
                        {hasPendingSelections
                            ? 'Save selections before reviewing readiness'
                            : activation.ready
                              ? 'Ready for activation review'
                              : 'Review before activation'}
                    </h3>
                    <p className="mt-1 text-xs text-ink-soft">
                        {personnelCount === 0
                            ? 'No saved personnel'
                            : `${personnelCount} personnel assigned`}{' '}
                        ·{' '}
                        {assetCount === 0
                            ? 'No saved equipment'
                            : `${assetCount} equipment assigned`}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onReview}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-ink underline decoration-brand underline-offset-2 hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                >
                    Review readiness
                </button>
            </div>
            {hasPendingSelections && (
                <p className="mt-2 text-xs text-warning-strong">
                    Your selections are not saved. The checks below apply to the
                    saved dispatch.
                </p>
            )}
            {activation.blockers.length > 0 && (
                <div className="mt-2 text-warning-strong">
                    <ul className="list-disc space-y-1 pl-5">
                        {activation.blockers
                            .slice(0, 3)
                            .map((blocker, index) => (
                                <li key={`${index}-${blocker}`}>{blocker}</li>
                            ))}
                    </ul>
                    {activation.blockers.length > 3 && (
                        <details className="mt-1">
                            <summary className="min-h-11 cursor-pointer content-center rounded font-medium focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden">
                                Show {activation.blockers.length - 3} more
                                blockers
                            </summary>
                            <ul className="list-disc space-y-1 pl-5">
                                {activation.blockers
                                    .slice(3)
                                    .map((blocker, index) => (
                                        <li key={`${index}-${blocker}`}>
                                            {blocker}
                                        </li>
                                    ))}
                            </ul>
                        </details>
                    )}
                </div>
            )}
        </section>
    );
}
