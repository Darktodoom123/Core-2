import { ClipboardList, Info } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import {
    DIRECT_DISPATCH_PROVENANCE,
    getEquipmentSubtypeLabel,
    getWorkStreamLabel,
} from './intake-data';
import type {
    DirectDispatchFormData,
    DirectDispatchSummaryProjection,
} from './types';

const PRIORITY_LABELS: Record<DirectDispatchFormData['priority'], string> = {
    routine: 'Routine',
    priority: 'Priority',
    emergency: 'Emergency',
};

const REQUIRED_FIELDS: Array<{
    key: keyof Pick<
        DirectDispatchFormData,
        'client' | 'title' | 'site' | 'scheduled_start' | 'scheduled_end'
    >;
    label: string;
}> = [
    { key: 'client', label: 'Client' },
    { key: 'title', label: 'Dispatch title' },
    { key: 'site', label: 'Job site' },
    { key: 'scheduled_start', label: 'Scheduled start' },
    { key: 'scheduled_end', label: 'Scheduled end' },
];

function formatScheduleValue(value: string): string {
    if (!value) {
        return 'Not scheduled';
    }

    return value.replace('T', ' · ');
}

export function projectDirectDispatchSummary(
    formData: DirectDispatchFormData,
): DirectDispatchSummaryProjection {
    return {
        client: formData.client.trim() || 'Not selected',
        workStream: getWorkStreamLabel(formData.work_stream),
        equipmentSubtype: getEquipmentSubtypeLabel(formData.equipment_subtype),
        site: formData.site.trim() || 'Not provided',
        schedule:
            formData.scheduled_start || formData.scheduled_end
                ? `${formatScheduleValue(formData.scheduled_start)} → ${formatScheduleValue(formData.scheduled_end)}`
                : 'Not scheduled',
        priority: PRIORITY_LABELS[formData.priority],
        requirementCount: formData.requirements.length,
        missingRequiredFields: REQUIRED_FIELDS.filter(
            ({ key }) => !formData[key].trim(),
        ).map(({ label }) => label),
        provenance: DIRECT_DISPATCH_PROVENANCE,
        draftNotice: 'Draft only — assignment and activation happen later.',
    };
}

export function DirectDispatchSummary({
    summary,
    className,
    ...props
}: {
    summary: DirectDispatchSummaryProjection;
    className?: string;
} & Omit<HTMLAttributes<HTMLElement>, 'className'>) {
    return (
        <aside
            aria-label="Direct dispatch summary"
            className={cn(
                'min-w-0 rounded-xl border border-line bg-surface p-4 shadow-xs lg:sticky lg:top-4 lg:self-start',
                className,
            )}
            {...props}
        >
            <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                    <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-ink">
                        Draft summary
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-ink-soft">
                        Check the operational brief before creating the draft.
                    </p>
                </div>
            </div>

            <dl className="mt-4 divide-y divide-line rounded-lg border border-line bg-surface-subtle">
                <SummaryItem label="Client" value={summary.client} />
                <SummaryItem
                    label="Stream / subtype"
                    value={
                        summary.equipmentSubtype
                            ? `${summary.workStream} · ${summary.equipmentSubtype}`
                            : summary.workStream
                    }
                />
                <SummaryItem label="Site" value={summary.site} />
                <SummaryItem label="Schedule" value={summary.schedule} />
                <SummaryItem label="Priority" value={summary.priority} />
                <SummaryItem
                    label="Requirements"
                    value={`${summary.requirementCount} included`}
                />
                <SummaryItem label="Provenance" value={summary.provenance} />
            </dl>

            <div className="mt-4 rounded-lg border border-warning-strong/30 bg-warning-soft p-3 text-xs leading-5 text-warning-strong">
                <div className="flex items-start gap-2">
                    <Info
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                    />
                    <p>{summary.draftNotice}</p>
                </div>
            </div>

            <div
                className={cn(
                    'mt-3 rounded-lg border p-3 text-xs leading-5',
                    summary.missingRequiredFields.length > 0
                        ? 'border-danger/30 bg-danger-soft text-danger-strong'
                        : 'border-success-strong/30 bg-success-soft text-success-strong',
                )}
                role="status"
                aria-live="polite"
            >
                {summary.missingRequiredFields.length > 0 ? (
                    <>
                        <p className="font-semibold">Missing required fields</p>
                        <p className="mt-1">
                            {summary.missingRequiredFields.join(', ')}
                        </p>
                    </>
                ) : (
                    <p className="font-semibold">
                        Required fields are ready for review.
                    </p>
                )}
            </div>
        </aside>
    );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 px-3 py-2.5">
            <dt className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                {label}
            </dt>
            <dd className="mt-0.5 text-sm font-medium break-words text-ink">
                {value}
            </dd>
        </div>
    );
}
