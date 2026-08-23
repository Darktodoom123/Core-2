import type { Page } from '@inertiajs/core';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronDown,
    Circle,
    ClipboardList,
    Clock3,
    FileText,
    HardHat,
    ListChecks,
    MapPin,
    Navigation,
    RefreshCw,
    Search,
    ShieldCheck,
    Sparkles,
    Truck,
    UserRound,
    Users,
    Wrench,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { Button, DataPair, EmptyState, Panel, Skeleton } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { formatDateTime, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetCandidateViewModel,
    DispatchDetailPageProps,
    PersonnelCandidateViewModel,
    WorkspaceFlash,
} from '@/types/workspace';

interface AssignmentRequestPayload {
    personnel: Array<{
        user_id: number;
        assignment_type: PersonnelCandidateViewModel['assignment_type'];
    }>;
    assets: Array<{
        operational_asset_id: number;
        assignment_type: AssetCandidateViewModel['assignment_type'];
    }>;
}

export default function DispatchDetail({
    job,
    personnel_candidates: personnelCandidates,
    asset_candidates: assetCandidates,
    activation,
    progression,
    capabilities,
}: DispatchDetailPageProps) {
    const { flash, errors, auth } = usePage().props;
    const form = useForm<AssignmentRequestPayload>({
        personnel: [],
        assets: [],
    });
    const selectedCount = form.data.personnel.length + form.data.assets.length;
    const hasPendingSelections = selectedCount > 0;
    const assignmentSaved = isAssignmentSuccessFlash(flash);
    const hasCurrentAssignments =
        job.personnel_assignments.length + job.asset_assignments.length > 0;
    const hasAssignmentNextAction = assignmentSaved || hasCurrentAssignments;
    const returnTo = getSafeReturnTo();
    const canViewFleetAssets = auth.permissions.some((permission) =>
        ['fleet.view_all', 'fleet.view_assigned'].includes(permission),
    );
    const canViewEquipmentAssets = auth.permissions.some((permission) =>
        ['equipment.view_all', 'equipment.view_assigned'].includes(permission),
    );
    const skipNextNavigationGuard = useRef(false);
    const bypassNavigationGuard = useRef(false);
    const conflictMessage =
        errors.resources ??
        errors.reassignment ??
        errors.approval ??
        errors.version ??
        form.errors.personnel ??
        form.errors.assets ??
        null;

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
        form.post(`/operations/dispatch-jobs/${job.id}/assignments`, {
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

    const [activeStep, setActiveStep] = useState<1 | 2 | 3>(() => {
        if (typeof window !== 'undefined') {
            const hash = window.location.hash;

            if (hash === '#dispatch-context' || hash === '#step-1') {
                return 1;
            }

            if (hash === '#dispatch-activation' || hash === '#step-3') {
                return 3;
            }
        }

        return 2;
    });

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;

            if (hash === '#dispatch-context' || hash === '#step-1') {
                setActiveStep(1);
            } else if (hash === '#dispatch-activation' || hash === '#step-3') {
                setActiveStep(3);
            } else if (hash === '#step-2' || hash === '#assignment-summary') {
                setActiveStep(2);
            }
        };

        window.addEventListener('hashchange', handleHashChange);

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

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

    const handleMobileActivationAction = () => {
        const activationPanel = document.getElementById(
            'dispatch-activation',
        ) as HTMLDetailsElement | null;
        const activationButton = document.getElementById(
            `dispatch-activate-${job.id}`,
        ) as HTMLButtonElement | null;

        activationPanel?.setAttribute('open', '');

        if (activation.ready && capabilities.activate) {
            activationButton?.click();

            return;
        }

        activationPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.requestAnimationFrame(() => {
            activationPanel
                ?.querySelector<HTMLButtonElement>('button')
                ?.focus();
        });
    };

    return (
        <>
            <Head
                title={`${job.reference} ${capabilities.update_own_status ? 'assigned job' : 'assignment workspace'}`}
            />
            <div className="min-h-screen bg-canvas">
                <a
                    href="#dispatch-detail-main"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:ring-2 focus:ring-brand"
                >
                    Skip to main content
                </a>
                <header className="border-b border-line bg-surface">
                    <div className="mx-auto max-w-[96rem] px-4 py-4 md:px-6">
                        <Link
                            href={
                                capabilities.update_own_status ? '/' : returnTo
                            }
                            onClick={confirmLeave}
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
                                                    subject_type:
                                                        'dispatch_job',
                                                    subject_id: job.id,
                                                    purpose:
                                                        'dispatch_assignment',
                                                },
                                            );
                                        }}
                                    >
                                        <Sparkles className="h-4 w-4 text-brand" />
                                        Request AI assistance
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <main
                    id="dispatch-detail-main"
                    tabIndex={-1}
                    className={cn(
                        'mx-auto max-w-[96rem] space-y-5 px-4 py-5 outline-none md:px-6 md:py-6',
                        !capabilities.update_own_status &&
                            'pb-[calc(7rem+env(safe-area-inset-bottom))] xl:pb-6',
                    )}
                >
                    {flash && (
                        <div
                            className={cn(
                                'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
                                flash.tone === 'success' &&
                                    'border-success bg-success-soft text-success-strong',
                                flash.tone === 'warning' &&
                                    'border-warning bg-warning-soft text-warning-strong',
                                flash.tone === 'error' &&
                                    'border-danger bg-danger-soft text-danger',
                                flash.tone === 'info' &&
                                    'border-info bg-info-soft text-info-strong',
                            )}
                            role="status"
                            aria-live="polite"
                            aria-atomic="true"
                        >
                            <Check
                                className="mt-0.5 h-4 w-4 shrink-0"
                                aria-hidden="true"
                            />
                            {flash.message}
                        </div>
                    )}

                    {conflictMessage && (
                        <div
                            className="flex items-start gap-3 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm text-danger"
                            role="alert"
                            aria-live="assertive"
                            aria-atomic="true"
                        >
                            <AlertTriangle
                                className="mt-0.5 h-4 w-4 shrink-0"
                                aria-hidden="true"
                            />
                            <div>
                                <p className="font-semibold">
                                    Assignment could not be saved
                                </p>
                                <p className="mt-1">{conflictMessage}</p>
                                <p className="mt-1 text-xs">
                                    Eligibility was rechecked against the
                                    current schedule. Review the resource state
                                    below and try again.
                                </p>
                            </div>
                        </div>
                    )}

                    {capabilities.update_own_status && progression !== null ? (
                        <FieldJobWorkspace
                            job={job}
                            progression={progression}
                            capabilities={capabilities}
                            personnelCandidates={personnelCandidates}
                            assetCandidates={assetCandidates}
                        />
                    ) : (
                        <>
                            <AssignmentFlowHeader
                                job={job}
                                activation={activation}
                                selectedPersonnelCount={
                                    form.data.personnel.length
                                }
                                selectedAssetCount={form.data.assets.length}
                                canActivate={capabilities.activate}
                                hasPendingSelections={hasPendingSelections}
                                activeStep={activeStep}
                                onSelectStep={(step) => setActiveStep(step)}
                            />

                            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
                                <div className="min-w-0 space-y-5">
                                    {/* STEP 1: REVIEW CONTEXT */}
                                    {activeStep === 1 && (
                                        <div className="animate-in fade-in space-y-5 duration-150">
                                            <div className="flex items-center justify-between border-b border-line pb-3">
                                                <div>
                                                    <p className="text-xs font-semibold tracking-wider text-success-strong uppercase">
                                                        Step 1 of 3 · Context &
                                                        Requirements
                                                    </p>
                                                    <h2 className="mt-1 text-xl font-semibold text-ink">
                                                        Review dispatch
                                                        requirements
                                                    </h2>
                                                    <p className="mt-0.5 text-xs text-ink-soft">
                                                        Inspect the scheduled
                                                        window, site location,
                                                        client instructions, and
                                                        fulfillment scope.
                                                    </p>
                                                </div>
                                            </div>

                                            <DispatchContext job={job} />

                                            <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 shadow-2xs">
                                                <Link
                                                    href={returnTo}
                                                    onClick={confirmLeave}
                                                    className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink"
                                                >
                                                    <ArrowLeft className="h-4 w-4" />
                                                    Back to dispatch workspace
                                                </Link>
                                                <Button
                                                    type="button"
                                                    variant="primary"
                                                    onClick={() =>
                                                        setActiveStep(2)
                                                    }
                                                >
                                                    Next: Assign resources
                                                    <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 2: CHOOSE ELIGIBLE RESOURCES */}
                                    {activeStep === 2 && (
                                        <div className="animate-in fade-in space-y-5 duration-150">
                                            {capabilities.view_assignment_candidates ? (
                                                <form
                                                    id="assignment-selection-form"
                                                    onSubmit={submit}
                                                    className="space-y-6"
                                                    noValidate
                                                    aria-busy={form.processing}
                                                >
                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                                        <div>
                                                            <p className="text-xs font-semibold tracking-wider text-brand-strong uppercase">
                                                                Step 2 of 3 ·
                                                                Resource
                                                                Assignment
                                                            </p>
                                                            <h2 className="mt-1 text-xl font-semibold text-ink">
                                                                Choose eligible
                                                                resources
                                                            </h2>
                                                            <p className="mt-0.5 max-w-3xl text-xs leading-5 text-ink-soft">
                                                                Select the
                                                                people and
                                                                assets for this
                                                                dispatch. Every
                                                                option below is
                                                                checked against
                                                                the scheduled
                                                                window by the
                                                                server.
                                                            </p>
                                                        </div>
                                                        <a
                                                            href="#assignment-summary"
                                                            className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-lg px-3 text-sm font-medium text-brand-strong transition-colors hover:bg-brand-soft sm:self-auto"
                                                        >
                                                            Review selection
                                                            <ArrowRight
                                                                className="h-4 w-4"
                                                                aria-hidden="true"
                                                            />
                                                        </a>
                                                    </div>

                                                    <section
                                                        aria-labelledby="personnel-heading"
                                                        className="space-y-3"
                                                    >
                                                        <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                                                            <div>
                                                                <h3
                                                                    id="personnel-heading"
                                                                    className="font-semibold text-ink"
                                                                >
                                                                    People
                                                                </h3>
                                                                <p className="mt-0.5 text-xs text-ink-soft">
                                                                    Field
                                                                    workers and
                                                                    certified
                                                                    operators
                                                                    who can
                                                                    respond to
                                                                    this
                                                                    assignment.
                                                                </p>
                                                            </div>
                                                            <Users
                                                                className="h-5 w-5 shrink-0 text-ink-soft"
                                                                aria-hidden="true"
                                                            />
                                                        </div>
                                                        <PersonnelCandidates
                                                            candidates={
                                                                personnelCandidates
                                                            }
                                                            selectedIds={form.data.personnel.map(
                                                                (assignment) =>
                                                                    assignment.user_id,
                                                            )}
                                                            canAssign={
                                                                capabilities.assign_resources
                                                            }
                                                            onToggle={
                                                                togglePersonnel
                                                            }
                                                        />
                                                    </section>

                                                    <section
                                                        aria-labelledby="asset-heading"
                                                        className="space-y-3"
                                                    >
                                                        <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                                                            <div>
                                                                <h3
                                                                    id="asset-heading"
                                                                    className="font-semibold text-ink"
                                                                >
                                                                    Assets
                                                                </h3>
                                                                <p className="mt-0.5 text-xs text-ink-soft">
                                                                    Trucks,
                                                                    cranes, and
                                                                    equipment
                                                                    ready for
                                                                    the window.
                                                                </p>
                                                            </div>
                                                            <Truck
                                                                className="h-5 w-5 shrink-0 text-ink-soft"
                                                                aria-hidden="true"
                                                            />
                                                        </div>
                                                        <AssetCandidates
                                                            candidates={
                                                                assetCandidates
                                                            }
                                                            selectedIds={form.data.assets.map(
                                                                (assignment) =>
                                                                    assignment.operational_asset_id,
                                                            )}
                                                            canAssign={
                                                                capabilities.assign_resources
                                                            }
                                                            onToggle={
                                                                toggleAsset
                                                            }
                                                            assetCatalogAccess={{
                                                                fleet: canViewFleetAssets,
                                                                equipment:
                                                                    canViewEquipmentAssets,
                                                            }}
                                                        />
                                                    </section>

                                                    <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 shadow-2xs">
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            onClick={() =>
                                                                setActiveStep(1)
                                                            }
                                                        >
                                                            <ArrowLeft className="h-4 w-4" />
                                                            Previous: Review
                                                            context
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="primary"
                                                            onClick={() =>
                                                                setActiveStep(3)
                                                            }
                                                        >
                                                            Next: Activation
                                                            review
                                                            <ArrowRight className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <Panel>
                                                    <EmptyState
                                                        icon={ShieldCheck}
                                                        title="Assignment pool is restricted"
                                                        message="Your role can review resources already assigned to this dispatch, but it cannot discover other personnel, credentials, or asset availability."
                                                    />
                                                </Panel>
                                            )}
                                        </div>
                                    )}

                                    {/* STEP 3: ACTIVATION & APPROVALS */}
                                    {activeStep === 3 && (
                                        <div className="animate-in fade-in space-y-5 duration-150">
                                            <div className="flex items-center justify-between border-b border-line pb-3">
                                                <div>
                                                    <p className="text-xs font-semibold tracking-wider text-brand-strong uppercase">
                                                        Step 3 of 3 · Activation
                                                        & Readiness
                                                    </p>
                                                    <h2 className="mt-1 text-xl font-semibold text-ink">
                                                        Review readiness &
                                                        activate dispatch
                                                    </h2>
                                                    <p className="mt-0.5 text-xs text-ink-soft">
                                                        Verify all operational
                                                        prerequisites, safety
                                                        certifications, and
                                                        manager approvals before
                                                        field dispatch.
                                                    </p>
                                                </div>
                                            </div>

                                            <ApprovalDecisionBanner
                                                job={job}
                                                activation={activation}
                                            />

                                            <div className="space-y-4 rounded-xl border border-line bg-surface p-5 shadow-2xs">
                                                <h3 className="text-base font-semibold text-ink">
                                                    Prerequisite readiness
                                                </h3>
                                                <ActivationPrerequisiteChecklist
                                                    job={job}
                                                    activation={activation}
                                                />

                                                {activation.blockers.length >
                                                    0 && (
                                                    <div className="space-y-1.5 rounded-lg border border-warning/40 bg-warning-soft/30 p-3">
                                                        <p className="text-xs font-semibold text-warning-strong">
                                                            Blocking activation
                                                            reasons
                                                        </p>
                                                        <ul className="space-y-1 text-xs text-warning-strong">
                                                            {activation.blockers.map(
                                                                (blocker) => (
                                                                    <li
                                                                        key={
                                                                            blocker
                                                                        }
                                                                        className="flex items-start gap-2"
                                                                    >
                                                                        <AlertTriangle
                                                                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                                                            aria-hidden="true"
                                                                        />
                                                                        <span>
                                                                            {
                                                                                blocker
                                                                            }
                                                                        </span>
                                                                    </li>
                                                                ),
                                                            )}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 shadow-2xs">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() =>
                                                        setActiveStep(2)
                                                    }
                                                >
                                                    <ArrowLeft className="h-4 w-4" />
                                                    Previous: Assign resources
                                                </Button>
                                                {activation.ready &&
                                                capabilities.activate ? (
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        className="bg-success-strong text-white hover:bg-success"
                                                        onClick={() => {
                                                            const activationButton =
                                                                document.getElementById(
                                                                    `dispatch-activate-${job.id}`,
                                                                ) as HTMLButtonElement | null;
                                                            activationButton?.click();
                                                        }}
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Activate dispatch now
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs font-semibold text-warning-strong">
                                                        {activation.blockers
                                                            .length > 0
                                                            ? `${activation.blockers.length} blocker(s) remaining`
                                                            : 'Assignments needed before activation'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <aside className="min-w-0 space-y-5 xl:sticky xl:top-24 xl:self-start">
                                    <AssignmentSelectionSummary
                                        formId={
                                            capabilities.view_assignment_candidates
                                                ? 'assignment-selection-form'
                                                : undefined
                                        }
                                        personnel={personnelCandidates.filter(
                                            (candidate) =>
                                                form.data.personnel.some(
                                                    (assignment) =>
                                                        assignment.user_id ===
                                                        candidate.id,
                                                ),
                                        )}
                                        assets={assetCandidates.filter(
                                            (candidate) =>
                                                form.data.assets.some(
                                                    (assignment) =>
                                                        assignment.operational_asset_id ===
                                                        candidate.id,
                                                ),
                                        )}
                                        selectedCount={selectedCount}
                                        processing={form.processing}
                                        canAssign={
                                            capabilities.assign_resources
                                        }
                                        currentPersonnelCount={
                                            job.personnel_assignments.length
                                        }
                                        currentAssetCount={
                                            job.asset_assignments.length
                                        }
                                        currentPersonnel={
                                            job.personnel_assignments
                                        }
                                        currentAssets={job.asset_assignments}
                                    />
                                    {hasAssignmentNextAction && (
                                        <AssignmentNextAction
                                            activation={activation}
                                            canActivate={capabilities.activate}
                                            assignmentSaved={assignmentSaved}
                                        />
                                    )}
                                    {capabilities.view_assignment_candidates && (
                                        <MobileAssignmentActionBar
                                            formId="assignment-selection-form"
                                            selectedCount={selectedCount}
                                            processing={form.processing}
                                            canAssign={
                                                capabilities.assign_resources
                                            }
                                            assignmentSaved={
                                                hasAssignmentNextAction
                                            }
                                            assignmentSavedThisVisit={
                                                assignmentSaved
                                            }
                                            activation={activation}
                                            canActivate={capabilities.activate}
                                            jobId={job.id}
                                            onActivationAction={
                                                handleMobileActivationAction
                                            }
                                        />
                                    )}
                                    <CurrentAssignments
                                        job={job}
                                        capabilities={capabilities}
                                        hasPendingSelections={
                                            hasPendingSelections
                                        }
                                        pendingSelectionCount={selectedCount}
                                        personnelCandidates={
                                            personnelCandidates
                                        }
                                        assetCandidates={assetCandidates}
                                    />
                                    {capabilities.activate && (
                                        <ActivationPanel
                                            key={job.version}
                                            job={job}
                                            activation={activation}
                                        />
                                    )}
                                </aside>
                            </div>
                            <AssignmentStageSummaries
                                activation={activation}
                                canActivate={capabilities.activate}
                                onSelectStep={(step) => setActiveStep(step)}
                            />
                            <LifecycleControlsPanel
                                key={`lifecycle-${job.version}`}
                                job={job}
                                capabilities={capabilities}
                            />
                        </>
                    )}
                </main>
            </div>
        </>
    );
}

function ApprovalDecisionBanner({
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

    // If approval is not currently pending/rejected/approved with an active request, don't show an alarm banner
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

function AssignmentFlowHeader({
    job,
    activation,
    selectedPersonnelCount,
    selectedAssetCount,
    canActivate,
    hasPendingSelections,
    activeStep,
    onSelectStep,
}: {
    job: DispatchDetailPageProps['job'];
    activation: DispatchDetailPageProps['activation'];
    selectedPersonnelCount: number;
    selectedAssetCount: number;
    canActivate: boolean;
    hasPendingSelections: boolean;
    activeStep: 1 | 2 | 3;
    onSelectStep: (step: 1 | 2 | 3) => void;
}) {
    const hasAssignments =
        job.personnel_assignments.length + job.asset_assignments.length > 0;
    const hasSavedAssignments = hasAssignments && !hasPendingSelections;
    const assignmentStepLabel = hasPendingSelections
        ? `${formatResourceCounts(selectedPersonnelCount, selectedAssetCount)} selected`
        : hasSavedAssignments
          ? `${formatResourceCounts(job.personnel_assignments.length, job.asset_assignments.length)} assigned`
          : 'Select eligible personnel and assets';

    return (
        <section aria-label="Dispatch setup progress" className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 className="text-xl font-semibold text-ink">
                    Prepare this dispatch for activation
                </h2>
                <p className="text-xs font-medium text-ink-soft">
                    {hasSavedAssignments
                        ? activation.ready
                            ? 'Ready to activate'
                            : 'Review needed'
                        : 'Assignments pending'}
                </p>
            </div>

            <nav
                aria-label="Dispatch setup progress"
                className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs"
            >
                <ol className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
                    <li
                        aria-current={activeStep === 1 ? 'step' : undefined}
                        className={cn(
                            activeStep === 1 && 'relative bg-brand-soft/40',
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => onSelectStep(1)}
                            className="group flex min-h-20 w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-subtle sm:px-5"
                        >
                            <span
                                className={cn(
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-xs ring-2',
                                    activeStep === 1
                                        ? 'bg-brand text-brand-contrast ring-brand/30'
                                        : 'bg-success-soft text-success-strong ring-success/20',
                                )}
                            >
                                {activeStep === 1 ? (
                                    '1'
                                ) : (
                                    <Check
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                )}
                            </span>
                            <span className="min-w-0">
                                <span
                                    className={cn(
                                        'block text-[11px] font-semibold tracking-wider uppercase',
                                        activeStep === 1
                                            ? 'text-brand-strong'
                                            : 'text-success-strong',
                                    )}
                                >
                                    {activeStep === 1
                                        ? 'Step 1 · Current step'
                                        : 'Step 1 · Completed'}
                                </span>
                                <span className="block font-semibold text-ink transition-colors group-hover:text-brand-strong">
                                    Review dispatch
                                </span>
                                <span className="block truncate text-xs text-ink-soft">
                                    Context and requirements
                                </span>
                            </span>
                        </button>
                    </li>

                    <li
                        aria-current={activeStep === 2 ? 'step' : undefined}
                        className={cn(
                            activeStep === 2 && 'relative bg-brand-soft/40',
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => onSelectStep(2)}
                            className="group flex min-h-20 w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-subtle sm:px-5"
                        >
                            <span
                                className={cn(
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-xs ring-2',
                                    activeStep === 2
                                        ? 'bg-brand text-brand-contrast ring-brand/30'
                                        : hasAssignments
                                          ? 'bg-success-soft text-success-strong ring-success/20'
                                          : 'border border-line-strong bg-surface text-ink-soft',
                                )}
                            >
                                {activeStep === 2 ? (
                                    '2'
                                ) : hasAssignments ? (
                                    <Check
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    '2'
                                )}
                            </span>
                            <span className="min-w-0">
                                <span
                                    className={cn(
                                        'block text-[11px] font-semibold tracking-wider uppercase',
                                        activeStep === 2
                                            ? 'text-brand-strong'
                                            : 'text-ink-soft',
                                    )}
                                >
                                    {activeStep === 2
                                        ? 'Step 2 · Current step'
                                        : hasAssignments
                                          ? 'Step 2 · Assigned'
                                          : 'Step 2 · Pending'}
                                </span>
                                <span className="block font-semibold text-ink transition-colors group-hover:text-brand-strong">
                                    Assign resources
                                </span>
                                <span
                                    className={cn(
                                        'block truncate text-xs font-medium',
                                        activeStep === 2
                                            ? 'text-brand-strong'
                                            : 'text-ink-soft',
                                    )}
                                >
                                    {assignmentStepLabel}
                                </span>
                            </span>
                        </button>
                    </li>

                    <li
                        id="dispatch-activation-step"
                        aria-current={activeStep === 3 ? 'step' : undefined}
                        className={cn(
                            activeStep === 3 && 'relative bg-brand-soft/40',
                        )}
                    >
                        {canActivate ? (
                            <button
                                type="button"
                                onClick={() => onSelectStep(3)}
                                className="group flex min-h-20 w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-subtle sm:px-5"
                            >
                                <span
                                    className={cn(
                                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-xs ring-2',
                                        activeStep === 3
                                            ? 'bg-brand text-brand-contrast ring-brand/30'
                                            : 'border border-line-strong bg-surface text-ink-soft group-hover:border-brand-strong group-hover:text-brand-strong',
                                    )}
                                >
                                    3
                                </span>
                                <span className="min-w-0">
                                    <span
                                        className={cn(
                                            'block text-[11px] font-semibold tracking-wider uppercase',
                                            activeStep === 3
                                                ? 'text-brand-strong'
                                                : 'text-ink-soft',
                                        )}
                                    >
                                        {activeStep === 3
                                            ? 'Step 3 · Current step'
                                            : 'Step 3 · Next step'}
                                    </span>
                                    <span className="block font-semibold text-ink transition-colors group-hover:text-brand-strong">
                                        Activate dispatch
                                    </span>
                                    <span className="block truncate text-xs text-ink-soft">
                                        {activation.ready
                                            ? 'Ready to activate'
                                            : 'Server readiness check'}
                                    </span>
                                </span>
                            </button>
                        ) : (
                            <div className="flex min-h-20 items-center gap-3.5 px-4 py-3.5 opacity-60 sm:px-5">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-soft">
                                    3
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[11px] font-semibold tracking-wider text-ink-soft uppercase">
                                        Step 3 · Next step
                                    </span>
                                    <span className="block font-semibold text-ink">
                                        Activate dispatch
                                    </span>
                                    <span className="block truncate text-xs text-ink-soft">
                                        Requires activation permission
                                    </span>
                                </span>
                            </div>
                        )}
                    </li>
                </ol>
            </nav>
        </section>
    );
}

function AssignmentSelectionSummary({
    formId,
    personnel,
    assets,
    selectedCount,
    processing,
    canAssign,
    currentPersonnelCount,
    currentAssetCount,
    currentPersonnel,
    currentAssets,
}: {
    formId?: string;
    personnel: PersonnelCandidateViewModel[];
    assets: AssetCandidateViewModel[];
    selectedCount: number;
    processing: boolean;
    canAssign: boolean;
    currentPersonnelCount: number;
    currentAssetCount: number;
    currentPersonnel: DispatchDetailPageProps['job']['personnel_assignments'];
    currentAssets: DispatchDetailPageProps['job']['asset_assignments'];
}) {
    const hasDraftSelections = selectedCount > 0;
    const currentCount = currentPersonnelCount + currentAssetCount;
    const hasSavedAssignments = currentCount > 0;
    const summaryTitle = hasDraftSelections
        ? hasSavedAssignments
            ? 'Update assignment'
            : 'Draft assignment'
        : hasSavedAssignments
          ? 'Assigned resources'
          : 'Assignment plan';
    const summaryDescription = hasDraftSelections
        ? hasSavedAssignments
            ? 'Review the new resources before saving this assignment update.'
            : 'These selections are not saved yet. Review them before assigning.'
        : hasSavedAssignments
          ? 'Saved personnel and assets for this dispatch.'
          : 'Select eligible resources, then save them to this dispatch.';
    const visibleCount = hasDraftSelections ? selectedCount : currentCount;
    const visibleCountLabel = hasDraftSelections
        ? `new resource${selectedCount === 1 ? '' : 's'} selected`
        : hasSavedAssignments
          ? `resource${currentCount === 1 ? '' : 's'} assigned`
          : 'resources selected';

    const totalPeople = currentPersonnelCount + personnel.length;
    const totalAssets = currentAssetCount + assets.length;

    return (
        <Panel
            id="assignment-summary"
            className="overflow-hidden border-brand/40 shadow-sm"
        >
            <div className="border-b border-line bg-surface px-4 py-4">
                <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                        {hasSavedAssignments && !hasDraftSelections ? (
                            <CheckCircle2
                                className="h-5 w-5"
                                aria-hidden="true"
                            />
                        ) : (
                            <ListChecks
                                className="h-5 w-5"
                                aria-hidden="true"
                            />
                        )}
                    </span>
                    <div>
                        <h2 className="text-base font-semibold text-ink">
                            {summaryTitle}
                        </h2>
                        <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                            {summaryDescription}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4 px-4 py-4">
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight text-ink">
                        {visibleCount}
                    </span>
                    <span className="text-sm font-medium text-ink-soft">
                        {visibleCountLabel}
                    </span>
                </div>

                {/* Live Requirements Tracker */}
                <div className="space-y-2 rounded-lg border border-line bg-surface-subtle/50 p-3">
                    <p className="text-[11px] font-semibold tracking-wider text-ink-soft uppercase">
                        Readiness targets
                    </p>
                    <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-ink">
                                <Users className="h-3.5 w-3.5 text-ink-soft" />
                                Field Personnel
                            </span>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1 font-semibold',
                                    totalPeople > 0
                                        ? 'text-success-strong'
                                        : 'text-warning-strong',
                                )}
                            >
                                {totalPeople > 0 ? (
                                    <>
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {totalPeople} ready
                                    </>
                                ) : (
                                    <>
                                        <Circle className="h-3.5 w-3.5 opacity-60" />
                                        1 required
                                    </>
                                )}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-ink">
                                <Truck className="h-3.5 w-3.5 text-ink-soft" />
                                Operational Asset
                            </span>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1 font-semibold',
                                    totalAssets > 0
                                        ? 'text-success-strong'
                                        : 'text-warning-strong',
                                )}
                            >
                                {totalAssets > 0 ? (
                                    <>
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {totalAssets} ready
                                    </>
                                ) : (
                                    <>
                                        <Circle className="h-3.5 w-3.5 opacity-60" />
                                        1 required
                                    </>
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2.5 text-sm">
                    <AssignmentRequirementRow
                        label="People"
                        count={currentPersonnelCount}
                        draftCount={personnel.length}
                    />
                    <AssignmentRequirementRow
                        label="Assets"
                        count={currentAssetCount}
                        draftCount={assets.length}
                    />
                </div>

                {hasSavedAssignments && (
                    <div className="space-y-3 border-t border-line pt-3">
                        <p className="text-xs font-semibold text-ink-soft">
                            Currently assigned
                        </p>
                        <SelectionGroup
                            label="People"
                            items={currentPersonnel.map(
                                (assignment) =>
                                    assignment.name +
                                    ' / ' +
                                    humanize(assignment.type) +
                                    ' / ' +
                                    assignment.response_status.label,
                            )}
                            emptyMessage="No people assigned"
                        />
                        <SelectionGroup
                            label="Assets"
                            items={currentAssets.map(
                                (assignment) =>
                                    assignment.code +
                                    ' / ' +
                                    assignment.name +
                                    ' / ' +
                                    humanize(assignment.type),
                            )}
                            emptyMessage="No assets assigned"
                        />
                    </div>
                )}

                {hasDraftSelections && (
                    <div className="space-y-3 border-t border-line pt-3">
                        <p className="text-xs font-semibold text-ink-soft">
                            Pending changes
                        </p>
                        <SelectionGroup
                            label="People to add"
                            items={personnel.map((candidate) => candidate.name)}
                            emptyMessage="No people selected"
                        />
                        <SelectionGroup
                            label="Assets to add"
                            items={assets.map(
                                (candidate) =>
                                    candidate.code + ' / ' + candidate.name,
                            )}
                            emptyMessage="No assets selected"
                        />
                    </div>
                )}
            </div>

            {(!hasSavedAssignments || hasDraftSelections) && (
                <div className="border-t border-line bg-surface-subtle px-4 py-4">
                    <Button
                        type="submit"
                        form={formId}
                        variant="primary"
                        className="w-full"
                        disabled={
                            processing || selectedCount === 0 || !canAssign
                        }
                        aria-busy={processing}
                    >
                        {processing
                            ? 'Saving assignments…'
                            : selectedCount > 0
                              ? `Assign ${selectedCount} resource${selectedCount === 1 ? '' : 's'}`
                              : 'Select resources to continue'}
                    </Button>
                    <p className="mt-2 text-center text-xs leading-5 text-ink-soft">
                        {canAssign
                            ? 'At least one eligible resource is required. Activation also needs one person and one asset.'
                            : 'Your role can review this dispatch but cannot create assignments.'}
                    </p>
                </div>
            )}
        </Panel>
    );
}

function AssignmentRequirementRow({
    label,
    count,
    draftCount = 0,
}: {
    label: string;
    count: number;
    draftCount?: number;
}) {
    const ready = count > 0;

    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-ink-soft">{label}</span>
            <span className="inline-flex items-center gap-2 font-medium">
                <span
                    className={cn(
                        'inline-flex items-center gap-1 font-medium',
                        ready ? 'text-success-strong' : 'text-warning-strong',
                    )}
                >
                    {ready ? (
                        <CheckCircle2
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                        />
                    ) : (
                        <Circle
                            className="h-3.5 w-3.5 opacity-60"
                            aria-hidden="true"
                        />
                    )}
                    {count} assigned
                </span>
                {draftCount > 0 && (
                    <span className="font-semibold text-brand-strong">
                        · {draftCount} new
                    </span>
                )}
            </span>
        </div>
    );
}

function AssignmentNextAction({
    activation,
    canActivate,
    assignmentSaved,
}: {
    activation: DispatchDetailPageProps['activation'];
    canActivate: boolean;
    assignmentSaved: boolean;
}) {
    return (
        <Panel className="border-brand/40 bg-brand-soft/20 p-4 shadow-2xs">
            <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-ink">
                    <Check className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                        {assignmentSaved
                            ? 'Assignments recorded'
                            : 'Ready for next step'}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                        {activation.ready && canActivate
                            ? 'All prerequisites met. You can now activate this dispatch.'
                            : 'Review the latest readiness and approval state before activation.'}
                    </p>
                </div>
            </div>
        </Panel>
    );
}

function AssignmentStageSummaries({
    activation,
    canActivate,
    onSelectStep,
}: {
    activation: DispatchDetailPageProps['activation'];
    canActivate: boolean;
    onSelectStep?: (step: 1 | 2 | 3) => void;
}) {
    const blockerCount = activation.blockers.length;

    return (
        <section
            aria-label="Dispatch setup stage summaries"
            className="overflow-hidden rounded-xl border border-line bg-surface shadow-2xs"
        >
            <a
                href="#dispatch-context"
                onClick={(e) => {
                    if (onSelectStep) {
                        e.preventDefault();
                        onSelectStep(1);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }}
                className="flex min-h-16 items-center justify-between gap-4 border-b border-line px-4 py-3 transition-colors hover:bg-surface-subtle sm:px-5"
            >
                <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-strong ring-2 ring-success/20">
                        <Check className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                        <span className="block font-semibold text-ink">
                            Review dispatch details
                        </span>
                        <span className="block truncate text-xs text-ink-soft">
                            Schedule, site, and requirements
                        </span>
                    </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-strong">
                    View details
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
            </a>
            {canActivate && (
                <a
                    href="#dispatch-activation"
                    onClick={(e) => {
                        if (onSelectStep) {
                            e.preventDefault();
                            onSelectStep(3);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        } else {
                            const activationPanel = document.getElementById(
                                'dispatch-activation',
                            ) as HTMLDetailsElement | null;
                            activationPanel?.setAttribute('open', '');
                            activationPanel?.scrollIntoView({
                                behavior: 'smooth',
                            });
                        }
                    }}
                    className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-surface-subtle sm:px-5"
                >
                    <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-soft">
                            3
                        </span>
                        <span className="min-w-0">
                            <span className="block font-semibold text-ink">
                                Activate dispatch
                            </span>
                            <span className="block truncate text-xs text-ink-soft">
                                Review readiness and activate when ready
                            </span>
                        </span>
                    </span>
                    <span
                        className={cn(
                            'inline-flex shrink-0 items-center gap-1 text-sm font-medium',
                            activation.ready
                                ? 'text-success-strong'
                                : 'text-warning-strong',
                        )}
                    >
                        {activation.ready
                            ? 'Ready'
                            : blockerCount > 0
                              ? `${blockerCount} blocker${blockerCount === 1 ? '' : 's'}`
                              : 'Review needed'}
                        <ArrowRight
                            className="h-4 w-4 text-brand-strong"
                            aria-hidden="true"
                        />
                    </span>
                </a>
            )}
        </section>
    );
}

function MobileAssignmentActionBar({
    formId,
    selectedCount,
    processing,
    canAssign,
    assignmentSaved,
    assignmentSavedThisVisit,
    activation,
    canActivate,
    jobId,
    onActivationAction,
}: {
    formId: string;
    selectedCount: number;
    processing: boolean;
    canAssign: boolean;
    assignmentSaved: boolean;
    assignmentSavedThisVisit: boolean;
    activation: DispatchDetailPageProps['activation'];
    canActivate: boolean;
    jobId: number;
    onActivationAction: () => void;
}) {
    if (assignmentSaved) {
        const blockerCount = activation.blockers.length;
        const nextActionLabel =
            canActivate && activation.ready
                ? 'Activate dispatch'
                : blockerCount > 0
                  ? `Review ${blockerCount} blocker${blockerCount === 1 ? '' : 's'}`
                  : 'Review activation';

        return (
            <div
                id="mobile-assignment-action-bar"
                className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] xl:hidden"
            >
                <div className="mx-auto flex max-w-[96rem] items-center gap-3">
                    <p className="min-w-0 flex-1 text-sm text-ink-soft">
                        <span className="font-semibold text-success-strong">
                            {assignmentSavedThisVisit ? 'Saved' : 'Assigned'}
                        </span>{' '}
                        {canActivate && activation.ready
                            ? 'Ready for activation.'
                            : 'Continue with readiness review.'}
                    </p>
                    <Button
                        id={`mobile-activation-action-${jobId}`}
                        type="button"
                        variant="primary"
                        className="shrink-0"
                        onClick={onActivationAction}
                    >
                        {nextActionLabel}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div
            id="mobile-assignment-action-bar"
            className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] xl:hidden"
        >
            <div className="mx-auto flex max-w-[96rem] items-center gap-3">
                <p className="min-w-0 flex-1 text-sm text-ink-soft">
                    <span className="font-semibold text-ink">
                        {selectedCount}
                    </span>{' '}
                    selected
                </p>
                <Button
                    type="submit"
                    form={formId}
                    variant="primary"
                    className="shrink-0"
                    disabled={processing || selectedCount === 0 || !canAssign}
                    aria-busy={processing}
                >
                    {processing
                        ? 'Saving…'
                        : selectedCount > 0
                          ? 'Assign resources'
                          : 'Select resources'}
                </Button>
            </div>
        </div>
    );
}

function SelectionGroup({
    label,
    items,
    emptyMessage,
}: {
    label: string;
    items: string[];
    emptyMessage: string;
}) {
    return (
        <div>
            <p className="text-xs font-medium text-ink-soft">{label}</p>
            {items.length > 0 ? (
                <ul className="mt-1 space-y-1">
                    {items.map((item) => (
                        <li
                            key={item}
                            className="truncate text-xs font-medium text-ink"
                        >
                            • {item}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-1 text-xs text-ink-soft">{emptyMessage}</p>
            )}
        </div>
    );
}

function FieldJobWorkspace({
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

function FieldProgressionPanel({
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

function RequirementsPanel({ requirements }: { requirements: string[] }) {
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

function ActivationPanel({
    job,
    activation,
}: {
    job: DispatchDetailPageProps['job'];
    activation: DispatchDetailPageProps['activation'];
}) {
    const form = useForm({ version: job.version });
    const { errors } = usePage().props;
    const [attempted, setAttempted] = useState(false);
    const error = attempted
        ? (errors.version ??
          errors.approval ??
          errors.status ??
          errors.personnel ??
          errors.assets ??
          null)
        : null;
    const isStale = attempted && errors.version !== undefined;

    const activate = () => {
        form.post(`/operations/dispatch-jobs/${job.id}/activate`, {
            preserveScroll: true,
            onStart: () => setAttempted(true),
        });
    };

    const refresh = () => {
        setAttempted(false);
        form.clearErrors();
        router.reload({
            only: ['job', 'activation', 'capabilities'],
        });
    };

    return (
        <details
            id="dispatch-activation"
            className="group overflow-hidden rounded-xl border border-line bg-surface"
            aria-busy={form.processing}
        >
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-surface-subtle [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                    <span className="flex items-center gap-2">
                        <span className="font-semibold">Activate dispatch</span>
                        <span
                            className={cn(
                                'rounded-full px-2.5 py-1 text-xs font-medium',
                                activation.ready
                                    ? 'bg-success-soft text-success-strong'
                                    : 'bg-warning-soft text-warning-strong',
                            )}
                        >
                            {activation.ready ? 'Ready' : 'Review needed'}
                        </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-soft">
                        Review readiness and activate when ready
                    </span>
                </span>
                <ChevronDown
                    className="h-5 w-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180"
                    aria-hidden="true"
                />
            </summary>

            <div className="space-y-4 border-t border-line px-4 py-4">
                <div>
                    <p className="text-xs text-ink-soft">
                        Version {job.version} will be rechecked with current
                        approval and asset safety.
                    </p>
                </div>

                <ActivationPrerequisiteChecklist
                    job={job}
                    activation={activation}
                />

                {activation.blockers.length > 0 && (
                    <div className="space-y-1.5 rounded-lg border border-warning/40 bg-warning-soft/30 p-3">
                        <p className="text-xs font-semibold text-warning-strong">
                            Blocking activation reasons
                        </p>
                        <ul className="space-y-1 text-xs text-warning-strong">
                            {activation.blockers.map((blocker) => (
                                <li
                                    key={blocker}
                                    className="flex items-start gap-2"
                                >
                                    <AlertTriangle
                                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                        aria-hidden="true"
                                    />
                                    <span>{blocker}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {error && (
                    <div
                        className="rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger"
                        role="alert"
                        aria-live="assertive"
                        aria-atomic="true"
                    >
                        <p className="font-semibold">
                            {isStale
                                ? 'Dispatch changed — refresh before activating'
                                : 'Activation was blocked'}
                        </p>
                        <p className="mt-1">{error}</p>
                        {isStale && (
                            <Button
                                className="mt-3"
                                variant="secondary"
                                size="sm"
                                onClick={refresh}
                            >
                                <RefreshCw
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Refresh and review
                            </Button>
                        )}
                    </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                        variant="quiet"
                        size="sm"
                        onClick={refresh}
                        disabled={form.processing}
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Refresh readiness
                    </Button>
                    <Button
                        id={`dispatch-activate-${job.id}`}
                        variant="primary"
                        onClick={activate}
                        disabled={form.processing || !activation.ready}
                    >
                        {form.processing
                            ? 'Activating dispatch…'
                            : 'Activate dispatch'}
                    </Button>
                </div>
            </div>
        </details>
    );
}

function ActivationPrerequisiteChecklist({
    job,
    activation,
}: {
    job: DispatchDetailPageProps['job'];
    activation: DispatchDetailPageProps['activation'];
}) {
    const isActivatableStatus = [
        'draft',
        'pending_approval',
        'scheduled',
    ].includes(job.status.value);
    const hasPersonnel = job.personnel_assignments.length > 0;
    const hasAssets = job.asset_assignments.length > 0;
    const approvalPassed =
        !activation.approval_required ||
        activation.approval_status === 'approved';

    const items = [
        {
            title: 'Lifecycle status',
            desc: isActivatableStatus
                ? `Job is currently in ${job.status.label} status.`
                : `Job is in ${job.status.label} status (activation unavailable).`,
            ready: isActivatableStatus,
        },
        {
            title: 'Personnel assignment',
            desc: hasPersonnel
                ? `${job.personnel_assignments.length} field worker(s) assigned.`
                : 'At least one active eligible field worker is required.',
            ready:
                hasPersonnel &&
                !activation.blockers.some(
                    (b) => b.includes('worker') || b.includes('eligible'),
                ),
        },
        {
            title: 'Asset assignment & safety',
            desc: hasAssets
                ? `${job.asset_assignments.length} asset(s) assigned.`
                : 'At least one active safe asset (crane/truck) is required.',
            ready:
                hasAssets &&
                !activation.blockers.some(
                    (b) => b.includes('Asset') || b.includes('safe'),
                ),
        },
        {
            title: 'Operations Manager approval',
            desc:
                activation.approval_status === 'approved'
                    ? 'Operations Manager approval granted.'
                    : activation.approval_status === 'rejected'
                      ? 'Approval request was rejected.'
                      : 'Awaiting Operations Manager approval decision.',
            ready: approvalPassed,
        },
    ];

    return (
        <div className="space-y-2 rounded-lg border border-line bg-surface-subtle/50 p-3">
            <p className="text-xs font-semibold text-ink">
                Activation prerequisites
            </p>
            <ul className="space-y-2 text-xs">
                {items.map((item) => (
                    <li key={item.title} className="flex items-start gap-2">
                        {item.ready ? (
                            <CheckCircle2
                                className="mt-0.5 h-4 w-4 shrink-0 text-success-strong"
                                aria-hidden="true"
                            />
                        ) : (
                            <AlertTriangle
                                className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong"
                                aria-hidden="true"
                            />
                        )}
                        <div>
                            <span
                                className={cn(
                                    'font-medium',
                                    item.ready
                                        ? 'text-ink'
                                        : 'text-warning-strong',
                                )}
                            >
                                {item.title}:
                            </span>{' '}
                            <span className="text-ink-soft">{item.desc}</span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function LifecycleControlsPanel({
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

function DispatchContext({ job }: { job: DispatchDetailPageProps['job'] }) {
    return (
        <Panel id="dispatch-context" className="p-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-line pb-3">
                <h2 className="font-semibold text-ink">Dispatch context</h2>
                <span className="text-xs text-ink-soft">
                    Last updated: {formatDateTime(job.updated_at)}
                </span>
            </div>
            <dl className="mt-3 divide-y divide-line">
                <DataPair
                    label="Source"
                    value={
                        job.source
                            ? `${job.source.label}${job.source.reference ? ` · ${job.source.reference}` : ''}`
                            : 'Direct dispatch'
                    }
                />
                {job.source?.fulfillment_mode && (
                    <DataPair
                        label="Fulfillment"
                        value={humanize(job.source.fulfillment_mode)}
                    />
                )}
                <DataPair
                    label="Schedule"
                    value={
                        <span className="inline-flex items-start gap-2">
                            <CalendarDays
                                className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                                aria-hidden="true"
                            />
                            <span className="font-medium text-ink">
                                {formatDateTime(job.scheduled_start)} –{' '}
                                {formatDateTime(job.scheduled_end)}
                            </span>
                        </span>
                    }
                />
                <DataPair
                    label="Site"
                    value={
                        <span className="inline-flex items-start gap-2">
                            <MapPin
                                className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                                aria-hidden="true"
                            />
                            <span className="font-medium text-ink">
                                {job.site}
                            </span>
                        </span>
                    }
                />
            </dl>
            <div className="mt-4 rounded-lg border border-line bg-surface-subtle/80 p-3">
                <p className="text-xs font-semibold text-ink">Site note</p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                    {job.site_notes?.trim() ||
                        'No additional site instructions were recorded.'}
                </p>
            </div>
        </Panel>
    );
}

function CurrentAssignments({
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

function ReassignmentModal({
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

function PersonnelCandidates({
    candidates,
    selectedIds,
    canAssign,
    onToggle,
}: {
    candidates: PersonnelCandidateViewModel[];
    selectedIds: number[];
    canAssign: boolean;
    onToggle: (candidate: PersonnelCandidateViewModel) => void;
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showEligibleOnly, setShowEligibleOnly] = useState(false);

    const groups: Array<{
        type: PersonnelCandidateViewModel['assignment_type'];
        label: string;
    }> = [
        { type: 'driver', label: 'Drivers' },
        { type: 'crane_operator', label: 'Crane operators' },
        { type: 'field_technician', label: 'Field technicians' },
    ];

    const eligibleCount = candidates.filter((c) => c.eligible).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-subtle/50 px-3.5 py-2.5">
                <div className="relative max-w-sm min-w-[14rem] flex-1">
                    <Search
                        className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft"
                        aria-hidden="true"
                    />
                    <input
                        type="text"
                        placeholder="Search personnel by name or role…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md border border-line bg-surface py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-soft/70 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                        aria-label="Search personnel candidates"
                    />
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-ink-soft select-none hover:text-ink">
                        <input
                            type="checkbox"
                            checked={showEligibleOnly}
                            onChange={(e) =>
                                setShowEligibleOnly(e.target.checked)
                            }
                            className="h-4 w-4 rounded accent-brand"
                        />
                        <span>
                            Show eligible only ({eligibleCount}/
                            {candidates.length})
                        </span>
                    </label>
                </div>
            </div>

            <div className="grid gap-4 2xl:grid-cols-3">
                {groups.map((group) => {
                    const groupCandidates = candidates.filter(
                        (candidate) => candidate.assignment_type === group.type,
                    );
                    const filtered = groupCandidates.filter((c) => {
                        if (showEligibleOnly && !c.eligible) {
                            return false;
                        }

                        if (searchQuery.trim()) {
                            const q = searchQuery.toLowerCase();

                            return (
                                c.name.toLowerCase().includes(q) ||
                                c.assignment_label.toLowerCase().includes(q) ||
                                Boolean(
                                    c.credential.label &&
                                    c.credential.label
                                        .toLowerCase()
                                        .includes(q),
                                )
                            );
                        }

                        return true;
                    });

                    return (
                        <fieldset
                            key={group.type}
                            className="min-w-0 rounded-xl border border-line bg-surface shadow-2xs"
                        >
                            <legend className="sr-only">{group.label}</legend>
                            <div className="flex items-center justify-between border-b border-line px-4 py-3">
                                <div>
                                    <h3 className="text-sm font-semibold">
                                        {group.label}
                                    </h3>
                                    <p className="mt-0.5 text-xs text-ink-soft">
                                        {
                                            groupCandidates.filter(
                                                (resource) => resource.eligible,
                                            ).length
                                        }{' '}
                                        eligible of {groupCandidates.length}
                                    </p>
                                </div>
                                <span
                                    className={cn(
                                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                        groupCandidates.some((c) => c.eligible)
                                            ? 'bg-success-soft text-success-strong'
                                            : 'bg-surface-subtle text-ink-soft',
                                    )}
                                >
                                    {
                                        groupCandidates.filter(
                                            (c) => c.eligible,
                                        ).length
                                    }{' '}
                                    ready
                                </span>
                            </div>
                            {filtered.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={UserRound}
                                    title={
                                        groupCandidates.length === 0
                                            ? `No ${group.label.toLowerCase()}`
                                            : `No matching ${group.label.toLowerCase()}`
                                    }
                                    message={
                                        groupCandidates.length === 0
                                            ? 'Qualified personnel will appear after their operational role is provisioned.'
                                            : 'No candidates match the active filters.'
                                    }
                                />
                            ) : (
                                <ul className="divide-y divide-line">
                                    {filtered.map((candidate) => (
                                        <PersonnelCandidate
                                            key={candidate.id}
                                            candidate={candidate}
                                            selected={selectedIds.includes(
                                                candidate.id,
                                            )}
                                            canAssign={canAssign}
                                            onToggle={onToggle}
                                        />
                                    ))}
                                </ul>
                            )}
                        </fieldset>
                    );
                })}
            </div>
        </div>
    );
}

function PersonnelCandidate({
    candidate,
    selected,
    canAssign,
    onToggle,
}: {
    candidate: PersonnelCandidateViewModel;
    selected: boolean;
    canAssign: boolean;
    onToggle: (candidate: PersonnelCandidateViewModel) => void;
}) {
    const detailsId = `personnel-${candidate.id}-details`;

    return (
        <li
            className={cn(
                'p-4 transition-colors',
                selected && 'border-l-4 border-l-brand bg-brand-soft/50',
                !candidate.eligible && 'bg-surface-subtle/50',
            )}
        >
            <div className="flex min-h-11 items-start gap-1">
                {canAssign && (
                    <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-start justify-center pt-1">
                        <input
                            type="checkbox"
                            checked={selected}
                            disabled={!candidate.eligible}
                            onChange={() => onToggle(candidate)}
                            aria-describedby={detailsId}
                            className="h-5 w-5 cursor-pointer accent-[var(--color-brand)] disabled:cursor-not-allowed"
                        />
                        <span className="sr-only">
                            Select {candidate.name} as{' '}
                            {candidate.assignment_label}
                        </span>
                    </label>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <p
                            className={cn(
                                'font-medium',
                                candidate.eligible
                                    ? 'font-semibold text-ink'
                                    : 'text-ink-soft',
                            )}
                        >
                            {candidate.name}
                        </p>
                        <EligibilityBadge eligible={candidate.eligible} />
                    </div>
                    <div
                        id={detailsId}
                        className="mt-2 space-y-1 text-xs leading-5 text-ink-soft"
                    >
                        <p>
                            Availability: {candidate.availability.label} ·
                            Account: {candidate.account_status.label}
                        </p>
                        <p>{credentialSummary(candidate)}</p>
                        <ConflictDetails
                            reasons={candidate.reasons}
                            conflicts={candidate.schedule_conflicts}
                        />
                    </div>
                </div>
            </div>
        </li>
    );
}

function AssetCandidates({
    candidates,
    selectedIds,
    canAssign,
    onToggle,
    assetCatalogAccess,
}: {
    candidates: AssetCandidateViewModel[];
    selectedIds: number[];
    canAssign: boolean;
    onToggle: (candidate: AssetCandidateViewModel) => void;
    assetCatalogAccess: {
        fleet: boolean;
        equipment: boolean;
    };
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showEligibleOnly, setShowEligibleOnly] = useState(false);

    const groups: Array<{
        type: AssetCandidateViewModel['assignment_type'];
        label: string;
    }> = [
        { type: 'truck', label: 'Trucks' },
        { type: 'crane', label: 'Cranes' },
        { type: 'equipment', label: 'Equipment' },
    ];

    const eligibleCount = candidates.filter((c) => c.eligible).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-subtle/50 px-3.5 py-2.5">
                <div className="relative max-w-sm min-w-[14rem] flex-1">
                    <Search
                        className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft"
                        aria-hidden="true"
                    />
                    <input
                        type="text"
                        placeholder="Search assets by code or name…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md border border-line bg-surface py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-soft/70 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                        aria-label="Search asset candidates"
                    />
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-ink-soft select-none hover:text-ink">
                        <input
                            type="checkbox"
                            checked={showEligibleOnly}
                            onChange={(e) =>
                                setShowEligibleOnly(e.target.checked)
                            }
                            className="h-4 w-4 rounded accent-brand"
                        />
                        <span>
                            Show eligible only ({eligibleCount}/
                            {candidates.length})
                        </span>
                    </label>
                </div>
            </div>

            <div className="grid gap-4 2xl:grid-cols-3">
                {groups.map((group) => {
                    const groupCandidates = candidates.filter(
                        (candidate) => candidate.assignment_type === group.type,
                    );
                    const catalogAccess =
                        group.type === 'truck'
                            ? assetCatalogAccess.fleet
                            : assetCatalogAccess.equipment;
                    const catalogHref =
                        group.type === 'truck'
                            ? '/operations/fleet/assets'
                            : '/operations/equipment/assets';
                    const catalogLabel =
                        group.type === 'truck'
                            ? 'Open fleet asset catalog'
                            : 'Open equipment catalog';

                    const filtered = groupCandidates.filter((c) => {
                        if (showEligibleOnly && !c.eligible) {
                            return false;
                        }

                        if (searchQuery.trim()) {
                            const q = searchQuery.toLowerCase();

                            return (
                                c.code.toLowerCase().includes(q) ||
                                c.name.toLowerCase().includes(q) ||
                                c.assignment_label.toLowerCase().includes(q)
                            );
                        }

                        return true;
                    });

                    return (
                        <fieldset
                            key={group.type}
                            className="min-w-0 rounded-xl border border-line bg-surface shadow-2xs"
                        >
                            <legend className="sr-only">{group.label}</legend>
                            <div className="flex items-center justify-between border-b border-line px-4 py-3">
                                <div>
                                    <h3 className="text-sm font-semibold">
                                        {group.label}
                                    </h3>
                                    <p className="mt-0.5 text-xs text-ink-soft">
                                        {
                                            groupCandidates.filter(
                                                (resource) => resource.eligible,
                                            ).length
                                        }{' '}
                                        eligible of {groupCandidates.length}
                                    </p>
                                </div>
                                <span
                                    className={cn(
                                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                        groupCandidates.some((c) => c.eligible)
                                            ? 'bg-success-soft text-success-strong'
                                            : 'bg-surface-subtle text-ink-soft',
                                    )}
                                >
                                    {
                                        groupCandidates.filter(
                                            (c) => c.eligible,
                                        ).length
                                    }{' '}
                                    ready
                                </span>
                            </div>
                            {filtered.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={Truck}
                                    title={
                                        groupCandidates.length === 0
                                            ? `No ${group.label.toLowerCase()}`
                                            : `No matching ${group.label.toLowerCase()}`
                                    }
                                    message={
                                        catalogAccess
                                            ? 'No Core 3 assets in this category are available for this dispatch window.'
                                            : 'Ask the Core 3 asset administrator to import an eligible asset for this dispatch.'
                                    }
                                    primaryAction={
                                        catalogAccess ? (
                                            <Link
                                                href={catalogHref}
                                                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-subtle"
                                            >
                                                {catalogLabel}
                                            </Link>
                                        ) : undefined
                                    }
                                />
                            ) : (
                                <ul className="divide-y divide-line">
                                    {filtered.map((candidate) => (
                                        <AssetCandidate
                                            key={candidate.id}
                                            candidate={candidate}
                                            selected={selectedIds.includes(
                                                candidate.id,
                                            )}
                                            canAssign={canAssign}
                                            onToggle={onToggle}
                                        />
                                    ))}
                                </ul>
                            )}
                        </fieldset>
                    );
                })}
            </div>
        </div>
    );
}

function AssetCandidate({
    candidate,
    selected,
    canAssign,
    onToggle,
}: {
    candidate: AssetCandidateViewModel;
    selected: boolean;
    canAssign: boolean;
    onToggle: (candidate: AssetCandidateViewModel) => void;
}) {
    const detailsId = `asset-${candidate.id}-details`;

    return (
        <li
            className={cn(
                'p-4 transition-colors',
                selected && 'border-l-4 border-l-brand bg-brand-soft/50',
                !candidate.eligible && 'bg-surface-subtle/50',
            )}
        >
            <div className="flex min-h-11 items-start gap-1">
                {canAssign && (
                    <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-start justify-center pt-1">
                        <input
                            type="checkbox"
                            checked={selected}
                            disabled={!candidate.eligible}
                            onChange={() => onToggle(candidate)}
                            aria-describedby={detailsId}
                            className="h-5 w-5 cursor-pointer accent-[var(--color-brand)] disabled:cursor-not-allowed"
                        />
                        <span className="sr-only">
                            Select {candidate.code} · {candidate.name}
                        </span>
                    </label>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <p
                                className={cn(
                                    'font-medium',
                                    candidate.eligible
                                        ? 'font-semibold text-ink'
                                        : 'text-ink-soft',
                                )}
                            >
                                {candidate.code}
                            </p>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                {candidate.name}
                            </p>
                        </div>
                        <EligibilityBadge eligible={candidate.eligible} />
                    </div>
                    <div
                        id={detailsId}
                        className="mt-2 space-y-1 text-xs leading-5 text-ink-soft"
                    >
                        <p>
                            Readiness: {candidate.readiness.label} · Maintenance
                            blocks: {candidate.blocking_maintenance_count}
                        </p>
                        <ConflictDetails
                            reasons={candidate.reasons}
                            conflicts={candidate.schedule_conflicts}
                        />
                    </div>
                </div>
            </div>
        </li>
    );
}

function EligibilityBadge({ eligible }: { eligible: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-2xs',
                eligible
                    ? 'bg-success-soft text-success-strong'
                    : 'bg-danger-soft text-danger',
            )}
        >
            {eligible ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {eligible ? 'Eligible' : 'Blocked'}
        </span>
    );
}

function ConflictDetails({
    reasons,
    conflicts,
}: {
    reasons: string[];
    conflicts: PersonnelCandidateViewModel['schedule_conflicts'];
}) {
    if (reasons.length === 0) {
        return (
            <p className="mt-1 inline-flex items-center gap-1.5 font-medium text-success-strong">
                <ShieldCheck
                    className="h-3.5 w-3.5 shrink-0 text-success-strong"
                    aria-hidden="true"
                />
                No blocking conflict at this schedule.
            </p>
        );
    }

    return (
        <div className="mt-1.5 space-y-1 rounded-md border border-danger/20 bg-danger-soft/60 p-2 text-xs text-danger">
            <ul className="space-y-1">
                {reasons.map((reason) => (
                    <li
                        key={reason}
                        className="flex items-start gap-1.5 font-medium"
                    >
                        <AlertTriangle
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        <span>{reason}</span>
                    </li>
                ))}
            </ul>
            {conflicts.length > 0 && (
                <p className="flex items-start gap-1.5 border-t border-danger/20 pt-1 text-danger">
                    <Clock3
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                    />
                    <span>
                        {conflicts
                            .map(
                                (conflict) =>
                                    `${conflict.reference} (${formatDateTime(conflict.scheduled_start)} – ${formatDateTime(conflict.scheduled_end)})`,
                            )
                            .join('; ')}
                    </span>
                </p>
            )}
        </div>
    );
}

function ResourceIcon({ icon }: { icon: 'personnel' | 'asset' }) {
    const Icon = icon === 'personnel' ? HardHat : Wrench;

    return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft">
            <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
    );
}

function credentialSummary(candidate: PersonnelCandidateViewModel) {
    if (
        !candidate.credential.kind ||
        candidate.credential.status === 'not_required'
    ) {
        return 'Standard operational qualification checked';
    }

    const expiry = candidate.credential.expires_at
        ? ` · Expires ${candidate.credential.expires_at}`
        : '';

    return `Credential: ${candidate.credential.label} (${humanize(candidate.credential.status)})${expiry}`;
}

function formatResourceCounts(personnelCount: number, assetCount: number) {
    return `${personnelCount} ${personnelCount === 1 ? 'person' : 'people'}, ${assetCount} asset${assetCount === 1 ? '' : 's'}`;
}

function isAssignmentSuccessFlash(flash: WorkspaceFlash | null) {
    if (!flash || flash.tone !== 'success') {
        return false;
    }

    return (
        flash.message.includes('Resources were assigned') ||
        flash.message.includes('Assignments were updated')
    );
}

function getSafeReturnTo() {
    if (typeof window === 'undefined') {
        return '/';
    }

    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('return_to');

    if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
        return '/';
    }

    return returnTo;
}

export function CandidateListSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
        </div>
    );
}
