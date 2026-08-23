import { router, usePage } from '@inertiajs/react';
import { Check, ClipboardList, X } from 'lucide-react';
import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, Panel } from '@/components/ui';
import { humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetCandidateViewModel,
    DispatchDetailPageProps,
    PersonnelCandidateViewModel,
} from '@/types/workspace';
import { ResourceIcon } from './dispatch-detail-helpers';
import { ReassignmentModal } from './reassignment-modal';

export function CurrentAssignments({
    job,
    capabilities,
    hasPendingSelections = false,
    pendingSelectionCount = 0,
    personnelCandidates,
    assetCandidates,
}: {
    job: DispatchDetailPageProps['job'];
    capabilities: DispatchDetailPageProps['capabilities'];
    hasPendingSelections?: boolean;
    pendingSelectionCount?: number;
    personnelCandidates: PersonnelCandidateViewModel[];
    assetCandidates: AssetCandidateViewModel[];
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
    const [reassignmentTarget, setReassignmentTarget] = useState<{
        kind: 'personnel' | 'asset';
        id: number;
        name: string;
        type: string;
    } | null>(null);

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
                <h2 className="font-semibold">Resources assigned</h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                    {assignmentCount > 0
                        ? assignmentCount +
                          ' active resource' +
                          (assignmentCount === 1 ? '' : 's')
                        : hasPendingSelections
                          ? pendingSelectionCount + ' selected but not saved'
                          : 'No saved resources yet'}
                </p>
            </div>
            {assignmentCount === 0 ? (
                <EmptyState
                    compact
                    icon={ClipboardList}
                    title={
                        hasPendingSelections
                            ? 'Draft assignment pending'
                            : 'No resources assigned'
                    }
                    message={
                        hasPendingSelections
                            ? 'Save the selected resources above to create active assignments.'
                            : 'Eligible selections confirmed below will appear here.'
                    }
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
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                    <div className="flex min-w-0 items-start gap-3 sm:flex-1">
                                        <ResourceIcon icon="personnel" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">
                                                {assignment.name}
                                            </p>
                                            <p className="mt-0.5 text-xs text-ink-soft">
                                                {humanize(assignment.type)} ·{' '}
                                                <span
                                                    className={cn(
                                                        assignment
                                                            .response_status
                                                            .value ===
                                                            'accepted' &&
                                                            'font-medium text-success-strong',
                                                        assignment
                                                            .response_status
                                                            .value ===
                                                            'rejected' &&
                                                            'font-medium text-danger',
                                                        assignment
                                                            .response_status
                                                            .value ===
                                                            'pending' &&
                                                            'text-ink-soft',
                                                    )}
                                                >
                                                    {
                                                        assignment
                                                            .response_status
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
                                    </div>
                                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
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
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        disabled={
                                                            isSubmittingThis
                                                        }
                                                        onClick={() =>
                                                            setReassignmentTarget(
                                                                {
                                                                    kind: 'personnel',
                                                                    id: assignment.id,
                                                                    name: assignment.name,
                                                                    type: assignment.type,
                                                                },
                                                            )
                                                        }
                                                    >
                                                        Reassign
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="quiet"
                                                        disabled={
                                                            isSubmittingThis
                                                        }
                                                        aria-busy={
                                                            isSubmittingThis
                                                        }
                                                        onClick={() =>
                                                            handleEndPersonnel(
                                                                assignment.id,
                                                            )
                                                        }
                                                    >
                                                        <X className="h-3.5 w-3.5 text-danger" />
                                                        End
                                                    </Button>
                                                </div>
                                            )}
                                    </div>
                                </div>

                                {responseError &&
                                    isUserAssignment &&
                                    !isRejectingThis && (
                                        <p
                                            className="mt-2 text-xs text-danger"
                                            role="alert"
                                            aria-live="assertive"
                                            aria-atomic="true"
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
                                                    aria-live="assertive"
                                                    aria-atomic="true"
                                                >
                                                    {reasonError ||
                                                        errors.reason}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                className="bg-danger text-white hover:bg-danger/90"
                                                disabled={isSubmittingThis}
                                                type="submit"
                                            >
                                                {isSubmittingThis
                                                    ? 'Rejecting…'
                                                    : 'Confirm rejection'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="quiet"
                                                disabled={isSubmittingThis}
                                                onClick={() => {
                                                    setRejectingId(null);
                                                    setReason('');
                                                    setReasonError(null);
                                                }}
                                                type="button"
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </li>
                        );
                    })}

                    {job.asset_assignments.map((assignment) => {
                        const isSubmittingThis = submittingId === assignment.id;

                        return (
                            <li
                                key={`asset-${assignment.id}`}
                                className="flex items-center justify-between gap-3 px-4 py-3"
                            >
                                <div className="flex min-w-0 items-start gap-3">
                                    <ResourceIcon icon="asset" />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                            {assignment.code}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs text-ink-soft">
                                            {assignment.name ||
                                                humanize(assignment.type)}
                                        </p>
                                    </div>
                                </div>
                                {capabilities?.reassign_resources && (
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            disabled={isSubmittingThis}
                                            onClick={() =>
                                                setReassignmentTarget({
                                                    kind: 'asset',
                                                    id: assignment.id,
                                                    name: assignment.code,
                                                    type: assignment.type,
                                                })
                                            }
                                        >
                                            Reassign
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="quiet"
                                            disabled={isSubmittingThis}
                                            aria-busy={isSubmittingThis}
                                            onClick={() =>
                                                handleEndAsset(assignment.id)
                                            }
                                        >
                                            <X className="h-3.5 w-3.5 text-danger" />
                                            End
                                        </Button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {reassignmentTarget && (
                <ReassignmentModal
                    job={job}
                    target={reassignmentTarget}
                    personnelCandidates={personnelCandidates}
                    assetCandidates={assetCandidates}
                    onClose={() => setReassignmentTarget(null)}
                />
            )}
        </Panel>
    );
}
