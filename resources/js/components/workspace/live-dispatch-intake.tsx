import { useForm } from '@inertiajs/react';
import {
    CalendarDays,
    ClipboardCheck,
    FilePlus2,
    UserRoundPlus,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';
import { Button, DataPair, EmptyState, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { cn } from '@/lib/utils';
import type {
    ClientViewModel,
    ServiceRequestViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

type IntakeMode = 'client' | 'request' | null;

export function LiveDispatchIntake({
    clients,
    serviceRequests,
    capabilities,
}: {
    clients: ClientViewModel[];
    serviceRequests: ServiceRequestViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const [mode, setMode] = useState<IntakeMode>(null);

    return (
        <section
            className="border-b border-line bg-surface px-4 py-5 md:px-6"
            aria-labelledby="service-request-intake-title"
        >
            <div className="mx-auto max-w-7xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2
                            id="service-request-intake-title"
                            className="text-lg font-semibold"
                        >
                            Client and service request intake
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                            Record demand once, then create as many distinct
                            draft dispatches as staged or rescheduled work
                            requires.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {capabilities.create_client && (
                            <Button
                                variant={
                                    mode === 'client' ? 'primary' : 'secondary'
                                }
                                onClick={() =>
                                    setMode((current) =>
                                        current === 'client' ? null : 'client',
                                    )
                                }
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
                        {capabilities.create_service_request && (
                            <Button
                                variant={
                                    mode === 'request' ? 'primary' : 'secondary'
                                }
                                onClick={() =>
                                    setMode((current) =>
                                        current === 'request'
                                            ? null
                                            : 'request',
                                    )
                                }
                                aria-expanded={mode === 'request'}
                                aria-controls="service-request-intake-form"
                                disabled={clients.length === 0}
                                title={
                                    clients.length === 0
                                        ? 'Create an active client first.'
                                        : undefined
                                }
                            >
                                <FilePlus2
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                New service request
                            </Button>
                        )}
                    </div>
                </div>

                {mode === 'client' && (
                    <ClientIntakeForm onClose={() => setMode(null)} />
                )}
                {mode === 'request' && (
                    <ServiceRequestIntakeForm
                        clients={clients}
                        onClose={() => setMode(null)}
                    />
                )}

                {capabilities.convert_service_request && (
                    <DispatchConversion
                        serviceRequests={serviceRequests}
                        className={mode === null ? 'mt-5' : 'mt-4'}
                    />
                )}
            </div>
        </section>
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
        <Panel id="client-intake-form" className="mt-4 p-4">
            <FormHeader
                title="New client"
                description="Create an active client record for service-request selection."
                onClose={onClose}
            />
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
                    autoComplete="off"
                    required
                />
                <IntakeInput
                    id="client-company-name"
                    label="Company name"
                    value={form.data.company_name}
                    error={form.errors.company_name}
                    onChange={(value) => form.setData('company_name', value)}
                    autoComplete="organization"
                    required
                />
                <IntakeInput
                    id="client-contact-person"
                    label="Contact person"
                    value={form.data.contact_person}
                    error={form.errors.contact_person}
                    onChange={(value) => form.setData('contact_person', value)}
                    autoComplete="name"
                />
                <IntakeInput
                    id="client-phone"
                    label="Phone"
                    type="tel"
                    value={form.data.phone}
                    error={form.errors.phone}
                    onChange={(value) => form.setData('phone', value)}
                    autoComplete="tel"
                />
                <IntakeInput
                    id="client-email"
                    label="Email"
                    type="email"
                    value={form.data.email}
                    error={form.errors.email}
                    onChange={(value) => form.setData('email', value)}
                    autoComplete="email"
                />
                <IntakeInput
                    id="client-address"
                    label="Address"
                    value={form.data.address}
                    error={form.errors.address}
                    onChange={(value) => form.setData('address', value)}
                    autoComplete="street-address"
                />
                <FormActions
                    processing={form.processing}
                    processingLabel="Creating client…"
                    submitLabel="Create client"
                />
            </form>
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
        <Panel id="service-request-intake-form" className="mt-4 p-4">
            <FormHeader
                title="New service request"
                description="Capture the requested work, schedule, site context, and operational requirements."
                onClose={onClose}
            />
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
                    label="Project or job name"
                    value={form.data.project_name}
                    error={form.errors.project_name}
                    onChange={(value) => form.setData('project_name', value)}
                    required
                />
                <IntakeInput
                    id="request-service-type"
                    label="Service type"
                    value={form.data.service_type}
                    error={form.errors.service_type}
                    onChange={(value) => form.setData('service_type', value)}
                    placeholder="e.g. crane and truck"
                    required
                />
                <IntakeInput
                    id="request-location"
                    label="Service location"
                    value={form.data.location}
                    error={form.errors.location}
                    onChange={(value) => form.setData('location', value)}
                    required
                />
                <IntakeInput
                    id="request-schedule"
                    label="Requested schedule"
                    type="datetime-local"
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
                <TextAreaField
                    id="request-requirements"
                    label="Requirements"
                    hint="One requirement per line"
                    value={requirementsText}
                    error={form.errors.requirements}
                    onChange={setRequirementsText}
                />
                <TextAreaField
                    id="request-site-notes"
                    label="Site notes"
                    value={form.data.site_notes}
                    error={form.errors.site_notes}
                    onChange={(value) => form.setData('site_notes', value)}
                    className="md:col-span-2 xl:col-span-3"
                />
                <FormActions
                    processing={form.processing}
                    processingLabel="Recording request…"
                    submitLabel="Record service request"
                    disabled={!complete}
                    help={
                        complete
                            ? undefined
                            : 'Complete the client, request, service, and location fields.'
                    }
                />
            </form>
        </Panel>
    );
}

function DispatchConversion({
    serviceRequests,
    className,
}: {
    serviceRequests: ServiceRequestViewModel[];
    className?: string;
}) {
    const form = useForm({
        service_request_id: '',
        reference: '',
        scheduled_start: '',
        scheduled_end: '',
    });
    const selectedRequest =
        serviceRequests.find(
            (request) => String(request.id) === form.data.service_request_id,
        ) ?? null;
    const complete = [
        form.data.service_request_id,
        form.data.reference,
        form.data.scheduled_start,
        form.data.scheduled_end,
    ].every((value) => value.trim() !== '');

    const chooseRequest = (id: string) => {
        const request = serviceRequests.find(
            (candidate) => String(candidate.id) === id,
        );
        const start = toLocalDateTime(request?.scheduled_date ?? null);

        form.setData({
            service_request_id: id,
            reference: form.data.reference,
            scheduled_start: start,
            scheduled_end: addHours(start, 4),
        });
    };
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
        <Panel className={cn('overflow-hidden', className)}>
            <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
                <div className="border-b border-line p-4 lg:border-r lg:border-b-0">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                            <ClipboardCheck
                                className="h-5 w-5"
                                aria-hidden="true"
                            />
                        </div>
                        <div>
                            <h3 className="font-semibold">
                                Convert request to draft
                            </h3>
                            <p className="mt-1 text-sm leading-6 text-ink-soft">
                                Request-owned details are copied as an auditable
                                snapshot. Each additional draft needs a distinct
                                dispatch reference.
                            </p>
                        </div>
                    </div>

                    {selectedRequest ? (
                        <div className="mt-4 rounded-lg bg-surface-subtle p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold">
                                    {selectedRequest.project_name}
                                </p>
                                <CanonicalStatusBadge
                                    status={selectedRequest.priority}
                                />
                                <CanonicalStatusBadge
                                    status={selectedRequest.status}
                                />
                            </div>
                            <dl className="mt-2 divide-y divide-line">
                                <DataPair
                                    label="Client"
                                    value={selectedRequest.client.company_name}
                                />
                                <DataPair
                                    label="Location"
                                    value={selectedRequest.location}
                                />
                                <DataPair
                                    label="Drafts"
                                    value={String(
                                        selectedRequest.dispatch_jobs_count,
                                    )}
                                />
                            </dl>
                        </div>
                    ) : (
                        <p className="mt-4 rounded-lg bg-surface-subtle p-3 text-sm text-ink-soft">
                            Select a submitted or dispatching request to review
                            its context.
                        </p>
                    )}
                </div>

                {serviceRequests.length === 0 ? (
                    <EmptyState
                        compact
                        icon={CalendarDays}
                        title="No service requests ready"
                        message="Record a service request before creating a linked draft dispatch."
                    />
                ) : (
                    <form
                        className="grid gap-4 p-4 sm:grid-cols-2"
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
                            onChange={(value) =>
                                form.setData('reference', value)
                            }
                            required
                        />
                        <div className="hidden sm:block" aria-hidden="true" />
                        <IntakeInput
                            id="conversion-start"
                            label="Dispatch start"
                            type="datetime-local"
                            value={form.data.scheduled_start}
                            error={form.errors.scheduled_start}
                            onChange={(value) =>
                                form.setData('scheduled_start', value)
                            }
                            required
                        />
                        <IntakeInput
                            id="conversion-end"
                            label="Dispatch end"
                            type="datetime-local"
                            value={form.data.scheduled_end}
                            error={form.errors.scheduled_end}
                            onChange={(value) =>
                                form.setData('scheduled_end', value)
                            }
                            required
                        />
                        <FormActions
                            processing={form.processing}
                            processingLabel="Creating draft…"
                            submitLabel="Create linked draft"
                            disabled={!complete}
                            help={
                                complete
                                    ? undefined
                                    : 'Select a request and complete the reference and schedule.'
                            }
                            className="sm:col-span-2"
                        />
                    </form>
                )}
            </div>
        </Panel>
    );
}

function FormHeader({
    title,
    description,
    onClose,
}: {
    title: string;
    description: string;
    onClose: () => void;
}) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{description}</p>
            </div>
            <Button
                size="icon"
                variant="quiet"
                onClick={onClose}
                aria-label={`Close ${title.toLowerCase()} form`}
            >
                <X className="h-4 w-4" aria-hidden="true" />
            </Button>
        </div>
    );
}

function IntakeInput({
    id,
    label,
    value,
    error,
    onChange,
    className,
    ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    id: string;
    label: string;
    value: string;
    error?: string;
    onChange: (value: string) => void;
}) {
    const errorId = `${id}-error`;

    return (
        <label className={cn('text-sm font-medium text-ink', className)}>
            {label}
            <input
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? errorId : undefined}
                className={cn(
                    'mt-1 h-11 w-full rounded-lg border bg-surface px-3',
                    error ? 'border-danger' : 'border-line-strong',
                )}
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
            <select
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? errorId : undefined}
                className={cn(
                    'mt-1 h-11 w-full rounded-lg border bg-surface px-3',
                    error ? 'border-danger' : 'border-line-strong',
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
                    'mt-1 w-full resize-y rounded-lg border bg-surface px-3 py-2',
                    error ? 'border-danger' : 'border-line-strong',
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
        <span id={id} className="mt-1 block text-xs text-danger">
            {error}
        </span>
    );
}

function FormActions({
    processing,
    processingLabel,
    submitLabel,
    disabled = false,
    help,
    className,
}: {
    processing: boolean;
    processingLabel: string;
    submitLabel: string;
    disabled?: boolean;
    help?: string;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col justify-end self-end', className)}>
            <Button
                type="submit"
                variant="primary"
                disabled={processing || disabled}
            >
                {processing ? processingLabel : submitLabel}
            </Button>
            {help && !processing && (
                <p className="mt-1 text-xs text-ink-soft">{help}</p>
            )}
        </div>
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
