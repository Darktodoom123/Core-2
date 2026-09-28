import { router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    Clock,
    Droplets,
    Fuel,
    Gauge,
    Info,
    Plus,
    ReceiptText,
    Search,
    SearchX,
    Smartphone,
    Truck,
    User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
type FuelQueueFilter =
    | 'all'
    | 'pending'
    | 'approved'
    | 'verified'
    | 'logged'
    | 'anomalies'
    | 'receipt_review';
type FilterTone = 'ink' | 'warning' | 'brand' | 'success' | 'danger';

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

const activeFilterClasses: Record<FilterTone, string> = {
    ink: 'border-ink bg-ink text-canvas',
    warning: 'border-warning/50 bg-warning-soft text-warning-strong',
    brand: 'border-brand-strong/50 bg-brand-soft text-brand-strong',
    success: 'border-success/50 bg-success-soft text-success-strong',
    danger: 'border-danger/50 bg-danger-soft text-danger-strong',
};

// Exception filters stay tinted while they hold items so they read as alerts.
const alertFilterClasses: Partial<Record<FilterTone, string>> = {
    warning:
        'border-warning/30 bg-warning-soft/50 text-warning-strong hover:bg-warning-soft',
    danger: 'border-danger/30 bg-danger-soft/60 text-danger-strong hover:bg-danger-soft',
};

function formatNeededBy(value: string): string {
    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function FilterPill({
    label,
    count,
    tone,
    active,
    alert = false,
    icon: Icon,
    onClick,
}: {
    label: string;
    count: number;
    tone: FilterTone;
    active: boolean;
    alert?: boolean;
    icon?: LucideIcon;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            aria-label={`${label} (${count})`}
            onClick={onClick}
            className={cn(
                'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
                active
                    ? cn('font-semibold', activeFilterClasses[tone])
                    : alert && count > 0 && alertFilterClasses[tone]
                      ? alertFilterClasses[tone]
                      : 'border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
            )}
        >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            <span>{label}</span>
            <span
                className={cn(
                    'min-w-5 rounded-md px-1 text-center text-[11px] font-semibold tabular-nums',
                    active ? 'bg-canvas/20' : 'bg-surface-subtle text-ink-soft',
                )}
            >
                {count}
            </span>
        </button>
    );
}

function FuelQueueRow({
    request,
    selected,
    onSelect,
}: {
    request: FuelRequestViewModel;
    selected: boolean;
    onSelect: () => void;
}) {
    const primaryLog = request.logs?.[0] ?? null;
    const hasAnomaly = request.logs?.some((log) => log.is_anomaly);
    const needsReceiptReview = request.logs?.some(
        (log) => log.requires_receipt_review,
    );
    const urgency = request.urgency?.value ?? 'normal';
    const hasTankLevel =
        request.current_fuel_level_percent !== null &&
        request.current_fuel_level_percent !== undefined;
    const isOpen = !['logged', 'rejected', 'withdrawn'].includes(
        request.status.value,
    );

    return (
        <li>
            <button
                type="button"
                onClick={onSelect}
                aria-current={selected ? 'true' : undefined}
                className={cn(
                    'relative w-full py-3 pr-3 pl-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden focus-visible:ring-inset',
                    selected
                        ? 'bg-brand-soft/40'
                        : hasAnomaly
                          ? 'bg-danger-soft/10 hover:bg-danger-soft/20'
                          : 'bg-surface hover:bg-surface-subtle',
                )}
            >
                {/* Left rail: selection wins, otherwise urgency for open requests. */}
                <span
                    aria-hidden="true"
                    className={cn(
                        'absolute inset-y-0 left-0 w-1',
                        selected
                            ? 'bg-brand-strong'
                            : isOpen && urgency === 'critical'
                              ? 'bg-danger'
                              : isOpen && urgency === 'urgent'
                                ? 'bg-warning'
                                : 'bg-transparent',
                    )}
                />

                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-ink-soft tabular-nums">
                            {request.reference}
                        </span>
                        {urgency !== 'normal' && (
                            <span
                                className={cn(
                                    'rounded-md border px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase',
                                    urgency === 'critical'
                                        ? 'border-danger/50 bg-danger-soft text-danger-strong'
                                        : 'border-warning/50 bg-warning-soft text-warning-strong',
                                )}
                            >
                                {urgency}
                            </span>
                        )}
                        {request.submitted_via === 'field_app' && (
                            <span
                                className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-subtle px-1.5 py-px text-[10px] font-medium text-ink-soft"
                                title="Submitted from the field app"
                            >
                                <Smartphone
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                />
                                Field app
                            </span>
                        )}
                    </div>
                    <CanonicalStatusBadge status={request.status} size="sm" />
                </div>

                <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink">
                    <Truck
                        className="h-3.5 w-3.5 shrink-0 text-brand-strong"
                        aria-hidden="true"
                    />
                    <span className="truncate">
                        {request.asset
                            ? request.asset.name
                                ? `${request.asset.code} · ${request.asset.name}`
                                : request.asset.code
                            : 'No asset linked'}
                    </span>
                </p>

                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
                    <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" aria-hidden="true" />
                        {request.requester.name}
                    </span>
                    {request.job && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>Job {request.job.reference}</span>
                        </>
                    )}
                </p>

                <div className="mt-2.5 flex items-end justify-between gap-3">
                    <p className="text-ink">
                        <span className="text-base font-semibold tabular-nums">
                            {request.quantity_litres} L
                        </span>{' '}
                        <span className="text-xs text-ink-soft">
                            {humanize(request.fuel_type)} requested
                        </span>
                    </p>
                    {primaryLog ? (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-xs font-semibold text-success-strong tabular-nums">
                                Dispensed {primaryLog.quantity_litres} L
                            </span>
                            <FuelVarianceBadge
                                variancePercentage={
                                    primaryLog.variance_percentage
                                }
                                varianceLitres={primaryLog.variance_litres}
                                isAnomaly={primaryLog.is_anomaly}
                                compact
                            />
                        </div>
                    ) : (
                        <span
                            className={cn(
                                'shrink-0 text-xs',
                                request.status.value === 'verified'
                                    ? 'font-semibold text-success-strong'
                                    : 'text-ink-soft',
                            )}
                        >
                            {queueNextStep[request.status.value]}
                        </span>
                    )}
                </div>

                {((request.needed_by && isOpen) ||
                    hasTankLevel ||
                    needsReceiptReview) && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-ink-soft">
                        {request.needed_by && isOpen && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-surface-subtle px-1.5 py-0.5 tabular-nums">
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                Needed by {formatNeededBy(request.needed_by)}
                            </span>
                        )}
                        {hasTankLevel && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-surface-subtle px-1.5 py-0.5 tabular-nums">
                                <Gauge className="h-3 w-3" aria-hidden="true" />
                                Tank {request.current_fuel_level_percent}%
                            </span>
                        )}
                        {needsReceiptReview && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 font-medium text-warning-strong">
                                <ReceiptText
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                />
                                Receipt review needed
                            </span>
                        )}
                    </div>
                )}
            </button>
        </li>
    );
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
    const [filterStatus, setFilterStatus] = useState<FuelQueueFilter>('all');
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

    const filters: {
        value: FuelQueueFilter;
        label: string;
        count: number;
        tone: FilterTone;
        alert?: boolean;
        icon?: LucideIcon;
    }[] = [
        { value: 'all', label: 'All', count: kpis.total, tone: 'ink' },
        {
            value: 'pending',
            label: 'Pending Review',
            count: kpis.pending,
            tone: 'warning',
        },
        {
            value: 'approved',
            label: 'Approved',
            count: kpis.approved,
            tone: 'brand',
        },
        {
            value: 'verified',
            label: 'Verified',
            count: kpis.verified,
            tone: 'brand',
        },
        {
            value: 'logged',
            label: 'Logged',
            count: kpis.logged,
            tone: 'success',
        },
        {
            value: 'anomalies',
            label: 'Anomalies',
            count: kpis.anomalies,
            tone: 'danger',
            alert: true,
            icon: AlertTriangle,
        },
        {
            value: 'receipt_review',
            label: 'Receipt review',
            count: kpis.receiptReview,
            tone: 'warning',
            alert: true,
            icon: ReceiptText,
        },
    ];

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
                    role="region"
                    aria-label="Fuel Management section tabs"
                    tabIndex={0}
                    className="workspace-scroll-region border-b border-line"
                >
                    <div
                        role="group"
                        aria-label="Fuel Management sections"
                        className="flex w-max gap-5"
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
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="flex items-start gap-1.5 text-xs leading-5 text-ink-soft tabular-nums">
                        <Info
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        <span>
                            Showing {requests.length} of{' '}
                            {pagination?.total ?? requests.length} requests
                            {pagination &&
                                ` · Page ${pagination.current_page} of ${pagination.last_page}`}
                            {' · '}
                            <span>
                                Filters, search, sorting, log records, and
                                consumption summaries cover this page only.
                            </span>
                        </span>
                    </p>
                    {section === 'requests' && (
                        <label className="relative block shrink-0 md:w-72">
                            <span className="sr-only">
                                Search fuel requests on this page
                            </span>
                            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search reference, asset, requester…"
                                className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm text-ink transition-colors placeholder:text-ink-soft focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/30 focus-visible:outline-hidden"
                            />
                        </label>
                    )}
                </div>
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
                        {/* Stage filters stay on one line and scroll when narrow. */}
                        <div
                            role="region"
                            aria-label="Fuel request filters"
                            tabIndex={0}
                            className="workspace-scroll-region pb-1"
                        >
                            <div
                                className="flex w-max items-center gap-1.5"
                                role="group"
                                aria-label="Filter fuel requests by stage"
                            >
                                {filters.map((filter) => (
                                    <FilterPill
                                        key={filter.value}
                                        label={filter.label}
                                        count={filter.count}
                                        tone={filter.tone}
                                        alert={filter.alert}
                                        icon={filter.icon}
                                        active={filterStatus === filter.value}
                                        onClick={() =>
                                            setFilterStatus(filter.value)
                                        }
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Requested vs dispensed litres on this page, plus burn-rate health. */}
                        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-xs sm:grid-cols-3">
                            <div className="flex items-center gap-2.5 bg-surface px-3 py-3 sm:gap-3 sm:px-4">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                                    <Droplets className="h-4 w-4" />
                                </span>
                                <div>
                                    <p className="text-ink-soft">
                                        Requested Litres
                                    </p>
                                    <p className="text-ink">
                                        <span className="text-base font-semibold tabular-nums">
                                            {kpis.totalRequestedLitres.toLocaleString()}
                                        </span>{' '}
                                        <span className="text-ink-soft">L</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5 bg-surface px-3 py-3 sm:gap-3 sm:px-4">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success-strong">
                                    <Fuel className="h-4 w-4" />
                                </span>
                                <div>
                                    <p className="text-ink-soft">
                                        Dispensed Litres
                                    </p>
                                    <p className="text-ink">
                                        <span className="text-base font-semibold tabular-nums">
                                            {kpis.totalDispensedLitres.toLocaleString()}
                                        </span>{' '}
                                        <span className="text-ink-soft">L</span>
                                    </p>
                                </div>
                            </div>
                            <div className="col-span-2 flex items-center gap-2.5 bg-surface px-3 py-2.5 sm:col-span-1 sm:gap-3 sm:px-4 sm:py-3">
                                {kpis.anomalies > 0 ? (
                                    <>
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger-strong">
                                            <AlertTriangle className="h-4 w-4" />
                                        </span>
                                        <p className="font-semibold text-danger-strong tabular-nums">
                                            {kpis.anomalies} burn-rate{' '}
                                            {kpis.anomalies === 1
                                                ? 'anomaly'
                                                : 'anomalies'}
                                        </p>
                                    </>
                                ) : kpis.evaluatedLogsCount > 0 ? (
                                    <>
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success-strong">
                                            <CheckCircle2 className="h-4 w-4" />
                                        </span>
                                        <p className="font-medium text-success-strong">
                                            All evaluated logs within baseline
                                            burn rate
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft">
                                            <Gauge className="h-4 w-4" />
                                        </span>
                                        <p className="text-ink-soft">
                                            Not enough data to assess
                                            consumption
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        {requests.length === 0 ? (
                            <Panel className="p-8 text-center sm:p-12">
                                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-subtle text-ink-soft">
                                    <Fuel className="h-5 w-5 text-ink-soft" />
                                </div>
                                <h3 className="mt-3 text-sm font-semibold text-ink">
                                    No fuel requests yet
                                </h3>
                                <p className="mx-auto mt-1 max-w-md text-xs text-ink-soft">
                                    Requests from the field app and this
                                    workspace appear here for review. Once
                                    verified, the operator records the actual
                                    fuel received and its receipt.
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
                            /* Queue beside the selected detail on desktop; one at a time on phones. */
                            <div className="grid gap-6 lg:grid-cols-12">
                                <div
                                    className={cn(
                                        'lg:col-span-5',
                                        mobileDetailView
                                            ? 'hidden lg:block'
                                            : 'block',
                                    )}
                                >
                                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
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
                                            <span>Sort</span>
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
                                        {filteredRequests.map((req) => (
                                            <FuelQueueRow
                                                key={req.id}
                                                request={req}
                                                selected={
                                                    selectedRequest?.id ===
                                                    req.id
                                                }
                                                onSelect={() =>
                                                    handleSelectRequest(req.id)
                                                }
                                            />
                                        ))}
                                    </ul>
                                </div>

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
