import { router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    Clock,
    Droplets,
    Fuel,
    Gauge,
    Plus,
    ReceiptText,
    Search,
    SearchX,
    Truck,
    User,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    FuelRequestStatsViewModel,
    FuelRequestViewModel,
    PaginationMeta,
    WorkspaceCapabilities,
} from '@/types/workspace';
import { CreateFuelRequestModal } from './create-fuel-request-modal';
import { FuelLogModal } from './fuel-log-modal';
import { FuelRecordsPanel } from './fuel-records-panel';
import { FuelRequestCard } from './fuel-request-card';
import type { FuelReviewDecision } from './fuel-request-card';
import { FuelVarianceBadge } from './fuel-variance-badge';

type FuelQueueSort = 'newest' | 'priority';

const urgencyRank = { critical: 0, urgent: 1, normal: 2 } as const;
const queueNextStep: Record<FuelRequestViewModel['status']['value'], string> = {
    submitted: 'Awaiting review',
    forwarded: 'Awaiting decision',
    approved: 'Awaiting verification',
    verified: 'Ready to refuel',
    logged: 'Fuel log unavailable',
    rejected: 'Request rejected',
    withdrawn: 'Request withdrawn',
};

function formatNeededBy(value: string): string {
    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

interface FuelSurfaceProps {
    requests: FuelRequestViewModel[];
    capabilities: WorkspaceCapabilities;
    assets?: AssetViewModel[];
    currentUserId?: number | null;
    total?: number;
    stats?: FuelRequestStatsViewModel;
    pagination?: PaginationMeta;
}

export function FuelSurface({
    requests,
    capabilities,
    assets = [],
    currentUserId,
    pagination,
}: FuelSurfaceProps) {
    const [section, setSection] = useState<'requests' | 'logs' | 'consumption'>(
        'requests',
    );
    const [pendingActionId, setPendingActionId] = useState<string | null>(null);
    const [logModalRequest, setLogModalRequest] =
        useState<FuelRequestViewModel | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<
        | 'all'
        | 'pending'
        | 'approved'
        | 'verified'
        | 'logged'
        | 'anomalies'
        | 'receipt_review'
    >('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortMode, setSortMode] = useState<FuelQueueSort>('newest');
    const [selectedRequestId, setSelectedRequestId] = useState<number | null>(
        null,
    );
    const [mobileDetailView, setMobileDetailView] = useState(false);
    const [returnSection, setReturnSection] = useState<
        'logs' | 'consumption' | null
    >(null);

    const handleTransition = (
        requestId: number,
        status: string,
        reason?: string,
    ) => {
        const actionId = `${requestId}:${status}`;
        router.post(
            `/operations/fuel-requests/${requestId}/status`,
            { status, reason },
            {
                preserveScroll: true,
                onStart: () => setPendingActionId(actionId),
                onFinish: () => setPendingActionId(null),
            },
        );
    };

    const handleReview = (
        requestId: number,
        decision: FuelReviewDecision,
        reason?: string,
    ) => {
        const actionId = `${requestId}:${decision}`;
        router.post(
            `/operations/fuel-requests/${requestId}/review`,
            { decision, reason },
            {
                preserveScroll: true,
                onStart: () => setPendingActionId(actionId),
                onFinish: () => setPendingActionId(null),
            },
        );
    };

    const handleWithdraw = (requestId: number, reason?: string) => {
        router.post(
            `/operations/fuel-requests/${requestId}/withdraw`,
            { reason },
            {
                preserveScroll: true,
                onStart: () => setPendingActionId(`${requestId}:withdrawn`),
                onFinish: () => setPendingActionId(null),
            },
        );
    };

    const handleReviewReceipt = (logId: number, note?: string) => {
        router.post(
            `/operations/fuel-logs/${logId}/receipt-review`,
            { note },
            {
                preserveScroll: true,
                onStart: () =>
                    setPendingActionId(`log:${logId}:receipt-review`),
                onFinish: () => setPendingActionId(null),
            },
        );
    };

    const kpis = useMemo(() => {
        let pending = 0;
        let approved = 0;
        let verified = 0;
        let logged = 0;
        let totalRequestedLitres = 0;
        let totalDispensedLitres = 0;
        let anomalies = 0;
        let receiptReview = 0;
        let evaluatedLogsCount = 0;

        for (const req of requests) {
            const v = req.status.value;
            const requestedLitres = Number(req.quantity_litres) || 0;
            totalRequestedLitres += requestedLitres;

            if (v === 'submitted' || v === 'forwarded') {
                pending += 1;
            } else if (v === 'approved') {
                approved += 1;
            } else if (v === 'verified') {
                verified += 1;
            } else if (v === 'logged') {
                logged += 1;
            }

            if (req.logs?.some((log) => log.requires_receipt_review)) {
                receiptReview += 1;
            }

            if (req.logs && req.logs.length > 0) {
                for (const log of req.logs) {
                    totalDispensedLitres += Number(log.quantity_litres) || 0;

                    if (log.is_anomaly) {
                        anomalies += 1;
                    }

                    if (
                        log.effective_burn_rate !== null &&
                        log.effective_burn_rate !== undefined
                    ) {
                        evaluatedLogsCount += 1;
                    }
                }
            }
        }

        return {
            total: requests.length,
            pending,
            approved,
            verified,
            logged,
            anomalies,
            receiptReview,
            evaluatedLogsCount,
            totalRequestedLitres,
            totalDispensedLitres,
        };
    }, [requests]);

    const filteredRequests = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        const matches = requests.filter((req) => {
            const v = req.status.value;
            const hasAnomaly = req.logs?.some((l) => l.is_anomaly);

            const matchesStatus =
                filterStatus === 'all'
                    ? true
                    : filterStatus === 'pending'
                      ? v === 'submitted' || v === 'forwarded'
                      : filterStatus === 'approved'
                        ? v === 'approved'
                        : filterStatus === 'verified'
                          ? v === 'verified'
                          : filterStatus === 'logged'
                            ? v === 'logged'
                            : filterStatus === 'anomalies'
                              ? hasAnomaly
                              : filterStatus === 'receipt_review'
                                ? Boolean(
                                      req.logs?.some(
                                          (l) => l.requires_receipt_review,
                                      ),
                                  )
                                : true;

            const matchesQuery =
                q === '' ||
                `${req.reference} ${req.requester.name} ${req.purpose} ${req.fuel_type} ${req.asset?.code ?? ''} ${req.asset?.name ?? ''} ${req.asset?.kind ?? ''} ${req.asset?.subtype ?? ''} ${req.asset?.registration_number ?? ''} ${req.job?.reference ?? ''}`
                    .toLowerCase()
                    .includes(q);

            return matchesStatus && matchesQuery;
        });

        if (sortMode === 'priority') {
            return matches.sort((a, b) => {
                const aRank = urgencyRank[a.urgency?.value ?? 'normal'];
                const bRank = urgencyRank[b.urgency?.value ?? 'normal'];

                return aRank - bRank;
            });
        }

        return matches;
    }, [requests, filterStatus, searchQuery, sortMode]);

    // Strict Filtered Selection Invariant:
    // Active request is strictly bound to visible filtered results.
    // When filters or search exclude the selected request, it falls back to filteredRequests[0] or null.
    const selectedRequest = useMemo(() => {
        if (filteredRequests.length === 0) {
            return null;
        }

        return (
            filteredRequests.find((r) => r.id === selectedRequestId) ??
            filteredRequests[0]
        );
    }, [filteredRequests, selectedRequestId]);

    const handleSelectRequest = (
        id: number,
        fromSection: 'logs' | 'consumption' | null = null,
    ) => {
        setSelectedRequestId(id);
        setMobileDetailView(true);
        setReturnSection(fromSection);
    };

    const handleBackFromRequest = () => {
        setMobileDetailView(false);

        if (returnSection) {
            setSection(returnSection);
            setReturnSection(null);
        }
    };

    const changeFuelPage = (page: number) => {
        router.get(
            '/operations',
            { section: 'fuel', fuel_page: page },
            { preserveState: true, preserveScroll: true },
        );
        setMobileDetailView(false);
    };

    const pageStart = pagination
        ? Math.max(
              1,
              Math.min(pagination.current_page - 2, pagination.last_page - 4),
          )
        : 1;
    const pageNumbers = pagination
        ? Array.from(
              { length: Math.min(5, pagination.last_page) },
              (_, index) => pageStart + index,
          )
        : [];

    return (
        <div>
            <PageHeading
                title="Fuel Management"
                description="Review fuel requests, record refueling, and inspect equipment consumption."
                actions={
                    capabilities.request_fuel ? (
                        <Button
                            variant="primary"
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            <Plus className="mr-1.5 h-4 w-4" />
                            New request
                        </Button>
                    ) : undefined
                }
            />

            <div className="space-y-4 p-4 md:p-6">
                <div
                    role="group"
                    aria-label="Fuel Management sections"
                    className="flex gap-4 overflow-x-auto border-b border-line"
                >
                    {(
                        [
                            {
                                value: 'requests',
                                label: 'Requests & Approvals',
                            },
                            { value: 'logs', label: 'Fuel Logs' },
                            { value: 'consumption', label: 'Consumption' },
                        ] as const
                    ).map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            aria-pressed={section === item.value}
                            onClick={() => {
                                setSection(item.value);
                                setReturnSection(null);
                                setMobileDetailView(false);
                            }}
                            className={cn(
                                'min-h-11 shrink-0 border-b-2 px-1 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
                                section === item.value
                                    ? 'border-brand-strong font-semibold text-ink'
                                    : 'border-transparent font-medium text-ink-soft hover:text-ink',
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <p className="text-xs leading-5 text-ink-soft tabular-nums">
                    Showing {requests.length} of{' '}
                    {pagination?.total ?? requests.length} requests
                    {pagination &&
                        ` · Page ${pagination.current_page} of ${pagination.last_page}`}
                    <span className="block">
                        Filters, search, sorting, log records, and consumption
                        summaries cover this page only.
                    </span>
                </p>
                {section !== 'requests' && (
                    <FuelRecordsPanel
                        requests={requests}
                        consumption={section === 'consumption'}
                        canReviewReceipt={capabilities.verify_fuel}
                        onOpenRequest={(id) => {
                            setFilterStatus('all');
                            setSearchQuery('');
                            handleSelectRequest(id, section);
                            setSection('requests');
                        }}
                    />
                )}
                {section === 'requests' && (
                    <>
                        {/* Compact Toolbar: Counted Stage Filters & Search */}
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            {/* Counted Filter Pills */}
                            <div
                                className="flex flex-wrap items-center gap-1.5"
                                role="group"
                                aria-label="Filter fuel requests by stage"
                            >
                                <button
                                    type="button"
                                    aria-pressed={filterStatus === 'all'}
                                    onClick={() => setFilterStatus('all')}
                                    className={cn(
                                        'inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
                                        filterStatus === 'all'
                                            ? 'bg-ink font-semibold text-canvas'
                                            : 'border border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    <span>All</span>{' '}
                                    <span className="ml-1 tabular-nums opacity-80">
                                        ({kpis.total})
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={filterStatus === 'pending'}
                                    onClick={() => setFilterStatus('pending')}
                                    className={cn(
                                        'inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
                                        filterStatus === 'pending'
                                            ? 'border border-warning/50 bg-warning-soft font-semibold text-warning-strong'
                                            : 'border border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    <span>Pending Review</span>{' '}
                                    <span className="ml-1 tabular-nums opacity-80">
                                        ({kpis.pending})
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={filterStatus === 'approved'}
                                    onClick={() => setFilterStatus('approved')}
                                    className={cn(
                                        'inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
                                        filterStatus === 'approved'
                                            ? 'border border-brand-strong/50 bg-brand-soft font-semibold text-brand-strong'
                                            : 'border border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    <span>Approved</span>{' '}
                                    <span className="ml-1 tabular-nums opacity-80">
                                        ({kpis.approved})
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={filterStatus === 'verified'}
                                    onClick={() => setFilterStatus('verified')}
                                    className={cn(
                                        'inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
                                        filterStatus === 'verified'
                                            ? 'border border-brand-strong/50 bg-brand-soft font-semibold text-brand-strong'
                                            : 'border border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    <span>Verified</span>{' '}
                                    <span className="ml-1 tabular-nums opacity-80">
                                        ({kpis.verified})
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={filterStatus === 'logged'}
                                    onClick={() => setFilterStatus('logged')}
                                    className={cn(
                                        'inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
                                        filterStatus === 'logged'
                                            ? 'border border-success/50 bg-success-soft font-semibold text-success-strong'
                                            : 'border border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    <span>Logged</span>{' '}
                                    <span className="ml-1 tabular-nums opacity-80">
                                        ({kpis.logged})
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={filterStatus === 'anomalies'}
                                    onClick={() => setFilterStatus('anomalies')}
                                    className={cn(
                                        'inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
                                        filterStatus === 'anomalies'
                                            ? 'border border-danger/50 bg-danger-soft font-semibold text-danger-strong'
                                            : kpis.anomalies > 0
                                              ? 'border border-danger/30 bg-danger-soft/60 text-danger-strong hover:bg-danger-soft'
                                              : 'border border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    <AlertTriangle className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                                    <span>Anomalies</span>{' '}
                                    <span className="ml-1 tabular-nums opacity-80">
                                        ({kpis.anomalies})
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={
                                        filterStatus === 'receipt_review'
                                    }
                                    onClick={() =>
                                        setFilterStatus('receipt_review')
                                    }
                                    className={cn(
                                        'inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
                                        filterStatus === 'receipt_review'
                                            ? 'border border-warning/50 bg-warning-soft font-semibold text-warning-strong'
                                            : kpis.receiptReview > 0
                                              ? 'border border-warning/30 bg-warning-soft/50 text-warning-strong hover:bg-warning-soft'
                                              : 'border border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    <ReceiptText className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                                    <span>Receipt review</span>{' '}
                                    <span className="ml-1 tabular-nums opacity-80">
                                        ({kpis.receiptReview})
                                    </span>
                                </button>
                            </div>

                            {/* Search Field */}
                            <label className="relative block sm:w-72">
                                <span className="sr-only">
                                    Search fuel requests on this page
                                </span>
                                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    placeholder="Search reference, asset, requester, purpose…"
                                    className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-xs text-ink transition-colors placeholder:text-ink-soft focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/30 focus-visible:outline-hidden"
                                />
                            </label>
                        </div>

                        {/* Truthful Accounting & Burn-Rate Anomaly Summary Strip */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-subtle px-4 py-2.5 text-xs">
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                                <div className="flex items-center gap-1.5">
                                    <Droplets className="h-3.5 w-3.5 text-brand-strong" />
                                    <span className="text-ink-soft">
                                        <span>Requested Litres</span>:
                                    </span>
                                    <span className="font-semibold text-ink tabular-nums">
                                        {kpis.totalRequestedLitres.toLocaleString()}
                                    </span>
                                    <span className="text-ink-soft">
                                        Litres
                                    </span>
                                </div>
                                <span className="hidden text-line sm:inline">
                                    ·
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <Fuel className="h-3.5 w-3.5 text-success" />
                                    <span className="text-ink-soft">
                                        Dispensed Logs:
                                    </span>
                                    <span className="font-semibold text-ink tabular-nums">
                                        {kpis.totalDispensedLitres.toLocaleString()}
                                    </span>
                                    <span className="text-ink-soft">
                                        Litres
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {kpis.anomalies > 0 ? (
                                    <span className="inline-flex items-center gap-1.5 font-semibold text-danger tabular-nums">
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                        {kpis.anomalies} burn-rate{' '}
                                        {kpis.anomalies === 1
                                            ? 'anomaly'
                                            : 'anomalies'}
                                    </span>
                                ) : kpis.evaluatedLogsCount > 0 ? (
                                    <span className="font-medium text-success-strong">
                                        All evaluated logs within baseline burn
                                        rate
                                    </span>
                                ) : (
                                    <span className="text-ink-soft">
                                        Not enough data to assess consumption
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Main Operate-Mode Content Area */}
                        {requests.length === 0 ? (
                            <Panel className="p-8 text-center sm:p-12">
                                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-subtle text-ink-soft">
                                    <Fuel className="h-5 w-5 text-ink-soft" />
                                </div>
                                <h3 className="mt-3 text-sm font-semibold text-ink">
                                    No fuel requests yet
                                </h3>
                                <p className="mx-auto mt-1 max-w-md text-xs text-ink-soft">
                                    Submit a fuel request to begin approval.
                                    Once verified, record the actual fuel
                                    received and its supporting receipt.
                                </p>
                                {capabilities.request_fuel && (
                                    <div className="mt-4">
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() =>
                                                setIsCreateModalOpen(true)
                                            }
                                        >
                                            <Plus className="mr-1.5 h-4 w-4" />
                                            Submit First Fuel Request
                                        </Button>
                                    </div>
                                )}
                            </Panel>
                        ) : filteredRequests.length === 0 ? (
                            <Panel className="p-8 text-center">
                                <EmptyState
                                    compact
                                    icon={SearchX}
                                    title="No matching fuel requests"
                                    message="Try adjusting your search or filter on this page, or move to another page."
                                    primaryAction={
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => {
                                                setSearchQuery('');
                                                setFilterStatus('all');
                                            }}
                                        >
                                            Clear filters
                                        </Button>
                                    }
                                />
                            </Panel>
                        ) : (
                            /* 2-Column Responsive Operate-Mode Queue & Detail Hierarchy */
                            <div className="grid gap-6 lg:grid-cols-12">
                                {/* Queue Panel (Left Column: 5 Cols on Desktop) */}
                                <div
                                    className={cn(
                                        'lg:col-span-5',
                                        mobileDetailView
                                            ? 'hidden lg:block'
                                            : 'block',
                                    )}
                                >
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                                        <div>
                                            <h2 className="text-base font-semibold text-ink">
                                                Fuel requests (
                                                {filteredRequests.length})
                                            </h2>
                                            <p className="text-xs text-ink-soft">
                                                Matching requests on this page
                                            </p>
                                        </div>
                                        <label className="flex items-center gap-2 text-xs text-ink-soft">
                                            <span>Sort page</span>
                                            <select
                                                aria-label="Sort requests on this page"
                                                value={sortMode}
                                                onChange={(event) =>
                                                    setSortMode(
                                                        event.target
                                                            .value as FuelQueueSort,
                                                    )
                                                }
                                                className="min-h-9 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                                            >
                                                <option value="newest">
                                                    Newest first
                                                </option>
                                                <option value="priority">
                                                    Priority (high to low)
                                                </option>
                                            </select>
                                        </label>
                                    </div>

                                    <ul
                                        className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface"
                                        role="list"
                                        aria-label="Fuel request queue"
                                    >
                                        {filteredRequests.map((req) => {
                                            const isSelected =
                                                selectedRequest?.id === req.id;
                                            const primaryLog =
                                                req.logs && req.logs.length > 0
                                                    ? req.logs[0]
                                                    : null;
                                            const hasAnomaly = req.logs?.some(
                                                (l) => l.is_anomaly,
                                            );

                                            return (
                                                <li key={req.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleSelectRequest(
                                                                req.id,
                                                            )
                                                        }
                                                        className={cn(
                                                            'min-h-16 w-full p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden focus-visible:ring-inset',
                                                            isSelected
                                                                ? 'bg-brand-soft/30 ring-1 ring-brand-strong ring-inset'
                                                                : hasAnomaly
                                                                  ? 'bg-danger-soft/10 hover:bg-danger-soft/20'
                                                                  : 'bg-surface hover:bg-surface-subtle',
                                                        )}
                                                    >
                                                        {/* Top Row: Reference, Badges */}
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-xs font-semibold text-ink tabular-nums">
                                                                    {
                                                                        req.reference
                                                                    }
                                                                </span>
                                                                <CanonicalStatusBadge
                                                                    status={
                                                                        req.status
                                                                    }
                                                                />
                                                                {req.urgency &&
                                                                    req.urgency
                                                                        .value !==
                                                                        'normal' && (
                                                                        <span
                                                                            className={cn(
                                                                                'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                                                                                req
                                                                                    .urgency
                                                                                    .value ===
                                                                                    'critical'
                                                                                    ? 'border-danger/50 bg-danger-soft text-danger-strong'
                                                                                    : 'border-warning/50 bg-warning-soft text-warning-strong',
                                                                            )}
                                                                        >
                                                                            {
                                                                                req
                                                                                    .urgency
                                                                                    .value
                                                                            }
                                                                        </span>
                                                                    )}
                                                            </div>

                                                            {primaryLog && (
                                                                <FuelVarianceBadge
                                                                    variancePercentage={
                                                                        primaryLog.variance_percentage
                                                                    }
                                                                    varianceLitres={
                                                                        primaryLog.variance_litres
                                                                    }
                                                                    isAnomaly={
                                                                        primaryLog.is_anomaly
                                                                    }
                                                                    compact
                                                                />
                                                            )}
                                                        </div>

                                                        {/* Asset, job, and requester context */}
                                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                            <div className="flex items-center gap-1 font-medium text-ink">
                                                                <Truck className="h-3 w-3 text-brand-strong" />
                                                                <span>
                                                                    {req.asset
                                                                        ? req
                                                                              .asset
                                                                              .name
                                                                            ? `${req.asset.code} · ${req.asset.name}`
                                                                            : req
                                                                                  .asset
                                                                                  .code
                                                                        : 'No asset linked'}
                                                                </span>
                                                            </div>
                                                            {req.job && (
                                                                <span className="text-ink-soft">
                                                                    Job{' '}
                                                                    {
                                                                        req.job
                                                                            .reference
                                                                    }
                                                                </span>
                                                            )}
                                                            <div className="flex items-center gap-1 text-ink-soft">
                                                                <User className="h-3 w-3 text-ink-soft" />
                                                                <span>
                                                                    {
                                                                        req
                                                                            .requester
                                                                            .name
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Requested quantity and decision context */}
                                                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line/50 pt-2 text-xs">
                                                            <span className="text-ink-soft">
                                                                Requested:{' '}
                                                                <strong className="font-mono font-semibold text-ink tabular-nums">
                                                                    {
                                                                        req.quantity_litres
                                                                    }{' '}
                                                                    L
                                                                </strong>{' '}
                                                                (
                                                                {humanize(
                                                                    req.fuel_type,
                                                                )}
                                                                )
                                                            </span>

                                                            {primaryLog ? (
                                                                <span className="font-medium text-success-strong tabular-nums">
                                                                    Dispensed:{' '}
                                                                    {
                                                                        primaryLog.quantity_litres
                                                                    }{' '}
                                                                    L
                                                                </span>
                                                            ) : (
                                                                <span className="text-ink-soft">
                                                                    {
                                                                        queueNextStep[
                                                                            req
                                                                                .status
                                                                                .value
                                                                        ]
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
                                                        {(req.needed_by ||
                                                            (req.current_fuel_level_percent !==
                                                                null &&
                                                                req.current_fuel_level_percent !==
                                                                    undefined) ||
                                                            req.logs?.some(
                                                                (log) =>
                                                                    log.requires_receipt_review,
                                                            )) && (
                                                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
                                                                {req.needed_by && (
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <Clock className="h-3.5 w-3.5" />
                                                                        Needed
                                                                        by{' '}
                                                                        {formatNeededBy(
                                                                            req.needed_by,
                                                                        )}
                                                                    </span>
                                                                )}
                                                                {req.current_fuel_level_percent !==
                                                                    null &&
                                                                    req.current_fuel_level_percent !==
                                                                        undefined && (
                                                                        <span className="inline-flex items-center gap-1 tabular-nums">
                                                                            <Gauge className="h-3.5 w-3.5" />
                                                                            Tank{' '}
                                                                            {
                                                                                req.current_fuel_level_percent
                                                                            }
                                                                            %
                                                                        </span>
                                                                    )}
                                                                {req.logs?.some(
                                                                    (log) =>
                                                                        log.requires_receipt_review,
                                                                ) && (
                                                                    <span className="inline-flex items-center gap-1 font-medium text-warning-strong">
                                                                        <ReceiptText className="h-3.5 w-3.5" />
                                                                        Receipt
                                                                        review
                                                                        needed
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>

                                {/* Detail Panel (Right Column: 7 Cols on Desktop) */}
                                <div
                                    className={cn(
                                        'lg:col-span-7',
                                        !mobileDetailView
                                            ? 'hidden lg:block'
                                            : 'block',
                                    )}
                                >
                                    {/* Return to the list that opened this request. */}
                                    {(mobileDetailView || returnSection) && (
                                        <div
                                            className={cn(
                                                'mb-3',
                                                !returnSection && 'lg:hidden',
                                            )}
                                        >
                                            <Button
                                                variant="quiet"
                                                size="sm"
                                                onClick={handleBackFromRequest}
                                                className="min-h-[44px]"
                                            >
                                                <ArrowLeft className="mr-1.5 h-4 w-4" />
                                                {returnSection === 'logs'
                                                    ? 'Back to Fuel Logs'
                                                    : returnSection ===
                                                        'consumption'
                                                      ? 'Back to Consumption'
                                                      : 'Back to fuel queue'}
                                            </Button>
                                        </div>
                                    )}

                                    {selectedRequest ? (
                                        <ul className="list-none p-0">
                                            <FuelRequestCard
                                                key={selectedRequest.id}
                                                request={selectedRequest}
                                                capabilities={capabilities}
                                                onRecordLog={(r) =>
                                                    setLogModalRequest(r)
                                                }
                                                onTransition={handleTransition}
                                                onReview={handleReview}
                                                onWithdraw={handleWithdraw}
                                                onReviewReceipt={
                                                    handleReviewReceipt
                                                }
                                                pendingActionId={
                                                    pendingActionId
                                                }
                                                currentUserId={currentUserId}
                                                isDetail={true}
                                                isSelected={true}
                                            />
                                        </ul>
                                    ) : (
                                        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-line bg-surface-subtle p-8 text-center text-xs text-ink-soft">
                                            Select a fuel request from the queue
                                            to view audit facts and take action.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
                {pagination && pagination.last_page > 1 && (
                    <nav
                        aria-label="Fuel request pages"
                        className="flex flex-wrap items-center justify-between gap-3"
                    >
                        <Button
                            variant="secondary"
                            disabled={pagination.current_page <= 1}
                            onClick={() =>
                                changeFuelPage(pagination.current_page - 1)
                            }
                        >
                            Previous page
                        </Button>
                        <span className="text-xs text-ink-soft tabular-nums sm:hidden">
                            Page {pagination.current_page} of{' '}
                            {pagination.last_page}
                        </span>
                        <div
                            className="hidden items-center gap-1 sm:flex"
                            aria-label="Page numbers"
                        >
                            {pageNumbers.map((page) => (
                                <button
                                    key={page}
                                    type="button"
                                    aria-label={`Page ${page}`}
                                    aria-current={
                                        page === pagination.current_page
                                            ? 'page'
                                            : undefined
                                    }
                                    onClick={() => changeFuelPage(page)}
                                    className={cn(
                                        'min-h-9 min-w-9 rounded-lg border px-2 text-xs font-semibold tabular-nums focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
                                        page === pagination.current_page
                                            ? 'border-brand-strong bg-brand-soft text-ink'
                                            : 'border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                        <Button
                            variant="secondary"
                            disabled={
                                pagination.current_page >= pagination.last_page
                            }
                            onClick={() =>
                                changeFuelPage(pagination.current_page + 1)
                            }
                        >
                            Next page
                        </Button>
                    </nav>
                )}
            </div>

            {/* Focused On-Demand Refuel Request Modal */}
            <CreateFuelRequestModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                assets={assets}
            />

            {/* Modal for recording fuel log with monotonic validation and receipt upload */}
            <FuelLogModal
                isOpen={logModalRequest !== null}
                onClose={() => setLogModalRequest(null)}
                request={logModalRequest}
            />
        </div>
    );
}
