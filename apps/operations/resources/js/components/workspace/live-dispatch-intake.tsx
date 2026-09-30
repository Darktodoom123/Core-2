import { useForm, router } from '@inertiajs/react';
import { CalendarDays, CheckCircle2, Package, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';
import {
    Button,
    DataPair,
    DateTimePicker,
    EmptyState,
    Panel,
} from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { DirectDispatchView } from '@/components/workspace/direct-dispatch/direct-dispatch-view';
import {
    addHours,
    isIncomingQueuePage,
    toLocalDateTime,
} from '@/components/workspace/incoming-work/incoming-work-helpers';
import type {
    IncomingQueuePage,
    IncomingWorkItem,
} from '@/components/workspace/incoming-work/incoming-work-helpers';
import { humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    ClientViewModel,
    DispatchJobViewModel,
    RentalDispatchHandoffViewModel,
    ServiceRequestViewModel,
    UnlinkedHandoffItem,
    WorkspaceCapabilities,
} from '@/types/workspace';

export type IntakeMode =
    'manual' | 'service' | 'rental' | 'reconciliation' | 'client' | null;

export function LiveDispatchIntake({
    clients,
    serviceRequests,
    rentalHandoffs = [],
    jobs = [],
    capabilities,
    initialRequestId,
    initialMode = null,
    showQueueWhenEmpty = false,
    incomingTotal,
    onIncomingTotalChange,
    onClose,
    onBackToQueue,
    onDirtyChange,
}: {
    clients: ClientViewModel[];
    serviceRequests: ServiceRequestViewModel[];
    rentalHandoffs?: RentalDispatchHandoffViewModel[];
    jobs?: DispatchJobViewModel[];
    capabilities: WorkspaceCapabilities;
    initialRequestId?: number | null;
    initialMode?: IntakeMode;
    showQueueWhenEmpty?: boolean;
    incomingTotal?: number;
    onIncomingTotalChange?: (total: number) => void;
    onClose?: () => void;
    onBackToQueue?: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
}) {
    const canCreateManual = capabilities.create_dispatch;
    const canReviewService = capabilities.convert_service_request;
    const canReviewRental = capabilities.create_rental_dispatch;
    const canReconcile = canReviewService || canReviewRental;

    const [queuePage, setQueuePage] = useState(1);
    const [queueRetry, setQueueRetry] = useState(0);
    const [queueResult, setQueueResult] = useState<IncomingQueuePage | null>(
        null,
    );
    const [queuePending, setQueuePending] = useState(false);
    const [queueError, setQueueError] = useState<string | null>(null);
    const lastLoadedQueuePage = useRef<number | null>(null);

    useEffect(() => {
        if (!showQueueWhenEmpty) {
            return;
        }

        const controller = new AbortController();
        const loadIncomingPage = async () => {
            setQueuePending(true);
            setQueueError(null);

            try {
                const params = new URLSearchParams({
                    page: String(queuePage),
                });

                if (initialRequestId) {
                    params.set(
                        'focus_service_request_id',
                        String(initialRequestId),
                    );
                }

                const response = await fetch(
                    `/operations/dispatch-desk/incoming?${params}`,
                    {
                        credentials: 'same-origin',
                        headers: { Accept: 'application/json' },
                        signal: controller.signal,
                    },
                );

                if (!response.ok) {
                    throw new Error('Incoming queue failed');
                }

                const page: unknown = await response.json();

                if (!isIncomingQueuePage(page)) {
                    throw new Error('Incoming queue response was invalid');
                }

                if (!controller.signal.aborted) {
                    lastLoadedQueuePage.current = page.current_page;
                    setQueueResult(page);
                    onIncomingTotalChange?.(page.total);

                    if (page.current_page !== queuePage) {
                        setQueuePage(page.current_page);
                    }
                }
            } catch {
                if (!controller.signal.aborted) {
                    setQueueError(
                        lastLoadedQueuePage.current === queuePage
                            ? "Couldn't refresh the list. You're seeing the last loaded page, which may be out of date."
                            : "This page couldn't load. Try again, or go back to the last page.",
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setQueuePending(false);
                }
            }
        };

        void loadIncomingPage();

        return () => controller.abort();
    }, [
        incomingTotal,
        initialRequestId,
        onIncomingTotalChange,
        queuePage,
        queueRetry,
        rentalHandoffs,
        serviceRequests,
        showQueueWhenEmpty,
    ]);

    const currentQueuePage =
        queueResult?.current_page === queuePage ? queueResult : null;
    const sourceDataPending =
        showQueueWhenEmpty && queueResult !== null && !currentQueuePage;
    const queueLastPage =
        queueResult?.last_page ??
        Math.max(1, Math.ceil((incomingTotal ?? 0) / 25));
    const visibleServiceRequests = currentQueuePage
        ? currentQueuePage.service_requests
        : sourceDataPending
          ? []
          : serviceRequests;
    const visibleRentalHandoffs = currentQueuePage
        ? currentQueuePage.rental_handoffs
        : sourceDataPending
          ? []
          : rentalHandoffs;

    const fallbackIncomingItems = useMemo<IncomingWorkItem[]>(() => {
        const services = canReviewService
            ? serviceRequests
                  .filter((request) => request.dispatch_jobs_count === 0)
                  .map((request) => ({
                      key: `service-${request.id}`,
                      mode: 'service' as const,
                      sourceLabel: 'Service request',
                      reference: request.reference,
                      client: request.client.company_name,
                      detail:
                          request.project_name ||
                          request.service_type ||
                          request.location ||
                          'Service demand awaiting dispatch',
                      status: request.status.label,
                      sourceId: request.id,
                  }))
            : [];
        const rentals = canReviewRental
            ? rentalHandoffs
                  .filter((handoff) => !handoff.dispatch_job_id)
                  .map((handoff) => ({
                      key: `rental-${handoff.id}`,
                      mode: 'rental' as const,
                      sourceLabel: 'Rental delivery',
                      reference: handoff.reference,
                      client: handoff.client.company_name,
                      detail:
                          handoff.location || 'Delivery location needs review',
                      status: handoff.status.label,
                      sourceId: handoff.id,
                      hasEvidence: handoff.has_evidence,
                      evidenceSignee: handoff.evidence_signee,
                  }))
            : [];

        return [...services, ...rentals];
    }, [canReviewRental, canReviewService, rentalHandoffs, serviceRequests]);

    const incomingItems = currentQueuePage
        ? currentQueuePage.items
        : sourceDataPending
          ? []
          : fallbackIncomingItems;
    const incomingTotalCount =
        queueResult?.total ?? incomingTotal ?? fallbackIncomingItems.length;

    const [mode, setMode] = useState<IntakeMode>(() => {
        if (initialRequestId) {
            return 'service';
        }

        if (initialMode) {
            return initialMode;
        }

        return incomingItems.length > 0 || showQueueWhenEmpty ? null : 'manual';
    });
    const [selectedItemKey, setSelectedItemKey] = useState<string | null>(
        initialRequestId ? `service-${initialRequestId}` : null,
    );
    const [showClientIntake, setShowClientIntake] = useState(false);
    const unlinkedCount = showQueueWhenEmpty
        ? incomingTotalCount
        : fallbackIncomingItems.length;

    const changeQueuePage = (page: number) => {
        setSelectedItemKey(null);
        setQueuePage(Math.max(1, Math.min(queueLastPage, page)));
    };

    const closeWorkflow = () => {
        setMode(null);
        setSelectedItemKey(null);
        setShowClientIntake(false);
    };

    if (mode === 'manual' && canCreateManual) {
        return (
            <section
                className="direct-dispatch-view border-b border-line bg-surface px-4 py-5 md:px-6"
                aria-labelledby="direct-dispatch-title"
            >
                <div className="workspace-width-contained mx-auto max-w-7xl">
                    <DirectDispatchView
                        clients={clients}
                        capabilities={capabilities}
                        onBack={() => {
                            setShowClientIntake(false);
                            onDirtyChange?.(false);

                            if (onBackToQueue) {
                                onBackToQueue();
                            } else if (
                                incomingItems.length > 0 ||
                                showQueueWhenEmpty
                            ) {
                                setMode(null);
                            } else {
                                onClose?.();
                            }
                        }}
                        onClose={() => {
                            setShowClientIntake(false);
                            onDirtyChange?.(false);
                            onClose?.();
                        }}
                        onAddClient={() => setShowClientIntake(true)}
                        onDirtyChange={onDirtyChange}
                        onExitFocus={(reason) => {
                            window.requestAnimationFrame(() => {
                                document
                                    .getElementById(
                                        reason === 'back' &&
                                            (onBackToQueue !== undefined ||
                                                incomingItems.length > 0 ||
                                                showQueueWhenEmpty)
                                            ? 'create-direct-dispatch-trigger'
                                            : 'new-dispatch-trigger',
                                    )
                                    ?.focus();
                            });
                        }}
                    />
                    {showClientIntake && (
                        <ClientIntakeForm
                            onClose={() => setShowClientIntake(false)}
                        />
                    )}
                </div>
            </section>
        );
    }

    return (
        <section
            className="border-b border-line bg-surface px-4 py-5 md:px-6"
            aria-labelledby="dispatch-intake-title"
        >
            <div className="workspace-width-contained mx-auto max-w-7xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2
                            id="dispatch-intake-title"
                            className="text-lg font-semibold tracking-tight text-ink"
                        >
                            New dispatch
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                            Turn a customer order from Core 1 into a dispatch,
                            or create one directly for other work.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {capabilities.create_client && (
                            <Button
                                size="md"
                                variant={
                                    mode === 'client' ? 'primary' : 'secondary'
                                }
                                onClick={() => {
                                    setSelectedItemKey(null);
                                    setMode((cur) =>
                                        cur === 'client' ? null : 'client',
                                    );
                                }}
                                aria-expanded={mode === 'client'}
                                aria-controls="client-intake-form"
                            >
                                Add client
                            </Button>
                        )}
                        {onClose && (
                            <Button
                                size="md"
                                variant="quiet"
                                onClick={onClose}
                                aria-label="Close intake"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        )}
                    </div>
                </div>

                {showClientIntake && capabilities.create_client && (
                    <div className="mt-4">
                        <ClientIntakeForm
                            onClose={() => setShowClientIntake(false)}
                        />
                    </div>
                )}

                <div
                    className="mt-5 rounded-xl border border-line bg-surface-subtle p-4"
                    aria-live="polite"
                >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                From Core 1
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-ink">
                                Incoming work queue
                            </h3>
                            <p className="mt-1 max-w-2xl text-sm text-ink-soft">
                                Open an order to check the site details, then
                                assign a crane and crew.
                            </p>
                        </div>
                        <span className="inline-flex w-fit items-center rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-ink">
                            {incomingTotalCount > 0
                                ? `${incomingTotalCount} waiting`
                                : 'Nothing waiting'}
                        </span>
                    </div>

                    {queuePending && (
                        <p
                            className="mt-2 text-xs text-info-strong"
                            role="status"
                        >
                            Loading orders…
                        </p>
                    )}
                    {queueError && (
                        <div
                            className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-ink"
                            role="alert"
                        >
                            <span>{queueError}</span>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                    setQueueRetry((value) => value + 1)
                                }
                            >
                                Try again
                            </Button>
                            {sourceDataPending && queueResult && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                        setQueuePage(queueResult.current_page)
                                    }
                                >
                                    Back to page {queueResult.current_page}
                                </Button>
                            )}
                        </div>
                    )}

                    <div
                        className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface"
                        role={incomingItems.length > 0 ? 'list' : 'region'}
                        aria-label="Incoming work queue"
                    >
                        {incomingItems.length > 0 ? (
                            incomingItems.map((item) => (
                                <IncomingWorkRow
                                    key={item.key}
                                    item={item}
                                    selected={selectedItemKey === item.key}
                                    onClick={() => {
                                        setSelectedItemKey(item.key);
                                        setMode(item.mode);
                                    }}
                                />
                            ))
                        ) : queuePending || sourceDataPending ? (
                            <div className="space-y-3 p-5" role="status">
                                <div className="h-4 w-2/3 animate-pulse rounded bg-surface-subtle" />
                                <div className="h-4 w-1/2 animate-pulse rounded bg-surface-subtle" />
                                <p className="text-xs text-ink-soft">
                                    Loading page {queuePage} of {queueLastPage}…
                                </p>
                            </div>
                        ) : incomingTotalCount === 0 ? (
                            <div className="p-6 text-center">
                                <Package className="mx-auto h-8 w-8 text-ink-soft" />
                                <h4 className="mt-2 text-sm font-semibold text-ink">
                                    No orders waiting
                                </h4>
                                <p className="mt-1 text-xs text-ink-soft">
                                    New customer orders from Core 1 appear here.
                                    For other work, use Create direct dispatch
                                    below.
                                </p>
                            </div>
                        ) : queueError ? (
                            <div className="p-6 text-center text-sm text-ink-soft">
                                This page is unavailable until the list
                                refreshes.
                            </div>
                        ) : (
                            <div className="p-6 text-center text-sm text-ink-soft">
                                Nothing came back for this page. Try again.
                            </div>
                        )}
                    </div>
                    {currentQueuePage && (
                        <p className="mt-2 text-xs text-ink-soft">
                            {queueError
                                ? 'Showing the last loaded page. It may be out of date.'
                                : `Showing ${incomingItems.length} of ${currentQueuePage.total} orders`}
                        </p>
                    )}
                    {currentQueuePage && currentQueuePage.last_page > 1 && (
                        <nav
                            className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3"
                            aria-label="Incoming handoff pages"
                        >
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={queuePending || queuePage <= 1}
                                onClick={() => changeQueuePage(queuePage - 1)}
                            >
                                Previous page
                            </Button>
                            <span className="text-xs text-ink-soft">
                                Page {currentQueuePage.current_page} of{' '}
                                {currentQueuePage.last_page} ·{' '}
                                {currentQueuePage.total} orders
                            </span>
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={
                                    queuePending ||
                                    queuePage >= currentQueuePage.last_page
                                }
                                onClick={() => changeQueuePage(queuePage + 1)}
                            >
                                Next page
                            </Button>
                        </nav>
                    )}
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                            Other work
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">
                            For jobs that did not come through Core 1, such as
                            phone-in or internal work.
                        </p>
                    </div>
                    {canCreateManual && (
                        <Button
                            id="create-direct-dispatch-trigger"
                            variant={
                                incomingTotalCount > 0 ? 'secondary' : 'primary'
                            }
                            onClick={() => {
                                setSelectedItemKey(null);
                                setMode('manual');
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Create direct dispatch
                        </Button>
                    )}
                </div>

                {canReconcile && (
                    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                Duplicate check
                            </p>
                            <p className="mt-1 text-sm text-ink-soft">
                                Make sure an order was not already dispatched by
                                hand before you convert it.
                            </p>
                        </div>
                        <button
                            type="button"
                            aria-pressed={mode === 'reconciliation'}
                            onClick={() => {
                                setSelectedItemKey(null);
                                setMode('reconciliation');
                            }}
                            className={cn(
                                'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-left text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2 focus-visible:outline-none',
                                mode === 'reconciliation'
                                    ? 'border-info-strong bg-info-soft text-info-strong shadow-xs'
                                    : 'border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                            )}
                        >
                            <span>Check for duplicates</span>
                            <span className="rounded-full bg-info px-2 py-0.5 text-[10px] font-bold text-white">
                                {unlinkedCount} to review
                            </span>
                        </button>
                    </div>
                )}

                {mode === 'client' && capabilities.create_client && (
                    <ClientIntakeForm onClose={closeWorkflow} />
                )}

                {mode === 'service' && canReviewService && (
                    <ServiceIntakeSection
                        clients={clients}
                        serviceRequests={visibleServiceRequests}
                        capabilities={capabilities}
                        initialRequestId={initialRequestId}
                        onClose={closeWorkflow}
                    />
                )}

                {mode === 'rental' && canReviewRental && (
                    <RentalIntakeSection
                        rentalHandoffs={visibleRentalHandoffs}
                        capabilities={capabilities}
                        focusedHandoffId={
                            selectedItemKey?.startsWith('rental-')
                                ? Number(selectedItemKey.slice(7))
                                : null
                        }
                        onShowAll={() => setSelectedItemKey(null)}
                        onClose={closeWorkflow}
                    />
                )}

                {mode === 'reconciliation' && canReconcile && (
                    <ReconciliationQueueSection
                        serviceRequests={visibleServiceRequests}
                        rentalHandoffs={visibleRentalHandoffs}
                        jobs={jobs}
                        onReviewSource={(source, id) => {
                            setSelectedItemKey(`${source}-${id}`);
                            setMode(source);
                        }}
                        onClose={closeWorkflow}
                    />
                )}
            </div>
        </section>
    );
}

function IncomingWorkRow({
    item,
    selected,
    onClick,
}: {
    item: IncomingWorkItem;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <div role="listitem">
            <button
                type="button"
                aria-pressed={selected}
                aria-label={`Review ${item.sourceLabel}: ${item.reference}`}
                onClick={onClick}
                className={cn(
                    'flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2 focus-visible:outline-none',
                    selected
                        ? 'bg-brand-soft/60'
                        : 'bg-surface hover:bg-surface-subtle',
                )}
            >
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                        <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                            {item.sourceLabel}
                        </span>
                        <span className="font-mono text-xs font-semibold text-brand-strong">
                            {item.reference}
                        </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                        <span className="font-medium text-ink">
                            {item.client}
                        </span>{' '}
                        · {item.detail}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                    {item.hasEvidence && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success-strong">
                            <CheckCircle2
                                className="size-3"
                                aria-hidden="true"
                            />
                            Evidence recorded
                        </span>
                    )}
                    <span className="rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink-soft">
                        {item.status}
                    </span>
                    <span className="text-xs font-semibold text-brand-strong">
                        {selected ? 'Opened' : 'Review'}
                    </span>
                </div>
            </button>
        </div>
    );
}

function ServiceIntakeSection({
    clients,
    serviceRequests,
    capabilities,
    initialRequestId,
    onClose,
}: {
    clients: ClientViewModel[];
    serviceRequests: ServiceRequestViewModel[];
    capabilities: WorkspaceCapabilities;
    initialRequestId?: number | null;
    onClose: () => void;
}) {
    const canCreateRequest = capabilities.create_service_request;
    const canConvertRequest = capabilities.convert_service_request;
    const [subTab, setSubTab] = useState<'create' | 'convert'>(() =>
        initialRequestId && canConvertRequest
            ? 'convert'
            : canCreateRequest
              ? 'create'
              : 'convert',
    );

    return (
        <Panel className="mt-4 p-4 md:p-6">
            <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong">
                            Service request
                        </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-ink">
                        Service requests
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                        Save the customer's request, then turn it into a draft
                        dispatch. Work done in stages can have more than one
                        dispatch from the same request.
                    </p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
                    <div className="flex max-w-full flex-wrap rounded-lg border border-line bg-surface p-1">
                        {canCreateRequest && (
                            <button
                                type="button"
                                aria-pressed={subTab === 'create'}
                                onClick={() => setSubTab('create')}
                                className={cn(
                                    'inline-flex min-h-11 items-center rounded-md px-3 py-1 text-xs font-medium transition-colors',
                                    subTab === 'create'
                                        ? 'bg-brand-soft font-semibold text-brand-strong'
                                        : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                )}
                            >
                                New service request
                            </button>
                        )}
                        {canConvertRequest && (
                            <button
                                type="button"
                                aria-pressed={subTab === 'convert'}
                                onClick={() => setSubTab('convert')}
                                className={cn(
                                    'inline-flex min-h-11 items-center rounded-md px-3 py-1 text-xs font-medium transition-colors',
                                    subTab === 'convert'
                                        ? 'bg-brand-soft font-semibold text-brand-strong'
                                        : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                )}
                            >
                                Create dispatch ({serviceRequests.length})
                            </button>
                        )}
                    </div>
                    <Button
                        size="icon"
                        variant="quiet"
                        onClick={onClose}
                        aria-label="Close service intake"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>
            </div>

            {subTab === 'create' && canCreateRequest ? (
                <ServiceRequestIntakeForm clients={clients} onClose={onClose} />
            ) : canConvertRequest ? (
                <DispatchConversion
                    serviceRequests={serviceRequests}
                    initialRequestId={initialRequestId}
                />
            ) : null}
        </Panel>
    );
}

export function ServiceRequestIntakeForm({
    clients,
    onClose,
    defaultReference = '',
    submitLabel = 'Save service request',
    compact = false,
    equipment,
}: {
    clients: ClientViewModel[];
    onClose: () => void;
    defaultReference?: string;
    submitLabel?: string;
    compact?: boolean;
    /** When given, the order names one fleet unit instead of free-text needs. */
    equipment?: AssetViewModel[];
}) {
    const [requirementsText, setRequirementsText] = useState('');
    const [equipmentId, setEquipmentId] = useState('');
    const [needsOperator, setNeedsOperator] = useState(true);
    const selectedEquipment =
        equipment?.find((asset) => String(asset.id) === equipmentId) ?? null;
    const form = useForm({
        reference: defaultReference,
        client_id: '',
        business_line: 'service',
        project_name: '',
        service_type: '',
        location: '',
        site_notes: '',
        scheduled_date: '',
        priority: 'routine',
        requirements: [] as string[],
    });

    const complete =
        [
            form.data.reference,
            form.data.client_id,
            form.data.project_name,
            form.data.service_type,
            form.data.location,
        ].every((value) => value.trim() !== '') &&
        (equipment === undefined || selectedEquipment !== null);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            requirements: selectedEquipment
                ? fleetRequirements(selectedEquipment, needsOperator)
                : linesFromText(requirementsText),
        }));
        form.post('/operations/service-requests', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setRequirementsText('');
                onClose();
            },
        });
    };

    return (
        <form
            className={cn(
                'mt-4 grid gap-4 md:grid-cols-2',
                !compact && 'xl:grid-cols-4',
            )}
            onSubmit={submit}
            noValidate
        >
            <IntakeInput
                id="request-reference"
                label="Request reference"
                value={form.data.reference}
                error={form.errors.reference}
                onChange={(value) => form.setData('reference', value)}
                placeholder="e.g. SR-2026-0089"
                required
            />
            <SelectField
                id="request-client"
                label="Client"
                value={form.data.client_id}
                error={form.errors.client_id}
                onChange={(value) => form.setData('client_id', value)}
                required
            >
                <option value="">Select an active client</option>
                {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                        {client.code} · {client.company_name}
                    </option>
                ))}
            </SelectField>
            <IntakeInput
                id="request-project"
                label="Project name"
                value={form.data.project_name}
                error={form.errors.project_name}
                onChange={(value) => form.setData('project_name', value)}
                placeholder="e.g. Tower B façade panel erection"
                required
            />
            <IntakeInput
                id="request-service-type"
                label="Service type"
                value={form.data.service_type}
                error={form.errors.service_type}
                onChange={(value) => form.setData('service_type', value)}
                placeholder="e.g. Mobile crane lift"
                required
            />
            <IntakeInput
                id="request-location"
                label="Site address"
                value={form.data.location}
                error={form.errors.location}
                onChange={(value) => form.setData('location', value)}
                placeholder="e.g. Roxas Blvd., Pasay City"
                required
            />
            <DateTimePicker
                id="request-schedule"
                label="Requested schedule"
                value={form.data.scheduled_date}
                error={form.errors.scheduled_date}
                onChange={(value) => form.setData('scheduled_date', value)}
            />
            <SelectField
                id="request-priority"
                label="Priority"
                value={form.data.priority}
                error={form.errors.priority}
                onChange={(value) => form.setData('priority', value)}
                required
            >
                <option value="routine">Routine</option>
                <option value="priority">Priority</option>
                <option value="emergency">Emergency</option>
            </SelectField>
            {!compact && <div className="hidden xl:block" aria-hidden="true" />}
            {equipment ? (
                <div className="grid gap-3 md:col-span-2">
                    <SelectField
                        id="request-equipment"
                        label="Equipment"
                        value={equipmentId}
                        error={form.errors.requirements}
                        onChange={setEquipmentId}
                        required
                    >
                        <option value="">Select a unit from our fleet</option>
                        {equipment.map((asset) => (
                            <option key={asset.id} value={asset.id}>
                                {asset.code} · {asset.name}
                            </option>
                        ))}
                    </SelectField>
                    <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                        <input
                            type="checkbox"
                            checked={needsOperator}
                            onChange={(event) =>
                                setNeedsOperator(event.target.checked)
                            }
                            className="h-4 w-4"
                        />
                        Include our operator for this unit
                    </label>
                </div>
            ) : (
                <TextAreaField
                    id="request-requirements"
                    label="Requirements"
                    hint="One per line, e.g. 25T mobile crane"
                    value={requirementsText}
                    error={form.errors.requirements}
                    onChange={setRequirementsText}
                    className="md:col-span-2"
                />
            )}
            <TextAreaField
                id="request-site-notes"
                label="Site notes"
                value={form.data.site_notes}
                error={form.errors.site_notes}
                onChange={(value) => form.setData('site_notes', value)}
                className="md:col-span-2"
            />
            <div
                className={cn(
                    'flex justify-end border-t border-line pt-4 md:col-span-2',
                    !compact && 'xl:col-span-4',
                )}
            >
                <Button
                    type="submit"
                    variant="primary"
                    disabled={form.processing || !complete}
                >
                    {form.processing ? 'Saving request…' : submitLabel}
                </Button>
            </div>
        </form>
    );
}

