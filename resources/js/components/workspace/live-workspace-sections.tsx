import { router, useForm } from '@inertiajs/react';
import { Bot, Fuel, ShieldCheck, Truck, Users } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { TrackingSurface } from '@/components/surfaces/tracking-surfaces';
import {
    Button,
    EmptyState,
    PageHeading,
    Panel,
    Skeleton,
} from '@/components/ui';
import { ArchiveSurface } from '@/components/workspace/archive-workspace-section';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { NotificationsSurface } from '@/components/workspace/notifications-workspace-section';
import { ReportsSurface } from '@/components/workspace/reports-workspace-section';
import { cn } from '@/lib/utils';
import type {
    ApprovalViewModel,
    ArchivedJobViewModel,
    AssetViewModel,
    AuditEventViewModel,
    FuelRequestViewModel,
    JobReportViewModel,
    LocationUpdateViewModel,
    NotificationViewModel,
    WorkspaceCapabilities,
    WorkspaceSection,
    WorkspaceUserViewModel,
} from '@/types/workspace';

export function LiveWorkspaceSection({
    section,
    assets,
    fuelRequests,
    locations,
    approvals,
    users,
    auditEvents,
    capabilities,
    jobReports = [],
    notifications = [],
    archivedJobs = [],
}: {
    section: Exclude<WorkspaceSection, 'dispatch'>;
    assets: AssetViewModel[];
    fuelRequests: FuelRequestViewModel[];
    locations: LocationUpdateViewModel[];
    approvals: ApprovalViewModel[];
    users: WorkspaceUserViewModel[];
    auditEvents: AuditEventViewModel[];
    capabilities: WorkspaceCapabilities;
    jobReports?: JobReportViewModel[];
    notifications?: NotificationViewModel[];
    archivedJobs?: ArchivedJobViewModel[];
}) {
    switch (section) {
        case 'assets':
            return (
                <AssetsSurface assets={assets} capabilities={capabilities} />
            );
        case 'fuel':
            return (
                <FuelSurface
                    requests={fuelRequests}
                    capabilities={capabilities}
                />
            );
        case 'tracking':
            return (
                <TrackingSurface
                    locations={locations}
                    capabilities={capabilities}
                />
            );
        case 'approvals':
            return (
                <ApprovalsSurface
                    approvals={approvals}
                    canDecide={capabilities.decide_approval}
                />
            );
        case 'reports':
            return (
                <ReportsSurface
                    reports={jobReports}
                    capabilities={capabilities}
                />
            );
        case 'notifications':
            return <NotificationsSurface notifications={notifications} />;
        case 'archive':
            return (
                <ArchiveSurface
                    jobs={archivedJobs}
                    capabilities={capabilities}
                />
            );
        case 'users':
            return <UsersSurface users={users} />;
        case 'audit':
            return <AuditSurface events={auditEvents} />;
    }
}

