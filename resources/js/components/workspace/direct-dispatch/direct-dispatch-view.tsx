import { ArrowLeft, Check, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
    FormEvent,
    InputHTMLAttributes,
    ReactNode,
    TextareaHTMLAttributes,
} from 'react';
import { Button, DateTimePicker } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
    DirectDispatchSummary,
    projectDirectDispatchSummary,
} from './direct-dispatch-summary';
import {
    DIRECT_DISPATCH_SUBTYPES,
    DIRECT_DISPATCH_WORK_TYPES,
} from './intake-data';
import type {
    DirectDispatchFormData,
    DirectDispatchExitReason,
    DirectDispatchIntakeProps,
} from './types';
import {
    DIRECT_DISPATCH_DISCARD_MESSAGE,
    useDirectDispatchForm,
} from './use-direct-dispatch-form';

export function DirectDispatchView({
    clients,
    capabilities,
    onBack,
    onClose,
    onAddClient,
    onDirtyChange,
    onEntryFocus,
    onExitFocus,
}: DirectDispatchIntakeProps) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    const entryFocusedRef = useRef(false);
    const {
        form,
        intakeData,
        customRequirement,
        customRequirements,
        isDirty,
        setCustomRequirement,
        setEquipmentSubtype,
        setWorkStream,
        toggleRequirement,
        toggleAllRecommended,
        addCustomRequirement,
        removeCustomRequirement,
        resetDraft,
        submit,
    } = useDirectDispatchForm({
        onDirtyChange,
        onSubmitted: () => {
            onExitFocus?.('success');
            onClose?.();
        },
    });
    const summary = useMemo(
        () => projectDirectDispatchSummary(form.data),
        [form.data],
    );

    useEffect(() => {
        if (entryFocusedRef.current) {
            return;
        }

        const heading = headingRef.current;

        if (!heading) {
            return;
        }

        entryFocusedRef.current = true;
        heading.focus({ preventScroll: true });
        onEntryFocus?.(heading);
    }, [onEntryFocus]);

    const requestExit = useCallback(
        (reason: Exclude<DirectDispatchExitReason, 'success'>) => {
            if (isDirty && !window.confirm(DIRECT_DISPATCH_DISCARD_MESSAGE)) {
                return;
            }

            if (isDirty) {
                resetDraft();
            }

            onExitFocus?.(reason);

            if (reason === 'back') {
                (onBack ?? onClose)?.();

                return;
            }

            onClose?.();
        },
        [isDirty, onBack, onClose, onExitFocus, resetDraft],
    );

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented) {
                return;
            }

            event.preventDefault();
            requestExit('close');
        };

        document.addEventListener('keydown', handleEscape);

        return () => document.removeEventListener('keydown', handleEscape);
    }, [requestExit]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        submit(event);
    };

    return (
        <section
            className="max-w-full min-w-0 overflow-x-clip rounded-xl border border-line bg-surface"
            aria-labelledby="direct-dispatch-title"
        >
            <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 md:px-6">
                <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-brand-strong uppercase">
                        New dispatch
                    </p>
                    <h1
                        id="direct-dispatch-title"
                        ref={headingRef}
                        tabIndex={-1}
                        className="mt-1 text-xl font-semibold tracking-tight text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4"
                    >
                        Direct dispatch
                    </h1>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                        Create an operational draft when no upstream handoff
                        exists. Assignment and activation happen later.
                    </p>
                </div>
            </header>

            <div className="grid min-w-0 gap-5 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] lg:items-start">
                <form
                    onSubmit={handleSubmit}
                    noValidate
                    className="min-w-0 space-y-5 pb-[calc(6rem+env(safe-area-inset-bottom))]"
                >
                    <section
                        className="min-w-0 rounded-xl border border-line bg-surface-subtle p-4"
                        aria-labelledby="direct-dispatch-work-type-heading"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2
                                    id="direct-dispatch-work-type-heading"
                                    className="text-sm font-semibold text-ink"
                                >
                                    Work type
                                </h2>
                                <p className="mt-1 text-xs leading-5 text-ink-soft">
                                    Select the operational stream used to tailor
                                    the future job brief.
                                </p>
                            </div>
                            <span className="rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[11px] font-semibold text-ink-soft">
                                Reference prefix {intakeData.referencePrefix}
                            </span>
                        </div>

                        <div className="mt-4 grid min-w-0 gap-2.5 sm:grid-cols-2">
                            {DIRECT_DISPATCH_WORK_TYPES.map((workType) => {
                                const active =
                                    form.data.work_stream === workType.id;

                                return (
                                    <button
                                        key={workType.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() =>
                                            setWorkStream(workType.id)
                                        }
                                        className={cn(
                                            'flex min-h-11 min-w-0 flex-col items-start justify-center rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none',
                                            active
                                                ? 'border-brand-strong bg-brand-soft text-ink shadow-xs ring-1 ring-brand-strong/30'
                                                : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-surface-subtle',
                                        )}
                                    >
                                        <span className="text-sm font-semibold text-ink">
                                            {workType.title}
                                        </span>
                                        <span className="mt-0.5 text-xs leading-5">
                                            {workType.description}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {form.data.work_stream === 'service' && (
                            <fieldset className="mt-4 border-t border-line/70 pt-4">
                                <legend className="text-xs font-semibold text-ink">
                                    Equipment subtype
                                </legend>
                                <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                                    {DIRECT_DISPATCH_SUBTYPES.map((subtype) => {
                                        const active =
                                            form.data.equipment_subtype ===
                                            subtype.id;

                                        return (
                                            <button
                                                key={subtype.id}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() =>
                                                    setEquipmentSubtype(
                                                        subtype.id,
                                                    )
                                                }
                                                className={cn(
                                                    'inline-flex min-h-11 max-w-full items-center rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none',
                                                    active
                                                        ? 'border-brand-strong bg-brand-strong text-white'
                                                        : 'border-line-strong bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                                )}
                                            >
                                                {subtype.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>
                        )}
                    </section>

                    <section
                        className="min-w-0 rounded-xl border border-line bg-surface p-4"
                        aria-labelledby="direct-dispatch-details-heading"
                    >
                        <SectionHeading
                            id="direct-dispatch-details-heading"
                            title="Dispatch details"
                            description="Set the client, scope, site, schedule, and operational priority for this draft."
                        />

                        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
                            <div className="min-w-0 text-sm font-medium text-ink sm:col-span-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <label htmlFor="direct-dispatch-client">
                                        Client
                                        <span className="ml-1 text-danger">
                                            *
                                        </span>
                                    </label>
                                    {capabilities?.create_client &&
                                        onAddClient && (
                                            <button
                                                type="button"
                                                onClick={onAddClient}
                                                className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-brand-strong underline decoration-brand/40 underline-offset-2 transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
                                            >
                                                Client not found? Add client
                                            </button>
                                        )}
                                </div>
                                <input
                                    id="direct-dispatch-client"
                                    value={form.data.client}
                                    onChange={(event) =>
                                        form.setData(
                                            'client',
                                            event.target.value,
                                        )
                                    }
                                    list="direct-dispatch-client-options"
                                    placeholder="Enter or pick a client"
                                    required
                                    aria-invalid={
                                        form.errors.client ? 'true' : undefined
                                    }
                                    aria-describedby={
                                        form.errors.client
                                            ? 'direct-dispatch-client-error'
                                            : undefined
                                    }
                                    className={cn(
                                        'mt-1 h-11 w-full rounded-lg border bg-surface px-3 text-sm transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none',
                                        form.errors.client
                                            ? 'border-danger'
                                            : 'border-line-strong hover:border-ink-soft',
                                    )}
                                />
                                <datalist id="direct-dispatch-client-options">
                                    {clients.map((client) => (
                                        <option
                                            key={client.id}
                                            value={client.company_name}
                                        >
                                            {client.code} ·{' '}
                                            {client.company_name}
                                        </option>
                                    ))}
                                </datalist>
                                <FieldError
                                    id="direct-dispatch-client-error"
                                    error={form.errors.client}
                                />
                            </div>

                            <InputField
                                id="direct-dispatch-scope"
                                label="Dispatch title / scope"
                                value={form.data.title}
                                error={form.errors.title}
                                onChange={(value) =>
                                    form.setData('title', value)
                                }
                                placeholder={intakeData.titlePlaceholder}
                                required
                            />
                            <InputField
                                id="direct-dispatch-site"
                                label="Job site location"
                                value={form.data.site}
                                error={form.errors.site}
                                onChange={(value) =>
                                    form.setData('site', value)
                                }
                                placeholder="e.g. Jurong Island Berth 4"
                                required
                            />
                            <DateTimePicker
                                id="direct-dispatch-scheduled-start"
                                label="Scheduled start"
                                value={form.data.scheduled_start}
                                error={form.errors.scheduled_start}
                                onChange={(value) =>
                                    form.setData('scheduled_start', value)
                                }
                                required
                            />
                            <DateTimePicker
                                id="direct-dispatch-scheduled-end"
                                label="Scheduled end"
                                value={form.data.scheduled_end}
                                error={form.errors.scheduled_end}
                                onChange={(value) =>
                                    form.setData('scheduled_end', value)
                                }
                                required
                            />
                            <SelectField
                                id="direct-dispatch-priority"
                                label="Operational priority"
                                value={form.data.priority}
                                error={form.errors.priority}
                                onChange={(value) =>
                                    form.setData(
                                        'priority',
                                        value as DirectDispatchFormData['priority'],
                                    )
                                }
                                required
                            >
                                <option value="routine">Routine</option>
                                <option value="priority">Priority</option>
                                <option value="emergency">Emergency</option>
                            </SelectField>
                        </div>
                    </section>

                    <section
                        className="min-w-0 rounded-xl border border-line bg-surface p-4"
                        aria-labelledby="direct-dispatch-requirements-heading"
                    >
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                            <SectionHeading
                                id="direct-dispatch-requirements-heading"
                                title="Requirements to include in the job brief"
                                description={intakeData.requirementDescription}
                            />
                            <button
                                type="button"
                                onClick={toggleAllRecommended}
                                className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-brand-strong underline decoration-brand/40 underline-offset-2 transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
                            >
                                {intakeData.recommendedRequirements.every(
                                    (requirement) =>
                                        form.data.requirements.includes(
                                            requirement,
                                        ),
                                )
                                    ? 'Deselect recommended'
                                    : 'Select recommended'}
                            </button>
                        </div>

                        <p className="mt-3 rounded-lg border border-info-strong/30 bg-info-soft px-3 py-2.5 text-xs leading-5 text-info-strong">
                            These are requirements to include in a future job
                            brief. They are not completed inspections or proof
                            that a check has already happened.
                        </p>

                        <div
                            id="direct-dispatch-requirements"
                            tabIndex={-1}
                            className="mt-4 grid min-w-0 gap-2.5 sm:grid-cols-2"
                            aria-invalid={
                                form.errors.requirements ? 'true' : undefined
                            }
                            aria-describedby={[
                                'direct-dispatch-requirements-hint',
                                form.errors.requirements
                                    ? 'direct-dispatch-requirements-error'
                                    : null,
                            ]
                                .filter(Boolean)
                                .join(' ')}
                        >
                            <span
                                id="direct-dispatch-requirements-hint"
                                className="sr-only"
                            >
                                Recommended requirements are selected by
                                default. Use the checkboxes to adjust the future
                                job brief.
                            </span>
                            {intakeData.recommendedRequirements.map(
                                (requirement, index) => (
                                    <RequirementCheckbox
                                        key={requirement}
                                        id={`direct-dispatch-requirement-${index + 1}`}
                                        label={requirement}
                                        checked={form.data.requirements.includes(
                                            requirement,
                                        )}
                                        onChange={() =>
                                            toggleRequirement(requirement)
                                        }
                                    />
                                ),
                            )}
                        </div>

                        {form.errors.requirements && (
                            <FieldError
                                id="direct-dispatch-requirements-error"
                                error={form.errors.requirements}
                            />
                        )}

                        {customRequirements.length > 0 && (
                            <div className="mt-4 border-t border-line/70 pt-4">
                                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                    Custom requirements
                                </p>
                                <div className="mt-2 grid min-w-0 gap-2.5 sm:grid-cols-2">
                                    {customRequirements.map(
                                        (requirement, index) => (
                                            <div
                                                key={requirement}
                                                className="flex min-w-0 items-stretch gap-2"
                                            >
                                                <RequirementCheckbox
                                                    id={`direct-dispatch-custom-requirement-${index + 1}`}
                                                    label={requirement}
                                                    checked={form.data.requirements.includes(
                                                        requirement,
                                                    )}
                                                    onChange={() =>
                                                        toggleRequirement(
                                                            requirement,
                                                        )
                                                    }
                                                    className="min-w-0 flex-1"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeCustomRequirement(
                                                            requirement,
                                                        )
                                                    }
                                                    className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-danger-soft hover:text-danger-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
                                                    aria-label={`Remove custom requirement: ${requirement}`}
                                                >
                                                    <X
                                                        className="h-4 w-4"
                                                        aria-hidden="true"
                                                    />
                                                </button>
                                            </div>
                                        ),
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    <section
                        className="min-w-0 rounded-xl border border-line bg-surface p-4"
                        aria-labelledby="direct-dispatch-notes-heading"
                    >
                        <SectionHeading
                            id="direct-dispatch-notes-heading"
                            title="Optional custom requirements and site notes"
                            description="Add context for the future job brief without implying an inspection is complete."
                        />
                        <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
                            <label className="min-w-0 flex-1 text-sm font-medium text-ink">
                                Custom requirement
                                <input
                                    id="direct-dispatch-custom-requirement-input"
                                    value={customRequirement}
                                    onChange={(event) =>
                                        setCustomRequirement(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            addCustomRequirement();
                                        }
                                    }}
                                    placeholder="Add a requirement for the future job brief"
                                    className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm transition-colors placeholder:text-ink-soft focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
                                />
                            </label>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={addCustomRequirement}
                                className="shrink-0"
                            >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                Add requirement
                            </Button>
                        </div>
                        <TextAreaField
                            id="direct-dispatch-site-notes"
                            label="Site notes"
                            value={form.data.site_notes}
                            error={form.errors.site_notes}
                            onChange={(value) =>
                                form.setData('site_notes', value)
                            }
                            hint="Optional context for dispatch planning"
                            className="mt-4"
                            placeholder="Access notes, gate instructions, or other planning context"
                        />
                    </section>

                    <div className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 border-t border-line bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_20px_-18px_rgba(15,23,42,0.6)] backdrop-blur md:-mx-6 md:flex-row md:items-center md:justify-between md:px-6">
                        <button
                            type="button"
                            onClick={() => requestExit('back')}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Back to intake
                        </button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={form.processing}
                            className="w-full md:w-auto"
                        >
                            {form.processing
                                ? 'Creating draft dispatch…'
                                : 'Create draft dispatch'}
                        </Button>
                    </div>
                </form>

                <DirectDispatchSummary summary={summary} />
            </div>
        </section>
    );
}

function SectionHeading({
    id,
    title,
    description,
}: {
    id: string;
    title: string;
    description: string;
}) {
    return (
        <div className="min-w-0">
            <h2 id={id} className="text-sm font-semibold text-ink">
                {title}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-soft">
                {description}
            </p>
        </div>
    );
}

function InputField({
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
        <label
            className={cn('min-w-0 text-sm font-medium text-ink', className)}
        >
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
        <label
            className={cn('min-w-0 text-sm font-medium text-ink', className)}
        >
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
    ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
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
        <label
            className={cn('min-w-0 text-sm font-medium text-ink', className)}
        >
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
                rows={4}
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
                {...props}
            />
            <FieldError id={errorId} error={error} />
        </label>
    );
}

function RequirementCheckbox({
    id,
    label,
    checked,
    onChange,
    className,
}: {
    id: string;
    label: string;
    checked: boolean;
    onChange: () => void;
    className?: string;
}) {
    return (
        <label
            className={cn(
                'group flex min-h-[52px] min-w-0 cursor-pointer items-center gap-3 rounded-xl border p-3 text-left text-xs transition-colors focus-within:border-brand-strong focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2',
                checked
                    ? 'border-brand-strong bg-brand-soft/80 text-ink shadow-xs'
                    : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-surface-subtle',
                className,
            )}
        >
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="sr-only"
                aria-label={label}
                aria-checked={checked}
            />
            <span
                className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                    checked
                        ? 'border-brand-strong bg-brand-strong text-white'
                        : 'border-line-strong bg-surface group-hover:border-brand/60',
                )}
                aria-hidden="true"
            >
                {checked && (
                    <Check
                        className="h-3.5 w-3.5 stroke-[2.75]"
                        aria-hidden="true"
                    />
                )}
            </span>
            <span className="min-w-0 flex-1 leading-snug break-words text-ink">
                {label}
            </span>
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
