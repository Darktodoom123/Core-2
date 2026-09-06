import { router, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    Clock,
    Droplets,
    Fuel,
    Search,
    SearchX,
    Truck,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import { humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    FuelRequestViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';
import { FuelLogModal } from './fuel-log-modal';
import { FuelRequestCard } from './fuel-request-card';

interface FuelSurfaceProps {
    requests: FuelRequestViewModel[];
    capabilities: WorkspaceCapabilities;
    assets?: AssetViewModel[];
}

export function FuelSurface({
    requests,
    capabilities,
    assets = [],
}: FuelSurfaceProps) {
    const [pendingActionId, setPendingActionId] = useState<string | null>(null);
    const [logModalRequest, setLogModalRequest] =
        useState<FuelRequestViewModel | null>(null);
    const [filterStatus, setFilterStatus] = useState<
        'all' | 'pending' | 'approved' | 'logged' | 'anomalies'
    >('all');
    const [searchQuery, setSearchQuery] = useState('');

    const form = useForm({
        operational_asset_id: '',
        dispatch_job_id: '',
        quantity_litres: '',
        fuel_type: 'diesel',
        purpose: '',
    });

    const formComplete =
        form.data.quantity_litres.trim() !== '' &&
        (form.data.operational_asset_id !== '' ||
            form.data.purpose.trim() !== '');

    const selectedAsset = useMemo(() => {
        if (!form.data.operational_asset_id) {
            return null;
        }

        return (
            assets.find(
                (a) => String(a.id) === String(form.data.operational_asset_id),
            ) ?? null
        );
    }, [assets, form.data.operational_asset_id]);

    const submitNewRequest = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            purpose:
                data.purpose.trim() !== ''
                    ? data.purpose
                    : selectedAsset
                      ? `Refuel for ${selectedAsset.name || selectedAsset.code} (${humanize(selectedAsset.kind)})`
                      : 'Equipment refueling',
        }));
        form.post('/operations/fuel-requests', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

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
        let logged = 0;
        let totalLitres = 0;
        let anomalies = 0;

        for (const req of requests) {
            const v = req.status.value;
            const litres = Number(req.quantity_litres) || 0;
            totalLitres += litres;

            if (v === 'submitted' || v === 'forwarded') {
                pending += 1;
            } else if (v === 'approved') {
                approved += 1;
            } else if (v === 'logged' || v === 'verified') {
                logged += 1;
            }

            if (req.logs?.some((l) => l.is_anomaly)) {
                anomalies += 1;
            }
        }

        return {
            total: requests.length,
            pending,
            approved,
            logged,
            anomalies,
            totalLitres,
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
                        : filterStatus === 'logged'
                          ? v === 'logged' || v === 'verified'
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

    return (
        <div>
            <PageHeading
                title="Fuel Operations"
                description="Heavy equipment diesel telematics, consumption variance tracking, and role-gated refueling authorizations."
            />
            <div className="space-y-6 p-4 md:p-6">
                {/* Fuel Operations KPI Strip */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
                    <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold tracking-wider text-warning-strong uppercase">
                                Pending Review
                            </span>
                            <Clock className="h-4 w-4 text-warning" />
                        </div>
                        <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
                            {kpis.pending}
                        </p>
                        <p className="mt-1 text-[11px] text-ink-soft">
                            Awaiting manager decision
                        </p>
                    </div>

                    <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold tracking-wider text-brand-strong uppercase">
                                Approved / Dispensing
                            </span>
                            <Fuel className="h-4 w-4 text-brand" />
                        </div>
                        <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
                            {kpis.approved}
                        </p>
                        <p className="mt-1 text-[11px] text-ink-soft">
                            Ready for station refueling
                        </p>
                    </div>

                    <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold tracking-wider text-success-strong uppercase">
                                Verified &amp; Logged
                            </span>
                            <CheckCircle2 className="h-4 w-4 text-success" />
                        </div>
                        <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
                            {kpis.logged}
                        </p>
                        <p className="mt-1 text-[11px] text-ink-soft">
                            Meters &amp; receipts audited
                        </p>
                    </div>

                    <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                                Total Volume
                            </span>
                            <Droplets className="h-4 w-4 text-ink-soft" />
                        </div>
                        <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
                            {kpis.totalLitres.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-ink-soft">
                                Litres
                            </span>
                        </p>
                        <p className="mt-1 text-[11px] text-ink-soft">
                            {kpis.anomalies > 0 ? (
                                <span className="font-semibold text-danger">
                                    ⚠️ {kpis.anomalies} burn-rate{' '}
                                    {kpis.anomalies === 1
                                        ? 'anomaly'
                                        : 'anomalies'}
                                </span>
                            ) : (
                                'All within baseline burn rate'
                            )}
                        </p>
                    </div>
                </div>

                {/* Submit Fuel Request Panel */}
                {capabilities.request_fuel && (
                    <Panel className="p-4 md:p-5">
                        <h2 className="text-sm font-bold text-ink">
                            Submit Refueling Request
                        </h2>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Submit equipment refueling requests scoped to your
                            fleet baseline and assignments.
                        </p>
                        <form
                            onSubmit={submitNewRequest}
                            className="mt-4 space-y-3"
                            noValidate
                        >
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <label className="text-xs font-medium text-ink">
                                    Equipment / Asset
                                    <select
                                        value={form.data.operational_asset_id}
                                        onChange={(e) =>
                                            form.setData(
                                                'operational_asset_id',
                                                e.target.value,
                                            )
                                        }
                                        className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-xs"
                                    >
                                        <option value="">
                                            -- Select Equipment / Vehicle --
                                        </option>
                                        {assets.map((asset) => (
                                            <option
                                                key={asset.id}
                                                value={asset.id}
                                            >
                                                {asset.code} - {asset.name} (
                                                {humanize(asset.kind)}
                                                {asset.registration_number
                                                    ? ` · Reg: ${asset.registration_number}`
                                                    : ''}
                                                )
                                            </option>
                                        ))}
                                    </select>
                                    {form.errors.operational_asset_id && (
                                        <p className="mt-1 text-xs text-danger">
                                            {form.errors.operational_asset_id}
                                        </p>
                                    )}
                                </label>

                                <label className="text-xs font-medium text-ink">
                                    Fuel Type
                                    <select
                                        value={form.data.fuel_type}
                                        onChange={(e) =>
                                            form.setData(
                                                'fuel_type',
                                                e.target.value,
                                            )
                                        }
                                        className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-xs"
                                    >
                                        <option value="diesel">Diesel</option>
                                        <option value="gasoline">
                                            Gasoline
                                        </option>
                                    </select>
                                </label>

                                <div>
                                    <label className="text-xs font-medium text-ink">
                                        Volume (Litres)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={form.data.quantity_litres}
                                        onChange={(e) =>
                                            form.setData(
                                                'quantity_litres',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="e.g. 200"
                                        className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-xs text-ink focus:border-brand focus:outline-none"
                                    />
                                    {form.errors.quantity_litres && (
                                        <p className="mt-1 text-xs text-danger">
                                            {form.errors.quantity_litres}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-ink">
                                        Purpose / Shift Notes
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.purpose}
                                        onChange={(e) =>
                                            form.setData(
                                                'purpose',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="e.g. Concrete pour lift, shift refill"
                                        className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-xs text-ink focus:border-brand focus:outline-none"
                                    />
                                    {form.errors.purpose && (
                                        <p className="mt-1 text-xs text-danger">
                                            {form.errors.purpose}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {selectedAsset && (
                                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-subtle p-3 text-xs">
                                    <div className="flex items-center gap-1.5 font-semibold text-ink">
                                        <Truck className="h-4 w-4 text-brand" />
                                        <span>{selectedAsset.name}</span>
                                    </div>
                                    <span className="text-ink-soft">·</span>
                                    <div>
                                        <span className="text-ink-soft">
                                            Type:{' '}
                                        </span>
                                        <span className="font-medium text-ink">
                                            {humanize(selectedAsset.kind)}
                                            {selectedAsset.subtype
                                                ? ` (${selectedAsset.subtype})`
                                                : ''}
                                        </span>
                                    </div>
                                    <span className="text-ink-soft">·</span>
                                    <div>
                                        <span className="text-ink-soft">
                                            Code:{' '}
                                        </span>
                                        <span className="font-mono text-ink">
                                            {selectedAsset.code}
                                        </span>
                                    </div>
                                    {selectedAsset.meter_value && (
                                        <>
                                            <span className="text-ink-soft">
                                                ·
                                            </span>
                                            <div>
                                                <span className="text-ink-soft">
                                                    Current Meter:{' '}
                                                </span>
                                                <span className="font-medium text-ink">
                                                    {selectedAsset.meter_value}{' '}
                                                    {selectedAsset.meter_type ===
                                                    'hour_meter'
                                                        ? 'hrs'
                                                        : 'km'}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                    {selectedAsset.baseline_burn_rate && (
                                        <>
                                            <span className="text-ink-soft">
                                                ·
                                            </span>
                                            <div>
                                                <span className="text-ink-soft">
                                                    Baseline:{' '}
                                                </span>
                                                <span className="font-medium text-ink">
                                                    {
                                                        selectedAsset.baseline_burn_rate
                                                    }{' '}
                                                    {selectedAsset.burn_rate_unit ??
                                                        'L/hr'}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={form.processing || !formComplete}
                                >
                                    {form.processing
                                        ? 'Submitting…'
                                        : 'Submit Refuel Request'}
                                </Button>
                            </div>
                        </form>
                    </Panel>
                )}

                {/* Filter and Search Bar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div
                        className="flex flex-wrap gap-1"
                        role="group"
                        aria-label="Filter fuel requests"
                    >
                        <button
                            type="button"
                            aria-pressed={filterStatus === 'all'}
                            onClick={() => setFilterStatus('all')}
                            className={cn(
                                'inline-flex min-h-8 items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                filterStatus === 'all'
                                    ? 'bg-ink font-semibold text-canvas'
                                    : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                            )}
                        >
                            All ({kpis.total})
                        </button>
                        <button
                            type="button"
                            aria-pressed={filterStatus === 'pending'}
                            onClick={() => setFilterStatus('pending')}
                            className={cn(
                                'inline-flex min-h-8 items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                filterStatus === 'pending'
                                    ? 'border border-warning/40 bg-warning-soft font-semibold text-warning-strong'
                                    : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                            )}
                        >
                            Pending Review ({kpis.pending})
                        </button>
                        <button
                            type="button"
                            aria-pressed={filterStatus === 'approved'}
                            onClick={() => setFilterStatus('approved')}
                            className={cn(
                                'inline-flex min-h-8 items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                filterStatus === 'approved'
                                    ? 'border border-brand/40 bg-brand-soft font-semibold text-brand-strong'
                                    : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                            )}
                        >
                            Approved ({kpis.approved})
                        </button>
                        <button
                            type="button"
                            aria-pressed={filterStatus === 'logged'}
                            onClick={() => setFilterStatus('logged')}
                            className={cn(
                                'inline-flex min-h-8 items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                filterStatus === 'logged'
                                    ? 'border border-success/40 bg-success-soft font-semibold text-success-strong'
                                    : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                            )}
                        >
                            Logged ({kpis.logged})
                        </button>
                        <button
                            type="button"
                            aria-pressed={filterStatus === 'anomalies'}
                            onClick={() => setFilterStatus('anomalies')}
                            className={cn(
                                'inline-flex min-h-8 items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                filterStatus === 'anomalies'
                                    ? 'border border-danger/40 bg-danger-soft font-semibold text-danger-strong'
                                    : kpis.anomalies > 0
                                      ? 'border border-danger/30 bg-danger-soft text-danger-strong hover:bg-danger-soft/80'
                                      : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                            )}
                        >
                            ⚠️ Anomalies ({kpis.anomalies})
                        </button>
                    </div>

                    <label className="relative block sm:w-64">
                        <span className="sr-only">Search fuel requests</span>
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search reference, asset, purpose…"
                            className="h-8 w-full rounded-lg border border-line bg-surface-subtle pr-3 pl-9 text-xs placeholder:text-ink-soft"
                        />
                    </label>
                </div>

                {/* Request Cards List */}
                {requests.length === 0 ? (
                    <Panel className="p-8 text-center sm:p-12">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong shadow-xs">
                            <Fuel className="h-7 w-7" />
                        </div>
                        <h3 className="mt-4 text-base font-bold text-ink">
                            Fleet Fuel Telematics &amp; Authorizations
                        </h3>
                        <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
                            All mobile equipment refuel requests are governed by
                            asset baseline burn-rate limits. Field requests move
                            through canonical authorization steps before station
                            disbursement.
                        </p>
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
                    <ul className="space-y-3">
                        {filteredRequests.map((req) => (
                            <FuelRequestCard
                                key={req.id}
                                request={req}
                                capabilities={capabilities}
                                onRecordLog={(r) => setLogModalRequest(r)}
                                onTransition={handleTransition}
                                pendingActionId={pendingActionId}
                            />
                        ))}
                    </ul>
                )}
            </div>

            {/* Modal for recording fuel log with monotonic validation and receipt upload */}
            <FuelLogModal
                isOpen={logModalRequest !== null}
                onClose={() => setLogModalRequest(null)}
                request={logModalRequest}
            />
        </div>
    );
}