function AssetsSurface({
    assets,
    capabilities,
}: {
    assets: AssetViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(
        assets.length > 0 ? assets[0].id : null,
    );
    const [showRegisterForm, setShowRegisterForm] = useState(false);

    const selectedAsset =
        assets.find((a) => a.id === selectedAssetId) ?? assets[0];

    return (
        <div>
            <PageHeading
                title="Fleet and equipment"
                description="Manage asset registration, readiness status, specifications, safety inspections, and maintenance work orders."
            />
            <div className="space-y-6 p-4 md:p-6">
                {capabilities.register_asset && (
                    <div className="flex justify-end">
                        <Button
                            variant={showRegisterForm ? 'secondary' : 'primary'}
                            onClick={() =>
                                setShowRegisterForm(!showRegisterForm)
                            }
                        >
                            {showRegisterForm
                                ? 'Cancel registration'
                                : 'Register new asset'}
                        </Button>
                    </div>
                )}

                {showRegisterForm && capabilities.register_asset && (
                    <RegisterAssetForm
                        onDone={() => setShowRegisterForm(false)}
                    />
                )}

                {assets.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Truck}
                            title="No assets available"
                            message="Assigned or organization-wide fleet and equipment will appear here once registered or assigned to your role."
                        />
                    </Panel>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-12">
                        <div className="lg:col-span-5 xl:col-span-4">
                            <Panel className="overflow-hidden">
                                <div className="border-b border-line px-4 py-3 font-semibold text-ink">
                                    Operational assets ({assets.length})
                                </div>
                                <ul className="divide-y divide-line">
                                    {assets.map((asset) => {
                                        const isSelected =
                                            asset.id === selectedAsset?.id;

                                        return (
                                            <li key={asset.id}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedAssetId(
                                                            asset.id,
                                                        )
                                                    }
                                                    className={cn(
                                                        'w-full px-4 py-3 text-left transition-colors hover:bg-surface-subtle',
                                                        isSelected &&
                                                            'bg-brand-soft/60',
                                                    )}
                                                    aria-pressed={isSelected}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-semibold text-ink">
                                                            {asset.code}
                                                        </span>
                                                        <CanonicalStatusBadge
                                                            status={
                                                                asset.status
                                                            }
                                                        />
                                                    </div>
                                                    <p className="mt-1 text-sm font-medium text-ink-soft">
                                                        {asset.name}
                                                    </p>
                                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                                                        <span>
                                                            {humanize(
                                                                asset.kind,
                                                            )}
                                                        </span>
                                                        <span>·</span>
                                                        <span>
                                                            {asset.location ??
                                                                'Location not set'}
                                                        </span>
                                                        {asset.blocking_work_orders_count >
                                                            0 && (
                                                            <>
                                                                <span>·</span>
                                                                <span className="font-medium text-danger">
                                                                    {
                                                                        asset.blocking_work_orders_count
                                                                    }{' '}
                                                                    blocking
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Panel>
                        </div>

                        <div className="lg:col-span-7 xl:col-span-8">
                            {selectedAsset && (
                                <AssetDetailPane
                                    asset={selectedAsset}
                                    capabilities={capabilities}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function RegisterAssetForm({ onDone }: { onDone: () => void }) {
    const form = useForm({
        code: '',
        name: '',
        kind: 'truck',
        subtype: '',
        registration_number: '',
        manufacturer: '',
        model: '',
        rated_capacity: '',
        capacity_unit: 'tonnes',
        meter_type: 'odometer',
        meter_value: '',
        location: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/operations/assets', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onDone();
            },
        });
    };

    return (
        <Panel className="p-4 md:p-6">
            <h3 className="text-base font-semibold text-ink">
                Register Operational Asset
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
                Add a new truck, vehicle, crane, or piece of heavy equipment to
                the unified asset model.
            </p>
            <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <FuelInput
                        label="Asset code *"
                        value={form.data.code}
                        error={form.errors.code}
                        onChange={(v) => form.setData('code', v)}
                    />
                    <FuelInput
                        label="Asset name *"
                        value={form.data.name}
                        error={form.errors.name}
                        onChange={(v) => form.setData('name', v)}
                    />
                    <label className="text-sm font-medium text-ink">
                        Asset kind *
                        <select
                            value={form.data.kind}
                            onChange={(e) =>
                                form.setData('kind', e.target.value)
                            }
                            className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3"
                        >
                            <option value="truck">Truck</option>
                            <option value="vehicle">Vehicle</option>
                            <option value="crane">Crane</option>
                            <option value="equipment">Equipment</option>
                        </select>
                    </label>
                    <FuelInput
                        label="Subtype (e.g. Flatbed, All-Terrain)"
                        value={form.data.subtype}
                        error={form.errors.subtype}
                        onChange={(v) => form.setData('subtype', v)}
                    />
                    <FuelInput
                        label="Registration number"
                        value={form.data.registration_number}
                        error={form.errors.registration_number}
                        onChange={(v) => form.setData('registration_number', v)}
                    />
                    <FuelInput
                        label="Manufacturer"
                        value={form.data.manufacturer}
                        error={form.errors.manufacturer}
                        onChange={(v) => form.setData('manufacturer', v)}
                    />
                    <FuelInput
                        label="Model"
                        value={form.data.model}
                        error={form.errors.model}
                        onChange={(v) => form.setData('model', v)}
                    />
                    <FuelInput
                        label="Rated capacity"
                        type="number"
                        value={form.data.rated_capacity}
                        error={form.errors.rated_capacity}
                        onChange={(v) => form.setData('rated_capacity', v)}
                    />
                    <FuelInput
                        label="Capacity unit"
                        value={form.data.capacity_unit}
                        error={form.errors.capacity_unit}
                        onChange={(v) => form.setData('capacity_unit', v)}
                    />
                    <FuelInput
                        label="Meter type (odometer/hour_meter)"
                        value={form.data.meter_type}
                        error={form.errors.meter_type}
                        onChange={(v) => form.setData('meter_type', v)}
                    />
                    <FuelInput
                        label="Meter reading"
                        type="number"
                        value={form.data.meter_value}
                        error={form.errors.meter_value}
                        onChange={(v) => form.setData('meter_value', v)}
                    />
                    <FuelInput
                        label="Initial location"
                        value={form.data.location}
                        error={form.errors.location}
                        onChange={(v) => form.setData('location', v)}
                    />
                </div>

                <div className="flex justify-end gap-3 border-t border-line pt-4">
                    <Button type="button" variant="secondary" onClick={onDone}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={form.processing}
                    >
                        {form.processing ? 'Registering…' : 'Register asset'}
                    </Button>
                </div>
            </form>
        </Panel>
    );
}

function AssetDetailPane({
    asset,
    capabilities,
}: {
    asset: AssetViewModel;
    capabilities: WorkspaceCapabilities;
}) {
    const [activeTab, setActiveTab] = useState<
        'overview' | 'status' | 'inspections' | 'maintenance'
    >('overview');

    return (
        <Panel className="space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xl font-bold text-ink">
                            {asset.code}
                        </span>
                        <CanonicalStatusBadge status={asset.status} />
                        {asset.is_dispatchable ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-strong">
                                Ready for dispatch
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-strong">
                                Safety hold / Non-dispatchable
                            </span>
                        )}
                    </div>
                    <h2 className="mt-1 text-lg font-semibold text-ink">
                        {asset.name}
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-soft">
                        {humanize(asset.kind)}{' '}
                        {asset.subtype ? `· ${asset.subtype}` : ''} · Location:{' '}
                        {asset.location ?? 'Not reported'}
                    </p>
                </div>
            </div>

            <div className="flex border-b border-line">
                <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    className={cn(
                        'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                        activeTab === 'overview'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    Specifications & metrics
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('status')}
                    className={cn(
                        'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                        activeTab === 'status'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    Status management
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('inspections')}
                    className={cn(
                        'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                        activeTab === 'inspections'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    Inspections ({asset.inspections.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('maintenance')}
                    className={cn(
                        'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                        activeTab === 'maintenance'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    Work orders ({asset.maintenance_work_orders.length})
                </button>
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-4">
                    <dl className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                        <div className="rounded-lg bg-surface-subtle p-3">
                            <dt className="text-xs font-medium text-ink-soft">
                                Registration Number
                            </dt>
                            <dd className="mt-1 text-sm font-semibold">
                                {asset.registration_number ?? 'N/A'}
                            </dd>
                        </div>
                        <div className="rounded-lg bg-surface-subtle p-3">
                            <dt className="text-xs font-medium text-ink-soft">
                                Manufacturer & Model
                            </dt>
                            <dd className="mt-1 text-sm font-semibold">
                                {asset.manufacturer ?? 'N/A'}{' '}
                                {asset.model ?? ''}
                            </dd>
                        </div>
                        <div className="rounded-lg bg-surface-subtle p-3">
                            <dt className="text-xs font-medium text-ink-soft">
                                Rated Capacity
                            </dt>
                            <dd className="mt-1 text-sm font-semibold">
                                {asset.rated_capacity
                                    ? `${asset.rated_capacity} ${asset.capacity_unit ?? ''}`
                                    : 'N/A'}
                            </dd>
                        </div>
                        <div className="rounded-lg bg-surface-subtle p-3">
                            <dt className="text-xs font-medium text-ink-soft">
                                Meter Reading
                            </dt>
                            <dd className="mt-1 text-sm font-semibold">
                                {asset.meter_value
                                    ? `${asset.meter_value} (${asset.meter_type ?? 'units'})`
                                    : 'N/A'}
                            </dd>
                        </div>
                        <div className="rounded-lg bg-surface-subtle p-3">
                            <dt className="text-xs font-medium text-ink-soft">
                                Unresolved Safety Blocks
                            </dt>
                            <dd className="mt-1 text-sm font-semibold">
                                {asset.blocking_work_orders_count > 0 ? (
                                    <span className="text-danger">
                                        {asset.blocking_work_orders_count} open
                                        orders
                                    </span>
                                ) : (
                                    <span className="text-success-strong">
                                        None
                                    </span>
                                )}
                            </dd>
                        </div>
                    </dl>

                    {Object.keys(asset.specifications ?? {}).length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-xs font-semibold text-ink-soft uppercase">
                                Custom Specifications
                            </h4>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {Object.entries(asset.specifications).map(
                                    ([key, val]) => (
                                        <div
                                            key={key}
                                            className="flex justify-between rounded border border-line px-3 py-1.5 text-sm"
                                        >
                                            <span className="font-medium capitalize">
                                                {humanize(key)}:
                                            </span>
                                            <span className="text-ink-soft">
                                                {String(val)}
                                            </span>
                                        </div>
                                    ),
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'status' && (
                <AssetStatusUpdateForm
                    asset={asset}
                    canUpdate={capabilities.update_asset_status}
                />
            )}

            {activeTab === 'inspections' && (
                <AssetInspectionsSection
                    asset={asset}
                    canInspect={capabilities.inspect_asset}
                />
            )}

            {activeTab === 'maintenance' && (
                <AssetMaintenanceSection
                    asset={asset}
                    canMaintain={capabilities.maintain_asset}
                />
            )}
        </Panel>
    );
}

function AssetStatusUpdateForm({
    asset,
    canUpdate,
}: {
    asset: AssetViewModel;
    canUpdate: boolean;
}) {
    const form = useForm({
        status: asset.status.value,
        reason: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(`/operations/assets/${asset.id}/status`, {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    if (!canUpdate) {
        return (
            <div className="rounded-lg bg-surface-subtle p-4 text-sm text-ink-soft">
                Your role does not have authorization to update status for this
                asset kind.
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="rounded-lg border border-line bg-surface-subtle p-3 text-xs text-ink-soft">
                <strong>Safety Rule:</strong> Transitioning to{' '}
                <span className="font-semibold">Ready for Service</span> or{' '}
                <span className="font-semibold">Available</span> requires a
                completed passing inspection and zero unreleased
                dispatch-blocking work orders.
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-ink">
                    Target status *
                    <select
                        value={form.data.status}
                        onChange={(e) =>
                            form.setData('status', e.target.value as any)
                        }
                        className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3"
                    >
                        <option value="available">Available</option>
                        <option value="ready_for_service">
                            Ready for Service
                        </option>
                        <option value="under_inspection">
                            Under Inspection
                        </option>
                        <option value="under_maintenance">
                            Under Maintenance
                        </option>
                        <option value="awaiting_parts">Awaiting Parts</option>
                        <option value="unavailable">Unavailable</option>
                    </select>
                </label>

                <FuelInput
                    label="Reason for status change *"
                    value={form.data.reason}
                    error={form.errors.reason}
                    onChange={(v) => form.setData('reason', v)}
                />
            </div>

            {form.errors.status && (
                <p className="text-xs font-medium text-danger">
                    {form.errors.status}
                </p>
            )}

            <div className="flex justify-end">
                <Button
                    type="submit"
                    variant="primary"
                    disabled={form.processing || !form.data.reason.trim()}
                >
                    {form.processing ? 'Updating…' : 'Update asset status'}
                </Button>
            </div>
        </form>
    );
}

function AssetInspectionsSection({
    asset,
    canInspect,
}: {
    asset: AssetViewModel;
    canInspect: boolean;
}) {
    const [showForm, setShowForm] = useState(false);
    const form = useForm({
        type: 'safety',
        result: 'passed',
        checklist: {
            brakes: true,
            steering: true,
            tires_or_tracks: true,
            hydraulics: true,
            lights_and_signals: true,
        } as Record<string, boolean>,
        findings: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(`/operations/assets/${asset.id}/inspections`, {
            preserveScroll: true,
            onSuccess: () => {
                setShowForm(false);
                form.reset();
            },
        });
    };

    return (
        <div className="space-y-4">
            {canInspect && (
                <div className="flex justify-end">
                    <Button
                        variant={showForm ? 'secondary' : 'primary'}
                        onClick={() => setShowForm(!showForm)}
                    >
                        {showForm
                            ? 'Cancel inspection'
                            : 'Record new inspection'}
                    </Button>
                </div>
            )}

            {showForm && canInspect && (
                <form
                    onSubmit={submit}
                    className="space-y-4 rounded-lg border border-line bg-surface-subtle p-4"
                    noValidate
                >
                    <h4 className="font-semibold text-ink">
                        Submit Safety / Pre-Op Inspection
                    </h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-medium text-ink">
                            Inspection type
                            <select
                                value={form.data.type}
                                onChange={(e) =>
                                    form.setData('type', e.target.value as any)
                                }
                                className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3"
                            >
                                <option value="pre_operation">
                                    Pre-operation
                                </option>
                                <option value="post_operation">
                                    Post-operation
                                </option>
                                <option value="maintenance">Maintenance</option>
                                <option value="safety">Safety</option>
                            </select>
                        </label>
                        <label className="text-sm font-medium text-ink">
                            Result *
                            <select
                                value={form.data.result}
                                onChange={(e) =>
                                    form.setData(
                                        'result',
                                        e.target.value as any,
                                    )
                                }
                                className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3"
                            >
                                <option value="passed">Passed</option>
                                <option value="failed">
                                    Failed (Moves to Under Inspection)
                                </option>
                                <option value="conditional">
                                    Conditional (Moves to Under Inspection)
                                </option>
                            </select>
                        </label>
                    </div>

                    <div>
                        <span className="text-xs font-semibold text-ink-soft uppercase">
                            Inspection Checklist
                        </span>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            {Object.entries(form.data.checklist).map(
                                ([key, val]) => (
                                    <label
                                        key={key}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={val}
                                            onChange={(e) =>
                                                form.setData('checklist', {
                                                    ...form.data.checklist,
                                                    [key]: e.target.checked,
                                                })
                                            }
                                            className="h-4 w-4 rounded border-line-strong text-brand-strong"
                                        />
                                        <span>{humanize(key)}</span>
                                    </label>
                                ),
                            )}
                        </div>
                    </div>

                    <FuelInput
                        label="Findings / Remarks"
                        value={form.data.findings}
                        error={form.errors.findings}
                        onChange={(v) => form.setData('findings', v)}
                    />

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={form.processing}
                        >
                            {form.processing
                                ? 'Submitting…'
                                : 'Save inspection record'}
                        </Button>
                    </div>
                </form>
            )}

            {asset.inspections.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-soft">
                    No inspections recorded for this asset yet.
                </p>
            ) : (
                <ul className="divide-y divide-line">
                    {asset.inspections.map((ins) => (
                        <li key={ins.id} className="py-3">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-ink capitalize">
                                    {humanize(ins.type)} inspection
                                </span>
                                <span
                                    className={cn(
                                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                                        ins.result === 'passed'
                                            ? 'bg-success-soft text-success-strong'
                                            : 'bg-danger-soft text-danger',
                                    )}
                                >
                                    {ins.result.toUpperCase()}
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-ink-soft">
                                Completed: {formatDateTime(ins.completed_at)}
                            </p>
                            {ins.findings && (
                                <p className="mt-1 text-sm text-ink-soft">
                                    {ins.findings}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function AssetMaintenanceSection({
    asset,
    canMaintain,
}: {
    asset: AssetViewModel;
    canMaintain: boolean;
}) {
    const [showOpenForm, setShowOpenForm] = useState(false);
    const [releasingOrderId, setReleasingOrderId] = useState<number | null>(
        null,
    );

    const openForm = useForm({
        defect: '',
        dispatch_blocking: true,
        remarks: '',
    });

    const releaseForm = useForm({
        work_performed: '',
        parts: '',
        remarks: '',
    });

    const submitOpen = (e: FormEvent) => {
        e.preventDefault();
        openForm.post(`/operations/assets/${asset.id}/maintenance`, {
            preserveScroll: true,
            onSuccess: () => {
                setShowOpenForm(false);
                openForm.reset();
            },
        });
    };

    const submitRelease = (e: FormEvent, orderId: number) => {
        e.preventDefault();
        releaseForm.transform((data) => ({
            work_performed: data.work_performed
                .split('\n')
                .filter((line) => line.trim() !== ''),
            parts: data.parts
                .split(',')
                .map((p) => p.trim())
                .filter((p) => p !== ''),
            remarks: data.remarks,
        }));
        releaseForm.post(`/operations/maintenance/${orderId}/release`, {
            preserveScroll: true,
            onSuccess: () => {
                setReleasingOrderId(null);
                releaseForm.reset();
            },
        });
    };

    return (
        <div className="space-y-4">
            {canMaintain && (
                <div className="flex justify-end">
                    <Button
                        variant={showOpenForm ? 'secondary' : 'primary'}
                        onClick={() => setShowOpenForm(!showOpenForm)}
                    >
                        {showOpenForm
                            ? 'Cancel work order'
                            : 'Open maintenance work order'}
                    </Button>
                </div>
            )}

            {showOpenForm && canMaintain && (
                <form
                    onSubmit={submitOpen}
                    className="space-y-4 rounded-lg border border-line bg-surface-subtle p-4"
                    noValidate
                >
                    <h4 className="font-semibold text-ink">
                        Open Maintenance Work Order
                    </h4>
                    <FuelInput
                        label="Defect description *"
                        value={openForm.data.defect}
                        error={openForm.errors.defect}
                        onChange={(v) => openForm.setData('defect', v)}
                    />
                    <label className="flex items-center gap-2 text-sm font-medium text-ink">
                        <input
                            type="checkbox"
                            checked={openForm.data.dispatch_blocking}
                            onChange={(e) =>
                                openForm.setData(
                                    'dispatch_blocking',
                                    e.target.checked,
                                )
                            }
                            className="h-4 w-4 rounded border-line-strong text-brand-strong"
                        />
                        <span>
                            Dispatch Blocking (Asset cannot be assigned or
                            activated until released)
                        </span>
                    </label>
                    <FuelInput
                        label="Remarks / Parts needed"
                        value={openForm.data.remarks}
                        error={openForm.errors.remarks}
                        onChange={(v) => openForm.setData('remarks', v)}
                    />
                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={
                                openForm.processing ||
                                !openForm.data.defect.trim()
                            }
                        >
                            {openForm.processing
                                ? 'Opening…'
                                : 'Create work order'}
                        </Button>
                    </div>
                </form>
            )}

            {asset.maintenance_work_orders.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-soft">
                    No maintenance work orders recorded for this asset.
                </p>
            ) : (
                <ul className="divide-y divide-line">
                    {asset.maintenance_work_orders.map((order) => {
                        const isUnreleased = !order.released_at;
                        const isReleasingThis = releasingOrderId === order.id;

                        return (
                            <li key={order.id} className="space-y-2 py-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-ink">
                                            {order.defect}
                                        </span>
                                        {order.dispatch_blocking && (
                                            <span className="rounded bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                                                Blocking
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-ink-soft">
                                        {order.released_at
                                            ? `Released: ${formatDateTime(order.released_at)}`
                                            : 'Open / In progress'}
                                    </span>
                                </div>

                                {order.work_performed.length > 0 && (
                                    <p className="text-xs text-ink-soft">
                                        Work performed:{' '}
                                        {order.work_performed.join('; ')}
                                    </p>
                                )}
                                {order.parts.length > 0 && (
                                    <p className="text-xs text-ink-soft">
                                        Parts used: {order.parts.join(', ')}
                                    </p>
                                )}

                                {isUnreleased && canMaintain && (
                                    <div className="pt-2">
                                        {!isReleasingThis ? (
                                            <Button
                                                variant="secondary"
                                                onClick={() =>
                                                    setReleasingOrderId(
                                                        order.id,
                                                    )
                                                }
                                            >
                                                Release work order
                                            </Button>
                                        ) : (
                                            <form
                                                onSubmit={(e) =>
                                                    submitRelease(e, order.id)
                                                }
                                                className="mt-2 space-y-3 rounded-lg border border-line bg-surface-subtle p-3"
                                                noValidate
                                            >
                                                <div className="rounded bg-warning-soft p-2 text-xs font-medium text-warning-strong">
                                                    Notice: Releasing requires a
                                                    passing safety inspection
                                                    completed after this order
                                                    was created.
                                                </div>
                                                <label className="text-sm font-medium text-ink">
                                                    Work performed * (One task
                                                    per line)
                                                    <textarea
                                                        rows={2}
                                                        value={
                                                            releaseForm.data
                                                                .work_performed
                                                        }
                                                        onChange={(e) =>
                                                            releaseForm.setData(
                                                                'work_performed',
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="mt-1 w-full rounded-lg border border-line-strong bg-surface p-2 text-sm"
                                                    />
                                                </label>
                                                <FuelInput
                                                    label="Parts used (comma separated)"
                                                    value={
                                                        releaseForm.data.parts
                                                    }
                                                    onChange={(v) =>
                                                        releaseForm.setData(
                                                            'parts',
                                                            v,
                                                        )
                                                    }
                                                />
                                                {(
                                                    releaseForm.errors as Record<
                                                        string,
                                                        string
                                                    >
                                                ).inspection && (
                                                    <p className="text-xs font-semibold text-danger">
                                                        {
                                                            (
                                                                releaseForm.errors as Record<
                                                                    string,
                                                                    string
                                                                >
                                                            ).inspection
                                                        }
                                                    </p>
                                                )}
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={() =>
                                                            setReleasingOrderId(
                                                                null,
                                                            )
                                                        }
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        type="submit"
                                                        variant="primary"
                                                        disabled={
                                                            releaseForm.processing
                                                        }
                                                    >
                                                        {releaseForm.processing
                                                            ? 'Releasing…'
                                                            : 'Confirm release'}
                                                    </Button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function FuelSurface({
    requests,
    capabilities,
}: {
    requests: FuelRequestViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [activeLogId, setActiveLogId] = useState<number | null>(null);
    const [decisionReason, setDecisionReason] = useState<
        Record<number, string>
    >({});

    const form = useForm({
        quantity_litres: '',
        fuel_type: 'diesel',
        purpose: '',
    });
    const formComplete =
        form.data.quantity_litres.trim() !== '' &&
        form.data.purpose.trim() !== '';

    const logForm = useForm({
        quantity_litres: '',
        odometer_km: '',
        hour_meter: '',
        price_per_litre: '',
        total_cost: '',
        fuel_station: '',
        remarks: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/operations/fuel-requests', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    const transition = (requestId: number, status: string, reason?: string) => {
        const actionId = `${requestId}:${status}`;
        router.post(
            `/operations/fuel-requests/${requestId}/status`,
            { status, reason },
            {
                preserveScroll: true,
                onStart: () => setPendingAction(actionId),
                onFinish: () => setPendingAction(null),
            },
        );
    };

    const submitLog = (event: FormEvent, request: FuelRequestViewModel) => {
        event.preventDefault();
        const actionId = `${request.id}:logged`;
        logForm.transform((data) => ({
            ...data,
            status: 'logged',
            quantity_litres: data.quantity_litres || request.quantity_litres,
        }));
        logForm.post(`/operations/fuel-requests/${request.id}/status`, {
            preserveScroll: true,
            onStart: () => setPendingAction(actionId),
            onFinish: () => {
                setPendingAction(null);
                setActiveLogId(null);
                logForm.reset();
            },
        });
    };

    return (
        <div>
            <PageHeading
                title="Fuel operations"
                description="Requests move through the canonical submitted, forwarded, approved, verified, and logged workflow."
            />
            <div className="space-y-5 p-4 md:p-6">
                {capabilities.request_fuel && (
                    <Panel className="p-4">
                        <h2 className="font-semibold">Submit fuel request</h2>
                        <p className="mt-1 text-sm text-ink-soft">
                            The request remains scoped to its authenticated
                            requester.
                        </p>
                        <form
                            onSubmit={submit}
                            className="mt-4 grid gap-4 md:grid-cols-[12rem_12rem_minmax(16rem,1fr)_auto]"
                            noValidate
                        >
                            <FuelInput
                                label="Litres"
                                type="number"
                                value={form.data.quantity_litres}
                                error={form.errors.quantity_litres}
                                onChange={(value) =>
                                    form.setData('quantity_litres', value)
                                }
                            />
                            <label className="text-sm font-medium">
                                Fuel type
                                <select
                                    value={form.data.fuel_type}
                                    onChange={(event) =>
                                        form.setData(
                                            'fuel_type',
                                            event.target.value,
                                        )
                                    }
                                    className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3"
                                >
                                    <option value="diesel">Diesel</option>
                                    <option value="gasoline">Gasoline</option>
                                </select>
                            </label>
                            <FuelInput
                                label="Purpose"
                                value={form.data.purpose}
                                error={form.errors.purpose}
                                onChange={(value) =>
                                    form.setData('purpose', value)
                                }
                            />
                            <div className="flex flex-col justify-end">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={form.processing || !formComplete}
                                >
                                    {form.processing
                                        ? 'Submitting…'
                                        : 'Submit request'}
                                </Button>
                            </div>
                        </form>
                    </Panel>
                )}

                <Panel className="overflow-hidden">
                    {requests.length === 0 ? (
                        <EmptyState
                            icon={Fuel}
                            title="No fuel requests available"
                            message={
                                capabilities.request_fuel
                                    ? 'Submit a request above when fuel is required for assigned work.'
                                    : 'Requests visible to your role will appear here.'
                            }
                        />
                    ) : (
                        <ul className="divide-y divide-line">
                            {requests.map((request) => {
                                const nextAction = getFuelAction(
                                    request,
                                    capabilities,
                                );
                                const actionId = nextAction
                                    ? `${request.id}:${nextAction.status}`
                                    : null;
                                const isLoggingThis =
                                    activeLogId === request.id;

                                return (
                                    <li
                                        key={request.id}
                                        className="flex flex-col gap-4 px-4 py-4"
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold">
                                                        {request.reference}
                                                    </p>
                                                    <CanonicalStatusBadge
                                                        status={request.status}
                                                    />
                                                </div>
                                                <p className="mt-1 text-sm text-ink-soft">
                                                    {request.quantity_litres} L
                                                    ·{' '}
                                                    {humanize(
                                                        request.fuel_type,
                                                    )}{' '}
                                                    · {request.purpose}
                                                </p>
                                                <p className="mt-1 text-xs text-ink-soft">
                                                    Requested by{' '}
                                                    {request.requester.name}
                                                    {request.asset
                                                        ? ` · Asset: ${request.asset.code}`
                                                        : ''}
                                                    {request.job
                                                        ? ` · Job: ${request.job.reference}`
                                                        : ''}
                                                </p>
                                                {request.decision_reason && (
                                                    <p className="mt-1 text-xs text-ink-soft italic">
                                                        Reason:{' '}
                                                        {
                                                            request.decision_reason
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {nextAction &&
                                                    nextAction.status ===
                                                        'approved' &&
                                                    capabilities.approve_fuel && (
                                                        <>
                                                            <Button
                                                                variant="secondary"
                                                                onClick={() =>
                                                                    transition(
                                                                        request.id,
                                                                        'approved',
                                                                        decisionReason[
                                                                            request
                                                                                .id
                                                                        ],
                                                                    )
                                                                }
                                                                disabled={
                                                                    pendingAction !==
                                                                    null
                                                                }
                                                            >
                                                                {pendingAction ===
                                                                `${request.id}:approved`
                                                                    ? 'Approving…'
                                                                    : 'Approve'}
                                                            </Button>
                                                            <Button
                                                                variant="danger"
                                                                onClick={() =>
                                                                    transition(
                                                                        request.id,
                                                                        'rejected',
                                                                        decisionReason[
                                                                            request
                                                                                .id
                                                                        ],
                                                                    )
                                                                }
                                                                disabled={
                                                                    pendingAction !==
                                                                    null
                                                                }
                                                            >
                                                                {pendingAction ===
                                                                `${request.id}:rejected`
                                                                    ? 'Rejecting…'
                                                                    : 'Reject'}
                                                            </Button>
                                                        </>
                                                    )}
                                                {nextAction &&
                                                    nextAction.status ===
                                                        'logged' &&
                                                    capabilities.record_fuel &&
                                                    !isLoggingThis && (
                                                        <Button
                                                            variant="secondary"
                                                            onClick={() => {
                                                                setActiveLogId(
                                                                    request.id,
                                                                );
                                                                logForm.setData(
                                                                    'quantity_litres',
                                                                    request.quantity_litres,
                                                                );
                                                            }}
                                                        >
                                                            Record fuel log
                                                        </Button>
                                                    )}
                                                {nextAction &&
                                                    nextAction.status !==
                                                        'approved' &&
                                                    nextAction.status !==
                                                        'logged' &&
                                                    actionId && (
                                                        <Button
                                                            variant="secondary"
                                                            onClick={() =>
                                                                transition(
                                                                    request.id,
                                                                    nextAction.status,
                                                                )
                                                            }
                                                            disabled={
                                                                pendingAction !==
                                                                null
                                                            }
                                                        >
                                                            {pendingAction ===
                                                            actionId
                                                                ? `${nextAction.label}…`
                                                                : nextAction.label}
                                                        </Button>
                                                    )}
                                            </div>
                                        </div>

                                        {nextAction &&
                                            nextAction.status === 'approved' &&
                                            capabilities.approve_fuel && (
                                                <div className="mt-2">
                                                    <label
                                                        htmlFor={`fuel-decision-reason-${request.id}`}
                                                        className="sr-only"
                                                    >
                                                        Decision reason for{' '}
                                                        {request.reference}
                                                    </label>
                                                    <input
                                                        id={`fuel-decision-reason-${request.id}`}
                                                        type="text"
                                                        placeholder="Decision reason (optional for approval, recommended for rejection)"
                                                        value={
                                                            decisionReason[
                                                                request.id
                                                            ] || ''
                                                        }
                                                        onChange={(e) =>
                                                            setDecisionReason({
                                                                ...decisionReason,
                                                                [request.id]:
                                                                    e.target
                                                                        .value,
                                                            })
                                                        }
                                                        className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-xs"
                                                    />
                                                </div>
                                            )}

                                        {isLoggingThis && (
                                            <Panel className="mt-3 bg-surface-subtle p-4">
                                                <h3 className="text-sm font-semibold">
                                                    Record final fuel log
                                                </h3>
                                                <form
                                                    onSubmit={(e) =>
                                                        submitLog(e, request)
                                                    }
                                                    className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3"
                                                >
                                                    <FuelInput
                                                        label="Litres"
                                                        type="number"
                                                        value={
                                                            logForm.data
                                                                .quantity_litres
                                                        }
                                                        onChange={(val) =>
                                                            logForm.setData(
                                                                'quantity_litres',
                                                                val,
                                                            )
                                                        }
                                                    />
                                                    <FuelInput
                                                        label="Odometer (km)"
                                                        type="number"
                                                        value={
                                                            logForm.data
                                                                .odometer_km
                                                        }
                                                        onChange={(val) =>
                                                            logForm.setData(
                                                                'odometer_km',
                                                                val,
                                                            )
                                                        }
                                                    />
                                                    <FuelInput
                                                        label="Hour meter"
                                                        type="number"
                                                        value={
                                                            logForm.data
                                                                .hour_meter
                                                        }
                                                        onChange={(val) =>
                                                            logForm.setData(
                                                                'hour_meter',
                                                                val,
                                                            )
                                                        }
                                                    />
                                                    <FuelInput
                                                        label="Price / Litre"
                                                        type="number"
                                                        value={
                                                            logForm.data
                                                                .price_per_litre
                                                        }
                                                        onChange={(val) =>
                                                            logForm.setData(
                                                                'price_per_litre',
                                                                val,
                                                            )
                                                        }
                                                    />
                                                    <FuelInput
                                                        label="Fuel Station"
                                                        value={
                                                            logForm.data
                                                                .fuel_station
                                                        }
                                                        onChange={(val) =>
                                                            logForm.setData(
                                                                'fuel_station',
                                                                val,
                                                            )
                                                        }
                                                    />
                                                    <FuelInput
                                                        label="Remarks"
                                                        value={
                                                            logForm.data.remarks
                                                        }
                                                        onChange={(val) =>
                                                            logForm.setData(
                                                                'remarks',
                                                                val,
                                                            )
                                                        }
                                                    />
                                                    <div className="col-span-full flex items-center justify-end gap-2 pt-2">
                                                        <Button
                                                            type="button"
                                                            variant="quiet"
                                                            onClick={() =>
                                                                setActiveLogId(
                                                                    null,
                                                                )
                                                            }
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            type="submit"
                                                            variant="primary"
                                                            disabled={
                                                                logForm.processing
                                                            }
                                                        >
                                                            {logForm.processing
                                                                ? 'Saving log…'
                                                                : 'Submit fuel log'}
                                                        </Button>
                                                    </div>
                                                </form>
                                            </Panel>
                                        )}

                                        {request.logs &&
                                            request.logs.length > 0 && (
                                                <div className="mt-2 space-y-1 rounded-lg border border-line bg-surface-subtle p-3 text-xs">
                                                    <p className="font-semibold text-ink">
                                                        Fuel Log Details:
                                                    </p>
                                                    {request.logs.map((log) => (
                                                        <div
                                                            key={log.id}
                                                            className="grid grid-cols-2 gap-2 text-ink-soft sm:grid-cols-4"
                                                        >
                                                            <span>
                                                                <strong>
                                                                    Quantity:
                                                                </strong>{' '}
                                                                {
                                                                    log.quantity_litres
                                                                }{' '}
                                                                L
                                                            </span>
                                                            <span>
                                                                <strong>
                                                                    Station:
                                                                </strong>{' '}
                                                                {log.fuel_station ||
                                                                    'N/A'}
                                                            </span>
                                                            <span>
                                                                <strong>
                                                                    Cost:
                                                                </strong>{' '}
                                                                {log.total_cost
                                                                    ? `$${log.total_cost}`
                                                                    : 'N/A'}
                                                            </span>
                                                            <span>
                                                                <strong>
                                                                    Recorded by:
                                                                </strong>{' '}
                                                                {log.recorded_by
                                                                    ?.name ||
                                                                    'N/A'}
                                                            </span>
                                                            {log.odometer_km !==
                                                                null && (
                                                                <span>
                                                                    <strong>
                                                                        Odometer:
                                                                    </strong>{' '}
                                                                    {
                                                                        log.odometer_km
                                                                    }{' '}
                                                                    km
                                                                </span>
                                                            )}
                                                            {log.hour_meter !==
                                                                null && (
                                                                <span>
                                                                    <strong>
                                                                        Hours:
                                                                    </strong>{' '}
                                                                    {
                                                                        log.hour_meter
                                                                    }
                                                                </span>
                                                            )}
                                                            {log.remarks && (
                                                                <span className="col-span-2">
                                                                    <strong>
                                                                        Remarks:
                                                                    </strong>{' '}
                                                                    {
                                                                        log.remarks
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Panel>
            </div>
        </div>
    );
}

function ApprovalsSurface({
    approvals,
    canDecide,
}: {
    approvals: ApprovalViewModel[];
    canDecide: boolean;
}) {
    return (
        <div>
            <PageHeading
                title="Pending approvals"
                description="Review the requester, job plan, schedule, and proposed resources before recording an independent decision."
            />
            <div className="p-4 md:p-6">
                {approvals.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={ShieldCheck}
                            title="No approvals need attention"
                            message="Exceptional changes awaiting an independent decision will appear here."
                        />
                    </Panel>
                ) : (
                    <div className="grid gap-4 xl:grid-cols-2">
                        {approvals.map((approval) => (
                            <ApprovalReviewCard
                                key={approval.id}
                                approval={approval}
                                canDecide={canDecide && approval.can_decide}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ApprovalReviewCard({
    approval,
    canDecide,
}: {
    approval: ApprovalViewModel;
    canDecide: boolean;
}) {
    const form = useForm<{
        status: 'approved' | 'rejected';
        reason: string;
        approval?: string;
        version?: string;
        personnel?: string;
        assets?: string;
    }>({
        status: 'approved',
        reason: '',
    });
    const [pendingDecision, setPendingDecision] = useState<
        'approved' | 'rejected' | null
    >(null);
    const reasonId = `approval-${approval.id}-reason`;
    const errorId = `${reasonId}-error`;
    const personnel = approval.requested_changes.personnel;
    const assets = approval.requested_changes.assets;
    const endedPersonnel = approval.requested_changes.ended_personnel;
    const endedAssets = approval.requested_changes.ended_assets;
    const approvalError =
        form.errors.approval ??
        form.errors.version ??
        form.errors.personnel ??
        form.errors.assets ??
        null;

    const decide = (status: 'approved' | 'rejected') => {
        form.transform((data) => ({ ...data, status }));
        form.post(`/operations/approval-requests/${approval.id}/decision`, {
            preserveScroll: true,
            onStart: () => setPendingDecision(status),
            onFinish: () => setPendingDecision(null),
        });
    };

    return (
        <Panel className="overflow-hidden">
            <div className="border-b border-line px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            {approval.subject.priority && (
                                <CanonicalStatusBadge
                                    status={approval.subject.priority}
                                />
                            )}
                            <CanonicalStatusBadge status={approval.status} />
                        </div>
                        <h2 className="mt-2 font-semibold">
                            {approval.subject.title ??
                                approval.subject.reference}
                        </h2>
                        <p className="mt-1 text-sm text-ink-soft">
                            {approval.subject.reference} · Requested by{' '}
                            {approval.requester.name}
                        </p>
                    </div>
                    <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-soft">
                        {humanize(approval.kind)}
                    </span>
                </div>
            </div>

            <div className="space-y-4 px-4 py-4">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                        <dt className="text-xs font-medium text-ink-soft">
                            Schedule
                        </dt>
                        <dd className="mt-1 font-medium">
                            {formatDateTime(approval.subject.scheduled_start)} –{' '}
                            {formatDateTime(approval.subject.scheduled_end)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs font-medium text-ink-soft">
                            Site
                        </dt>
                        <dd className="mt-1 font-medium">
                            {approval.subject.site ?? 'Not recorded'}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs font-medium text-ink-soft">
                            Dispatch state
                        </dt>
                        <dd className="mt-1 flex flex-wrap items-center gap-2">
                            {approval.subject.status && (
                                <CanonicalStatusBadge
                                    status={approval.subject.status}
                                />
                            )}
                            {approval.subject.version !== null && (
                                <span className="text-xs text-ink-soft">
                                    Version {approval.subject.version}
                                </span>
                            )}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs font-medium text-ink-soft">
                            Requested
                        </dt>
                        <dd className="mt-1 font-medium">
                            {formatDateTime(approval.created_at)}
                        </dd>
                    </div>
                </dl>

                {approval.subject.site_notes?.trim() && (
                    <div className="rounded-lg bg-surface-subtle p-3">
                        <p className="text-xs font-semibold">Site note</p>
                        <p className="mt-1 text-sm leading-6 text-ink-soft">
                            {approval.subject.site_notes}
                        </p>
                    </div>
                )}

                <div>
                    <h3 className="text-sm font-semibold">
                        Proposed resource changes
                    </h3>
                    {endedPersonnel.length > 0 && (
                        <div className="mt-2">
                            <p className="text-xs font-medium text-ink-soft">
                                Ending active personnel assignments
                            </p>
                            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                                {endedPersonnel.map((person) => (
                                    <li
                                        key={`ended-personnel-${person.id}`}
                                        className="rounded-lg border border-line px-3 py-2 text-sm"
                                    >
                                        <p className="font-medium">
                                            {person.name}
                                        </p>
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            {humanize(person.assignment_type)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {endedAssets.length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs font-medium text-ink-soft">
                                Ending active asset assignments
                            </p>
                            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                                {endedAssets.map((asset) => (
                                    <li
                                        key={`ended-asset-${asset.id}`}
                                        className="rounded-lg border border-line px-3 py-2 text-sm"
                                    >
                                        <p className="font-medium">
                                            {asset.code} · {asset.name}
                                        </p>
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            {humanize(asset.assignment_type)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {personnel.length > 0 || assets.length > 0 ? (
                        <div className="mt-3">
                            <p className="text-xs font-medium text-ink-soft">
                                Adding replacement resources
                            </p>
                            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                                {personnel.map((person) => (
                                    <li
                                        key={`personnel-${person.id}`}
                                        className="rounded-lg border border-line px-3 py-2 text-sm"
                                    >
                                        <p className="font-medium">
                                            {person.name}
                                        </p>
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            {humanize(person.assignment_type)}
                                        </p>
                                    </li>
                                ))}
                                {assets.map((asset) => (
                                    <li
                                        key={`asset-${asset.id}`}
                                        className="rounded-lg border border-line px-3 py-2 text-sm"
                                    >
                                        <p className="font-medium">
                                            {asset.code} · {asset.name}
                                        </p>
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            {humanize(asset.assignment_type)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : endedPersonnel.length === 0 &&
                      endedAssets.length === 0 ? (
                        <p className="mt-2 text-sm text-ink-soft">
                            This request covers dispatch activation without a
                            new resource batch.
                        </p>
                    ) : null}
                </div>

                {canDecide ? (
                    <div className="border-t border-line pt-4">
                        {approvalError && (
                            <div
                                className="mb-3 rounded-lg border border-danger bg-danger-soft px-3 py-3 text-sm text-danger"
                                role="alert"
                            >
                                {approvalError}
                            </div>
                        )}
                        <label
                            htmlFor={reasonId}
                            className="text-sm font-medium"
                        >
                            Decision reason
                        </label>
                        <p className="mt-1 text-xs text-ink-soft">
                            Required for both approval and rejection. This
                            reason becomes part of the audit history.
                        </p>
                        <textarea
                            id={reasonId}
                            value={form.data.reason}
                            onChange={(event) =>
                                form.setData('reason', event.target.value)
                            }
                            rows={3}
                            required
                            maxLength={2000}
                            aria-invalid={
                                form.errors.reason ? 'true' : undefined
                            }
                            aria-describedby={
                                form.errors.reason ? errorId : undefined
                            }
                            className={cn(
                                'mt-2 w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm',
                                form.errors.reason
                                    ? 'border-danger'
                                    : 'border-line-strong',
                            )}
                        />
                        {form.errors.reason && (
                            <p
                                id={errorId}
                                className="mt-1 text-xs text-danger"
                                role="alert"
                            >
                                {form.errors.reason}
                            </p>
                        )}
                        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                                variant="danger"
                                onClick={() => decide('rejected')}
                                disabled={
                                    form.processing ||
                                    form.data.reason.trim().length === 0
                                }
                            >
                                {form.processing &&
                                pendingDecision === 'rejected'
                                    ? 'Rejecting…'
                                    : 'Reject request'}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => decide('approved')}
                                disabled={
                                    form.processing ||
                                    form.data.reason.trim().length === 0
                                }
                            >
                                {form.processing &&
                                pendingDecision === 'approved'
                                    ? 'Approving…'
                                    : 'Approve request'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div
                        className="rounded-lg border border-warning bg-warning-soft px-3 py-3 text-sm text-warning-strong"
                        role="status"
                    >
                        <p className="font-semibold">
                            Independent review needed
                        </p>
                        <p className="mt-1">
                            {approval.decision_blocker ??
                                'Another authorized manager must decide this request.'}
                        </p>
                    </div>
                )}
            </div>
        </Panel>
    );
}

function UsersSurface({ users }: { users: WorkspaceUserViewModel[] }) {
    return (
        <div>
            <PageHeading
                title="Users and roles"
                description="Operational users receive one canonical role; this Phase 1 surface is intentionally read-only."
            />
            <div className="p-4 md:p-6">
                {users.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Users}
                            title="No users available"
                            message="Operational users will appear after an administrator adds them."
                        />
                    </Panel>
                ) : (
                    <ResponsiveTable
                        headers={['Name', 'Email', 'Role', 'Status']}
                        rows={users.map((user) => ({
                            key: user.id,
                            cells: [
                                <span className="font-semibold">
                                    {user.name}
                                </span>,
                                user.email,
                                user.role_label ?? 'Unassigned',
                                <span
                                    className={
                                        user.is_active
                                            ? 'text-success-strong'
                                            : 'text-danger'
                                    }
                                >
                                    {user.is_active ? 'Active' : 'Suspended'}
                                </span>,
                            ],
                        }))}
                    />
                )}
            </div>
        </div>
    );
}

function AuditSurface({ events }: { events: AuditEventViewModel[] }) {
    return (
        <div>
            <PageHeading
                title="Audit trail"
                description="Approvals, overrides, state changes, and access decisions remain attributable."
            />
            <div className="p-4 md:p-6">
                {events.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Bot}
                            title="No audit events recorded"
                            message="Sensitive operational and access changes will appear here."
                        />
                    </Panel>
                ) : (
                    <ResponsiveTable
                        headers={['Time', 'Actor', 'Action', 'Reason']}
                        rows={events.map((event) => ({
                            key: event.id,
                            cells: [
                                formatDateTime(event.occurred_at),
                                event.actor?.name ?? 'System',
                                humanize(event.action),
                                event.reason ?? 'No reason recorded',
                            ],
                        }))}
                    />
                )}
            </div>
        </div>
    );
}

function ResponsiveTable({
    headers,
    rows,
}: {
    headers: string[];
    rows: Array<{ key: number; cells: ReactNode[] }>;
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="divide-y divide-line md:hidden">
                {rows.map((row) => (
                    <dl key={row.key} className="space-y-2 px-4 py-3">
                        {row.cells.map((cell, index) => (
                            <div
                                key={headers[index]}
                                className="grid grid-cols-[minmax(7rem,0.7fr)_minmax(0,1fr)] gap-3 text-sm"
                            >
                                <dt className="text-ink-soft">
                                    {headers[index]}
                                </dt>
                                <dd className="min-w-0 text-right text-ink">
                                    {cell}
                                </dd>
                            </div>
                        ))}
                    </dl>
                ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface-subtle text-ink-soft">
                        <tr>
                            {headers.map((header) => (
                                <th
                                    key={header}
                                    scope="col"
                                    className="px-4 py-3 font-medium"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.key} className="border-t border-line">
                                {row.cells.map((cell, index) => (
                                    <td
                                        key={headers[index]}
                                        className="px-4 py-3"
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function FuelInput({
    label,
    value,
    onChange,
    error,
    type = 'text',
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
}) {
    return (
        <label className="text-sm font-medium">
            {label}
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? 'true' : undefined}
                className={cn(
                    'mt-1 h-11 w-full rounded-lg border bg-surface px-3',
                    error ? 'border-danger' : 'border-line-strong',
                )}
            />
            {error && (
                <span className="mt-1 block text-xs text-danger">{error}</span>
            )}
        </label>
    );
}

function getFuelAction(
    request: FuelRequestViewModel,
    capabilities: WorkspaceCapabilities,
) {
    if (capabilities.forward_fuel && request.status.value === 'submitted') {
        return { status: 'forwarded', label: 'Forward request' };
    }

    if (capabilities.approve_fuel && request.status.value === 'forwarded') {
        return { status: 'approved', label: 'Approve request' };
    }

    if (capabilities.verify_fuel && request.status.value === 'approved') {
        return { status: 'verified', label: 'Verify request' };
    }

    if (capabilities.record_fuel && request.status.value === 'verified') {
        return { status: 'logged', label: 'Record fuel log' };
    }

    return null;
}

function humanize(value: string) {
    return value.replaceAll('_', ' ');
}

function formatDateTime(value: string | null) {
    if (value === null) {
        return 'Not recorded';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export function AssetListSkeleton() {
    return (
        <div className="space-y-px" aria-label="Loading operational assets">
            {[1, 2, 3, 4].map((item) => (
                <div key={item} className="border-b border-line px-4 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                    <Skeleton className="mt-2 h-3.5 w-36" />
                    <Skeleton className="mt-2 h-3 w-28" />
                </div>
            ))}
        </div>
    );
}

export function FuelTableSkeleton() {
    return (
        <div
            className="divide-y divide-line"
            aria-label="Loading fuel requests"
        >
            {[1, 2, 3, 4].map((item) => (
                <div
                    key={item}
                    className="flex items-center justify-between p-4"
                >
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3.5 w-48" />
                    </div>
                    <Skeleton className="h-6 w-24 rounded-full" />
                </div>
            ))}
        </div>
    );
}
