import { Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import React from 'react';
import type { MouseEvent } from 'react';
import { Button } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { formatDateTime } from '@/lib/formatters';
import type { DispatchDetailPageProps } from '@/types/workspace';

export function DispatchDetailHeader({
    job,
    capabilities,
    returnTo,
    onConfirmLeave,
}: {
    job: DispatchDetailPageProps['job'];
    capabilities: DispatchDetailPageProps['capabilities'];
    returnTo: string;
    onConfirmLeave: (e: MouseEvent<Element>) => void;
}) {
    return (
        <header className="border-b border-line bg-surface">
            <div className="mx-auto max-w-[96rem] px-4 py-4 md:px-6">
                <Link
                    href={capabilities.update_own_status ? '/' : returnTo}
                    onClick={onConfirmLeave}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink"
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    {capabilities.update_own_status
                        ? "Back to today's work"
                        : 'Back to dispatch workspace'}
                </Link>
                <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        {!capabilities.update_own_status && (
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-soft/70 px-2 py-0.5 text-xs font-semibold tracking-wider text-brand-strong uppercase">
                                    Assignment workspace
                                </span>
                                <span className="text-xs font-medium text-ink-soft">
                                    {job.client}
                                </span>
                            </div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-ink">
                                {capabilities.update_own_status
                                    ? job.title
                                    : `${job.reference} · ${job.title}`}
                            </h1>
                            <CanonicalStatusBadge status={job.status} />
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                            <span>
                                Client:{' '}
                                <strong className="font-semibold text-ink">
                                    {job.client}
                                </strong>
                            </span>
                            <span>•</span>
                            <span>
                                Site:{' '}
                                <strong className="font-semibold text-ink">
                                    {job.site}
                                </strong>
                            </span>
                            {job.scheduled_start && (
                                <>
                                    <span>•</span>
                                    <span>
                                        Schedule:{' '}
                                        <strong className="font-medium text-ink">
                                            {formatDateTime(
                                                job.scheduled_start,
                                            )}
                                        </strong>
                                    </span>
                                </>
                            )}
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <CanonicalStatusBadge status={job.priority} />
                        <span className="inline-flex min-h-7 items-center rounded-md border border-line bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft">
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
                                            subject_type: 'dispatch_job',
                                            subject_id: job.id,
                                            purpose: 'dispatch_assignment',
                                        },
                                    );
                                }}
                            >
                                Request AI assistance
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
