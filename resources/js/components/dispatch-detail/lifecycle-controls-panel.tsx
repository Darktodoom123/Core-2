import { router, useForm } from '@inertiajs/react';
import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui';
import type { DispatchDetailPageProps } from '@/types/workspace';

export function LifecycleControlsPanel({
    job,
    capabilities,
}: {
    job: DispatchDetailPageProps['job'];
    capabilities: DispatchDetailPageProps['capabilities'];
}) {
    const [cancelling, setCancelling] = useState(false);
    const [reopening, setReopening] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [restoring, setRestoring] = useState(false);
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

    const restoreForm = useForm({
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
    const restoreErrors = restoreForm.errors as Record<
        string,
        string | undefined
    >;
    const cancelError = cancelErrors.version ?? cancelErrors.status ?? null;
    const reopenError = reopenErrors.version ?? reopenErrors.status ?? null;
    const archiveError = archiveErrors.status ?? null;
    const restoreError = restoreErrors.status ?? null;
    const archiveBlocked = [
        'dispatched',
        'accepted',
        'en_route',
        'arrived',
        'working',
    ].includes(job.status.value);

    const hasControls =
        capabilities.cancel ||
        capabilities.reopen ||
        capabilities.archive ||
        capabilities.restore;

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

    const handleRestore = (e: FormEvent) => {
        e.preventDefault();
        restoreForm.post(`/operations/dispatch-jobs/${job.id}/restore`, {
            preserveScroll: true,
            onSuccess: () => setRestoring(false),
        });
    };

    const refresh = () => {
        setRefreshing(true);
        router.reload({
            onFinish: () => setRefreshing(false),
        });
    };

    return (
        <details
            id="administrative-actions"
            className="overflow-hidden rounded-xl border border-line bg-surface"
            aria-busy={
                cancelForm.processing ||
                reopenForm.processing ||
                archiveForm.processing ||
                restoreForm.processing ||
                refreshing
            }
        >
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <span>
                    <span className="block font-semibold">
                        Administrative actions
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-soft">
                        Cancellation, reopening, archive, and restore controls.
                    </span>
                </span>
                <span className="text-sm text-ink-soft">Show</span>
            </summary>
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
                                aria-live="assertive"
                                aria-atomic="true"
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
                                    aria-live="assertive"
                                    aria-atomic="true"
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
                                aria-live="assertive"
                                aria-atomic="true"
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
                                    aria-live="assertive"
                                    aria-atomic="true"
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
                                aria-live="assertive"
                                aria-atomic="true"
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
                                    aria-live="assertive"
                                    aria-atomic="true"
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
                ) : restoring ? (
                    <form onSubmit={handleRestore} className="space-y-3">
                        <h3 className="text-sm font-semibold text-brand-strong">
                            Restore dispatch job
                        </h3>
                        <p className="text-xs text-ink-soft">
                            Restoring will recover this archived dispatch back
                            into active operational views as a draft.
                        </p>
                        {restoreError && (
                            <div
                                className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
                                role="alert"
                                aria-live="assertive"
                                aria-atomic="true"
                            >
                                {restoreError}
                            </div>
                        )}
                        <div>
                            <label
                                htmlFor="restore-reason"
                                className="block text-xs font-medium text-ink"
                            >
                                Restore reason (optional)
                            </label>
                            <textarea
                                id="restore-reason"
                                rows={2}
                                className="mt-1 block w-full rounded-md border-line text-sm shadow-sm"
                                value={restoreForm.data.reason}
                                onChange={(e) =>
                                    restoreForm.setData(
                                        'reason',
                                        e.target.value,
                                    )
                                }
                                placeholder="Reason for restoring this dispatch..."
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={restoreForm.processing}
                            >
                                {restoreForm.processing
                                    ? 'Restoring…'
                                    : 'Confirm restore'}
                            </Button>
                            <Button
                                type="button"
                                variant="quiet"
                                onClick={() => setRestoring(false)}
                                disabled={restoreForm.processing}
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
                        {capabilities.restore && (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setRestoring(true)}
                            >
                                Restore archived job
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
        </details>
    );
}
