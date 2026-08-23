import { router, useForm } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import type {
    AssetCandidateViewModel,
    PersonnelCandidateViewModel,
} from '@/types/workspace';
import type { AssignmentRequestPayload } from './types';

export function useDispatchAssignment(jobId: number) {
    const form = useForm<AssignmentRequestPayload>({
        personnel: [],
        assets: [],
    });
    const [activeStep, setActiveStep] = useState<1 | 2 | 3>(2);
    const selectedCount = form.data.personnel.length + form.data.assets.length;
    const hasPendingSelections = selectedCount > 0;
    const skipNextNavigationGuard = useRef(false);
    const bypassNavigationGuard = useRef(false);

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
        bypassNavigationGuard.current = true;
        form.post(`/operations/dispatch-jobs/${jobId}/assignments`, {
            preserveScroll: true,
            onSuccess: () => form.reset(),
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
        togglePersonnel,
        toggleAsset,
        submit,
        confirmLeave,
        bypassNavigationGuard,
    };
}
