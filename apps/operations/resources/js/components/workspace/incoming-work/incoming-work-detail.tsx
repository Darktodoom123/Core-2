import { router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    HardHat,
    Lock,
    Truck,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button, DataPair, DateTimePicker } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { formatDate, formatDateTime, humanize } from '@/lib/formatters';
import type {
    DispatchJobViewModel,
    RentalDispatchHandoffViewModel,
    ServiceRequestViewModel,
} from '@/types/workspace';
import {
    addHours,
    findPossibleDuplicate,
    localDateTimeToIso,
    toLocalDateTime,
} from './incoming-work-helpers';

export function ServiceOrderDetail({
    request,
    jobs,
    canConvert,
    onBack,
}: {
    request: ServiceRequestViewModel;
    jobs: DispatchJobViewModel[];
    canConvert: boolean;
    onBack: () => void;
}) {
    const start = toLocalDateTime(request.scheduled_date);
    const form = useForm({
        service_request_id: String(request.id),
        scheduled_start: start,
        scheduled_end: addHours(start, 4),
        open_schedule: true,
    });
    const duplicate = findPossibleDuplicate(request.client.company_name, jobs);
    const complete =
        form.data.scheduled_start !== '' && form.data.scheduled_end !== '';

    const submit = (event: FormEvent) => {
        event.preventDefault();
        // Send times with the browser's offset so the server stores the hour
        // the dispatcher picked, and reopen the Schedule on that local day.
        form.transform((data) => ({
            ...data,
            scheduled_start: localDateTimeToIso(data.scheduled_start),
            scheduled_end: localDateTimeToIso(data.scheduled_end),
            schedule_date: data.scheduled_start.slice(0, 10),
        }));
        form.post('/operations/dispatch-jobs', {
            preserveScroll: true,
        });
    };

    return (
        <DetailFrame
            sourceLabel="Job order"
            module="Job Order Registration"
            reference={request.reference}
            title={request.project_name}
            badges={<CanonicalStatusBadge status={request.priority} />}
            onBack={onBack}
        >
            <Core1Fields>
                <DataPair label="Client" value={request.client.company_name} />
                <DataPair
                    label="Service"
                    value={sentenceCase(humanize(request.service_type))}
                />
                <DataPair label="Site" value={request.location} />
                <DataPair
                    label="Requested date"
                    value={formatDateTime(request.scheduled_date, 'Not set')}
                />
                {request.site_notes && (
                    <DataPair label="Site notes" value={request.site_notes} />
                )}
            </Core1Fields>

            <EquipmentNeeds items={request.requirements} />

            <DuplicateCheck duplicate={duplicate} />

            {canConvert ? (
                <form
                    className="mt-5 rounded-xl border border-line bg-surface p-4"
                    onSubmit={submit}
                    noValidate
                >
                    <p className="font-semibold text-ink">Create dispatch</p>
                    <p className="mt-1 text-sm text-ink-soft">
                        Times start from the requested date and the dispatch
                        number is assigned automatically. You&apos;ll go to the
                        Schedule next to assign the crew and crane.
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <DateTimePicker
                            id={`incoming-start-${request.id}`}
                            label="Start"
                            value={form.data.scheduled_start}
                            error={form.errors.scheduled_start}
                            onChange={(value) =>
                                form.setData('scheduled_start', value)
                            }
                            required
                        />
                        <DateTimePicker
                            id={`incoming-end-${request.id}`}
                            label="End"
                            value={form.data.scheduled_end}
                            error={form.errors.scheduled_end}
                            onChange={(value) =>
                                form.setData('scheduled_end', value)
                            }
                            required
                        />
                    </div>
                    {form.errors.service_request_id && (
                        <p className="mt-3 text-sm text-danger" role="alert">
                            {form.errors.service_request_id}
                        </p>
                    )}
                    <div className="mt-4 flex justify-end">
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={!complete || form.processing}
                        >
                            {form.processing
                                ? 'Creating dispatch…'
                                : 'Create dispatch'}
                        </Button>
                    </div>
                </form>
            ) : (
                <NoPermission />
            )}
        </DetailFrame>
    );
}

