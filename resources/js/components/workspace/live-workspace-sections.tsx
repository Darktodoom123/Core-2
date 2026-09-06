import { useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Bot,
    Camera,
    CheckCircle2,
    ClipboardCheck,
    Compass,
    Download,
    DownloadCloud,
    FileSpreadsheet,
    FileText,
    Gauge,
    MapPin,
    Navigation,
    Printer,
    Radio,
    Search,
    SearchX,
    ShieldAlert,
    ShieldCheck,
    Truck,
    Wrench,
    X,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ApprovalsSurface } from '@/components/approvals';
import {
    Button,
    DateTimePicker,
    EmptyState,
    InlineNotice,
    PageHeading,
    Panel,
    Skeleton,
    Stat,
} from '@/components/ui';
import { WeatherSafetyTelemetry } from '@/components/weather/weather-safety-telemetry';
import { ArchiveSurface } from '@/components/workspace/archive-workspace-section';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import {
    DvirStatusBadge,
    DvirWalkaroundModal,
    HosDutyBadge,
    OperatorBindingChip,
    SafetyLockoutBanner,
} from '@/components/workspace/fleet';
import { FuelSurface } from '@/components/workspace/fuel';
import { GptRecommendationsSurface } from '@/components/workspace/gpt-workspace-section';
import { NotificationsSurface } from '@/components/workspace/notifications-workspace-section';
import { ReportsSurface } from '@/components/workspace/reports-workspace-section';
import { formatDateTime, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    ApprovalViewModel,
    ArchivedJobViewModel,
    AssetStatusValue,
    AssetViewModel,
    AuditEventViewModel,
    DispatchJobViewModel,
    FuelRequestViewModel,
    GptRecommendationViewModel,
    InspectionResultValue,
    InspectionTypeValue,
    JobReportViewModel,
    LocationUpdateViewModel,
    NotificationViewModel,
    ReportExportViewModel,
    SosIncidentViewModel,
    WorkspaceCapabilities,
    WorkspaceSection,
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
    assetsTotal,
    fuelRequests,
    locations,
    approvals,
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
    assetsTotal?: number;
    fuelRequests: FuelRequestViewModel[];
    locations: LocationUpdateViewModel[];
    approvals: ApprovalViewModel[];
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
                    assetsTotal={assetsTotal}
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
                    assets={assets}
                />
            );
        case 'tracking':
            return (
                <AssetsSurface
                    assets={assets}
                    assetsTotal={assetsTotal}
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
                    onSectionChange={onSectionChange}
                />
            );
        case 'audit':
            return <AuditSurface events={auditEvents} />;
    }
}

