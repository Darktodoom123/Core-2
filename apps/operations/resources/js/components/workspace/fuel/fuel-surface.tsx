import { router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    Droplets,
    Fuel,
    Plus,
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
import { FuelVarianceBadge } from './fuel-variance-badge';

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
        'all' | 'pending' | 'approved' | 'verified' | 'logged' | 'anomalies'
    >('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRequestId, setSelectedRequestId] = useState<number | null>(
        null,
    );
    const [mobileDetailView, setMobileDetailView] = useState(false);

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

    const kpis = useMemo(() => {
        let pending = 0;
        let approved = 0;
        let verified = 0;
        let logged = 0;
        let totalRequestedLitres = 0;
        let totalDispensedLitres = 0;
        let anomalies = 0;
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
            evaluatedLogsCount,
            totalRequestedLitres,
            totalDispensedLitres,
        };
    }, [requests]);

    const filteredRequests = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        return requests.filter((req) => {
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
                              : true;

            const matchesQuery =
                q === '' ||
                `${req.reference} ${req.requester.name} ${req.purpose} ${req.fuel_type} ${req.asset?.code ?? ''} ${req.asset?.name ?? ''} ${req.asset?.kind ?? ''} ${req.asset?.subtype ?? ''} ${req.asset?.registration_number ?? ''} ${req.job?.reference ?? ''}`
                    .toLowerCase()
                    .includes(q);

            return matchesStatus && matchesQuery;
        });
    }, [requests, filterStatus, searchQuery]);

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

    const handleSelectRequest = (id: number) => {
        setSelectedRequestId(id);
        setMobileDetailView(true);
    };

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
                    className="flex flex-wrap gap-2 border-b border-line pb-3"
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
                        <Button
                            key={item.value}
                            variant={
                                section === item.value ? 'primary' : 'quiet'
                            }
                            aria-pressed={section === item.value}
                            onClick={() => setSection(item.value)}
                        >
                            {item.label}
                        </Button>
                    ))}
                </div>
                <p className="text-xs text-ink-soft tabular-nums">
                    Showing {requests.length} requests
                    {pagination
                        ? ` of ${pagination.total} · Page ${pagination.current_page} of ${pagination.last_page}`
                        : ''}
                    . Filters, log records, and consumption summaries cover this
                    page only.
                </p>
                {section !== 'requests' && (
                    <FuelRecordsPanel
                        requests={requests}
                        consumption={section === 'consumption'}
                        onOpenRequest={(id) => {
                            setFilterStatus('all');
                            setSearchQuery('');
                            handleSelectRequest(id);
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
                                        'inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
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
                                        'inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
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
                                        'inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
                                        filterStatus === 'approved'
                                            ? 'border border-brand/50 bg-brand-soft font-semibold text-brand-strong'
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
                                        'inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
                                        filterStatus === 'verified'
                                            ? 'border border-brand/50 bg-brand-soft font-semibold text-brand-strong'
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
                                        'inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
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
                                        'inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
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
                            </div>

                            {/* Search Field */}
                            <label className="relative block sm:w-72">
                                <span className="sr-only">
                                    Search fuel requests
                                </span>
                                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    placeholder="Search reference, asset, requester, purpose…"
                                    className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-xs text-ink transition-colors placeholder:text-ink-soft focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-hidden"
                                />
                            </label>
                        </div>

                        {/* Truthful Accounting & Burn-Rate Anomaly Summary Strip */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-subtle px-4 py-2.5 text-xs">
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                                <div className="flex items-center gap-1.5">
                                    <Droplets className="h-3.5 w-3.5 text-brand" />
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
                                    message="Try adjusting your search query or status filter."
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
                                    <div className="mb-2 flex items-center justify-between px-1">
                                        <span className="text-xs font-semibold text-ink">
                                            Fuel Queue (
                                            <span className="tabular-nums">
                                                {filteredRequests.length}
                                            </span>
                                            )
                                        </span>
                                        {filterStatus !== 'all' && (
                                            <span className="text-xs font-medium text-brand capitalize">
                                                {filterStatus}
                                            </span>
                                        )}
                                    </div>

                                    <ul
                                        className="space-y-2"
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
                                                            'w-full rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden focus-visible:ring-inset',
                                                            isSelected
                                                                ? 'border-brand-strong bg-brand-soft/25 ring-1 ring-brand-strong'
                                                                : hasAnomaly
                                                                  ? 'border-danger/30 bg-danger-soft/10 hover:border-danger/60'
                                                                  : 'border-line bg-surface hover:border-line-strong hover:bg-surface-subtle',
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

                                                        {/* Middle: Asset & Requester */}
                                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                            <div className="flex items-center gap-1 font-medium text-ink">
                                                                <Truck className="h-3 w-3 text-brand" />
                                                                <span>
                                                                    {req.asset
                                                                        ? req
                                                                              .asset
                                                                              .name ||
                                                                          req
                                                                              .asset
                                                                              .code
                                                                        : 'No asset linked'}
                                                                </span>
                                                            </div>
                                                            <span className="text-ink-soft">
                                                                ·
                                                            </span>
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

                                                        {/* Bottom Row: Quantities Truth */}
                                                        <div className="mt-2.5 flex items-center justify-between border-t border-line/50 pt-2 text-[11px]">
                                                            <span className="text-ink-soft">
                                                                Req:{' '}
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
                                                            ) : req.status
                                                                  .value ===
                                                              'rejected' ? (
                                                                <span className="font-medium text-danger">
                                                                    Request
                                                                    rejected
                                                                </span>
                                                            ) : (
                                                                <span className="text-ink-soft">
                                                                    Awaiting
                                                                    pump log
                                                                </span>
                                                            )}
                                                        </div>
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
                                    {/* Mobile "Back to queue" button */}
                                    <div className="mb-3 lg:hidden">
                                        <Button
                                            variant="quiet"
                                            size="sm"
                                            onClick={() =>
                                                setMobileDetailView(false)
                                            }
                                            className="min-h-[44px]"
                                        >
                                            <ArrowLeft className="mr-1.5 h-4 w-4" />
                                            Back to fuel queue
                                        </Button>
                                    </div>

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
                        className="flex items-center justify-between gap-3"
                    >
                        <Button
                            variant="secondary"
                            disabled={pagination.current_page <= 1}
                            onClick={() =>
                                router.get(
                                    '/operations',
                                    {
                                        section: 'fuel',
                                        fuel_page: pagination.current_page - 1,
                                    },
                                    {
                                        preserveState: true,
                                        preserveScroll: true,
                                    },
                                )
                            }
                        >
                            Previous page
                        </Button>
                        <span className="text-xs text-ink-soft tabular-nums">
                            Page {pagination.current_page} of{' '}
                            {pagination.last_page}
                        </span>
                        <Button
                            variant="secondary"
                            disabled={
                                pagination.current_page >= pagination.last_page
                            }
                            onClick={() =>
                                router.get(
                                    '/operations',
                                    {
                                        section: 'fuel',
                                        fuel_page: pagination.current_page + 1,
                                    },
                                    {
                                        preserveState: true,
                                        preserveScroll: true,
                                    },
                                )
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
