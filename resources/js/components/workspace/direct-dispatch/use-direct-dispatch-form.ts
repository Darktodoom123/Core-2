import { router, useForm } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
    deriveDirectDispatchIntakeData,
    getRecommendedRequirements,
    mergeSelectedRequirements,
} from './intake-data';
import type {
    DirectDispatchEquipmentSubtype,
    DirectDispatchFormData,
    DirectDispatchFormErrors,
    DirectDispatchWorkStream,
} from './types';

export const DIRECT_DISPATCH_FIELD_IDS: Record<string, string> = {
    client: 'direct-dispatch-client',
    title: 'direct-dispatch-scope',
    site: 'direct-dispatch-site',
    scheduled_start: 'direct-dispatch-scheduled-start',
    scheduled_end: 'direct-dispatch-scheduled-end',
    priority: 'direct-dispatch-priority',
    work_stream: 'direct-dispatch-work-stream',
    requirements: 'direct-dispatch-requirements',
    site_notes: 'direct-dispatch-site-notes',
};

const DIRECT_DISPATCH_ERROR_ORDER = [
    'client',
    'title',
    'site',
    'scheduled_start',
    'scheduled_end',
    'priority',
    'work_stream',
    'requirements',
    'site_notes',
];

const DEFAULT_FORM_DATA: DirectDispatchFormData = {
    client: '',
    title: '',
    site: '',
    scheduled_start: '',
    scheduled_end: '',
    priority: 'routine',
    work_stream: 'service',
    equipment_subtype: 'mobile_crane',
    site_notes: '',
    requirements: getRecommendedRequirements('service', 'mobile_crane'),
};

export const DIRECT_DISPATCH_DISCARD_MESSAGE =
    'Discard this direct dispatch draft? Unsaved details will be lost.';
export const DIRECT_DISPATCH_DISCARD_EVENT = 'direct-dispatch:discard';

function hasErrorForField(errors: DirectDispatchFormErrors, field: string) {
    return Boolean(
        errors[field] ||
        Object.keys(errors).some((key) => key.startsWith(`${field}.`)),
    );
}

export interface UseDirectDispatchFormOptions {
    initialData?: Partial<DirectDispatchFormData>;
    onDirtyChange?: (isDirty: boolean) => void;
    onSubmitted?: () => void;
}

