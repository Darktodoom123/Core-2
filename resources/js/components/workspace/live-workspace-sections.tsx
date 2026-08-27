import { router, useForm } from '@inertiajs/react';
import {
    Award,
    Bot,
    Check,
    CheckCircle2,
    Compass,
    Copy,
    Download,
    FileText,
    Fuel,
    Key,
    MapPin,
    Navigation,
    Radio,
    ShieldAlert,
    Trash2,
    Truck,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ApprovalsSurface } from '@/components/approvals';
import {
    Button,
    EmptyState,
    PageHeading,
    Panel,
    Skeleton,
} from '@/components/ui';
import { ArchiveSurface } from '@/components/workspace/archive-workspace-section';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { GptRecommendationsSurface } from '@/components/workspace/gpt-workspace-section';
import { NotificationsSurface } from '@/components/workspace/notifications-workspace-section';
import { ReportsSurface } from '@/components/workspace/reports-workspace-section';
import { formatDateTime, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    ApprovalViewModel,
    ArchivedJobViewModel,
    AssetViewModel,
    AuditEventViewModel,
    DispatchJobViewModel,
    FuelRequestViewModel,
    GptRecommendationViewModel,
    JobReportViewModel,
    LocationUpdateViewModel,
    NotificationViewModel,
    ReportExportViewModel,
    SosIncidentViewModel,
    WorkspaceCapabilities,
    WorkspaceSection,
    WorkspaceUserViewModel,
} from '@/types/workspace';

const LiveTrackingMap = lazy(() =>
    import('@/components/live-tracking-map').then(
        ({ LiveTrackingMap: Map }) => ({ default: Map }),
    ),
);

