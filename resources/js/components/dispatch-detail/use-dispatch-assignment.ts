import { router, useForm } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import type {
    AssetCandidateViewModel,
    PersonnelCandidateViewModel,
} from '@/types/workspace';
import type { AssignmentRequestPayload } from './types';

type CandidateSnapshotInputs = {
    personnel: PersonnelCandidateViewModel[];
    assets: AssetCandidateViewModel[];
};

type CandidateSnapshots = {
    personnel: Record<number, PersonnelCandidateViewModel>;
    assets: Record<number, AssetCandidateViewModel>;
};

function mergeCandidateDetails<T extends { id: number }>(
    current: T[],
    selected: T[],
): T[] {
    const byId = new Map(current.map((candidate) => [candidate.id, candidate]));

    selected.forEach((candidate) => {
        if (!byId.has(candidate.id)) {
            byId.set(candidate.id, candidate);
        }
    });

    return Array.from(byId.values());
}

export function useDispatchAssignment(
    jobId: number,
    candidates: CandidateSnapshotInputs,
) {
    const form = useForm<AssignmentRequestPayload>({
        personnel: [],
        assets: [],
    });
    const [activeStep, setActiveStep] = useState<1 | 2 | 3>(2);
    const selectedCount = form.data.personnel.length + form.data.assets.length;
    const hasPendingSelections = selectedCount > 0;
    const skipNextNavigationGuard = useRef(false);
    const bypassNavigationGuard = useRef(false);
    const [candidateSnapshots, setCandidateSnapshots] =
        useState<CandidateSnapshots>({ personnel: {}, assets: {} });

    const rememberPersonnelCandidates = useCallback(
        (seenCandidates: PersonnelCandidateViewModel[]) => {
            const selectedIds = new Set(
                form.data.personnel.map((assignment) => assignment.user_id),
            );

            setCandidateSnapshots((current) => {
                const personnel = { ...current.personnel };

                seenCandidates.forEach((candidate) => {
                    if (selectedIds.has(candidate.id)) {
                        personnel[candidate.id] = candidate;
                    }
                });
                Object.keys(personnel).forEach((id) => {
                    if (!selectedIds.has(Number(id))) {
                        delete personnel[Number(id)];
                    }
                });

                return { ...current, personnel };
            });
        },
        [form.data.personnel],
    );
    const rememberAssetCandidates = useCallback(
        (seenCandidates: AssetCandidateViewModel[]) => {
            const selectedIds = new Set(
                form.data.assets.map(
                    (assignment) => assignment.operational_asset_id,
                ),
            );

            setCandidateSnapshots((current) => {
                const assets = { ...current.assets };

                seenCandidates.forEach((candidate) => {
                    if (selectedIds.has(candidate.id)) {
                        assets[candidate.id] = candidate;
                    }
                });
                Object.keys(assets).forEach((id) => {
                    if (!selectedIds.has(Number(id))) {
                        delete assets[Number(id)];
                    }
                });

                return { ...current, assets };
            });
        },
        [form.data.assets],
    );

    const selectedPersonnelCandidates = useMemo(
        () =>
            form.data.personnel
                .map(
                    (assignment) =>
                        candidates.personnel.find(
                            (candidate) => candidate.id === assignment.user_id,
                        ) ?? candidateSnapshots.personnel[assignment.user_id],
                )
                .filter(
                    (candidate): candidate is PersonnelCandidateViewModel =>
                        candidate !== undefined,
                ),
        [
            candidates.personnel,
            candidateSnapshots.personnel,
            form.data.personnel,
        ],
    );
    const selectedAssetCandidates = useMemo(
        () =>
            form.data.assets
                .map(
                    (assignment) =>
                        candidates.assets.find(
                            (candidate) =>
                                candidate.id ===
                                assignment.operational_asset_id,
                        ) ??
                        candidateSnapshots.assets[
                            assignment.operational_asset_id
                        ],
                )
                .filter(
                    (candidate): candidate is AssetCandidateViewModel =>
                        candidate !== undefined,
                ),
        [candidates.assets, candidateSnapshots.assets, form.data.assets],
    );
    const personnelCandidatesForConsumers = useMemo(
        () =>
            mergeCandidateDetails(
                candidates.personnel,
                selectedPersonnelCandidates,
            ),
        [candidates.personnel, selectedPersonnelCandidates],
    );
    const assetCandidatesForConsumers = useMemo(
        () => mergeCandidateDetails(candidates.assets, selectedAssetCandidates),
        [candidates.assets, selectedAssetCandidates],
    );

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

        setCandidateSnapshots((current) => {
            if (selected) {
                const personnel = { ...current.personnel };
                delete personnel[candidate.id];

                return { ...current, personnel };
            }

            return {
                ...current,
                personnel: { ...current.personnel, [candidate.id]: candidate },
            };
        });
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

        setCandidateSnapshots((current) => {
            if (selected) {
                const assets = { ...current.assets };
                delete assets[candidate.id];

                return { ...current, assets };
            }

            return {
                ...current,
                assets: { ...current.assets, [candidate.id]: candidate },
            };
        });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        bypassNavigationGuard.current = true;
        form.post(`/operations/dispatch-jobs/${jobId}/assignments`, {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setCandidateSnapshots({ personnel: {}, assets: {} });
            },
            onFinish: () => {
                bypassNavigationGuard.current = false;
            },
        });
    };

    const confirmPendingNavigation = useCallback(() => {
        if (!hasPendingSelections) {
            return true;
        }

        if (
            window.confirm(
                'You have unsaved resource selections. Leave without assigning them?',
            )
        ) {
            skipNextNavigationGuard.current = true;

            return true;
        }

        return false;
    }, [hasPendingSelections]);

    const confirmLeave = (event: MouseEvent<Element>) => {
        if (!confirmPendingNavigation()) {
            event.preventDefault();
        }
    };

    useEffect(() => {
        if (!hasPendingSelections) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        const removeInertiaGuard = router.on('before', (event) => {
            if (bypassNavigationGuard.current) {
                bypassNavigationGuard.current = false;

                return;
            }

            if (skipNextNavigationGuard.current) {
                skipNextNavigationGuard.current = false;

                return;
            }

            if (!confirmPendingNavigation()) {
                event.preventDefault();
            }
        });

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            removeInertiaGuard();
        };
    }, [confirmPendingNavigation, hasPendingSelections]);

    return {
        form,
        activeStep,
        setActiveStep,
        selectedCount,
        hasPendingSelections,
        selectedPersonnelCandidates,
        selectedAssetCandidates,
        personnelCandidatesForConsumers,
        assetCandidatesForConsumers,
        rememberPersonnelCandidates,
        rememberAssetCandidates,
        togglePersonnel,
        toggleAsset,
        submit,
        confirmLeave,
        bypassNavigationGuard,
    };
}
