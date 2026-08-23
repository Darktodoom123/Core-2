import { router } from '@inertiajs/react';
import { X } from 'lucide-react';
import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui';
import { humanize } from '@/lib/formatters';
import type {
    AssetCandidateViewModel,
    DispatchDetailPageProps,
    PersonnelCandidateViewModel,
} from '@/types/workspace';

export function ReassignmentModal({
    job,
    target,
    personnelCandidates,
    assetCandidates,
    onClose,
}: {
    job: DispatchDetailPageProps['job'];
    target: {
        kind: 'personnel' | 'asset';
        id: number;
        name: string;
        type: string;
    };
    personnelCandidates: PersonnelCandidateViewModel[];
    assetCandidates: AssetCandidateViewModel[];
    onClose: () => void;
}) {
    const [selectedCandidateId, setSelectedCandidateId] = useState<number | ''>(
        '',
    );
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const eligiblePersonnel = personnelCandidates.filter(
        (c) =>
            c.eligible &&
            c.assignment_type === target.type &&
            !job.personnel_assignments.some((p) => p.user_id === c.id),
    );
    const eligibleAssets = assetCandidates.filter(
        (c) =>
            c.eligible &&
            c.assignment_type === target.type &&
            !job.asset_assignments.some((a) => a.operational_asset_id === c.id),
    );

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const payload: Record<string, unknown> = {
            version: job.version,
            reason: reason.trim() || undefined,
        };

        if (target.kind === 'personnel') {
            payload.end_personnel_assignment_ids = [target.id];

            if (selectedCandidateId !== '') {
                const candidate = personnelCandidates.find(
                    (c) => c.id === selectedCandidateId,
                );

                if (candidate) {
                    payload.personnel = [
                        {
                            user_id: candidate.id,
                            assignment_type: candidate.assignment_type,
                        },
                    ];
                }
            }
        } else {
            payload.end_asset_assignment_ids = [target.id];

            if (selectedCandidateId !== '') {
                const candidate = assetCandidates.find(
                    (c) => c.id === selectedCandidateId,
                );

                if (candidate) {
                    payload.assets = [
                        {
                            operational_asset_id: candidate.id,
                            assignment_type: candidate.assignment_type,
                        },
                    ];
                }
            }
        }

        router.post(
            `/operations/dispatch-jobs/${job.id}/reassign`,
            payload as any,
            {
                preserveScroll: true,
                onSuccess: () => onClose(),
                onError: (errs) => {
                    setError(
                        errs.reassignment ||
                            errs.resources ||
                            errs.version ||
                            'Reassignment could not be saved.',
                    );
                },
                onFinish: () => setSubmitting(false),
            },
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reassignment-modal-title"
        >
            <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-line pb-3">
                    <h3
                        id="reassignment-modal-title"
                        className="text-base font-semibold text-ink"
                    >
                        Reassign {target.name}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-ink-soft hover:bg-surface-subtle hover:text-ink"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                        <span className="sr-only">
                            Close reassignment modal
                        </span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <p className="text-xs text-ink-soft">
                        Ending active {target.kind} assignment for{' '}
                        <span className="font-semibold text-ink">
                            {target.name}
                        </span>{' '}
                        ({humanize(target.type)}). You can optionally assign an
                        eligible replacement.
                    </p>

                    {error && (
                        <div
                            className="rounded-md border border-danger bg-danger-soft p-3 text-xs text-danger"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="replacement-candidate"
                            className="block text-xs font-semibold text-ink"
                        >
                            Replacement{' '}
                            {target.kind === 'personnel'
                                ? 'personnel'
                                : 'asset'}{' '}
                            (optional)
                        </label>
                        <select
                            id="replacement-candidate"
                            value={selectedCandidateId}
                            onChange={(e) =>
                                setSelectedCandidateId(
                                    e.target.value === ''
                                        ? ''
                                        : Number(e.target.value),
                                )
                            }
                            className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                        >
                            <option value="">
                                No replacement (end assignment only)
                            </option>
                            {target.kind === 'personnel'
                                ? eligiblePersonnel.map((c) => (
                                      <option key={c.id} value={c.id}>
                                          {c.name} ({c.account_status.label})
                                      </option>
                                  ))
                                : eligibleAssets.map((c) => (
                                      <option key={c.id} value={c.id}>
                                          {c.code} · {c.name} (
                                          {c.readiness.label})
                                      </option>
                                  ))}
                        </select>
                        {(target.kind === 'personnel'
                            ? eligiblePersonnel.length === 0
                            : eligibleAssets.length === 0) && (
                            <p className="mt-1 text-xs text-ink-soft">
                                No other eligible {humanize(target.type)}{' '}
                                resources available for this scheduled window.
                            </p>
                        )}
                    </div>

                    <div>
                        <label
                            htmlFor="reassignment-reason"
                            className="block text-xs font-semibold text-ink"
                        >
                            Reassignment reason / notes
                        </label>
                        <textarea
                            id="reassignment-reason"
                            rows={2}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="State the reason for reassigning this resource..."
                            className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                        />
                    </div>

                    <div className="flex justify-end gap-2 border-t border-line pt-3">
                        <Button
                            type="button"
                            variant="quiet"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={submitting}
                        >
                            {submitting ? 'Saving…' : 'Confirm reassignment'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