function DispatchConversion({
    serviceRequests,
    initialRequestId,
}: {
    serviceRequests: ServiceRequestViewModel[];
    initialRequestId?: number | null;
}) {
    const form = useForm({
        service_request_id: '',
        scheduled_start: '',
        scheduled_end: '',
    });
    const { setData } = form;

    const chooseRequest = (id: string) => {
        const request = serviceRequests.find(
            (candidate) => String(candidate.id) === id,
        );
        const start = toLocalDateTime(request?.scheduled_date ?? null);

        setData((prev) => ({
            ...prev,
            service_request_id: id,
            scheduled_start: start,
            scheduled_end: addHours(start, 4),
        }));
    };

    useEffect(() => {
        if (
            initialRequestId &&
            serviceRequests.some((r) => r.id === initialRequestId)
        ) {
            const request = serviceRequests.find(
                (candidate) => candidate.id === initialRequestId,
            );

            if (request) {
                const start = toLocalDateTime(request.scheduled_date ?? null);
                setData((prev) => ({
                    ...prev,
                    service_request_id: String(initialRequestId),
                    scheduled_start: start,
                    scheduled_end: addHours(start, 4),
                }));
            }
        }
    }, [initialRequestId, serviceRequests, setData]);

    const selectedRequest =
        serviceRequests.find(
            (r) => String(r.id) === form.data.service_request_id,
        ) ?? null;

    const complete = [
        form.data.service_request_id,
        form.data.scheduled_start,
        form.data.scheduled_end,
    ].every((value) => value.trim() !== '');

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/operations/dispatch-jobs', {
            preserveScroll: true,
        });
    };

    return (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
            <div className="rounded-lg border border-line bg-surface p-4">
                <div>
                    <h4 className="font-semibold text-ink">
                        Create a draft dispatch
                    </h4>
                    <p className="mt-1 text-sm text-ink-soft">
                        The request details are copied into the draft. Next,
                        assign the crane and crew on the dispatch page.
                    </p>
                </div>

                {selectedRequest ? (
                    <div className="mt-4 rounded-lg border border-line bg-surface-subtle p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-bold text-ink">
                                {selectedRequest.project_name}
                            </span>
                            <div className="flex gap-1.5">
                                <CanonicalStatusBadge
                                    status={selectedRequest.priority}
                                />
                                <CanonicalStatusBadge
                                    status={selectedRequest.status}
                                />
                            </div>
                        </div>
                        <dl className="mt-3 divide-y divide-line text-xs">
                            <DataPair
                                label="Client"
                                value={selectedRequest.client.company_name}
                            />
                            <DataPair
                                label="Service type"
                                value={selectedRequest.service_type}
                            />
                            <DataPair
                                label="Site location"
                                value={selectedRequest.location}
                            />
                            <DataPair
                                label="Dispatches already created"
                                value={String(
                                    selectedRequest.dispatch_jobs_count,
                                )}
                            />
                        </dl>
                        {selectedRequest.requirements.length > 0 && (
                            <div className="mt-3 border-t border-line pt-2">
                                <p className="text-[11px] font-semibold text-ink-soft uppercase">
                                    Requirements
                                </p>
                                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-soft">
                                    {selectedRequest.requirements.map(
                                        (r, i) => (
                                            <li key={i}>{r}</li>
                                        ),
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="mt-4 rounded-lg bg-surface-subtle p-3 text-xs text-ink-soft">
                        Choose a service request to see its details here.
                    </p>
                )}
            </div>

            {serviceRequests.length === 0 ? (
                <EmptyState
                    compact
                    icon={CalendarDays}
                    title="No requests waiting"
                    message="Save a service request first, then create its dispatch here."
                />
            ) : (
                <form
                    className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2"
                    onSubmit={submit}
                    noValidate
                >
                    <SelectField
                        id="conversion-request"
                        label="Service request"
                        value={form.data.service_request_id}
                        error={form.errors.service_request_id}
                        onChange={chooseRequest}
                        className="sm:col-span-2"
                        required
                    >
                        <option value="">Select a service request</option>
                        {serviceRequests.map((request) => (
                            <option key={request.id} value={request.id}>
                                {request.reference} ·{' '}
                                {request.client.company_name} ·{' '}
                                {request.project_name}
                            </option>
                        ))}
                    </SelectField>
                    <DateTimePicker
                        id="conversion-start"
                        label="Dispatch start"
                        value={form.data.scheduled_start}
                        error={form.errors.scheduled_start}
                        onChange={(value) =>
                            form.setData('scheduled_start', value)
                        }
                        required
                    />
                    <DateTimePicker
                        id="conversion-end"
                        label="Dispatch end"
                        value={form.data.scheduled_end}
                        error={form.errors.scheduled_end}
                        onChange={(value) =>
                            form.setData('scheduled_end', value)
                        }
                        required
                    />
                    <div className="flex justify-end border-t border-line pt-4 sm:col-span-2">
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={!complete || form.processing}
                        >
                            {form.processing
                                ? 'Creating draft…'
                                : 'Create draft dispatch'}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}

function RentalIntakeSection({
    rentalHandoffs,
    capabilities,
    focusedHandoffId,
    onShowAll,
    onClose,
}: {
    rentalHandoffs: RentalDispatchHandoffViewModel[];
    capabilities: WorkspaceCapabilities;
    focusedHandoffId: number | null;
    onShowAll: () => void;
    onClose: () => void;
}) {
    const focusedHandoff = rentalHandoffs.find(
        (handoff) => handoff.id === focusedHandoffId,
    );
    const visibleHandoffs =
        focusedHandoffId === null
            ? rentalHandoffs
            : focusedHandoff
              ? [focusedHandoff]
              : [];
    const [pendingHandoffId, setPendingHandoffId] = useState<number | null>(
        null,
    );

    const convertRental = (reservationId: number) => {
        setPendingHandoffId(reservationId);
        router.post(
            `/operations/rental-reservations/${reservationId}/dispatch`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setPendingHandoffId(null),
            },
        );
    };

    return (
        <Panel className="mt-4 p-4 md:p-6">
            <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-strong">
                            Rental
                        </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-ink">
                        Rentals waiting for delivery
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                        Reserved equipment that needs to be delivered. Creating
                        a dispatch copies the rental dates, equipment and
                        operator needs.
                    </p>
                </div>
                <Button
                    size="icon"
                    variant="quiet"
                    onClick={onClose}
                    aria-label="Close rental intake"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            {focusedHandoffId !== null && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-info-strong/30 bg-info-soft p-3 text-sm text-ink">
                    <span>
                        {focusedHandoff
                            ? `Showing rental ${focusedHandoff.reference}`
                            : 'This rental is no longer in the list. Refresh the page first.'}
                    </span>
                    <Button size="sm" variant="secondary" onClick={onShowAll}>
                        Show all rentals
                    </Button>
                </div>
            )}

            {visibleHandoffs.length === 0 ? (
                <EmptyState
                    compact
                    icon={CalendarDays}
                    title={
                        focusedHandoffId === null
                            ? 'No rentals waiting for delivery'
                            : 'This rental is unavailable'
                    }
                    message={
                        focusedHandoffId === null
                            ? 'Every rental that needs delivery already has a dispatch.'
                            : 'Refresh the page or show all rentals.'
                    }
                />
            ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {visibleHandoffs.map((handoff) => {
                        const isPending = pendingHandoffId === handoff.id;

                        return (
                            <div
                                key={handoff.id}
                                className="rounded-lg border border-line bg-surface p-4 transition-all hover:border-warning-strong/50"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-ink">
                                                {handoff.reference}
                                            </span>
                                            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning-strong">
                                                Rental delivery
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            {handoff.client.company_name}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {handoff.has_evidence && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success-strong">
                                                <CheckCircle2
                                                    className="size-3"
                                                    aria-hidden="true"
                                                />
                                                Evidence recorded
                                            </span>
                                        )}
                                        <span className="inline-flex items-center rounded-full bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink-soft">
                                            {handoff.status.label}
                                        </span>
                                    </div>
                                </div>

                                <dl className="mt-3 divide-y divide-line text-xs">
                                    <DataPair
                                        label="Rental period"
                                        value={`${handoff.start_date || 'TBD'} → ${handoff.end_date || 'TBD'}`}
                                    />
                                    <DataPair
                                        label="Delivery location"
                                        value={
                                            handoff.location ||
                                            'Site address pending'
                                        }
                                    />
                                    <DataPair
                                        label="Delivery type"
                                        value={humanize(
                                            handoff.fulfillment_mode,
                                        )}
                                    />
                                </dl>

                                <div className="mt-3 rounded-lg border border-line bg-surface-subtle p-2.5 text-xs">
                                    <p className="text-[10px] font-semibold text-ink-soft uppercase">
                                        Before release
                                    </p>
                                    <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-soft">
                                        <li>Pre-operation inspection passed</li>
                                        <li>
                                            Needs a dedicated crane operator
                                        </li>
                                    </ul>
                                </div>

                                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                                    <span className="text-xs text-ink-soft">
                                        {handoff.ready
                                            ? 'Ready for dispatch'
                                            : 'Reservation confirmed'}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() =>
                                            convertRental(handoff.id)
                                        }
                                        disabled={
                                            isPending ||
                                            !capabilities.create_rental_dispatch
                                        }
                                    >
                                        {isPending
                                            ? 'Converting…'
                                            : 'Create rental dispatch'}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Panel>
    );
}

function ReconciliationQueueSection({
    serviceRequests,
    rentalHandoffs,
    jobs,
    onReviewSource,
    onClose,
}: {
    serviceRequests: ServiceRequestViewModel[];
    rentalHandoffs: RentalDispatchHandoffViewModel[];
    jobs: DispatchJobViewModel[];
    onReviewSource: (source: 'rental', id: number) => void;
    onClose: () => void;
}) {
    const unlinkedItems: UnlinkedHandoffItem[] = useMemo(() => {
        const list: UnlinkedHandoffItem[] = [];

        for (const sr of serviceRequests) {
            if (sr.dispatch_jobs_count === 0) {
                const matchedJob = jobs.find(
                    (j) =>
                        (j.source === null ||
                            j.source.type === 'manual' ||
                            j.source.type === 'direct') &&
                        (j.client
                            .toLowerCase()
                            .includes(sr.client.company_name.toLowerCase()) ||
                            sr.client.company_name
                                .toLowerCase()
                                .includes(j.client.toLowerCase())),
                );

                list.push({
                    id: sr.id,
                    source_type: 'service',
                    source_label: 'Service Request',
                    reference: sr.reference,
                    client: sr.client,
                    title: sr.project_name,
                    location: sr.location,
                    scheduled_date: sr.scheduled_date,
                    requirements: sr.requirements,
                    dispatch_job_id: null,
                    matched_draft_job_id: matchedJob?.id ?? null,
                    matched_draft_reference: matchedJob?.reference ?? null,
                    match_reason: matchedJob
                        ? `Same client as manual draft ${matchedJob.reference}. Check the site and work before creating another dispatch.`
                        : null,
                    reconciliation_status: matchedJob
                        ? 'matching_draft_found'
                        : 'unlinked',
                });
            }
        }

        for (const rr of rentalHandoffs) {
            if (!rr.dispatch_job_id) {
                const matchedJob = jobs.find(
                    (j) =>
                        (j.source === null ||
                            j.source.type === 'manual' ||
                            j.source.type === 'direct') &&
                        (j.client
                            .toLowerCase()
                            .includes(rr.client.company_name.toLowerCase()) ||
                            rr.client.company_name
                                .toLowerCase()
                                .includes(j.client.toLowerCase())),
                );

                list.push({
                    id: rr.id,
                    source_type: 'rental',
                    source_label: 'Rental Reservation',
                    reference: rr.reference,
                    client: rr.client,
                    title: `Rental Delivery for ${rr.client.company_name}`,
                    location: rr.location,
                    start_date: rr.start_date,
                    end_date: rr.end_date,
                    fulfillment_mode: rr.fulfillment_mode,
                    dispatch_job_id: null,
                    matched_draft_job_id: matchedJob?.id ?? null,
                    matched_draft_reference: matchedJob?.reference ?? null,
                    match_reason: matchedJob
                        ? `Same client as manual draft ${matchedJob.reference}. Check the site and work before creating another dispatch.`
                        : null,
                    reconciliation_status: matchedJob
                        ? 'matching_draft_found'
                        : 'unlinked',
                });
            }
        }

        return list;
    }, [serviceRequests, rentalHandoffs, jobs]);

    return (
        <Panel className="mt-4 p-4 md:p-6">
            <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-info-strong">
                            Duplicate check
                        </span>
                        <span className="rounded bg-black/5 px-2 py-0.5 text-xs font-semibold text-ink">
                            {unlinkedItems.length} to check
                        </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-ink">
                        Check for duplicate dispatches
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                        Before converting a Core 1 order, make sure nobody
                        already created a dispatch for it by hand. Orders that
                        look like an existing draft are highlighted.
                    </p>
                </div>
                <Button
                    size="icon"
                    variant="quiet"
                    onClick={onClose}
                    aria-label="Close duplicate check"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            {unlinkedItems.length === 0 ? (
                <EmptyState
                    compact
                    icon={CheckCircle2}
                    title="Nothing to check"
                    message="Every incoming order already has a dispatch."
                />
            ) : (
                <div className="mt-4 space-y-3">
                    {unlinkedItems.map((item) => (
                        <div
                            key={`${item.source_type}-${item.id}`}
                            data-reconciliation-item="true"
                            className={cn(
                                'rounded-lg border p-4 transition-all',
                                item.matched_draft_job_id
                                    ? 'border-info-strong/40 bg-info-soft/30'
                                    : 'border-line bg-surface',
                            )}
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={cn(
                                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                                item.source_type ===
                                                    'service' &&
                                                    'bg-brand-soft text-brand-strong',
                                                item.source_type === 'rental' &&
                                                    'bg-warning-soft text-warning-strong',
                                            )}
                                        >
                                            {item.source_label}
                                        </span>
                                        <span className="text-sm font-bold text-ink">
                                            {item.reference}
                                        </span>
                                        <span className="text-xs text-ink-soft">
                                            · {item.client.company_name}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm font-medium text-ink">
                                        {item.title}
                                    </p>
                                    {item.location && (
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            Location: {item.location}
                                        </p>
                                    )}
                                </div>

                                {item.matched_draft_job_id ? (
                                    <div className="rounded-md border border-info-strong/30 bg-surface p-2.5 text-xs sm:max-w-xs">
                                        <div className="font-semibold text-info-strong">
                                            Possible matching draft
                                        </div>
                                        <p className="mt-1 text-ink-soft">
                                            Draft{' '}
                                            <strong className="text-ink">
                                                {item.matched_draft_reference}
                                            </strong>{' '}
                                            may be the same job as this order.
                                        </p>
                                    </div>
                                ) : (
                                    <span className="rounded bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-soft">
                                        No match found
                                    </span>
                                )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                                <span className="text-xs text-ink-soft">
                                    {item.match_reason ||
                                        'Ready to create a dispatch'}
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {item.matched_draft_job_id && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => {
                                                router.visit(
                                                    `/operations/dispatch-jobs/${item.matched_draft_job_id}`,
                                                );
                                            }}
                                        >
                                            Review draft{' '}
                                            {item.matched_draft_reference}
                                        </Button>
                                    )}
                                    {!item.matched_draft_job_id && (
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={() => {
                                                if (
                                                    item.source_type ===
                                                    'service'
                                                ) {
                                                    router.visit(
                                                        `/?view=dispatch&serviceRequestId=${item.id}`,
                                                    );
                                                } else if (
                                                    item.source_type ===
                                                    'rental'
                                                ) {
                                                    onReviewSource(
                                                        'rental',
                                                        item.id,
                                                    );
                                                }
                                            }}
                                        >
                                            Review and create dispatch
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
}

function ClientIntakeForm({ onClose }: { onClose: () => void }) {
    const form = useForm({
        code: '',
        company_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/operations/clients', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onClose();
            },
        });
    };

    return (
        <Panel id="client-intake-form" className="mt-4 p-4 md:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                    <h3 className="text-lg font-semibold text-ink">
                        New client
                    </h3>
                    <p className="mt-1 text-sm text-ink-soft">
                        Add a client so you can record their requests and
                        dispatches.
                    </p>
                </div>
                <Button
                    size="icon"
                    variant="quiet"
                    onClick={onClose}
                    aria-label="Close client form"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            <form
                className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                onSubmit={submit}
                noValidate
            >
                <IntakeInput
                    id="client-code"
                    label="Client code"
                    value={form.data.code}
                    error={form.errors.code}
                    onChange={(value) => form.setData('code', value)}
                    placeholder="e.g. C1-CL-0012"
                    required
                />
                <IntakeInput
                    id="client-company-name"
                    label="Company name"
                    value={form.data.company_name}
                    error={form.errors.company_name}
                    onChange={(value) => form.setData('company_name', value)}
                    placeholder="e.g. Bayview Towers Development Corp."
                    required
                />
                <IntakeInput
                    id="client-contact-person"
                    label="Contact person"
                    value={form.data.contact_person}
                    error={form.errors.contact_person}
                    onChange={(value) => form.setData('contact_person', value)}
                />
                <IntakeInput
                    id="client-phone"
                    label="Phone"
                    type="tel"
                    value={form.data.phone}
                    error={form.errors.phone}
                    onChange={(value) => form.setData('phone', value)}
                />
                <IntakeInput
                    id="client-email"
                    label="Email"
                    type="email"
                    value={form.data.email}
                    error={form.errors.email}
                    onChange={(value) => form.setData('email', value)}
                />
                <IntakeInput
                    id="client-address"
                    label="Billing / headquarters address"
                    value={form.data.address}
                    error={form.errors.address}
                    onChange={(value) => form.setData('address', value)}
                />
                <div className="flex justify-end border-t border-line pt-4 md:col-span-2 xl:col-span-3">
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={form.processing}
                    >
                        {form.processing ? 'Saving client…' : 'Save client'}
                    </Button>
                </div>
            </form>
        </Panel>
    );
}

function IntakeInput({
    id,
    label,
    value,
    error,
    onChange,
    className,
    required,
    ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    id: string;
    label: string;
    value: string;
    error?: string;
    onChange: (value: string) => void;
    required?: boolean;
}) {
    const errorId = `${id}-error`;

    return (
        <label className={cn('text-sm font-medium text-ink', className)}>
            {label}
            {required && <span className="ml-1 text-danger">*</span>}
            <input
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? errorId : undefined}
                className={cn(
                    'mt-1 h-11 w-full rounded-lg border bg-surface px-3 text-sm transition-colors focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/30 focus-visible:outline-none',
                    error
                        ? 'border-danger'
                        : 'border-line-strong hover:border-ink-soft',
                )}
                required={required}
                {...props}
            />
            <FieldError id={errorId} error={error} />
        </label>
    );
}

function SelectField({
    id,
    label,
    value,
    error,
    onChange,
    children,
    className,
    required,
}: {
    id: string;
    label: string;
    value: string;
    error?: string;
    onChange: (value: string) => void;
    children: ReactNode;
    className?: string;
    required?: boolean;
}) {
    const errorId = `${id}-error`;

    return (
        <label className={cn('text-sm font-medium text-ink', className)}>
            {label}
            {required && <span className="ml-1 text-danger">*</span>}
            <select
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? errorId : undefined}
                className={cn(
                    'mt-1 h-11 w-full rounded-lg border bg-surface px-3 text-sm transition-colors focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/30 focus-visible:outline-none',
                    error
                        ? 'border-danger'
                        : 'border-line-strong hover:border-ink-soft',
                )}
                required={required}
            >
                {children}
            </select>
            <FieldError id={errorId} error={error} />
        </label>
    );
}

function TextAreaField({
    id,
    label,
    value,
    error,
    onChange,
    hint,
    className,
}: {
    id: string;
    label: string;
    value: string;
    error?: string;
    onChange: (value: string) => void;
    hint?: string;
    className?: string;
}) {
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    return (
        <label className={cn('text-sm font-medium text-ink', className)}>
            {label}
            {hint && (
                <span
                    id={hintId}
                    className="ml-2 text-xs font-normal text-ink-soft"
                >
                    {hint}
                </span>
            )}
            <textarea
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={3}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={
                    [hint ? hintId : null, error ? errorId : null]
                        .filter(Boolean)
                        .join(' ') || undefined
                }
                className={cn(
                    'mt-1 w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm transition-colors focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/30 focus-visible:outline-none',
                    error
                        ? 'border-danger'
                        : 'border-line-strong hover:border-ink-soft',
                )}
            />
            <FieldError id={errorId} error={error} />
        </label>
    );
}

function FieldError({ id, error }: { id: string; error?: string }) {
    if (!error) {
        return null;
    }

    return (
        <span
            id={id}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="mt-1 block text-xs text-danger"
        >
            {error}
        </span>
    );
}

function fleetRequirements(
    asset: AssetViewModel,
    needsOperator: boolean,
): string[] {
    const unit = `${asset.code} · ${asset.name}`;

    if (!needsOperator) {
        return [unit];
    }

    return [unit, 'Operator'];
}

function linesFromText(value: string): string[] {
    return value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '');
}
