import { useForm, router } from '@inertiajs/react';
import {
    CalendarDays,
    CheckCircle2,
    Package,
    Plus,
    Truck,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';
import {
    Button,
    DataPair,
    DateTimePicker,
    EmptyState,
    Panel,
} from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { DirectDispatchView } from '@/components/workspace/direct-dispatch/direct-dispatch-view';
import { formatCurrency, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    ClientViewModel,
    DispatchJobViewModel,
    RentalDispatchHandoffViewModel,
    SalesDispatchHandoffViewModel,
    ServiceRequestViewModel,
    UnlinkedHandoffItem,
    WorkspaceCapabilities,
} from '@/types/workspace';

export type IntakeMode =
    | 'manual'
    | 'service'
    | 'rental'
    | 'sale'
    | 'reconciliation'
    | 'client'
    | null;

type IncomingWorkItem = {
    key: string;
    mode: 'service' | 'rental' | 'sale';
    sourceLabel: string;
    reference: string;
    client: string;
    detail: string;
    status: string;
};

export function LiveDispatchIntake({
    clients,
    serviceRequests,
    rentalHandoffs = [],
    salesHandoffs = [],
    jobs = [],
    capabilities,
    initialRequestId,
    initialMode = null,
    onClose,
    onDirtyChange,
}: {
    clients: ClientViewModel[];
    serviceRequests: ServiceRequestViewModel[];
    rentalHandoffs?: RentalDispatchHandoffViewModel[];
    salesHandoffs?: SalesDispatchHandoffViewModel[];
    jobs?: DispatchJobViewModel[];
    capabilities: WorkspaceCapabilities;
    initialRequestId?: number | null;
    initialMode?: IntakeMode;
    onClose?: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
}) {
    const canCreateManual = capabilities.create_dispatch;
    const canReviewService = capabilities.convert_service_request;
    const canReviewRental = capabilities.create_rental_dispatch;
    const canReviewSale = capabilities.create_sales_dispatch;
    const canReconcile = canReviewService || canReviewRental || canReviewSale;

    const incomingItems = useMemo<IncomingWorkItem[]>(() => {
        const services = canReviewService
            ? serviceRequests
                  .filter((request) => request.dispatch_jobs_count === 0)
                  .map((request) => ({
                      key: `service-${request.id}`,
                      mode: 'service' as const,
                      sourceLabel: 'Service request',
                      reference: request.reference,
                      client: request.client.company_name,
                      detail:
                          request.project_name ||
                          request.service_type ||
                          request.location ||
                          'Service demand awaiting dispatch',
                      status: request.status.label,
                  }))
            : [];
        const rentals = canReviewRental
            ? rentalHandoffs
                  .filter((handoff) => !handoff.dispatch_job_id)
                  .map((handoff) => ({
                      key: `rental-${handoff.id}`,
                      mode: 'rental' as const,
                      sourceLabel: 'Rental delivery',
                      reference: handoff.reference,
                      client: handoff.client.company_name,
                      detail:
                          handoff.location || 'Delivery location needs review',
                      status: handoff.status.label,
                  }))
            : [];
        const sales = canReviewSale
            ? salesHandoffs
                  .filter((handoff) => !handoff.dispatch_job_id)
                  .map((handoff) => ({
                      key: `sale-${handoff.id}`,
                      mode: 'sale' as const,
                      sourceLabel: 'Sales delivery',
                      reference: handoff.reference,
                      client: handoff.client.company_name,
                      detail:
                          handoff.location || 'Delivery location needs review',
                      status: handoff.status.label,
                  }))
            : [];

        return [...services, ...rentals, ...sales];
    }, [
        canReviewRental,
        canReviewSale,
        canReviewService,
        rentalHandoffs,
        salesHandoffs,
        serviceRequests,
    ]);

    const [mode, setMode] = useState<IntakeMode>(() => {
        if (initialRequestId) {
            return 'service';
        }

        if (initialMode) {
            return initialMode;
        }

        return incomingItems.length > 0 ? null : 'manual';
    });
    const [selectedItemKey, setSelectedItemKey] = useState<string | null>(
        initialRequestId ? `service-${initialRequestId}` : null,
    );
    const [showClientIntake, setShowClientIntake] = useState(false);
    const unlinkedCount = incomingItems.length;

    const closeWorkflow = () => {
        setMode(null);
        setSelectedItemKey(null);
        setShowClientIntake(false);
    };

    if (mode === 'manual') {
        return (
            <section
                className="direct-dispatch-view border-b border-line bg-surface px-4 py-5 md:px-6"
                aria-labelledby="direct-dispatch-title"
            >
                <div className="workspace-width-contained mx-auto max-w-7xl">
                    {incomingItems.length > 0 && (
                        <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
                            <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-subtle p-1">
                                <button
                                    type="button"
                                    className="flex items-center gap-1.5 rounded-md bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-xs"
                                >
                                    <Truck className="h-3.5 w-3.5 text-brand" />
                                    Direct Dispatch
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (onDirtyChange) {
                                            onDirtyChange(false);
                                        }

                                        setMode(null);
                                    }}
                                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface hover:text-ink"
                                >
                                    <Package className="h-3.5 w-3.5" />
                                    Incoming Orders ({incomingItems.length})
                                </button>
                            </div>
                        </div>
                    )}

                    <DirectDispatchView
                        clients={clients}
                        capabilities={capabilities}
                        onBack={() => {
                            setShowClientIntake(false);
                            onDirtyChange?.(false);

                            if (incomingItems.length > 0) {
                                setMode(null);
                            } else {
                                onClose?.();
                            }
                        }}
                        onClose={() => {
                            setShowClientIntake(false);
                            onDirtyChange?.(false);
                            onClose?.();
                        }}
                        onAddClient={() => setShowClientIntake(true)}
                        onDirtyChange={onDirtyChange}
                        onExitFocus={(reason) => {
                            window.requestAnimationFrame(() => {
                                document
                                    .getElementById(
                                        reason === 'back' &&
                                            incomingItems.length > 0
                                            ? 'create-direct-dispatch-trigger'
                                            : 'new-dispatch-trigger',
                                    )
                                    ?.focus();
                            });
                        }}
                    />
                    {showClientIntake && (
                        <ClientIntakeForm
                            onClose={() => setShowClientIntake(false)}
                        />
                    )}
                </div>
            </section>
        );
    }

    return (
        <section
            className="border-b border-line bg-surface px-4 py-5 md:px-6"
            aria-labelledby="dispatch-intake-title"
        >
            <div className="workspace-width-contained mx-auto max-w-7xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2
                            id="dispatch-intake-title"
                            className="text-lg font-semibold tracking-tight text-ink"
                        >
                            New dispatch
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                            Review incoming customer orders ready for
                            operational staging, or create an ad-hoc direct
                            dispatch.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {capabilities.create_client && (
                            <Button
                                size="md"
                                variant={
                                    mode === 'client' ? 'primary' : 'secondary'
                                }
                                onClick={() => {
                                    setSelectedItemKey(null);
                                    setMode((cur) =>
                                        cur === 'client' ? null : 'client',
                                    );
                                }}
                                aria-expanded={mode === 'client'}
                                aria-controls="client-intake-form"
                            >
                                Add client
                            </Button>
                        )}
                        {onClose && (
                            <Button
                                size="md"
                                variant="quiet"
                                onClick={onClose}
                                aria-label="Close intake"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        )}
                    </div>
                </div>

                {showClientIntake && (
                    <div className="mt-4">
                        <ClientIntakeForm
                            onClose={() => setShowClientIntake(false)}
                        />
                    </div>
                )}

                <div
                    className="mt-5 rounded-xl border border-line bg-surface-subtle p-4"
                    aria-live="polite"
                >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                Incoming customer orders
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-ink">
                                Incoming work queue
                            </h3>
                            <p className="mt-1 max-w-2xl text-sm text-ink-soft">
                                Select an incoming handoff to verify site
                                details, assign equipment, and dispatch.
                            </p>
                        </div>
                        <span className="inline-flex w-fit items-center rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-strong">
                            {incomingItems.length > 0
                                ? `${incomingItems.length} needs review`
                                : 'No handoffs waiting'}
                        </span>
                    </div>

                    <div
                        className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface"
                        role="list"
                        aria-label="Incoming work queue"
                    >
                        {incomingItems.length > 0 ? (
                            incomingItems.map((item) => (
                                <IncomingWorkRow
                                    key={item.key}
                                    item={item}
                                    selected={selectedItemKey === item.key}
                                    onClick={() => {
                                        setSelectedItemKey(item.key);
                                        setMode(item.mode);
                                    }}
                                />
                            ))
                        ) : (
                            <div className="p-6 text-center">
                                <Package className="mx-auto h-8 w-8 text-ink-soft" />
                                <h4 className="mt-2 text-sm font-semibold text-ink">
                                    No incoming customer orders waiting
                                </h4>
                                <p className="mt-1 text-xs text-ink-soft">
                                    Use Direct operational fallback for work
                                    that has not arrived from upstream.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                            Direct operational fallback
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">
                            For work without a Core 1 request or commercial
                            handoff.
                        </p>
                    </div>
                    {canCreateManual && (
                        <Button
                            id="create-direct-dispatch-trigger"
                            variant={
                                incomingItems.length > 0
                                    ? 'secondary'
                                    : 'primary'
                            }
                            onClick={() => {
                                setSelectedItemKey(null);
                                setMode('manual');
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Create direct dispatch
                        </Button>
                    )}
                </div>

                {canReconcile && (
                    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                Dispatch review
                            </p>
                            <p className="mt-1 text-sm text-ink-soft">
                                Review unmatched records before they can create
                                a duplicate execution.
                            </p>
                        </div>
                        <button
                            type="button"
                            aria-pressed={mode === 'reconciliation'}
                            onClick={() => {
                                setSelectedItemKey(null);
                                setMode('reconciliation');
                            }}
                            className={cn(
                                'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-left text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none',
                                mode === 'reconciliation'
                                    ? 'border-info-strong bg-info-soft text-info-strong shadow-xs'
                                    : 'border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                            )}
                        >
                            <span>Review unmatched handoffs</span>
                            <span className="rounded-full bg-info px-2 py-0.5 text-[10px] font-bold text-white">
                                {unlinkedCount} to review
                            </span>
                        </button>
                    </div>
                )}

                {mode === 'client' && (
                    <ClientIntakeForm onClose={closeWorkflow} />
                )}

                {mode === 'service' && (
                    <ServiceIntakeSection
                        clients={clients}
                        serviceRequests={serviceRequests}
                        capabilities={capabilities}
                        initialRequestId={initialRequestId}
                        onClose={closeWorkflow}
                    />
                )}

                {mode === 'rental' && (
                    <RentalIntakeSection
                        rentalHandoffs={rentalHandoffs}
                        capabilities={capabilities}
                        onClose={closeWorkflow}
                    />
                )}

                {mode === 'sale' && (
                    <SaleIntakeSection
                        salesHandoffs={salesHandoffs}
                        capabilities={capabilities}
                        onClose={closeWorkflow}
                    />
                )}

                {mode === 'reconciliation' && (
                    <ReconciliationQueueSection
                        serviceRequests={serviceRequests}
                        rentalHandoffs={rentalHandoffs}
                        salesHandoffs={salesHandoffs}
                        jobs={jobs}
                        onClose={closeWorkflow}
                    />
                )}
            </div>
        </section>
    );
}

function IncomingWorkRow({
    item,
    selected,
    onClick,
}: {
    item: IncomingWorkItem;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <div role="listitem">
            <button
                type="button"
                aria-pressed={selected}
                aria-label={`Review ${item.sourceLabel}: ${item.reference}`}
                onClick={onClick}
                className={cn(
                    'flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none',
                    selected
                        ? 'bg-brand-soft/60'
                        : 'bg-surface hover:bg-surface-subtle',
                )}
            >
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                        <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                            {item.sourceLabel}
                        </span>
                        <span className="font-mono text-xs font-semibold text-brand-strong">
                            {item.reference}
                        </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                        <span className="font-medium text-ink">
                            {item.client}
                        </span>{' '}
                        · {item.detail}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                    <span className="rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink-soft">
                        {item.status}
                    </span>
                    <span className="text-xs font-semibold text-brand-strong">
                        {selected ? 'Open workflow' : 'Review'}
                    </span>
                </div>
            </button>
        </div>
    );
}

function ServiceIntakeSection({
    clients,
    serviceRequests,
    capabilities,
    initialRequestId,
    onClose,
}: {
    clients: ClientViewModel[];
    serviceRequests: ServiceRequestViewModel[];
    capabilities: WorkspaceCapabilities;
    initialRequestId?: number | null;
    onClose: () => void;
}) {
    const canCreateRequest = capabilities.create_service_request;
    const canConvertRequest = capabilities.convert_service_request;
    const [subTab, setSubTab] = useState<'create' | 'convert'>(() =>
        initialRequestId && canConvertRequest
            ? 'convert'
            : canCreateRequest
              ? 'create'
              : 'convert',
    );

    return (
        <Panel className="mt-4 p-4 md:p-6">
            <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong">
                            Service Request Workflow
                        </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-ink">
                        Service demand intake &amp; conversion
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                        Record demand once as a Service Request, then create as
                        many distinct linked draft dispatches as staged or
                        multi-phase work requires.
                    </p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
                    <div className="flex max-w-full flex-wrap rounded-lg border border-line bg-surface p-1">
                        {canCreateRequest && (
                            <button
                                type="button"
                                aria-pressed={subTab === 'create'}
                                onClick={() => setSubTab('create')}
                                className={cn(
                                    'inline-flex min-h-11 items-center rounded-md px-3 py-1 text-xs font-medium transition-colors',
                                    subTab === 'create'
                                        ? 'bg-brand-soft font-semibold text-brand-strong'
                                        : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                )}
                            >
                                New service request
                            </button>
                        )}
                        {canConvertRequest && (
                            <button
                                type="button"
                                aria-pressed={subTab === 'convert'}
                                onClick={() => setSubTab('convert')}
                                className={cn(
                                    'inline-flex min-h-11 items-center rounded-md px-3 py-1 text-xs font-medium transition-colors',
                                    subTab === 'convert'
                                        ? 'bg-brand-soft font-semibold text-brand-strong'
                                        : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                )}
                            >
                                Convert to draft ({serviceRequests.length})
                            </button>
                        )}
                    </div>
                    <Button
                        size="icon"
                        variant="quiet"
                        onClick={onClose}
                        aria-label="Close service intake"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>
            </div>

            {subTab === 'create' && canCreateRequest ? (
                <ServiceRequestIntakeForm clients={clients} onClose={onClose} />
            ) : canConvertRequest ? (
                <DispatchConversion
                    serviceRequests={serviceRequests}
                    initialRequestId={initialRequestId}
                />
            ) : null}
        </Panel>
    );
}

function ServiceRequestIntakeForm({
    clients,
    onClose,
}: {
    clients: ClientViewModel[];
    onClose: () => void;
}) {
    const [requirementsText, setRequirementsText] = useState('');
    const form = useForm({
        reference: '',
        client_id: '',
        business_line: 'service',
        project_name: '',
        service_type: '',
        location: '',
        site_notes: '',
        scheduled_date: '',
        priority: 'routine',
        requirements: [] as string[],
    });

    const complete = [
        form.data.reference,
        form.data.client_id,
        form.data.project_name,
        form.data.service_type,
        form.data.location,
    ].every((value) => value.trim() !== '');

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            requirements: linesFromText(requirementsText),
        }));
        form.post('/operations/service-requests', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setRequirementsText('');
                onClose();
            },
        });
    };

    return (
        <form
            className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={submit}
            noValidate
        >
            <IntakeInput
                id="request-reference"
                label="Request reference"
                value={form.data.reference}
                error={form.errors.reference}
                onChange={(value) => form.setData('reference', value)}
                placeholder="e.g. SR-2026-0089"
                required
            />
            <SelectField
                id="request-client"
                label="Client"
                value={form.data.client_id}
                error={form.errors.client_id}
                onChange={(value) => form.setData('client_id', value)}
                required
            >
                <option value="">Select an active client</option>
                {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                        {client.code} · {client.company_name}
                    </option>
                ))}
            </SelectField>
            <IntakeInput
                id="request-project"
                label="Project name"
                value={form.data.project_name}
                error={form.errors.project_name}
                onChange={(value) => form.setData('project_name', value)}
                placeholder="e.g. Tuas Port Phase 2 Substation"
                required
            />
            <IntakeInput
                id="request-service-type"
                label="Service type"
                value={form.data.service_type}
                error={form.errors.service_type}
                onChange={(value) => form.setData('service_type', value)}
                placeholder="e.g. Heavy Crane & Transport"
                required
            />
            <IntakeInput
                id="request-location"
                label="Service site location"
                value={form.data.location}
                error={form.errors.location}
                onChange={(value) => form.setData('location', value)}
                placeholder="e.g. 10 Tuas South Ave 5"
                required
            />
            <DateTimePicker
                id="request-schedule"
                label="Requested schedule"
                value={form.data.scheduled_date}
                error={form.errors.scheduled_date}
                onChange={(value) => form.setData('scheduled_date', value)}
            />
            <SelectField
                id="request-priority"
                label="Priority"
                value={form.data.priority}
                error={form.errors.priority}
                onChange={(value) => form.setData('priority', value)}
                required
            >
                <option value="routine">Routine</option>
                <option value="priority">Priority</option>
                <option value="emergency">Emergency</option>
            </SelectField>
            <div className="hidden xl:block" aria-hidden="true" />
            <TextAreaField
                id="request-requirements"
                label="Technical requirements"
                hint="One requirement per line"
                value={requirementsText}
                error={form.errors.requirements}
                onChange={setRequirementsText}
                className="md:col-span-2"
            />
            <TextAreaField
                id="request-site-notes"
                label="Site notes"
                value={form.data.site_notes}
                error={form.errors.site_notes}
                onChange={(value) => form.setData('site_notes', value)}
                className="md:col-span-2"
            />
            <div className="flex justify-end border-t border-line pt-4 md:col-span-2 xl:col-span-4">
                <Button
                    type="submit"
                    variant="primary"
                    disabled={form.processing || !complete}
                >
                    {form.processing
                        ? 'Recording request…'
                        : 'Record service request'}
                </Button>
            </div>
        </form>
    );
}

