import { useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Camera,
    ClipboardCheck,
    Gauge,
    Radio,
    ShieldAlert,
    ShieldCheck,
    Wrench,
} from 'lucide-react';
import type { FormEvent } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import { Button, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { DvirStatusBadge } from '@/components/workspace/fleet/dvir-status-badge';
import { DvirWalkaroundModal } from '@/components/workspace/fleet/dvir-walkaround-modal';
import { FleetInspectionsSection } from '@/components/workspace/fleet/fleet-inspections-section';
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

export function FleetDetailPane({
    asset,
    assetLocation,
    capabilities,
    onViewFullTracking,
    onBackToList,
}: FleetDetailPaneProps) {
    const [activeTab, setActiveTab] = useState<
        'overview' | 'status' | 'inspections' | 'maintenance'
    >('overview');

    const [showDvirModal, setShowDvirModal] = useState(false);
    const [selectedDvir, setSelectedDvir] = useState<
        | NonNullable<AssetViewModel['latest_dvir']>
        | DvirInspectionViewModel
        | null
    >(null);
    const [showLockdownModal, setShowLockdownModal] = useState(false);
    const lockdownTriggerRef = useRef<HTMLButtonElement | null>(null);
    const lockdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    const lockdownForm = useForm({
        reason: '',
    });

    const hasLiveGps =
        assetLocation &&
        assetLocation.latitude !== null &&
        assetLocation.longitude !== null &&
        assetLocation.freshness_status === 'fresh';

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

    const dvirCount =
        asset.dvir_inspections && asset.dvir_inspections.length > 0
            ? asset.dvir_inspections.length
            : asset.latest_dvir
              ? 1
              : 0;
    const totalInspectionsCount = asset.inspections.length + dvirCount;

    return (
        <Panel className="space-y-6 p-4 md:p-6">
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
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xl font-bold text-ink">
                            {asset.code}
                        </span>
                        <CanonicalStatusBadge status={asset.status} />
                        {assetLocation &&
                            assetLocation.latitude !== null &&
                            assetLocation.longitude !== null &&
                            (hasLiveGps ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong">
                                    <Radio className="h-3 w-3 animate-pulse text-success-strong" />
                                    Live GPS active
                                </span>
                            ) : assetLocation.freshness_status === 'delayed' ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-strong">
                                    <span className="h-1.5 w-1.5 rounded-full bg-warning-strong" />
                                    GPS Delayed
                                </span>
                            ) : assetLocation.freshness_status === 'stale' ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                                    <span className="h-1.5 w-1.5 rounded-full bg-ink-soft/40" />
                                    Last Known (Stale)
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft/70">
                                    Telemetry Offline
                                </span>
                            ))}
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
                        {assetLocation &&
                        assetLocation.latitude !== null &&
                        assetLocation.longitude !== null ? (
                            <span className="tabular-nums">
                                GPS {assetLocation.latitude?.toFixed(4)},{' '}
                                {assetLocation.longitude?.toFixed(4)}
                                {assetLocation.captured_at ||
                                assetLocation.received_at
                                    ? ` (${new Date(assetLocation.captured_at || assetLocation.received_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                                    : ''}
                            </span>
                        ) : (
                            (asset.location ?? 'Location not recorded')
                        )}
                    </p>
                </div>
            </div>

            {/* Contextual Quick-Action Toolbar */}
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
            />

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
                        'flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden md:text-sm',
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
                    onClick={() => setActiveTab('status')}
                    className={cn(
                        'flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden md:text-sm',
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
                        'flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden md:text-sm',
                        activeTab === 'inspections'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    <ClipboardCheck className="h-4 w-4" />
                    Inspections
                    <span
                        className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                            totalInspectionsCount > 0
                                ? 'bg-brand-soft text-brand-strong'
                                : 'border border-line bg-surface-subtle text-ink-soft',
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
                    onClick={() => setActiveTab('maintenance')}
                    className={cn(
                        'flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden md:text-sm',
                        activeTab === 'maintenance'
                            ? 'border-brand-strong font-semibold text-brand-strong'
                            : 'border-transparent text-ink-soft hover:text-ink',
                    )}
                >
                    <Wrench className="h-4 w-4" />
                    Work Orders
                    <span
                        className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
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
                        <h4 className="text-xs font-semibold text-ink">
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
                                    <span className="tabular-nums">
                                        {asset.latest_dvir.photos.length}
                                    </span>
                                    )
                                </Button>
                            </div>
                        )}
                    </div>

                    <dl className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                        <div className="rounded-lg bg-surface-subtle p-3">
                            <dt className="text-xs font-medium text-ink-soft">
                                Registration Number
                            </dt>
                            <dd className="mt-1 text-sm font-semibold text-ink tabular-nums">
                                {asset.registration_number ?? 'N/A'}
                            </dd>
                        </div>
                        <div className="rounded-lg bg-surface-subtle p-3">
                            <dt className="text-xs font-medium text-ink-soft">
                                Manufacturer &amp; Model
                            </dt>
                            <dd className="mt-1 text-sm font-semibold text-ink">
                                {asset.manufacturer ?? 'N/A'}{' '}
                                {asset.model ?? ''}
                            </dd>
                        </div>
                        <div className="rounded-lg bg-surface-subtle p-3">
                            <dt className="text-xs font-medium text-ink-soft">
                                Rated Capacity
                            </dt>
                            <dd className="mt-1 text-sm font-semibold text-ink tabular-nums">
                                {asset.rated_capacity
                                    ? `${asset.rated_capacity}${asset.capacity_unit ? ` ${asset.capacity_unit}` : ''}`
                                    : 'Not recorded'}
                            </dd>
                        </div>
                        <div className="rounded-lg bg-surface-subtle p-3">
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
                        <div className="rounded-lg bg-surface-subtle p-3">
                            <dt className="text-xs font-medium text-ink-soft">
                                Unresolved Safety Blocks
                            </dt>
                            <dd className="mt-1 text-sm font-semibold">
                                {asset.blocking_work_orders_count > 0 ? (
                                    <span className="text-danger">
                                        <span className="tabular-nums">
                                            {asset.blocking_work_orders_count}
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
                        <div className="mt-4">
                            <h4 className="text-xs font-semibold text-ink">
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
