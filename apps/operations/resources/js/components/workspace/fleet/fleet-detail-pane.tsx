import { useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Camera,
    Check,
    ClipboardCheck,
    Copy,
    FileText,
    Gauge,
    Radio,
    ShieldAlert,
    ShieldCheck,
    Wrench,
} from 'lucide-react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import { Button, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { DvirStatusBadge } from '@/components/workspace/fleet/dvir-status-badge';
import { DvirWalkaroundModal } from '@/components/workspace/fleet/dvir-walkaround-modal';
import { getFleetDispatchabilityState } from '@/components/workspace/fleet/fleet-dispatchability';
import { FleetDocumentsSection } from '@/components/workspace/fleet/fleet-documents-section';
import { FleetInspectionsSection } from '@/components/workspace/fleet/fleet-inspections-section';
import {
    getFleetLocationFreshnessLabel,
    hasLocationCoordinates,
} from '@/components/workspace/fleet/fleet-location-labels';
import { FleetMaintenanceSection } from '@/components/workspace/fleet/fleet-maintenance-section';
import { FleetQuickActionToolbar } from '@/components/workspace/fleet/fleet-quick-action-toolbar';
import { FleetStatusForm } from '@/components/workspace/fleet/fleet-status-form';
import { HosDutyBadge } from '@/components/workspace/fleet/hos-duty-badge';
import { OperatorBindingChip } from '@/components/workspace/fleet/operator-binding-chip';
import { SafetyLockoutBanner } from '@/components/workspace/fleet/safety-lockout-banner';
import { humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    DvirInspectionViewModel,
    LocationUpdateViewModel,
    SosIncidentViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

export interface FleetDetailPaneProps {
    asset: AssetViewModel;
    assetLocation?: LocationUpdateViewModel | null;
    activeSosIncidents?: SosIncidentViewModel[];
    capabilities: WorkspaceCapabilities;
    onViewFullTracking?: () => void;
    onBackToList?: () => void;
}

const DETAIL_TABS = [
    'overview',
    'status',
    'inspections',
    'maintenance',
    'documents',
] as const;

type DetailTab = (typeof DETAIL_TABS)[number];

export function FleetDetailPane({
    asset,
    assetLocation,
    capabilities,
    onViewFullTracking,
    onBackToList,
}: FleetDetailPaneProps) {
    const [activeTab, setActiveTab] = useState<DetailTab>('overview');

    const [showDvirModal, setShowDvirModal] = useState(false);
    const [selectedDvir, setSelectedDvir] = useState<
        | NonNullable<AssetViewModel['latest_dvir']>
        | DvirInspectionViewModel
        | null
    >(null);
    const [showLockdownModal, setShowLockdownModal] = useState(false);
    const lockdownTriggerRef = useRef<HTMLButtonElement | null>(null);
    const lockdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const tabRefs = useRef<
        Partial<Record<DetailTab, HTMLButtonElement | null>>
    >({});

    const lockdownForm = useForm({
        reason: '',
    });

    const hasFreshLocation =
        assetLocation &&
        hasLocationCoordinates(assetLocation) &&
        assetLocation.freshness_status === 'fresh';
    const dispatchabilityState = getFleetDispatchabilityState(asset);

    const [coordinatesCopied, setCoordinatesCopied] = useState(false);

    const copyCoordinates = async () => {
        if (!assetLocation || !hasLocationCoordinates(assetLocation)) {
            return;
        }

        try {
            await navigator.clipboard.writeText(
                `${assetLocation.latitude.toFixed(5)}, ${assetLocation.longitude.toFixed(5)}`,
            );
            setCoordinatesCopied(true);
            window.setTimeout(() => setCoordinatesCopied(false), 2000);
        } catch {
            setCoordinatesCopied(false);
        }
    };

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
                preserveState: true,
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

    const handleTabKeyDown = (
        event: ReactKeyboardEvent<HTMLButtonElement>,
        currentTab: DetailTab,
    ) => {
        const currentIndex = DETAIL_TABS.indexOf(currentTab);
        let nextIndex: number | null = null;

        if (event.key === 'ArrowRight') {
            nextIndex = (currentIndex + 1) % DETAIL_TABS.length;
        } else if (event.key === 'ArrowLeft') {
            nextIndex =
                (currentIndex - 1 + DETAIL_TABS.length) % DETAIL_TABS.length;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = DETAIL_TABS.length - 1;
        }

        if (nextIndex === null) {
            return;
        }

        event.preventDefault();
        const nextTab = DETAIL_TABS[nextIndex];
        setActiveTab(nextTab);
        tabRefs.current[nextTab]?.focus();
    };

    const dvirCount =
        asset.dvir_inspections && asset.dvir_inspections.length > 0
            ? asset.dvir_inspections.length
            : asset.latest_dvir
              ? 1
              : 0;
    const totalInspectionsCount = asset.inspections.length + dvirCount;

    return (
        <Panel className="flex min-h-0 flex-col gap-4 p-4 md:p-6 lg:h-full lg:overflow-hidden [&>*]:shrink-0">
            {onBackToList && (
                <div className="pb-2 lg:hidden">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onBackToList}
                        className="inline-flex items-center gap-1.5"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to fleet list
                    </Button>
                </div>
            )}

            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="text-xl font-bold text-ink">
                            {asset.code}
                        </span>
                        <CanonicalStatusBadge
                            status={asset.status}
                            variant="minimal"
                            size="md"
                            presentation="inline"
                        />
                        {assetLocation && (
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1.5 text-xs font-semibold',
                                    hasFreshLocation
                                        ? 'text-success-strong'
                                        : 'text-ink-soft',
                                )}
                            >
                                {hasFreshLocation ? (
                                    <Radio className="h-3 w-3 animate-pulse text-success-strong" />
                                ) : (
                                    <span className="h-1.5 w-1.5 rounded-full bg-ink-soft/50" />
                                )}
                                {getFleetLocationFreshnessLabel(assetLocation)}
                            </span>
                        )}
                        {dispatchabilityState === 'ready' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-strong">
                                <span
                                    className="h-1.5 w-1.5 rounded-full bg-success-strong"
                                    aria-hidden="true"
                                />
                                Ready for dispatch
                            </span>
                        ) : dispatchabilityState === 'blocking_work_orders' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning-strong">
                                <Wrench
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                {asset.blocking_work_orders_count} blocking work
                                order
                                {asset.blocking_work_orders_count > 1
                                    ? 's'
                                    : ''}
                            </span>
                        ) : dispatchabilityState === 'inspection_required' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning-strong">
                                <ShieldAlert
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                Inspection required before dispatch
                            </span>
                        ) : null}
                    </div>
                    <h2 className="mt-1 text-lg font-semibold text-ink">
                        {asset.name}
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-soft">
                        {humanize(asset.kind)}{' '}
                        {asset.subtype ? `· ${asset.subtype}` : ''} · Location:{' '}
                        {assetLocation &&
                        hasLocationCoordinates(assetLocation) ? (
                            <span className="inline-flex flex-wrap items-center gap-2">
                                <span className="tabular-nums">
                                    {hasFreshLocation
                                        ? 'Current position'
                                        : 'Last known location'}{' '}
                                    ({assetLocation.latitude.toFixed(4)},{' '}
                                    {assetLocation.longitude.toFixed(4)})
                                </span>
                                <Button
                                    type="button"
                                    variant="quiet"
                                    size="sm"
                                    className="min-h-8 px-2 text-xs"
                                    onClick={() => void copyCoordinates()}
                                    aria-label={`Copy coordinates for ${asset.code}`}
                                >
                                    {coordinatesCopied ? (
                                        <Check
                                            className="mr-1 h-3.5 w-3.5 text-success-strong"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <Copy
                                            className="mr-1 h-3.5 w-3.5"
                                            aria-hidden="true"
                                        />
                                    )}
                                    {coordinatesCopied
                                        ? 'Copied'
                                        : 'Copy coordinates'}
                                </Button>
                            </span>
                        ) : (
                            (assetLocation?.recorded_location ??
                            asset.location ??
                            'Location not recorded')
                        )}
                    </p>
                </div>

                <FleetQuickActionToolbar
                    asset={asset}
                    assetLocation={assetLocation}
                    capabilities={capabilities}
                    onSelectTab={setActiveTab}
                    onOpenLockdown={() => setShowLockdownModal(true)}
                    onViewFullTracking={onViewFullTracking}
                    onViewDvir={() => {
                        setSelectedDvir(asset.latest_dvir ?? null);
                        setShowDvirModal(true);
                    }}
                    lockdownTriggerRef={lockdownTriggerRef}
                    className="w-full lg:w-auto lg:justify-end"
                />
            </div>

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
                                        'mt-1 w-full rounded-lg border bg-surface p-2.5 text-xs text-ink placeholder:text-ink-soft focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
                                        lockdownForm.errors.reason
                                            ? 'border-danger focus:border-danger'
                                            : 'border-line focus:border-brand-strong',
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
                className="flex min-w-0 flex-nowrap overflow-x-auto overscroll-x-contain border-b border-line"
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
                    ref={(element) => {
                        tabRefs.current.overview = element;
                    }}
                    onClick={() => setActiveTab('overview')}
                    onKeyDown={(event) => handleTabKeyDown(event, 'overview')}
                    className={cn(
                        'flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
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
                    id={`asset-tab-status-${asset.id}`}
                    aria-controls={`asset-tabpanel-status-${asset.id}`}
                    aria-selected={activeTab === 'status'}
                    tabIndex={activeTab === 'status' ? 0 : -1}
                    ref={(element) => {
                        tabRefs.current.status = element;
                    }}
                    onClick={() => setActiveTab('status')}
                    onKeyDown={(event) => handleTabKeyDown(event, 'status')}
                    className={cn(
                        'flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
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
                    ref={(element) => {
                        tabRefs.current.inspections = element;
                    }}
                    onClick={() => setActiveTab('inspections')}
                    onKeyDown={(event) =>
                        handleTabKeyDown(event, 'inspections')
                    }
                    className={cn(
                        'flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
                        activeTab === 'inspections'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    <ClipboardCheck className="h-4 w-4" />
                    Inspections
                    <span
                        className={cn(
                            'text-xs font-semibold tabular-nums',
                            totalInspectionsCount > 0
                                ? 'text-brand-strong'
                                : 'text-ink-soft',
                        )}
                    >
                        {totalInspectionsCount}
                    </span>
                </button>
                <button
                    type="button"
                    role="tab"
                    id={`asset-tab-maintenance-${asset.id}`}
                    aria-controls={`asset-tabpanel-maintenance-${asset.id}`}
                    aria-selected={activeTab === 'maintenance'}
                    tabIndex={activeTab === 'maintenance' ? 0 : -1}
                    ref={(element) => {
                        tabRefs.current.maintenance = element;
                    }}
                    onClick={() => setActiveTab('maintenance')}
                    onKeyDown={(event) =>
                        handleTabKeyDown(event, 'maintenance')
                    }
                    className={cn(
                        'flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
                        activeTab === 'maintenance'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    <Wrench className="h-4 w-4" />
                    Work Orders
                    <span
                        className={cn(
                            'text-xs font-semibold tabular-nums',
                            asset.blocking_work_orders_count > 0
                                ? 'text-danger-strong'
                                : asset.maintenance_work_orders.length > 0
                                  ? 'text-brand-strong'
                                  : 'text-ink-soft',
                        )}
                    >
                        {asset.maintenance_work_orders.length}
                    </span>
                </button>
                <button
                    type="button"
                    role="tab"
                    id={`asset-tab-documents-${asset.id}`}
                    aria-controls={`asset-tabpanel-documents-${asset.id}`}
                    aria-selected={activeTab === 'documents'}
                    tabIndex={activeTab === 'documents' ? 0 : -1}
                    ref={(element) => {
                        tabRefs.current.documents = element;
                    }}
                    onClick={() => setActiveTab('documents')}
                    onKeyDown={(event) => handleTabKeyDown(event, 'documents')}
                    className={cn(
                        'flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden',
                        activeTab === 'documents'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    <FileText className="h-4 w-4" />
                    Permits &amp; Docs
                    <span
                        className={cn(
                            'text-xs font-semibold tabular-nums',
                            (asset.documents?.length ?? 0) > 0
                                ? 'text-brand-strong'
                                : 'text-ink-soft',
                        )}
                    >
                        {asset.documents?.length ?? 0}
                    </span>
                </button>
            </div>

            <div
                key={activeTab}
                className="min-h-0 space-y-5 pt-1 lg:flex-1 lg:shrink! lg:overflow-y-auto lg:overscroll-contain"
                role="region"
                aria-label="Asset detail content"
                tabIndex={0}
            >
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
                {activeTab === 'overview' && (
                    <div
                        role="tabpanel"
                        id={`asset-tabpanel-overview-${asset.id}`}
                        aria-labelledby={`asset-tab-overview-${asset.id}`}
                        className="space-y-5"
                    >
                        {/* Field Mobile Parity: Active Operator, HoS, and Latest DVIR */}
                        <section className="space-y-4 border-y border-line py-4">
                            <h4 className="text-sm font-semibold text-ink">
                                Field operations &amp; hours of service
                            </h4>
                            <div className="grid gap-5 md:grid-cols-2">
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
                                            No active duty log recorded for
                                            current shift
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
                                        <span className="tabular-nums">
                                            {asset.latest_dvir.photos.length}
                                        </span>
                                        )
                                    </Button>
                                </div>
                            )}
                        </section>

                        <dl className="grid gap-x-6 gap-y-0 sm:grid-cols-2 md:grid-cols-3">
                            <div className="border-b border-line py-3">
                                <dt className="text-xs font-medium text-ink-soft">
                                    Registration Number
                                </dt>
                                <dd className="mt-1 text-sm font-semibold text-ink tabular-nums">
                                    {asset.registration_number ?? 'N/A'}
                                </dd>
                            </div>
                            <div className="border-b border-line py-3">
                                <dt className="text-xs font-medium text-ink-soft">
                                    Manufacturer &amp; Model
                                </dt>
                                <dd className="mt-1 text-sm font-semibold text-ink">
                                    {asset.manufacturer ?? 'N/A'}{' '}
                                    {asset.model ?? ''}
                                </dd>
                            </div>
                            <div className="border-b border-line py-3">
                                <dt className="text-xs font-medium text-ink-soft">
                                    Rated Capacity
                                </dt>
                                <dd className="mt-1 text-sm font-semibold text-ink tabular-nums">
                                    {asset.rated_capacity
                                        ? `${asset.rated_capacity}${asset.capacity_unit ? ` ${asset.capacity_unit}` : ''}`
                                        : 'Not recorded'}
                                </dd>
                            </div>
                            <div className="border-b border-line py-3">
                                <dt className="text-xs font-medium text-ink-soft">
                                    Meter Reading
                                </dt>
                                <dd className="mt-1 text-sm font-semibold text-ink tabular-nums">
                                    {asset.meter_value !== null &&
                                    asset.meter_value !== undefined &&
                                    asset.meter_value !== ''
                                        ? `${asset.meter_value} (${asset.meter_type ?? 'units'})`
                                        : 'N/A'}
                                </dd>
                            </div>
                            <div className="border-b border-line py-3">
                                <dt className="text-xs font-medium text-ink-soft">
                                    Unresolved Safety Blocks
                                </dt>
                                <dd className="mt-1 text-sm font-semibold">
                                    {asset.blocking_work_orders_count > 0 ? (
                                        <span className="text-danger">
                                            <span className="tabular-nums">
                                                {
                                                    asset.blocking_work_orders_count
                                                }
                                            </span>{' '}
                                            open orders
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
                            <div className="pt-1">
                                <h4 className="text-sm font-semibold text-ink">
                                    Custom specifications
                                </h4>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    {Object.entries(asset.specifications).map(
                                        ([key, val]) => (
                                            <div
                                                key={key}
                                                className="flex justify-between rounded border border-line px-3 py-1.5 text-sm"
                                            >
                                                <span className="font-medium text-ink capitalize">
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
                    <div
                        role="tabpanel"
                        id={`asset-tabpanel-status-${asset.id}`}
                        aria-labelledby={`asset-tab-status-${asset.id}`}
                    >
                        <FleetStatusForm
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
                        <FleetInspectionsSection
                            asset={asset}
                            canInspect={capabilities.inspect_asset}
                            onViewDvir={(dvir) => {
                                setSelectedDvir(dvir);
                                setShowDvirModal(true);
                            }}
                        />
                    </div>
                )}

                {activeTab === 'maintenance' && (
                    <div
                        role="tabpanel"
                        id={`asset-tabpanel-maintenance-${asset.id}`}
                        aria-labelledby={`asset-tab-maintenance-${asset.id}`}
                    >
                        <FleetMaintenanceSection
                            asset={asset}
                            canMaintain={capabilities.maintain_asset}
                        />
                    </div>
                )}

                {activeTab === 'documents' && (
                    <div
                        role="tabpanel"
                        id={`asset-tabpanel-documents-${asset.id}`}
                        aria-labelledby={`asset-tab-documents-${asset.id}`}
                    >
                        <FleetDocumentsSection
                            asset={asset}
                            canManage={
                                capabilities.maintain_asset ||
                                capabilities.update_asset_status
                            }
                        />
                    </div>
                )}
            </div>

            {(selectedDvir || asset.latest_dvir) && (
                <DvirWalkaroundModal
                    isOpen={showDvirModal}
                    onClose={() => {
                        setShowDvirModal(false);
                        setSelectedDvir(null);
                    }}
                    dvir={(selectedDvir || asset.latest_dvir)!}
                    assetCode={asset.code}
                    assetName={asset.name}
                    isLockedOut={asset.lockout?.is_locked_out}
                    lockoutReason={asset.lockout?.lockout_reason}
                />
            )}
        </Panel>
    );
}