function DispatchConversion({
    serviceRequests,
    initialRequestId,
}: {
    serviceRequests: ServiceRequestViewModel[];
    initialRequestId?: number | null;
}) {
    const form = useForm({
        service_request_id: '',
        reference: '',
        scheduled_start: '',
        scheduled_end: '',
    });
    const { setData } = form;

    const chooseRequest = (id: string) => {
        const request = serviceRequests.find(
            (candidate) => String(candidate.id) === id,
        );
        const start = toLocalDateTime(request?.scheduled_date ?? null);

        setData((prev) => ({
            ...prev,
            service_request_id: id,
            scheduled_start: start,
            scheduled_end: addHours(start, 4),
        }));
    };

    useEffect(() => {
        if (
            initialRequestId &&
            serviceRequests.some((r) => r.id === initialRequestId)
        ) {
            const request = serviceRequests.find(
                (candidate) => candidate.id === initialRequestId,
            );

            if (request) {
                const start = toLocalDateTime(request.scheduled_date ?? null);
                setData((prev) => ({
                    ...prev,
                    service_request_id: String(initialRequestId),
                    scheduled_start: start,
                    scheduled_end: addHours(start, 4),
                }));
            }
        }
    }, [initialRequestId, serviceRequests, setData]);

    const selectedRequest =
        serviceRequests.find(
            (r) => String(r.id) === form.data.service_request_id,
        ) ?? null;

    const complete = [
        form.data.service_request_id,
        form.data.reference,
        form.data.scheduled_start,
        form.data.scheduled_end,
    ].every((value) => value.trim() !== '');

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/operations/dispatch-jobs', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset('reference');
            },
        });
    };

    return (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
            <div className="rounded-lg border border-line bg-surface p-4">
                <div>
                    <h4 className="font-semibold text-ink">
                        Convert request to linked draft
                    </h4>
                    <p className="mt-1 text-sm text-ink-soft">
                        Request details are copied as a durable snapshot into
                        the draft dispatch. Multiple dispatches can link to the
                        same request for staged execution.
                    </p>
                </div>

                {selectedRequest ? (
                    <div className="mt-4 rounded-lg border border-line bg-surface-subtle p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-bold text-ink">
                                {selectedRequest.project_name}
                            </span>
                            <div className="flex gap-1.5">
                                <CanonicalStatusBadge
                                    status={selectedRequest.priority}
                                />
                                <CanonicalStatusBadge
                                    status={selectedRequest.status}
                                />
                            </div>
                        </div>
                        <dl className="mt-3 divide-y divide-line text-xs">
                            <DataPair
                                label="Client"
                                value={selectedRequest.client.company_name}
                            />
                            <DataPair
                                label="Service type"
                                value={selectedRequest.service_type}
                            />
                            <DataPair
                                label="Site location"
                                value={selectedRequest.location}
                            />
                            <DataPair
                                label="Existing drafts"
                                value={String(
                                    selectedRequest.dispatch_jobs_count,
                                )}
                            />
                        </dl>
                        {selectedRequest.requirements.length > 0 && (
                            <div className="mt-3 border-t border-line pt-2">
                                <p className="text-[11px] font-semibold text-ink-soft uppercase">
                                    Requirements snapshot:
                                </p>
                                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-soft">
                                    {selectedRequest.requirements.map(
                                        (r, i) => (
                                            <li key={i}>{r}</li>
                                        ),
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="mt-4 rounded-lg bg-surface-subtle p-3 text-xs text-ink-soft">
                        Select a submitted or dispatching service request on the
                        right to review context before drafting.
                    </p>
                )}
            </div>

            {serviceRequests.length === 0 ? (
                <EmptyState
                    compact
                    icon={CalendarDays}
                    title="No service requests ready"
                    message="Record a service request first before creating a linked draft."
                />
            ) : (
                <form
                    className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2"
                    onSubmit={submit}
                    noValidate
                >
                    <SelectField
                        id="conversion-request"
                        label="Service request"
                        value={form.data.service_request_id}
                        error={form.errors.service_request_id}
                        onChange={chooseRequest}
                        className="sm:col-span-2"
                        required
                    >
                        <option value="">Select a service request</option>
                        {serviceRequests.map((request) => (
                            <option key={request.id} value={request.id}>
                                {request.reference} ·{' '}
                                {request.client.company_name} ·{' '}
                                {request.project_name}
                            </option>
                        ))}
                    </SelectField>
                    <IntakeInput
                        id="conversion-reference"
                        label="Dispatch reference"
                        value={form.data.reference}
                        error={form.errors.reference}
                        onChange={(value) => form.setData('reference', value)}
                        placeholder="e.g. DSP-SR-2026-001"
                        required
                    />
                    <div className="hidden sm:block" aria-hidden="true" />
                    <DateTimePicker
                        id="conversion-start"
                        label="Dispatch start"
                        value={form.data.scheduled_start}
                        error={form.errors.scheduled_start}
                        onChange={(value) =>
                            form.setData('scheduled_start', value)
                        }
                        required
                    />
                    <DateTimePicker
                        id="conversion-end"
                        label="Dispatch end"
                        value={form.data.scheduled_end}
                        error={form.errors.scheduled_end}
                        onChange={(value) =>
                            form.setData('scheduled_end', value)
                        }
                        required
                    />
                    <div className="flex justify-end border-t border-line pt-4 sm:col-span-2">
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={!complete || form.processing}
                        >
                            {form.processing
                                ? 'Creating linked draft…'
                                : 'Create linked dispatch draft'}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}

function RentalIntakeSection({
    rentalHandoffs,
    capabilities,
    onClose,
}: {
    rentalHandoffs: RentalDispatchHandoffViewModel[];
    capabilities: WorkspaceCapabilities;
    onClose: () => void;
}) {
    const [pendingHandoffId, setPendingHandoffId] = useState<number | null>(
        null,
    );

    const convertRental = (reservationId: number) => {
        setPendingHandoffId(reservationId);
        router.post(
            `/operations/rental-reservations/${reservationId}/dispatch`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setPendingHandoffId(null),
            },
        );
    };

    return (
        <Panel className="mt-4 p-4 md:p-6">
            <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-strong">
                            Rental Reservation Workflow
                        </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-ink">
                        Rental delivery dispatches awaiting handoff
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                        Reserved rental items requiring delivery fulfillment.
                        Converting creates a linked operational dispatch
                        containing the reservation dates, equipment condition
                        requirements, and operator context.
                    </p>
                </div>
                <Button
                    size="icon"
                    variant="quiet"
                    onClick={onClose}
                    aria-label="Close rental intake"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            {rentalHandoffs.length === 0 ? (
                <EmptyState
                    compact
                    icon={CalendarDays}
                    title="No reserved rental handoffs pending"
                    message="All current rental reservations with delivery fulfillment are already dispatched or fulfilled."
                />
            ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {rentalHandoffs.map((handoff) => {
                        const isPending = pendingHandoffId === handoff.id;

                        return (
                            <div
                                key={handoff.id}
                                className="rounded-lg border border-line bg-surface p-4 transition-all hover:border-warning-strong/50"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-ink">
                                                {handoff.reference}
                                            </span>
                                            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning-strong">
                                                Rental Delivery
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            {handoff.client.company_name}
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink-soft">
                                        {handoff.status.label}
                                    </span>
                                </div>

                                <dl className="mt-3 divide-y divide-line text-xs">
                                    <DataPair
                                        label="Reservation window"
                                        value={`${handoff.start_date || 'TBD'} → ${handoff.end_date || 'TBD'}`}
                                    />
                                    <DataPair
                                        label="Delivery location"
                                        value={
                                            handoff.location ||
                                            'Site address pending'
                                        }
                                    />
                                    <DataPair
                                        label="Fulfillment mode"
                                        value={humanize(
                                            handoff.fulfillment_mode,
                                        )}
                                    />
                                </dl>

                                <div className="mt-3 rounded-lg border border-line bg-surface-subtle p-2.5 text-xs">
                                    <p className="text-[10px] font-semibold text-ink-soft uppercase">
                                        Rental Condition Checklist:
                                    </p>
                                    <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-soft">
                                        <li>
                                            Pre-operation inspection &amp; safe
                                            release certified
                                        </li>
                                        <li>
                                            Operator assignment context:
                                            Dedicated crane operator required
                                        </li>
                                    </ul>
                                </div>

                                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                                    <span className="text-xs text-ink-soft">
                                        {handoff.ready
                                            ? 'Ready for dispatch'
                                            : 'Reservation confirmed'}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() =>
                                            convertRental(handoff.id)
                                        }
                                        disabled={
                                            isPending ||
                                            !capabilities.create_rental_dispatch
                                        }
                                    >
                                        {isPending
                                            ? 'Converting…'
                                            : 'Create rental dispatch'}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Panel>
    );
}

function SaleIntakeSection({
    salesHandoffs,
    capabilities,
    onClose,
}: {
    salesHandoffs: SalesDispatchHandoffViewModel[];
    capabilities: WorkspaceCapabilities;
    onClose: () => void;
}) {
    const [pendingHandoffId, setPendingHandoffId] = useState<number | null>(
        null,
    );
    const [scheduledStart, setScheduledStart] = useState(() =>
        localDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)),
    );
    const [scheduledEnd, setScheduledEnd] = useState(() =>
        localDateTimeInput(new Date(Date.now() + 3 * 60 * 60 * 1000)),
    );

    const convertSale = (orderId: number) => {
        setPendingHandoffId(orderId);
        router.post(
            `/operations/sales/orders/${orderId}/dispatch`,
            {
                scheduled_start: scheduledStart,
                scheduled_end: scheduledEnd,
            },
            {
                preserveScroll: true,
                onFinish: () => setPendingHandoffId(null),
            },
        );
    };

    return (
        <Panel className="mt-4 p-4 md:p-6">
            <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-strong">
                            Sales Order Delivery Workflow
                        </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-ink">
                        Sales order deliveries awaiting dispatch
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                        Confirmed sales orders requiring transport and equipment
                        handover. Converting creates a linked operational
                        dispatch with catalog items, delivery window, and
                        destination coordinates.
                    </p>
                </div>
                <Button
                    size="icon"
                    variant="quiet"
                    onClick={onClose}
                    aria-label="Close sales intake"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            <div className="mt-4 rounded-lg border border-line bg-surface-subtle p-3">
                <p className="text-xs font-semibold text-ink">
                    Global delivery schedule for incoming conversions:
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <DateTimePicker
                        id="sales-global-start"
                        label="Delivery start"
                        value={scheduledStart}
                        onChange={setScheduledStart}
                    />
                    <DateTimePicker
                        id="sales-global-end"
                        label="Delivery end"
                        value={scheduledEnd}
                        onChange={setScheduledEnd}
                    />
                </div>
            </div>

            {salesHandoffs.length === 0 ? (
                <EmptyState
                    compact
                    icon={Package}
                    title="No sales deliveries pending"
                    message="All confirmed sales orders with delivery fulfillment are already dispatched or fulfilled."
                />
            ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {salesHandoffs.map((handoff) => {
                        const isPending = pendingHandoffId === handoff.id;

                        return (
                            <div
                                key={handoff.id}
                                className="rounded-lg border border-line bg-surface p-4 transition-all hover:border-success-strong/50"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-ink">
                                                {handoff.reference}
                                            </span>
                                            <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success-strong">
                                                Sales Delivery
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            {handoff.client.company_name}
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink-soft">
                                        {handoff.status.label}
                                    </span>
                                </div>

                                <dl className="mt-3 divide-y divide-line text-xs">
                                    <DataPair
                                        label="Order value"
                                        value={formatCurrency(
                                            handoff.total_cents / 100,
                                        )}
                                    />
                                    <DataPair
                                        label="Delivery destination"
                                        value={
                                            handoff.location ||
                                            'Warehouse handover location'
                                        }
                                    />
                                    <DataPair
                                        label="Fulfillment mode"
                                        value={humanize(
                                            handoff.fulfillment_mode,
                                        )}
                                    />
                                </dl>

                                <div className="mt-3 rounded-lg border border-line bg-surface-subtle p-2.5 text-xs">
                                    <p className="text-[10px] font-semibold text-ink-soft uppercase">
                                        Catalog &amp; Delivery Details:
                                    </p>
                                    <div className="mt-1 flex items-center justify-between text-ink-soft">
                                        <span>
                                            Order fulfillment handover checklist
                                        </span>
                                        <span className="font-mono text-ink">
                                            Delivery Coordinates verified
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                                    <span className="text-xs text-ink-soft">
                                        {handoff.ready
                                            ? 'Ready for transport'
                                            : 'Order confirmed'}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => convertSale(handoff.id)}
                                        disabled={
                                            isPending ||
                                            !capabilities.create_sales_dispatch
                                        }
                                    >
                                        {isPending
                                            ? 'Converting…'
                                            : 'Create delivery dispatch'}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Panel>
    );
}

function ReconciliationQueueSection({
    serviceRequests,
    rentalHandoffs,
    salesHandoffs,
    jobs,
    onClose,
}: {
    serviceRequests: ServiceRequestViewModel[];
    rentalHandoffs: RentalDispatchHandoffViewModel[];
    salesHandoffs: SalesDispatchHandoffViewModel[];
    jobs: DispatchJobViewModel[];
    onClose: () => void;
}) {
    const unlinkedItems: UnlinkedHandoffItem[] = useMemo(() => {
        const list: UnlinkedHandoffItem[] = [];

        for (const sr of serviceRequests) {
            if (sr.dispatch_jobs_count === 0) {
                const matchedJob = jobs.find(
                    (j) =>
                        (j.source === null ||
                            j.source.type === 'manual' ||
                            j.source.type === 'direct') &&
                        (j.client
                            .toLowerCase()
                            .includes(sr.client.company_name.toLowerCase()) ||
                            sr.client.company_name
                                .toLowerCase()
                                .includes(j.client.toLowerCase())),
                );

                list.push({
                    id: sr.id,
                    source_type: 'service',
                    source_label: 'Service Request',
                    reference: sr.reference,
                    client: sr.client,
                    title: sr.project_name,
                    location: sr.location,
                    scheduled_date: sr.scheduled_date,
                    requirements: sr.requirements,
                    dispatch_job_id: null,
                    matched_draft_job_id: matchedJob?.id ?? null,
                    matched_draft_reference: matchedJob?.reference ?? null,
                    match_reason: matchedJob
                        ? `Client name matches existing manual draft ${matchedJob.reference}`
                        : null,
                    reconciliation_status: matchedJob
                        ? 'matching_draft_found'
                        : 'unlinked',
                });
            }
        }

        for (const rr of rentalHandoffs) {
            if (!rr.dispatch_job_id) {
                const matchedJob = jobs.find(
                    (j) =>
                        (j.source === null ||
                            j.source.type === 'manual' ||
                            j.source.type === 'direct') &&
                        (j.client
                            .toLowerCase()
                            .includes(rr.client.company_name.toLowerCase()) ||
                            rr.client.company_name
                                .toLowerCase()
                                .includes(j.client.toLowerCase())),
                );

                list.push({
                    id: rr.id,
                    source_type: 'rental',
                    source_label: 'Rental Reservation',
                    reference: rr.reference,
                    client: rr.client,
                    title: `Rental Delivery for ${rr.client.company_name}`,
                    location: rr.location,
                    start_date: rr.start_date,
                    end_date: rr.end_date,
                    fulfillment_mode: rr.fulfillment_mode,
                    dispatch_job_id: null,
                    matched_draft_job_id: matchedJob?.id ?? null,
                    matched_draft_reference: matchedJob?.reference ?? null,
                    match_reason: matchedJob
                        ? `Client matches manual draft ${matchedJob.reference}`
                        : null,
                    reconciliation_status: matchedJob
                        ? 'matching_draft_found'
                        : 'unlinked',
                });
            }
        }

        for (const so of salesHandoffs) {
            if (!so.dispatch_job_id) {
                const matchedJob = jobs.find(
                    (j) =>
                        (j.source === null ||
                            j.source.type === 'manual' ||
                            j.source.type === 'direct') &&
                        (j.client
                            .toLowerCase()
                            .includes(so.client.company_name.toLowerCase()) ||
                            so.client.company_name
                                .toLowerCase()
                                .includes(j.client.toLowerCase())),
                );

                list.push({
                    id: so.id,
                    source_type: 'sale',
                    source_label: 'Sales Delivery',
                    reference: so.reference,
                    client: so.client,
                    title: `Order Delivery (${formatCurrency(so.total_cents / 100)})`,
                    location: so.location,
                    total_cents: so.total_cents,
                    fulfillment_mode: so.fulfillment_mode,
                    dispatch_job_id: null,
                    matched_draft_job_id: matchedJob?.id ?? null,
                    matched_draft_reference: matchedJob?.reference ?? null,
                    match_reason: matchedJob
                        ? `Client matches manual draft ${matchedJob.reference}`
                        : null,
                    reconciliation_status: matchedJob
                        ? 'matching_draft_found'
                        : 'unlinked',
                });
            }
        }

        return list;
    }, [serviceRequests, rentalHandoffs, salesHandoffs, jobs]);

    return (
        <Panel className="mt-4 p-4 md:p-6">
            <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-info-strong">
                            Core 1 &harr; Core 2 Reconciliation
                        </span>
                        <span className="rounded bg-black/5 px-2 py-0.5 text-xs font-semibold text-ink">
                            {unlinkedItems.length} unlinked handoff
                            {unlinkedItems.length === 1 ? '' : 's'}
                        </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-ink">
                        Commercial handoff reconciliation queue
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                        Reconcile incoming Core 1 commercial transactions
                        against existing Core 2 operational drafts. Linking or
                        converting ensures zero duplicate dispatches and
                        maintains auditable lineage.
                    </p>
                </div>
                <Button
                    size="icon"
                    variant="quiet"
                    onClick={onClose}
                    aria-label="Close reconciliation queue"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            {unlinkedItems.length === 0 ? (
                <EmptyState
                    compact
                    icon={CheckCircle2}
                    title="All handoffs reconciled"
                    message="There are no unlinked Core 1 commercial transactions pending dispatch conversion or draft matching."
                />
            ) : (
                <div className="mt-4 space-y-3">
                    {unlinkedItems.map((item) => (
                        <div
                            key={`${item.source_type}-${item.id}`}
                            className={cn(
                                'rounded-lg border p-4 transition-all',
                                item.matched_draft_job_id
                                    ? 'border-info-strong/40 bg-info-soft/30'
                                    : 'border-line bg-surface',
                            )}
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={cn(
                                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                                item.source_type ===
                                                    'service' &&
                                                    'bg-brand-soft text-brand-strong',
                                                item.source_type === 'rental' &&
                                                    'bg-warning-soft text-warning-strong',
                                                item.source_type === 'sale' &&
                                                    'bg-success-soft text-success-strong',
                                            )}
                                        >
                                            {item.source_label}
                                        </span>
                                        <span className="text-sm font-bold text-ink">
                                            {item.reference}
                                        </span>
                                        <span className="text-xs text-ink-soft">
                                            · {item.client.company_name}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm font-medium text-ink">
                                        {item.title}
                                    </p>
                                    {item.location && (
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            Location: {item.location}
                                        </p>
                                    )}
                                </div>

                                {item.matched_draft_job_id ? (
                                    <div className="rounded-md border border-info-strong/30 bg-surface p-2.5 text-xs sm:max-w-xs">
                                        <div className="font-semibold text-info-strong">
                                            Matching Draft Detected
                                        </div>
                                        <p className="mt-1 text-ink-soft">
                                            Draft{' '}
                                            <strong className="text-ink">
                                                {item.matched_draft_reference}
                                            </strong>{' '}
                                            appears to match this incoming
                                            handoff.
                                        </p>
                                    </div>
                                ) : (
                                    <span className="rounded bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-soft">
                                        Unlinked Draft
                                    </span>
                                )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                                <span className="text-xs text-ink-soft">
                                    {item.match_reason ||
                                        'Available for fresh draft conversion'}
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {item.matched_draft_job_id && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => {
                                                router.visit(
                                                    `/operations/dispatch-jobs/${item.matched_draft_job_id}`,
                                                );
                                            }}
                                        >
                                            Review draft{' '}
                                            {item.matched_draft_reference}
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => {
                                            if (
                                                item.source_type === 'service'
                                            ) {
                                                router.visit(
                                                    `/?view=dispatch&serviceRequestId=${item.id}`,
                                                );
                                            } else if (
                                                item.source_type === 'rental'
                                            ) {
                                                router.post(
                                                    `/operations/rental-reservations/${item.id}/dispatch`,
                                                );
                                            } else if (
                                                item.source_type === 'sale'
                                            ) {
                                                router.post(
                                                    `/operations/sales/orders/${item.id}/dispatch`,
                                                    {
                                                        scheduled_start:
                                                            new Date(
                                                                Date.now() +
                                                                    3600000,
                                                            ).toISOString(),
                                                        scheduled_end: new Date(
                                                            Date.now() +
                                                                10800000,
                                                        ).toISOString(),
                                                    },
                                                );
                                            }
                                        }}
                                    >
                                        Convert to linked dispatch
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
}

function ClientIntakeForm({ onClose }: { onClose: () => void }) {
    const form = useForm({
        code: '',
        company_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/operations/clients', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onClose();
            },
        });
    };

    return (
        <Panel id="client-intake-form" className="mt-4 p-4 md:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                    <h3 className="text-lg font-semibold text-ink">
                        New client record
                    </h3>
                    <p className="mt-1 text-sm text-ink-soft">
                        Create an active client record for operational
                        dispatches and service requests.
                    </p>
                </div>
                <Button
                    size="icon"
                    variant="quiet"
                    onClick={onClose}
                    aria-label="Close client form"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            <form
                className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                onSubmit={submit}
                noValidate
            >
                <IntakeInput
                    id="client-code"
                    label="Client code"
                    value={form.data.code}
                    error={form.errors.code}
                    onChange={(value) => form.setData('code', value)}
                    placeholder="e.g. CLI-894"
                    required
                />
                <IntakeInput
                    id="client-company-name"
                    label="Company name"
                    value={form.data.company_name}
                    error={form.errors.company_name}
                    onChange={(value) => form.setData('company_name', value)}
                    placeholder="e.g. Keppel Offshore & Marine"
                    required
                />
                <IntakeInput
                    id="client-contact-person"
                    label="Contact person"
                    value={form.data.contact_person}
                    error={form.errors.contact_person}
                    onChange={(value) => form.setData('contact_person', value)}
                />
                <IntakeInput
                    id="client-phone"
                    label="Phone"
                    type="tel"
                    value={form.data.phone}
                    error={form.errors.phone}
                    onChange={(value) => form.setData('phone', value)}
                />
                <IntakeInput
                    id="client-email"
                    label="Email"
                    type="email"
                    value={form.data.email}
                    error={form.errors.email}
                    onChange={(value) => form.setData('email', value)}
                />
                <IntakeInput
                    id="client-address"
                    label="Billing / headquarters address"
                    value={form.data.address}
                    error={form.errors.address}
                    onChange={(value) => form.setData('address', value)}
                />
                <div className="flex justify-end border-t border-line pt-4 md:col-span-2 xl:col-span-3">
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={form.processing}
                    >
                        {form.processing
                            ? 'Creating client…'
                            : 'Create client record'}
                    </Button>
                </div>
            </form>
        </Panel>
    );
}

function IntakeInput({
    id,
    label,
    value,
    error,
    onChange,
    className,
    required,
    ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    id: string;
    label: string;
    value: string;
    error?: string;
    onChange: (value: string) => void;
    required?: boolean;
}) {
    const errorId = `${id}-error`;

    return (
        <label className={cn('text-sm font-medium text-ink', className)}>
            {label}
            {required && <span className="ml-1 text-danger">*</span>}
            <input
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? errorId : undefined}
                className={cn(
                    'mt-1 h-11 w-full rounded-lg border bg-surface px-3 text-sm transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none',
                    error
                        ? 'border-danger'
                        : 'border-line-strong hover:border-ink-soft',
                )}
                required={required}
                {...props}
            />
            <FieldError id={errorId} error={error} />
        </label>
    );
}

function SelectField({
    id,
    label,
    value,
    error,
    onChange,
    children,
    className,
    required,
}: {
    id: string;
    label: string;
    value: string;
    error?: string;
    onChange: (value: string) => void;
    children: ReactNode;
    className?: string;
    required?: boolean;
}) {
    const errorId = `${id}-error`;

    return (
        <label className={cn('text-sm font-medium text-ink', className)}>
            {label}
            {required && <span className="ml-1 text-danger">*</span>}
            <select
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? errorId : undefined}
                className={cn(
                    'mt-1 h-11 w-full rounded-lg border bg-surface px-3 text-sm transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none',
                    error
                        ? 'border-danger'
                        : 'border-line-strong hover:border-ink-soft',
                )}
                required={required}
            >
                {children}
            </select>
            <FieldError id={errorId} error={error} />
        </label>
    );
}

function TextAreaField({
    id,
    label,
    value,
    error,
    onChange,
    hint,
    className,
}: {
    id: string;
    label: string;
    value: string;
    error?: string;
    onChange: (value: string) => void;
    hint?: string;
    className?: string;
}) {
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    return (
        <label className={cn('text-sm font-medium text-ink', className)}>
            {label}
            {hint && (
                <span
                    id={hintId}
                    className="ml-2 text-xs font-normal text-ink-soft"
                >
                    {hint}
                </span>
            )}
            <textarea
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={3}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={
                    [hint ? hintId : null, error ? errorId : null]
                        .filter(Boolean)
                        .join(' ') || undefined
                }
                className={cn(
                    'mt-1 w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none',
                    error
                        ? 'border-danger'
                        : 'border-line-strong hover:border-ink-soft',
                )}
            />
            <FieldError id={errorId} error={error} />
        </label>
    );
}

function FieldError({ id, error }: { id: string; error?: string }) {
    if (!error) {
        return null;
    }

    return (
        <span
            id={id}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="mt-1 block text-xs text-danger"
        >
            {error}
        </span>
    );
}

function linesFromText(value: string): string[] {
    return value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '');
}

function toLocalDateTime(value: string | null): string {
    if (value === null) {
        return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

    return local.toISOString().slice(0, 16);
}

function addHours(value: string, hours: number): string {
    if (value === '') {
        return '';
    }

    const date = new Date(value);
    date.setHours(date.getHours() + hours);

    return toLocalDateTime(date.toISOString());
}

function localDateTimeInput(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