function AssetsSurface({
    assets,
    assetsTotal,
    locations = [],
    activeSosIncidents = [],
    capabilities,
    onSectionChange,
    initialViewMode = 'list',
}: {
    assets: AssetViewModel[];
    assetsTotal?: number;
    locations?: LocationUpdateViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    capabilities: WorkspaceCapabilities;
    onSectionChange?: (section: WorkspaceSection) => void;
    initialViewMode?: 'list' | 'map';
}) {
    const [viewMode, setViewMode] = useState<'list' | 'map'>(initialViewMode);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<
        'all' | 'cranes' | 'trucks' | 'available' | 'maintenance'
    >('all');
    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(
        assets.length > 0 ? assets[0].id : null,
    );

    const kpis = useMemo(() => {
        let ready = 0;
        let working = 0;
        let maintenance = 0;
        let cranes = 0;
        let trucks = 0;

        for (const a of assets) {
            const v = a.status?.value;
            const k = (a.kind || '').toLowerCase();
            const sub = (a.subtype || '').toLowerCase();

            if (k.includes('crane') || sub.includes('crane')) {
                cranes += 1;
            } else if (
                k.includes('truck') ||
                k.includes('vehicle') ||
                k.includes('trailer') ||
                sub.includes('truck') ||
                sub.includes('trailer')
            ) {
                trucks += 1;
            }

            if (a.is_dispatchable === true) {
                ready += 1;
            } else if (
                v === 'working' ||
                v === 'assigned' ||
                v === 'in_transit' ||
                v === 'on_site'
            ) {
                working += 1;
            } else if (
                v === 'maintenance' ||
                v === 'out_of_service' ||
                v === 'under_maintenance' ||
                a.blocking_work_orders_count > 0
            ) {
                maintenance += 1;
            }
        }

        return {
            total: assets.length,
            ready,
            working,
            maintenance,
            cranes,
            trucks,
        };
    }, [assets]);

    const filteredAssets = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        return assets.filter((asset) => {
            const kindLower = (asset.kind || '').toLowerCase();
            const subtypeLower = (asset.subtype || '').toLowerCase();
            const isCrane =
                kindLower.includes('crane') || subtypeLower.includes('crane');
            const isTruck =
                kindLower.includes('truck') ||
                kindLower.includes('vehicle') ||
                kindLower.includes('trailer') ||
                subtypeLower.includes('truck') ||
                subtypeLower.includes('trailer');
            const isAvailable =
                (asset.status?.value === 'available' ||
                    asset.status?.value === 'ready_for_service') &&
                asset.blocking_work_orders_count === 0;
            const isMaintenance =
                asset.status?.value === 'maintenance' ||
                asset.status?.value === 'out_of_service' ||
                asset.status?.value === 'under_maintenance' ||
                asset.blocking_work_orders_count > 0;

            const matchesCategory =
                categoryFilter === 'all'
                    ? true
                    : categoryFilter === 'cranes'
                      ? isCrane
                      : categoryFilter === 'trucks'
                        ? isTruck
                        : categoryFilter === 'available'
                          ? isAvailable
                          : categoryFilter === 'maintenance'
                            ? isMaintenance
                            : true;

            const matchesQuery =
                q === '' ||
                `${asset.code} ${asset.name} ${asset.model ?? ''} ${asset.manufacturer ?? ''} ${asset.registration_number ?? ''} ${asset.kind} ${asset.subtype ?? ''} ${asset.rated_capacity ?? ''}`
                    .toLowerCase()
                    .includes(q);

            return matchesCategory && matchesQuery;
        });
    }, [assets, categoryFilter, searchQuery]);

    const selectedAsset =
        filteredAssets.find((a) => a.id === selectedAssetId) ??
        filteredAssets[0] ??
        assets.find((a) => a.id === selectedAssetId) ??
        assets[0] ??
        null;

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

    const totalFleetCount = assetsTotal ?? kpis.total;

    return (
        <div>
            <PageHeading
                title="Fleet Management"
                description="Core 3 assets, live GPS telematics, readiness status, specifications, safety inspections, and maintenance work orders."
            />
            <div className="space-y-6 p-4 md:p-6">
                {/* Fleet Health & Readiness KPI Strip */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
                    <Stat
                        title="Total Fleet"
                        value={
                            <span>
                                {totalFleetCount}{' '}
                                <span className="text-xs font-normal text-ink-soft">
                                    units
                                </span>
                            </span>
                        }
                        description={`${kpis.cranes} Cranes · ${kpis.trucks} Transport`}
                        icon={Truck}
                    />

                    <Stat
                        title="Ready to Deploy"
                        value={kpis.ready}
                        description="Certified & available"
                        icon={CheckCircle2}
                        tone="success"
                    />

                    <Stat
                        title="Active on Jobs"
                        value={kpis.working}
                        description="Working or in transit"
                        icon={Radio}
                        tone="brand"
                    />

                    <Stat
                        title="Maintenance Holds"
                        value={kpis.maintenance}
                        description="Work orders or holds"
                        icon={Wrench}
                        tone="warning"
                    />
                </div>

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

                {assetsTotal !== undefined && assetsTotal > assets.length && (
                    <InlineNotice tone="info" title="Fleet list truncated">
                        Showing the first {assets.length} of {assetsTotal} fleet
                        assets. Newer assets may not be listed — use the search
                        field to find a specific asset.
                    </InlineNotice>
                )}

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
                                <div className="space-y-3 border-b border-line p-3.5">
                                    <label className="relative block">
                                        <span className="sr-only">
                                            Search assets
                                        </span>
                                        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                                        <input
                                            type="search"
                                            value={searchQuery}
                                            onChange={(e) =>
                                                setSearchQuery(e.target.value)
                                            }
                                            placeholder="Search code, model, plate, tons…"
                                            className="h-9 w-full rounded-lg border border-line-strong bg-surface-subtle pr-3 pl-9 text-xs placeholder:text-ink-soft"
                                        />
                                    </label>

                                    {/* 1-Click Category Filter Pills */}
                                    <div
                                        className="flex flex-wrap gap-1"
                                        role="group"
                                        aria-label="Filter fleet assets"
                                    >
                                        <button
                                            type="button"
                                            aria-pressed={
                                                categoryFilter === 'all'
                                            }
                                            onClick={() =>
                                                setCategoryFilter('all')
                                            }
                                            className={cn(
                                                'inline-flex min-h-7 items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                                                categoryFilter === 'all'
                                                    ? 'bg-ink font-semibold text-canvas'
                                                    : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                                            )}
                                        >
                                            All ({kpis.total})
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={
                                                categoryFilter === 'cranes'
                                            }
                                            onClick={() =>
                                                setCategoryFilter('cranes')
                                            }
                                            className={cn(
                                                'inline-flex min-h-7 items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                                                categoryFilter === 'cranes'
                                                    ? 'border border-brand/40 bg-brand-soft font-semibold text-brand-strong'
                                                    : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                                            )}
                                        >
                                            Cranes ({kpis.cranes})
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={
                                                categoryFilter === 'trucks'
                                            }
                                            onClick={() =>
                                                setCategoryFilter('trucks')
                                            }
                                            className={cn(
                                                'inline-flex min-h-7 items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                                                categoryFilter === 'trucks'
                                                    ? 'border border-line-strong bg-surface-subtle font-semibold text-ink'
                                                    : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                                            )}
                                        >
                                            Transport ({kpis.trucks})
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={
                                                categoryFilter === 'available'
                                            }
                                            onClick={() =>
                                                setCategoryFilter('available')
                                            }
                                            className={cn(
                                                'inline-flex min-h-7 items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                                                categoryFilter === 'available'
                                                    ? 'border border-success/40 bg-success-soft font-semibold text-success-strong'
                                                    : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                                            )}
                                        >
                                            Ready ({kpis.ready})
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={
                                                categoryFilter === 'maintenance'
                                            }
                                            onClick={() =>
                                                setCategoryFilter('maintenance')
                                            }
                                            className={cn(
                                                'inline-flex min-h-7 items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                                                categoryFilter === 'maintenance'
                                                    ? 'border border-warning/40 bg-warning-soft font-semibold text-warning-strong'
                                                    : 'border border-line bg-surface-subtle text-ink-soft hover:bg-surface hover:text-ink',
                                            )}
                                        >
                                            Holds ({kpis.maintenance})
                                        </button>
                                    </div>
                                </div>

                                {filteredAssets.length === 0 ? (
                                    <EmptyState
                                        compact
                                        icon={SearchX}
                                        title="No matching assets"
                                        message="Try another asset code, model, or filter category."
                                        primaryAction={
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    setSearchQuery('');
                                                    setCategoryFilter('all');
                                                }}
                                            >
                                                Clear filters
                                            </Button>
                                        }
                                    />
                                ) : (
                                    <ul className="divide-y divide-line">
                                        {filteredAssets.map((asset) => {
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
                                                            'min-h-[72px] w-full px-3.5 py-2.5 text-left transition-colors hover:bg-surface-subtle',
                                                            isSelected &&
                                                                'bg-brand-soft/60 ring-1 ring-brand/30',
                                                        )}
                                                        aria-pressed={
                                                            isSelected
                                                        }
                                                    >
                                                        <div className="flex items-center justify-between gap-1.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-bold text-ink">
                                                                    {asset.code}
                                                                </span>
                                                                {asset.rated_capacity && (
                                                                    <span className="py-0.2 rounded border border-line bg-surface-subtle px-1.5 font-mono text-[10px] font-semibold text-ink-soft">
                                                                        {
                                                                            asset.rated_capacity
                                                                        }{' '}
                                                                        {asset.capacity_unit ??
                                                                            'MT'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <CanonicalStatusBadge
                                                                status={
                                                                    asset.status
                                                                }
                                                            />
                                                        </div>
                                                        <p className="mt-0.5 truncate text-xs font-semibold text-ink">
                                                            {asset.name}
                                                        </p>
                                                        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] text-ink-soft">
                                                            <span className="truncate">
                                                                {humanize(
                                                                    asset.subtype ||
                                                                        asset.kind,
                                                                )}
                                                            </span>
                                                            {hasLiveGps ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-strong">
                                                                    <Radio className="h-2.5 w-2.5 animate-pulse text-success" />
                                                                    GPS Live{' '}
                                                                    {matchingLoc.speed !==
                                                                        null &&
                                                                    matchingLoc.speed >
                                                                        0
                                                                        ? `(${matchingLoc.speed} km/h)`
                                                                        : ''}
                                                                </span>
                                                            ) : (
                                                                <span className="max-w-[110px] truncate text-[10px]">
                                                                    {asset.location ??
                                                                        'Base Yard'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {asset.blocking_work_orders_count >
                                                            0 && (
                                                            <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-danger">
                                                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                                                {
                                                                    asset.blocking_work_orders_count
                                                                }{' '}
                                                                blocking work
                                                                order
                                                                {asset.blocking_work_orders_count >
                                                                1
                                                                    ? 's'
                                                                    : ''}
                                                            </div>
                                                        )}

                                                        {/* Parity Status: Operator, HoS & DVIR */}
                                                        {(asset.active_operator ||
                                                            asset.latest_dvir ||
                                                            asset.hos) && (
                                                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 border-t border-line/40 pt-1.5">
                                                                {asset.active_operator ? (
                                                                    <OperatorBindingChip
                                                                        activeOperator={
                                                                            asset.active_operator
                                                                        }
                                                                        compact
                                                                    />
                                                                ) : asset.hos ? (
                                                                    <HosDutyBadge
                                                                        hos={
                                                                            asset.hos
                                                                        }
                                                                        compact
                                                                    />
                                                                ) : null}

                                                                {asset.latest_dvir && (
                                                                    <DvirStatusBadge
                                                                        dvir={
                                                                            asset.latest_dvir
                                                                        }
                                                                        compact
                                                                    />
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Safety Lockout Alert */}
                                                        {asset.lockout
                                                            ?.is_locked_out && (
                                                            <div className="mt-1 flex items-center gap-1 rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger-strong">
                                                                <ShieldAlert className="h-3 w-3 shrink-0" />
                                                                <span className="truncate">
                                                                    {asset
                                                                        .lockout
                                                                        .lockout_reason ||
                                                                        'Safety Lockout Active'}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </Panel>
                        </div>

                        <div className="lg:col-span-7 xl:col-span-8">
                            {selectedAsset ? (
                                <AssetDetailPane
                                    asset={selectedAsset}
                                    assetLocation={selectedAssetLocation}
                                    activeSosIncidents={activeSosIncidents}
                                    capabilities={capabilities}
                                    onViewFullTracking={() =>
                                        setViewMode('map')
                                    }
                                />
                            ) : (
                                <Panel>
                                    <EmptyState
                                        icon={Truck}
                                        title="Select an asset"
                                        message="Choose a crane or transport unit to review its telematics, specifications, and maintenance records."
                                    />
                                </Panel>
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

    const [showDvirModal, setShowDvirModal] = useState(false);
    const [showLockdownModal, setShowLockdownModal] = useState(false);
    const lockdownTriggerRef = useRef<HTMLButtonElement | null>(null);
    const lockdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    const lockdownForm = useForm({
        reason: '',
    });

    const hasLiveGps =
        assetLocation &&
        assetLocation.latitude !== null &&
        assetLocation.longitude !== null;

    useEffect(() => {
        if (showLockdownModal) {
            lockdownTextareaRef.current?.focus();

            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    setShowLockdownModal(false);
                    lockdownForm.clearErrors();
                    lockdownTriggerRef.current?.focus();
                }
            };

            window.addEventListener('keydown', handleKeyDown);

            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [showLockdownModal, lockdownForm]);

    const handleSafetyLockdown = (e: FormEvent) => {
        e.preventDefault();
        lockdownForm.post(
            `/operations/admin/assets/${asset.id}/safety-lockdown`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    setShowLockdownModal(false);
                    lockdownForm.reset();
                    lockdownTriggerRef.current?.focus();
                },
            },
        );
    };

    const handleCloseLockdownModal = () => {
        setShowLockdownModal(false);
        lockdownForm.clearErrors();
        lockdownTriggerRef.current?.focus();
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
                    {capabilities.safety_lockdown_asset &&
                        asset.status.value !== 'unavailable' && (
                            <Button
                                ref={lockdownTriggerRef}
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

            {/* Safety Lockout Alert Banner */}
            {asset.lockout?.is_locked_out && (
                <SafetyLockoutBanner
                    lockout={asset.lockout}
                    assetId={asset.id}
                    assetCode={asset.code}
                    maintenanceWorkOrders={asset.maintenance_work_orders}
                />
            )}

            {/* Safety Lockdown Modal */}
            {showLockdownModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="lockdown-dialog-title"
                >
                    <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-strong">
                                <ShieldAlert
                                    className="h-6 w-6"
                                    aria-hidden="true"
                                />
                            </div>
                            <div>
                                <h3
                                    id="lockdown-dialog-title"
                                    className="text-lg font-bold text-ink"
                                >
                                    Fleet Safety Recall Lockdown
                                </h3>
                                <p className="text-xs text-ink-soft">
                                    Asset: {asset.code} ({asset.name})
                                </p>
                            </div>
                        </div>

                        {(
                            lockdownForm.errors as Record<
                                string,
                                string | undefined
                            >
                        ).message && (
                            <div
                                role="alert"
                                className="mt-3 rounded-lg bg-danger-soft p-3 text-xs font-medium text-danger-strong"
                            >
                                {
                                    (
                                        lockdownForm.errors as Record<
                                            string,
                                            string | undefined
                                        >
                                    ).message
                                }
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
                            noValidate
                        >
                            <div>
                                <label
                                    htmlFor="lockdown-reason"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Mandatory Safety Recall Reason *
                                </label>
                                <textarea
                                    id="lockdown-reason"
                                    ref={lockdownTextareaRef}
                                    required
                                    rows={3}
                                    minLength={6}
                                    maxLength={500}
                                    value={lockdownForm.data.reason}
                                    onChange={(e) =>
                                        lockdownForm.setData(
                                            'reason',
                                            e.target.value,
                                        )
                                    }
                                    aria-invalid={Boolean(
                                        lockdownForm.errors.reason,
                                    )}
                                    aria-describedby={
                                        lockdownForm.errors.reason
                                            ? 'lockdown-reason-error'
                                            : undefined
                                    }
                                    placeholder="Specify safety defect, hydraulic fault, structural crack, or regulatory recall notice…"
                                    className={cn(
                                        'mt-1 w-full rounded-lg border bg-surface p-2.5 text-xs text-ink placeholder:text-ink-soft focus:outline-none',
                                        lockdownForm.errors.reason
                                            ? 'border-danger focus:border-danger'
                                            : 'border-line focus:border-line-strong',
                                    )}
                                />
                                {lockdownForm.errors.reason && (
                                    <p
                                        id="lockdown-reason-error"
                                        role="alert"
                                        className="mt-1 text-xs font-medium text-danger"
                                    >
                                        {lockdownForm.errors.reason}
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 border-t border-line pt-2">
                                <Button
                                    variant="quiet"
                                    onClick={handleCloseLockdownModal}
                                    disabled={lockdownForm.processing}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    type="submit"
                                    disabled={lockdownForm.processing}
                                >
                                    {lockdownForm.processing
                                        ? 'Applying…'
                                        : 'Enforce Safety Lockdown'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div
                className="flex flex-wrap border-b border-line"
                role="tablist"
                aria-label="Asset Details"
            >
                <button
                    type="button"
                    role="tab"
                    id={`asset-tab-overview-${asset.id}`}
                    aria-controls={`asset-tabpanel-overview-${asset.id}`}
                    aria-selected={activeTab === 'overview'}
                    tabIndex={activeTab === 'overview' ? 0 : -1}
                    onClick={() => setActiveTab('overview')}
                    className={cn(
                        'flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors md:text-sm',
                        activeTab === 'overview'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    <Gauge className="h-4 w-4" />
                    Overview &amp; Specs
                </button>
                <button
                    type="button"
                    role="tab"
                    id={`asset-tab-telemetry-${asset.id}`}
                    aria-controls={`asset-tabpanel-telemetry-${asset.id}`}
                    aria-selected={activeTab === 'telemetry'}
                    tabIndex={activeTab === 'telemetry' ? 0 : -1}
                    onClick={() => setActiveTab('telemetry')}
                    className={cn(
                        'flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors md:text-sm',
                        activeTab === 'telemetry'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    <MapPin className="h-4 w-4" />
                    Live Telemetry
                    {hasLiveGps && (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-success-strong" />
                    )}
                </button>
                <button
                    type="button"
                    role="tab"
                    id={`asset-tab-status-${asset.id}`}
                    aria-controls={`asset-tabpanel-status-${asset.id}`}
                    aria-selected={activeTab === 'status'}
                    tabIndex={activeTab === 'status' ? 0 : -1}
                    onClick={() => setActiveTab('status')}
                    className={cn(
                        'flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors md:text-sm',
                        activeTab === 'status'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    <ShieldCheck className="h-4 w-4" />
                    Readiness &amp; Status
                </button>
                <button
                    type="button"
                    role="tab"
                    id={`asset-tab-inspections-${asset.id}`}
                    aria-controls={`asset-tabpanel-inspections-${asset.id}`}
                    aria-selected={activeTab === 'inspections'}
                    tabIndex={activeTab === 'inspections' ? 0 : -1}
                    onClick={() => setActiveTab('inspections')}
                    className={cn(
                        'flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors md:text-sm',
                        activeTab === 'inspections'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    <ClipboardCheck className="h-4 w-4" />
                    Inspections
                    <span
                        className={cn(
                            'py-0.2 rounded-full px-1.5 text-[10px] font-semibold',
                            asset.inspections.length > 0
                                ? 'bg-brand-soft text-brand-strong'
                                : 'border border-line bg-surface-subtle text-ink-soft',
                        )}
                    >
                        {asset.inspections.length}
                    </span>
                </button>
                <button
                    type="button"
                    role="tab"
                    id={`asset-tab-maintenance-${asset.id}`}
                    aria-controls={`asset-tabpanel-maintenance-${asset.id}`}
                    aria-selected={activeTab === 'maintenance'}
                    tabIndex={activeTab === 'maintenance' ? 0 : -1}
                    onClick={() => setActiveTab('maintenance')}
                    className={cn(
                        'flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors md:text-sm',
                        activeTab === 'maintenance'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    <Wrench className="h-4 w-4" />
                    Work Orders
                    <span
                        className={cn(
                            'py-0.2 rounded-full px-1.5 text-[10px] font-semibold',
                            asset.blocking_work_orders_count > 0
                                ? 'border border-danger/30 bg-danger-soft text-danger-strong'
                                : asset.maintenance_work_orders.length > 0
                                  ? 'bg-brand-soft text-brand-strong'
                                  : 'border border-line bg-surface-subtle text-ink-soft',
                        )}
                    >
                        {asset.maintenance_work_orders.length}
                    </span>
                </button>
            </div>

            {activeTab === 'overview' && (
                <div
                    role="tabpanel"
                    id={`asset-tabpanel-overview-${asset.id}`}
                    aria-labelledby={`asset-tab-overview-${asset.id}`}
                    className="space-y-4"
                >
                    {/* Field Mobile Parity: Active Operator, HoS, and Latest DVIR */}
                    <div className="space-y-3 rounded-xl border border-line bg-surface-subtle/50 p-4">
                        <h4 className="text-xs font-bold tracking-wider text-ink uppercase">
                            Field Operations &amp; Equipment Hours of Service
                        </h4>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <span className="mb-1.5 block text-xs font-medium text-ink-soft">
                                    Active Field Operator &amp; Telemetry
                                    Freshness
                                </span>
                                <OperatorBindingChip
                                    activeOperator={asset.active_operator}
                                />
                            </div>
                            <div>
                                <span className="mb-1.5 block text-xs font-medium text-ink-soft">
                                    Duty Status &amp; DOLE 10h Compliance
                                </span>
                                {asset.hos ? (
                                    <HosDutyBadge hos={asset.hos} />
                                ) : (
                                    <p className="text-xs text-ink-soft italic">
                                        No active duty log recorded for current
                                        shift
                                    </p>
                                )}
                            </div>
                        </div>

                        {asset.latest_dvir && (
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
                                <div>
                                    <span className="mb-1 block text-xs font-medium text-ink-soft">
                                        Latest DVIR Walkaround Inspection
                                    </span>
                                    <DvirStatusBadge
                                        dvir={asset.latest_dvir}
                                        onViewInspection={() =>
                                            setShowDvirModal(true)
                                        }
                                    />
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setShowDvirModal(true)}
                                >
                                    <Camera className="mr-1.5 h-3.5 w-3.5" />
                                    View 4-Angle Walkaround Photos (
                                    {asset.latest_dvir.photos.length})
                                </Button>
                            </div>
                        )}
                    </div>

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
                                {asset.meter_value !== null &&
                                asset.meter_value !== undefined &&
                                asset.meter_value !== ''
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
                <div
                    role="tabpanel"
                    id={`asset-tabpanel-telemetry-${asset.id}`}
                    aria-labelledby={`asset-tab-telemetry-${asset.id}`}
                >
                    <AssetTelemetrySection
                        asset={asset}
                        location={assetLocation}
                        activeSosIncidents={activeSosIncidents}
                        onViewFullTracking={onViewFullTracking}
                    />
                </div>
            )}

            {activeTab === 'status' && (
                <div
                    role="tabpanel"
                    id={`asset-tabpanel-status-${asset.id}`}
                    aria-labelledby={`asset-tab-status-${asset.id}`}
                >
                    <AssetStatusUpdateForm
                        asset={asset}
                        canUpdate={capabilities.update_asset_status}
                    />
                </div>
            )}

            {activeTab === 'inspections' && (
                <div
                    role="tabpanel"
                    id={`asset-tabpanel-inspections-${asset.id}`}
                    aria-labelledby={`asset-tab-inspections-${asset.id}`}
                >
                    <AssetInspectionsSection
                        asset={asset}
                        canInspect={capabilities.inspect_asset}
                    />
                </div>
            )}

            {activeTab === 'maintenance' && (
                <div
                    role="tabpanel"
                    id={`asset-tabpanel-maintenance-${asset.id}`}
                    aria-labelledby={`asset-tab-maintenance-${asset.id}`}
                >
                    <AssetMaintenanceSection
                        asset={asset}
                        canMaintain={capabilities.maintain_asset}
                    />
                </div>
            )}

            {asset.latest_dvir && (
                <DvirWalkaroundModal
                    isOpen={showDvirModal}
                    onClose={() => setShowDvirModal(false)}
                    dvir={asset.latest_dvir}
                    assetCode={asset.code}
                    assetName={asset.name}
                    isLockedOut={asset.lockout?.is_locked_out}
                    lockoutReason={asset.lockout?.lockout_reason}
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
                                    'bg-warning-strong',
                                location.freshness_status === 'offline' &&
                                    'bg-ink-soft/40',
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

            {/* Hyper-local Site Weather & Wind Safety at Crane GPS Location */}
            <WeatherSafetyTelemetry
                variant="site"
                latitude={location.latitude}
                longitude={location.longitude}
                locationLabel={`${asset.code} Current Telemetry Location`}
                className="mt-3"
            />

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
    const form = useForm<{
        status: AssetStatusValue;
        reason: string;
    }>({
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
                            form.setData(
                                'status',
                                e.target.value as AssetStatusValue,
                            )
                        }
                        aria-invalid={Boolean(form.errors.status)}
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
                <p role="alert" className="text-xs font-medium text-danger">
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
    const form = useForm<{
        type: InspectionTypeValue;
        result: InspectionResultValue;
        checklist: Record<string, boolean>;
        findings: string;
    }>({
        type: 'safety',
        result: 'passed',
        checklist: {
            brakes: true,
            steering: true,
            tires_or_tracks: true,
            hydraulics: true,
            lights_and_signals: true,
        },
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
                                    form.setData(
                                        'type',
                                        e.target.value as InspectionTypeValue,
                                    )
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
                                        e.target.value as InspectionResultValue,
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

function AuditSurface({ events }: { events: AuditEventViewModel[] }) {
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [actorFilter, setActorFilter] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEvent, setSelectedEvent] =
        useState<AuditEventViewModel | null>(null);
    const [copiedBefore, setCopiedBefore] = useState(false);
    const [copiedAfter, setCopiedAfter] = useState(false);
    const [copiedReqId, setCopiedReqId] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
    const exportForm = useForm({
        export_type: 'system_audit',
        format: 'csv',
        date_from: '',
        date_to: '',
    });

    const getActionSeverityBadge = (action: string) => {
        const act = action.toLowerCase();

        if (
            act.includes('emergency') ||
            act.includes('suspend') ||
            act.includes('abort') ||
            act.includes('lock') ||
            act.includes('reject') ||
            act.includes('fail')
        ) {
            return 'bg-danger-soft text-danger-strong border border-danger/30';
        }

        if (
            act.includes('override') ||
            act.includes('approval') ||
            act.includes('reopen') ||
            act.includes('handover') ||
            act.includes('warning')
        ) {
            return 'bg-warning-soft text-warning-strong border border-warning/30';
        }

        if (
            act.includes('gpt') ||
            act.includes('ai') ||
            act.includes('circuit')
        ) {
            return 'bg-brand-soft text-brand-strong border border-brand/30';
        }

        if (
            act.includes('user') ||
            act.includes('role') ||
            act.includes('cred') ||
            act.includes('access') ||
            act.includes('auth') ||
            act.includes('login')
        ) {
            return 'bg-surface-subtle text-ink border border-line';
        }

        return 'bg-success-soft text-success-strong border border-success/30';
    };

    const handleSetDatePreset = (preset: 'all' | 'today' | '7d' | '30d') => {
        if (preset === 'all') {
            setStartDate('');
            setEndDate('');

            return;
        }

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const toStr = (d: Date) =>
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        const endStr = toStr(now);
        setEndDate(endStr);

        if (preset === 'today') {
            setStartDate(endStr);
        } else if (preset === '7d') {
            const past = new Date(now);
            past.setDate(past.getDate() - 7);
            setStartDate(toStr(past));
        } else if (preset === '30d') {
            const past = new Date(now);
            past.setDate(past.getDate() - 30);
            setStartDate(toStr(past));
        }
    };

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

    const uniqueActors = useMemo(() => {
        const map = new Map<number, string>();
        events.forEach((e) => {
            if (e.actor) {
                map.set(e.actor.id, e.actor.name);
            }
        });

        return Array.from(map.entries());
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

            if (actorFilter !== 'all') {
                if (actorFilter === 'system') {
                    if (event.actor !== null) {
                        return false;
                    }
                } else if (event.actor?.id !== Number(actorFilter)) {
                    return false;
                }
            }

            if (startDate !== '') {
                if (
                    !event.occurred_at ||
                    new Date(event.occurred_at) <
                        new Date(`${startDate}T00:00:00`)
                ) {
                    return false;
                }
            }

            if (endDate !== '') {
                if (
                    !event.occurred_at ||
                    new Date(event.occurred_at) >
                        new Date(`${endDate}T23:59:59`)
                ) {
                    return false;
                }
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
    }, [events, actionFilter, actorFilter, startDate, endDate, searchQuery]);

    const handleDirectCsvDownload = () => {
        if (filteredEvents.length === 0) {
            return;
        }

        const headers = [
            'Event ID',
            'Timestamp',
            'Actor Name',
            'Action Type',
            'Subject Type',
            'Subject ID',
            'Operational Reason',
            'IP Address',
            'Request Correlation UUID',
            'Prior State (Before)',
            'New State (After)',
        ];

        const escapeCsvField = (val: string | number | null | undefined) => {
            if (val === null || val === undefined) {
                return '""';
            }

            const str = String(val);
            const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;

            return `"${sanitized.replace(/"/g, '""')}"`;
        };

        const rows = filteredEvents.map((e) => [
            escapeCsvField(e.id),
            escapeCsvField(e.occurred_at),
            escapeCsvField(e.actor?.name ?? 'System Observer'),
            escapeCsvField(e.action),
            escapeCsvField(e.subject_type),
            escapeCsvField(e.subject_id),
            escapeCsvField(e.reason ?? 'No operational reason recorded'),
            escapeCsvField(e.ip_address ?? '127.0.0.1'),
            escapeCsvField(e.request_id ?? 'N/A'),
            escapeCsvField(e.before ? JSON.stringify(e.before) : ''),
            escapeCsvField(e.after ? JSON.stringify(e.after) : ''),
        ]);

        const csvContent =
            '\uFEFF' +
            [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

        const blob = new Blob([csvContent], {
            type: 'text/csv;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStamp = new Date().toISOString().split('T')[0];
        link.setAttribute('download', `core2-audit-trail-${dateStamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDirectPrintPdf = () => {
        if (filteredEvents.length === 0) {
            return;
        }

        const printWindow = window.open('', '_blank');

        if (!printWindow) {
            window.print();

            return;
        }

        const dateStamp = new Date().toISOString().split('T')[0];

        const escapeHtml = (str: string | number | null | undefined) => {
            if (str === null || str === undefined) {
                return '';
            }

            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        };

        const rowsHtml = filteredEvents
            .map(
                (e) => `
                <tr>
                    <td style="font-family: monospace; font-size: 10px;">#${escapeHtml(e.id)}</td>
                    <td style="white-space: nowrap;">${escapeHtml(e.occurred_at ? new Date(e.occurred_at).toLocaleString() : '—')}</td>
                    <td><strong>${escapeHtml(e.actor?.name ?? 'System')}</strong></td>
                    <td><code style="background: #f1f5f9; padding: 2px 4px; border-radius: 3px; font-size: 9px;">${escapeHtml(e.action)}</code></td>
                    <td>${escapeHtml((e.subject_type ? e.subject_type.split('\\').pop() : 'Record') ?? 'Record')} #${escapeHtml(e.subject_id ?? 'N/A')}</td>
                    <td style="font-size: 9.5px;">${escapeHtml(e.reason ?? 'Compliance / Operational Log')}</td>
                </tr>
            `,
            )
            .join('');

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Core-2 Compliance & Audit Trail Report (${dateStamp})</title>
    <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 10px; color: #0f172a; margin: 0; padding: 15px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
        .title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 3px 0; }
        .subtitle { font-size: 10px; color: #475569; margin: 0; }
        .badge { background: #0f172a; color: #fff; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
        .metadata { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 9.5px; }
        .meta-item strong { color: #334155; display: block; font-size: 8.5px; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
        th { background: #f1f5f9; text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 9.5px; text-transform: uppercase; color: #334155; }
        td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 6px; display: flex; justify-content: space-between; font-size: 8.5px; color: #94a3b8; }
        @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1 class="title">Core Transaction 2 · Compliance & Audit Trail Report</h1>
            <p class="subtitle">Immutable forensic log of state transitions, approvals, user actions, and cryptographic telemetry.</p>
        </div>
        <div style="text-align: right;">
            <span class="badge">Forensic Audit Export</span>
        </div>
    </div>

    <div class="metadata">
        <div class="meta-item"><strong>Generated On</strong> ${new Date().toUTCString()}</div>
        <div class="meta-item"><strong>Record Count</strong> ${filteredEvents.length} active events</div>
        <div class="meta-item"><strong>Date Scope</strong> ${dateStamp} (${startDate || 'Earliest'} → ${endDate || 'Latest'})</div>
        <div class="meta-item"><strong>Filters Active</strong> Action: ${escapeHtml(actionFilter)} | Actor: ${escapeHtml(actorFilter)}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 45px;">ID</th>
                <th style="width: 120px;">Timestamp (UTC)</th>
                <th style="width: 110px;">Actor</th>
                <th style="width: 140px;">Action</th>
                <th style="width: 110px;">Subject</th>
                <th>Context / Operational Reason</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>

    <div class="footer">
        <span>Confidential & Proprietary · Core-2 Heavy Lifting & Crane ERP</span>
        <span>SHA-256 Validated · Page 1 of 1</span>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); }, 150);
        };
    </script>
</body>
</html>`;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleQueueServerExport = (e: FormEvent) => {
        e.preventDefault();
        exportForm.transform(() => ({
            export_type: 'system_audit',
            format: exportFormat,
            date_from: startDate || '',
            date_to: endDate || '',
        }));
        exportForm.post('/operations/reports/exports', {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setShowExportModal(false);
            },
        });
    };

    return (
        <div>
            <PageHeading
                title="Audit trail & compliance log"
                description="Immutable forensic log of approvals, overrides, state transitions, GPT advisory decisions, user access, and cryptographic telemetry."
                actions={
                    <Button
                        variant="secondary"
                        onClick={() => setShowExportModal(true)}
                    >
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
                    <button
                        type="button"
                        onClick={() => setActionFilter('all')}
                        className={cn(
                            'rounded-xl border p-3.5 text-left shadow-sm transition-all',
                            actionFilter === 'all'
                                ? 'border-brand bg-brand-soft/30 ring-2 ring-brand'
                                : 'border-line bg-surface hover:bg-surface-subtle',
                        )}
                    >
                        <span className="text-xs font-medium text-ink-soft">
                            Total Events
                        </span>
                        <p className="mt-1 text-2xl font-bold text-ink">
                            {stats.total}
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setActionFilter(
                                actionFilter === 'overrides'
                                    ? 'all'
                                    : 'overrides',
                            )
                        }
                        className={cn(
                            'rounded-xl border p-3.5 text-left shadow-sm transition-all',
                            actionFilter === 'overrides'
                                ? 'border-warning-strong bg-warning-soft/70 ring-2 ring-warning'
                                : 'border-warning/30 bg-warning-soft/30 hover:bg-warning-soft/50',
                        )}
                    >
                        <span className="text-xs font-medium text-warning-strong">
                            Approvals & Overrides
                        </span>
                        <p className="mt-1 text-2xl font-bold text-warning-strong">
                            {stats.overrides}
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setActionFilter(
                                actionFilter === 'transitions'
                                    ? 'all'
                                    : 'transitions',
                            )
                        }
                        className={cn(
                            'rounded-xl border p-3.5 text-left shadow-sm transition-all',
                            actionFilter === 'transitions'
                                ? 'border-brand bg-brand-soft/30 ring-2 ring-brand'
                                : 'border-line bg-surface hover:bg-surface-subtle',
                        )}
                    >
                        <span className="text-xs font-medium text-ink-soft">
                            State Transitions
                        </span>
                        <p className="mt-1 text-2xl font-bold text-ink">
                            {stats.transitions}
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setActionFilter(
                                actionFilter === 'gpt' ? 'all' : 'gpt',
                            )
                        }
                        className={cn(
                            'rounded-xl border p-3.5 text-left shadow-sm transition-all',
                            actionFilter === 'gpt'
                                ? 'border-brand-strong bg-brand-soft/70 ring-2 ring-brand'
                                : 'border-brand/30 bg-brand-soft/30 hover:bg-brand-soft/50',
                        )}
                    >
                        <span className="text-xs font-medium text-brand-strong">
                            GPT AI Decisions
                        </span>
                        <p className="mt-1 text-2xl font-bold text-brand-strong">
                            {stats.gpt}
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setActionFilter(
                                actionFilter === 'access' ? 'all' : 'access',
                            )
                        }
                        className={cn(
                            'rounded-xl border p-3.5 text-left shadow-sm transition-all',
                            actionFilter === 'access'
                                ? 'border-brand bg-brand-soft/30 ring-2 ring-brand'
                                : 'border-line bg-surface hover:bg-surface-subtle',
                        )}
                    >
                        <span className="text-xs font-medium text-ink-soft">
                            Access & Security
                        </span>
                        <p className="mt-1 text-2xl font-bold text-ink">
                            {stats.userAccess}
                        </p>
                    </button>
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

                {/* Temporal Range & Actor Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 text-xs shadow-xs">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink-soft">
                                Temporal Range:
                            </span>
                            <div className="w-36">
                                <DateTimePicker
                                    id="audit-start-date"
                                    value={startDate}
                                    onChange={(val) => {
                                        setStartDate(
                                            val ? val.split('T')[0] : '',
                                        );
                                    }}
                                    includeTime={false}
                                    showPresets={false}
                                    placeholder="Start date…"
                                    className="text-xs"
                                />
                            </div>
                            <span className="text-xs text-ink-soft">to</span>
                            <div className="w-36">
                                <DateTimePicker
                                    id="audit-end-date"
                                    value={endDate}
                                    onChange={(val) => {
                                        setEndDate(
                                            val ? val.split('T')[0] : '',
                                        );
                                    }}
                                    includeTime={false}
                                    showPresets={false}
                                    placeholder="End date…"
                                    className="text-xs"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1">
                            <button
                                type="button"
                                onClick={() => handleSetDatePreset('today')}
                                className={cn(
                                    'rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
                                    startDate !== '' && startDate === endDate
                                        ? 'border-brand bg-brand-soft font-semibold text-brand-strong'
                                        : 'border-line bg-surface-subtle text-ink-soft hover:text-ink',
                                )}
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetDatePreset('7d')}
                                className="rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-ink-soft hover:text-ink"
                            >
                                Past 7 Days
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetDatePreset('30d')}
                                className="rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-ink-soft hover:text-ink"
                            >
                                Past 30 Days
                            </button>
                            {(startDate ||
                                endDate ||
                                actorFilter !== 'all') && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSetDatePreset('all');
                                        setActorFilter('all');
                                    }}
                                    className="rounded-md border border-danger/30 bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger-strong hover:bg-danger-soft/80"
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink-soft">
                            Actor:
                        </span>
                        <select
                            value={actorFilter}
                            onChange={(e) => setActorFilter(e.target.value)}
                            className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none"
                            aria-label="Filter by actor"
                        >
                            <option value="all">
                                All Actors ({stats.total})
                            </option>
                            <option value="system">System Observer</option>
                            {uniqueActors.map(([id, name]) => (
                                <option key={id} value={id}>
                                    {name}
                                </option>
                            ))}
                        </select>
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
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold',
                                                            getActionSeverityBadge(
                                                                event.action,
                                                            ),
                                                        )}
                                                    >
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
                                    <span
                                        className={cn(
                                            'rounded-md px-2 py-0.5 font-mono text-sm font-bold',
                                            getActionSeverityBadge(
                                                selectedEvent.action,
                                            ),
                                        )}
                                    >
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
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold text-ink-soft uppercase">
                                        Request Correlation UUID
                                    </span>
                                    {selectedEvent.request_id && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(
                                                    selectedEvent.request_id ??
                                                        '',
                                                );
                                                setCopiedReqId(true);
                                                setTimeout(
                                                    () => setCopiedReqId(false),
                                                    2000,
                                                );
                                            }}
                                            className="text-[10px] font-medium text-brand-strong hover:underline"
                                        >
                                            {copiedReqId
                                                ? 'Copied!'
                                                : 'Copy UUID'}
                                        </button>
                                    )}
                                </div>
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
                                        <div className="flex items-center justify-between border-b border-line bg-danger-soft/40 px-3 py-2 text-xs font-semibold text-danger-strong">
                                            <span>Prior State (Before)</span>
                                            {selectedEvent.before && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(
                                                            JSON.stringify(
                                                                selectedEvent.before,
                                                                null,
                                                                2,
                                                            ),
                                                        );
                                                        setCopiedBefore(true);
                                                        setTimeout(
                                                            () =>
                                                                setCopiedBefore(
                                                                    false,
                                                                ),
                                                            2000,
                                                        );
                                                    }}
                                                    className="text-[10px] font-medium text-danger-strong hover:underline"
                                                >
                                                    {copiedBefore
                                                        ? 'Copied!'
                                                        : 'Copy JSON'}
                                                </button>
                                            )}
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
                                        <div className="flex items-center justify-between border-b border-line bg-success-soft/40 px-3 py-2 text-xs font-semibold text-success-strong">
                                            <span>New State (After)</span>
                                            {selectedEvent.after && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(
                                                            JSON.stringify(
                                                                selectedEvent.after,
                                                                null,
                                                                2,
                                                            ),
                                                        );
                                                        setCopiedAfter(true);
                                                        setTimeout(
                                                            () =>
                                                                setCopiedAfter(
                                                                    false,
                                                                ),
                                                            2000,
                                                        );
                                                    }}
                                                    className="text-[10px] font-medium text-success-strong hover:underline"
                                                >
                                                    {copiedAfter
                                                        ? 'Copied!'
                                                        : 'Copy JSON'}
                                                </button>
                                            )}
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

            {/* Modal: Export Audit Trail Dataset */}
            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <div className="flex items-center gap-2">
                                <div className="rounded-lg bg-brand-soft p-2 text-brand-strong">
                                    <DownloadCloud className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-ink">
                                        Export Audit Dataset
                                    </h4>
                                    <p className="text-xs text-ink-soft">
                                        Download immediate CSV or queue an
                                        asynchronous export.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                className="rounded-lg p-1 text-ink-soft hover:bg-surface-subtle"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Active Scope Summary */}
                        <div className="mt-4 space-y-2 rounded-xl border border-line bg-surface-subtle p-3 text-xs">
                            <div className="flex justify-between">
                                <span className="text-ink-soft">
                                    Active Category:
                                </span>
                                <span className="font-semibold text-ink uppercase">
                                    {actionFilter}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-ink-soft">
                                    Actor Scope:
                                </span>
                                <span className="font-semibold text-ink">
                                    {actorFilter === 'all'
                                        ? 'All Actors'
                                        : actorFilter === 'system'
                                          ? 'System Observer'
                                          : (uniqueActors.find(
                                                ([id]) =>
                                                    id === Number(actorFilter),
                                            )?.[1] ?? actorFilter)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-ink-soft">
                                    Temporal Range:
                                </span>
                                <span className="font-mono text-ink">
                                    {startDate || 'Beginning'} &rarr;{' '}
                                    {endDate || 'Latest'}
                                </span>
                            </div>
                            <div className="flex justify-between border-t border-line pt-1 font-bold">
                                <span className="text-ink">
                                    Records In Scope:
                                </span>
                                <span className="text-brand-strong">
                                    {filteredEvents.length} events
                                </span>
                            </div>
                        </div>

                        {/* Dual Export Methods */}
                        <div className="mt-5 space-y-4">
                            {/* Method 1: Instant Direct CSV Download */}
                            <div className="rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand/40">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 font-semibold text-ink">
                                        <FileSpreadsheet className="h-4 w-4 text-success-strong" />
                                        <span>
                                            Instant Filtered CSV Download
                                        </span>
                                    </div>
                                    <p className="text-xs text-ink-soft">
                                        Immediately downloads the{' '}
                                        {filteredEvents.length} currently
                                        filtered records directly to your device
                                        with full before/after JSON state
                                        payloads.
                                    </p>
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => {
                                            handleDirectCsvDownload();
                                            setShowExportModal(false);
                                        }}
                                        disabled={filteredEvents.length === 0}
                                        className="w-full justify-center text-xs"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Instant CSV ({filteredEvents.length})
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => {
                                            handleDirectPrintPdf();
                                            setShowExportModal(false);
                                        }}
                                        disabled={filteredEvents.length === 0}
                                        className="w-full justify-center text-xs"
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                        Print / PDF ({filteredEvents.length})
                                    </Button>
                                </div>
                            </div>

                            {/* Method 2: Queue Server Export */}
                            <form
                                onSubmit={handleQueueServerExport}
                                className="rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand/40"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 font-semibold text-ink">
                                        <DownloadCloud className="h-4 w-4 text-brand-strong" />
                                        <span>
                                            Queue Background Server Export
                                        </span>
                                    </div>
                                    <p className="text-xs text-ink-soft">
                                        Dispatches a background worker job to
                                        generate and archive an official audit
                                        export dataset.
                                    </p>
                                </div>

                                <div className="mt-2 rounded-lg border border-line bg-surface-subtle px-2.5 py-1.5 text-[11px] text-ink-soft">
                                    {startDate || endDate ? (
                                        <span>
                                            ⚡ Scope:{' '}
                                            <strong className="text-ink">
                                                Queries full database archive
                                            </strong>{' '}
                                            from{' '}
                                            <code className="text-brand-strong">
                                                {startDate || 'Beginning'}
                                            </code>{' '}
                                            to{' '}
                                            <code className="text-brand-strong">
                                                {endDate || 'Latest'}
                                            </code>
                                            .
                                        </span>
                                    ) : (
                                        <span>
                                            ⚡ Scope:{' '}
                                            <strong className="text-ink">
                                                Full historical database archive
                                            </strong>{' '}
                                            (all recorded audit events).
                                        </span>
                                    )}
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <label
                                        className={cn(
                                            'flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs transition-all',
                                            exportFormat === 'csv'
                                                ? 'border-brand bg-brand-soft/40 font-semibold text-brand-strong ring-1 ring-brand'
                                                : 'border-line bg-surface text-ink hover:bg-surface-subtle',
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="format"
                                            value="csv"
                                            checked={exportFormat === 'csv'}
                                            onChange={() =>
                                                setExportFormat('csv')
                                            }
                                            className="text-brand focus:ring-brand"
                                        />
                                        <span>CSV Dataset</span>
                                    </label>
                                    <label
                                        className={cn(
                                            'flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs transition-all',
                                            exportFormat === 'pdf'
                                                ? 'border-brand bg-brand-soft/40 font-semibold text-brand-strong ring-1 ring-brand'
                                                : 'border-line bg-surface text-ink hover:bg-surface-subtle',
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="format"
                                            value="pdf"
                                            checked={exportFormat === 'pdf'}
                                            onChange={() =>
                                                setExportFormat('pdf')
                                            }
                                            className="text-brand focus:ring-brand"
                                        />
                                        <span>Printable PDF</span>
                                    </label>
                                </div>

                                {Object.keys(exportForm.errors).length > 0 && (
                                    <div className="mt-2 rounded-md bg-danger-soft p-2 text-xs text-danger-strong">
                                        {Object.values(exportForm.errors).join(
                                            ' ',
                                        )}
                                    </div>
                                )}

                                <div className="mt-3">
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={exportForm.processing}
                                        className="w-full justify-center text-xs"
                                    >
                                        {exportForm.processing ? (
                                            'Dispatching Server Job…'
                                        ) : (
                                            <>
                                                <DownloadCloud className="h-3.5 w-3.5" />
                                                Request Server Background Export
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>

                        <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-[11px] text-ink-soft">
                            <span>
                                💡 Server exports are archived under the{' '}
                                <a
                                    href="/operations?section=reports"
                                    className="font-medium text-brand-strong underline hover:text-brand"
                                >
                                    Exports Archive
                                </a>{' '}
                                (available 24h).
                            </span>
                            <Button
                                variant="secondary"
                                onClick={() => setShowExportModal(false)}
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
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    placeholder?: string;
}) {
    return (
        <label className="text-sm font-medium">
            {label}
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? 'true' : undefined}
                className={cn(
                    'mt-1 h-11 w-full rounded-lg border bg-surface px-3 text-xs placeholder:text-ink-soft/60',
                    error ? 'border-danger' : 'border-line-strong',
                )}
            />
            {error && (
                <span className="mt-1 block text-xs text-danger">{error}</span>
            )}
        </label>
    );
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
