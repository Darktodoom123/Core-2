import { useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    AlertTriangle,
    CalendarClock,
    CheckCircle2,
    ClipboardCheck,
    Clock3,
    ExternalLink,
    FileText,
    Gauge,
    MapPin,
    Radio,
    ShieldAlert,
    ShieldCheck,
    Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import { Button, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { DvirWalkaroundModal } from '@/components/workspace/fleet/dvir-walkaround-modal';
import { getFleetAssetCategoryLabel } from '@/components/workspace/fleet/fleet-asset-classification';
import {
    FleetPill,
    FleetSectionHeader,
} from '@/components/workspace/fleet/fleet-detail-primitives';
import { getFleetDispatchabilityState } from '@/components/workspace/fleet/fleet-dispatchability';
import { FleetDocumentsSection } from '@/components/workspace/fleet/fleet-documents-section';
import { FleetInspectionsSection } from '@/components/workspace/fleet/fleet-inspections-section';
import {
    getFleetLocationFreshnessLabel,
    hasLocationCoordinates,
} from '@/components/workspace/fleet/fleet-location-labels';
import { FleetMaintenanceSection } from '@/components/workspace/fleet/fleet-maintenance-section';
import { FleetQuickActionToolbar } from '@/components/workspace/fleet/fleet-quick-action-toolbar';
import { presentFleetSpecifications } from '@/components/workspace/fleet/fleet-specifications';
import { FleetStatusForm } from '@/components/workspace/fleet/fleet-status-form';
import { HosDutyBadge } from '@/components/workspace/fleet/hos-duty-badge';
import { SafetyLockoutBanner } from '@/components/workspace/fleet/safety-lockout-banner';
import { resolveAssetDisplayStatus } from '@/components/workspace/resource-schedule-status';
import { formatDateTime, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { usePreciseLocation } from '@/services/reverse-geocoder';
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

function formatDurationMinutes(minutes: number | null | undefined): string {
    if (
        minutes === null ||
        minutes === undefined ||
        !Number.isFinite(minutes)
    ) {
        return 'Unavailable';
    }

    const rounded = Math.max(0, Math.round(minutes));

    return `${Math.floor(rounded / 60)}h ${String(rounded % 60).padStart(2, '0')}m`;
}

function formatRecordedAt(value: string | null | undefined): string {
    return value
        ? formatDateTime(value, 'Time unavailable')
        : 'Time unavailable';
}

function inspectionResultLabel(result: string): string {
    return (
        {
            passed: 'Passed',
            conditional: 'Conditional',
            failed: 'Failed',
            defect_flagged: 'Defects identified',
            critical_defect: 'Critical defect',
        }[result] ?? humanize(result)
    );
}

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
    const tabListRef = useRef<HTMLDivElement | null>(null);

    const lockdownForm = useForm({
        reason: '',
    });

    const hasFreshLocation =
        assetLocation &&
        hasLocationCoordinates(assetLocation) &&
        assetLocation.freshness_status === 'fresh';
    const dispatchabilityState = getFleetDispatchabilityState(asset);
    const assetCategoryLabel = getFleetAssetCategoryLabel(asset);
    const specificationPresentation = presentFleetSpecifications(
        asset.specifications,
    );
    const inspectionCount = asset.inspections_count ?? null;
    const dvirInspectionCount = asset.dvir_inspections_count ?? null;
    const totalInspectionsCount =
        inspectionCount !== null && dvirInspectionCount !== null
            ? inspectionCount + dvirInspectionCount
            : null;
    const maintenanceWorkOrdersCount =
        asset.maintenance_work_orders_count ?? null;
    const documentsCount = asset.documents_count ?? null;
    const preciseLocation = usePreciseLocation(assetLocation);
    const locationReportedAt =
        assetLocation?.captured_at ?? assetLocation?.received_at;
    const locationFreshnessLabel = assetLocation
        ? getFleetLocationFreshnessLabel(assetLocation)
        : null;
    const latestWorkshopCheck = asset.inspections.find(
        (inspection) => inspection.completed_at !== null,
    );
    const durationBreakdown: Array<[string, number | null | undefined]> =
        asset.hos
            ? [
                  ['Operating', asset.hos.operating_minutes],
                  ['Driving', asset.hos.driving_minutes],
                  ['Standby', asset.hos.standby_minutes],
                  ['Breaks', asset.hos.break_minutes],
              ]
            : [];
    const dutyHistory = asset.hos?.duty_history ?? [];
    const equipmentUsage = asset.hos?.equipment_usage ?? null;
    const recentDutyHistory = dutyHistory.slice(-6).reverse();
    const displayLocation = preciseLocation.startsWith('GPS ')
        ? 'Location unavailable'
        : preciseLocation;
    const detailTabs: Array<{
        id: DetailTab;
        icon: LucideIcon;
        label: string;
        fullLabel?: string;
        count: number | null;
        countTone?: 'danger';
    }> = [
        {
            id: 'overview',
            icon: Gauge,
            label: 'Overview',
            fullLabel: 'Overview & Specs',
            count: null,
        },
        {
            id: 'status',
            icon: ShieldCheck,
            label: 'Readiness',
            fullLabel: 'Readiness & Status',
            count: null,
        },
        {
            id: 'inspections',
            icon: ClipboardCheck,
            label: 'Inspections',
            count: totalInspectionsCount,
        },
        {
            id: 'maintenance',
            icon: Wrench,
            label: 'Work Orders',
            count: maintenanceWorkOrdersCount,
            countTone:
                asset.blocking_work_orders_count > 0 ? 'danger' : undefined,
        },
        {
            id: 'documents',
            icon: FileText,
            label: 'Documents',
            fullLabel: 'Permits & Docs',
            count: documentsCount,
        },
    ];

    // Keep the selected tab visible when the bar scrolls on narrow panes.
    useEffect(() => {
        const list = tabListRef.current;
        const tab = tabRefs.current[activeTab];

        if (!list || !tab) {
            return;
        }

        const tabStart = tab.offsetLeft - list.offsetLeft;
        const tabEnd = tabStart + tab.offsetWidth;

        if (tabStart < list.scrollLeft) {
            list.scrollTo({ left: tabStart - 16, behavior: 'smooth' });
        } else if (tabEnd > list.scrollLeft + list.clientWidth) {
            list.scrollTo({
                left: tabEnd - list.clientWidth + 16,
                behavior: 'smooth',
            });
        }
    }, [activeTab]);

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

    return (
        <Panel className="@container flex min-h-0 flex-col gap-4 p-4 md:p-6 lg:h-full lg:flex-1 lg:overflow-hidden [&>*]:shrink-0">
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

            {/* Side by side only when the actions leave the name and position room. */}
            <div className="flex flex-col items-stretch gap-4 @3xl:flex-row @3xl:items-start @3xl:justify-between">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                        {assetCategoryLabel}
                        {asset.subtype ? ` · ${asset.subtype}` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span className="text-2xl font-bold tracking-tight whitespace-nowrap text-ink tabular-nums">
                            {asset.code}
                        </span>
                        <h2 className="min-w-0 text-base font-medium text-ink-soft">
                            {asset.name}
                        </h2>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <CanonicalStatusBadge
                            status={resolveAssetDisplayStatus(asset)}
                            variant="soft"
                            size="sm"
                            presentation="pill"
                        />
                        {asset.dispatch_occupancy && (
                            <FleetPill
                                tone={
                                    asset.dispatch_occupancy.state ===
                                    'tentative'
                                        ? 'warning'
                                        : 'brand'
                                }
                                icon={CalendarClock}
                            >
                                {asset.dispatch_occupancy.job.reference} ·{' '}
                                {asset.dispatch_occupancy.job.status.label} ·{' '}
                                {formatDateTime(
                                    asset.dispatch_occupancy.job
                                        .scheduled_start,
                                )}
                                {asset.dispatch_occupancy.open_jobs_count > 1
                                    ? ` (+${asset.dispatch_occupancy.open_jobs_count - 1} more)`
                                    : ''}
                            </FleetPill>
                        )}
                        {dispatchabilityState === 'ready' ? (
                            <FleetPill tone="success" icon={ShieldCheck}>
                                Ready for dispatch
                            </FleetPill>
                        ) : dispatchabilityState === 'blocking_work_orders' ? (
                            <FleetPill tone="danger" icon={Wrench}>
                                {asset.blocking_work_orders_count} blocking work
                                order
                                {asset.blocking_work_orders_count > 1
                                    ? 's'
                                    : ''}
                            </FleetPill>
                        ) : dispatchabilityState === 'inspection_required' ? (
                            <FleetPill tone="warning" icon={ShieldAlert}>
                                Inspection required before dispatch
                            </FleetPill>
                        ) : null}
                        {assetLocation &&
                            (hasFreshLocation ? (
                                <FleetPill tone="success" icon={Radio}>
                                    {getFleetLocationFreshnessLabel(
                                        assetLocation,
                                    )}
                                </FleetPill>
                            ) : (
                                <FleetPill tone="neutral" dot>
                                    {getFleetLocationFreshnessLabel(
                                        assetLocation,
                                    )}
                                </FleetPill>
                            ))}
                    </div>

                    <p className="mt-3 flex min-w-0 items-start gap-1.5 text-sm text-ink-soft">
                        <MapPin
                            className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong"
                            aria-hidden="true"
                        />
                        {assetLocation &&
                        hasLocationCoordinates(assetLocation) ? (
                            <span className="min-w-0">
                                <span className="text-ink-soft">
                                    {hasFreshLocation
                                        ? 'Current position'
                                        : 'Last known location'}
                                    :{' '}
                                </span>
                                <span className="font-medium text-ink">
                                    {displayLocation}
                                </span>
                            </span>
                        ) : (
                            <span className="min-w-0">
                                <span className="sr-only">Location: </span>
                                <span className="font-medium text-ink">
                                    {assetLocation?.recorded_location ??
                                        asset.location ??
                                        'Location not recorded'}
                                </span>
                            </span>
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
                    className="w-full @3xl:w-auto @3xl:justify-end"
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
                                        'mt-1 w-full rounded-lg border bg-surface p-2.5 text-xs text-ink placeholder:text-ink-soft focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
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

            <div className="relative -mx-4 border-b border-line md:-mx-6">
                <div
                    ref={tabListRef}
                    className="flex min-w-0 scrollbar-none flex-nowrap gap-1 overflow-x-auto overscroll-x-contain [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1rem),transparent)] px-4 md:px-6"
                    role="tablist"
                    aria-label="Asset detail sections"
                    aria-orientation="horizontal"
                >
                    {detailTabs.map((tab) => {
                        const selected = activeTab === tab.id;
                        const Icon = tab.icon;

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                id={`asset-tab-${tab.id}-${asset.id}`}
                                aria-controls={`asset-tabpanel-${tab.id}-${asset.id}`}
                                aria-selected={selected}
                                tabIndex={selected ? 0 : -1}
                                ref={(element) => {
                                    tabRefs.current[tab.id] = element;
                                }}
                                onClick={() => setActiveTab(tab.id)}
                                onKeyDown={(event) =>
                                    handleTabKeyDown(event, tab.id)
                                }
                                className={cn(
                                    'relative flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden focus-visible:ring-inset',
                                    selected
                                        ? 'border-brand-strong font-semibold text-ink'
                                        : 'border-transparent font-medium text-ink-soft hover:border-line-strong hover:text-ink',
                                )}
                            >
                                <Icon
                                    className={cn(
                                        'h-4 w-4 shrink-0',
                                        selected
                                            ? 'text-brand-strong'
                                            : 'text-ink-soft',
                                    )}
                                    aria-hidden="true"
                                />
                                {tab.fullLabel ? (
                                    <>
                                        <span className="@5xl:hidden">
                                            {tab.label}
                                        </span>
                                        <span className="hidden @5xl:inline">
                                            {tab.fullLabel}
                                        </span>
                                    </>
                                ) : (
                                    tab.label
                                )}
                                {tab.count !== null && (
                                    <span
                                        className={cn(
                                            'min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] leading-none font-semibold tabular-nums',
                                            tab.countTone === 'danger'
                                                ? 'bg-danger-soft text-danger-strong'
                                                : tab.count > 0
                                                  ? 'bg-brand-soft text-brand-strong'
                                                  : 'bg-surface-subtle text-ink-soft',
                                        )}
                                    >
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div
                className="min-h-0 space-y-6 pt-1 lg:flex-1 lg:shrink! lg:overflow-y-auto lg:overscroll-contain"
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

                {/* Overview */}
                <div
                    hidden={activeTab !== 'overview'}
                    role="tabpanel"
                    id={`asset-tabpanel-overview-${asset.id}`}
                    aria-labelledby={`asset-tab-overview-${asset.id}`}
                    className="space-y-8"
                >
                    <section
                        aria-labelledby={`current-operation-${asset.id}`}
                        className="space-y-4"
                    >
                        <FleetSectionHeader
                            id={`current-operation-${asset.id}`}
                            title="Current operation"
                            description="Accepted field activity and inspection context for this asset."
                            action={
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                                    <Clock3
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                    {locationReportedAt
                                        ? `Last reported ${formatRecordedAt(locationReportedAt)}`
                                        : 'No accepted location update'}
                                </span>
                            }
                        />

                        <div className="grid overflow-hidden rounded-xl border border-line md:grid-cols-2 md:divide-x md:divide-line">
                            <div className="min-h-28 p-4">
                                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                    Operator
                                </p>
                                {asset.active_operator ? (
                                    <div className="mt-2 space-y-2">
                                        <p className="text-sm font-semibold text-ink">
                                            {asset.active_operator.name}
                                        </p>
                                        <p className="text-xs text-ink-soft">
                                            Shift started{' '}
                                            {formatRecordedAt(
                                                asset.active_operator
                                                    .shift_started_at,
                                            )}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                                            <span>
                                                {formatDurationMinutes(
                                                    asset.active_operator
                                                        .shift_duration_minutes,
                                                )}{' '}
                                                elapsed
                                            </span>
                                            <span
                                                className={cn(
                                                    'inline-flex items-center gap-1.5 font-medium',
                                                    assetLocation?.sharing_enabled ===
                                                        false
                                                        ? 'text-warning-strong'
                                                        : assetLocation?.freshness_status ===
                                                            'fresh'
                                                          ? 'text-success-strong'
                                                          : 'text-ink-soft',
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        'h-1.5 w-1.5 rounded-full',
                                                        assetLocation?.sharing_enabled ===
                                                            false
                                                            ? 'bg-warning-strong'
                                                            : assetLocation?.freshness_status ===
                                                                'fresh'
                                                              ? 'bg-success-strong'
                                                              : 'bg-ink-soft/50',
                                                    )}
                                                    aria-hidden="true"
                                                />
                                                {assetLocation?.sharing_enabled ===
                                                false
                                                    ? 'Location sharing paused'
                                                    : locationReportedAt
                                                      ? `${locationFreshnessLabel ?? 'Location reported'} · ${formatRecordedAt(locationReportedAt)}`
                                                      : 'Location unavailable'}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2 space-y-1">
                                        <p className="text-sm font-medium text-ink">
                                            No active operator
                                        </p>
                                        <p className="text-xs leading-5 text-ink-soft">
                                            Assignment and field duty are
                                            separate records.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="min-h-28 border-t border-line p-4 md:border-t-0">
                                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                    Duty
                                </p>
                                {asset.hos ? (
                                    <div className="mt-2 space-y-2">
                                        <HosDutyBadge hos={asset.hos} />
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-soft">
                                            <span>
                                                Status since{' '}
                                                {formatRecordedAt(
                                                    asset.hos
                                                        .current_duty_started_at,
                                                )}
                                            </span>
                                            <span>
                                                Accepted{' '}
                                                {formatRecordedAt(
                                                    asset.hos
                                                        .last_accepted_duty_at,
                                                )}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-2 text-xs">
                                            <span>
                                                Shift elapsed{' '}
                                                <strong className="font-semibold text-ink">
                                                    {formatDurationMinutes(
                                                        asset.hos
                                                            .shift_elapsed_minutes,
                                                    )}
                                                </strong>
                                            </span>
                                            <span>
                                                Limit counter · operating +
                                                driving{' '}
                                                <strong className="font-semibold text-ink">
                                                    {asset.hos
                                                        .limit_counter_minutes ===
                                                        null ||
                                                    asset.hos
                                                        .limit_counter_minutes ===
                                                        undefined
                                                        ? 'Unavailable'
                                                        : formatDurationMinutes(
                                                              asset.hos
                                                                  .limit_counter_minutes,
                                                          )}
                                                </strong>
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2 space-y-1">
                                        <p className="text-sm font-medium text-ink">
                                            No active duty
                                        </p>
                                        <p className="text-xs leading-5 text-ink-soft">
                                            Hours unavailable until a
                                            server-accepted shift begins.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {asset.hos && (
                            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-xs sm:grid-cols-4">
                                {durationBreakdown.map(([label, minutes]) => (
                                    <div
                                        key={label}
                                        className="bg-surface px-4 py-3"
                                    >
                                        <p className="text-ink-soft">{label}</p>
                                        <p className="mt-1 text-sm font-semibold text-ink tabular-nums">
                                            {formatDurationMinutes(minutes)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {asset.hos && (
                            <div className="grid gap-4 border-b border-line pb-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
                                <section
                                    aria-labelledby={`duty-history-heading-${asset.id}`}
                                    className="min-w-0"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <h4
                                                id={`duty-history-heading-${asset.id}`}
                                                className="text-xs font-semibold tracking-wide text-ink-soft uppercase"
                                            >
                                                Duty history
                                            </h4>
                                            <p className="mt-1 text-xs leading-5 text-ink-soft">
                                                Server-accepted transitions
                                                only.
                                            </p>
                                        </div>
                                        {dutyHistory.length > 6 && (
                                            <span className="text-xs text-ink-soft">
                                                Showing latest 6
                                            </span>
                                        )}
                                    </div>
                                    {recentDutyHistory.length > 0 ? (
                                        <ol className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
                                            {recentDutyHistory.map((log) => (
                                                <li
                                                    key={log.id}
                                                    className="space-y-1.5 bg-surface-subtle/40 px-3 py-3 text-xs"
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                                        <span className="font-semibold text-ink">
                                                            {log.previous_duty_status_label
                                                                ? `${log.previous_duty_status_label} → `
                                                                : ''}
                                                            {log.new_duty_status_label ??
                                                                humanize(
                                                                    log.new_duty_status,
                                                                )}
                                                        </span>
                                                        <span className="text-ink-soft tabular-nums">
                                                            {formatDurationMinutes(
                                                                log.duration_minutes,
                                                            )}
                                                        </span>
                                                    </div>
                                                    <p className="text-ink-soft">
                                                        Occurred{' '}
                                                        {formatRecordedAt(
                                                            log.occurred_at,
                                                        )}
                                                        {' · Server accepted '}
                                                        {formatRecordedAt(
                                                            log.accepted_at,
                                                        )}
                                                    </p>
                                                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-ink-soft">
                                                        <span>
                                                            Equipment:{' '}
                                                            {log.equipment_code ??
                                                                'Not linked'}
                                                        </span>
                                                        <span>
                                                            {log.location_label ??
                                                                (log.location_freshness ===
                                                                'last_known'
                                                                    ? 'Last known location'
                                                                    : log.location_freshness ===
                                                                        'unavailable'
                                                                      ? 'Location unavailable'
                                                                      : 'GPS position')}
                                                        </span>
                                                    </p>
                                                    {log.location_observed_at && (
                                                        <p className="text-ink-soft">
                                                            Location observed{' '}
                                                            {formatRecordedAt(
                                                                log.location_observed_at,
                                                            )}
                                                        </p>
                                                    )}
                                                </li>
                                            ))}
                                        </ol>
                                    ) : (
                                        <p className="mt-3 rounded-lg border border-line bg-surface-subtle/40 px-3 py-3 text-xs leading-5 text-ink-soft">
                                            No accepted duty transitions are
                                            available for this operation.
                                        </p>
                                    )}
                                </section>

                                <section
                                    aria-labelledby={`equipment-usage-heading-${asset.id}`}
                                    className="min-w-0 border-t border-line pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4"
                                >
                                    <h4
                                        id={`equipment-usage-heading-${asset.id}`}
                                        className="text-xs font-semibold tracking-wide text-ink-soft uppercase"
                                    >
                                        Equipment time
                                    </h4>
                                    <p className="mt-1 text-xs leading-5 text-ink-soft">
                                        Kept separate from operator HOS and the
                                        official meter.
                                    </p>
                                    <p className="mt-3 text-sm font-semibold text-ink tabular-nums">
                                        Estimated usage:{' '}
                                        {equipmentUsage?.policy_applied &&
                                        equipmentUsage.estimated_minutes !==
                                            null &&
                                        equipmentUsage.estimated_minutes !==
                                            undefined
                                            ? formatDurationMinutes(
                                                  equipmentUsage.estimated_minutes,
                                              )
                                            : 'No usage policy configured'}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-ink-soft">
                                        {equipmentUsage?.source ??
                                            'Accepted linked intervals only'}
                                    </p>
                                    {equipmentUsage && (
                                        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-ink-soft">
                                            <span>
                                                Operating{' '}
                                                <strong className="font-semibold text-ink">
                                                    {formatDurationMinutes(
                                                        equipmentUsage.operating_minutes,
                                                    )}
                                                </strong>
                                            </span>
                                            <span>
                                                Driving{' '}
                                                <strong className="font-semibold text-ink">
                                                    {formatDurationMinutes(
                                                        equipmentUsage.driving_minutes,
                                                    )}
                                                </strong>
                                            </span>
                                            <span>
                                                Standby{' '}
                                                <strong className="font-semibold text-ink">
                                                    {formatDurationMinutes(
                                                        equipmentUsage.standby_minutes,
                                                    )}
                                                </strong>
                                            </span>
                                            <span>
                                                Break{' '}
                                                <strong className="font-semibold text-ink">
                                                    {formatDurationMinutes(
                                                        equipmentUsage.break_minutes,
                                                    )}
                                                </strong>
                                            </span>
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                    Latest inspections
                                </p>
                                <button
                                    type="button"
                                    className="text-xs font-semibold text-brand-strong underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2 focus-visible:outline-none"
                                    onClick={() => setActiveTab('inspections')}
                                    aria-controls={`asset-tabpanel-inspections-${asset.id}`}
                                >
                                    View inspections →
                                </button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-xl border border-line bg-surface-subtle/40 p-4">
                                    <p className="text-xs font-semibold text-ink-soft">
                                        Field DVIR
                                    </p>
                                    {asset.latest_dvir ? (
                                        <>
                                            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
                                                {asset.latest_dvir.status ===
                                                'passed' ? (
                                                    <CheckCircle2
                                                        className="h-3.5 w-3.5 text-success-strong"
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <AlertTriangle
                                                        className="h-3.5 w-3.5 text-warning-strong"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                {inspectionResultLabel(
                                                    asset.latest_dvir.status,
                                                )}
                                            </p>
                                            <p className="mt-1 text-xs text-ink-soft">
                                                Completed{' '}
                                                {formatRecordedAt(
                                                    asset.latest_dvir
                                                        .completed_at,
                                                )}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="mt-1 text-sm font-medium text-ink">
                                            No submission received
                                        </p>
                                    )}
                                </div>
                                <div className="rounded-xl border border-line bg-surface-subtle/40 p-4">
                                    <p className="text-xs font-semibold text-ink-soft">
                                        Workshop check
                                    </p>
                                    {latestWorkshopCheck ? (
                                        <>
                                            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
                                                {latestWorkshopCheck.result ===
                                                'passed' ? (
                                                    <CheckCircle2
                                                        className="h-3.5 w-3.5 text-success-strong"
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <AlertTriangle
                                                        className="h-3.5 w-3.5 text-warning-strong"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                {inspectionResultLabel(
                                                    latestWorkshopCheck.result,
                                                )}
                                            </p>
                                            <p className="mt-1 text-xs text-ink-soft">
                                                Completed{' '}
                                                {formatRecordedAt(
                                                    latestWorkshopCheck.completed_at,
                                                )}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="mt-1 text-sm font-medium text-ink">
                                            No check recorded
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-3 border-t border-line pt-6">
                        <FleetSectionHeader
                            title="Asset profile"
                            description="Registered identity, asset type, capacity, and current readings."
                        />

                        <dl className="grid gap-x-6 sm:grid-cols-2 md:grid-cols-3">
                            <div className="border-b border-line py-4">
                                <dt className="text-xs font-semibold text-ink-soft">
                                    Asset type
                                </dt>
                                <dd className="mt-1 text-base font-semibold text-ink">
                                    {assetCategoryLabel}
                                </dd>
                                <p className="mt-1 text-xs text-ink-soft">
                                    {asset.subtype ?? 'Subtype not recorded'}
                                </p>
                            </div>
                            <div className="border-b border-line py-4">
                                <dt className="text-xs font-semibold text-ink-soft">
                                    Registration number
                                </dt>
                                <dd className="mt-1 text-base font-semibold text-ink tabular-nums">
                                    {asset.registration_number ?? 'N/A'}
                                </dd>
                            </div>
                            <div className="border-b border-line py-4">
                                <dt className="text-xs font-semibold text-ink-soft">
                                    Manufacturer &amp; model
                                </dt>
                                <dd className="mt-1 text-base font-semibold text-ink">
                                    {asset.manufacturer ?? 'N/A'}
                                    {asset.model ? ` ${asset.model}` : ''}
                                </dd>
                            </div>
                            <div className="border-b border-line py-4">
                                <dt className="text-xs font-semibold text-ink-soft">
                                    Rated capacity / bucket
                                </dt>
                                <dd className="mt-1 text-base font-semibold text-ink tabular-nums">
                                    {asset.rated_capacity
                                        ? `${asset.rated_capacity}${asset.capacity_unit ? ` ${asset.capacity_unit.replace('m3', 'm³')}` : ''}`
                                        : 'Not recorded'}
                                </dd>
                            </div>
                            <div className="border-b border-line py-4">
                                <dt className="text-xs font-semibold text-ink-soft">
                                    Official equipment meter
                                </dt>
                                <dd className="mt-1 text-base font-semibold text-ink tabular-nums">
                                    {asset.meter_value !== null &&
                                    asset.meter_value !== undefined &&
                                    asset.meter_value !== ''
                                        ? `${asset.meter_value} (${asset.meter_type ?? 'units'})`
                                        : 'N/A'}
                                </dd>
                                <p className="mt-1 text-xs text-ink-soft">
                                    Authorized meter or telemetry workflow
                                </p>
                            </div>
                            <div className="border-b border-line py-4">
                                <dt className="text-xs font-semibold text-ink-soft">
                                    Safety blocks
                                </dt>
                                <dd className="mt-1 text-base font-semibold">
                                    {asset.blocking_work_orders_count > 0 ? (
                                        <span className="text-danger">
                                            <span className="tabular-nums">
                                                {
                                                    asset.blocking_work_orders_count
                                                }
                                            </span>{' '}
                                            {asset.blocking_work_orders_count ===
                                            1
                                                ? 'open order'
                                                : 'open orders'}
                                        </span>
                                    ) : (
                                        <span className="text-success-strong">
                                            None
                                        </span>
                                    )}
                                </dd>
                            </div>
                        </dl>
                    </section>

                    {(specificationPresentation.groups.length > 0 ||
                        specificationPresentation.sources.length > 0 ||
                        specificationPresentation.notes.length > 0) && (
                        <section className="space-y-5 border-t border-line pt-6">
                            <FleetSectionHeader
                                title="Specifications & references"
                                description="Operator-facing values are grouped below; source and availability notes are kept in the reference panel."
                            />

                            {specificationPresentation.groups.length > 0 && (
                                <div className="space-y-5">
                                    {specificationPresentation.groups.map(
                                        (group) => (
                                            <div key={group.key}>
                                                <h4 className="text-sm font-semibold text-ink">
                                                    {group.label}
                                                </h4>
                                                <dl className="mt-2 grid gap-x-6 sm:grid-cols-2">
                                                    {group.items.map((item) => (
                                                        <div
                                                            key={item.key}
                                                            className="flex min-h-12 items-center justify-between gap-4 border-b border-line py-3"
                                                        >
                                                            <dt className="text-sm font-medium text-ink">
                                                                {item.label}
                                                            </dt>
                                                            <dd className="max-w-[60%] text-right text-sm font-medium text-ink-soft tabular-nums">
                                                                {item.value}
                                                            </dd>
                                                        </div>
                                                    ))}
                                                </dl>
                                            </div>
                                        ),
                                    )}
                                </div>
                            )}

                            {specificationPresentation.notes.length > 0 && (
                                <div className="rounded-lg border border-warning/30 bg-warning-soft/50 p-4">
                                    <h4 className="text-sm font-semibold text-ink">
                                        Reference notes
                                    </h4>
                                    <ul className="mt-2 space-y-1.5 text-xs leading-5 text-ink-soft">
                                        {specificationPresentation.notes.map(
                                            (note) => (
                                                <li key={note}>{note}</li>
                                            ),
                                        )}
                                    </ul>
                                </div>
                            )}

                            {specificationPresentation.sources.length > 0 && (
                                <div className="border-t border-line pt-4">
                                    <h4 className="text-sm font-semibold text-ink">
                                        Source references
                                    </h4>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                        {specificationPresentation.sources.map(
                                            (source) => (
                                                <a
                                                    key={source.url}
                                                    href={source.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="group flex min-w-0 items-start justify-between gap-3 rounded-lg border border-line bg-surface-subtle/50 px-3 py-2.5 text-sm transition-colors hover:border-brand-strong/50 hover:bg-brand-soft/40 focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block truncate font-semibold text-ink">
                                                            {source.label}
                                                        </span>
                                                        <span className="mt-0.5 block text-xs text-ink-soft">
                                                            {source.reviewedOn
                                                                ? `Reviewed ${source.reviewedOn}`
                                                                : 'Open reference'}
                                                        </span>
                                                    </span>
                                                    <ExternalLink
                                                        className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft transition-colors group-hover:text-brand-strong"
                                                        aria-hidden="true"
                                                    />
                                                </a>
                                            ),
                                        )}
                                    </div>
                                    <p className="mt-3 text-xs leading-5 text-ink-soft">
                                        These links are public catalogue or
                                        manufacturer references. They describe
                                        the model and published capacity; they
                                        do not by themselves confirm current
                                        physical inventory or safe lift
                                        configuration.
                                    </p>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                <div
                    hidden={activeTab !== 'status'}
                    role="tabpanel"
                    id={`asset-tabpanel-status-${asset.id}`}
                    aria-labelledby={`asset-tab-status-${asset.id}`}
                    className="grid gap-8 @lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] @lg:gap-10"
                >
                    <section
                        aria-labelledby={`asset-readiness-heading-${asset.id}`}
                        className="space-y-5"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3
                                    id={`asset-readiness-heading-${asset.id}`}
                                    className="text-base font-semibold text-ink"
                                >
                                    Dispatch readiness
                                </h3>
                                <p className="mt-1 text-sm text-ink-soft">
                                    Can this asset be assigned right now?
                                </p>
                            </div>
                            <div
                                className={cn(
                                    'flex items-center gap-2.5 rounded-xl px-3.5 py-2.5',
                                    asset.is_dispatchable
                                        ? 'bg-success-soft text-success-strong'
                                        : 'bg-warning-soft text-warning-strong',
                                )}
                                role="status"
                            >
                                {asset.is_dispatchable ? (
                                    <ShieldCheck
                                        className="h-4 w-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <AlertTriangle
                                        className="h-4 w-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                )}
                                <div>
                                    <span className="block text-sm font-semibold">
                                        {asset.is_dispatchable
                                            ? 'Dispatchable'
                                            : 'Dispatch blocked'}
                                    </span>
                                    <span className="block text-xs text-current/75">
                                        {asset.is_dispatchable
                                            ? 'Ready for assignment'
                                            : 'Resolve blockers first'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <dl className="grid overflow-hidden rounded-xl border border-line text-sm sm:grid-cols-2 sm:divide-x sm:divide-line">
                            <div className="p-4">
                                <dt className="text-xs font-semibold text-ink-soft">
                                    Operational status
                                </dt>
                                <dd className="mt-2">
                                    <CanonicalStatusBadge
                                        status={asset.status}
                                        variant="soft"
                                        size="md"
                                        presentation="pill"
                                    />
                                </dd>
                                <p className="mt-1 text-xs text-ink-soft">
                                    Recorded asset state
                                </p>
                            </div>
                            <div className="border-t border-line p-4 sm:border-t-0">
                                <dt className="text-xs font-semibold text-ink-soft">
                                    Dispatchability
                                </dt>
                                <dd
                                    className={cn(
                                        'mt-2 text-base font-semibold',
                                        asset.is_dispatchable
                                            ? 'text-success-strong'
                                            : 'text-warning-strong',
                                    )}
                                >
                                    {asset.is_dispatchable
                                        ? 'Dispatchable'
                                        : 'Not dispatchable'}
                                </dd>
                                <p className="mt-1 text-xs text-ink-soft">
                                    Based on current status and blockers
                                </p>
                            </div>
                        </dl>

                        {!asset.is_dispatchable && (
                            <div
                                role="status"
                                className="rounded-xl border border-warning/30 bg-warning-soft/60 p-4 text-sm text-warning-strong"
                            >
                                <div className="flex items-start gap-2">
                                    <AlertTriangle
                                        className="mt-0.5 h-4 w-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                    <div className="min-w-0">
                                        <p className="font-semibold text-ink">
                                            Resolve before assignment
                                        </p>
                                        <p className="mt-0.5 text-xs leading-5">
                                            The following conditions currently
                                            prevent dispatch.
                                        </p>
                                        {asset.dispatchability?.blockers
                                            ?.length ? (
                                            <ul className="mt-3 space-y-2 border-t border-warning/20 pt-3 text-xs leading-5">
                                                {asset.dispatchability.blockers.map(
                                                    (blocker) => (
                                                        <li
                                                            key={blocker.code}
                                                            className="flex items-start gap-2"
                                                        >
                                                            <span
                                                                className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current"
                                                                aria-hidden="true"
                                                            />
                                                            <span>
                                                                <span className="font-semibold text-ink">
                                                                    {
                                                                        blocker.label
                                                                    }
                                                                    :
                                                                </span>{' '}
                                                                {blocker.detail}
                                                            </span>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        ) : (
                                            <p className="mt-3 text-xs leading-5">
                                                The current data does not
                                                include a specific
                                                dispatchability reason.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="rounded-xl border border-line p-4">
                            <div className="flex items-center gap-2">
                                <Clock3
                                    className="h-4 w-4 text-ink-soft"
                                    aria-hidden="true"
                                />
                                <h4 className="text-sm font-semibold text-ink">
                                    Last recorded status change
                                </h4>
                            </div>
                            {asset.latest_status_change ? (
                                <div className="mt-2 space-y-1 text-sm">
                                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink">
                                        <span className="font-semibold">
                                            {asset.latest_status_change
                                                .from_status
                                                ? humanize(
                                                      asset.latest_status_change
                                                          .from_status,
                                                  )
                                                : 'Status'}
                                        </span>
                                        <span
                                            className="text-ink-soft"
                                            aria-hidden="true"
                                        >
                                            →
                                        </span>
                                        <span className="font-semibold">
                                            {asset.latest_status_change
                                                .to_status
                                                ? humanize(
                                                      asset.latest_status_change
                                                          .to_status,
                                                  )
                                                : 'Status not recorded'}
                                        </span>
                                        <span className="text-xs text-ink-soft">
                                            {formatDateTime(
                                                asset.latest_status_change
                                                    .occurred_at,
                                                'Time not recorded',
                                            )}
                                        </span>
                                    </p>
                                    {(asset.latest_status_change.actor ||
                                        asset.latest_status_change.reason) && (
                                        <p className="text-xs leading-5 text-ink-soft">
                                            {asset.latest_status_change.actor
                                                ? `Recorded by ${asset.latest_status_change.actor.name}`
                                                : 'Recorded actor not available'}
                                            {asset.latest_status_change.reason
                                                ? ` · ${asset.latest_status_change.reason}`
                                                : ''}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="mt-2 text-xs leading-5 text-ink-soft">
                                    No recorded status-change metadata is
                                    available for this asset.
                                </p>
                            )}
                        </div>
                    </section>

                    <FleetStatusForm
                        asset={asset}
                        canUpdate={capabilities.update_asset_status}
                    />
                </div>

                <div
                    hidden={activeTab !== 'inspections'}
                    role="tabpanel"
                    id={`asset-tabpanel-inspections-${asset.id}`}
                    aria-labelledby={`asset-tab-inspections-${asset.id}`}
                >
                    <FleetInspectionsSection
                        key={asset.id}
                        asset={asset}
                        canInspect={capabilities.inspect_asset}
                        onViewDvir={(dvir) => {
                            setSelectedDvir(dvir);
                            setShowDvirModal(true);
                        }}
                    />
                </div>

                <div
                    hidden={activeTab !== 'maintenance'}
                    role="tabpanel"
                    id={`asset-tabpanel-maintenance-${asset.id}`}
                    aria-labelledby={`asset-tab-maintenance-${asset.id}`}
                >
                    <FleetMaintenanceSection
                        asset={asset}
                        canMaintain={capabilities.maintain_asset}
                    />
                </div>

                <div
                    hidden={activeTab !== 'documents'}
                    role="tabpanel"
                    id={`asset-tabpanel-documents-${asset.id}`}
                    aria-labelledby={`asset-tab-documents-${asset.id}`}
                >
                    <FleetDocumentsSection
                        asset={asset}
                        canManage={capabilities.update_asset_status}
                    />
                </div>
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
