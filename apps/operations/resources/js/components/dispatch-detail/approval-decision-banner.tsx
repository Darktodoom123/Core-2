import { router } from '@inertiajs/react';
import { Check, CheckCircle2, Clock3, X } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { DispatchDetailPageProps } from '@/types/workspace';

export function ApprovalDecisionBanner({
    activation,
}: {
    job?: DispatchDetailPageProps['job'];
    activation: DispatchDetailPageProps['activation'];
}) {
    const [deciding, setDeciding] = useState<'approve' | 'reject' | null>(null);
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    if (!activation.approval_required && !activation.approval_request_id) {
        return null;
    }

    const isPending = activation.approval_status === 'pending';
    const isApproved = activation.approval_status === 'approved';
    const isRejected = activation.approval_status === 'rejected';
    const canDecide = Boolean(
        activation.can_decide_approval && activation.approval_request_id,
    );

    if (
        !activation.approval_request_id &&
        !isRejected &&
        !isApproved &&
        !canDecide
    ) {
        return null;
    }

    const handleDecision = (
        status: 'approved' | 'rejected',
        activateAfterApproval: boolean = false,
    ) => {
        if (!activation.approval_request_id) {
            return;
        }

        const finalReason =
            reason.trim() ||
            (status === 'approved'
                ? activateAfterApproval
                    ? 'Approved and activated by Operations Manager'
                    : 'Approved by Operations Manager'
                : '');

        if (status === 'rejected' && !finalReason) {
            setReasonError(
                'A rejection reason is required to reject this approval request.',
            );

            return;
        }

        setSubmitting(true);
        setReasonError(null);
        router.post(
            `/operations/approval-requests/${activation.approval_request_id}/decision`,
            {
                status,
                reason: finalReason,
                activate_after_approval: activateAfterApproval,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setDeciding(null);
                    setReason('');
                },
                onError: (errs) => {
                    if (errs.reason) {
                        setReasonError(errs.reason);
                    }
                },
                onFinish: () => setSubmitting(false),
            },
        );
    };

    return (
        <div
            className={cn(
                'rounded-xl border p-4 shadow-2xs transition-colors',
                isPending &&
                    'border-warning bg-warning-soft text-warning-strong',
                isApproved &&
                    'border-success bg-success-soft text-success-strong',
                isRejected && 'border-danger bg-danger-soft text-danger',
            )}
            role="region"
            aria-label="Approval status and decision banner"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    {isApproved ? (
                        <CheckCircle2
                            className="mt-0.5 h-5 w-5 shrink-0 text-success-strong"
                            aria-hidden="true"
                        />
                    ) : isRejected ? (
                        <X
                            className="mt-0.5 h-5 w-5 shrink-0 text-danger"
                            aria-hidden="true"
                        />
                    ) : (
                        <Clock3
                            className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong"
                            aria-hidden="true"
                        />
                    )}
                    <div>
                        <h2 className="text-sm font-semibold">
                            {isApproved
                                ? 'Operations Manager approval granted'
                                : isRejected
                                  ? 'Approval request rejected'
                                  : 'Operations Manager approval pending'}
                        </h2>
                        <p className="mt-0.5 text-xs leading-5">
                            {isApproved
                                ? 'The dispatch assignment has been approved by Operations. Field activation is unblocked.'
                                : isRejected
                                  ? `The approval request was rejected: ${activation.approval_reason || 'Revise the assignment plan and request a new review.'}`
                                  : 'Operations Manager approval is required before field activation.'}
                        </p>
                        {activation.approval_notes && (
                            <p className="mt-1 text-xs italic">
                                Note: {activation.approval_notes}
                            </p>
                        )}
                    </div>
                </div>

                {canDecide && isPending && (
                    <div className="flex flex-wrap items-center gap-2">
                        {deciding === null && (
                            <>
                                {activation.can_approve_and_activate ? (
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        disabled={submitting}
                                        onClick={() =>
                                            handleDecision('approved', true)
                                        }
                                    >
                                        <Check className="h-4 w-4" />
                                        {submitting
                                            ? 'Approving & activating…'
                                            : 'Approve & activate'}
                                    </Button>
                                ) : null}
                                <Button
                                    size="sm"
                                    variant={
                                        activation.can_approve_and_activate
                                            ? 'secondary'
                                            : 'primary'
                                    }
                                    disabled={submitting}
                                    onClick={() =>
                                        handleDecision('approved', false)
                                    }
                                >
                                    <Check className="h-4 w-4" />
                                    {submitting
                                        ? 'Approving…'
                                        : activation.can_approve_and_activate
                                          ? 'Approve only'
                                          : 'Approve request'}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={submitting}
                                    onClick={() => setDeciding('reject')}
                                >
                                    <X className="h-4 w-4" />
                                    Reject request
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {deciding === 'reject' && (
                <div className="mt-3 border-t border-danger/30 pt-3">
                    <label
                        htmlFor="rejection-decision-reason"
                        className="block text-xs font-semibold text-danger"
                    >
                        Rejection reason (required)
                    </label>
                    <textarea
                        id="rejection-decision-reason"
                        rows={2}
                        value={reason}
                        onChange={(e) => {
                            setReason(e.target.value);
                            setReasonError(null);
                        }}
                        className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-ink focus:border-danger focus:outline-none"
                        placeholder="Explain why this approval request cannot be granted..."
                        required
                    />
                    {reasonError && (
                        <p className="mt-1 text-xs text-danger" role="alert">
                            {reasonError}
                        </p>
                    )}
                    <div className="mt-2 flex gap-2">
                        <Button
                            size="sm"
                            variant="primary"
                            className="bg-danger text-white hover:bg-danger/90"
                            disabled={submitting || !reason.trim()}
                            onClick={() => handleDecision('rejected')}
                        >
                            {submitting ? 'Rejecting…' : 'Confirm rejection'}
                        </Button>
                        <Button
                            size="sm"
                            variant="quiet"
                            disabled={submitting}
                            onClick={() => {
                                setDeciding(null);
                                setReason('');
                                setReasonError(null);
                            }}
                        >
                            Dismiss
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