export function useDirectDispatchForm({
    initialData,
    onDirtyChange,
    onSubmitted,
}: UseDirectDispatchFormOptions = {}) {
    const form = useForm<DirectDispatchFormData>({
        ...DEFAULT_FORM_DATA,
        ...initialData,
        requirements:
            initialData?.requirements ?? DEFAULT_FORM_DATA.requirements,
    });
    const [customRequirements, setCustomRequirements] = useState<string[]>(
        () => {
            const recommendedRequirements = getRecommendedRequirements(
                form.data.work_stream,
                form.data.equipment_subtype,
            );

            return form.data.requirements.filter(
                (requirement) => !recommendedRequirements.includes(requirement),
            );
        },
    );
    const [customRequirement, setCustomRequirement] = useState('');
    const submittingRef = useRef(false);

    const intakeData = useMemo(
        () => deriveDirectDispatchIntakeData(form.data, customRequirements),
        [customRequirements, form.data],
    );

    const isDirty = form.isDirty || customRequirement.trim() !== '';

    const focusFirstError = useCallback(
        (errors: DirectDispatchFormErrors = form.errors) => {
            if (typeof document === 'undefined') {
                return false;
            }

            const firstField = DIRECT_DISPATCH_ERROR_ORDER.find((field) =>
                hasErrorForField(errors, field),
            );
            const fieldId = firstField
                ? DIRECT_DISPATCH_FIELD_IDS[firstField]
                : null;
            const field = fieldId ? document.getElementById(fieldId) : null;

            if (!(field instanceof HTMLElement)) {
                return false;
            }

            field.focus({ preventScroll: false });

            return true;
        },
        [form.errors],
    );

    const setWorkStream = useCallback(
        (workStream: DirectDispatchWorkStream) => {
            const equipmentSubtype =
                workStream === 'service'
                    ? (form.data.equipment_subtype ?? 'mobile_crane')
                    : null;
            const selectedCustomRequirements = customRequirements.filter(
                (requirement) => form.data.requirements.includes(requirement),
            );

            form.setData('work_stream', workStream);
            form.setData('equipment_subtype', equipmentSubtype);
            form.setData(
                'requirements',
                mergeSelectedRequirements(
                    getRecommendedRequirements(workStream, equipmentSubtype),
                    selectedCustomRequirements,
                ),
            );
        },
        [customRequirements, form],
    );

    const setEquipmentSubtype = useCallback(
        (equipmentSubtype: DirectDispatchEquipmentSubtype) => {
            const selectedCustomRequirements = customRequirements.filter(
                (requirement) => form.data.requirements.includes(requirement),
            );

            form.setData('equipment_subtype', equipmentSubtype);
            form.setData(
                'requirements',
                mergeSelectedRequirements(
                    getRecommendedRequirements('service', equipmentSubtype),
                    selectedCustomRequirements,
                ),
            );
        },
        [customRequirements, form],
    );

    const toggleRequirement = useCallback(
        (requirement: string) => {
            form.setData(
                'requirements',
                form.data.requirements.includes(requirement)
                    ? form.data.requirements.filter(
                          (selectedRequirement) =>
                              selectedRequirement !== requirement,
                      )
                    : [...form.data.requirements, requirement],
            );
        },
        [form],
    );

    const toggleAllRecommended = useCallback(() => {
        const allSelected = intakeData.recommendedRequirements.every(
            (requirement) => form.data.requirements.includes(requirement),
        );

        form.setData(
            'requirements',
            allSelected
                ? form.data.requirements.filter(
                      (requirement) =>
                          !intakeData.recommendedRequirements.includes(
                              requirement,
                          ),
                  )
                : mergeSelectedRequirements(
                      form.data.requirements,
                      intakeData.recommendedRequirements,
                  ),
        );
    }, [form, intakeData.recommendedRequirements]);

    const addCustomRequirement = useCallback(() => {
        const trimmed = customRequirement.trim();

        if (!trimmed) {
            return false;
        }

        if (!customRequirements.includes(trimmed)) {
            setCustomRequirements((current) => [...current, trimmed]);
        }

        if (!form.data.requirements.includes(trimmed)) {
            form.setData('requirements', [...form.data.requirements, trimmed]);
        }

        setCustomRequirement('');

        return true;
    }, [customRequirement, customRequirements, form]);

    const removeCustomRequirement = useCallback(
        (requirement: string) => {
            setCustomRequirements((current) =>
                current.filter((item) => item !== requirement),
            );
            form.setData(
                'requirements',
                form.data.requirements.filter((item) => item !== requirement),
            );
        },
        [form],
    );

    const resetDraft = useCallback(() => {
        form.reset();
        setCustomRequirements([]);
        setCustomRequirement('');
    }, [form]);

    const submit = useCallback(
        (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();

            if (form.processing) {
                return;
            }

            submittingRef.current = true;
            form.post('/operations/dispatch-jobs', {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    resetDraft();
                    onSubmitted?.();
                },
                onError: (errors) => {
                    window.requestAnimationFrame(() => {
                        focusFirstError(errors as DirectDispatchFormErrors);
                    });
                },
                onFinish: () => {
                    submittingRef.current = false;
                },
            });
        },
        [focusFirstError, form, onSubmitted, resetDraft],
    );

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => {
        const handleDiscard = () => {
            if (isDirty) {
                resetDraft();
            }
        };

        window.addEventListener(DIRECT_DISPATCH_DISCARD_EVENT, handleDiscard);

        return () =>
            window.removeEventListener(
                DIRECT_DISPATCH_DISCARD_EVENT,
                handleDiscard,
            );
    }, [isDirty, resetDraft]);

    useEffect(() => {
        if (Object.keys(form.errors).length === 0) {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            focusFirstError();
        });

        return () => window.cancelAnimationFrame(frame);
    }, [focusFirstError, form.errors]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const removeInertiaListener = router.on('before', (event) => {
            if (!isDirty || submittingRef.current) {
                return;
            }

            // The inline Add Client flow intentionally keeps this draft mounted
            // and must not treat its own client-record submission as a discard.
            const visitUrl = event.detail.visit.url.toString();

            if (/\/operations\/clients(?:\?|$)/.test(visitUrl)) {
                return;
            }

            if (!window.confirm(DIRECT_DISPATCH_DISCARD_MESSAGE)) {
                event.preventDefault();

                return;
            }

            resetDraft();
        });

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!isDirty) {
                return;
            }

            event.preventDefault();
            event.returnValue = DIRECT_DISPATCH_DISCARD_MESSAGE;
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            removeInertiaListener();
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isDirty, resetDraft]);

    return {
        form,
        intakeData,
        customRequirement,
        customRequirements,
        isDirty,
        setCustomRequirement,
        setEquipmentSubtype,
        setWorkStream,
        toggleRequirement,
        toggleAllRecommended,
        addCustomRequirement,
        removeCustomRequirement,
        resetDraft,
        focusFirstError,
        submit,
    };
}
