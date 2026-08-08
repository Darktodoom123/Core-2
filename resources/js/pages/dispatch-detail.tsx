import type { Page } from '@inertiajs/core';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    CalendarDays,
    Check,
    CheckCircle2,
    Circle,
    ClipboardList,
    Clock3,
    HardHat,
    MapPin,
    Navigation,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Truck,
    UserRound,
    Wrench,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, DataPair, EmptyState, Panel, Skeleton } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { cn } from '@/lib/utils';
import type {
    AssetCandidateViewModel,
    DispatchDetailPageProps,
    PersonnelCandidateViewModel,
} from '@/types/workspace';

interface AssignmentRequestPayload {
    personnel: Array<{
        user_id: number;
        assignment_type: PersonnelCandidateViewModel['assignment_type'];
    }>;
    assets: Array<{
        operational_asset_id: number;
        assignment_type: AssetCandidateViewModel['assignment_type'];
    }>;
}

export default function DispatchDetail({
    job,
    personnel_candidates: personnelCandidates,
    asset_candidates: assetCandidates,
    activation,
    progression,
    capabilities,
}: DispatchDetailPageProps) {
    const { flash, errors } = usePage().props;
    const form = useForm<AssignmentRequestPayload>({
        personnel: [],
        assets: [],
    });
    const selectedCount = form.data.personnel.length + form.data.assets.length;
    const conflictMessage =
        errors.resources ??
        errors.reassignment ??
        errors.approval ??
        errors.version ??
        form.errors.personnel ??
        form.errors.assets ??
        null;

    const togglePersonnel = (candidate: PersonnelCandidateViewModel) => {
        const selected = form.data.personnel.some(
            (assignment) => assignment.user_id === candidate.id,
        );
        form.setData(
            'personnel',
            selected
                ? form.data.personnel.filter(
                      (assignment) => assignment.user_id !== candidate.id,
                  )
                : [
                      ...form.data.personnel,
                      {
                          user_id: candidate.id,
                          assignment_type: candidate.assignment_type,
                      },
                  ],
        );
    };

    const toggleAsset = (candidate: AssetCandidateViewModel) => {
        const selected = form.data.assets.some(
            (assignment) => assignment.operational_asset_id === candidate.id,
        );
        form.setData(
            'assets',
            selected
                ? form.data.assets.filter(
                      (assignment) =>
                          assignment.operational_asset_id !== candidate.id,
                  )
                : [
                      ...form.data.assets,
                      {
                          operational_asset_id: candidate.id,
                          assignment_type: candidate.assignment_type,
                      },
                  ],
        );
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(`/operations/dispatch-jobs/${job.id}/assignments`, {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <>
            <Head
                title={`${job.reference} ${capabilities.update_own_status ? 'assigned job' : 'assignment workspace'}`}
            />
            <div className="min-h-screen bg-canvas">
                <header className="border-b border-line bg-surface">
                    <div className="mx-auto max-w-[96rem] px-4 py-4 md:px-6">
                        <Link
                            href="/"
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-soft hover:bg-surface-subtle hover:text-ink"
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            {capabilities.update_own_status
                                ? "Back to today's work"
                                : 'Back to dispatch workspace'}
                        </Link>
                        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-2xl font-semibold tracking-[-0.02em]">
                                        {job.title}
                                    </h1>
                                    <CanonicalStatusBadge status={job.status} />
                                </div>
                                <p className="mt-1 text-sm text-ink-soft">
                                    {job.reference} · {job.client}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <CanonicalStatusBadge status={job.priority} />
                                <span className="inline-flex min-h-6 items-center rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                                    Version {job.version}
                                </span>
                                {capabilities.request_gpt_assistance && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            router.post(
                                                '/operations/gpt-recommendations',
                                                {
                                                    subject_type:
                                                        'dispatch_job',
                                                    subject_id: job.id,
                                                    purpose:
                                                        'dispatch_assignment',
                                                },
                                            );
                                        }}
                                    >
                                        <Sparkles className="h-4 w-4 text-amber-500" />
                                        Request AI Assistance
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-[96rem] space-y-5 px-4 py-5 md:px-6">
                    {flash && (
                        <div
                            className={cn(
                                'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
                                flash.tone === 'success' &&
                                    'border-success bg-success-soft text-success-strong',
                                flash.tone === 'warning' &&
                                    'border-warning bg-warning-soft text-warning-strong',
                                flash.tone === 'error' &&
                                    'border-danger bg-danger-soft text-danger',
                                flash.tone === 'info' &&
                                    'border-info bg-info-soft text-info-strong',
                            )}
                            role="status"
                        >
                            <Check
                                className="mt-0.5 h-4 w-4 shrink-0"
                                aria-hidden="true"
                            />
                            {flash.message}
                        </div>
                    )}

                    {conflictMessage && (
                        <div
                            className="flex items-start gap-3 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm text-danger"
                            role="alert"
                        >
                            <AlertTriangle
                                className="mt-0.5 h-4 w-4 shrink-0"
                                aria-hidden="true"
                            />
                            <div>
                                <p className="font-semibold">
                                    Assignment could not be saved
                                </p>
                                <p className="mt-1">{conflictMessage}</p>
                                <p className="mt-1 text-xs">
                                    Eligibility was rechecked against the
                                    current schedule. Review the resource state
                                    below and try again.
                                </p>
                            </div>
                        </div>
                    )}

                    {capabilities.update_own_status && progression !== null ? (
                        <FieldJobWorkspace
                            job={job}
                            progression={progression}
                            capabilities={capabilities}
                        />
                    ) : (
                        <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)]">
                            <div className="space-y-5">
                                <DispatchContext job={job} />
                                <CurrentAssignments
                                    job={job}
                                    capabilities={capabilities}
                                />
                                {capabilities.activate && (
                                    <ActivationPanel
                                        key={job.version}
                                        job={job}
                                        activation={activation}
                                    />
                                )}
                                <LifecycleControlsPanel
                                    key={`lifecycle-${job.version}`}
                                    job={job}
                                    capabilities={capabilities}
                                />
                            </div>

                            {capabilities.view_assignment_candidates ? (
                                <form
                                    onSubmit={submit}
                                    className="space-y-5"
                                    noValidate
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold">
                                                Resource eligibility
                                            </h2>
                                            <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                                                Availability, credential
                                                validity, asset readiness,
                                                maintenance, and overlapping
                                                schedules are computed by the
                                                server for this dispatch window.
                                            </p>
                                        </div>
                                        {capabilities.assign_resources && (
                                            <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
                                                <Button
                                                    type="submit"
                                                    variant="primary"
                                                    disabled={
                                                        form.processing ||
                                                        selectedCount === 0
                                                    }
                                                >
                                                    {form.processing
                                                        ? 'Assigning resources…'
                                                        : selectedCount > 0
                                                          ? `Assign ${selectedCount} resource${selectedCount === 1 ? '' : 's'}`
                                                          : 'Assign resources'}
                                                </Button>
                                                {selectedCount === 0 &&
                                                    !form.processing && (
                                                        <span className="text-xs text-ink-soft">
                                                            Select at least one
                                                            eligible resource.
                                                        </span>
                                                    )}
                                            </div>
                                        )}
                                    </div>

                                    <PersonnelCandidates
                                        candidates={personnelCandidates}
                                        selectedIds={form.data.personnel.map(
                                            (assignment) => assignment.user_id,
                                        )}
                                        canAssign={
                                            capabilities.assign_resources
                                        }
                                        onToggle={togglePersonnel}
                                    />
                                    <AssetCandidates
                                        candidates={assetCandidates}
                                        selectedIds={form.data.assets.map(
                                            (assignment) =>
                                                assignment.operational_asset_id,
                                        )}
                                        canAssign={
                                            capabilities.assign_resources
                                        }
                                        onToggle={toggleAsset}
                                    />
                                </form>
                            ) : (
                                <Panel>
                                    <EmptyState
                                        icon={ShieldCheck}
                                        title="Assignment pool is restricted"
                                        message="Your role can review resources already assigned to this dispatch, but it cannot discover other personnel, credentials, or asset availability."
                                    />
                                </Panel>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}

function FieldJobWorkspace({
    job,
    progression,
    capabilities,
}: {
    job: DispatchDetailPageProps['job'];
    progression: NonNullable<DispatchDetailPageProps['progression']>;
    capabilities: DispatchDetailPageProps['capabilities'];
}) {
    return (
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
            <div className="space-y-5">
                <FieldProgressionPanel job={job} progression={progression} />
                <RequirementsPanel requirements={job.requirements} />
            </div>
            <div className="space-y-5">
                <DispatchContext job={job} />
                <CurrentAssignments job={job} capabilities={capabilities} />
            </div>
        </div>
    );
}

function FieldProgressionPanel({
    job,
    progression,
}: {
    job: DispatchDetailPageProps['job'];
    progression: NonNullable<DispatchDetailPageProps['progression']>;
}) {
    const next = progression.next;
    const form = useForm({
        status: next?.status.value ?? progression.current.value,
        version: job.version,
    });
    const [confirming, setConfirming] = useState(false);
    const [attempted, setAttempted] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const confirmationHeading = useRef<HTMLHeadingElement>(null);
    const progressionHeading = useRef<HTMLHeadingElement>(null);
    const error = attempted
        ? (form.errors.version ?? form.errors.status ?? null)
        : null;
    const isStale = attempted && form.errors.version !== undefined;
    const isCompleted = progression.current.value === 'completed';

    useEffect(() => {
        if (confirming) {
            confirmationHeading.current?.focus();
        }
    }, [confirming]);

    const focusProgression = () => {
        requestAnimationFrame(() => progressionHeading.current?.focus());
    };

    const syncFormFromPage = (page: Page) => {
        const refreshedJob = page.props.job as DispatchDetailPageProps['job'];
        const refreshedProgression = page.props
            .progression as DispatchDetailPageProps['progression'];

        form.setData({
            status:
                refreshedProgression?.next?.status.value ??
                refreshedProgression?.current.value ??
                refreshedJob.status.value,
            version: refreshedJob.version,
        });
    };

    const advance = () => {
        if (next === null) {
            return;
        }

        form.post(`/operations/dispatch-jobs/${job.id}/status`, {
            preserveScroll: true,
            onStart: () => setAttempted(true),
            onSuccess: (page) => {
                syncFormFromPage(page);
                setAttempted(false);
                setConfirming(false);
                focusProgression();
            },
        });
    };

    const refresh = () => {
        setRefreshing(true);
        router.reload({
            only: ['job', 'progression', 'capabilities'],
            onSuccess: (page) => {
                syncFormFromPage(page);
                form.clearErrors();
                setAttempted(false);
                setConfirming(false);
                focusProgression();
            },
            onFinish: () => setRefreshing(false),
        });
    };

    const cancelConfirmation = () => {
        setConfirming(false);
        requestAnimationFrame(() => {
            const target =
                error === null
                    ? `field-next-action-${job.id}`
                    : `field-refresh-action-${job.id}`;

            document.getElementById(target)?.focus();
        });
    };

    return (
        <Panel
            className="overflow-hidden"
            aria-busy={form.processing || refreshing}
        >
            <div className="border-b border-line px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2
                            ref={progressionHeading}
                            tabIndex={-1}
                            className="rounded text-lg font-semibold"
                        >
                            Field progression
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
                            {progression.message}
                        </p>
                    </div>
                    <CanonicalStatusBadge status={progression.current} />
                </div>
            </div>

            <div className="space-y-5 px-4 py-5 sm:px-5">
                <ol
                    className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3"
                    aria-label="Dispatch field status"
                >
                    {progression.steps.map((step) => (
                        <li
                            key={step.status.value}
                            className="flex min-w-0 items-center gap-2"
                            aria-current={
                                step.state === 'current' ? 'step' : undefined
                            }
                        >
                            <span
                                className={cn(
                                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                                    step.state === 'complete' &&
                                        'border-success bg-success-soft text-success-strong',
                                    step.state === 'current' &&
                                        'border-brand bg-brand text-brand-contrast',
                                    step.state === 'upcoming' &&
                                        'border-line-strong bg-surface text-ink-soft',
                                )}
                            >
                                {step.state === 'complete' ? (
                                    <Check
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                ) : step.state === 'current' ? (
                                    <Navigation
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Circle
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                )}
                            </span>
                            <span className="min-w-0 text-sm">
                                <span className="block truncate font-medium">
                                    {step.status.label}
                                </span>
                                <span className="block text-xs text-ink-soft">
                                    {step.state === 'complete'
                                        ? 'Done'
                                        : step.state === 'current'
                                          ? 'Current'
                                          : 'Later'}
                                </span>
                            </span>
                        </li>
                    ))}
                </ol>

                {error && (
                    <div
                        className="rounded-lg border border-danger bg-danger-soft p-4 text-sm text-danger"
                        role="alert"
                    >
                        <div className="flex items-start gap-2">
                            <AlertTriangle
                                className="mt-0.5 h-4 w-4 shrink-0"
                                aria-hidden="true"
                            />
                            <div>
                                <p className="font-semibold">
                                    {isStale
                                        ? 'Job changed - refresh before continuing'
                                        : 'Status was not updated'}
                                </p>
                                <p className="mt-1 leading-5">{error}</p>
                            </div>
                        </div>
                        <Button
                            id={`field-refresh-action-${job.id}`}
                            className="mt-3"
                            variant="secondary"
                            onClick={refresh}
                            disabled={form.processing || refreshing}
                        >
                            <RefreshCw
                                className={cn(
                                    'h-4 w-4',
                                    refreshing && 'animate-spin',
                                )}
                                aria-hidden="true"
                            />
                            {refreshing
                                ? 'Refreshing job...'
                                : isStale
                                  ? 'Refresh and review'
                                  : 'Review current job'}
                        </Button>
                    </div>
                )}

                {next === null ? (
                    <div
                        className={cn(
                            'flex items-start gap-3 rounded-lg p-4',
                            isCompleted
                                ? 'bg-success-soft text-success-strong'
                                : 'bg-surface-subtle text-ink',
                        )}
                    >
                        {isCompleted ? (
                            <CheckCircle2
                                className="mt-0.5 h-5 w-5 shrink-0"
                                aria-hidden="true"
                            />
                        ) : (
                            <Clock3
                                className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft"
                                aria-hidden="true"
                            />
                        )}
                        <div>
                            <p className="font-semibold">
                                {isCompleted
                                    ? 'Field progression complete'
                                    : 'No field action available'}
                            </p>
                            <p className="mt-1 text-sm leading-5">
                                {progression.message}
                            </p>
                        </div>
                    </div>
                ) : confirming ? (
                    <div
                        className="rounded-xl border border-line-strong bg-surface-subtle p-4"
                        role="group"
                        aria-labelledby="field-confirmation-title"
                    >
                        <h3
                            ref={confirmationHeading}
                            id="field-confirmation-title"
                            tabIndex={-1}
                            className="rounded font-semibold"
                        >
                            {next.confirmation_title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-ink-soft">
                            {next.confirmation_message}
                        </p>
                        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                                variant="quiet"
                                onClick={cancelConfirmation}
                                disabled={form.processing}
                            >
                                Keep current status
                            </Button>
                            <Button
                                variant="primary"
                                onClick={advance}
                                disabled={
                                    form.processing ||
                                    refreshing ||
                                    error !== null
                                }
                            >
                                {form.processing
                                    ? `Updating to ${next.status.label}...`
                                    : `Confirm ${next.status.label}`}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="mobile-safe-bottom border-t border-line pt-4">
                        <p className="mb-3 text-sm text-ink-soft">
                            Next valid step:{' '}
                            <span className="font-semibold text-ink">
                                {next.status.label}
                            </span>
                        </p>
                        <Button
                            id={`field-next-action-${job.id}`}
                            className="w-full sm:w-auto"
                            variant="primary"
                            onClick={() => setConfirming(true)}
                            disabled={
                                form.processing || refreshing || error !== null
                            }
                        >
                            {next.action_label}
                        </Button>
                    </div>
                )}
            </div>
        </Panel>
    );
}

function RequirementsPanel({ requirements }: { requirements: string[] }) {
    return (
        <Panel className="overflow-hidden">
            <div className="border-b border-line px-4 py-3 sm:px-5">
                <h2 className="font-semibold">Job requirements</h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                    Review before leaving for the site.
                </p>
            </div>
            {requirements.length === 0 ? (
                <EmptyState
                    compact
                    icon={ClipboardList}
                    title="No additional requirements"
                    message="Follow the site note and your standard safety procedure."
                />
            ) : (
                <ul className="divide-y divide-line">
                    {requirements.map((requirement) => (
                        <li
                            key={requirement}
                            className="flex items-start gap-3 px-4 py-3 text-sm sm:px-5"
                        >
                            <Check
                                className="mt-0.5 h-4 w-4 shrink-0 text-success-strong"
                                aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">
                                {requirement}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

function ActivationPanel({
    job,
    activation,
}: {
    job: DispatchDetailPageProps['job'];
    activation: DispatchDetailPageProps['activation'];
}) {
    const form = useForm({ version: job.version });
    const { errors } = usePage().props;
    const [attempted, setAttempted] = useState(false);
    const error = attempted
        ? (errors.version ??
          errors.approval ??
          errors.status ??
          errors.personnel ??
          errors.assets ??
          null)
        : null;
    const isStale = attempted && errors.version !== undefined;

    const activate = () => {
        form.post(`/operations/dispatch-jobs/${job.id}/activate`, {
            preserveScroll: true,
            onStart: () => setAttempted(true),
        });
    };

    const refresh = () => {
        setAttempted(false);
        form.clearErrors();
        router.reload({
            only: ['job', 'activation', 'capabilities'],
        });
    };

    return (
        <Panel className="overflow-hidden">
            <div className="border-b border-line px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="font-semibold">Dispatch activation</h2>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Version {job.version} will be rechecked with current
                            approval and asset safety.
                        </p>
                    </div>
                    <span
                        className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-medium',
                            activation.ready
                                ? 'bg-success-soft text-success-strong'
                                : 'bg-warning-soft text-warning-strong',
                        )}
                    >
                        {activation.ready ? 'Ready' : 'Review needed'}
                    </span>
                </div>
            </div>

            <div className="space-y-4 px-4 py-4">
                {activation.approval_required && (
                    <div className="rounded-lg bg-surface-subtle p-3 text-sm">
                        <p className="font-medium">Independent approval</p>
                        <p className="mt-1 text-ink-soft">
                            {activation.approval_status === 'approved'
                                ? 'The latest exceptional request is approved.'
                                : activation.approval_status === 'rejected'
                                  ? 'The latest exceptional request was rejected.'
                                  : 'An Operations Manager decision is pending.'}
                        </p>
                    </div>
                )}

                {activation.blockers.length > 0 && (
                    <ul className="space-y-2 text-sm text-warning-strong">
                        {activation.blockers.map((blocker) => (
                            <li
                                key={blocker}
                                className="flex items-start gap-2"
                            >
                                <AlertTriangle
                                    className="mt-0.5 h-4 w-4 shrink-0"
                                    aria-hidden="true"
                                />
                                {blocker}
                            </li>
                        ))}
                    </ul>
                )}

                {error && (
                    <div
                        className="rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger"
                        role="alert"
                    >
                        <p className="font-semibold">
                            {isStale
                                ? 'Dispatch changed — refresh before activating'
                                : 'Activation was blocked'}
                        </p>
                        <p className="mt-1">{error}</p>
                        {isStale && (
                            <Button
                                className="mt-3"
                                variant="secondary"
                                size="sm"
                                onClick={refresh}
                            >
                                <RefreshCw
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Refresh and review
                            </Button>
                        )}
                    </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                        variant="quiet"
                        size="sm"
                        onClick={refresh}
                        disabled={form.processing}
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Refresh readiness
                    </Button>
                    <Button
                        variant="primary"
                        onClick={activate}
                        disabled={form.processing || !activation.ready}
                    >
                        {form.processing
                            ? 'Activating dispatch…'
                            : 'Activate dispatch'}
                    </Button>
                </div>
            </div>
        </Panel>
    );
}

function LifecycleControlsPanel({
    job,
    capabilities,
}: {
    job: DispatchDetailPageProps['job'];
    capabilities: DispatchDetailPageProps['capabilities'];
}) {
    const [cancelling, setCancelling] = useState(false);
    const [reopening, setReopening] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const cancelForm = useForm({
        reason: '',
        version: job.version,
    });

    const reopenForm = useForm({
        reason: '',
        version: job.version,
    });

    const archiveForm = useForm({
        reason: '',
    });

    const cancelErrors = cancelForm.errors as Record<
        string,
        string | undefined
    >;
    const reopenErrors = reopenForm.errors as Record<
        string,
        string | undefined
    >;
    const archiveErrors = archiveForm.errors as Record<
        string,
        string | undefined
    >;
    const cancelError = cancelErrors.version ?? cancelErrors.status ?? null;
    const reopenError = reopenErrors.version ?? reopenErrors.status ?? null;
    const archiveError = archiveErrors.status ?? null;
    const archiveBlocked = [
        'dispatched',
        'accepted',
        'en_route',
        'arrived',
        'working',
    ].includes(job.status.value);

    const hasControls =
        capabilities.cancel || capabilities.reopen || capabilities.archive;

    if (!hasControls) {
        return null;
    }

    const handleCancel = (e: FormEvent) => {
        e.preventDefault();
        cancelForm.post(`/operations/dispatch-jobs/${job.id}/cancel`, {
            preserveScroll: true,
            onSuccess: () => setCancelling(false),
        });
    };

    const handleReopen = (e: FormEvent) => {
        e.preventDefault();
        reopenForm.post(`/operations/dispatch-jobs/${job.id}/reopen`, {
            preserveScroll: true,
            onSuccess: () => setReopening(false),
        });
    };

    const handleArchive = (e: FormEvent) => {
        e.preventDefault();
        archiveForm.post(`/operations/dispatch-jobs/${job.id}/archive`, {
            preserveScroll: true,
            onSuccess: () => setArchiving(false),
        });
    };

    const refresh = () => {
        setRefreshing(true);
        router.reload({
            onFinish: () => setRefreshing(false),
        });
    };

    return (
        <Panel
            className="overflow-hidden"
            aria-busy={
                cancelForm.processing ||
                reopenForm.processing ||
                archiveForm.processing ||
                refreshing
            }
        >
            <div className="border-b border-line px-4 py-3 sm:px-5">
                <h2 className="font-semibold">Job lifecycle actions</h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                    Administrative lifecycle management (cancellation,
                    reopening, archive).
                </p>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5">
                {cancelling ? (
                    <form onSubmit={handleCancel} className="space-y-3">
                        <h3 className="text-sm font-semibold text-danger">
                            Cancel dispatch job
                        </h3>
                        <p className="text-xs text-ink-soft">
                            Cancelling this job will end all active personnel
                            and asset assignments safely.
                        </p>
                        {cancelError && (
                            <div
                                className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
                                role="alert"
                            >
                                <p>{cancelError}</p>
                                {cancelErrors.version && (
                                    <Button
                                        type="button"
                                        variant="quiet"
                                        className="mt-2 text-danger"
                                        onClick={refresh}
                                        disabled={refreshing}
                                    >
                                        {refreshing
                                            ? 'Refreshing...'
                                            : 'Refresh current job'}
                                    </Button>
                                )}
                            </div>
                        )}
                        <div>
                            <label
                                htmlFor="cancel-reason"
                                className="block text-xs font-medium text-ink"
                            >
                                Cancellation reason (required)
                            </label>
                            <textarea
                                id="cancel-reason"
                                rows={3}
                                className="mt-1 block w-full rounded-md border-line text-sm shadow-sm focus:border-danger focus:ring-danger"
                                value={cancelForm.data.reason}
                                onChange={(e) =>
                                    cancelForm.setData('reason', e.target.value)
                                }
                                placeholder="Explain why this dispatch is being cancelled..."
                                required
                                aria-invalid={
                                    cancelForm.errors.reason
                                        ? 'true'
                                        : undefined
                                }
                                aria-describedby={
                                    cancelForm.errors.reason
                                        ? 'cancel-reason-error'
                                        : undefined
                                }
                            />
                            {cancelForm.errors.reason && (
                                <p
                                    id="cancel-reason-error"
                                    className="mt-1 text-xs text-danger"
                                    role="alert"
                                >
                                    {cancelForm.errors.reason}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="submit"
                                variant="primary"
                                className="bg-danger text-white hover:bg-danger/90"
                                disabled={
                                    cancelForm.processing ||
                                    !cancelForm.data.reason.trim()
                                }
                            >
                                {cancelForm.processing
                                    ? 'Cancelling...'
                                    : 'Confirm cancellation'}
                            </Button>
                            <Button
                                type="button"
                                variant="quiet"
                                onClick={() => setCancelling(false)}
                                disabled={cancelForm.processing}
                            >
                                Dismiss
                            </Button>
                        </div>
                    </form>
                ) : reopening ? (
                    <form onSubmit={handleReopen} className="space-y-3">
                        <h3 className="text-sm font-semibold">
                            Reopen dispatch job
                        </h3>
                        <p className="text-xs text-ink-soft">
                            Reopening will return this job to draft status so
                            resources can be re-assigned and re-activated.
                        </p>
                        {reopenError && (
                            <div
                                className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
                                role="alert"
                            >
                                <p>{reopenError}</p>
                                {reopenErrors.version && (
                                    <Button
                                        type="button"
                                        variant="quiet"
                                        className="mt-2 text-danger"
                                        onClick={refresh}
                                        disabled={refreshing}
                                    >
                                        {refreshing
                                            ? 'Refreshing...'
                                            : 'Refresh current job'}
                                    </Button>
                                )}
                            </div>
                        )}
                        <div>
                            <label
                                htmlFor="reopen-reason"
                                className="block text-xs font-medium text-ink"
                            >
                                Reopen reason (optional)
                            </label>
                            <textarea
                                id="reopen-reason"
                                rows={2}
                                className="mt-1 block w-full rounded-md border-line text-sm shadow-sm"
                                value={reopenForm.data.reason}
                                onChange={(e) =>
                                    reopenForm.setData('reason', e.target.value)
                                }
                                placeholder="Reason for reopening cancelled dispatch..."
                                aria-invalid={
                                    reopenForm.errors.reason
                                        ? 'true'
                                        : undefined
                                }
                                aria-describedby={
                                    reopenForm.errors.reason
                                        ? 'reopen-reason-error'
                                        : undefined
                                }
                            />
                            {reopenForm.errors.reason && (
                                <p
                                    id="reopen-reason-error"
                                    className="mt-1 text-xs text-danger"
                                    role="alert"
                                >
                                    {reopenForm.errors.reason}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={reopenForm.processing}
                            >
                                {reopenForm.processing
                                    ? 'Reopening...'
                                    : 'Confirm reopen to draft'}
                            </Button>
                            <Button
                                type="button"
                                variant="quiet"
                                onClick={() => setReopening(false)}
                                disabled={reopenForm.processing}
                            >
                                Dismiss
                            </Button>
                        </div>
                    </form>
                ) : archiving ? (
                    <form onSubmit={handleArchive} className="space-y-3">
                        <h3 className="text-sm font-semibold text-danger">
                            Archive dispatch job
                        </h3>
                        <p className="text-xs text-ink-soft">
                            Archiving soft-deletes this job and removes it from
                            normal operational views.
                        </p>
                        {archiveError && (
                            <div
                                className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
                                role="alert"
                            >
                                {archiveError}
                            </div>
                        )}
                        <div>
                            <label
                                htmlFor="archive-reason"
                                className="block text-xs font-medium text-ink"
                            >
                                Archive reason (optional)
                            </label>
                            <textarea
                                id="archive-reason"
                                rows={2}
                                className="mt-1 block w-full rounded-md border-line text-sm shadow-sm"
                                value={archiveForm.data.reason}
                                onChange={(e) =>
                                    archiveForm.setData(
                                        'reason',
                                        e.target.value,
                                    )
                                }
                                placeholder="Reason for archiving this dispatch..."
                                aria-invalid={
                                    archiveErrors.reason ? 'true' : undefined
                                }
                                aria-describedby={
                                    archiveErrors.reason
                                        ? 'archive-reason-error'
                                        : undefined
                                }
                            />
                            {archiveErrors.reason && (
                                <p
                                    id="archive-reason-error"
                                    className="mt-1 text-xs text-danger"
                                    role="alert"
                                >
                                    {archiveForm.errors.reason}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="submit"
                                variant="primary"
                                className="bg-danger text-white hover:bg-danger/90"
                                disabled={archiveForm.processing}
                            >
                                {archiveForm.processing
                                    ? 'Archiving...'
                                    : 'Confirm archive'}
                            </Button>
                            <Button
                                type="button"
                                variant="quiet"
                                onClick={() => setArchiving(false)}
                                disabled={archiveForm.processing}
                            >
                                Dismiss
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {capabilities.cancel &&
                            job.status.value !== 'completed' &&
                            job.status.value !== 'cancelled' && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="border-danger/30 text-danger hover:bg-danger-soft"
                                    onClick={() => setCancelling(true)}
                                >
                                    Cancel dispatch
                                </Button>
                            )}
                        {capabilities.reopen &&
                            job.status.value === 'cancelled' && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setReopening(true)}
                                >
                                    Reopen job as draft
                                </Button>
                            )}
                        {capabilities.archive && !archiveBlocked && (
                            <Button
                                type="button"
                                variant="quiet"
                                className="text-ink-soft hover:text-danger"
                                onClick={() => setArchiving(true)}
                            >
                                Archive job
                            </Button>
                        )}
                        {capabilities.archive && archiveBlocked && (
                            <p className="self-center text-xs text-ink-soft">
                                Archive is unavailable while field work is
                                active. Cancel or complete the dispatch first.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </Panel>
    );
}

function DispatchContext({ job }: { job: DispatchDetailPageProps['job'] }) {
    return (
        <Panel className="p-4">
            <h2 className="font-semibold">Dispatch context</h2>
            <dl className="mt-3 divide-y divide-line">
                <DataPair
                    label="Schedule"
                    value={
                        <span className="inline-flex items-start gap-2">
                            <CalendarDays
                                className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft"
                                aria-hidden="true"
                            />
                            {formatDateTime(job.scheduled_start)} –{' '}
                            {formatDateTime(job.scheduled_end)}
                        </span>
                    }
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
    );
}

function CurrentAssignments({
    job,
    capabilities,
}: {
    job: DispatchDetailPageProps['job'];
    capabilities: DispatchDetailPageProps['capabilities'];
}) {
    const { auth, errors } = usePage().props;
    const authUser = auth?.user;
    const responseError = errors.response ?? errors.version;
    const assignmentCount =
        job.personnel_assignments.length + job.asset_assignments.length;

    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState<string | null>(null);
    const [submittingId, setSubmittingId] = useState<number | null>(null);

    const handleAccept = (assignmentId: number) => {
        setSubmittingId(assignmentId);
        router.post(
            `/operations/dispatch-jobs/${job.id}/assignments/${assignmentId}/response`,
            { response: 'accepted', version: job.version },
            {
                preserveScroll: true,
                onFinish: () => setSubmittingId(null),
            },
        );
    };

    const handleRejectSubmit = (e: FormEvent, assignmentId: number) => {
        e.preventDefault();

        if (!reason.trim()) {
            setReasonError(
                'A reason is required when rejecting an assignment.',
            );

            return;
        }

        setReasonError(null);
        setSubmittingId(assignmentId);
        router.post(
            `/operations/dispatch-jobs/${job.id}/assignments/${assignmentId}/response`,
            {
                response: 'rejected',
                reason: reason.trim(),
                version: job.version,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setRejectingId(null);
                    setReason('');
                },
                onError: (errs) => {
                    if (errs.reason) {
                        setReasonError(errs.reason);
                    }
                },
                onFinish: () => setSubmittingId(null),
            },
        );
    };

    const handleEndPersonnel = (assignmentId: number) => {
        if (
            !window.confirm(
                'End this active personnel assignment? The assignment history will be preserved.',
            )
        ) {
            return;
        }

        setSubmittingId(assignmentId);
        router.post(
            `/operations/dispatch-jobs/${job.id}/reassign`,
            {
                end_personnel_assignment_ids: [assignmentId],
                version: job.version,
            },
            {
                preserveScroll: true,
                onFinish: () => setSubmittingId(null),
            },
        );
    };

    const handleEndAsset = (assignmentId: number) => {
        if (
            !window.confirm(
                'End this active asset assignment? The assignment history will be preserved.',
            )
        ) {
            return;
        }

        setSubmittingId(assignmentId);
        router.post(
            `/operations/dispatch-jobs/${job.id}/reassign`,
            {
                end_asset_assignment_ids: [assignmentId],
                version: job.version,
            },
            {
                preserveScroll: true,
                onFinish: () => setSubmittingId(null),
            },
        );
    };

    return (
        <Panel className="overflow-hidden">
            <div className="border-b border-line px-4 py-3">
                <h2 className="font-semibold">Current assignments</h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                    {assignmentCount} active resource
                    {assignmentCount === 1 ? '' : 's'}
                </p>
            </div>
            {assignmentCount === 0 ? (
                <EmptyState
                    compact
                    icon={ClipboardList}
                    title="No resources assigned"
                    message="Eligible selections confirmed below will appear here."
                />
            ) : (
                <ul className="divide-y divide-line">
                    {job.personnel_assignments.map((assignment) => {
                        const isUserAssignment =
                            authUser?.id === assignment.user_id;
                        const isPending =
                            assignment.response_status.value === 'pending';
                        const canRespond =
                            isPending &&
                            isUserAssignment &&
                            capabilities?.respond_assignment === true;
                        const isRejectingThis = rejectingId === assignment.id;
                        const isSubmittingThis = submittingId === assignment.id;

                        return (
                            <li
                                key={`personnel-${assignment.id}`}
                                className="space-y-3 px-4 py-3"
                            >
                                <div className="flex items-start gap-3">
                                    <ResourceIcon icon="personnel" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">
                                            {assignment.name}
                                        </p>
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            {humanize(assignment.type)} ·{' '}
                                            <span
                                                className={cn(
                                                    assignment.response_status
                                                        .value === 'accepted' &&
                                                        'font-medium text-success-strong',
                                                    assignment.response_status
                                                        .value === 'rejected' &&
                                                        'font-medium text-danger',
                                                    assignment.response_status
                                                        .value === 'pending' &&
                                                        'text-ink-soft',
                                                )}
                                            >
                                                {
                                                    assignment.response_status
                                                        .label
                                                }
                                            </span>
                                        </p>
                                        {assignment.response_reason && (
                                            <p className="mt-1 text-xs text-ink-soft italic">
                                                Reason:{' '}
                                                {assignment.response_reason}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        {canRespond && !isRejectingThis && (
                                            <>
                                                <Button
                                                    size="md"
                                                    variant="secondary"
                                                    disabled={isSubmittingThis}
                                                    aria-busy={isSubmittingThis}
                                                    onClick={() =>
                                                        handleAccept(
                                                            assignment.id,
                                                        )
                                                    }
                                                >
                                                    <Check className="h-3.5 w-3.5 text-success-strong" />
                                                    {isSubmittingThis
                                                        ? 'Accepting…'
                                                        : 'Accept'}
                                                </Button>
                                                <Button
                                                    size="md"
                                                    variant="quiet"
                                                    disabled={isSubmittingThis}
                                                    onClick={() => {
                                                        setRejectingId(
                                                            assignment.id,
                                                        );
                                                        setReason('');
                                                        setReasonError(null);
                                                    }}
                                                >
                                                    <X className="h-3.5 w-3.5 text-danger" />
                                                    Reject
                                                </Button>
                                            </>
                                        )}
                                        {capabilities?.reassign_resources &&
                                            !isRejectingThis && (
                                                <Button
                                                    size="sm"
                                                    variant="quiet"
                                                    disabled={isSubmittingThis}
                                                    aria-busy={isSubmittingThis}
                                                    onClick={() =>
                                                        handleEndPersonnel(
                                                            assignment.id,
                                                        )
                                                    }
                                                >
                                                    <X className="h-3.5 w-3.5 text-danger" />
                                                    {isSubmittingThis
                                                        ? 'Ending…'
                                                        : 'End assignment'}
                                                </Button>
                                            )}
                                    </div>
                                </div>

                                {responseError &&
                                    isUserAssignment &&
                                    !isRejectingThis && (
                                        <p
                                            className="mt-2 text-xs text-danger"
                                            role="alert"
                                        >
                                            {responseError}
                                        </p>
                                    )}

                                {isRejectingThis && (
                                    <form
                                        onSubmit={(e) =>
                                            handleRejectSubmit(e, assignment.id)
                                        }
                                        className="space-y-3 rounded-lg border border-line bg-surface-subtle p-3"
                                    >
                                        <div>
                                            <label
                                                htmlFor={`rejection-reason-${assignment.id}`}
                                                className="block text-xs font-semibold text-ink"
                                            >
                                                Rejection reason (required)
                                            </label>
                                            <p
                                                id={`rejection-reason-${assignment.id}-description`}
                                                className="mt-0.5 text-xs text-ink-soft"
                                            >
                                                Explain why you are rejecting
                                                this assignment. Rejection will
                                                close your active interval.
                                            </p>
                                            <textarea
                                                id={`rejection-reason-${assignment.id}`}
                                                rows={2}
                                                value={reason}
                                                onChange={(e) => {
                                                    setReason(e.target.value);
                                                    setReasonError(null);
                                                }}
                                                className="mt-2 block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                                                placeholder="Provide reason for rejection..."
                                                aria-describedby={`rejection-reason-${assignment.id}-description${reasonError || errors.reason ? ` rejection-reason-${assignment.id}-error` : ''}${responseError ? ` assignment-response-${assignment.id}-error` : ''}`}
                                                aria-invalid={
                                                    reasonError ||
                                                    errors.reason ||
                                                    responseError
                                                        ? 'true'
                                                        : 'false'
                                                }
                                                required
                                            />
                                            {(reasonError || errors.reason) && (
                                                <p
                                                    id={`rejection-reason-${assignment.id}-error`}
                                                    className="mt-1 text-xs text-danger"
                                                    role="alert"
                                                >
                                                    {reasonError ||
                                                        errors.reason}
                                                </p>
                                            )}
                                            {responseError &&
                                                isUserAssignment && (
                                                    <p
                                                        id={`assignment-response-${assignment.id}-error`}
                                                        className="mt-1 text-xs text-danger"
                                                        role="alert"
                                                    >
                                                        {responseError}
                                                    </p>
                                                )}
                                        </div>
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                type="button"
                                                size="md"
                                                variant="quiet"
                                                disabled={isSubmittingThis}
                                                onClick={() => {
                                                    setRejectingId(null);
                                                    setReason('');
                                                    setReasonError(null);
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                type="submit"
                                                size="md"
                                                variant="danger"
                                                disabled={
                                                    isSubmittingThis ||
                                                    !reason.trim()
                                                }
                                                aria-busy={isSubmittingThis}
                                            >
                                                {isSubmittingThis
                                                    ? 'Rejecting…'
                                                    : 'Confirm rejection'}
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </li>
                        );
                    })}
                    {job.asset_assignments.map((assignment) => (
                        <li
                            key={`asset-${assignment.id}`}
                            className="flex items-start gap-3 px-4 py-3"
                        >
                            <ResourceIcon icon="asset" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                    {assignment.code} · {assignment.name}
                                </p>
                                <p className="mt-0.5 text-xs text-ink-soft">
                                    {humanize(assignment.type)}
                                </p>
                            </div>
                            {capabilities?.reassign_resources && (
                                <Button
                                    size="sm"
                                    variant="quiet"
                                    disabled={submittingId === assignment.id}
                                    aria-busy={submittingId === assignment.id}
                                    onClick={() =>
                                        handleEndAsset(assignment.id)
                                    }
                                >
                                    <X className="h-3.5 w-3.5 text-danger" />
                                    {submittingId === assignment.id
                                        ? 'Ending…'
                                        : 'End assignment'}
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

function PersonnelCandidates({
    candidates,
    selectedIds,
    canAssign,
    onToggle,
}: {
    candidates: PersonnelCandidateViewModel[];
    selectedIds: number[];
    canAssign: boolean;
    onToggle: (candidate: PersonnelCandidateViewModel) => void;
}) {
    const groups: Array<{
        type: PersonnelCandidateViewModel['assignment_type'];
        label: string;
    }> = [
        { type: 'driver', label: 'Drivers' },
        { type: 'crane_operator', label: 'Crane operators' },
        { type: 'field_technician', label: 'Field technicians' },
    ];

    return (
        <div className="grid gap-4 2xl:grid-cols-3">
            {groups.map((group) => {
                const resources = candidates.filter(
                    (candidate) => candidate.assignment_type === group.type,
                );

                return (
                    <fieldset
                        key={group.type}
                        className="min-w-0 rounded-xl border border-line bg-surface"
                    >
                        <legend className="sr-only">{group.label}</legend>
                        <div className="border-b border-line px-4 py-3">
                            <h3 className="font-semibold">{group.label}</h3>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                {
                                    resources.filter(
                                        (resource) => resource.eligible,
                                    ).length
                                }{' '}
                                eligible of {resources.length}
                            </p>
                        </div>
                        {resources.length === 0 ? (
                            <EmptyState
                                compact
                                icon={UserRound}
                                title={`No ${group.label.toLowerCase()}`}
                                message="Qualified personnel will appear after their operational role is provisioned."
                            />
                        ) : (
                            <ul className="divide-y divide-line">
                                {resources.map((candidate) => (
                                    <PersonnelCandidate
                                        key={candidate.id}
                                        candidate={candidate}
                                        selected={selectedIds.includes(
                                            candidate.id,
                                        )}
                                        canAssign={canAssign}
                                        onToggle={onToggle}
                                    />
                                ))}
                            </ul>
                        )}
                    </fieldset>
                );
            })}
        </div>
    );
}

function PersonnelCandidate({
    candidate,
    selected,
    canAssign,
    onToggle,
}: {
    candidate: PersonnelCandidateViewModel;
    selected: boolean;
    canAssign: boolean;
    onToggle: (candidate: PersonnelCandidateViewModel) => void;
}) {
    const detailsId = `personnel-${candidate.id}-details`;

    return (
        <li
            className={cn(
                'p-4',
                selected && 'bg-brand-soft',
                !candidate.eligible && 'bg-surface-subtle/60',
            )}
        >
            <div className="flex min-h-11 items-start gap-1">
                {canAssign && (
                    <label className="flex min-h-11 min-w-11 shrink-0 items-start justify-center pt-1">
                        <input
                            type="checkbox"
                            checked={selected}
                            disabled={!candidate.eligible}
                            onChange={() => onToggle(candidate)}
                            aria-describedby={detailsId}
                            className="h-5 w-5 accent-[var(--color-brand)]"
                        />
                        <span className="sr-only">
                            Select {candidate.name} as{' '}
                            {candidate.assignment_label}
                        </span>
                    </label>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium">{candidate.name}</p>
                        <EligibilityBadge eligible={candidate.eligible} />
                    </div>
                    <div
                        id={detailsId}
                        className="mt-2 space-y-1 text-xs leading-5 text-ink-soft"
                    >
                        <p>
                            Availability: {candidate.availability.label} ·
                            Account: {candidate.account_status.label}
                        </p>
                        <p>{credentialSummary(candidate)}</p>
                        <ConflictDetails
                            reasons={candidate.reasons}
                            conflicts={candidate.schedule_conflicts}
                        />
                    </div>
                </div>
            </div>
        </li>
    );
}

function AssetCandidates({
    candidates,
    selectedIds,
    canAssign,
    onToggle,
}: {
    candidates: AssetCandidateViewModel[];
    selectedIds: number[];
    canAssign: boolean;
    onToggle: (candidate: AssetCandidateViewModel) => void;
}) {
    const groups: Array<{
        type: AssetCandidateViewModel['assignment_type'];
        label: string;
    }> = [
        { type: 'truck', label: 'Trucks' },
        { type: 'crane', label: 'Cranes' },
        { type: 'equipment', label: 'Equipment' },
    ];

    return (
        <div className="grid gap-4 2xl:grid-cols-3">
            {groups.map((group) => {
                const resources = candidates.filter(
                    (candidate) => candidate.assignment_type === group.type,
                );

                return (
                    <fieldset
                        key={group.type}
                        className="min-w-0 rounded-xl border border-line bg-surface"
                    >
                        <legend className="sr-only">{group.label}</legend>
                        <div className="border-b border-line px-4 py-3">
                            <h3 className="font-semibold">{group.label}</h3>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                {
                                    resources.filter(
                                        (resource) => resource.eligible,
                                    ).length
                                }{' '}
                                eligible of {resources.length}
                            </p>
                        </div>
                        {resources.length === 0 ? (
                            <EmptyState
                                compact
                                icon={Truck}
                                title={`No ${group.label.toLowerCase()}`}
                                message="Registered assets in this category will appear here."
                            />
                        ) : (
                            <ul className="divide-y divide-line">
                                {resources.map((candidate) => (
                                    <AssetCandidate
                                        key={candidate.id}
                                        candidate={candidate}
                                        selected={selectedIds.includes(
                                            candidate.id,
                                        )}
                                        canAssign={canAssign}
                                        onToggle={onToggle}
                                    />
                                ))}
                            </ul>
                        )}
                    </fieldset>
                );
            })}
        </div>
    );
}

function AssetCandidate({
    candidate,
    selected,
    canAssign,
    onToggle,
}: {
    candidate: AssetCandidateViewModel;
    selected: boolean;
    canAssign: boolean;
    onToggle: (candidate: AssetCandidateViewModel) => void;
}) {
    const detailsId = `asset-${candidate.id}-details`;

    return (
        <li
            className={cn(
                'p-4',
                selected && 'bg-brand-soft',
                !candidate.eligible && 'bg-surface-subtle/60',
            )}
        >
            <div className="flex min-h-11 items-start gap-1">
                {canAssign && (
                    <label className="flex min-h-11 min-w-11 shrink-0 items-start justify-center pt-1">
                        <input
                            type="checkbox"
                            checked={selected}
                            disabled={!candidate.eligible}
                            onChange={() => onToggle(candidate)}
                            aria-describedby={detailsId}
                            className="h-5 w-5 accent-[var(--color-brand)]"
                        />
                        <span className="sr-only">
                            Select {candidate.code} · {candidate.name}
                        </span>
                    </label>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <p className="font-medium">{candidate.code}</p>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                {candidate.name}
                            </p>
                        </div>
                        <EligibilityBadge eligible={candidate.eligible} />
                    </div>
                    <div
                        id={detailsId}
                        className="mt-2 space-y-1 text-xs leading-5 text-ink-soft"
                    >
                        <p>
                            Readiness: {candidate.readiness.label} · Maintenance
                            blocks: {candidate.blocking_maintenance_count}
                        </p>
                        <ConflictDetails
                            reasons={candidate.reasons}
                            conflicts={candidate.schedule_conflicts}
                        />
                    </div>
                </div>
            </div>
        </li>
    );
}

function EligibilityBadge({ eligible }: { eligible: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                eligible
                    ? 'bg-success-soft text-success-strong'
                    : 'bg-danger-soft text-danger',
            )}
        >
            {eligible ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {eligible ? 'Eligible' : 'Blocked'}
        </span>
    );
}

function ConflictDetails({
    reasons,
    conflicts,
}: {
    reasons: string[];
    conflicts: PersonnelCandidateViewModel['schedule_conflicts'];
}) {
    if (reasons.length === 0) {
        return (
            <p className="inline-flex items-start gap-1.5 text-success-strong">
                <ShieldCheck
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                />
                No blocking conflict at this schedule.
            </p>
        );
    }

    return (
        <>
            <ul className="space-y-1 text-danger">
                {reasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-1.5">
                        <AlertTriangle
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        {reason}
                    </li>
                ))}
            </ul>
            {conflicts.length > 0 && (
                <p className="flex items-start gap-1.5">
                    <Clock3
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                    />
                    {conflicts
                        .map(
                            (conflict) =>
                                `${conflict.reference} (${formatDateTime(conflict.scheduled_start)} – ${formatDateTime(conflict.scheduled_end)})`,
                        )
                        .join('; ')}
                </p>
            )}
        </>
    );
}

function ResourceIcon({ icon }: { icon: 'personnel' | 'asset' }) {
    const Icon = icon === 'personnel' ? HardHat : Wrench;

    return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft">
            <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
    );
}

function credentialSummary(candidate: PersonnelCandidateViewModel) {
    if (candidate.credential.status === 'not_required') {
        return 'Credential: no additional credential required';
    }

    const expiry = candidate.credential.expires_at
        ? ` · Expires ${formatDate(candidate.credential.expires_at)}`
        : '';

    return `Credential: ${candidate.credential.label} · ${humanize(candidate.credential.status)}${expiry}`;
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

function formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
}

function humanize(value: string) {
    return value.replaceAll('_', ' ');
}

export function CandidateListSkeleton() {
    return (
        <div
            className="grid gap-3 sm:grid-cols-2"
            aria-label="Loading candidate options"
        >
            {[1, 2, 3, 4].map((item) => (
                <div
                    key={item}
                    className="flex flex-col justify-between rounded-xl border border-line p-3.5"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="mt-3 h-3 w-36" />
                </div>
            ))}
        </div>
    );
}
