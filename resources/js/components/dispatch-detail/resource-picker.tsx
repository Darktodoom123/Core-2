import { router } from '@inertiajs/react';
import {
    AlertTriangle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    Search,
    ShieldCheck,
    X,
} from 'lucide-react';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Button, EmptyState, Modal, Skeleton } from '@/components/ui';
import { formatDateTime, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetCandidateViewModel,
    CandidatePageViewModel,
    DispatchDetailPageProps,
    PersonnelCandidateViewModel,
} from '@/types/workspace';
import {
    credentialSummary,
    EligibilityBadge,
    ResourceIcon,
} from './dispatch-detail-helpers';

type ResourceTab = 'personnel' | 'assets';
type PickerMode = 'initial' | 'replacement';

type ReassignmentTarget = {
    kind: 'personnel' | 'asset';
    id: number;
    name: string;
    type: string;
};

type Candidate = PersonnelCandidateViewModel | AssetCandidateViewModel;

export function isCompatibleCandidate(
    candidate: Candidate,
    targetType?: string | null,
): boolean {
    if (!targetType) {
        return false;
    }

    return (
        candidate.assignment_type === targetType ||
        (targetType === 'operator' &&
            candidate.assignment_type === 'crane_operator')
    );
}

function candidateFilterType(targetType?: string | null): string {
    return targetType === 'operator' ? 'crane_operator' : (targetType ?? 'all');
}

type ResourcePickerProps = {
    open: boolean;
    mode: PickerMode;
    job: DispatchDetailPageProps['job'];
    target?: ReassignmentTarget;
    personnelCandidates: PersonnelCandidateViewModel[];
    assetCandidates: AssetCandidateViewModel[];
    personnelPage?: CandidatePageViewModel<PersonnelCandidateViewModel>;
    assetPage?: CandidatePageViewModel<AssetCandidateViewModel>;
    selectedPersonnelIds: number[];
    selectedAssetIds: number[];
    canSelect: boolean;
    onTogglePersonnel: (candidate: PersonnelCandidateViewModel) => void;
    onToggleAsset: (candidate: AssetCandidateViewModel) => void;
    onClose: () => void;
    onConfirm: () => void;
    reason?: string;
    onReasonChange?: (reason: string) => void;
    submitting?: boolean;
    error?: string | null;
    onRetry?: () => void;
    confirmFormId?: string;
};

const personnelTypes: Array<{
    value: PersonnelCandidateViewModel['assignment_type'];
    label: string;
}> = [
    { value: 'driver', label: 'Drivers' },
    { value: 'crane_operator', label: 'Crane operators' },
    { value: 'rigger', label: 'Riggers / Signalpersons' },
];

const assetTypes: Array<{
    value: AssetCandidateViewModel['assignment_type'];
    label: string;
}> = [
    { value: 'truck', label: 'Trucks' },
    { value: 'crane', label: 'Cranes' },
    { value: 'mobile_crane', label: 'Mobile cranes' },
    { value: 'equipment', label: 'Equipment' },
];

function candidatePage<T>(
    value: CandidatePageViewModel<T> | T[] | undefined,
): CandidatePageViewModel<T> | undefined {
    return value && !Array.isArray(value) ? value : undefined;
}

function getInitials(name: string): string {
    const initials = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');

    return initials || '?';
}

function selectedCountLabel(personnel: number, assets: number): string {
    const parts: string[] = [];

    if (personnel > 0) {
        parts.push(`${personnel} employee${personnel === 1 ? '' : 's'}`);
    }

    if (assets > 0) {
        parts.push(`${assets} asset${assets === 1 ? '' : 's'}`);
    }

    return parts.length > 0 ? parts.join(' · ') : 'No resources selected yet';
}

function isCandidatePageStale(
    page: { job_version: number } | undefined,
    jobVersion: number,
): boolean {
    return page !== undefined && page.job_version !== jobVersion;
}

function candidateLabel(candidate: Candidate): string {
    return 'code' in candidate
        ? `${candidate.code} · ${candidate.name}`
        : `${candidate.name} · ${candidate.assignment_label}`;
}

function titleCase(value: string): string {
    return value.length > 0
        ? `${value[0].toUpperCase()}${value.slice(1)}`
        : value;
}

function replacementActionLabel(target?: ReassignmentTarget): string {
    if (target?.kind === 'asset') {
        return 'Replace equipment';
    }

    if (target?.type === 'crane_operator') {
        return 'Replace operator';
    }

    if (target?.type === 'driver') {
        return 'Replace driver';
    }

    return 'Replace resource';
}

function compatibleResourceLabel(target?: ReassignmentTarget): string {
    if (target?.kind === 'asset') {
        return (
            assetTypes.find((type) => type.value === target.type)?.label ??
            'Equipment'
        );
    }

    return (
        personnelTypes.find((type) => type.value === target?.type)?.label ??
        'Employees'
    );
}

function replacementTitle(target?: ReassignmentTarget): string {
    return `Replace ${
        target?.kind === 'asset'
            ? 'equipment'
            : target?.type === 'crane_operator'
              ? 'operator'
              : target?.type === 'driver'
                ? 'driver'
                : humanize(target?.type ?? 'resource')
    }`;
}

