import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type {
    DispatchJobViewModel,
    DispatchResourceRequirements,
} from '@/types/workspace';
import {
    emptyResourceRequirements,
    ResourceRequirementFields,
    resourceRequirementTotals,
} from './requirement-fields';

export function ResourceRequirementEditor({
    job,
    canEdit,
}: {
    job: DispatchJobViewModel;
    canEdit: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const form = useForm<{
        version: number;
        resource_requirements: DispatchResourceRequirements;
    }>({
        version: job.version,
        resource_requirements:
            job.resource_requirements ?? emptyResourceRequirements(),
    });
    const recorded = job.resource_requirements;
    const totals = recorded ? resourceRequirementTotals(recorded) : null;

    const save = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.patch(
            `/operations/dispatch-jobs/${job.id}/resource-requirements`,
            {
                preserveScroll: true,
                onSuccess: () => setEditing(false),
            },
        );
    };

    return (
        <section
            className="rounded-xl border border-line bg-surface p-4"
            aria-labelledby="dispatch-resource-requirements-heading"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3
                        id="dispatch-resource-requirements-heading"
                        className="text-base font-semibold text-ink"
                    >
                        Required crew and equipment
                    </h3>
                    <p className="mt-1 text-sm text-ink-soft">
                        Activation compares these minimum quantities with active
                        assignments.
                    </p>
                </div>
                {canEdit && !editing && (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand-strong"
                    >
                        {recorded ? 'Edit requirements' : 'Record requirements'}
                    </button>
                )}
            </div>
            {recorded ? (
                <p className="mt-3 text-sm text-ink">
                    Minimum plan: {totals?.personnel ?? 0} crew ·{' '}
                    {totals?.assets ?? 0} equipment
                </p>
            ) : (
                <p className="mt-3 text-sm text-warning-strong">
                    Typed requirements have not been recorded for this direct
                    dispatch.
                </p>
            )}
            {recorded && (
                <ul className="mt-2 list-disc pl-5 text-sm text-ink-soft">
                    {Object.entries(recorded.personnel)
                        .filter(([, count]) => count > 0)
                        .map(([type, count]) => (
                            <li key={`personnel-${type}`}>
                                {count} {type.replace('_', ' ')} crew
                            </li>
                        ))}
                    {Object.entries(recorded.assets)
                        .filter(([, count]) => count > 0)
                        .map(([type, count]) => (
                            <li key={`asset-${type}`}>
                                {count} {type.replace('_', ' ')} equipment
                            </li>
                        ))}
                </ul>
            )}
            {editing && (
                <form
                    onSubmit={save}
                    className="mt-4 space-y-4 border-t border-line pt-4"
                >
                    <ResourceRequirementFields
                        idPrefix="dispatch-detail"
                        value={form.data.resource_requirements}
                        onChange={(value) =>
                            form.setData('resource_requirements', value)
                        }
                    />
                    {Object.keys(form.errors).length > 0 && (
                        <p role="alert" className="text-sm text-danger-strong">
                            {Object.values(form.errors).join(' ')}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-contrast disabled:opacity-50"
                        >
                            {form.processing ? 'Saving…' : 'Save requirements'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                form.reset();
                                form.clearErrors();
                                setEditing(false);
                            }}
                            className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </section>
    );
}
