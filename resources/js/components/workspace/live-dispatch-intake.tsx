import { useForm, router } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowRight,
    CalendarDays,
    Check,
    CheckCircle2,
    ClipboardCheck,
    Edit3,
    FileText,
    Info,
    Link2,
    MapPin,
    Package,
    Plus,
    PlusCircle,
    ShieldCheck,
    UserRoundPlus,
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
import { formatCurrency, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    ClientViewModel,
    DispatchJobViewModel,
    DispatchPriorityValue,
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

const ON_SITE_SAFETY_REQUIREMENTS = [
    'Require on-site ground bearing & soil stability check',
    'Require outrigger pad clearance & positioning check',
    'Require overhead power line safe clearance verification',
    'Require site induction & PPE compliance verification',
];

const PERMITS_RIGGING_REQUIREMENTS = [
    'Require certified rigging gear & inspection sign-off',
    'Require traffic control & local municipal permit in place',
];

const PREDEFINED_TECHNICAL_REQUIREMENTS = [
    ...ON_SITE_SAFETY_REQUIREMENTS,
    ...PERMITS_RIGGING_REQUIREMENTS,
];

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
}) {
    const canCreateManual = capabilities.create_dispatch;
    const canReviewService = capabilities.convert_service_request;
    const canReviewRental = capabilities.create_rental_dispatch;
    const canReviewSale = capabilities.create_sales_dispatch;

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

        return initialMode;
    });
    const [selectedItemKey, setSelectedItemKey] = useState<string | null>(
        initialRequestId ? `service-${initialRequestId}` : null,
    );
    const unlinkedCount = incomingItems.length;

    const closeWorkflow = () => {
        setMode(null);
        setSelectedItemKey(null);
    };

    return (
        <section
            className="border-b border-line bg-surface px-4 py-5 md:px-6"
            aria-labelledby="dispatch-intake-title"
        >
            <div className="mx-auto max-w-7xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2
                            id="dispatch-intake-title"
                            className="text-lg font-semibold tracking-tight text-ink"
                        >
                            New dispatch
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                            Core 1 handoffs are routed to the right workflow
                            automatically. Review the incoming work below, or
                            create a direct operational dispatch when no
                            upstream handoff exists.
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
                                <UserRoundPlus
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
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

                <div
                    className="mt-5 rounded-xl border border-line bg-surface-subtle p-4"
                    aria-live="polite"
                >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                Incoming work
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-ink">
                                Core 1 handoffs routed automatically
                            </h3>
                            <p className="mt-1 max-w-2xl text-sm text-ink-soft">
                                Each item opens its own service, rental, or
                                sales workflow. No source selection is needed.
                            </p>
                        </div>
                        <span className="inline-flex w-fit items-center rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-strong">
                            {incomingItems.length > 0
                                ? `${incomingItems.length} needs review`
                                : 'No handoffs waiting'}
                        </span>
                    </div>

                    {incomingItems.length > 0 ? (
                        <div
                            className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface"
                            role="list"
                            aria-label="Incoming work queue"
                        >
                            {incomingItems.map((item) => (
                                <IncomingWorkRow
                                    key={item.key}
                                    item={item}
                                    selected={selectedItemKey === item.key}
                                    onClick={() => {
                                        setSelectedItemKey(item.key);
                                        setMode(item.mode);
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            compact
                            icon={ClipboardCheck}
                            title="No Core 1 handoffs waiting"
                            message="Use Direct operational dispatch for work that has not arrived from Core 1."
                        />
                    )}
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
                            type="button"
                            variant={
                                mode === 'manual' ? 'secondary' : 'primary'
                            }
                            aria-pressed={mode === 'manual'}
                            onClick={() => {
                                setSelectedItemKey(null);
                                setMode((cur) =>
                                    cur === 'manual' ? null : 'manual',
                                );
                            }}
                        >
                            <PlusCircle
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                            {mode === 'manual'
                                ? 'Close direct dispatch'
                                : 'Create direct dispatch'}
                        </Button>
                    )}
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                            Dispatch review
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">
                            Review unmatched records before they can create a
                            duplicate execution.
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
                            'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-all',
                            mode === 'reconciliation'
                                ? 'border-info-strong bg-info-soft text-info-strong shadow-xs'
                                : 'border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                        )}
                    >
                        <Link2
                            className="h-4 w-4 shrink-0 text-info-strong"
                            aria-hidden="true"
                        />
                        <span>Review unmatched handoffs</span>
                        <span className="rounded-full bg-info px-2 py-0.5 text-[10px] font-bold text-white">
                            {unlinkedCount} to review
                        </span>
                    </button>
                </div>

                {mode === 'client' && (
                    <ClientIntakeForm onClose={closeWorkflow} />
                )}

                {mode === 'manual' && (
                    <ManualDispatchIntakeForm
                        clients={clients}
                        onClose={closeWorkflow}
                    />
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
    const Icon =
        item.mode === 'service'
            ? FileText
            : item.mode === 'rental'
              ? CalendarDays
              : Package;
    const toneClass =
        item.mode === 'service'
            ? 'text-brand-strong'
            : item.mode === 'rental'
              ? 'text-warning-strong'
              : 'text-success-strong';

    return (
        <div role="listitem">
            <button
                type="button"
                aria-pressed={selected}
                aria-label={`Review ${item.sourceLabel}: ${item.reference}`}
                onClick={onClick}
                className={cn(
                    'flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left transition-colors',
                    selected
                        ? 'bg-brand-soft/60'
                        : 'bg-surface hover:bg-surface-subtle',
                )}
            >
                <Icon
                    className={cn('h-4 w-4 shrink-0', toneClass)}
                    aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-ink">
                            {item.sourceLabel}
                        </span>
                        <span className="text-xs font-medium text-ink-soft">
                            {item.reference}
                        </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-soft">
                        {item.client} · {item.detail}
                    </span>
                </span>
                <span className="hidden shrink-0 text-right sm:block">
                    <span className="block text-xs font-medium text-ink-soft">
                        {item.status}
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold text-brand-strong">
                        {selected ? 'Open workflow' : 'Review'}
                    </span>
                </span>
                <ArrowRight
                    className="text-ink-muted h-4 w-4 shrink-0"
                    aria-hidden="true"
                />
            </button>
        </div>
    );
}

function ManualDispatchIntakeForm({
    clients,
    onClose,
}: {
    clients: ClientViewModel[];
    onClose: () => void;
}) {
    const [requirements, setRequirements] = useState<string[]>([]);
    const [customRequirements, setCustomRequirements] = useState<string[]>([]);
    const [customRequirement, setCustomRequirement] = useState('');

    const form = useForm({
        client: '',
        title: '',
        site: '',
        scheduled_start: '',
        scheduled_end: '',
        priority: 'routine' as DispatchPriorityValue,
        site_notes: '',
        requirements: [] as string[],
    });

    const togglePredefined = (text: string) => {
        setRequirements((prev) =>
            prev.includes(text)
                ? prev.filter((r) => r !== text)
                : [...prev, text],
        );
    };

    const toggleCustomRequirement = (text: string) => {
        setRequirements((prev) =>
            prev.includes(text)
                ? prev.filter((r) => r !== text)
                : [...prev, text],
        );
    };

    const addCustomRequirement = () => {
        const trimmed = customRequirement.trim();

        if (trimmed) {
            if (!customRequirements.includes(trimmed)) {
                setCustomRequirements((prev) => [...prev, trimmed]);
            }

            if (!requirements.includes(trimmed)) {
                setRequirements((prev) => [...prev, trimmed]);
            }

            setCustomRequirement('');
        }
    };

    const removeCustomRequirement = (text: string) => {
        setCustomRequirements((prev) => prev.filter((r) => r !== text));
        setRequirements((prev) => prev.filter((r) => r !== text));
    };

    const allStandardSelected = PREDEFINED_TECHNICAL_REQUIREMENTS.every((req) =>
        requirements.includes(req),
    );

    const toggleAllStandard = () => {
        if (allStandardSelected) {
            setRequirements((prev) =>
                prev.filter(
                    (r) => !PREDEFINED_TECHNICAL_REQUIREMENTS.includes(r),
                ),
            );
        } else {
            setRequirements((prev) => [
                ...prev.filter(
                    (r) => !PREDEFINED_TECHNICAL_REQUIREMENTS.includes(r),
                ),
                ...PREDEFINED_TECHNICAL_REQUIREMENTS,
            ]);
        }
    };

    const formComplete =
        form.data.client.trim() !== '' &&
        form.data.title.trim() !== '' &&
        form.data.site.trim() !== '' &&
        form.data.scheduled_start.trim() !== '' &&
        form.data.scheduled_end.trim() !== '';

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            requirements,
        }));
        form.post('/operations/dispatch-jobs', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setRequirements([]);
                setCustomRequirements([]);
                onClose();
            },
        });
    };

    return (
        <Panel id="manual-intake-form" className="mt-4 p-4 md:p-6">
            <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            Direct Manual Intake
                        </span>
                        <span className="rounded bg-brand-soft px-2 py-0.5 font-mono text-xs font-medium text-brand-strong">
                            manual_intake provenance
                        </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-ink">
                        Create manual operational draft dispatch
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                        Creates an operational draft dispatch directly in Core 2
                        with full assignment, approval, and scheduling
                        capabilities. Does not generate or require an upstream
                        Core 1 commercial quotation or order.
                    </p>
                </div>
                <Button
                    size="icon"
                    variant="quiet"
                    onClick={onClose}
                    aria-label="Close manual intake form"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-lg border border-line bg-surface-subtle p-3 text-xs text-ink-soft">
                <Info
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong"
                    aria-hidden="true"
                />
                <div>
                    <strong className="font-semibold text-ink">
                        Operational Draft Provenance:
                    </strong>{' '}
                    This dispatch will be registered with source type{' '}
                    <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-ink">
                        manual_intake
                    </code>
                    . All Core 2 features (Day/Week/Month scheduling,
                    eligibility validation, credential checks, safety approvals,
                    live MapLibre tracking, and mobile progression) apply
                    identically.
                </div>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-5" noValidate>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="text-sm font-medium text-ink">
                        <span>Dispatch reference</span>
                        <div
                            id="manual-reference"
                            className="mt-1 flex h-11 items-center rounded-lg border border-dashed border-line-strong bg-surface-subtle px-3"
                            aria-describedby="manual-reference-hint"
                        >
                            <span className="font-mono text-sm text-ink-soft">
                                DSP-MAN-YYYY-NNN
                            </span>
                        </div>
                        <p
                            id="manual-reference-hint"
                            className="mt-1 text-xs font-normal text-ink-soft"
                        >
                            A unique reference is assigned automatically when
                            this draft is saved.
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-ink">
                            Client name
                            <span className="ml-1 text-danger">*</span>
                            <div className="mt-1 flex gap-2">
                                <input
                                    id="manual-client"
                                    value={form.data.client}
                                    onChange={(event) =>
                                        form.setData(
                                            'client',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="Enter or pick client"
                                    className={cn(
                                        'h-11 w-full rounded-lg border bg-surface px-3 text-sm',
                                        form.errors.client
                                            ? 'border-danger'
                                            : 'border-line-strong',
                                    )}
                                    required
                                    list="existing-clients-datalist"
                                />
                                <datalist id="existing-clients-datalist">
                                    {clients.map((c) => (
                                        <option
                                            key={c.id}
                                            value={c.company_name}
                                        >
                                            {c.code} · {c.company_name}
                                        </option>
                                    ))}
                                </datalist>
                            </div>
                        </label>
                        {form.errors.client && (
                            <FieldError
                                id="manual-client-error"
                                error={form.errors.client}
                            />
                        )}
                    </div>

                    <IntakeInput
                        id="manual-title"
                        label="Dispatch title / scope"
                        value={form.data.title}
                        error={form.errors.title}
                        onChange={(value) => form.setData('title', value)}
                        placeholder="e.g. 50T Heavy Crane Lift & Transport"
                        required
                    />

                    <IntakeInput
                        id="manual-site"
                        label="Job site location"
                        value={form.data.site}
                        error={form.errors.site}
                        onChange={(value) => form.setData('site', value)}
                        placeholder="e.g. Jurong Island Berth 4"
                        required
                    />

                    <DateTimePicker
                        id="manual-start"
                        label="Scheduled start"
                        value={form.data.scheduled_start}
                        error={form.errors.scheduled_start}
                        onChange={(value) =>
                            form.setData('scheduled_start', value)
                        }
                        required
                    />

                    <DateTimePicker
                        id="manual-end"
                        label="Scheduled end"
                        value={form.data.scheduled_end}
                        error={form.errors.scheduled_end}
                        onChange={(value) =>
                            form.setData('scheduled_end', value)
                        }
                        required
                    />

                    <SelectField
                        id="manual-priority"
                        label="Operational priority"
                        value={form.data.priority}
                        error={form.errors.priority}
                        onChange={(value) =>
                            form.setData(
                                'priority',
                                value as DispatchPriorityValue,
                            )
                        }
                        required
                    >
                        <option value="routine">Routine</option>
                        <option value="priority">Priority</option>
                        <option value="emergency">Emergency</option>
                    </SelectField>
                </div>

                <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h4 className="text-sm font-semibold text-ink">
                                Technical requirements &amp; safety directives
                            </h4>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                Optional field directives — select criteria the
                                operator &amp; crew must verify before
                                commencing work.
                            </p>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={toggleAllStandard}
                                className="text-xs font-semibold text-brand-strong transition-colors hover:text-ink hover:underline"
                            >
                                {allStandardSelected
                                    ? 'Deselect all standard'
                                    : 'Select all standard'}
                            </button>
                            <span
                                className={cn(
                                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
                                    requirements.length > 0
                                        ? 'border border-brand/40 bg-brand-soft font-semibold text-brand-strong shadow-2xs'
                                        : 'border border-line bg-surface-subtle text-ink-soft',
                                )}
                            >
                                {requirements.length} requirement
                                {requirements.length === 1 ? '' : 's'} added
                            </span>
                        </div>
                    </div>

                    {/* Section 1: On-Site Safety Checks */}
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-1.5 text-ink-soft">
                            <ShieldCheck
                                className="h-3.5 w-3.5 text-brand-strong"
                                aria-hidden="true"
                            />
                            <span className="text-[11px] font-semibold tracking-wide uppercase">
                                On-Site Safety Checks (Operator verifies on
                                site)
                            </span>
                        </div>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                            {ON_SITE_SAFETY_REQUIREMENTS.map((req) => {
                                const active = requirements.includes(req);

                                return (
                                    <label
                                        key={req}
                                        className={cn(
                                            'group relative flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border p-3 text-left text-xs transition-all duration-150 select-none',
                                            active
                                                ? 'border-brand-strong bg-brand-soft/80 font-medium text-ink shadow-xs ring-1 ring-brand-strong/30'
                                                : 'border-line bg-surface text-ink shadow-2xs hover:border-brand/40 hover:bg-surface-subtle/60',
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={active}
                                            onChange={() =>
                                                togglePredefined(req)
                                            }
                                            className="sr-only"
                                        />
                                        <div
                                            className={cn(
                                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-150',
                                                active
                                                    ? 'scale-105 border-brand-strong bg-brand-strong text-white shadow-xs'
                                                    : 'border-line-strong bg-surface group-hover:border-brand/60',
                                            )}
                                            aria-hidden="true"
                                        >
                                            {active && (
                                                <Check
                                                    className="h-3.5 w-3.5 stroke-[2.75]"
                                                    aria-hidden="true"
                                                />
                                            )}
                                        </div>
                                        <span
                                            className={cn(
                                                'flex-1 leading-snug transition-colors',
                                                active
                                                    ? 'font-semibold text-ink'
                                                    : 'font-normal text-ink',
                                            )}
                                        >
                                            {req}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section 2: Permits & Rigging Compliance */}
                    <div className="mt-4 space-y-2 border-t border-line/70 pt-3.5">
                        <div className="flex items-center gap-1.5 text-ink-soft">
                            <ClipboardCheck
                                className="h-3.5 w-3.5 text-brand-strong"
                                aria-hidden="true"
                            />
                            <span className="text-[11px] font-semibold tracking-wide uppercase">
                                Permits &amp; Equipment Compliance
                            </span>
                        </div>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                            {PERMITS_RIGGING_REQUIREMENTS.map((req) => {
                                const active = requirements.includes(req);

                                return (
                                    <label
                                        key={req}
                                        className={cn(
                                            'group relative flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border p-3 text-left text-xs transition-all duration-150 select-none',
                                            active
                                                ? 'border-brand-strong bg-brand-soft/80 font-medium text-ink shadow-xs ring-1 ring-brand-strong/30'
                                                : 'border-line bg-surface text-ink shadow-2xs hover:border-brand/40 hover:bg-surface-subtle/60',
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={active}
                                            onChange={() =>
                                                togglePredefined(req)
                                            }
                                            className="sr-only"
                                        />
                                        <div
                                            className={cn(
                                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-150',
                                                active
                                                    ? 'scale-105 border-brand-strong bg-brand-strong text-white shadow-xs'
                                                    : 'border-line-strong bg-surface group-hover:border-brand/60',
                                            )}
                                            aria-hidden="true"
                                        >
                                            {active && (
                                                <Check
                                                    className="h-3.5 w-3.5 stroke-[2.75]"
                                                    aria-hidden="true"
                                                />
                                            )}
                                        </div>
                                        <span
                                            className={cn(
                                                'flex-1 leading-snug transition-colors',
                                                active
                                                    ? 'font-semibold text-ink'
                                                    : 'font-normal text-ink',
                                            )}
                                        >
                                            {req}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section 3: Custom Technical Requirements */}
                    {customRequirements.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-line/70 pt-3.5">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                                    Custom Site Criteria (
                                    {customRequirements.length})
                                </p>
                            </div>
                            <div className="grid gap-2.5 sm:grid-cols-2">
                                {customRequirements.map((req) => {
                                    const active = requirements.includes(req);

                                    return (
                                        <div
                                            key={req}
                                            className={cn(
                                                'group relative flex min-h-[52px] items-center justify-between gap-2.5 rounded-xl border p-3 text-left text-xs transition-all duration-150',
                                                active
                                                    ? 'border-brand-strong bg-brand-soft/80 font-medium text-ink shadow-xs ring-1 ring-brand-strong/30'
                                                    : 'border-line bg-surface text-ink-soft shadow-2xs hover:border-line-strong hover:bg-surface-subtle/60',
                                            )}
                                        >
                                            <label className="flex flex-1 cursor-pointer items-center gap-3 select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={active}
                                                    onChange={() =>
                                                        toggleCustomRequirement(
                                                            req,
                                                        )
                                                    }
                                                    className="sr-only"
                                                />
                                                <div
                                                    className={cn(
                                                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-150',
                                                        active
                                                            ? 'scale-105 border-brand-strong bg-brand-strong text-white shadow-xs'
                                                            : 'border-line-strong bg-surface group-hover:border-brand/60',
                                                    )}
                                                    aria-hidden="true"
                                                >
                                                    {active && (
                                                        <Check
                                                            className="h-3.5 w-3.5 stroke-[2.75]"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                </div>
                                                <div className="flex-1 leading-snug">
                                                    <span
                                                        className={cn(
                                                            'block',
                                                            active
                                                                ? 'font-semibold text-ink'
                                                                : 'text-ink-soft line-through',
                                                        )}
                                                    >
                                                        {req}
                                                    </span>
                                                    <span className="text-[10px] font-medium text-brand-strong">
                                                        Custom
                                                    </span>
                                                </div>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeCustomRequirement(req)
                                                }
                                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-danger-soft hover:text-danger-strong"
                                                aria-label={`Remove custom requirement: ${req}`}
                                                title="Remove custom requirement"
                                            >
                                                <X
                                                    className="h-3.5 w-3.5"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Add Custom Requirement Input */}
                    <div className="mt-4 flex gap-2 border-t border-line/70 pt-3.5">
                        <label
                            htmlFor="manual-custom-requirement"
                            className="sr-only"
                        >
                            Custom technical requirement
                        </label>
                        <input
                            id="manual-custom-requirement"
                            type="text"
                            value={customRequirement}
                            onChange={(e) =>
                                setCustomRequirement(e.target.value)
                            }
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addCustomRequirement();
                                }
                            }}
                            placeholder="Add custom technical requirement..."
                            className="h-11 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                        />
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={addCustomRequirement}
                            disabled={!customRequirement.trim()}
                        >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            Add item
                        </Button>
                    </div>
                </div>

                <TextAreaField
                    id="manual-site-notes"
                    label="Site instructions & operational notes"
                    value={form.data.site_notes}
                    error={form.errors.site_notes}
                    onChange={(value) => form.setData('site_notes', value)}
                    hint="Include gate clearance, escort protocol, or load-in window details."
                />

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                    <p className="text-xs text-ink-soft">
                        {formComplete
                            ? 'Ready to create manual draft dispatch.'
                            : 'Fill in reference, client, title, site, and schedule to create draft.'}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={form.processing || !formComplete}
                        >
                            {form.processing
                                ? 'Creating operational draft…'
                                : 'Create manual draft dispatch'}
                        </Button>
                    </div>
                </div>
            </form>
        </Panel>
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
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong">
                            <FileText
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                            />
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
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-line bg-surface p-1">
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
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                        <ClipboardCheck
                            className="h-5 w-5"
                            aria-hidden="true"
                        />
                    </div>
                    <div>
                        <h4 className="font-semibold text-ink">
                            Convert request to linked draft
                        </h4>
                        <p className="mt-1 text-sm text-ink-soft">
                            Request details are copied as a durable snapshot
                            into the draft dispatch. Multiple dispatches can
                            link to the same request for staged execution.
                        </p>
                    </div>
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
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-strong">
                            <CalendarDays
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                            />
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
                                    <ul className="mt-1 space-y-1 text-ink-soft">
                                        <li className="flex items-center gap-1.5">
                                            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success-strong" />
                                            <span>
                                                Pre-operation inspection &amp;
                                                safe release certified
                                            </span>
                                        </li>
                                        <li className="flex items-center gap-1.5">
                                            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success-strong" />
                                            <span>
                                                Operator assignment context:
                                                Dedicated crane operator
                                                required
                                            </span>
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
                                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
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
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-strong">
                            <Package
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                            />
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
                                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
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
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-info-strong">
                            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
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
                                        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
                                            <MapPin className="h-3 w-3" />
                                            {item.location}
                                        </p>
                                    )}
                                </div>

                                {item.matched_draft_job_id ? (
                                    <div className="rounded-md border border-info-strong/30 bg-surface p-2.5 text-xs sm:max-w-xs">
                                        <div className="flex items-center gap-1.5 font-semibold text-info-strong">
                                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                            <span>Matching Draft Detected</span>
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
                                            <Link2 className="h-3.5 w-3.5" />
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
                                        <ArrowRight className="h-3.5 w-3.5" />
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