function AssetMapLoadingFallback({ compact = false }: { compact?: boolean }) {
    return (
        <div
            className={cn(
                'flex items-center justify-center rounded-2xl border border-line bg-surface-subtle p-6 text-center',
                compact ? 'h-[360px] md:h-[420px]' : 'h-[560px] lg:h-[620px]',
            )}
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading live location map"
        >
            <p className="text-sm text-ink-soft">Loading live location map…</p>
        </div>
    );
}

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
    reportExports = [],
    notifications = [],
    archivedJobs = [],
    gptRecommendations = [],
    jobs = [],
    activeSosIncidents,
    onSectionChange,
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
    reportExports?: ReportExportViewModel[];
    notifications?: NotificationViewModel[];
    archivedJobs?: ArchivedJobViewModel[];
    gptRecommendations?: GptRecommendationViewModel[];
    jobs?: DispatchJobViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    onSectionChange?: (section: WorkspaceSection) => void;
}) {
    switch (section) {
        case 'assets':
            return (
                <AssetsSurface
                    assets={assets}
                    locations={locations}
                    activeSosIncidents={activeSosIncidents}
                    capabilities={capabilities}
                    onSectionChange={onSectionChange}
                />
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
                <AssetsSurface
                    assets={assets}
                    locations={locations}
                    activeSosIncidents={activeSosIncidents}
                    capabilities={capabilities}
                    onSectionChange={onSectionChange}
                    initialViewMode="map"
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
                    exports={reportExports}
                    jobs={jobs}
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
        case 'gpt-recommendations':
            return (
                <GptRecommendationsSurface
                    recommendations={gptRecommendations}
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
    locations = [],
    activeSosIncidents = [],
    capabilities,
    onSectionChange,
    initialViewMode = 'list',
}: {
    assets: AssetViewModel[];
    locations?: LocationUpdateViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    capabilities: WorkspaceCapabilities;
    onSectionChange?: (section: WorkspaceSection) => void;
    initialViewMode?: 'list' | 'map';
}) {
    const [viewMode, setViewMode] = useState<'list' | 'map'>(initialViewMode);
    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(
        assets.length > 0 ? assets[0].id : null,
    );

    const selectedAsset =
        assets.find((a) => a.id === selectedAssetId) ?? assets[0];

    const selectedAssetLocation = useMemo(
        () =>
            selectedAsset
                ? (locations.find((l) => l.asset?.id === selectedAsset.id) ??
                  null)
                : null,
        [locations, selectedAsset],
    );

    const activeLiveGpsCount = useMemo(
        () =>
            locations.filter(
                (l) =>
                    l.latitude !== null &&
                    l.longitude !== null &&
                    (l.freshness_status === 'fresh' ||
                        l.freshness_status === 'delayed'),
            ).length,
        [locations],
    );

    return (
        <div>
            <PageHeading
                title="Fleet Management"
                description="Core 3 assets, live GPS telematics, readiness status, specifications, safety inspections, and maintenance work orders."
            />
            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex rounded-lg border border-line bg-surface-subtle p-1 shadow-xs">
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={cn(
                                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                                viewMode === 'list'
                                    ? 'bg-surface text-ink shadow-xs'
                                    : 'text-ink-soft hover:text-ink',
                            )}
                        >
                            <Truck className="h-3.5 w-3.5" />
                            Asset registry ({assets.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('map')}
                            className={cn(
                                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                                viewMode === 'map'
                                    ? 'bg-surface text-brand-strong shadow-xs'
                                    : 'text-ink-soft hover:text-ink',
                            )}
                        >
                            <MapPin className="h-3.5 w-3.5" />
                            Fleet map view
                            {activeLiveGpsCount > 0 && (
                                <span className="py-0.2 inline-flex items-center rounded-full bg-brand-soft px-1.5 text-[10px] font-bold text-brand-strong">
                                    {activeLiveGpsCount} live
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {assets.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Truck}
                            title="No assets available"
                            message="Assets received from Core 3 or assigned to your role will appear here."
                        />
                    </Panel>
                ) : viewMode === 'map' ? (
                    <Panel className="space-y-4 overflow-hidden p-4 md:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                            <div>
                                <h3 className="text-base font-semibold text-ink">
                                    Live Fleet Telematics & GIS Map
                                </h3>
                                <p className="text-xs text-ink-soft">
                                    Real-time positional tracking and telemetry
                                    across visible fleet assets and units.
                                </p>
                            </div>
                            {onSectionChange && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onSectionChange('tracking')}
                                >
                                    <Compass className="mr-1.5 h-3.5 w-3.5" />
                                    Open operations tracking
                                </Button>
                            )}
                        </div>
                        <Suspense
                            fallback={
                                <AssetMapLoadingFallback compact={false} />
                            }
                        >
                            <LiveTrackingMap
                                locations={locations}
                                activeSosIncidents={activeSosIncidents}
                                compact={false}
                                showLocationList={true}
                            />
                        </Suspense>
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
                                        const matchingLoc = locations.find(
                                            (l) => l.asset?.id === asset.id,
                                        );
                                        const hasLiveGps =
                                            matchingLoc &&
                                            matchingLoc.latitude !== null &&
                                            matchingLoc.longitude !== null;

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
                                                        {hasLiveGps ? (
                                                            <span className="inline-flex items-center gap-1 font-semibold text-brand-strong">
                                                                <Radio className="h-3 w-3 animate-pulse text-success-strong" />
                                                                GPS Live
                                                                {matchingLoc.speed !==
                                                                    null &&
                                                                matchingLoc.speed >
                                                                    0
                                                                    ? ` (${matchingLoc.speed} km/h)`
                                                                    : ''}
                                                            </span>
                                                        ) : (
                                                            <span>
                                                                {asset.location ??
                                                                    'Location not set'}
                                                            </span>
                                                        )}
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
                                    assetLocation={selectedAssetLocation}
                                    activeSosIncidents={activeSosIncidents}
                                    capabilities={capabilities}
                                    onViewFullTracking={() =>
                                        setViewMode('map')
                                    }
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function AssetDetailPane({
    asset,
    assetLocation,
    activeSosIncidents = [],
    capabilities,
    onViewFullTracking,
}: {
    asset: AssetViewModel;
    assetLocation?: LocationUpdateViewModel | null;
    activeSosIncidents?: SosIncidentViewModel[];
    capabilities: WorkspaceCapabilities;
    onViewFullTracking?: () => void;
}) {
    const [activeTab, setActiveTab] = useState<
        'overview' | 'telemetry' | 'status' | 'inspections' | 'maintenance'
    >('overview');

    const [showLockdownModal, setShowLockdownModal] = useState(false);
    const [lockdownReason, setLockdownReason] = useState('');
    const [lockingDown, setLockingDown] = useState(false);
    const [lockdownError, setLockdownError] = useState<string | null>(null);

    const hasLiveGps =
        assetLocation &&
        assetLocation.latitude !== null &&
        assetLocation.longitude !== null;

    const handleSafetyLockdown = async (e: FormEvent) => {
        e.preventDefault();
        setLockingDown(true);
        setLockdownError(null);

        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        try {
            const response = await fetch(
                `/operations/admin/assets/${asset.id}/safety-lockdown`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify({ reason: lockdownReason }),
                },
            );

            const data = await response.json();

            if (!response.ok) {
                setLockdownError(
                    data.message || 'Failed to place asset on safety lockdown.',
                );
                setLockingDown(false);

                return;
            }

            setShowLockdownModal(false);
            setLockdownReason('');
            setLockingDown(false);
            router.reload();
        } catch {
            setLockdownError('Network error while applying safety lockdown.');
            setLockingDown(false);
        }
    };

    return (
        <Panel className="space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xl font-bold text-ink">
                            {asset.code}
                        </span>
                        <CanonicalStatusBadge status={asset.status} />
                        {hasLiveGps && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong">
                                <Radio className="h-3 w-3 animate-pulse text-success-strong" />
                                Live GPS active
                            </span>
                        )}
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
                        {hasLiveGps
                            ? `GPS ${assetLocation.latitude?.toFixed(4)}, ${assetLocation.longitude?.toFixed(4)}`
                            : (asset.location ?? 'Not reported')}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {asset.status.value !== 'unavailable' && (
                        <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setShowLockdownModal(true)}
                            title="Place asset under emergency safety recall lockdown"
                        >
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Safety Lockdown
                        </Button>
                    )}
                </div>
            </div>

            {/* Safety Lockdown Modal */}
            {showLockdownModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-strong">
                                <ShieldAlert className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-ink">
                                    Fleet Safety Recall Lockdown
                                </h3>
                                <p className="text-xs text-ink-soft">
                                    Asset: {asset.code} ({asset.name})
                                </p>
                            </div>
                        </div>

                        {lockdownError && (
                            <div className="mt-3 rounded-lg bg-danger-soft p-3 text-xs font-medium text-danger-strong">
                                {lockdownError}
                            </div>
                        )}

                        <p className="mt-3 text-xs leading-5 text-ink-soft">
                            Safety lockdown immediately revokes assignment
                            eligibility for this equipment, ends any active
                            dispatch assignment, and marks the unit{' '}
                            <strong>Unavailable</strong>.
                        </p>

                        <form
                            onSubmit={handleSafetyLockdown}
                            className="mt-4 space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Mandatory Safety Recall Reason *
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    minLength={6}
                                    value={lockdownReason}
                                    onChange={(e) =>
                                        setLockdownReason(e.target.value)
                                    }
                                    placeholder="Specify safety defect, hydraulic fault, structural crack, or regulatory recall notice…"
                                    className="mt-1 w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink placeholder:text-ink-soft focus:border-danger focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 border-t border-line pt-2">
                                <Button
                                    variant="quiet"
                                    onClick={() => setShowLockdownModal(false)}
                                    disabled={lockingDown}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    type="submit"
                                    disabled={lockingDown}
                                >
                                    {lockingDown
                                        ? 'Applying…'
                                        : 'Enforce Safety Lockdown'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap border-b border-line">
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
                    onClick={() => setActiveTab('telemetry')}
                    className={cn(
                        'flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                        activeTab === 'telemetry'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    <MapPin className="h-4 w-4" />
                    Live GPS & Telemetry
                    {hasLiveGps && (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-success-strong" />
                    )}
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

            {activeTab === 'telemetry' && (
                <AssetTelemetrySection
                    asset={asset}
                    location={assetLocation}
                    activeSosIncidents={activeSosIncidents}
                    onViewFullTracking={onViewFullTracking}
                />
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

function AssetTelemetrySection({
    asset,
    location,
    activeSosIncidents = [],
    onViewFullTracking,
}: {
    asset: AssetViewModel;
    location?: LocationUpdateViewModel | null;
    activeSosIncidents?: SosIncidentViewModel[];
    onViewFullTracking?: () => void;
}) {
    const hasGps =
        location && location.latitude !== null && location.longitude !== null;

    if (!hasGps) {
        return (
            <div className="space-y-4">
                <div className="rounded-xl border border-line bg-surface-subtle/70 p-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                        <MapPin className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-ink">
                        No Active Live GPS Stream
                    </h3>
                    <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
                        This vehicle is not currently broadcasting live GPS
                        coordinates. Its registered yard or depot location is:
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink">
                        <Navigation className="h-4 w-4 text-brand-strong" />
                        <span>
                            {asset.location ??
                                'Depot yard location not specified'}
                        </span>
                    </div>
                    <p className="mx-auto mt-4 max-w-lg text-xs text-ink-soft">
                        Real-time GPS telemetry streams automatically when an
                        operator or driver starts an active dispatch assignment
                        with this unit using the field mobile app.
                    </p>
                    {onViewFullTracking && (
                        <div className="mt-5 flex justify-center">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onViewFullTracking}
                            >
                                <Compass className="mr-1.5 h-4 w-4" />
                                View Fleet Map
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg bg-surface-subtle p-3">
                    <dt className="text-xs font-medium text-ink-soft">
                        Coordinates (Lat, Lng)
                    </dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-ink">
                        {location.latitude?.toFixed(5)},{' '}
                        {location.longitude?.toFixed(5)}
                    </dd>
                </div>
                <div className="rounded-lg bg-surface-subtle p-3">
                    <dt className="text-xs font-medium text-ink-soft">
                        Current Speed
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-ink">
                        {location.speed !== null && location.speed > 0 ? (
                            <span className="font-bold text-brand-strong">
                                {location.speed} km/h
                            </span>
                        ) : (
                            <span className="text-ink-soft">
                                0 km/h (Stationary)
                            </span>
                        )}
                    </dd>
                </div>
                <div className="rounded-lg bg-surface-subtle p-3">
                    <dt className="text-xs font-medium text-ink-soft">
                        Signal Freshness
                    </dt>
                    <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                        <span
                            className={cn(
                                'h-2 w-2 rounded-full',
                                location.freshness_status === 'fresh' &&
                                    'animate-pulse bg-success-strong',
                                location.freshness_status === 'delayed' &&
                                    'bg-warning-strong',
                                location.freshness_status === 'stale' &&
                                    'bg-amber-500',
                                location.freshness_status === 'offline' &&
                                    'bg-slate-400',
                            )}
                        />
                        <span className="capitalize">
                            {humanize(location.freshness_status)}
                        </span>
                    </dd>
                </div>
                <div className="rounded-lg bg-surface-subtle p-3">
                    <dt className="text-xs font-medium text-ink-soft">
                        Assigned Operator / Driver
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-ink">
                        {location.user?.name ?? 'Unassigned'}
                    </dd>
                </div>
                <div className="rounded-lg bg-surface-subtle p-3">
                    <dt className="text-xs font-medium text-ink-soft">
                        Active Dispatch Job
                    </dt>
                    <dd className="mt-1 truncate text-sm font-semibold text-ink">
                        {location.job ? (
                            <a
                                href={`/operations/dispatch-jobs/${location.job.id}`}
                                className="inline-flex items-center gap-1 text-brand-strong hover:underline"
                            >
                                <span>{location.job.reference}</span>
                                <span className="max-w-[120px] truncate text-xs font-normal text-ink-soft">
                                    ({location.job.title})
                                </span>
                            </a>
                        ) : (
                            <span className="font-normal text-ink-soft">
                                None (Standby)
                            </span>
                        )}
                    </dd>
                </div>
                <div className="rounded-lg bg-surface-subtle p-3">
                    <dt className="text-xs font-medium text-ink-soft">
                        Last Ping Received
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-ink">
                        {location.received_at
                            ? formatDateTime(location.received_at)
                            : 'N/A'}
                    </dd>
                </div>
            </dl>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                        Live Map Position
                    </h4>
                    {location.accuracy_metres !== null && (
                        <span className="text-xs text-ink-soft">
                            Accuracy: ±{location.accuracy_metres}m · Source:{' '}
                            {humanize(location.source)}
                        </span>
                    )}
                </div>
                <Suspense fallback={<AssetMapLoadingFallback compact={true} />}>
                    <LiveTrackingMap
                        locations={[location]}
                        activeSosIncidents={activeSosIncidents}
                        compact={true}
                        showLocationList={false}
                    />
                </Suspense>
            </div>

            {onViewFullTracking && (
                <div className="flex justify-end pt-1">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onViewFullTracking}
                    >
                        <Compass className="mr-1.5 h-4 w-4" />
                        View Fleet Map
                    </Button>
                </div>
            )}
        </div>
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
                                Completed:{' '}
                                {formatDateTime(
                                    ins.completed_at,
                                    'Not recorded',
                                )}
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
                                            ? `Released: ${formatDateTime(order.released_at, 'Not recorded')}`
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
    const [filterMode, setFilterMode] = useState<'all' | 'anomalies'>('all');
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

    const totalAnomalies = requests.reduce(
        (acc, req) =>
            acc + (req.logs?.filter((l) => l.is_anomaly)?.length ?? 0),
        0,
    );

    const filteredRequests =
        filterMode === 'anomalies'
            ? requests.filter((req) => req.logs?.some((l) => l.is_anomaly))
            : requests;

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

                {/* Filter and Overview Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setFilterMode('all')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                filterMode === 'all'
                                    ? 'bg-brand text-white shadow-sm'
                                    : 'border border-line-strong bg-surface text-ink-soft hover:bg-surface-subtle'
                            }`}
                        >
                            All Requests ({requests.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('anomalies')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                filterMode === 'anomalies'
                                    ? 'bg-danger text-white shadow-sm'
                                    : totalAnomalies > 0
                                      ? 'border border-danger/30 bg-danger-soft text-danger-strong hover:bg-danger-soft/80'
                                      : 'border border-line-strong bg-surface text-ink-soft hover:bg-surface-subtle'
                            }`}
                        >
                            ⚠️ Anomalies ({totalAnomalies})
                        </button>
                    </div>
                </div>

                <Panel className="overflow-hidden">
                    {filteredRequests.length === 0 ? (
                        <EmptyState
                            icon={Fuel}
                            title={
                                filterMode === 'anomalies'
                                    ? 'No fuel anomalies detected'
                                    : 'No fuel requests available'
                            }
                            message={
                                filterMode === 'anomalies'
                                    ? 'All recorded fuel consumption logs are within standard variance and burn rate baselines.'
                                    : capabilities.request_fuel
                                      ? 'Submit a request above when fuel is required for assigned work.'
                                      : 'Requests visible to your role will appear here.'
                            }
                        />
                    ) : (
                        <ul className="divide-y divide-line">
                            {filteredRequests.map((request) => {
                                const nextAction = getFuelAction(
                                    request,
                                    capabilities,
                                );
                                const actionId = nextAction
                                    ? `${request.id}:${nextAction.status}`
                                    : null;
                                const isLoggingThis =
                                    activeLogId === request.id;
                                const hasAnomaly = request.logs?.some(
                                    (l) => l.is_anomaly,
                                );

                                return (
                                    <li
                                        key={request.id}
                                        className={`flex flex-col gap-4 px-4 py-4 ${
                                            hasAnomaly
                                                ? 'bg-danger-soft/10'
                                                : ''
                                        }`}
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
                                                    {hasAnomaly && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-strong">
                                                            ⚠️ Anomaly
                                                        </span>
                                                    )}
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
                                                        ? ` · Asset: ${request.asset.code} (${request.asset.name ?? 'Equipment'})`
                                                        : ''}
                                                    {request.job
                                                        ? ` · Job: ${request.job.reference}`
                                                        : ''}
                                                    {request.asset
                                                        ?.baseline_burn_rate
                                                        ? ` · Baseline: ${request.asset.baseline_burn_rate} ${request.asset.burn_rate_unit ?? ''}`
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
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <h3 className="text-sm font-semibold">
                                                        Record final fuel log
                                                    </h3>
                                                    {request.asset && (
                                                        <span className="text-xs text-ink-soft">
                                                            Asset:{' '}
                                                            {request.asset.code}
                                                            {request.asset
                                                                .meter_value
                                                                ? ` · Current meter: ${request.asset.meter_value} ${
                                                                      request
                                                                          .asset
                                                                          .meter_type ===
                                                                      'hour_meter'
                                                                          ? 'hrs'
                                                                          : 'km'
                                                                  }`
                                                                : ''}
                                                        </span>
                                                    )}
                                                </div>
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
                                                        label={
                                                            request.asset
                                                                ?.meter_type ===
                                                            'hour_meter'
                                                                ? 'Hour meter (hrs)'
                                                                : 'Odometer (km)'
                                                        }
                                                        type="number"
                                                        value={
                                                            request.asset
                                                                ?.meter_type ===
                                                            'hour_meter'
                                                                ? logForm.data
                                                                      .hour_meter
                                                                : logForm.data
                                                                      .odometer_km
                                                        }
                                                        onChange={(val) =>
                                                            request.asset
                                                                ?.meter_type ===
                                                            'hour_meter'
                                                                ? logForm.setData(
                                                                      'hour_meter',
                                                                      val,
                                                                  )
                                                                : logForm.setData(
                                                                      'odometer_km',
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
                                                        label="Total Cost"
                                                        type="number"
                                                        value={
                                                            logForm.data
                                                                .total_cost
                                                        }
                                                        onChange={(val) =>
                                                            logForm.setData(
                                                                'total_cost',
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
                                                <div className="mt-2 space-y-2 rounded-lg border border-line bg-surface-subtle p-3 text-xs">
                                                    <div className="flex items-center justify-between">
                                                        <p className="font-semibold text-ink">
                                                            Fuel Log Details:
                                                        </p>
                                                    </div>
                                                    {request.logs.map((log) => (
                                                        <div
                                                            key={log.id}
                                                            className="space-y-2 rounded border border-line/60 bg-surface p-2.5"
                                                        >
                                                            <div className="grid grid-cols-2 gap-2 text-ink-soft sm:grid-cols-4">
                                                                <span>
                                                                    <strong>
                                                                        Actual:
                                                                    </strong>{' '}
                                                                    {
                                                                        log.quantity_litres
                                                                    }{' '}
                                                                    L
                                                                </span>
                                                                <span>
                                                                    <strong>
                                                                        Variance:
                                                                    </strong>{' '}
                                                                    <span
                                                                        className={
                                                                            log.is_anomaly
                                                                                ? 'font-semibold text-danger'
                                                                                : 'text-success'
                                                                        }
                                                                    >
                                                                        {log.variance_litres !==
                                                                        null
                                                                            ? `${Number(log.variance_litres) > 0 ? '+' : ''}${log.variance_litres} L (${Number(log.variance_percentage) > 0 ? '+' : ''}${log.variance_percentage}%)`
                                                                            : '0.00 L (0%)'}
                                                                    </span>
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
                                                                        Station:
                                                                    </strong>{' '}
                                                                    {log.fuel_station ||
                                                                        'N/A'}
                                                                </span>
                                                                {log.effective_burn_rate !==
                                                                    null && (
                                                                    <span>
                                                                        <strong>
                                                                            Burn
                                                                            Rate:
                                                                        </strong>{' '}
                                                                        {
                                                                            log.effective_burn_rate
                                                                        }{' '}
                                                                        {
                                                                            log.burn_rate_unit
                                                                        }
                                                                    </span>
                                                                )}
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
                                                                        }{' '}
                                                                        hrs
                                                                    </span>
                                                                )}
                                                                <span>
                                                                    <strong>
                                                                        Recorded
                                                                        by:
                                                                    </strong>{' '}
                                                                    {log
                                                                        .recorded_by
                                                                        ?.name ||
                                                                        'N/A'}
                                                                </span>
                                                            </div>

                                                            {log.is_anomaly && (
                                                                <div className="rounded border border-danger/25 bg-danger-soft/50 p-2 text-danger-strong">
                                                                    <div className="flex items-center gap-1 font-semibold">
                                                                        <span>
                                                                            ⚠️
                                                                            Fuel
                                                                            Consumption
                                                                            Anomaly
                                                                            Detected
                                                                        </span>
                                                                    </div>
                                                                    <p className="mt-0.5 text-xs text-danger-strong/90">
                                                                        {
                                                                            log.anomaly_reason
                                                                        }
                                                                    </p>
                                                                </div>
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

function UsersSurface({ users }: { users: WorkspaceUserViewModel[] }) {
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<
        'all' | 'active' | 'suspended'
    >('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [generatedPasswordInfo, setGeneratedPasswordInfo] = useState<{
        name: string;
        username: string;
        email: string;
        password: string;
    } | null>(null);
    const [selectedUserForAccess, setSelectedUserForAccess] =
        useState<WorkspaceUserViewModel | null>(null);
    const [selectedUserForCreds, setSelectedUserForCreds] =
        useState<WorkspaceUserViewModel | null>(null);
    const [passwordResetUser, setPasswordResetUser] =
        useState<WorkspaceUserViewModel | null>(null);

    // Form states for Invite User
    const [inviteName, setInviteName] = useState('');
    const [inviteUsername, setInviteUsername] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePhone, setInvitePhone] = useState('');
    const [inviteRole, setInviteRole] = useState('driver');
    const [generateTempPassword, setGenerateTempPassword] = useState(true);
    const [inviteSubmitting, setInviteSubmitting] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);

    // Form state for Access update
    const [editRole, setEditRole] = useState('');
    const [editActive, setEditActive] = useState(true);
    const [accessSubmitting, setAccessSubmitting] = useState(false);
    const [accessError, setAccessError] = useState<string | null>(null);

    // Form state for Credential creation
    const [credKind, setCredKind] = useState<
        'driver_license' | 'operator_certification' | 'qualification'
    >('operator_certification');
    const [credNumber, setCredNumber] = useState('');
    const [credType, setCredType] = useState('');
    const [credIssuedAt, setCredIssuedAt] = useState('');
    const [credExpiresAt, setCredExpiresAt] = useState('');
    const [credSubmitting, setCredSubmitting] = useState(false);
    const [credError, setCredError] = useState<string | null>(null);

    // Clipboard copy state
    const [copied, setCopied] = useState(false);

    const stats = useMemo(() => {
        const total = users.length;
        const active = users.filter((u) => u.is_active).length;
        const suspended = users.filter((u) => !u.is_active).length;
        const fieldPersonnel = users.filter((u) =>
            ['driver', 'crane_operator'].includes(u.role ?? ''),
        ).length;
        const expiringCredentials = users.reduce((count, u) => {
            return (
                count +
                (u.credentials?.filter((c) => c.expires_soon || c.is_expired)
                    .length ?? 0)
            );
        }, 0);

        return {
            total,
            active,
            suspended,
            fieldPersonnel,
            expiringCredentials,
        };
    }, [users]);

    const uniqueRoles = useMemo(() => {
        const roles = new Map<string, string>();
        users.forEach((u) => {
            if (u.role && u.role_label) {
                roles.set(u.role, u.role_label);
            }
        });

        return Array.from(roles.entries());
    }, [users]);

    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            if (statusFilter === 'active' && !user.is_active) {
                return false;
            }

            if (statusFilter === 'suspended' && user.is_active) {
                return false;
            }

            if (roleFilter !== 'all' && user.role !== roleFilter) {
                return false;
            }

            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase().trim();
                const name = user.name.toLowerCase();
                const email = user.email.toLowerCase();
                const role = (user.role_label ?? '').toLowerCase();
                const username = (user.username ?? '').toLowerCase();

                return (
                    name.includes(q) ||
                    email.includes(q) ||
                    role.includes(q) ||
                    username.includes(q)
                );
            }

            return true;
        });
    }, [users, roleFilter, statusFilter, searchQuery]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCreateUser = async (e: FormEvent) => {
        e.preventDefault();
        setInviteSubmitting(true);
        setInviteError(null);

        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        try {
            const response = await fetch('/operations/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    name: inviteName,
                    username:
                        inviteUsername ||
                        inviteName.toLowerCase().replace(/\s+/g, '.'),
                    email: inviteEmail,
                    phone: invitePhone || null,
                    role: inviteRole,
                    generate_temp_password: generateTempPassword,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setInviteError(
                    data.message ||
                        'Failed to create user. Please check your inputs.',
                );
                setInviteSubmitting(false);

                return;
            }

            setShowInviteModal(false);
            setInviteName('');
            setInviteUsername('');
            setInviteEmail('');
            setInvitePhone('');
            setInviteSubmitting(false);

            if (data.temporary_password) {
                setGeneratedPasswordInfo({
                    name: data.data.name,
                    username: data.data.username,
                    email: data.data.email,
                    password: data.temporary_password,
                });
            }

            router.reload({ only: ['users', 'auditEvents'] });
        } catch {
            setInviteError('Network error while provisioning user.');
            setInviteSubmitting(false);
        }
    };

    const handleUpdateAccess = async (e: FormEvent) => {
        e.preventDefault();

        if (!selectedUserForAccess) {
            return;
        }

        setAccessSubmitting(true);
        setAccessError(null);

        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        try {
            const response = await fetch(
                `/operations/users/${selectedUserForAccess.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify({
                        role: editRole,
                        is_active: editActive,
                    }),
                },
            );

            const data = await response.json();

            if (!response.ok) {
                setAccessError(data.message || 'Failed to update access.');
                setAccessSubmitting(false);

                return;
            }

            setSelectedUserForAccess(null);
            setAccessSubmitting(false);
            router.reload({ only: ['users', 'auditEvents'] });
        } catch {
            setAccessError('Network error while updating access.');
            setAccessSubmitting(false);
        }
    };

    const handleResetPassword = async () => {
        if (!passwordResetUser) {
            return;
        }

        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        try {
            const response = await fetch(
                `/operations/users/${passwordResetUser.id}/reset-password`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                },
            );

            const data = await response.json();

            if (response.ok && data.temporary_password) {
                setGeneratedPasswordInfo({
                    name: passwordResetUser.name,
                    username:
                        passwordResetUser.username ?? passwordResetUser.email,
                    email: passwordResetUser.email,
                    password: data.temporary_password,
                });
            }

            setPasswordResetUser(null);
            router.reload({ only: ['auditEvents'] });
        } catch {
            alert('Failed to reset password.');
        }
    };

    const handleAddCredential = async (e: FormEvent) => {
        e.preventDefault();

        if (!selectedUserForCreds) {
            return;
        }

        setCredSubmitting(true);
        setCredError(null);

        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        try {
            const response = await fetch(
                `/operations/users/${selectedUserForCreds.id}/credentials`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify({
                        kind: credKind,
                        credential_number: credNumber,
                        credential_type: credType,
                        issued_at: credIssuedAt || null,
                        expires_at: credExpiresAt || null,
                    }),
                },
            );

            const data = await response.json();

            if (!response.ok) {
                setCredError(data.message || 'Failed to add credential.');
                setCredSubmitting(false);

                return;
            }

            setCredNumber('');
            setCredType('');
            setCredIssuedAt('');
            setCredExpiresAt('');
            setCredSubmitting(false);
            router.reload({ only: ['users', 'auditEvents'] });
        } catch {
            setCredError('Network error while adding credential.');
            setCredSubmitting(false);
        }
    };

    const handleDeleteCredential = async (credId: number) => {
        if (!selectedUserForCreds) {
            return;
        }

        if (
            !confirm('Are you sure you want to remove this credential record?')
        ) {
            return;
        }

        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        try {
            await fetch(
                `/operations/users/${selectedUserForCreds.id}/credentials/${credId}`,
                {
                    method: 'DELETE',
                    headers: {
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                },
            );

            router.reload({ only: ['users', 'auditEvents'] });
        } catch {
            alert('Failed to remove credential.');
        }
    };

    return (
        <div>
            <PageHeading
                title="Users, roles & personnel credentials"
                description="Operational user administration with single canonical role enforcement, temporary password provisioning, and certified qualification governance."
                actions={
                    <Button
                        variant="primary"
                        onClick={() => setShowInviteModal(true)}
                    >
                        <UserPlus className="h-4 w-4" />
                        Provision User
                    </Button>
                }
            />

            <div className="space-y-6 p-4 md:p-6">
                {/* Stats Header Bar */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
                        <span className="text-xs font-medium text-ink-soft">
                            Total Users
                        </span>
                        <p className="mt-1 text-2xl font-bold text-ink">
                            {stats.total}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Canonical roles managed
                        </p>
                    </div>

                    <div className="rounded-xl border border-success/30 bg-success-soft/30 p-3.5 shadow-sm">
                        <span className="text-xs font-medium text-success-strong">
                            Active Accounts
                        </span>
                        <p className="mt-1 text-2xl font-bold text-success-strong">
                            {stats.active}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Operational readiness
                        </p>
                    </div>

                    <div className="rounded-xl border border-danger/30 bg-danger-soft/30 p-3.5 shadow-sm">
                        <span className="text-xs font-medium text-danger-strong">
                            Suspended
                        </span>
                        <p className="mt-1 text-2xl font-bold text-danger-strong">
                            {stats.suspended}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Access revoked
                        </p>
                    </div>

                    <div className="rounded-xl border border-warning/30 bg-warning-soft/30 p-3.5 shadow-sm">
                        <span className="text-xs font-medium text-warning-strong">
                            Compliance Alerts
                        </span>
                        <p className="mt-1 text-2xl font-bold text-warning-strong">
                            {stats.expiringCredentials}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Expired or expiring credentials
                        </p>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="space-y-3 border-b border-line pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Role Pills */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-ink-soft">
                                Role:
                            </span>
                            <button
                                type="button"
                                onClick={() => setRoleFilter('all')}
                                className={cn(
                                    'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                                    roleFilter === 'all'
                                        ? 'bg-brand-strong text-white shadow-xs'
                                        : 'bg-surface-subtle text-ink-soft hover:bg-surface-subtle/80 hover:text-ink',
                                )}
                            >
                                All Roles ({stats.total})
                            </button>
                            {uniqueRoles.map(
                                ([roleVal, roleName]: [string, string]) => {
                                    const count = users.filter(
                                        (u) => u.role === roleVal,
                                    ).length;

                                    return (
                                        <button
                                            key={roleVal}
                                            type="button"
                                            onClick={() =>
                                                setRoleFilter(roleVal)
                                            }
                                            className={cn(
                                                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                                                roleFilter === roleVal
                                                    ? 'bg-brand-strong text-white shadow-xs'
                                                    : 'bg-surface-subtle text-ink-soft hover:bg-surface-subtle/80 hover:text-ink',
                                            )}
                                        >
                                            {roleName} ({count})
                                        </button>
                                    );
                                },
                            )}
                        </div>

                        {/* Status Toggle */}
                        <div className="inline-flex rounded-lg border border-line p-0.5">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('all')}
                                className={cn(
                                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                    statusFilter === 'all'
                                        ? 'bg-brand-soft text-brand-strong'
                                        : 'text-ink-soft hover:text-ink',
                                )}
                            >
                                All
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('active')}
                                className={cn(
                                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                    statusFilter === 'active'
                                        ? 'bg-brand-soft text-brand-strong'
                                        : 'text-ink-soft hover:text-ink',
                                )}
                            >
                                Active ({stats.active})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('suspended')}
                                className={cn(
                                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                    statusFilter === 'suspended'
                                        ? 'bg-brand-soft text-brand-strong'
                                        : 'text-ink-soft hover:text-ink',
                                )}
                            >
                                Suspended ({stats.suspended})
                            </button>
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full sm:w-80">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, username, email, or role…"
                            className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                        />
                    </div>
                </div>

                {/* Users Table */}
                {users.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Users}
                            title="No users available"
                            message="Operational users will appear after an administrator adds them."
                        />
                    </Panel>
                ) : filteredUsers.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Users}
                            title="No matching users"
                            message="No users match the active role filter or search criteria."
                        />
                    </Panel>
                ) : (
                    <Panel className="overflow-hidden">
                        <div
                            className="workspace-scroll-region"
                            role="region"
                            aria-label="Users table scroll region"
                            tabIndex={0}
                        >
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-line bg-surface-subtle text-xs font-semibold text-ink-soft uppercase">
                                    <tr>
                                        <th className="px-4 py-3">
                                            User & Contact
                                        </th>
                                        <th className="px-4 py-3">
                                            Canonical Role
                                        </th>
                                        <th className="px-4 py-3">
                                            Qualifications & Credentials
                                        </th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {filteredUsers.map(
                                        (user: WorkspaceUserViewModel) => {
                                            const creds =
                                                user.credentials ?? [];
                                            const hasExpired = creds.some(
                                                (c) => c.is_expired,
                                            );
                                            const hasExpiring = creds.some(
                                                (c) => c.expires_soon,
                                            );

                                            return (
                                                <tr
                                                    key={user.id}
                                                    className="hover:bg-surface-subtle/50"
                                                >
                                                    <td className="px-4 py-3.5">
                                                        <span className="block font-semibold text-ink">
                                                            {user.name}
                                                        </span>
                                                        <span className="block text-xs text-ink-soft">
                                                            {user.email}{' '}
                                                            {user.phone &&
                                                                `· ${user.phone}`}
                                                        </span>
                                                        {user.username && (
                                                            <span className="mt-0.5 inline-block font-mono text-[11px] text-muted">
                                                                @{user.username}
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-3.5">
                                                        <span className="inline-flex items-center rounded-md bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-ink">
                                                            {user.role_label ??
                                                                'Unassigned'}
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-3.5 text-xs">
                                                        {creds.length === 0 ? (
                                                            <span className="text-ink-soft italic">
                                                                No credentials
                                                                on file
                                                            </span>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {creds.map(
                                                                    (cred) => (
                                                                        <span
                                                                            key={
                                                                                cred.id
                                                                            }
                                                                            className={cn(
                                                                                'inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium',
                                                                                cred.is_expired
                                                                                    ? 'bg-danger-soft text-danger-strong'
                                                                                    : cred.expires_soon
                                                                                      ? 'bg-warning-soft text-warning-strong'
                                                                                      : 'bg-brand-soft/60 text-brand-strong',
                                                                            )}
                                                                        >
                                                                            <Award className="h-3 w-3 shrink-0" />
                                                                            {
                                                                                cred.credential_type
                                                                            }
                                                                            {cred.expires_at &&
                                                                                ` (Exp: ${cred.expires_at})`}
                                                                        </span>
                                                                    ),
                                                                )}
                                                            </div>
                                                        )}
                                                        {(hasExpired ||
                                                            hasExpiring) && (
                                                            <p className="mt-1 text-[11px] font-medium text-danger-strong">
                                                                Action required:
                                                                License renewal
                                                                needed
                                                            </p>
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-3.5">
                                                        <span
                                                            className={cn(
                                                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                                                user.is_active
                                                                    ? 'bg-success-soft text-success-strong'
                                                                    : 'bg-danger-soft text-danger-strong',
                                                            )}
                                                        >
                                                            {user.is_active
                                                                ? 'Active'
                                                                : 'Suspended'}
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    setSelectedUserForCreds(
                                                                        user,
                                                                    );
                                                                }}
                                                                title="Manage Operator Credentials"
                                                            >
                                                                <Award className="h-3.5 w-3.5" />
                                                                Creds
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    setSelectedUserForAccess(
                                                                        user,
                                                                    );
                                                                    setEditRole(
                                                                        user.role ??
                                                                            'driver',
                                                                    );
                                                                    setEditActive(
                                                                        user.is_active,
                                                                    );
                                                                    setAccessError(
                                                                        null,
                                                                    );
                                                                }}
                                                                title="Edit Role & Status"
                                                            >
                                                                Access
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="quiet"
                                                                onClick={() =>
                                                                    setPasswordResetUser(
                                                                        user,
                                                                    )
                                                                }
                                                                title="Reset Password"
                                                            >
                                                                <Key className="h-3.5 w-3.5 text-ink-soft" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        },
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                )}
            </div>

            {/* Modal: Provision / Invite User */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <h3 className="text-lg font-bold text-ink">
                                Provision Operational User
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowInviteModal(false)}
                                className="rounded-lg p-1 text-ink-soft hover:bg-surface-subtle"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {inviteError && (
                            <div className="mt-4 rounded-lg bg-danger-soft p-3 text-xs font-medium text-danger-strong">
                                {inviteError}
                            </div>
                        )}

                        <form
                            onSubmit={handleCreateUser}
                            className="mt-4 space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={inviteName}
                                    onChange={(e) =>
                                        setInviteName(e.target.value)
                                    }
                                    placeholder="e.g. Maria Santos"
                                    className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-ink">
                                        Username
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={inviteUsername}
                                        onChange={(e) =>
                                            setInviteUsername(e.target.value)
                                        }
                                        placeholder="e.g. maria.santos"
                                        className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-ink">
                                        Mobile Phone
                                    </label>
                                    <input
                                        type="text"
                                        value={invitePhone}
                                        onChange={(e) =>
                                            setInvitePhone(e.target.value)
                                        }
                                        placeholder="+63 917 123 4567"
                                        className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={inviteEmail}
                                    onChange={(e) =>
                                        setInviteEmail(e.target.value)
                                    }
                                    placeholder="maria@example.com"
                                    className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Canonical Operational Role
                                </label>
                                <select
                                    value={inviteRole}
                                    onChange={(e) =>
                                        setInviteRole(e.target.value)
                                    }
                                    className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:border-brand focus:outline-none"
                                >
                                    <option value="driver">
                                        Driver (Prime Mover / Hauler)
                                    </option>
                                    <option value="crane_operator">
                                        Crane Operator (Mobile / All-Terrain)
                                    </option>
                                    <option value="dispatcher">
                                        Dispatcher
                                    </option>
                                    <option value="operations_manager">
                                        Operations Manager
                                    </option>
                                    <option value="system_administrator">
                                        System Administrator
                                    </option>
                                </select>
                            </div>

                            <div className="rounded-lg border border-line bg-surface-subtle p-3">
                                <label className="flex cursor-pointer items-start gap-2.5">
                                    <input
                                        type="checkbox"
                                        checked={generateTempPassword}
                                        onChange={(e) =>
                                            setGenerateTempPassword(
                                                e.target.checked,
                                            )
                                        }
                                        className="mt-0.5 h-4 w-4 rounded border-line text-brand focus:ring-brand"
                                    />
                                    <div className="text-xs">
                                        <span className="font-semibold text-ink">
                                            Generate temporary one-time password
                                            in UI
                                        </span>
                                        <p className="text-ink-soft">
                                            Generates a high-entropy password
                                            you can copy and hand to the field
                                            operator immediately.
                                        </p>
                                    </div>
                                </label>
                            </div>

                            <div className="flex justify-end gap-2 border-t border-line pt-2">
                                <Button
                                    variant="quiet"
                                    onClick={() => setShowInviteModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    type="submit"
                                    disabled={inviteSubmitting}
                                >
                                    {inviteSubmitting
                                        ? 'Provisioning…'
                                        : 'Create User Account'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Generated Temporary Password Display */}
            {generatedPasswordInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-strong">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-ink">
                                    User Provisioned Successfully
                                </h3>
                                <p className="text-xs text-ink-soft">
                                    Share these initial login credentials with
                                    the user
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2.5 rounded-xl border border-line bg-surface-subtle p-4">
                            <div>
                                <span className="text-[11px] font-semibold text-ink-soft uppercase">
                                    User
                                </span>
                                <p className="text-sm font-semibold text-ink">
                                    {generatedPasswordInfo.name}
                                </p>
                            </div>

                            <div>
                                <span className="text-[11px] font-semibold text-ink-soft uppercase">
                                    Login Username / Email
                                </span>
                                <p className="font-mono text-xs text-ink">
                                    {generatedPasswordInfo.username} /{' '}
                                    {generatedPasswordInfo.email}
                                </p>
                            </div>

                            <div>
                                <span className="text-[11px] font-semibold text-ink-soft uppercase">
                                    Temporary One-Time Password
                                </span>
                                <div className="mt-1 flex items-center justify-between rounded-lg border border-brand/30 bg-surface px-3 py-2">
                                    <span className="font-mono text-sm font-bold tracking-wider text-brand-strong">
                                        {generatedPasswordInfo.password}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            copyToClipboard(
                                                generatedPasswordInfo.password,
                                            )
                                        }
                                        className="inline-flex items-center gap-1 rounded bg-brand-soft px-2 py-1 text-xs font-semibold text-brand-strong hover:bg-brand-soft/80"
                                    >
                                        {copied ? (
                                            <Check className="h-3.5 w-3.5" />
                                        ) : (
                                            <Copy className="h-3.5 w-3.5" />
                                        )}
                                        {copied ? 'Copied' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <Button
                                variant="primary"
                                onClick={() => setGeneratedPasswordInfo(null)}
                            >
                                Done
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Edit Access & Status */}
            {selectedUserForAccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <h3 className="text-lg font-bold text-ink">
                                Manage Access: {selectedUserForAccess.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setSelectedUserForAccess(null)}
                                className="rounded-lg p-1 text-ink-soft hover:bg-surface-subtle"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {accessError && (
                            <div className="mt-4 rounded-lg bg-danger-soft p-3 text-xs font-medium text-danger-strong">
                                {accessError}
                            </div>
                        )}

                        <form
                            onSubmit={handleUpdateAccess}
                            className="mt-4 space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Canonical Role
                                </label>
                                <select
                                    value={editRole}
                                    onChange={(e) =>
                                        setEditRole(e.target.value)
                                    }
                                    className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:border-brand focus:outline-none"
                                >
                                    <option value="driver">Driver</option>
                                    <option value="crane_operator">
                                        Crane Operator
                                    </option>
                                    <option value="dispatcher">
                                        Dispatcher
                                    </option>
                                    <option value="operations_manager">
                                        Operations Manager
                                    </option>
                                    <option value="system_administrator">
                                        System Administrator
                                    </option>
                                </select>
                            </div>

                            <div className="rounded-lg border border-line bg-surface-subtle p-3">
                                <label className="flex cursor-pointer items-center justify-between">
                                    <div>
                                        <span className="text-xs font-semibold text-ink">
                                            Account Status
                                        </span>
                                        <p className="text-[11px] text-ink-soft">
                                            Suspension immediately revokes
                                            active mobile tokens & web sessions.
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={editActive}
                                        onChange={(e) =>
                                            setEditActive(e.target.checked)
                                        }
                                        className="h-5 w-5 rounded border-line text-brand focus:ring-brand"
                                    />
                                </label>
                            </div>

                            <div className="flex justify-end gap-2 border-t border-line pt-2">
                                <Button
                                    variant="quiet"
                                    onClick={() =>
                                        setSelectedUserForAccess(null)
                                    }
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    type="submit"
                                    disabled={accessSubmitting}
                                >
                                    {accessSubmitting
                                        ? 'Saving…'
                                        : 'Update Access'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Password Reset Confirmation */}
            {passwordResetUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-strong">
                                <Key className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-ink">
                                    Reset User Password
                                </h3>
                                <p className="text-xs text-ink-soft">
                                    Generate a new temporary password for{' '}
                                    {passwordResetUser.name}
                                </p>
                            </div>
                        </div>

                        <p className="mt-3 text-xs leading-5 text-ink-soft">
                            This will invalidate all current active login
                            sessions and mobile tokens for this user and
                            generate a new temporary password.
                        </p>

                        <div className="mt-5 flex justify-end gap-2">
                            <Button
                                variant="quiet"
                                onClick={() => setPasswordResetUser(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={handleResetPassword}
                            >
                                Confirm & Generate New Password
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Manage Operator Credentials */}
            {selectedUserForCreds && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-ink">
                                    Operator Qualifications & Credentials
                                </h3>
                                <p className="text-xs text-ink-soft">
                                    {selectedUserForCreds.name} (
                                    {selectedUserForCreds.role_label})
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedUserForCreds(null)}
                                className="rounded-lg p-1 text-ink-soft hover:bg-surface-subtle"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Existing Credentials List */}
                        <div className="mt-4 space-y-2.5">
                            <h4 className="text-xs font-semibold text-ink-soft uppercase">
                                Current Licenses & Certifications
                            </h4>
                            {(selectedUserForCreds.credentials ?? []).length ===
                            0 ? (
                                <div className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-ink-soft">
                                    No verified credentials on record for this
                                    operator.
                                </div>
                            ) : (
                                (selectedUserForCreds.credentials ?? []).map(
                                    (cred) => (
                                        <div
                                            key={cred.id}
                                            className="flex items-center justify-between rounded-xl border border-line bg-surface-subtle p-3"
                                        >
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-ink">
                                                        {cred.credential_type}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'py-0.2 rounded px-1.5 text-[10px] font-semibold uppercase',
                                                            cred.is_expired
                                                                ? 'bg-danger-soft text-danger-strong'
                                                                : cred.expires_soon
                                                                  ? 'bg-warning-soft text-warning-strong'
                                                                  : 'bg-success-soft text-success-strong',
                                                        )}
                                                    >
                                                        {cred.is_expired
                                                            ? 'Expired'
                                                            : cred.expires_soon
                                                              ? 'Expiring Soon'
                                                              : 'Valid'}
                                                    </span>
                                                </div>
                                                <p className="font-mono text-xs text-ink-soft">
                                                    ID: {cred.credential_number}
                                                </p>
                                                <p className="text-[11px] text-muted">
                                                    Issued:{' '}
                                                    {cred.issued_at ?? 'N/A'} ·
                                                    Expires:{' '}
                                                    {cred.expires_at ??
                                                        'Lifetime / No Expiry'}
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleDeleteCredential(
                                                        cred.id,
                                                    )
                                                }
                                                className="rounded-lg p-1.5 text-danger hover:bg-danger-soft"
                                                title="Revoke / Delete Credential"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ),
                                )
                            )}
                        </div>

                        {/* Add Credential Form */}
                        <div className="mt-6 rounded-xl border border-line bg-surface p-4">
                            <h4 className="text-xs font-semibold text-ink uppercase">
                                Add New Verified Credential
                            </h4>

                            {credError && (
                                <div className="mt-2 rounded-lg bg-danger-soft p-2.5 text-xs text-danger-strong">
                                    {credError}
                                </div>
                            )}

                            <form
                                onSubmit={handleAddCredential}
                                className="mt-3 space-y-3"
                            >
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-ink">
                                            Credential Kind
                                        </label>
                                        <select
                                            value={credKind}
                                            onChange={(e) =>
                                                setCredKind(
                                                    e.target.value as any,
                                                )
                                            }
                                            className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none"
                                        >
                                            <option value="operator_certification">
                                                Heavy Crane Operator
                                                Certification (NC II)
                                            </option>
                                            <option value="driver_license">
                                                Commercial Driver's License
                                            </option>
                                            <option value="qualification">
                                                Safety & Rigging Qualification
                                            </option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-ink">
                                            Credential / License #
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={credNumber}
                                            onChange={(e) =>
                                                setCredNumber(e.target.value)
                                            }
                                            placeholder="e.g. DL-N02-19-094821"
                                            className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-ink">
                                        Classification / Rating
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={credType}
                                        onChange={(e) =>
                                            setCredType(e.target.value)
                                        }
                                        placeholder="e.g. TESDA Heavy Crane NC II (50T+ Hydraulic)"
                                        className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-ink">
                                            Issued Date
                                        </label>
                                        <input
                                            type="date"
                                            value={credIssuedAt}
                                            onChange={(e) =>
                                                setCredIssuedAt(e.target.value)
                                            }
                                            className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-ink">
                                            Expiry Date
                                        </label>
                                        <input
                                            type="date"
                                            value={credExpiresAt}
                                            onChange={(e) =>
                                                setCredExpiresAt(e.target.value)
                                            }
                                            className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        type="submit"
                                        disabled={credSubmitting}
                                    >
                                        {credSubmitting
                                            ? 'Saving…'
                                            : 'Add Credential'}
                                    </Button>
                                </div>
                            </form>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <Button
                                variant="secondary"
                                onClick={() => setSelectedUserForCreds(null)}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function AuditSurface({ events }: { events: AuditEventViewModel[] }) {
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEvent, setSelectedEvent] =
        useState<AuditEventViewModel | null>(null);

    // System Health State (Node 5)
    const [health, setHealth] = useState<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        services: {
            database: { status: string; latency_ms: number | null };
            cache: { status: string; latency_ms: number | null };
            outbox: {
                status: string;
                pending: number;
                failed: number;
                delivered: number;
            };
            queues: { status: string; failed_jobs: number };
        };
    } | null>(null);

    useEffect(() => {
        fetch('/operations/admin/health')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data) {
                    setHealth(data);
                }
            })
            .catch(() => {});
    }, []);

    const stats = useMemo(() => {
        const total = events.length;
        const overrides = events.filter(
            (e) =>
                e.action.includes('override') || e.action.includes('approval'),
        ).length;
        const transitions = events.filter(
            (e) =>
                e.action.includes('status') || e.action.includes('transition'),
        ).length;
        const gpt = events.filter((e) => e.action.includes('gpt')).length;
        const userAccess = events.filter(
            (e) => e.action.includes('user') || e.action.includes('personnel'),
        ).length;

        return { total, overrides, transitions, gpt, userAccess };
    }, [events]);

    const filteredEvents = useMemo(() => {
        return events.filter((event) => {
            if (
                actionFilter === 'overrides' &&
                !event.action.includes('override') &&
                !event.action.includes('approval')
            ) {
                return false;
            }

            if (
                actionFilter === 'transitions' &&
                !event.action.includes('status') &&
                !event.action.includes('transition')
            ) {
                return false;
            }

            if (actionFilter === 'gpt' && !event.action.includes('gpt')) {
                return false;
            }

            if (
                actionFilter === 'access' &&
                !event.action.includes('user') &&
                !event.action.includes('personnel')
            ) {
                return false;
            }

            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase().trim();
                const action = event.action.toLowerCase();
                const actor = (event.actor?.name ?? 'system').toLowerCase();
                const reason = (event.reason ?? '').toLowerCase();
                const reqId = (event.request_id ?? '').toLowerCase();

                return (
                    action.includes(q) ||
                    actor.includes(q) ||
                    reason.includes(q) ||
                    reqId.includes(q)
                );
            }

            return true;
        });
    }, [events, actionFilter, searchQuery]);

    const handleExportAudit = () => {
        window.location.href = '/operations/reports/exports';
    };

    return (
        <div>
            <PageHeading
                title="Audit trail & compliance log"
                description="Immutable forensic log of approvals, overrides, state transitions, GPT advisory decisions, user access, and cryptographic telemetry."
                actions={
                    <Button variant="secondary" onClick={handleExportAudit}>
                        <Download className="h-4 w-4" />
                        Export Audit Dataset
                    </Button>
                }
            />
            <div className="space-y-6 p-4 md:p-6">
                {/* Synthetic Infrastructure & Outbox DLQ Health Monitor */}
                {health && (
                    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                            <div className="flex items-center gap-2">
                                <span
                                    className={cn(
                                        'h-2.5 w-2.5 rounded-full',
                                        health.status === 'healthy'
                                            ? 'animate-pulse bg-success'
                                            : 'bg-warning',
                                    )}
                                />
                                <h3 className="text-xs font-bold tracking-wider text-ink uppercase">
                                    System Infrastructure & Telemetry Health
                                </h3>
                            </div>
                            <span
                                className={cn(
                                    'rounded-md px-2 py-0.5 text-xs font-semibold uppercase',
                                    health.status === 'healthy'
                                        ? 'bg-success-soft text-success-strong'
                                        : 'bg-warning-soft text-warning-strong',
                                )}
                            >
                                {health.status}
                            </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                            <div className="rounded-xl border border-line bg-surface-subtle p-3">
                                <span className="font-semibold text-ink-soft">
                                    Postgres Latency
                                </span>
                                <p className="mt-1 font-mono text-sm font-bold text-ink">
                                    {health.services.database.latency_ms !==
                                    null
                                        ? `${health.services.database.latency_ms} ms`
                                        : 'Offline'}
                                </p>
                            </div>

                            <div className="rounded-xl border border-line bg-surface-subtle p-3">
                                <span className="font-semibold text-ink-soft">
                                    Redis / Cache Ping
                                </span>
                                <p className="mt-1 font-mono text-sm font-bold text-ink">
                                    {health.services.cache.latency_ms !== null
                                        ? `${health.services.cache.latency_ms} ms`
                                        : 'Offline'}
                                </p>
                            </div>

                            <div className="rounded-xl border border-line bg-surface-subtle p-3">
                                <span className="font-semibold text-ink-soft">
                                    Transactional Outbox (DLQ)
                                </span>
                                <p className="mt-1 font-mono text-sm font-bold text-ink">
                                    {health.services.outbox.failed === 0 ? (
                                        <span className="text-success-strong">
                                            0 Dead Letters (Clean)
                                        </span>
                                    ) : (
                                        <span className="text-danger-strong">
                                            {health.services.outbox.failed}{' '}
                                            Failed Messages
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div className="rounded-xl border border-line bg-surface-subtle p-3">
                                <span className="font-semibold text-ink-soft">
                                    Background Queues
                                </span>
                                <p className="mt-1 font-mono text-sm font-bold text-ink">
                                    {health.services.queues.failed_jobs ===
                                    0 ? (
                                        <span className="text-success-strong">
                                            0 Failed Jobs
                                        </span>
                                    ) : (
                                        <span className="text-danger-strong">
                                            {health.services.queues.failed_jobs}{' '}
                                            Failed
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
                        <span className="text-xs font-medium text-ink-soft">
                            Total Events
                        </span>
                        <p className="mt-1 text-2xl font-bold text-ink">
                            {stats.total}
                        </p>
                    </div>
                    <div className="rounded-xl border border-warning/30 bg-warning-soft/30 p-3.5 shadow-sm">
                        <span className="text-xs font-medium text-warning-strong">
                            Approvals & Overrides
                        </span>
                        <p className="mt-1 text-2xl font-bold text-warning-strong">
                            {stats.overrides}
                        </p>
                    </div>
                    <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
                        <span className="text-xs font-medium text-ink-soft">
                            State Transitions
                        </span>
                        <p className="mt-1 text-2xl font-bold text-ink">
                            {stats.transitions}
                        </p>
                    </div>
                    <div className="rounded-xl border border-brand/30 bg-brand-soft/30 p-3.5 shadow-sm">
                        <span className="text-xs font-medium text-brand-strong">
                            GPT AI Decisions
                        </span>
                        <p className="mt-1 text-2xl font-bold text-brand-strong">
                            {stats.gpt}
                        </p>
                    </div>
                    <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
                        <span className="text-xs font-medium text-ink-soft">
                            Access & Security
                        </span>
                        <p className="mt-1 text-2xl font-bold text-ink">
                            {stats.userAccess}
                        </p>
                    </div>
                </div>

                {/* Filter and Search */}
                <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-ink-soft">
                            Filter:
                        </span>
                        {[
                            {
                                id: 'all',
                                label: 'All Events',
                                count: stats.total,
                            },
                            {
                                id: 'overrides',
                                label: 'Overrides',
                                count: stats.overrides,
                            },
                            {
                                id: 'transitions',
                                label: 'Transitions',
                                count: stats.transitions,
                            },
                            {
                                id: 'gpt',
                                label: 'GPT Decisions',
                                count: stats.gpt,
                            },
                            {
                                id: 'access',
                                label: 'Access & Users',
                                count: stats.userAccess,
                            },
                        ].map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActionFilter(cat.id)}
                                className={cn(
                                    'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                                    actionFilter === cat.id
                                        ? 'bg-brand-strong text-white shadow-xs'
                                        : 'bg-surface-subtle text-ink-soft hover:bg-surface-subtle/80 hover:text-ink',
                                )}
                            >
                                {cat.label} ({cat.count})
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full sm:w-80">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search action, actor, reason, correlation ID…"
                            className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                        />
                    </div>
                </div>

                {events.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Bot}
                            title="No audit events recorded"
                            message="Sensitive operational, dispatch state, and access changes will appear here."
                        />
                    </Panel>
                ) : filteredEvents.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Bot}
                            title="No matching audit events"
                            message="No events match your search or filter criteria."
                        />
                    </Panel>
                ) : (
                    <Panel className="overflow-hidden">
                        <div
                            className="workspace-scroll-region"
                            role="region"
                            aria-label="Audit trail table scroll region"
                            tabIndex={0}
                        >
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-line bg-surface-subtle text-xs font-semibold text-ink-soft uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Timestamp</th>
                                        <th className="px-4 py-3">
                                            Actor Attribution
                                        </th>
                                        <th className="px-4 py-3">
                                            Action Type
                                        </th>
                                        <th className="px-4 py-3">
                                            Attribution Reason & Context
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Forensic Inspection
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {filteredEvents.map(
                                        (event: AuditEventViewModel) => (
                                            <tr
                                                key={event.id}
                                                onClick={() =>
                                                    setSelectedEvent(event)
                                                }
                                                className="cursor-pointer transition-colors hover:bg-surface-subtle/50"
                                            >
                                                <td className="px-4 py-3 text-xs text-ink-soft">
                                                    {formatDateTime(
                                                        event.occurred_at,
                                                        'Not recorded',
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-ink">
                                                    {event.actor?.name ??
                                                        'System Observer'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center rounded bg-surface-subtle px-2 py-0.5 font-mono text-xs font-semibold text-ink">
                                                        {event.action}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-ink-soft">
                                                    {event.reason ??
                                                        'No operational reason recorded'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedEvent(
                                                                event,
                                                            );
                                                        }}
                                                    >
                                                        <FileText className="h-3.5 w-3.5" />
                                                        Diff
                                                    </Button>
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                )}
            </div>

            {/* Modal: Visual Before/After JSON Diff Modal */}
            {selectedEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-bold text-ink">
                                        {selectedEvent.action}
                                    </span>
                                    <span className="rounded bg-surface-subtle px-2 py-0.5 text-xs text-ink-soft">
                                        Event #{selectedEvent.id}
                                    </span>
                                </div>
                                <p className="text-xs text-ink-soft">
                                    Actor:{' '}
                                    {selectedEvent.actor?.name ?? 'System'} ·{' '}
                                    {formatDateTime(
                                        selectedEvent.occurred_at,
                                        'N/A',
                                    )}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedEvent(null)}
                                className="rounded-lg p-1 text-ink-soft hover:bg-surface-subtle"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Correlation Metadata */}
                        <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl border border-line bg-surface-subtle p-3 text-xs sm:grid-cols-4">
                            <div>
                                <span className="text-[10px] font-semibold text-ink-soft uppercase">
                                    Subject
                                </span>
                                <p className="font-mono text-ink">
                                    {selectedEvent.subject_type
                                        ? `${selectedEvent.subject_type.split('\\').pop()} #${selectedEvent.subject_id}`
                                        : 'Platform'}
                                </p>
                            </div>
                            <div>
                                <span className="text-[10px] font-semibold text-ink-soft uppercase">
                                    IP Address
                                </span>
                                <p className="font-mono text-ink">
                                    {selectedEvent.ip_address ?? '127.0.0.1'}
                                </p>
                            </div>
                            <div className="col-span-2">
                                <span className="text-[10px] font-semibold text-ink-soft uppercase">
                                    Request Correlation UUID
                                </span>
                                <p className="truncate font-mono text-[11px] text-ink">
                                    {selectedEvent.request_id ?? 'N/A'}
                                </p>
                            </div>
                        </div>

                        {selectedEvent.reason && (
                            <div className="mt-3 rounded-lg border border-warning/30 bg-warning-soft/30 p-3 text-xs text-warning-strong">
                                <strong>Operational Justification:</strong>{' '}
                                {selectedEvent.reason}
                            </div>
                        )}

                        {/* Before / After State Comparison */}
                        <div className="mt-5 space-y-3">
                            <h4 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                                State Mutation Comparison (Before vs. After)
                            </h4>

                            {!selectedEvent.before && !selectedEvent.after ? (
                                <div className="rounded-xl border border-line bg-surface-subtle p-4 text-center text-xs text-ink-soft">
                                    No state payload captured for this
                                    operational event.
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {/* Before Panel */}
                                    <div className="overflow-hidden rounded-xl border border-line bg-surface">
                                        <div className="border-b border-line bg-danger-soft/40 px-3 py-2 text-xs font-semibold text-danger-strong">
                                            Prior State (Before)
                                        </div>
                                        <pre className="max-h-60 overflow-x-auto p-3 font-mono text-[11px] text-ink">
                                            {selectedEvent.before
                                                ? JSON.stringify(
                                                      selectedEvent.before,
                                                      null,
                                                      2,
                                                  )
                                                : '(No prior state recorded)'}
                                        </pre>
                                    </div>

                                    {/* After Panel */}
                                    <div className="overflow-hidden rounded-xl border border-line bg-surface">
                                        <div className="border-b border-line bg-success-soft/40 px-3 py-2 text-xs font-semibold text-success-strong">
                                            New State (After)
                                        </div>
                                        <pre className="max-h-60 overflow-x-auto p-3 font-mono text-[11px] text-ink">
                                            {selectedEvent.after
                                                ? JSON.stringify(
                                                      selectedEvent.after,
                                                      null,
                                                      2,
                                                  )
                                                : '(No subsequent state)'}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button
                                variant="secondary"
                                onClick={() => setSelectedEvent(null)}
                            >
                                Close Inspector
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export function ResponsiveTable({
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
            <div
                className="workspace-scroll-region hidden md:block"
                role="region"
                aria-label="Responsive data table scroll region"
                tabIndex={0}
            >
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
