import { Link } from '@inertiajs/react';
import { useId } from 'react';
import { humanize } from '@/lib/formatters';
import type { AssetViewModel, DispatchJobViewModel } from '@/types/workspace';

export function DispatchResourceSummary({
    job,
    assets,
    assignmentHref,
}: {
    job: DispatchJobViewModel;
    assets: AssetViewModel[];
    assignmentHref: string;
}) {
    const summaryId = useId();
    const accepted = job.personnel_assignments.filter(
        (person) => person.response_status.value === 'accepted',
    ).length;
    const terminal = ['completed', 'cancelled'].includes(job.status.value);
    const typedRequirements = job.resource_requirements;
    const typedPlanIncomplete = typedRequirements
        ? Object.values(typedRequirements.personnel).reduce(
              (sum, count) => sum + (count ?? 0),
              0,
          ) === 0 ||
          Object.values(typedRequirements.assets).reduce(
              (sum, count) => sum + (count ?? 0),
              0,
          ) === 0
        : false;
    const typedShortfalls = typedRequirements
        ? [
              ...Object.entries(typedRequirements.personnel).map(
                  ([type, required]) => ({
                      type,
                      required: required ?? 0,
                      assigned: job.personnel_assignments.filter(
                          (assignment) => assignment.type === type,
                      ).length,
                      group: 'crew',
                  }),
              ),
              ...Object.entries(typedRequirements.assets).map(
                  ([type, required]) => ({
                      type,
                      required: required ?? 0,
                      assigned: job.asset_assignments.filter(
                          (assignment) => assignment.type === type,
                      ).length,
                      group: 'equipment',
                  }),
              ),
          ].filter((item) => item.required > item.assigned)
        : [];
    const requirements = [
        ...new Set([
            ...job.requirements,
            ...(job.source?.technical_requirements ?? []),
            ...(job.source?.condition_requirements ?? []),
        ]),
    ];

    return (
        <section
            className="space-y-5 border-b border-line px-4 py-5 md:px-5"
            aria-labelledby={`${summaryId}-heading`}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3
                        id={`${summaryId}-heading`}
                        className="text-base font-semibold text-ink"
                    >
                        Crew &amp; equipment
                    </h3>
                    <p className="mt-1 text-sm text-ink-soft">
                        {job.personnel_assignments.length} personnel assigned ·{' '}
                        {accepted} accepted · {job.asset_assignments.length}{' '}
                        equipment assigned
                    </p>
                </div>
                {!terminal && (
                    <Link
                        href={assignmentHref}
                        className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand-strong"
                    >
                        Review assignments
                    </Link>
                )}
            </div>
            {!terminal && typedRequirements && (
                <div className="rounded-lg border border-line bg-surface-subtle p-4 text-sm text-ink">
                    <h4 className="font-semibold">
                        {typedPlanIncomplete
                            ? 'Required resource plan incomplete'
                            : typedShortfalls.length > 0
                              ? 'Required resources still missing'
                              : 'Required quantities covered'}
                    </h4>
                    {typedPlanIncomplete && (
                        <p className="mt-1 text-ink-soft">
                            Record at least one required crew role and one
                            equipment type before activation.
                        </p>
                    )}
                    {typedShortfalls.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            {typedShortfalls.map((item) => (
                                <li key={`${item.group}-${item.type}`}>
                                    {item.type.replace('_', ' ')} {item.group}:{' '}
                                    {item.assigned} of {item.required} assigned
                                </li>
                            ))}
                        </ul>
                    ) : !typedPlanIncomplete ? (
                        <p className="mt-1 text-ink-soft">
                            Quantity matches the recorded plan. Eligibility,
                            safety, and approval are checked before activation.
                        </p>
                    ) : null}
                </div>
            )}
            {!terminal && !typedRequirements && (
                <div className="rounded-lg bg-warning-soft p-4 text-sm text-warning-strong">
                    <h4 className="font-semibold">
                        Staffing & equipment needs unconfirmed
                    </h4>
                    <p className="mt-1">
                        {requirements.length === 0
                            ? 'Required crew and equipment quantities are not recorded. Confirm the job requirements before deciding whether more people or equipment are needed.'
                            : 'Review the requirements below against the assigned crew and equipment. Assigned counts alone do not confirm that all requirements are covered.'}
                    </p>
                    {job.personnel_assignments.length === 0 && (
                        <p className="mt-2 font-medium">
                            No personnel assigned.
                        </p>
                    )}
                    {job.asset_assignments.length === 0 && (
                        <p className="mt-2 font-medium">
                            No equipment assigned.
                        </p>
                    )}
                    {requirements.length > 0 && (
                        <ul className="mt-3 list-disc space-y-1 pl-5">
                            {requirements.map((requirement) => (
                                <li key={requirement} className="break-words">
                                    {requirement}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            <section aria-labelledby={`${summaryId}-personnel-heading`}>
                <h4
                    id={`${summaryId}-personnel-heading`}
                    className="text-sm font-semibold text-ink"
                >
                    Assigned personnel
                </h4>
                <ul className="mt-2 divide-y divide-line">
                    {job.personnel_assignments.map((person) => (
                        <li
                            key={person.id}
                            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                        >
                            <div className="min-w-0 flex-1 basis-48">
                                <p className="text-sm font-semibold break-words text-ink">
                                    {person.name}
                                </p>
                                <p className="mt-1 text-sm text-ink-soft">
                                    {humanize(person.type)}
                                </p>
                            </div>
                            <span className="text-sm text-ink-soft">
                                {person.response_status.label}
                            </span>
                        </li>
                    ))}
                </ul>
            </section>
            <section aria-labelledby={`${summaryId}-equipment-heading`}>
                <h4
                    id={`${summaryId}-equipment-heading`}
                    className="text-sm font-semibold text-ink"
                >
                    Assigned equipment
                </h4>
                {!terminal && (
                    <p className="mt-1 text-xs text-ink-soft">
                        Current operators come from active equipment shifts. A
                        shift does not confirm a person-to-equipment assignment
                        for this dispatch.
                    </p>
                )}
                <ul className="mt-2 divide-y divide-line">
                    {job.asset_assignments.map((assignment) => {
                        const asset = assets.find(
                            (candidate) =>
                                candidate.id ===
                                assignment.operational_asset_id,
                        );
                        const operator = asset?.active_operator;
                        const onCrew =
                            operator &&
                            job.personnel_assignments.some(
                                (person) => person.user_id === operator.id,
                            );

                        return (
                            <li key={assignment.id} className="space-y-2 py-3">
                                <p className="text-sm font-semibold break-words text-ink">
                                    {assignment.code} · {assignment.name}
                                </p>
                                <p className="text-sm text-ink-soft">
                                    {humanize(
                                        assignment.subtype ??
                                            assignment.kind ??
                                            assignment.type,
                                    )}
                                </p>
                                {!terminal && (
                                    <p className="text-sm break-words text-ink">
                                        <span className="text-ink-soft">
                                            Current operator:{' '}
                                        </span>
                                        {operator
                                            ? `${operator.name} · ${onCrew ? 'On this dispatch’s crew' : 'Not on this dispatch’s crew'}`
                                            : 'Not confirmed'}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </section>
        </section>
    );
}
