import { FlaskConical, Inbox, Plus, RefreshCw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, EmptyState } from '@/components/ui';
import { ServiceRequestIntakeForm } from '@/components/workspace/live-dispatch-intake';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    ClientViewModel,
    DispatchJobViewModel,
    RentalDispatchHandoffViewModel,
    ServiceRequestViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';
import { RentalOrderDetail, ServiceOrderDetail } from './incoming-work-detail';
import type { IncomingFilter, IncomingWorkItem } from './incoming-work-helpers';
import { useIncomingQueue } from './use-incoming-queue';

const FLOW_STEPS = [
    'Core 1 sends a job order or rental',
    'Review the details',
    'Create the dispatch',
    'Assign crew and crane on the Schedule',
];

const FILTERS: { value: IncomingFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'service', label: 'Job orders' },
    { value: 'rental', label: 'Rentals' },
];

export function IncomingWork({
    clients,
    assets = [],
    serviceRequests,
    rentalHandoffs,
    jobs,
    capabilities,
    initialRequestId,
    onIncomingTotalChange,
    onCreateDirect,
}: {
    clients: ClientViewModel[];
    assets?: AssetViewModel[];
    serviceRequests: ServiceRequestViewModel[];
    rentalHandoffs: RentalDispatchHandoffViewModel[];
    jobs: DispatchJobViewModel[];
    capabilities: WorkspaceCapabilities;
    initialRequestId?: number | null;
    onIncomingTotalChange?: (total: number) => void;
    onCreateDirect?: () => void;
}) {
    // Workspace props reload after every create, which refreshes the queue.
    const refreshKey = useMemo(
        () => [serviceRequests, rentalHandoffs],
        [serviceRequests, rentalHandoffs],
    );
    const queue = useIncomingQueue({
        refreshKey,
        focusServiceRequestId: initialRequestId,
        onTotalChange: onIncomingTotalChange,
    });
    const [filter, setFilter] = useState<IncomingFilter>('all');
    const [selectedKey, setSelectedKey] = useState<string | null>(
        initialRequestId ? `service-${initialRequestId}` : null,
    );
    const [simulating, setSimulating] = useState(false);
    const detailRef = useRef<HTMLDivElement>(null);

    const serviceById = new Map(
        (queue.result?.service_requests ?? []).map((request) => [
            request.id,
            request,
        ]),
    );
    const rentalById = new Map(
        (queue.result?.rental_handoffs ?? []).map((handoff) => [
            handoff.id,
            handoff,
        ]),
    );
    const items = sortByUrgency(
        queue.result?.items ?? [],
        serviceById,
        rentalById,
    );
    const visibleItems = items.filter(
        (item) => filter === 'all' || item.mode === filter,
    );
    const selected = items.find((item) => item.key === selectedKey) ?? null;
    const showDetail = simulating || selected !== null;

    useEffect(() => {
        if (showDetail) {
            detailRef.current?.focus({ preventScroll: true });

            if (window.innerWidth < 1024) {
                detailRef.current?.scrollIntoView({ block: 'start' });
            }
        }
    }, [showDetail, selectedKey]);

    const openItem = (key: string) => {
        setSimulating(false);
        setSelectedKey(key);
    };

    const closeDetail = () => {
        setSimulating(false);
        setSelectedKey(null);
    };

    const counts = {
        all: items.length,
        service: items.filter((item) => item.mode === 'service').length,
        rental: items.filter((item) => item.mode === 'rental').length,
    };

    return (
        <section
            id="incoming-work-panel"
            className="bg-canvas p-4 lg:p-6"
            aria-labelledby="incoming-work-heading"
        >
            <div className="mx-auto max-w-7xl">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2
                            id="incoming-work-heading"
                            className="text-xl font-semibold tracking-tight text-ink"
                        >
                            Incoming work
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
                            Job orders and rentals sent from Core 1. Open one,
                            check it, then create its dispatch.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {capabilities.create_service_request && (
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setSelectedKey(null);
                                    setSimulating(true);
                                }}
                            >
                                <FlaskConical
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Simulate Core 1 order
                            </Button>
                        )}
                        {capabilities.create_dispatch && onCreateDirect && (
                            <Button
                                id="create-direct-dispatch-trigger"
                                variant="secondary"
                                onClick={onCreateDirect}
                            >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                Create direct dispatch
                            </Button>
                        )}
                    </div>
                </header>

                <ol
                    className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"
                    aria-label="How incoming work becomes a dispatch"
                >
                    {FLOW_STEPS.map((step, index) => (
                        <li
                            key={step}
                            className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-ink-soft"
                        >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-ink">
                                {index + 1}
                            </span>
                            {step}
                        </li>
                    ))}
                </ol>

                <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
                    <div className={cn(showDetail && 'hidden lg:block')}>
                        <QueueList
                            items={visibleItems}
                            counts={counts}
                            filter={filter}
                            onFilter={setFilter}
                            selectedKey={selectedKey}
                            onOpen={openItem}
                            serviceById={serviceById}
                            rentalById={rentalById}
                            pending={queue.pending}
                            error={queue.error}
                            onRetry={queue.retry}
                            total={queue.result?.total ?? 0}
                        />
                        {queue.result && queue.result.last_page > 1 && (
                            <nav
                                aria-label="Incoming work pages"
                                className="mt-3 flex items-center justify-between gap-2"
                            >
                                <Button
                                    size="sm"
                                    disabled={queue.pending || queue.page <= 1}
                                    onClick={() =>
                                        queue.setPage(queue.page - 1)
                                    }
                                >
                                    Previous
                                </Button>
                                <span className="text-sm text-ink-soft">
                                    Page {queue.result.current_page} of{' '}
                                    {queue.result.last_page}
                                </span>
                                <Button
                                    size="sm"
                                    disabled={
                                        queue.pending ||
                                        queue.page >= queue.result.last_page
                                    }
                                    onClick={() =>
                                        queue.setPage(queue.page + 1)
                                    }
                                >
                                    Next
                                </Button>
                            </nav>
                        )}
                    </div>

                    <div
                        ref={detailRef}
                        tabIndex={-1}
                        className={cn(
                            'min-w-0 rounded-xl border border-line bg-surface p-4 focus:outline-none md:p-6',
                            !showDetail && 'hidden lg:block',
                        )}
                    >
                        {simulating ? (
                            <SimulatorPanel
                                clients={clients}
                                equipment={assets.filter(isFleetEquipment)}
                                onClose={closeDetail}
                            />
                        ) : selected ? (
                            <SelectedDetail
                                key={selected.key}
                                item={selected}
                                serviceById={serviceById}
                                rentalById={rentalById}
                                jobs={jobs}
                                capabilities={capabilities}
                                onBack={closeDetail}
                            />
                        ) : (
                            <EmptyState
                                icon={Inbox}
                                title="Select an order"
                                message="Pick a job order or rental on the left to see its details and create the dispatch."
                            />
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

function QueueList({
    items,
    counts,
    filter,
    onFilter,
    selectedKey,
    onOpen,
    serviceById,
    rentalById,
    pending,
    error,
    onRetry,
    total,
}: {
    items: IncomingWorkItem[];
    counts: Record<IncomingFilter, number>;
    filter: IncomingFilter;
    onFilter: (filter: IncomingFilter) => void;
    selectedKey: string | null;
    onOpen: (key: string) => void;
    serviceById: Map<number, ServiceRequestViewModel>;
    rentalById: Map<number, RentalDispatchHandoffViewModel>;
    pending: boolean;
    error: string | null;
    onRetry: () => void;
    total: number;
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                <div
                    className="flex flex-wrap gap-1"
                    role="group"
                    aria-label="Filter incoming work"
                >
                    {FILTERS.map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={filter === value}
                            onClick={() => onFilter(value)}
                            className={cn(
                                'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-none lg:min-h-9',
                                filter === value
                                    ? 'bg-brand-soft text-ink'
                                    : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                            )}
                        >
                            {label}
                            <span className="tabular-nums">
                                {counts[value]}
                            </span>
                        </button>
                    ))}
                </div>
                {pending && (
                    <span
                        className="inline-flex items-center gap-1 text-sm text-ink-soft"
                        role="status"
                    >
                        <RefreshCw
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                        />
                        <span className="sr-only">Loading orders</span>
                    </span>
                )}
            </div>

            {error && (
                <div
                    className="flex flex-wrap items-center justify-between gap-2 bg-warning-soft px-3 py-2 text-sm text-ink"
                    role="alert"
                >
                    {error}
                    <Button size="sm" onClick={onRetry}>
                        Try again
                    </Button>
                </div>
            )}

            {items.length === 0 ? (
                pending ? (
                    <div className="space-y-3 p-4" aria-hidden="true">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-surface-subtle" />
                        <div className="h-4 w-1/2 animate-pulse rounded bg-surface-subtle" />
                    </div>
                ) : (
                    <EmptyState
                        compact
                        icon={Inbox}
                        title={total === 0 ? 'Nothing waiting' : 'None here'}
                        message={
                            total === 0
                                ? 'New job orders and rentals from Core 1 will appear here.'
                                : 'No orders match this filter.'
                        }
                    />
                )
            ) : (
                <ul
                    aria-label="Incoming work queue"
                    className="divide-y divide-line"
                >
                    {items.map((item) => {
                        const service =
                            item.mode === 'service'
                                ? serviceById.get(item.sourceId)
                                : undefined;
                        const rental =
                            item.mode === 'rental'
                                ? rentalById.get(item.sourceId)
                                : undefined;
                        const date =
                            service?.scheduled_date ??
                            rental?.start_date ??
                            null;
                        const priority = service?.priority.value;
                        const isSelected = selectedKey === item.key;

                        return (
                            <li key={item.key}>
                                <button
                                    type="button"
                                    aria-current={
                                        isSelected ? 'true' : undefined
                                    }
                                    onClick={() => onOpen(item.key)}
                                    className={cn(
                                        'w-full border-l-4 px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-none focus-visible:ring-inset',
                                        isSelected
                                            ? 'border-brand bg-brand-soft/60'
                                            : 'border-transparent hover:bg-surface-subtle',
                                    )}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="font-mono text-sm font-semibold text-ink">
                                            {item.reference}
                                        </span>
                                        <span className="text-sm text-ink-soft">
                                            {formatDate(date, 'No date')}
                                        </span>
                                    </span>
                                    <span className="mt-1 block truncate text-sm font-medium text-ink">
                                        {item.client}
                                    </span>
                                    <span className="mt-0.5 block truncate text-sm text-ink-soft">
                                        {item.detail}
                                    </span>
                                    <span className="mt-2 flex flex-wrap gap-1.5">
                                        <span className="rounded-md bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink">
                                            {item.mode === 'service'
                                                ? 'Job order'
                                                : 'Rental'}
                                        </span>
                                        {priority && priority !== 'routine' && (
                                            <span
                                                className={cn(
                                                    'rounded-md px-2 py-0.5 text-xs font-semibold',
                                                    priority === 'emergency'
                                                        ? 'bg-danger-soft text-danger-strong'
                                                        : 'bg-warning-soft text-warning-strong',
                                                )}
                                            >
                                                {service?.priority.label}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function SelectedDetail({
    item,
    serviceById,
    rentalById,
    jobs,
    capabilities,
    onBack,
}: {
    item: IncomingWorkItem;
    serviceById: Map<number, ServiceRequestViewModel>;
    rentalById: Map<number, RentalDispatchHandoffViewModel>;
    jobs: DispatchJobViewModel[];
    capabilities: WorkspaceCapabilities;
    onBack: () => void;
}) {
    if (item.mode === 'service') {
        const request = serviceById.get(item.sourceId);

        return request ? (
            <ServiceOrderDetail
                request={request}
                jobs={jobs}
                canConvert={capabilities.convert_service_request}
                onBack={onBack}
            />
        ) : (
            <MissingOrder onBack={onBack} />
        );
    }

    const handoff = rentalById.get(item.sourceId);

    return handoff ? (
        <RentalOrderDetail
            handoff={handoff}
            jobs={jobs}
            canConvert={capabilities.create_rental_dispatch}
            onBack={onBack}
        />
    ) : (
        <MissingOrder onBack={onBack} />
    );
}

function MissingOrder({ onBack }: { onBack: () => void }) {
    return (
        <EmptyState
            title="This order is no longer waiting"
            message="It may already have a dispatch. Pick another order from the list."
            primaryAction={<Button onClick={onBack}>Back to list</Button>}
        />
    );
}

function SimulatorPanel({
    clients,
    equipment,
    onClose,
}: {
    clients: ClientViewModel[];
    equipment: AssetViewModel[];
    onClose: () => void;
}) {
    return (
        <div aria-labelledby="simulate-core1-title">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-info-strong">
                        Demo only
                    </span>
                    <h3
                        id="simulate-core1-title"
                        className="mt-2 text-xl font-semibold tracking-tight text-ink"
                    >
                        Simulate a Core 1 job order
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-ink-soft">
                        Core 1 isn&apos;t connected yet. This form stands in for
                        Job Order Registration: the order you save appears in
                        the list like one sent by Core 1.
                    </p>
                </div>
                <Button
                    size="icon"
                    variant="quiet"
                    onClick={onClose}
                    aria-label="Close simulator"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>
            <ServiceRequestIntakeForm
                clients={clients}
                onClose={onClose}
                defaultReference={nextDemoReference()}
                submitLabel="Send to Incoming work"
                compact
                equipment={equipment}
            />
        </div>
    );
}

const PRIORITY_RANK: Record<string, number> = {
    emergency: 0,
    priority: 1,
    routine: 2,
};

/** Emergencies first, then the soonest requested date. */
function sortByUrgency(
    items: IncomingWorkItem[],
    serviceById: Map<number, ServiceRequestViewModel>,
    rentalById: Map<number, RentalDispatchHandoffViewModel>,
): IncomingWorkItem[] {
    const rankOf = (item: IncomingWorkItem) => {
        const service =
            item.mode === 'service'
                ? serviceById.get(item.sourceId)
                : undefined;
        const rental =
            item.mode === 'rental' ? rentalById.get(item.sourceId) : undefined;
        const date = service?.scheduled_date ?? rental?.start_date ?? null;

        return {
            priority: PRIORITY_RANK[service?.priority.value ?? 'routine'] ?? 2,
            time: date ? new Date(date).getTime() : Number.POSITIVE_INFINITY,
        };
    };

    return [...items].sort((left, right) => {
        const a = rankOf(left);
        const b = rankOf(right);

        return a.priority - b.priority || a.time - b.time;
    });
}

/** Tower and mobile cranes, heavy equipment and trucks: all go out with an operator. */
const OPERATED_KINDS = [
    'tower_crane',
    'crane',
    'mobile_crane',
    'equipment',
    'truck',
    'vehicle',
];

function isFleetEquipment(asset: AssetViewModel): boolean {
    return OPERATED_KINDS.includes(asset.kind);
}

function nextDemoReference(): string {
    const year = new Date().getFullYear();
    const serial = String(Date.now() % 10_000).padStart(4, '0');

    return `JO-${year}-D${serial}`;
}
