import { Link, useForm } from '@inertiajs/react';
import {
    CalendarDays,
    ChevronRight,
    ClipboardList,
    MapPin,
    Plus,
    Search,
    SearchX,
    UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
    Button,
    DataPair,
    EmptyState,
    PageHeading,
    Panel,
} from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { LiveDispatchIntake } from '@/components/workspace/live-dispatch-intake';
import { cn } from '@/lib/utils';
import type {
    ClientViewModel,
    DispatchJobViewModel,
    ServiceRequestViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

export function LiveDispatchWorkspace({
    jobs,
    clients,
    serviceRequests,
    capabilities,
    canCreate,
    refreshing,
}: {
    jobs: DispatchJobViewModel[];
    clients: ClientViewModel[];
    serviceRequests: ServiceRequestViewModel[];
    capabilities: WorkspaceCapabilities;
    canCreate: boolean;
    refreshing: boolean;
}) {
    const [query, setQuery] = useState('');
    const [selectedJobId, setSelectedJobId] = useState<number | null>(
        jobs[0]?.id ?? null,
    );
    const [showCreate, setShowCreate] = useState(false);
    const form = useForm({
        reference: '',
        client: '',
        title: '',
        site: '',
        scheduled_start: '',
        scheduled_end: '',
        priority: 'routine',
        requirements: [] as string[],
    });

    const filteredJobs = useMemo(() => {
        const normalized = query.trim().toLowerCase();

        if (normalized === '') {
            return jobs;
        }

        return jobs.filter((job) =>
            `${job.reference} ${job.client} ${job.title} ${job.site}`
                .toLowerCase()
                .includes(normalized),
        );
    }, [jobs, query]);

    const selectedJob =
        jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;
    const formComplete = [
        form.data.reference,
        form.data.client,
        form.data.title,
        form.data.site,
        form.data.scheduled_start,
        form.data.scheduled_end,
    ].every((value) => value.trim() !== '');

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/operations/dispatch-jobs', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setShowCreate(false);
            },
        });
    };

    return (
        <div>
            <PageHeading
                title="Dispatch workspace"
                description="Review live jobs, schedules, and assigned resources. Laravel remains authoritative for every visible record and write."
                actions={
                    canCreate ? (
                        <Button
                            variant={showCreate ? 'secondary' : 'primary'}
                            onClick={() => setShowCreate((value) => !value)}
                            aria-expanded={showCreate}
                            aria-controls="create-dispatch-panel"
                        >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            {showCreate ? 'Close form' : 'Create dispatch'}
                        </Button>
                    ) : undefined
                }
            />

            {(capabilities.create_client ||
                capabilities.create_service_request ||
                capabilities.convert_service_request) && (
                <LiveDispatchIntake
                    clients={clients}
                    serviceRequests={serviceRequests}
                    capabilities={capabilities}
                />
            )}

            {showCreate && canCreate && (
                <section
                    id="create-dispatch-panel"
                    className="border-b border-line bg-surface px-4 py-5 md:px-6"
                    aria-labelledby="create-dispatch-title"
                >
                    <div className="mb-4">
                        <h2
                            id="create-dispatch-title"
                            className="text-lg font-semibold"
                        >
                            New dispatch
                        </h2>
                        <p className="mt-1 text-sm text-ink-soft">
                            Create the live draft first. Assignment and
                            activation stay in their existing authorized
                            workflows.
                        </p>
                    </div>
                    <form
                        onSubmit={submit}
                        className="grid gap-4 lg:grid-cols-4"
                        noValidate
                    >
                        <DispatchInput
                            label="Reference"
                            value={form.data.reference}
                            error={form.errors.reference}
                            onChange={(value) =>
                                form.setData('reference', value)
                            }
                        />
                        <DispatchInput
                            label="Client"
                            value={form.data.client}
                            error={form.errors.client}
                            onChange={(value) => form.setData('client', value)}
                        />
                        <DispatchInput
                            label="Job title"
                            value={form.data.title}
                            error={form.errors.title}
                            onChange={(value) => form.setData('title', value)}
                        />
                        <DispatchInput
                            label="Site"
                            value={form.data.site}
                            error={form.errors.site}
                            onChange={(value) => form.setData('site', value)}
                        />
                        <DispatchInput
                            label="Start"
                            type="datetime-local"
                            value={form.data.scheduled_start}
                            error={form.errors.scheduled_start}
                            onChange={(value) =>
                                form.setData('scheduled_start', value)
                            }
                        />
                        <DispatchInput
                            label="End"
                            type="datetime-local"
                            value={form.data.scheduled_end}
                            error={form.errors.scheduled_end}
                            onChange={(value) =>
                                form.setData('scheduled_end', value)
                            }
                        />
                        <label className="text-sm font-medium text-ink">
                            Priority
                            <select
                                value={form.data.priority}
                                onChange={(event) =>
                                    form.setData('priority', event.target.value)
                                }
                                aria-invalid={
                                    form.errors.priority ? 'true' : undefined
                                }
                                className={cn(
                                    'mt-1 h-11 w-full rounded-lg border bg-surface px-3',
                                    form.errors.priority
                                        ? 'border-danger'
                                        : 'border-line-strong',
                                )}
                            >
                                <option value="routine">Routine</option>
                                <option value="priority">Priority</option>
                                <option value="emergency">Emergency</option>
                            </select>
                            {form.errors.priority && (
                                <span className="mt-1 block text-xs text-danger">
                                    {form.errors.priority}
                                </span>
                            )}
                        </label>
                        <div className="flex flex-col justify-end">
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={form.processing || !formComplete}
                            >
                                {form.processing
                                    ? 'Creating dispatch…'
                                    : 'Create live draft'}
                            </Button>
                            {!formComplete && !form.processing && (
                                <p className="mt-1 text-xs text-ink-soft">
                                    Complete every required field to continue.
                                </p>
                            )}
                        </div>
                    </form>
                </section>
            )}

            <div className="grid min-h-[calc(100vh-9rem)] lg:grid-cols-[19rem_minmax(0,1fr)]">
                <aside className="border-b border-line bg-surface lg:border-r lg:border-b-0">
                    <div className="border-b border-line p-4">
                        <label className="relative block">
                            <span className="sr-only">
                                Search live dispatches
                            </span>
                            <Search
                                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
                                aria-hidden="true"
                            />
                            <input
                                type="search"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder="Search jobs, clients, sites"
                                className="h-11 w-full rounded-lg border border-line-strong bg-surface-subtle pr-3 pl-9 text-sm placeholder:text-ink-soft"
                            />
                        </label>
                        <p className="mt-2 text-xs text-ink-soft" role="status">
                            {refreshing
                                ? 'Refreshing live jobs…'
                                : `${filteredJobs.length} of ${jobs.length} jobs`}
                        </p>
                    </div>

                    {refreshing ? (
                        <DispatchListSkeleton />
                    ) : filteredJobs.length === 0 ? (
                        query.trim() === '' ? (
                            <EmptyState
                                compact
                                icon={ClipboardList}
                                title="No dispatch jobs available"
                                message={
                                    canCreate
                                        ? 'Create a live draft to begin the dispatch workflow.'
                                        : 'Jobs assigned or visible to your account will appear here.'
                                }
                                primaryAction={
                                    canCreate ? (
                                        <Button
                                            variant="primary"
                                            onClick={() => setShowCreate(true)}
                                        >
                                            Create dispatch
                                        </Button>
                                    ) : undefined
                                }
                            />
                        ) : (
                            <EmptyState
                                compact
                                icon={SearchX}
                                title="No matching dispatches"
                                message="Try a reference, client, title, or site."
                                primaryAction={
                                    <Button
                                        variant="secondary"
                                        onClick={() => setQuery('')}
                                    >
                                        Clear search
                                    </Button>
                                }
                            />
                        )
                    ) : (
                        <ul className="divide-y divide-line">
                            {filteredJobs.map((job) => (
                                <li key={job.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedJobId(job.id)}
                                        className={cn(
                                            'flex min-h-24 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle',
                                            job.id === selectedJob?.id &&
                                                'bg-brand-soft',
                                        )}
                                        aria-current={
                                            job.id === selectedJob?.id
                                                ? 'true'
                                                : undefined
                                        }
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="font-semibold">
                                                    {job.reference}
                                                </p>
                                                <CanonicalStatusBadge
                                                    status={job.priority}
                                                />
                                            </div>
                                            <p className="mt-1 truncate text-sm">
                                                {job.title}
                                            </p>
                                            <p className="mt-1 truncate text-xs text-ink-soft">
                                                {job.client} ·{' '}
                                                {formatDateTime(
                                                    job.scheduled_start,
                                                )}
                                            </p>
                                        </div>
                                        <ChevronRight
                                            className="mt-1 h-4 w-4 shrink-0 text-ink-soft"
                                            aria-hidden="true"
                                        />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>

                <section className="min-w-0 bg-canvas p-4 md:p-6">
                    {selectedJob ? (
                        <DispatchDetails job={selectedJob} />
                    ) : (
                        <Panel>
                            <EmptyState
                                icon={ClipboardList}
                                title="Select a dispatch"
                                message="Choose a live job from the list to review its schedule, site, and assignments."
                            />
                        </Panel>
                    )}
                </section>
            </div>
        </div>
    );
}

function DispatchDetails({ job }: { job: DispatchJobViewModel }) {
    const assignments = [
        ...job.personnel_assignments.map((assignment) => ({
            id: `person-${assignment.id}`,
            primary: assignment.name,
            secondary: humanize(assignment.type),
            icon: UserRound,
        })),
        ...job.asset_assignments.map((assignment) => ({
            id: `asset-${assignment.id}`,
            primary: `${assignment.code} · ${assignment.name}`,
            secondary: humanize(assignment.type),
            icon: ClipboardList,
        })),
    ];

    return (
        <div className="mx-auto max-w-5xl">
            <div className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold tracking-[-0.02em]">
                            {job.title}
                        </h2>
                        <CanonicalStatusBadge status={job.status} />
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                        {job.reference} · {job.client}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <CanonicalStatusBadge status={job.priority} />
                    <span className="inline-flex min-h-6 items-center rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                        Version {job.version}
                    </span>
                    <Link
                        href={`/operations/dispatch-jobs/${job.id}`}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-subtle"
                    >
                        Open assignment workspace
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
                <Panel className="p-4">
                    <h3 className="font-semibold">Dispatch context</h3>
                    <dl className="mt-3 divide-y divide-line">
                        <DataPair
                            label="Schedule"
                            value={`${formatDateTime(job.scheduled_start)} – ${formatDateTime(job.scheduled_end)}`}
                        />
                        <DataPair
                            label="Site"
                            value={
                                <span className="inline-flex items-start gap-2">
                                    <MapPin
                                        className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft"
                                        aria-hidden="true"
                                    />
                                    {job.site}
                                </span>
                            }
                        />
                        <DataPair
                            label="Last updated"
                            value={formatDateTime(job.updated_at)}
                        />
                    </dl>
                    <div className="mt-4 rounded-lg bg-surface-subtle p-3">
                        <p className="text-xs font-semibold">Site note</p>
                        <p className="mt-1 text-sm leading-6 text-ink-soft">
                            {job.site_notes?.trim() ||
                                'No additional site instructions were recorded.'}
                        </p>
                    </div>
                </Panel>

                <Panel className="overflow-hidden">
                    <div className="border-b border-line px-4 py-3">
                        <h3 className="font-semibold">Assigned resources</h3>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Current server-backed personnel and assets
                        </p>
                    </div>
                    {assignments.length === 0 ? (
                        <EmptyState
                            compact
                            icon={UserRound}
                            title="No resources assigned"
                            message="Assignments will appear after the authorized scheduling workflow completes."
                        />
                    ) : (
                        <ul className="divide-y divide-line">
                            {assignments.map((assignment) => {
                                const Icon = assignment.icon;

                                return (
                                    <li
                                        key={assignment.id}
                                        className="flex items-start gap-3 px-4 py-3"
                                    >
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft">
                                            <Icon
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">
                                                {assignment.primary}
                                            </p>
                                            <p className="mt-0.5 text-xs text-ink-soft">
                                                {assignment.secondary}
                                            </p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Panel>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
                <CalendarDays
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong"
                    aria-hidden="true"
                />
                <p className="leading-6 text-ink-soft">
                    Open the assignment workspace to review server-authoritative
                    availability, credentials, maintenance blocks, readiness,
                    and schedule conflicts before confirming resources.
                </p>
            </div>
        </div>
    );
}

function DispatchInput({
    label,
    value,
    onChange,
    error,
    type = 'text',
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
}) {
    const errorId = `dispatch-${label.toLowerCase().replaceAll(' ', '-')}-error`;

    return (
        <label className="text-sm font-medium text-ink">
            {label}
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? errorId : undefined}
                className={cn(
                    'mt-1 h-11 w-full rounded-lg border bg-surface px-3',
                    error ? 'border-danger' : 'border-line-strong',
                )}
            />
            {error && (
                <span id={errorId} className="mt-1 block text-xs text-danger">
                    {error}
                </span>
            )}
        </label>
    );
}

function DispatchListSkeleton() {
    return (
        <div className="space-y-px" aria-label="Loading dispatch jobs">
            {[1, 2, 3].map((item) => (
                <div
                    key={item}
                    className="animate-pulse border-b border-line px-4 py-4"
                >
                    <div className="h-3 w-24 rounded bg-line" />
                    <div className="mt-3 h-3 w-40 rounded bg-line" />
                    <div className="mt-3 h-2.5 w-32 rounded bg-surface-subtle" />
                </div>
            ))}
        </div>
    );
}

function formatDateTime(value: string | null) {
    if (value === null) {
        return 'Not scheduled';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function humanize(value: string) {
    return value.replaceAll('_', ' ');
}
