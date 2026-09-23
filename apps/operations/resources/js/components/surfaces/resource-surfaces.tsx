import {
    CircleDollarSign,
    ClipboardCheck,
    Download,
    Fuel,
    MapPin,
    Plus,
    Search,
    SearchX,
    SlidersHorizontal,
    Truck,
    Wrench,
} from 'lucide-react';
import { useState } from 'react';
import {
    Button,
    DataPair,
    EmptyState,
    InlineNotice,
    PageHeading,
    Panel,
    ProgressBar,
    StatusBadge,
    PrototypeSandboxBanner,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { FuelRequest, Resource, UserRole } from '@/types/operations';

function resourceDetail(resource: Resource) {
    switch (resource.kind) {
        case 'truck':
            return [
                ['Vehicle type', resource.subtype],
                ['Odometer', `${resource.odometerKm.toLocaleString()} km`],
                ['Next service', resource.nextService],
            ];
        case 'crane':
            return [
                ['Rated capacity', `${resource.capacityTons} tons`],
                ['Operating hours', resource.operatingHours.toLocaleString()],
                ['Certification', resource.certification],
            ];
        case 'equipment':
            return [
                ['Equipment type', resource.subtype],
                ['Inspection due', resource.inspectionDue],
            ];
        case 'driver':
            return [
                ['License', resource.license],
                ['Qualification', resource.qualification],
            ];
        case 'operator':
            return [
                ['Certification', resource.certification],
                ['Recent lifts', `${resource.liftsLast90Days} in 90 days`],
            ];
    }
}

export function ResourceDirectory({
    mode,
    resources,
    selectedAssetId,
    query,
    onClearQuery,
    onSelectAsset,
}: {
    mode: 'fleet' | 'equipment';
    resources: Resource[];
    selectedAssetId: string;
    query: string;
    onClearQuery: () => void;
    onSelectAsset: (assetId: string) => void;
}) {
    const [statusFilter, setStatusFilter] = useState('All statuses');
    const allowedKinds =
        mode === 'fleet'
            ? ['truck', 'driver']
            : ['crane', 'equipment', 'operator'];
    const modeResources = resources.filter((resource) =>
        allowedKinds.includes(resource.kind),
    );
    const filtered = modeResources.filter((resource) => {
        const matchesQuery =
            `${resource.code} ${resource.name} ${resource.location}`
                .toLowerCase()
                .includes(query.toLowerCase());
        const matchesStatus =
            statusFilter === 'All statuses' || resource.status === statusFilter;

        return matchesQuery && matchesStatus;
    });
    const hasActiveFilters = Boolean(query) || statusFilter !== 'All statuses';
    const clearFilters = () => {
        setStatusFilter('All statuses');
        onClearQuery();
    };
    const selected =
        filtered.find((resource) => resource.id === selectedAssetId) ??
        filtered[0];

    return (
        <div>
            <PrototypeSandboxBanner surfaceName="Resource Directory Simulation" />
            <PageHeading
                title={
                    mode === 'fleet' ? 'Fleet management' : 'Cranes & equipment'
                }
                description={
                    mode === 'fleet'
                        ? 'Track vehicle readiness, assignment, maintenance, location, and utilization.'
                        : 'Manage crane capacity, inspection, certification, operating status, and support equipment.'
                }
                actions={
                    <>
                        <Button variant="secondary">
                            <Download className="h-4 w-4" aria-hidden="true" />
                            Export asset register
                        </Button>
                    </>
                }
            />

            <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <Panel className="min-w-0 overflow-hidden">
                    <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative max-w-md flex-1">
                            <Search
                                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
                                aria-hidden="true"
                            />
                            <p className="h-10 rounded-lg border border-line bg-surface-subtle py-2 pr-3 pl-9 text-sm text-ink-soft">
                                {query
                                    ? `Filtered by “${query}”`
                                    : `Showing ${filtered.length} Core 3 assets`}
                            </p>
                        </div>
                        <label className="relative">
                            <span className="sr-only">
                                Filter resource status
                            </span>
                            <select
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value)
                                }
                                className="h-10 appearance-none rounded-lg border border-line bg-surface pr-9 pl-3 text-sm text-ink"
                            >
                                <option>All statuses</option>
                                <option>Available</option>
                                <option>Assigned</option>
                                <option>Working</option>
                                <option>Maintenance</option>
                                <option>Offline</option>
                            </select>
                            <SlidersHorizontal
                                className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted"
                                aria-hidden="true"
                            />
                        </label>
                    </div>

                    {filtered.length === 0 ? (
                        <EmptyState
                            announce={hasActiveFilters}
                            icon={hasActiveFilters ? SearchX : Truck}
                            title={
                                hasActiveFilters
                                    ? 'No resources match these filters'
                                    : `No ${mode === 'fleet' ? 'fleet assets' : 'equipment assets'} available`
                            }
                            message={
                                hasActiveFilters
                                    ? 'Clear the workspace search and status filter to restore the asset list.'
                                    : 'Assets received from Core 3 will appear here with their readiness and assignment status.'
                            }
                            primaryAction={
                                hasActiveFilters ? (
                                    <Button
                                        variant="secondary"
                                        onClick={clearFilters}
                                    >
                                        Clear resource filters
                                    </Button>
                                ) : undefined
                            }
                        />
                    ) : (
                        <Table
                            containerClassName="border-0 rounded-none"
                            className="min-w-[48rem]"
                            aria-label="Fleet resources table"
                        >
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Resource</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Current location</TableHead>
                                    <TableHead>Utilization</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((resource) => (
                                    <TableRow
                                        key={resource.id}
                                        selected={selected?.id === resource.id}
                                        className="cursor-pointer"
                                        onClick={() =>
                                            onSelectAsset(resource.id)
                                        }
                                    >
                                        <TableCell>
                                            <button
                                                type="button"
                                                className="text-left"
                                                onClick={() =>
                                                    onSelectAsset(resource.id)
                                                }
                                            >
                                                <span className="block text-sm font-semibold text-ink">
                                                    {resource.code}
                                                </span>
                                                <span className="mt-0.5 block text-xs text-ink-soft">
                                                    {resource.name}
                                                </span>
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-sm text-ink-soft capitalize">
                                            {resource.kind}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge
                                                status={resource.status}
                                            />
                                        </TableCell>
                                        <TableCell className="text-sm text-ink-soft">
                                            {resource.location}
                                        </TableCell>
                                        <TableCell className="w-44">
                                            <ProgressBar
                                                value={resource.utilization}
                                                label="Last 30 days"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Panel>

                {selected && allowedKinds.includes(selected.kind) ? (
                    <Panel className="self-start overflow-hidden">
                        <div className="border-b border-line p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                                    {selected.kind === 'truck' ? (
                                        <Truck
                                            className="h-5 w-5"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <Wrench
                                            className="h-5 w-5"
                                            aria-hidden="true"
                                        />
                                    )}
                                </div>
                                <StatusBadge status={selected.status} />
                            </div>
                            <h2 className="mt-3 text-lg font-semibold text-ink">
                                {selected.code}
                            </h2>
                            <p className="mt-1 text-sm text-ink-soft">
                                {selected.name}
                            </p>
                        </div>
                        <dl className="divide-y divide-line px-4">
                            <DataPair
                                label="Location"
                                value={selected.location}
                            />
                            <DataPair
                                label="Utilization"
                                value={`${selected.utilization}%`}
                            />
                            {resourceDetail(selected).map(([label, value]) => (
                                <DataPair
                                    key={label}
                                    label={label}
                                    value={value}
                                />
                            ))}
                        </dl>
                        <div className="space-y-2 border-t border-line p-4">
                            <Button className="w-full" variant="primary">
                                View full resource record
                            </Button>
                            <Button className="w-full" variant="secondary">
                                <MapPin
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Open in live operations
                            </Button>
                        </div>
                    </Panel>
                ) : (
                    <Panel className="self-start">
                        <EmptyState
                            compact
                            icon={ClipboardCheck}
                            title="Select a resource"
                            message="Choose a row to inspect readiness, utilization, and maintenance."
                        />
                    </Panel>
                )}
            </div>
        </div>
    );
}

export function FuelManagement({
    requests,
    role,
    query,
    onClearQuery,
    onDecide,
}: {
    requests: FuelRequest[];
    role: UserRole;
    query: string;
    onClearQuery: () => void;
    onDecide: (requestId: string, status: 'Approved' | 'Rejected') => void;
}) {
    const [view, setView] = useState<'requests' | 'logs'>('requests');
    const filtered = requests.filter((request) =>
        `${request.reference} ${request.assetCode} ${request.jobReference} ${request.requestedBy}`
            .toLowerCase()
            .includes(query.toLowerCase()),
    );
    const totalLiters = requests.reduce(
        (sum, request) => sum + request.liters,
        0,
    );
    const totalCost = requests.reduce((sum, request) => sum + request.cost, 0);
    const canApprove = role === 'manager' || role === 'administrator';

    return (
        <div>
            <PrototypeSandboxBanner surfaceName="Fuel Management Simulation" />
            <PageHeading
                title={canApprove ? 'Fuel approvals' : 'Fuel management'}
                description="Track fuel requests, approval decisions, dispensing records, meter readings, and operational anomalies."
                actions={
                    <>
                        <Button variant="secondary">
                            <Download className="h-4 w-4" aria-hidden="true" />
                            Export fuel log
                        </Button>
                        {!canApprove && (
                            <Button variant="primary">
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                Create fuel request
                            </Button>
                        )}
                    </>
                }
            />

            <div className="space-y-4 p-4 md:p-6">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.35fr]">
                    <Panel className="p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm text-ink-soft">
                                    Pending approval
                                </p>
                                <p className="mt-2 text-2xl font-semibold text-ink">
                                    {
                                        requests.filter(
                                            (request) =>
                                                request.status === 'Pending',
                                        ).length
                                    }
                                </p>
                            </div>
                            <ClipboardCheck
                                className="h-5 w-5 text-warning"
                                aria-hidden="true"
                            />
                        </div>
                    </Panel>
                    <Panel className="p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm text-ink-soft">
                                    Recorded volume
                                </p>
                                <p className="mt-2 text-2xl font-semibold text-ink">
                                    {totalLiters.toLocaleString()} L
                                </p>
                            </div>
                            <Fuel
                                className="h-5 w-5 text-brand-strong"
                                aria-hidden="true"
                            />
                        </div>
                    </Panel>
                    <Panel className="p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm text-ink-soft">
                                    Recorded cost
                                </p>
                                <p className="mt-2 text-2xl font-semibold text-ink">
                                    ₱{totalCost.toLocaleString()}
                                </p>
                                <p className="mt-1 text-xs text-ink-soft">
                                    Based on current prototype requests
                                </p>
                            </div>
                            <CircleDollarSign
                                className="h-5 w-5 text-success"
                                aria-hidden="true"
                            />
                        </div>
                    </Panel>
                </div>

                <InlineNotice tone="warning" title="Consumption anomaly">
                    TR-03 is 14% above its rolling 30-day baseline. Review the
                    overdue preventive service before the next dispatch.
                </InlineNotice>

                <Panel className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                        <div className="flex items-center gap-1 rounded-lg bg-surface-subtle p-1">
                            <button
                                type="button"
                                onClick={() => setView('requests')}
                                className={cn(
                                    'min-h-9 rounded-md px-3 text-sm font-medium',
                                    view === 'requests'
                                        ? 'bg-surface text-ink shadow-sm'
                                        : 'text-ink-soft',
                                )}
                            >
                                Requests
                            </button>
                            <button
                                type="button"
                                onClick={() => setView('logs')}
                                className={cn(
                                    'min-h-9 rounded-md px-3 text-sm font-medium',
                                    view === 'logs'
                                        ? 'bg-surface text-ink shadow-sm'
                                        : 'text-ink-soft',
                                )}
                            >
                                Dispensing log
                            </button>
                        </div>
                        <p className="text-xs text-ink-soft">
                            {filtered.length} matching records
                        </p>
                    </div>

                    {filtered.length === 0 ? (
                        <EmptyState
                            announce={Boolean(query)}
                            icon={query ? SearchX : Fuel}
                            title={
                                query
                                    ? 'No fuel records match the search'
                                    : 'No fuel records available'
                            }
                            message={
                                query
                                    ? 'Try another request, job, asset, or requester name.'
                                    : 'Fuel requests and dispensing records will appear here when they are submitted.'
                            }
                            primaryAction={
                                query ? (
                                    <Button
                                        variant="secondary"
                                        onClick={onClearQuery}
                                    >
                                        Clear workspace search
                                    </Button>
                                ) : undefined
                            }
                        />
                    ) : (
                        <Table
                            containerClassName="border-0 rounded-none"
                            className="min-w-[54rem]"
                            aria-label="Fuel authorization requests table"
                        >
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Request</TableHead>
                                    <TableHead>Asset / job</TableHead>
                                    <TableHead>Requested by</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Meter</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((request) => (
                                    <TableRow key={request.id}>
                                        <TableCell>
                                            <p className="text-sm font-semibold text-ink">
                                                {request.reference}
                                            </p>
                                            <p className="mt-0.5 text-xs text-ink-soft">
                                                {request.requestedAt}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <p className="text-sm font-medium text-ink">
                                                {request.equipmentName ||
                                                    request.assetCode}
                                            </p>
                                            <p className="mt-0.5 text-xs text-ink-soft">
                                                {request.equipmentType
                                                    ? `${request.equipmentType} · `
                                                    : ''}
                                                {request.registrationNumber
                                                    ? `Reg: ${request.registrationNumber} · `
                                                    : ''}
                                                <span className="font-mono">
                                                    {request.assetCode}
                                                </span>
                                            </p>
                                            {request.jobReference && (
                                                <p className="mt-0.5 text-[11px] text-ink-soft">
                                                    Job: {request.jobReference}
                                                </p>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-ink-soft">
                                            {request.requestedBy}
                                        </TableCell>
                                        <TableCell>
                                            <p className="text-sm font-medium text-ink">
                                                {request.liters} L
                                            </p>
                                            <p className="mt-0.5 text-xs text-ink-soft">
                                                ₱{request.cost.toLocaleString()}
                                            </p>
                                        </TableCell>
                                        <TableCell className="text-sm text-ink-soft">
                                            {request.meterReading}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge
                                                status={request.status}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {canApprove &&
                                            request.status === 'Pending' ? (
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        onClick={() =>
                                                            onDecide(
                                                                request.id,
                                                                'Approved',
                                                            )
                                                        }
                                                    >
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() =>
                                                            onDecide(
                                                                request.id,
                                                                'Rejected',
                                                            )
                                                        }
                                                    >
                                                        Reject
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="quiet"
                                                >
                                                    View record
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Panel>
            </div>
        </div>
    );
}
