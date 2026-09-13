import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    ShieldCheck,
    Truck,
    Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
    ActivationPanel,
    ActivationPrerequisiteChecklist,
    ApprovalDecisionBanner,
    AssetCandidates,
    AssignmentFlowHeader,
    AssignmentNextAction,
    AssignmentSelectionSummary,
    AssignmentStageSummaries,
    CurrentAssignments,
    DispatchAlertBanners,
    DispatchContext,
    DispatchDetailHeader,
    FieldJobWorkspace,
    FieldExecutionWorkspace,
    LifecycleControlsPanel,
    MobileAssignmentActionBar,
    PersonnelCandidates,
    ResourcePicker,
    getSafeReturnTo,
    isAssignmentSuccessFlash,
    useDispatchAssignment,
} from '@/components/dispatch-detail';
import { Button, Panel } from '@/components/ui';
import { EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
    CandidatePageViewModel,
    AssetCandidateViewModel,
    DispatchDetailPageProps,
    PersonnelCandidateViewModel,
} from '@/types/workspace';

export default function DispatchDetail({
    job,
    personnel_candidates: personnelCandidatePage,
    asset_candidates: assetCandidatePage,
    activation,
    progression,
    execution,
    capabilities,
    project_context,
}: DispatchDetailPageProps) {
    const { flash, errors, auth } = usePage().props;
    const pageUrl = usePage().url;
    const personnelCandidates = candidateData<PersonnelCandidateViewModel>(
        personnelCandidatePage,
    );
    const assetCandidates =
        candidateData<AssetCandidateViewModel>(assetCandidatePage);
    const candidatesReady =
        !capabilities.view_assignment_candidates ||
        (hasCandidateData(personnelCandidatePage) &&
            hasCandidateData(assetCandidatePage));
    const failedCandidateProps = [
        candidatePageError(personnelCandidatePage)
            ? 'personnel_candidates'
            : null,
        candidatePageError(assetCandidatePage) ? 'asset_candidates' : null,
    ].filter((prop): prop is 'personnel_candidates' | 'asset_candidates' =>
        Boolean(prop),
    );
    const reloadCandidateProps =
        failedCandidateProps.length > 0
            ? failedCandidateProps
            : ['personnel_candidates', 'asset_candidates'];
    const candidatesStale =
        candidatesReady &&
        [personnelCandidatePage, assetCandidatePage].some((value) => {
            const version = candidatePageVersion(value);

            return version !== null && version !== job.version;
        });
    const candidateError =
        candidatePageError(personnelCandidatePage) ??
        candidatePageError(assetCandidatePage);
    const initialStep: 1 | 2 | 3 =
        job.status.value === 'pending_approval' ||
        job.status.value === 'scheduled' ||
        activation.approval_status === 'pending' ||
        Boolean(activation.approval_request_id)
            ? 3
            : 2;

    const {
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
    } = useDispatchAssignment(
        job.id,
        {
            personnel: personnelCandidates,
            assets: assetCandidates,
        },
        initialStep,
        job.version,
    );
    const [assignmentPickerOpen, setAssignmentPickerOpen] = useState(false);

    const assignmentSaved = isAssignmentSuccessFlash(flash);
    const hasCurrentAssignments =
        job.personnel_assignments.length + job.asset_assignments.length > 0;
    const hasAssignmentNextAction = assignmentSaved || hasCurrentAssignments;
    const contextKey = `dispatch-project-return:${job.id}`;
    let storedContext: string | null = null;

    try {
        storedContext =
            typeof window !== 'undefined'
                ? window.sessionStorage.getItem(contextKey)
                : null;
    } catch {
        /* Storage can be disabled; the server context remains available. */
    }

    const contextualReturn = getSafeReturnTo(storedContext, pageUrl);
    const backToOrigin =
        contextualReturn === '/'
            ? (project_context?.return_url ?? '/')
            : contextualReturn;
    const coverageReturnTo =
        project_context &&
        contextualReturn !== '/' &&
        isResourceCoverageReturn(contextualReturn)
            ? contextualReturn
            : (project_context?.return_url ?? backToOrigin);
    useEffect(() => {
        if (!capabilities.update_own_status && contextualReturn !== '/') {
            try {
                window.sessionStorage.setItem(contextKey, contextualReturn);
            } catch {
                /* Keep navigation working when storage is disabled. */
            }
        }
    }, [capabilities.update_own_status, contextKey, contextualReturn]);
    const canViewFleetAssets =
        auth?.permissions?.some((permission) =>
            ['fleet.view_all', 'fleet.view_assigned'].includes(permission),
        ) ?? true;
    const canViewEquipmentAssets =
        auth?.permissions?.some((permission) =>
            ['equipment.view_all', 'equipment.view_assigned'].includes(
                permission,
            ),
        ) ?? true;
    const conflictMessage = firstErrorMessage(
        errors.resources,
        errors.reassignment,
        errors.approval,
        errors.version,
        errors.safety,
        errors.project_plan,
        form.errors.personnel,
        form.errors.assets,
    );
    const projectCoverageOnly = Boolean(
        project_context && !capabilities.assign_resources,
    );
    const officeExecution =
        !capabilities.update_own_status &&
        execution !== null &&
        execution !== undefined
            ? execution
            : null;

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
    }, [setActiveStep]);

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
                title={`${job.reference} ${capabilities.update_own_status ? 'assigned job' : officeExecution !== null ? 'field execution' : 'assignment workspace'}`}
            />
            <div className="min-h-screen bg-canvas">
                <a
                    href="#dispatch-detail-main"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:ring-2 focus:ring-brand"
                >
                    Skip to main content
                </a>

                <DispatchDetailHeader
                    job={job}
                    capabilities={capabilities}
                    returnTo={backToOrigin}
                    onConfirmLeave={confirmLeave}
                />

                <main
                    id="dispatch-detail-main"
                    tabIndex={-1}
                    className={cn(
                        'mx-auto max-w-[96rem] space-y-5 px-4 py-5 outline-none md:px-6 md:py-6',
                        !capabilities.update_own_status &&
                            officeExecution === null &&
                            'pb-[calc(7rem+env(safe-area-inset-bottom))] xl:pb-6',
                    )}
                >
                    <DispatchAlertBanners
                        flash={flash}
                        conflictMessage={conflictMessage}
                    />

                    {project_context && (
                        <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
                            <div>
                                <p className="text-xs font-semibold text-ink-soft">
                                    Core 1 work context
                                </p>
                                <p className="mt-1 text-sm font-semibold text-ink">
                                    {project_context.name} ·{' '}
                                    {project_context.phase}
                                </p>
                                <p className="mt-1 text-sm text-ink-soft">
                                    This Core 2 record manages operational
                                    resource coverage. Baseline approval and the
                                    24-hour confirmation lock still apply.
                                </p>
                            </div>
                            <Link
                                href={coverageReturnTo}
                                className="inline-flex min-h-9 items-center rounded-md bg-brand px-3 text-xs font-semibold text-brand-contrast transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            >
                                Return to resource coverage
                            </Link>
                        </Panel>
                    )}

                    {capabilities.update_own_status && progression !== null ? (
                        <FieldJobWorkspace
                            job={job}
                            progression={progression}
                            capabilities={capabilities}
                            personnelCandidates={personnelCandidates}
                            assetCandidates={assetCandidates}
                            personnelPage={
                                isCandidatePage<PersonnelCandidateViewModel>(
                                    personnelCandidatePage,
                                )
                                    ? personnelCandidatePage
                                    : undefined
                            }
                            assetPage={
                                isCandidatePage<AssetCandidateViewModel>(
                                    assetCandidatePage,
                                )
                                    ? assetCandidatePage
                                    : undefined
                            }
                        />
                    ) : officeExecution !== null ? (
                        <>
                            <FieldExecutionWorkspace
                                job={job}
                                execution={officeExecution}
                                capabilities={capabilities}
                                personnelCandidates={personnelCandidates}
                                assetCandidates={assetCandidates}
                                personnelPage={
                                    isCandidatePage<PersonnelCandidateViewModel>(
                                        personnelCandidatePage,
                                    )
                                        ? personnelCandidatePage
                                        : undefined
                                }
                                assetPage={
                                    isCandidatePage<AssetCandidateViewModel>(
                                        assetCandidatePage,
                                    )
                                        ? assetCandidatePage
                                        : undefined
                                }
                            />
                            <LifecycleControlsPanel
                                key={`lifecycle-${job.version}`}
                                job={job}
                                capabilities={capabilities}
                            />
                        </>
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
                                canAssignResources={
                                    capabilities.assign_resources
                                }
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
                                                    <h2 className="mt-1 text-xl font-semibold text-ink">
                                                        Review schedule and
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
                                                    href={backToOrigin}
                                                    onClick={confirmLeave}
                                                    className="inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                                                >
                                                    <ArrowLeft className="h-3.5 w-3.5" />
                                                    Back to dispatch workspace
                                                </Link>
                                                {projectCoverageOnly ? (
                                                    <Link
                                                        href={coverageReturnTo}
                                                        onClick={confirmLeave}
                                                        className="inline-flex min-h-9 items-center gap-2 rounded-md bg-brand px-3 text-xs font-semibold text-brand-contrast transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                                                    >
                                                        Return to resource
                                                        coverage
                                                        <ArrowRight className="h-3.5 w-3.5" />
                                                    </Link>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        onClick={() =>
                                                            setActiveStep(2)
                                                        }
                                                    >
                                                        Next: Select resources
                                                        <ArrowRight className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 2: CHOOSE ELIGIBLE RESOURCES */}
                                    {activeStep === 2 && (
                                        <div className="animate-in fade-in space-y-5 duration-150">
                                            {projectCoverageOnly ? (
                                                <Panel>
                                                    <EmptyState
                                                        icon={ShieldCheck}
                                                        title="Resource coverage is managed from the coverage record"
                                                        message="This linked shift inherits its baseline, reservations, and crew rules from the Core 2 resource coverage record. Return there to fill or review operational coverage."
                                                        primaryAction={
                                                            <Link
                                                                href={
                                                                    coverageReturnTo
                                                                }
                                                                onClick={
                                                                    confirmLeave
                                                                }
                                                                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-contrast"
                                                            >
                                                                Return to
                                                                resource
                                                                coverage
                                                            </Link>
                                                        }
                                                    />
                                                </Panel>
                                            ) : capabilities.view_assignment_candidates ? (
                                                candidatesReady ? (
                                                    <form
                                                        id="assignment-selection-form"
                                                        onSubmit={submit}
                                                        className="space-y-6"
                                                        noValidate
                                                        aria-busy={
                                                            form.processing
                                                        }
                                                    >
                                                        {candidatesStale && (
                                                            <div
                                                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning-strong"
                                                                role="alert"
                                                            >
                                                                <span>
                                                                    The dispatch
                                                                    changed
                                                                    while these
                                                                    candidates
                                                                    were being
                                                                    evaluated.
                                                                    Refresh
                                                                    before
                                                                    selecting
                                                                    resources.
                                                                </span>
                                                                <Button
                                                                    type="button"
                                                                    variant="secondary"
                                                                    onClick={() =>
                                                                        router.reload(
                                                                            {
                                                                                only: reloadCandidateProps,
                                                                                preserveUrl: true,
                                                                                preserveErrors: true,
                                                                            },
                                                                        )
                                                                    }
                                                                >
                                                                    Refresh
                                                                    candidates
                                                                </Button>
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                                            <div>
                                                                <h2 className="mt-1 text-xl font-semibold text-ink">
                                                                    Select
                                                                    eligible
                                                                    resources
                                                                </h2>
                                                                <p className="mt-0.5 max-w-3xl text-xs leading-5 text-ink-soft">
                                                                    Select the
                                                                    people and
                                                                    assets for
                                                                    this
                                                                    dispatch.
                                                                    Eligibility
                                                                    is checked
                                                                    for this
                                                                    scheduled
                                                                    window and
                                                                    checked
                                                                    again when
                                                                    you save.
                                                                </p>
                                                            </div>
                                                            <a
                                                                href="#assignment-summary"
                                                                className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-md px-2.5 text-xs font-semibold text-brand-strong transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden sm:self-auto"
                                                            >
                                                                Review selection
                                                                <ArrowRight
                                                                    className="h-3.5 w-3.5"
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
                                                                        workers
                                                                        and
                                                                        certified
                                                                        operators
                                                                        who can
                                                                        respond
                                                                        to this
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
                                                                onCandidatesSeen={
                                                                    rememberPersonnelCandidates
                                                                }
                                                                selectedIds={form.data.personnel.map(
                                                                    (
                                                                        assignment,
                                                                    ) =>
                                                                        assignment.user_id,
                                                                )}
                                                                canAssign={
                                                                    capabilities.assign_resources
                                                                }
                                                                onToggle={
                                                                    togglePersonnel
                                                                }
                                                                page={
                                                                    isCandidatePage<PersonnelCandidateViewModel>(
                                                                        personnelCandidatePage,
                                                                    )
                                                                        ? personnelCandidatePage
                                                                        : undefined
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
                                                                        cranes,
                                                                        and
                                                                        equipment
                                                                        ready
                                                                        for the
                                                                        window.
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
                                                                onCandidatesSeen={
                                                                    rememberAssetCandidates
                                                                }
                                                                selectedIds={form.data.assets.map(
                                                                    (
                                                                        assignment,
                                                                    ) =>
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
                                                                page={
                                                                    isCandidatePage<AssetCandidateViewModel>(
                                                                        assetCandidatePage,
                                                                    )
                                                                        ? assetCandidatePage
                                                                        : undefined
                                                                }
                                                            />
                                                        </section>

                                                        <ResourcePicker
                                                            key={`assignment-picker-${assignmentPickerOpen ? 'open' : 'closed'}`}
                                                            open={
                                                                assignmentPickerOpen &&
                                                                !assignmentSaved
                                                            }
                                                            mode="initial"
                                                            job={job}
                                                            personnelCandidates={
                                                                personnelCandidatesForConsumers
                                                            }
                                                            assetCandidates={
                                                                assetCandidatesForConsumers
                                                            }
                                                            personnelPage={
                                                                isCandidatePage<PersonnelCandidateViewModel>(
                                                                    personnelCandidatePage,
                                                                )
                                                                    ? personnelCandidatePage
                                                                    : undefined
                                                            }
                                                            assetPage={
                                                                isCandidatePage<AssetCandidateViewModel>(
                                                                    assetCandidatePage,
                                                                )
                                                                    ? assetCandidatePage
                                                                    : undefined
                                                            }
                                                            selectedPersonnelIds={form.data.personnel.map(
                                                                (assignment) =>
                                                                    assignment.user_id,
                                                            )}
                                                            selectedAssetIds={form.data.assets.map(
                                                                (assignment) =>
                                                                    assignment.operational_asset_id,
                                                            )}
                                                            canSelect={
                                                                capabilities.assign_resources &&
                                                                !candidatesStale
                                                            }
                                                            onTogglePersonnel={
                                                                togglePersonnel
                                                            }
                                                            onToggleAsset={
                                                                toggleAsset
                                                            }
                                                            onClose={() =>
                                                                setAssignmentPickerOpen(
                                                                    false,
                                                                )
                                                            }
                                                            onConfirm={() =>
                                                                undefined
                                                            }
                                                            submitting={
                                                                form.processing
                                                            }
                                                            error={firstErrorMessage(
                                                                form.errors
                                                                    .personnel,
                                                                form.errors
                                                                    .assets,
                                                            )}
                                                            confirmFormId="assignment-selection-form"
                                                        />

                                                        <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 shadow-2xs">
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                onClick={() =>
                                                                    setActiveStep(
                                                                        1,
                                                                    )
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
                                                                    setActiveStep(
                                                                        3,
                                                                    )
                                                                }
                                                            >
                                                                Next: Review
                                                                readiness
                                                                <ArrowRight className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <CandidateDeferredState
                                                        error={candidateError}
                                                        onRetry={() =>
                                                            router.reload({
                                                                only: reloadCandidateProps,
                                                                preserveUrl: true,
                                                                preserveErrors: true,
                                                            })
                                                        }
                                                    />
                                                )
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
                                                    <h2 className="mt-1 text-xl font-semibold text-ink">
                                                        Review readiness and
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
                                                    Activation checks
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
                                                    Previous: Select resources
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
                                                            : 'Resources needed before activation'}
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
                                        personnel={selectedPersonnelCandidates}
                                        assets={selectedAssetCandidates}
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
                                            personnelCandidatesForConsumers
                                        }
                                        assetCandidates={
                                            assetCandidatesForConsumers
                                        }
                                        personnelPage={
                                            isCandidatePage<PersonnelCandidateViewModel>(
                                                personnelCandidatePage,
                                            )
                                                ? personnelCandidatePage
                                                : undefined
                                        }
                                        assetPage={
                                            isCandidatePage<AssetCandidateViewModel>(
                                                assetCandidatePage,
                                            )
                                                ? assetCandidatePage
                                                : undefined
                                        }
                                        onAssignResources={() => {
                                            setActiveStep(2);
                                            setAssignmentPickerOpen(true);
                                        }}
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
                                onSelectStep={(step) => {
                                    setActiveStep(step);

                                    if (step === 2) {
                                        setAssignmentPickerOpen(true);
                                    }
                                }}
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

function isResourceCoverageReturn(returnTo: string): boolean {
    try {
        const url = new URL(returnTo, 'http://dispatch.local');

        return (
            url.searchParams.get('dispatch_mode') === 'resources' ||
            url.searchParams.get('dispatch_tab') === 'project-plans'
        );
    } catch {
        return false;
    }
}

function isCandidatePage<T>(
    value: unknown,
): value is CandidatePageViewModel<T> {
    return (
        typeof value === 'object' &&
        value !== null &&
        'data' in value &&
        Array.isArray(value.data)
    );
}

function hasCandidateData(value: unknown): boolean {
    return (
        (isCandidatePage(value) && value.error === null) || Array.isArray(value)
    );
}

function candidatePageVersion(value: unknown): number | null {
    return isCandidatePage(value) && typeof value.job_version === 'number'
        ? value.job_version
        : null;
}

function candidateData<T>(value: unknown): T[] {
    return isCandidatePage<T>(value)
        ? value.data
        : Array.isArray(value)
          ? value
          : [];
}

function candidatePageError(value: unknown): string | null {
    return isCandidatePage(value) && typeof value.error === 'string'
        ? value.error
        : null;
}

function firstErrorMessage(...values: unknown[]): string | null {
    for (const value of values) {
        const message = errorMessage(value);

        if (message) {
            return message;
        }
    }

    return null;
}

function errorMessage(value: unknown): string | null {
    if (typeof value === 'string') {
        return value;
    }

    if (Array.isArray(value)) {
        const messages = value
            .map((item) => errorMessage(item))
            .filter((item): item is string => Boolean(item));

        return messages.length ? messages.join(' ') : null;
    }

    if (value && typeof value === 'object') {
        return firstErrorMessage(...Object.values(value));
    }

    return null;
}

function CandidateDeferredState({
    error,
    onRetry,
}: {
    error: string | null;
    onRetry: () => void;
}) {
    return (
        <Panel>
            <div
                className="space-y-3 p-5"
                aria-busy={error === null}
                aria-live="polite"
            >
                {error === null ? (
                    <>
                        <div className="h-5 w-48 animate-pulse rounded bg-surface-subtle" />
                        <div className="h-4 w-72 animate-pulse rounded bg-surface-subtle" />
                        <p className="sr-only">
                            Loading candidate evaluations.
                        </p>
                    </>
                ) : (
                    <>
                        <p className="font-semibold text-danger">{error}</p>
                        <p className="text-sm text-ink-soft">
                            No resource is selectable until the server completes
                            its authoritative evaluation.
                        </p>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onRetry}
                        >
                            Retry evaluation
                        </Button>
                    </>
                )}
            </div>
        </Panel>
    );
}