export function RentalOrderDetail({
    handoff,
    jobs,
    canConvert,
    onBack,
}: {
    handoff: RentalDispatchHandoffViewModel;
    jobs: DispatchJobViewModel[];
    canConvert: boolean;
    onBack: () => void;
}) {
    const [processing, setProcessing] = useState(false);
    const duplicate = findPossibleDuplicate(handoff.client.company_name, jobs);
    const needs = (handoff.rental_items ?? []).flatMap((item) => [
        item.quantity > 1 ? `${item.quantity} × ${item.name}` : item.name,
        ...(item.operator ? ['Operator'] : []),
    ]);

    const convert = () => {
        setProcessing(true);
        router.post(
            `/operations/rental-reservations/${handoff.id}/dispatch`,
            {
                open_schedule: true,
                schedule_date: handoff.start_date?.slice(0, 10) ?? null,
            },
            {
                preserveScroll: true,
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <DetailFrame
            sourceLabel="Rental"
            module="Rental Management"
            reference={handoff.reference}
            title={`Deliver rental equipment to ${handoff.client.company_name}`}
            onBack={onBack}
        >
            <Core1Fields>
                <DataPair label="Client" value={handoff.client.company_name} />
                <DataPair
                    label="Rental period"
                    value={`${formatDate(handoff.start_date, 'Not set')} to ${formatDate(handoff.end_date, 'Not set')}`}
                />
                <DataPair
                    label="Deliver to"
                    value={handoff.location || 'Address not provided yet'}
                />
            </Core1Fields>

            <EquipmentNeeds items={needs} />

            <DuplicateCheck duplicate={duplicate} />

            {canConvert ? (
                <div className="mt-5 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="font-semibold text-ink">
                            Create delivery dispatch
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">
                            Dates, equipment and operator needs are copied from
                            the rental. You&apos;ll go to the Schedule next.
                        </p>
                    </div>
                    <Button
                        variant="primary"
                        onClick={convert}
                        disabled={processing}
                    >
                        {processing ? 'Creating dispatch…' : 'Create dispatch'}
                    </Button>
                </div>
            ) : (
                <NoPermission />
            )}
        </DetailFrame>
    );
}

/** The client's needs, limited to our equipment and the operator it needs. */
function EquipmentNeeds({ items }: { items: string[] }) {
    return (
        <section className="mt-4" aria-labelledby="incoming-needs-title">
            <p
                id="incoming-needs-title"
                className="text-sm font-semibold text-ink"
            >
                Equipment and operator
            </p>
            {items.length > 0 ? (
                <ul className="mt-2 space-y-2">
                    {items.map((item) => {
                        const isOperator = /operator/i.test(item);
                        const Icon = isOperator ? HardHat : Truck;

                        return (
                            <li
                                key={item}
                                className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                            >
                                <Icon
                                    className="h-4 w-4 shrink-0 text-ink-soft"
                                    aria-hidden="true"
                                />
                                <span className="sr-only">
                                    {isOperator ? 'Operator: ' : 'Equipment: '}
                                </span>
                                {item}
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="mt-2 text-sm text-ink-soft">
                    Core 1 did not name the equipment. Confirm it with the
                    client before creating the dispatch.
                </p>
            )}
        </section>
    );
}

function sentenceCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function DetailFrame({
    sourceLabel,
    module,
    reference,
    title,
    badges,
    onBack,
    children,
}: {
    sourceLabel: string;
    module: string;
    reference: string;
    title: string;
    badges?: ReactNode;
    onBack: () => void;
    children: ReactNode;
}) {
    return (
        <article aria-labelledby="incoming-detail-title">
            <Button
                variant="quiet"
                size="sm"
                className="mb-2 -ml-2 lg:hidden"
                onClick={onBack}
            >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to list
            </Button>
            <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-ink">
                    {sourceLabel}
                </span>
                <span className="font-mono text-sm font-semibold text-ink">
                    {reference}
                </span>
                {badges}
            </div>
            <h3
                id="incoming-detail-title"
                className="mt-2 text-xl font-semibold tracking-tight text-ink"
            >
                {title}
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
                Sent from Core 1 · {module}
            </p>
            {children}
        </article>
    );
}

function Core1Fields({ children }: { children: ReactNode }) {
    return (
        <section className="mt-5 rounded-xl border border-line bg-surface-subtle p-4">
            <p className="flex items-center gap-2 text-sm text-ink-soft">
                <Lock className="h-4 w-4" aria-hidden="true" />
                From Core 1. To change these details, update the order in Core
                1.
            </p>
            <dl className="mt-2 divide-y divide-line">{children}</dl>
        </section>
    );
}

function DuplicateCheck({
    duplicate,
}: {
    duplicate: DispatchJobViewModel | null;
}) {
    if (duplicate === null) {
        return (
            <p className="mt-4 flex items-center gap-2 text-sm text-success-strong">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                No existing dispatch looks like this order.
            </p>
        );
    }

    return (
        <div
            className="mt-4 flex flex-col gap-3 rounded-lg bg-warning-soft p-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between"
            role="status"
        >
            <p className="flex items-start gap-2">
                <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong"
                    aria-hidden="true"
                />
                <span>
                    <strong>{duplicate.reference}</strong> was created by hand
                    for the same client. Check it isn&apos;t the same job before
                    you continue.
                </span>
            </p>
            <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                    router.visit(`/operations/dispatch-jobs/${duplicate.id}`)
                }
            >
                Open {duplicate.reference}
            </Button>
        </div>
    );
}

function NoPermission() {
    return (
        <p className="mt-5 rounded-lg bg-surface-subtle p-3 text-sm text-ink-soft">
            You can view this order, but your role can&apos;t create dispatches.
        </p>
    );
}