export function ResourcePicker({
    open,
    mode,
    job,
    target,
    personnelCandidates,
    assetCandidates,
    personnelPage,
    assetPage,
    selectedPersonnelIds,
    selectedAssetIds,
    canSelect,
    onTogglePersonnel,
    onToggleAsset,
    onClose,
    onConfirm,
    reason = '',
    onReasonChange,
    submitting = false,
    error = null,
    onRetry,
    confirmFormId,
}: ResourcePickerProps) {
    const replacementTab: ResourceTab =
        target?.kind === 'asset' ? 'assets' : 'personnel';
    const [activeTab, setActiveTab] = useState<ResourceTab>(replacementTab);
    const [searchQuery, setSearchQuery] = useState('');
    const [eligibleOnly, setEligibleOnly] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string>(
        mode === 'replacement' ? (target?.type ?? 'all') : 'all',
    );
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [replacementCandidate, setReplacementCandidate] =
        useState<Candidate | null>(null);
    const filterInitialized = useRef(false);
    const initialFetchRequested = useRef(false);
    const requestSequence = useRef(0);
    const resourceTab = mode === 'replacement' ? replacementTab : activeTab;
    const resourceTypeFilter =
        mode === 'replacement' ? candidateFilterType(target?.type) : typeFilter;

    const activePage =
        resourceTab === 'personnel'
            ? candidatePage<PersonnelCandidateViewModel>(personnelPage)
            : candidatePage<AssetCandidateViewModel>(assetPage);
    const activeTypes =
        resourceTab === 'personnel' ? personnelTypes : assetTypes;
    const activePageStale = isCandidatePageStale(activePage, job.version);
    const displayedCandidates = useMemo(() => {
        const candidates =
            resourceTab === 'personnel' ? personnelCandidates : assetCandidates;

        return candidates.filter(
            (candidate) =>
                (resourceTypeFilter === 'all' ||
                    candidate.assignment_type === resourceTypeFilter) &&
                (!eligibleOnly || candidate.eligible),
        );
    }, [
        assetCandidates,
        eligibleOnly,
        personnelCandidates,
        resourceTab,
        resourceTypeFilter,
    ]);
    const assignedPersonnelIds = useMemo(
        () =>
            new Set(
                job.personnel_assignments.map(
                    (assignment) => assignment.user_id,
                ),
            ),
        [job.personnel_assignments],
    );
    const assignedAssetIds = useMemo(
        () =>
            new Set(
                job.asset_assignments.map(
                    (assignment) => assignment.operational_asset_id,
                ),
            ),
        [job.asset_assignments],
    );

    const reloadCandidates = useCallback(() => {
        const requestId = ++requestSequence.current;
        setLoading(true);

        router.reload({
            only: [
                resourceTab === 'personnel'
                    ? 'personnel_candidates'
                    : 'asset_candidates',
            ],
            data: {
                resource: resourceTab,
                type:
                    resourceTypeFilter === 'all'
                        ? undefined
                        : resourceTypeFilter,
                search: searchQuery.trim() || undefined,
                page: currentPage,
                per_page: 25,
                eligible_only: eligibleOnly,
            },
            preserveUrl: true,
            preserveErrors: true,
            onFinish: () => {
                if (requestSequence.current === requestId) {
                    setLoading(false);
                }
            },
        });
    }, [
        currentPage,
        eligibleOnly,
        resourceTab,
        resourceTypeFilter,
        searchQuery,
    ]);

    useEffect(() => {
        if (!open) {
            initialFetchRequested.current = false;

            return;
        }

        if (!filterInitialized.current) {
            filterInitialized.current = true;

            return;
        }

        const timeout = window.setTimeout(reloadCandidates, 275);

        return () => window.clearTimeout(timeout);
    }, [open, reloadCandidates]);

    useEffect(() => {
        if (
            !open ||
            initialFetchRequested.current ||
            activePage !== undefined ||
            displayedCandidates.length > 0
        ) {
            return;
        }

        initialFetchRequested.current = true;
        reloadCandidates();
    }, [activePage, displayedCandidates.length, open, reloadCandidates]);

    const hasActiveResults = displayedCandidates.length > 0;
    const resultCount =
        activePage?.pagination.total ?? displayedCandidates.length;
    const selectedReplacementId = replacementCandidate?.id ?? null;
    const selectedPersonnel = personnelCandidates.filter((candidate) =>
        selectedPersonnelIds.includes(candidate.id),
    );
    const selectedAssets = assetCandidates.filter((candidate) =>
        selectedAssetIds.includes(candidate.id),
    );
    const replacementIsValid =
        replacementCandidate !== null &&
        replacementCandidate.eligible &&
        !replacementCandidate.already_assigned &&
        isCompatibleCandidate(replacementCandidate, target?.type);
    const canConfirm =
        canSelect &&
        !submitting &&
        !loading &&
        !activePageStale &&
        (mode === 'initial'
            ? selectedPersonnelIds.length + selectedAssetIds.length > 0
            : replacementIsValid);

    const changeTab = (tab: ResourceTab) => {
        setActiveTab(tab);
        setCurrentPage(1);
        setTypeFilter('all');
    };

    const clearFilters = () => {
        setSearchQuery('');
        setEligibleOnly(false);
        setTypeFilter(
            mode === 'replacement' ? candidateFilterType(target?.type) : 'all',
        );
        setCurrentPage(1);
    };

    const handleReplacementSelection = (candidate: Candidate) => {
        if (
            !canSelect ||
            loading ||
            activePageStale ||
            !candidate.eligible ||
            candidate.already_assigned ||
            !isCompatibleCandidate(candidate, target?.type)
        ) {
            return;
        }

        setReplacementCandidate(candidate);
    };

    const title =
        mode === 'initial'
            ? 'Assign Driver/Operator and Equipment'
            : replacementTitle(target);
    const actionLabel =
        mode === 'initial'
            ? 'Assign selected resources'
            : replacementActionLabel(target);
    const metadata = (
        <span className="block space-y-0.5">
            <span className="block break-words">
                <span className="font-semibold text-ink">{job.reference}</span>{' '}
                · {job.title}
            </span>
            <span className="block break-words">
                {job.site} · {formatDateTime(job.scheduled_start)} –{' '}
                {formatDateTime(job.scheduled_end)}
            </span>
        </span>
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            description={metadata}
            size="full"
            returnFocusTo={undefined}
            className="!flex !max-h-[calc(100dvh-3rem)] !min-h-0 !max-w-[1080px] flex-col max-md:-m-4 max-md:!h-[100dvh] max-md:!max-h-[100dvh] max-md:!w-screen max-md:max-w-none max-md:rounded-none"
            contentClassName="!flex min-h-0 flex-1 flex-col !overflow-hidden !p-0"
            closeOnBackdrop={!submitting}
            footer={
                <div className="mobile-safe-bottom flex w-full items-center justify-between gap-3 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Button
                        type="button"
                        variant="quiet"
                        onClick={onClose}
                        disabled={submitting}
                        className="order-1 max-sm:order-2 max-sm:justify-self-start"
                    >
                        Cancel
                    </Button>
                    <p
                        className="order-2 min-w-0 flex-1 text-center text-xs leading-5 font-medium text-ink-soft max-sm:order-1 max-sm:col-span-2"
                        aria-live="polite"
                    >
                        {mode === 'initial'
                            ? selectedCountLabel(
                                  selectedPersonnelIds.length,
                                  selectedAssetIds.length,
                              )
                            : replacementCandidate
                              ? `Replacement selected: ${candidateLabel(replacementCandidate)}`
                              : 'Choose one eligible replacement to continue.'}
                    </p>
                    <Button
                        type={
                            mode === 'initial' && confirmFormId
                                ? 'submit'
                                : 'button'
                        }
                        variant="primary"
                        onClick={
                            mode === 'initial' && confirmFormId
                                ? undefined
                                : onConfirm
                        }
                        form={mode === 'initial' ? confirmFormId : undefined}
                        disabled={!canConfirm}
                        aria-busy={submitting}
                        className="order-3 max-sm:order-2 max-sm:justify-self-end"
                    >
                        {submitting ? 'Saving…' : actionLabel}
                    </Button>
                </div>
            }
        >
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-5 max-md:px-4 max-md:py-4">
                    {error && (
                        <div
                            className="flex flex-none items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
                            role="alert"
                            aria-live="assertive"
                        >
                            <CircleAlert
                                className="mt-0.5 h-4 w-4 shrink-0"
                                aria-hidden="true"
                            />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex flex-none flex-col gap-3">
                        {mode === 'initial' && (
                            <div
                                className="grid grid-cols-2 rounded-lg border border-line bg-surface-subtle p-1"
                                role="tablist"
                                aria-label="Resource category"
                            >
                                <PickerTab
                                    active={activeTab === 'personnel'}
                                    count={selectedPersonnelIds.length}
                                    onClick={() => changeTab('personnel')}
                                    label="Employees"
                                />
                                <PickerTab
                                    active={activeTab === 'assets'}
                                    count={selectedAssetIds.length}
                                    onClick={() => changeTab('assets')}
                                    label="Assets"
                                />
                            </div>
                        )}

                        <div
                            className={cn(
                                'grid gap-2',
                                mode === 'initial'
                                    ? 'md:grid-cols-[minmax(0,1fr)_13rem_auto]'
                                    : 'md:grid-cols-[minmax(0,1fr)_auto]',
                            )}
                        >
                            <label className="relative block">
                                <span className="sr-only">
                                    Search{' '}
                                    {resourceTab === 'personnel'
                                        ? 'employee names'
                                        : 'asset codes and names'}
                                </span>
                                <Search
                                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
                                    aria-hidden="true"
                                />
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(event) => {
                                        setSearchQuery(event.target.value);
                                        setCurrentPage(1);
                                    }}
                                    placeholder={
                                        resourceTab === 'personnel'
                                            ? 'Search employee name'
                                            : 'Search asset code or name'
                                    }
                                    className="min-h-11 w-full rounded-lg border border-line bg-surface py-2 pr-3 pl-10 text-sm text-ink placeholder:text-ink-soft/70 focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none"
                                    aria-label={`Search ${resourceTab === 'personnel' ? 'employees' : 'assets'}`}
                                />
                            </label>
                            {mode === 'initial' && (
                                <>
                                    <label
                                        className="sr-only"
                                        htmlFor="resource-picker-type"
                                    >
                                        Filter by{' '}
                                        {resourceTab === 'personnel'
                                            ? 'role'
                                            : 'asset type'}
                                    </label>
                                    <select
                                        id="resource-picker-type"
                                        value={resourceTypeFilter}
                                        onChange={(event) => {
                                            setTypeFilter(event.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
                                    >
                                        <option value="all">
                                            {resourceTab === 'personnel'
                                                ? 'All roles'
                                                : 'All types'}
                                        </option>
                                        {activeTypes.map((type) => (
                                            <option
                                                key={type.value}
                                                value={type.value}
                                            >
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </>
                            )}
                            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-soft">
                                <input
                                    type="checkbox"
                                    checked={eligibleOnly}
                                    onChange={(event) => {
                                        setEligibleOnly(event.target.checked);
                                        setCurrentPage(1);
                                    }}
                                    className="h-4 w-4 accent-[var(--color-brand)]"
                                />
                                Eligible only
                            </label>
                        </div>
                    </div>

                    {mode === 'replacement' && (
                        <div className="flex flex-none flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                            <span className="font-semibold text-ink">
                                {eligibleOnly ? 'Available ' : ''}
                                {compatibleResourceLabel(target)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                                Compatible type:{' '}
                                {titleCase(
                                    humanize(target?.type ?? 'resource'),
                                )}
                            </span>
                        </div>
                    )}

                    {activePageStale && (
                        <div
                            className="flex flex-none flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft/40 px-3 py-2 text-sm text-warning-strong"
                            role="status"
                        >
                            <span className="flex items-start gap-2">
                                <AlertTriangle
                                    className="mt-0.5 h-4 w-4 shrink-0"
                                    aria-hidden="true"
                                />
                                Candidate results are from an earlier job
                                version. Refresh before selecting resources.
                            </span>
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={reloadCandidates}
                                disabled={loading}
                            >
                                {loading ? 'Refreshing…' : 'Refresh results'}
                            </Button>
                        </div>
                    )}

                    <div className="grid min-h-0 flex-1 gap-5 max-md:flex max-md:flex-col max-md:overflow-y-auto max-md:overscroll-contain max-md:pr-1 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <section
                            aria-labelledby="resource-picker-candidates-heading"
                            className="flex min-h-0 min-w-0 flex-col max-md:shrink-0"
                        >
                            <div className="mb-2 flex flex-none items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3
                                        id="resource-picker-candidates-heading"
                                        className="text-xs font-semibold tracking-[0.14em] text-ink-soft uppercase"
                                    >
                                        {mode === 'replacement'
                                            ? compatibleResourceLabel(target)
                                            : resourceTab === 'personnel'
                                              ? 'Employees'
                                              : 'Assets'}
                                    </h3>
                                    <p className="mt-1 text-xs text-ink-soft">
                                        {mode === 'replacement' && !eligibleOnly
                                            ? 'Results include blocked resources.'
                                            : 'Review the eligibility status before selecting.'}
                                    </p>
                                </div>
                                <span
                                    className="shrink-0 text-xs font-medium text-ink-soft"
                                    role="status"
                                    aria-live="polite"
                                >
                                    {loading
                                        ? 'Loading…'
                                        : `${resultCount} result${resultCount === 1 ? '' : 's'}`}
                                </span>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 max-md:flex-none max-md:overflow-visible max-md:pr-0">
                                {loading && !hasActiveResults ? (
                                    <CandidateSkeleton />
                                ) : activePage?.error ? (
                                    <div
                                        className="rounded-xl border border-danger/30 bg-danger-soft/40 p-4"
                                        role="alert"
                                    >
                                        <p className="text-sm font-semibold text-danger">
                                            Candidate data is unavailable
                                        </p>
                                        <p className="mt-1 text-sm leading-5 text-danger">
                                            {activePage.error}
                                        </p>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            className="mt-3"
                                            onClick={
                                                onRetry ?? reloadCandidates
                                            }
                                            disabled={loading}
                                        >
                                            {loading ? 'Retrying…' : 'Retry'}
                                        </Button>
                                    </div>
                                ) : displayedCandidates.length === 0 ? (
                                    <EmptyState
                                        compact
                                        icon={Search}
                                        title={
                                            searchQuery ||
                                            eligibleOnly ||
                                            resourceTypeFilter !== 'all'
                                                ? `No matching ${resourceTab === 'personnel' ? 'employees' : 'assets'}`
                                                : `No ${resourceTab === 'personnel' ? 'employees' : 'assets'} found`
                                        }
                                        message={
                                            searchQuery ||
                                            eligibleOnly ||
                                            resourceTypeFilter !== 'all'
                                                ? 'Try a different search or clear the filters to review all candidates.'
                                                : 'No candidates are available for this dispatch.'
                                        }
                                        primaryAction={
                                            searchQuery ||
                                            eligibleOnly ||
                                            resourceTypeFilter !== 'all' ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={clearFilters}
                                                >
                                                    Clear filters
                                                </Button>
                                            ) : undefined
                                        }
                                    />
                                ) : (
                                    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                                        {resourceTab === 'personnel'
                                            ? personnelCandidates
                                                  .filter((candidate) =>
                                                      displayedCandidates.includes(
                                                          candidate,
                                                      ),
                                                  )
                                                  .map((candidate) => (
                                                      <PersonnelPickerRow
                                                          key={candidate.id}
                                                          candidate={candidate}
                                                          selected={selectedPersonnelIds.includes(
                                                              candidate.id,
                                                          )}
                                                          selectable={
                                                              canSelect &&
                                                              !activePageStale &&
                                                              (mode !==
                                                                  'replacement' ||
                                                                  isCompatibleCandidate(
                                                                      candidate,
                                                                      target?.type,
                                                                  ))
                                                          }
                                                          assigned={assignedPersonnelIds.has(
                                                              candidate.id,
                                                          )}
                                                          replacement={
                                                              mode ===
                                                              'replacement'
                                                          }
                                                          replacementSelected={
                                                              selectedReplacementId ===
                                                              candidate.id
                                                          }
                                                          onToggle={() => {
                                                              if (
                                                                  mode ===
                                                                  'replacement'
                                                              ) {
                                                                  handleReplacementSelection(
                                                                      candidate,
                                                                  );
                                                              }

                                                              onTogglePersonnel(
                                                                  candidate,
                                                              );
                                                          }}
                                                      />
                                                  ))
                                            : assetCandidates
                                                  .filter((candidate) =>
                                                      displayedCandidates.includes(
                                                          candidate,
                                                      ),
                                                  )
                                                  .map((candidate) => (
                                                      <AssetPickerRow
                                                          key={candidate.id}
                                                          candidate={candidate}
                                                          selected={selectedAssetIds.includes(
                                                              candidate.id,
                                                          )}
                                                          selectable={
                                                              canSelect &&
                                                              !activePageStale &&
                                                              (mode !==
                                                                  'replacement' ||
                                                                  isCompatibleCandidate(
                                                                      candidate,
                                                                      target?.type,
                                                                  ))
                                                          }
                                                          assigned={assignedAssetIds.has(
                                                              candidate.id,
                                                          )}
                                                          replacement={
                                                              mode ===
                                                              'replacement'
                                                          }
                                                          replacementSelected={
                                                              selectedReplacementId ===
                                                              candidate.id
                                                          }
                                                          onToggle={() => {
                                                              if (
                                                                  mode ===
                                                                  'replacement'
                                                              ) {
                                                                  handleReplacementSelection(
                                                                      candidate,
                                                                  );
                                                              }

                                                              onToggleAsset(
                                                                  candidate,
                                                              );
                                                          }}
                                                      />
                                                  ))}
                                    </ul>
                                )}
                            </div>

                            {activePage &&
                                activePage.pagination.last_page > 1 && (
                                    <CandidatePagination
                                        page={activePage}
                                        loading={loading}
                                        currentPage={currentPage}
                                        onPrevious={() =>
                                            setCurrentPage((page) =>
                                                Math.max(1, page - 1),
                                            )
                                        }
                                        onNext={() =>
                                            setCurrentPage((page) =>
                                                Math.min(
                                                    activePage.pagination
                                                        .last_page,
                                                    page + 1,
                                                ),
                                            )
                                        }
                                    />
                                )}
                        </section>

                        <ReviewAside
                            mode={mode}
                            target={target}
                            replacementCandidate={replacementCandidate}
                            selectedPersonnel={selectedPersonnel}
                            selectedAssets={selectedAssets}
                            onRemovePersonnel={onTogglePersonnel}
                            onRemoveAsset={onToggleAsset}
                            reason={reason}
                            onReasonChange={onReasonChange}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
}

function PickerTab({
    active,
    count,
    onClick,
    label,
}: {
    active: boolean;
    count: number;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${label}: ${count} selected`}
            onClick={onClick}
            className={cn(
                'min-h-11 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                active
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-soft hover:text-ink',
            )}
        >
            <span>{label}</span>{' '}
            <span className="text-xs text-ink-soft">· {count} selected</span>
        </button>
    );
}

function CandidateSkeleton() {
    return (
        <div
            className="space-y-2"
            role="status"
            aria-label="Loading candidates"
        >
            {[1, 2, 3].map((item) => (
                <div
                    key={item}
                    className="flex min-h-24 gap-3 rounded-xl border border-line bg-surface p-3"
                >
                    <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/5" />
                        <Skeleton className="h-3 w-3/5" />
                        <Skeleton className="h-3 w-4/5" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function CandidatePagination({
    page,
    loading,
    currentPage,
    onPrevious,
    onNext,
}: {
    page: CandidatePageViewModel<unknown>;
    loading: boolean;
    currentPage: number;
    onPrevious: () => void;
    onNext: () => void;
}) {
    return (
        <div className="mt-3 flex flex-none flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-soft">
            <p aria-live="polite">
                Showing {page.pagination.from ?? 0}–{page.pagination.to ?? 0} of{' '}
                {page.pagination.total} · evaluated{' '}
                {new Date(page.evaluated_at).toLocaleTimeString()}
            </p>
            <div className="flex gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="quiet"
                    disabled={loading || currentPage <= 1}
                    onClick={onPrevious}
                >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Previous
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="quiet"
                    disabled={
                        loading || currentPage >= page.pagination.last_page
                    }
                    onClick={onNext}
                >
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
}

function CandidateRowShell({
    children,
    selected,
    assigned,
    eligible,
    selectable,
    onToggle,
    detailsId,
}: {
    children: React.ReactNode;
    selected: boolean;
    assigned: boolean;
    eligible: boolean;
    selectable: boolean;
    onToggle: () => void;
    detailsId: string;
}) {
    const canToggle = selectable && eligible && !assigned;

    return (
        <li
            className={cn(
                'p-3 transition-colors sm:p-3.5',
                selected && 'bg-brand-soft/60',
                !eligible && 'bg-danger-soft/20',
                assigned && 'bg-surface-subtle/70',
            )}
            onClick={(event) => {
                if (!canToggle) {
                    return;
                }

                const target = event.target as HTMLElement;

                if (
                    target.closest(
                        'input, label, button, a, summary, select, textarea',
                    )
                ) {
                    return;
                }

                onToggle();
            }}
        >
            <div className="flex min-h-16 items-start gap-2.5">{children}</div>
            <p id={detailsId} className="sr-only">
                {assigned
                    ? 'Already assigned to this dispatch.'
                    : !eligible
                      ? 'Unavailable for this dispatch.'
                      : selected
                        ? 'Selected.'
                        : 'Available to select.'}
            </p>
        </li>
    );
}

function ChoiceControl({
    id,
    selected,
    disabled,
    replacement,
    label,
    describedBy,
    onChange,
}: {
    id: string;
    selected: boolean;
    disabled: boolean;
    replacement: boolean;
    label: string;
    describedBy: string;
    onChange: () => void;
}) {
    return (
        <label
            htmlFor={id}
            className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-start justify-center pt-1"
            onClick={(event) => event.stopPropagation()}
        >
            <input
                id={id}
                type={replacement ? 'radio' : 'checkbox'}
                name={replacement ? 'resource-replacement' : undefined}
                checked={selected}
                disabled={disabled}
                onChange={onChange}
                className="h-5 w-5 accent-[var(--color-brand)] disabled:cursor-not-allowed"
                aria-label={label}
                aria-describedby={describedBy}
            />
        </label>
    );
}

function CandidateStatus({
    eligible,
    assigned,
}: {
    eligible: boolean;
    assigned: boolean;
}) {
    return assigned ? (
        <span className="text-xs font-semibold text-ink-soft">Assigned</span>
    ) : (
        <EligibilityBadge eligible={eligible} />
    );
}

function PersonnelPickerRow({
    candidate,
    selected,
    selectable,
    assigned,
    replacement,
    replacementSelected,
    onToggle,
}: {
    candidate: PersonnelCandidateViewModel;
    selected: boolean;
    selectable: boolean;
    assigned: boolean;
    replacement: boolean;
    replacementSelected: boolean;
    onToggle: () => void;
}) {
    const detailsId = `picker-personnel-${candidate.id}-details`;
    const inputId = `picker-personnel-${candidate.id}`;
    const chosen = replacement ? replacementSelected : selected;
    const alreadyAssigned = assigned || candidate.already_assigned;
    const disabled = !selectable || alreadyAssigned || !candidate.eligible;

    return (
        <CandidateRowShell
            selected={chosen}
            assigned={alreadyAssigned}
            eligible={candidate.eligible}
            selectable={selectable}
            onToggle={onToggle}
            detailsId={detailsId}
        >
            <ChoiceControl
                id={inputId}
                selected={chosen}
                disabled={disabled}
                replacement={replacement}
                label={`${chosen ? 'Deselect' : 'Select'} ${candidate.name} as ${candidate.assignment_label}`}
                describedBy={detailsId}
                onChange={onToggle}
            />
            <div className="flex min-w-0 flex-1 gap-3">
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-xs font-bold text-brand-strong"
                    aria-hidden="true"
                >
                    {getInitials(candidate.name)}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0">
                            <p className="font-semibold break-words text-ink">
                                {candidate.name}
                            </p>
                            <p className="mt-0.5 text-xs break-words text-ink-soft">
                                {candidate.assignment_label} ·{' '}
                                {candidate.availability.label}
                            </p>
                        </div>
                        <div className="shrink-0 pt-0.5">
                            <CandidateStatus
                                eligible={candidate.eligible}
                                assigned={alreadyAssigned}
                            />
                        </div>
                    </div>
                    {candidate.reasons[0] && (
                        <p className="mt-1 text-xs leading-5 font-medium break-words text-danger">
                            {candidate.reasons[0]}
                        </p>
                    )}
                    <CandidateDetails>
                        <p>Account: {candidate.account_status.label}</p>
                        <p>{credentialSummary(candidate)}</p>
                        {candidate.reasons.length > 0 ? (
                            <ul className="space-y-1 text-danger">
                                {candidate.reasons.map((reason) => (
                                    <li key={reason}>{reason}</li>
                                ))}
                            </ul>
                        ) : candidate.schedule_conflicts.length === 0 ? (
                            <p className="flex items-start gap-1.5 font-medium text-success-strong">
                                <ShieldCheck
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                No blocking conflict at this schedule.
                            </p>
                        ) : null}
                        <ScheduleConflicts
                            candidateId={candidate.id}
                            conflicts={candidate.schedule_conflicts}
                        />
                    </CandidateDetails>
                </div>
            </div>
        </CandidateRowShell>
    );
}

function AssetPickerRow({
    candidate,
    selected,
    selectable,
    assigned,
    replacement,
    replacementSelected,
    onToggle,
}: {
    candidate: AssetCandidateViewModel;
    selected: boolean;
    selectable: boolean;
    assigned: boolean;
    replacement: boolean;
    replacementSelected: boolean;
    onToggle: () => void;
}) {
    const detailsId = `picker-asset-${candidate.id}-details`;
    const inputId = `picker-asset-${candidate.id}`;
    const chosen = replacement ? replacementSelected : selected;
    const alreadyAssigned = assigned || candidate.already_assigned;
    const disabled = !selectable || alreadyAssigned || !candidate.eligible;
    const blockingReason =
        candidate.reasons[0] ??
        (candidate.blocking_maintenance_count > 0
            ? `${candidate.blocking_maintenance_count} blocking maintenance item${candidate.blocking_maintenance_count === 1 ? '' : 's'}.`
            : null);

    return (
        <CandidateRowShell
            selected={chosen}
            assigned={alreadyAssigned}
            eligible={candidate.eligible}
            selectable={selectable}
            onToggle={onToggle}
            detailsId={detailsId}
        >
            <ChoiceControl
                id={inputId}
                selected={chosen}
                disabled={disabled}
                replacement={replacement}
                label={`${chosen ? 'Deselect' : 'Select'} ${candidate.code} ${candidate.name}`}
                describedBy={detailsId}
                onChange={onToggle}
            />
            <div className="flex min-w-0 flex-1 gap-3">
                <ResourceIcon icon="asset" />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0">
                            <p className="font-semibold break-words text-ink">
                                {candidate.code} · {candidate.name}
                            </p>
                            <p className="mt-0.5 text-xs break-words text-ink-soft">
                                {candidate.assignment_label} ·{' '}
                                {candidate.readiness.label}
                            </p>
                        </div>
                        <div className="shrink-0 pt-0.5">
                            <CandidateStatus
                                eligible={candidate.eligible}
                                assigned={alreadyAssigned}
                            />
                        </div>
                    </div>
                    {blockingReason && (
                        <p className="mt-1 text-xs leading-5 font-medium break-words text-danger">
                            {blockingReason}
                        </p>
                    )}
                    <CandidateDetails>
                        {candidate.blocking_maintenance_count > 0 && (
                            <p>
                                {candidate.blocking_maintenance_count} blocking
                                maintenance item
                                {candidate.blocking_maintenance_count === 1
                                    ? ''
                                    : 's'}
                                .
                            </p>
                        )}
                        {candidate.reasons.length > 0 ? (
                            <ul className="space-y-1 text-danger">
                                {candidate.reasons.map((reason) => (
                                    <li key={reason}>{reason}</li>
                                ))}
                            </ul>
                        ) : candidate.blocking_maintenance_count === 0 &&
                          candidate.schedule_conflicts.length === 0 ? (
                            <p className="flex items-start gap-1.5 font-medium text-success-strong">
                                <ShieldCheck
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                No additional blocking evidence.
                            </p>
                        ) : null}
                        <ScheduleConflicts
                            candidateId={candidate.id}
                            conflicts={candidate.schedule_conflicts}
                        />
                    </CandidateDetails>
                </div>
            </div>
        </CandidateRowShell>
    );
}

function CandidateDetails({ children }: { children: React.ReactNode }) {
    return (
        <details
            className="group mt-1"
            onClick={(event) => event.stopPropagation()}
        >
            <summary className="flex min-h-8 w-fit cursor-pointer list-none items-center gap-1 text-xs font-semibold text-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <ChevronDown
                    className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                />
                Details
            </summary>
            <div className="mt-1 space-y-2 rounded-lg border border-line bg-surface-subtle/60 p-3 text-xs leading-5 text-ink-soft">
                {children}
            </div>
        </details>
    );
}

function ScheduleConflicts({
    candidateId,
    conflicts,
}: {
    candidateId: number;
    conflicts: PersonnelCandidateViewModel['schedule_conflicts'];
}) {
    if (conflicts.length === 0) {
        return null;
    }

    return (
        <ul className="space-y-1 border-t border-line pt-2 text-danger">
            {conflicts.map((conflict) => (
                <li key={`${candidateId}-${conflict.id}`}>
                    {conflict.reference}:{' '}
                    {formatDateTime(conflict.scheduled_start)} –{' '}
                    {formatDateTime(conflict.scheduled_end)}
                </li>
            ))}
        </ul>
    );
}

function ReviewAside({
    mode,
    target,
    replacementCandidate,
    selectedPersonnel,
    selectedAssets,
    onRemovePersonnel,
    onRemoveAsset,
    reason,
    onReasonChange,
}: {
    mode: PickerMode;
    target?: ReassignmentTarget;
    replacementCandidate: Candidate | null;
    selectedPersonnel: PersonnelCandidateViewModel[];
    selectedAssets: AssetCandidateViewModel[];
    onRemovePersonnel: (candidate: PersonnelCandidateViewModel) => void;
    onRemoveAsset: (candidate: AssetCandidateViewModel) => void;
    reason: string;
    onReasonChange?: (reason: string) => void;
}) {
    const selectedCount = selectedPersonnel.length + selectedAssets.length;

    return (
        <aside className="min-h-0 min-w-0 max-md:flex-none">
            <div className="hidden h-full min-h-0 overflow-y-auto border-l border-line pr-1 pl-5 lg:block">
                <ReviewHeading mode={mode} selectedCount={selectedCount} />
                <ReviewContent
                    mode={mode}
                    target={target}
                    replacementCandidate={replacementCandidate}
                    selectedPersonnel={selectedPersonnel}
                    selectedAssets={selectedAssets}
                    onRemovePersonnel={onRemovePersonnel}
                    onRemoveAsset={onRemoveAsset}
                    reason={reason}
                    onReasonChange={onReasonChange}
                />
            </div>
            <details className="overflow-hidden rounded-xl border border-line bg-surface-subtle/40 lg:hidden">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                    <span>
                        {mode === 'replacement'
                            ? 'Review replacement'
                            : `Review selections · ${selectedCount} selected`}
                    </span>
                    <ChevronDown
                        className="h-4 w-4 shrink-0 text-ink-soft"
                        aria-hidden="true"
                    />
                </summary>
                <div className="border-t border-line p-4">
                    <ReviewContent
                        mode={mode}
                        target={target}
                        replacementCandidate={replacementCandidate}
                        selectedPersonnel={selectedPersonnel}
                        selectedAssets={selectedAssets}
                        onRemovePersonnel={onRemovePersonnel}
                        onRemoveAsset={onRemoveAsset}
                        reason={reason}
                        onReasonChange={onReasonChange}
                    />
                </div>
            </details>
        </aside>
    );
}

function ReviewHeading({
    mode,
    selectedCount,
}: {
    mode: PickerMode;
    selectedCount: number;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold tracking-[0.14em] text-ink-soft uppercase">
                {mode === 'replacement' ? 'Replacement' : 'Selected resources'}
            </h3>
            {mode === 'initial' && (
                <span className="text-xs font-semibold text-ink-soft">
                    {selectedCount} selected
                </span>
            )}
        </div>
    );
}

function ReviewContent({
    mode,
    target,
    replacementCandidate,
    selectedPersonnel,
    selectedAssets,
    onRemovePersonnel,
    onRemoveAsset,
    reason,
    onReasonChange,
}: {
    mode: PickerMode;
    target?: ReassignmentTarget;
    replacementCandidate: Candidate | null;
    selectedPersonnel: PersonnelCandidateViewModel[];
    selectedAssets: AssetCandidateViewModel[];
    onRemovePersonnel: (candidate: PersonnelCandidateViewModel) => void;
    onRemoveAsset: (candidate: AssetCandidateViewModel) => void;
    reason: string;
    onReasonChange?: (reason: string) => void;
}) {
    return mode === 'replacement' ? (
        <ReplacementReview
            target={target}
            candidate={replacementCandidate}
            reason={reason}
            onReasonChange={onReasonChange}
        />
    ) : (
        <SelectionReview
            personnel={selectedPersonnel}
            assets={selectedAssets}
            onRemovePersonnel={onRemovePersonnel}
            onRemoveAsset={onRemoveAsset}
        />
    );
}

function SelectionReview({
    personnel,
    assets,
    onRemovePersonnel,
    onRemoveAsset,
}: {
    personnel: PersonnelCandidateViewModel[];
    assets: AssetCandidateViewModel[];
    onRemovePersonnel: (candidate: PersonnelCandidateViewModel) => void;
    onRemoveAsset: (candidate: AssetCandidateViewModel) => void;
}) {
    return (
        <div className="mt-4 space-y-4">
            <SelectionReviewGroup
                label={`Employees · ${personnel.length} selected`}
                emptyMessage="No employees selected"
            >
                {personnel.map((candidate) => (
                    <SelectedResourceRow
                        key={candidate.id}
                        label={candidate.name}
                        detail={candidate.assignment_label}
                        onRemove={() => onRemovePersonnel(candidate)}
                    />
                ))}
            </SelectionReviewGroup>
            <SelectionReviewGroup
                label={`Assets · ${assets.length} selected`}
                emptyMessage="No assets selected"
            >
                {assets.map((candidate) => (
                    <SelectedResourceRow
                        key={candidate.id}
                        label={candidate.code}
                        detail={candidate.name}
                        onRemove={() => onRemoveAsset(candidate)}
                    />
                ))}
            </SelectionReviewGroup>
            <p className="border-t border-line pt-3 text-xs leading-5 text-ink-soft">
                Selections remain staged while you search, change pages, or
                review the other category.
            </p>
        </div>
    );
}

function SelectionReviewGroup({
    label,
    emptyMessage,
    children,
}: {
    label: string;
    emptyMessage: string;
    children: React.ReactNode;
}) {
    return (
        <section>
            <h4 className="text-xs font-semibold text-ink">{label}</h4>
            {React.Children.count(children) > 0 ? (
                <div className="mt-2 space-y-2">{children}</div>
            ) : (
                <p className="mt-1 text-xs text-ink-soft">{emptyMessage}</p>
            )}
        </section>
    );
}

function SelectedResourceRow({
    label,
    detail,
    onRemove,
}: {
    label: string;
    detail: string;
    onRemove: () => void;
}) {
    return (
        <div className="flex min-w-0 items-start justify-between gap-2 rounded-lg border border-brand/25 bg-brand-soft/60 p-2.5">
            <div className="min-w-0">
                <p className="text-xs font-semibold break-words text-ink">
                    {label}
                </p>
                <p className="mt-0.5 text-xs break-words text-ink-soft">
                    {detail}
                </p>
            </div>
            <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                onClick={onRemove}
                aria-label={`Remove ${label}`}
            >
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
}

function ReplacementReview({
    target,
    candidate,
    reason,
    onReasonChange,
}: {
    target?: ReassignmentTarget;
    candidate: Candidate | null;
    reason: string;
    onReasonChange?: (reason: string) => void;
}) {
    return (
        <div className="mt-4 space-y-4">
            <div>
                <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-soft uppercase">
                    Current assignment
                </p>
                <p className="mt-1 text-sm font-semibold break-words text-ink">
                    {target?.name ?? 'Current resource'}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                    {titleCase(humanize(target?.type ?? 'resource'))}
                </p>
            </div>
            <div className="flex items-center gap-2 border-t border-line pt-3 text-xs font-medium text-ink-soft">
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                <span>will be replaced by</span>
            </div>
            <div className="border-t border-line pt-3">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-soft uppercase">
                    Chosen replacement
                </p>
                {candidate ? (
                    <div className="mt-2 rounded-lg border border-brand/25 bg-brand-soft/60 p-2.5">
                        <p className="text-xs font-semibold break-words text-ink">
                            {candidateLabel(candidate)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-ink-soft">
                                {candidate.assignment_label}
                            </span>
                            <EligibilityBadge eligible={candidate.eligible} />
                        </div>
                    </div>
                ) : (
                    <p className="mt-1 text-xs text-ink-soft">
                        Choose a resource from the list.
                    </p>
                )}
            </div>
            {onReasonChange && (
                <div className="border-t border-line pt-3">
                    <label
                        htmlFor="reassignment-reason"
                        className="flex items-baseline justify-between gap-2 text-xs font-semibold text-ink"
                    >
                        <span>Reassignment reason / notes</span>
                        <span className="font-normal text-ink-soft">
                            Optional
                        </span>
                    </label>
                    <textarea
                        id="reassignment-reason"
                        rows={3}
                        value={reason}
                        onChange={(event) => onReasonChange(event.target.value)}
                        placeholder="Add context for the reassignment…"
                        className="mt-2 block w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/70 focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none"
                    />
                </div>
            )}
            <p className="border-t border-line pt-3 text-xs leading-5 text-ink-soft">
                The current assignment stays in place until you confirm the
                replacement.
            </p>
        </div>
    );
}

export type { ReassignmentTarget };
