import type { Page } from '@inertiajs/core';
import { router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Check,
    CheckCircle2,
    Circle,
    ClipboardList,
    Clock3,
    FileText,
    Navigation,
    RefreshCw,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Button, EmptyState, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { cn } from '@/lib/utils';
import type {
    AssetCandidateViewModel,
    DispatchDetailPageProps,
    PersonnelCandidateViewModel,
} from '@/types/workspace';
import { CurrentAssignments } from './current-assignments';
import { DispatchContext } from './dispatch-context';

export function FieldJobWorkspace({
    job,
    progression,
    capabilities,
    personnelCandidates,
    assetCandidates,
}: {
    job: DispatchDetailPageProps['job'];
    progression: NonNullable<DispatchDetailPageProps['progression']>;
    capabilities: DispatchDetailPageProps['capabilities'];
    personnelCandidates: PersonnelCandidateViewModel[];
    assetCandidates: AssetCandidateViewModel[];
}) {
    return (
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
            <div className="space-y-5">
                <FieldProgressionPanel job={job} progression={progression} />
                <RequirementsPanel requirements={job.requirements} />
            </div>
            <div className="space-y-5">
                <DispatchContext job={job} />
                <CurrentAssignments
                    job={job}
                    capabilities={capabilities}
                    personnelCandidates={personnelCandidates}
                    assetCandidates={assetCandidates}
                />
            </div>
        </div>
    );
}

export function FieldProgressionPanel({
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
                        aria-live="assertive"
                        aria-atomic="true"
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
                    <div className="space-y-3">
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

                        {isCompleted && (
                            <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-brand/20 bg-brand-soft/40 p-4 sm:flex-row sm:items-center">
                                <div>
                                    <p className="text-xs font-semibold text-ink">
                                        Field Completion Report & Evidence
                                    </p>
                                    <p className="mt-0.5 text-xs text-ink-soft">
                                        Submit work summary, timestamps, and
                                        SHA-256 verified attachments.
                                    </p>
                                </div>
                                <a
                                    href={`/?view=reports&job_id=${job.id}`}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-strong px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-brand"
                                >
                                    <FileText className="h-4 w-4" />
                                    Submit Job Report
                                </a>
                            </div>
                        )}
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

export function RequirementsPanel({
    requirements,
}: {
    requirements: string[];
}) {
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
