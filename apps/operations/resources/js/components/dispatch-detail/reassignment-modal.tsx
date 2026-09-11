import { router } from '@inertiajs/react';
import React, { useState } from 'react';
import type {
    AssetCandidateViewModel,
    CandidatePageViewModel,
    DispatchDetailPageProps,
    PersonnelCandidateViewModel,
} from '@/types/workspace';
import { isCompatibleCandidate, ResourcePicker } from './resource-picker';
import type { ReassignmentTarget } from './resource-picker';

export function ReassignmentModal({
    job,
    target,
    personnelCandidates,
    assetCandidates,
    personnelPage,
    assetPage,
    onClose,
}: {
    job: DispatchDetailPageProps['job'];
    target: ReassignmentTarget;
    personnelCandidates: PersonnelCandidateViewModel[];
    assetCandidates: AssetCandidateViewModel[];
    personnelPage?: CandidatePageViewModel<PersonnelCandidateViewModel>;
    assetPage?: CandidatePageViewModel<AssetCandidateViewModel>;
    onClose: () => void;
}) {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedCandidate, setSelectedCandidate] = useState<
        PersonnelCandidateViewModel | AssetCandidateViewModel | null
    >(null);

    const handleSelection = (
        candidate: PersonnelCandidateViewModel | AssetCandidateViewModel,
    ) => {
        setSelectedCandidate(candidate);
    };

    const submit = () => {
        if (
            submitting ||
            selectedCandidate === null ||
            !selectedCandidate.eligible ||
            selectedCandidate.already_assigned ||
            !isCompatibleCandidate(selectedCandidate, target.type)
        ) {
            return;
        }

        setSubmitting(true);
        setError(null);

        const payload: Record<string, unknown> = {
            version: job.version,
            reason: reason.trim() || undefined,
        };

        if (target.kind === 'personnel' && !('code' in selectedCandidate)) {
            payload.end_personnel_assignment_ids = [target.id];
            payload.personnel = [
                {
                    user_id: selectedCandidate.id,
                    assignment_type: selectedCandidate.assignment_type,
                },
            ];
        } else if (target.kind === 'asset' && 'code' in selectedCandidate) {
            payload.end_asset_assignment_ids = [target.id];
            payload.assets = [
                {
                    operational_asset_id: selectedCandidate.id,
                    assignment_type: selectedCandidate.assignment_type,
                },
            ];
        } else {
            setError('Choose a compatible replacement before saving.');
            setSubmitting(false);

            return;
        }

        router.post(
            `/operations/dispatch-jobs/${job.id}/reassign`,
            payload as any,
            {
                preserveScroll: true,
                onSuccess: onClose,
                onError: (errors) => {
                    setError(
                        errors.reassignment ||
                            errors.resources ||
                            errors.personnel ||
                            errors.assets ||
                            errors.version ||
                            'Reassignment could not be saved. Review the candidate and try again.',
                    );
                },
                onFinish: () => setSubmitting(false),
            },
        );
    };

    const selectedPersonnelIds =
        target.kind === 'personnel' && selectedCandidate !== null
            ? [selectedCandidate.id]
            : [];
    const selectedAssetIds =
        target.kind === 'asset' && selectedCandidate !== null
            ? [selectedCandidate.id]
            : [];

    return (
        <ResourcePicker
            key={`${target.kind}-${target.id}`}
            open
            mode="replacement"
            job={job}
            target={target}
            personnelCandidates={personnelCandidates}
            assetCandidates={assetCandidates}
            personnelPage={personnelPage}
            assetPage={assetPage}
            selectedPersonnelIds={selectedPersonnelIds}
            selectedAssetIds={selectedAssetIds}
            canSelect
            onTogglePersonnel={handleSelection}
            onToggleAsset={handleSelection}
            onClose={onClose}
            onConfirm={submit}
            reason={reason}
            onReasonChange={setReason}
            submitting={submitting}
            error={error}
        />
    );
}
