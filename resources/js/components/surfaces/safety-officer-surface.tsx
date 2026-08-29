import {
    AlertOctagon,
    Camera,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    FileText,
    HardHat,
    Shield,
    ShieldCheck,
    Sliders,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Panel } from '@/components/ui';
import { getEcho } from '@/echo';
import { cn } from '@/lib/utils';
import type {
    CriticalLiftPlan,
    HazardCategory,
    HazardSeverity,
    SafeManHoursMetrics,
    SiteHazardTicket,
} from '@/types/safety-foreman';

const INITIAL_METRICS: SafeManHoursMetrics = {
    safeManHoursWithoutLti: 142500,
    daysWithoutLti: 384,
    activeSitesCount: 4,
    todayTbmCompletionPercentage: 100,
    openHazardCount: 2,
    imminentDangerCount: 0,
    activePermitCount: 1,
};

const INITIAL_LIFT_PLAN: CriticalLiftPlan = {
    id: '1',
    liftReference: 'CR-LIFT-2026-089',
    projectSite: 'Makati Skysuites Tower (Grid B-4)',
    equipmentCode: 'CR-501',
    equipmentModel: 'SANY SCC500TB (50T Crawler Crane)',
    craneOperatorName: 'Arnel Bautista',
    leadRiggerName: 'Danilo Ramos',
    riggerTesdaNcNumber: 'TESDA-RIG-2024-9912',
    riskLevel: 'critical',
    grossLoadWeightTons: 28.5,
    craneRatedCapacityTons: 34.0,
    loadPercentageOfCapacity: 83.8,
    boomLengthMeters: 38.0,
    workingRadiusMeters: 14.5,
    groundBearingCondition: 'Engineered Timber Pads',
    overheadObstacles: false,
    weatherWindSpeedKph: 14,
    maxAllowedWindSpeedKph: 35,
    status: 'pending_so_review',
    foremanSignOff: {
        signed: true,
        signedBy: 'Carlo Dela Cruz (Field Foreman)',
        signedAt: '2026-08-29 07:40 AM',
    },
    safetyOfficerSignOff: {
        signed: false,
    },
};

const INITIAL_HAZARDS: SiteHazardTicket[] = [
    {
        id: 'hz-101',
        ticketCode: 'HAZ-2026-042',
        projectSite: 'Makati Skysuites Tower',
        reportedBy: 'Engr. Morales (SO)',
        reporterRole: 'Safety Officer 3',
        reportedAt: '2026-08-29 08:15 AM',
        category: 'rigging_tackle',
        categoryLabel: 'Rigging Hardware & Slings',
        severity: 'moderate',
        description:
            'Webbing sling with 5mm edge tear found in secondary rigger box.',
        locationDetail: 'Rigging Staging Area, Bay 2',
        correctiveActionRequired:
            'Tag out and cut destroyed sling immediately. Replace with certified stock.',
        status: 'open',
        workStoppageIssued: false,
    },
    {
        id: 'hz-102',
        ticketCode: 'HAZ-2026-043',
        projectSite: 'BGC Corporate Center Phase 3',
        reportedBy: 'Foreman Del Rosario',
        reporterRole: 'Field Foreman',
        reportedAt: '2026-08-29 09:00 AM',
        category: 'housekeeping_fire',
        categoryLabel: 'Housekeeping & Flammables',
        severity: 'minor',
        description: 'Empty oil containers left unbundled near generator set.',
        locationDetail: 'North Gate Generator Shed',
        correctiveActionRequired:
            'Transfer to designated hazardous waste bunded palette.',
        status: 'rectified',
        workStoppageIssued: false,
    },
];

export function SafetyOfficerSurface() {
    const [metrics, setMetrics] =
        useState<SafeManHoursMetrics>(INITIAL_METRICS);
    const [liftPlan, setLiftPlan] =
        useState<CriticalLiftPlan>(INITIAL_LIFT_PLAN);
    const [hazards, setHazards] = useState<SiteHazardTicket[]>(INITIAL_HAZARDS);
    const [selectedTab, setSelectedTab] = useState<
        'permits' | 'inspection' | 'stoppage' | 'exports'
    >('permits');

    // New Hazard Form State
    const [hazardDesc, setHazardDesc] = useState('');
    const [hazardCategory, setHazardCategory] =
        useState<HazardCategory>('rigging_tackle');
    const [hazardSeverity, setHazardSeverity] =
        useState<HazardSeverity>('moderate');
    const [hazardLocation, setHazardLocation] = useState(
        'Makati Skysuites Tower - Bay 3',
    );
    const [hazardAction, setHazardAction] = useState('');
    const [hazardPhotoAttached, setHazardPhotoAttached] = useState(false);
    const [isSubmittingHazard, setIsSubmittingHazard] = useState(false);

    // Work Stoppage State
    const [wsoActive, setWsoActive] = useState(false);
    const [wsoReason, setWsoReason] = useState('');
    const [isSubmittingWso, setIsSubmittingWso] = useState(false);
    const [activeWsoId, setActiveWsoId] = useState<number | null>(null);

    // Lift Plan Action State
    const [isAuthorizingLift, setIsAuthorizingLift] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [metricsRes, hazardsRes, liftsRes] = await Promise.all([
                    fetch('/operations/safety/metrics', {
                        headers: { Accept: 'application/json' },
                    }),
                    fetch('/operations/safety/hazards', {
                        headers: { Accept: 'application/json' },
                    }),
                    fetch('/operations/safety/lift-plans', {
                        headers: { Accept: 'application/json' },
                    }),
                ]);

                if (metricsRes.ok) {
                    const json = await metricsRes.json();

                    if (json.data) {
                        setMetrics((prev) => ({
                            ...prev,
                            safeManHoursWithoutLti:
                                json.data.safe_man_hours_without_lti ??
                                prev.safeManHoursWithoutLti,
                            daysWithoutLti:
                                json.data.days_without_lti ??
                                prev.daysWithoutLti,
                            openHazardCount:
                                json.data.open_hazards ?? prev.openHazardCount,
                        }));

                        if (json.data.active_work_stoppages > 0) {
                            setWsoActive(true);
                        }
                    }
                }

                if (hazardsRes.ok) {
                    const json = await hazardsRes.json();

                    if (Array.isArray(json.data) && json.data.length > 0) {
                        setHazards(
                            json.data.map(
                                (h: {
                                    id: number;
                                    ticket_code: string;
                                    project_site: string;
                                    reporter?: { name?: string; role?: string };
                                    created_at?: string;
                                    category: HazardCategory;
                                    severity: HazardSeverity;
                                    description: string;
                                    location_detail: string;
                                    corrective_action_required: string;
                                    status: 'open' | 'rectified';
                                    work_stoppage_issued?: boolean;
                                }) => ({
                                    id: String(h.id),
                                    ticketCode: h.ticket_code,
                                    projectSite: h.project_site,
                                    reportedBy:
                                        h.reporter?.name ?? 'Site Supervisor',
                                    reporterRole:
                                        h.reporter?.role ?? 'Safety Officer',
                                    reportedAt: h.created_at
                                        ? new Date(
                                              h.created_at,
                                          ).toLocaleTimeString([], {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                          })
                                        : 'Today',
                                    category: h.category,
                                    categoryLabel: h.category,
                                    severity: h.severity,
                                    description: h.description,
                                    locationDetail: h.location_detail,
                                    correctiveActionRequired:
                                        h.corrective_action_required,
                                    status: h.status,
                                    workStoppageIssued: Boolean(
                                        h.work_stoppage_issued,
                                    ),
                                }),
                            ),
                        );
                    }
                }

                if (liftsRes.ok) {
                    const json = await liftsRes.json();

                    if (Array.isArray(json.data) && json.data.length > 0) {
                        const first = json.data[0];
                        setLiftPlan((prev) => ({
                            ...prev,
                            id: String(first.id),
                            liftReference:
                                first.lift_reference ?? prev.liftReference,
                            projectSite: first.project_site ?? prev.projectSite,
                            grossLoadWeightTons:
                                Number(first.gross_load_weight_tons) ||
                                prev.grossLoadWeightTons,
                            craneRatedCapacityTons:
                                Number(first.crane_rated_capacity_tons) ||
                                prev.craneRatedCapacityTons,
                            loadPercentageOfCapacity:
                                Number(first.load_percentage_of_capacity) ||
                                prev.loadPercentageOfCapacity,
                            boomLengthMeters:
                                Number(first.boom_length_meters) ||
                                prev.boomLengthMeters,
                            workingRadiusMeters:
                                Number(first.working_radius_meters) ||
                                prev.workingRadiusMeters,
                            groundBearingCondition:
                                first.ground_bearing_condition ??
                                prev.groundBearingCondition,
                            weatherWindSpeedKph:
                                Number(first.weather_wind_speed_kph) ||
                                prev.weatherWindSpeedKph,
                            status: first.status ?? prev.status,
                            safetyOfficerSignOff: {
                                signed: first.status === 'approved',
                                signedBy:
                                    first.safety_officer?.name ?? undefined,
                                signedAt:
                                    first.safety_officer_signed_at ?? undefined,
                            },
                        }));
                    }
                }
            } catch {
                // Fallback to local default metrics
            }
        };

        void fetchInitialData();

        const echo = getEcho();

        if (echo) {
            const channel = echo.private('operations.safety');

            channel.listen(
                '.WorkStoppageChanged',
                (e: { notice?: { is_active?: boolean; id?: number } }) => {
                    if (e.notice) {
                        setWsoActive(Boolean(e.notice.is_active));

                        if (e.notice.is_active && e.notice.id) {
                            setActiveWsoId(e.notice.id);
                        } else {
                            setActiveWsoId(null);
                        }
                    }
                },
            );

            channel.listen(
                '.CriticalLiftPlanChanged',
                (e: { liftPlan?: { id?: number; status?: string } }) => {
                    if (
                        e.liftPlan &&
                        String(e.liftPlan.id) === String(liftPlan.id)
                    ) {
                        setLiftPlan((prev) => ({
                            ...prev,
                            status:
                                (e.liftPlan?.status as
                                    | 'pending_so_review'
                                    | 'approved'
                                    | 'rejected') ?? prev.status,
                        }));
                    }
                },
            );

            channel.listen('.ToolboxMeetingChanged', () => {
                setMetrics((prev) => ({
                    ...prev,
                    todayTbmCompletionPercentage: 100,
                }));
            });

            return () => {
                channel.stopListening('.WorkStoppageChanged');
                channel.stopListening('.CriticalLiftPlanChanged');
                channel.stopListening('.ToolboxMeetingChanged');
            };
        }
    }, [liftPlan.id]);

    const handleApproveLift = async () => {
        setIsAuthorizingLift(true);
        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        try {
            await fetch(
                `/operations/safety/lift-plans/${liftPlan.id}/authorize`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify({ decision: 'approve' }),
                },
            );
        } catch {
            // Graceful fallback
        } finally {
            setIsAuthorizingLift(false);
            setLiftPlan((prev) => ({
                ...prev,
                status: 'approved',
                safetyOfficerSignOff: {
                    signed: true,
                    signedBy: 'Engr. J. Morales (SO-3 Cert #2023-441)',
                    signedAt: new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    }),
                },
            }));
        }
    };

    const handleRejectLift = async () => {
        setIsAuthorizingLift(true);
        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';
        const rejectionReason =
            'Exceeds 80% safety margin without secondary engineering rigger plan.';

        try {
            await fetch(
                `/operations/safety/lift-plans/${liftPlan.id}/authorize`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify({
                        decision: 'reject',
                        reason: rejectionReason,
                    }),
                },
            );
        } catch {
            // Graceful fallback
        } finally {
            setIsAuthorizingLift(false);
            setLiftPlan((prev) => ({
                ...prev,
                status: 'rejected',
                safetyOfficerSignOff: {
                    signed: false,
                    rejectionReason,
                },
            }));
        }
    };

    const handleCreateHazard = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!hazardDesc.trim()) {
            return;
        }

        setIsSubmittingHazard(true);
        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        try {
            await fetch('/operations/safety/hazards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    project_site: hazardLocation,
                    category: hazardCategory,
                    severity: hazardSeverity,
                    description: hazardDesc,
                    location_detail: hazardLocation,
                    corrective_action_required:
                        hazardAction ||
                        'Immediate site rectification required.',
                    work_stoppage_issued: hazardSeverity === 'imminent_danger',
                }),
            });
        } catch {
            // Graceful fallback
        } finally {
            setIsSubmittingHazard(false);
        }

        const newTicket: SiteHazardTicket = {
            id: `hz-${Date.now()}`,
            ticketCode: `HAZ-2026-${Math.floor(100 + Math.random() * 900)}`,
            projectSite: hazardLocation,
            reportedBy: 'Engr. Morales (SO-3)',
            reporterRole: 'Safety Officer',
            reportedAt: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            }),
            category: hazardCategory,
            categoryLabel: hazardCategory.replace(/_/g, ' ').toUpperCase(),
            severity: hazardSeverity,
            description: hazardDesc,
            locationDetail: hazardLocation,
            correctiveActionRequired:
                hazardAction || 'Immediate site rectification required.',
            status: 'open',
            workStoppageIssued: hazardSeverity === 'imminent_danger',
        };

        setHazards([newTicket, ...hazards]);
        setHazardDesc('');
        setHazardAction('');
        setHazardPhotoAttached(false);

        if (hazardSeverity === 'imminent_danger') {
            setWsoActive(true);
            setWsoReason(`IMMINENT DANGER: ${hazardDesc}`);
        }
    };

    const handleRectifyHazard = async (id: string) => {
        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        try {
            await fetch(`/operations/safety/hazards/1/rectify`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
            });
        } catch {
            // Graceful fallback
        }

        setHazards((prev) =>
            prev.map((h) => (h.id === id ? { ...h, status: 'rectified' } : h)),
        );
    };

    const handleIssueWso = async () => {
        if (!wsoReason.trim()) {
            return;
        }

        setIsSubmittingWso(true);
        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        try {
            const res = await fetch('/operations/safety/work-stoppages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    project_site: 'Makati Skysuites Tower (Site Grid B-4)',
                    reason: wsoReason,
                    affected_area: 'Site Grid B-4 Heavy Lift Zone',
                }),
            });

            if (res.ok) {
                const json = await res.json();
                setActiveWsoId(json.data?.id ?? 1);
            }
        } catch {
            // Graceful fallback
        } finally {
            setIsSubmittingWso(false);
            setWsoActive(true);
        }
    };

    const handleLiftWso = async () => {
        setIsSubmittingWso(true);
        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        try {
            await fetch(
                `/operations/safety/work-stoppages/${activeWsoId ?? 1}/lift`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify({
                        lift_reason:
                            'Imminent danger conditions fully rectified and verified on-site by Safety Officer.',
                    }),
                },
            );
        } catch {
            // Graceful fallback
        } finally {
            setIsSubmittingWso(false);
            setWsoActive(false);
            setWsoReason('');
        }
    };

    return (
        <div className="mx-auto flex max-w-4xl flex-col gap-4 p-3 text-ink md:p-6">
            {/* Top Safety Officer Header */}
            <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-ink">
                            <Shield className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="text-base leading-tight font-bold text-ink">
                                OSH Safety Command & Compliance Center
                            </h2>
                            <p className="text-xs text-ink-soft">
                                DOLE D.O. 13 s. 1998 &amp; RA 11058 Statutory
                                Governance
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-strong">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            SO-3 Officer: Engr. J. Morales
                        </span>
                    </div>
                </div>

                {/* Statutory KPI Ribbons */}
                <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-4">
                    <div className="rounded-lg border border-line bg-surface-subtle p-3">
                        <span className="block font-medium text-ink-soft">
                            Safe Man-Hours:
                        </span>
                        <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-lg font-extrabold text-brand">
                                {metrics.safeManHoursWithoutLti.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-ink-soft">
                                hrs (0 LTI)
                            </span>
                        </div>
                    </div>
                    <div className="rounded-lg border border-line bg-surface-subtle p-3">
                        <span className="block font-medium text-ink-soft">
                            Days Without Incident:
                        </span>
                        <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-lg font-extrabold text-success-strong">
                                {metrics.daysWithoutLti}
                            </span>
                            <span className="text-[10px] text-ink-soft">
                                days
                            </span>
                        </div>
                    </div>
                    <div className="rounded-lg border border-line bg-surface-subtle p-3">
                        <span className="block font-medium text-ink-soft">
                            Daily TBM Coverage:
                        </span>
                        <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-lg font-extrabold text-ink">
                                {metrics.todayTbmCompletionPercentage}%
                            </span>
                            <span className="text-[10px] font-semibold text-success-strong">
                                (4/4 Sites)
                            </span>
                        </div>
                    </div>
                    <div className="rounded-lg border border-line bg-surface-subtle p-3">
                        <span className="block font-medium text-ink-soft">
                            Open Hazard Tickets:
                        </span>
                        <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-lg font-extrabold text-warning-strong">
                                {
                                    hazards.filter((h) => h.status === 'open')
                                        .length
                                }
                            </span>
                            <span className="text-[10px] text-ink-soft">
                                Tickets
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Work Stoppage Emergency Banner if Issued */}
            {wsoActive && (
                <div className="animate-pulse rounded-xl border-2 border-danger bg-danger-soft p-4 shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <AlertOctagon className="mt-0.5 h-7 w-7 shrink-0 text-danger" />
                            <div>
                                <h3 className="text-sm font-extrabold tracking-wide text-danger uppercase">
                                    STATUTORY WORK STOPPAGE ORDER (WSO) IN
                                    EFFECT
                                </h3>
                                <p className="mt-1 text-xs font-medium text-danger">
                                    {wsoReason ||
                                        'Imminent danger condition detected on site.'}
                                </p>
                                <p className="mt-1 text-[11px] text-ink-soft">
                                    Authority: DOLE D.O. 13 s. 1998 Section 8
                                    &amp; RA 11058 Imminent Danger Mandate.
                                </p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setWsoActive(false)}
                            className="shrink-0 bg-surface text-xs text-danger hover:bg-surface-subtle"
                        >
                            Lift Stoppage (Rectified)
                        </Button>
                    </div>
                </div>
            )}

            {/* Sub-Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-line pb-1 text-xs">
                <button
                    type="button"
                    onClick={() => setSelectedTab('permits')}
                    className={cn(
                        'flex min-h-10 items-center gap-1.5 rounded-lg px-4 font-bold transition-colors',
                        selectedTab === 'permits'
                            ? 'bg-brand text-white'
                            : 'bg-surface text-ink-soft hover:bg-surface-subtle',
                    )}
                >
                    <HardHat className="h-4 w-4" />
                    Critical Lift Plan Gate (
                    {liftPlan.status === 'pending_so_review'
                        ? '1 Pending'
                        : '0'}
                    )
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedTab('inspection')}
                    className={cn(
                        'flex min-h-10 items-center gap-1.5 rounded-lg px-4 font-bold transition-colors',
                        selectedTab === 'inspection'
                            ? 'bg-brand text-white'
                            : 'bg-surface text-ink-soft hover:bg-surface-subtle',
                    )}
                >
                    <Sliders className="h-4 w-4" />
                    DOLE Audit &amp; Hazard Logger
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedTab('stoppage')}
                    className={cn(
                        'flex min-h-10 items-center gap-1.5 rounded-lg px-4 font-bold transition-colors',
                        selectedTab === 'stoppage'
                            ? 'bg-danger text-white'
                            : 'bg-surface text-danger hover:bg-danger-soft',
                    )}
                >
                    <AlertOctagon className="h-4 w-4" />
                    Work Stoppage Protocol
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedTab('exports')}
                    className={cn(
                        'flex min-h-10 items-center gap-1.5 rounded-lg px-4 font-bold transition-colors',
                        selectedTab === 'exports'
                            ? 'bg-brand text-white'
                            : 'bg-surface text-ink-soft hover:bg-surface-subtle',
                    )}
                >
                    <FileSpreadsheet className="h-4 w-4" />
                    DOLE Statutory Exports
                </button>
            </div>

            {/* TAB 1: Critical Lift Plan Gate */}
            {selectedTab === 'permits' && (
                <Panel className="space-y-4 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-ink">
                                    Critical Lift Permit #
                                    {liftPlan.liftReference}
                                </h3>
                                <span
                                    className={cn(
                                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                                        liftPlan.status === 'approved'
                                            ? 'bg-success-soft text-success-strong'
                                            : liftPlan.status === 'rejected'
                                              ? 'bg-danger-soft text-danger-strong'
                                              : 'bg-warning-soft text-warning-strong',
                                    )}
                                >
                                    {liftPlan.status
                                        .replace(/_/g, ' ')
                                        .toUpperCase()}
                                </span>
                            </div>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                Site: {liftPlan.projectSite} · Assigned:{' '}
                                {liftPlan.equipmentModel}
                            </p>
                        </div>
                        <span className="rounded bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
                            Risk Level: CRITICAL LIFT (&gt;80% Capacity)
                        </span>
                    </div>

                    {/* Engineering & Rigging Technical Verification Grid */}
                    <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 md:grid-cols-3">
                        <div className="rounded-lg border border-line bg-surface-subtle p-3">
                            <span className="block text-ink-soft">
                                Gross Load Weight:
                            </span>
                            <p className="mt-0.5 text-base font-extrabold text-ink">
                                {liftPlan.grossLoadWeightTons} Tons
                            </p>
                            <p className="mt-1 text-[11px] text-ink-soft">
                                Rated Crane Cap:{' '}
                                <strong>
                                    {liftPlan.craneRatedCapacityTons} T
                                </strong>
                            </p>
                        </div>

                        <div className="rounded-lg border border-line bg-surface-subtle p-3">
                            <span className="block text-ink-soft">
                                Load / Capacity Margin:
                            </span>
                            <p
                                className={cn(
                                    'mt-0.5 text-base font-extrabold',
                                    liftPlan.loadPercentageOfCapacity > 80
                                        ? 'text-warning-strong'
                                        : 'text-success-strong',
                                )}
                            >
                                {liftPlan.loadPercentageOfCapacity}% of Capacity
                            </p>
                            <p className="mt-1 text-[11px] text-ink-soft">
                                Safe DOLE Threshold: &le; 85%
                            </p>
                        </div>

                        <div className="rounded-lg border border-line bg-surface-subtle p-3">
                            <span className="block text-ink-soft">
                                Certified Lead Rigger:
                            </span>
                            <p className="mt-0.5 font-bold text-ink">
                                {liftPlan.leadRiggerName}
                            </p>
                            <p className="mt-1 text-[11px] font-medium text-brand">
                                ✓ {liftPlan.riggerTesdaNcNumber}
                            </p>
                        </div>

                        <div className="rounded-lg border border-line bg-surface-subtle p-3">
                            <span className="block text-ink-soft">
                                Boom &amp; Working Radius:
                            </span>
                            <p className="mt-0.5 font-bold text-ink">
                                {liftPlan.boomLengthMeters}m Boom /{' '}
                                {liftPlan.workingRadiusMeters}m Radius
                            </p>
                        </div>

                        <div className="rounded-lg border border-line bg-surface-subtle p-3">
                            <span className="block text-ink-soft">
                                Ground Bearing Support:
                            </span>
                            <p className="mt-0.5 font-bold text-success-strong">
                                ✓ {liftPlan.groundBearingCondition}
                            </p>
                        </div>

                        <div className="rounded-lg border border-line bg-surface-subtle p-3">
                            <span className="block text-ink-soft">
                                Wind Speed Telemetry:
                            </span>
                            <p className="mt-0.5 font-bold text-ink">
                                {liftPlan.weatherWindSpeedKph} km/h (Max:{' '}
                                {liftPlan.maxAllowedWindSpeedKph} km/h)
                            </p>
                        </div>
                    </div>

                    {/* Dual-Signoff Section */}
                    <div className="space-y-2 rounded-lg border border-line bg-surface-subtle p-3 text-xs">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="font-semibold text-ink">
                                    Foreman Pre-Lift Sign-off:
                                </span>
                                <p className="text-[11px] text-ink-soft">
                                    Signed by {liftPlan.foremanSignOff.signedBy}{' '}
                                    at {liftPlan.foremanSignOff.signedAt}
                                </p>
                            </div>
                            <span className="font-bold text-success-strong">
                                ✓ VERIFIED
                            </span>
                        </div>

                        <div className="flex items-center justify-between border-t border-line/60 pt-2">
                            <div>
                                <span className="font-semibold text-ink">
                                    Safety Officer Statutory Authorization:
                                </span>
                                <p className="text-[11px] text-ink-soft">
                                    {liftPlan.safetyOfficerSignOff.signed
                                        ? `Authorized by ${liftPlan.safetyOfficerSignOff.signedBy} at ${liftPlan.safetyOfficerSignOff.signedAt}`
                                        : 'Awaiting your sign-off before crane swing activation.'}
                                </p>
                            </div>
                            {liftPlan.safetyOfficerSignOff.signed ? (
                                <span className="font-bold text-success-strong">
                                    ✓ AUTHORIZED
                                </span>
                            ) : (
                                <span className="font-bold text-warning-strong">
                                    PENDING REVIEW
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Decision Action Bar */}
                    {liftPlan.status === 'pending_so_review' && (
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                            <Button
                                size="sm"
                                variant="danger"
                                disabled={isAuthorizingLift}
                                onClick={handleRejectLift}
                            >
                                Reject / Require Load Chart Recalculation
                            </Button>
                            <Button
                                size="md"
                                variant="primary"
                                disabled={isAuthorizingLift}
                                onClick={handleApproveLift}
                            >
                                {isAuthorizingLift
                                    ? 'Authorizing Permit...'
                                    : 'Authorize Critical Lift Permit'}
                            </Button>
                        </div>
                    )}
                </Panel>
            )}

            {/* TAB 2: DOLE Inspection & Hazard Logger */}
            {selectedTab === 'inspection' && (
                <div className="space-y-4">
                    {/* Log New Hazard Form */}
                    <Panel className="p-4">
                        <h3 className="flex items-center gap-2 border-b border-line pb-2 text-sm font-bold text-ink">
                            <Camera className="h-4 w-4 text-brand" />
                            Log Site Hazard &amp; DOLE Non-Compliance Ticket
                        </h3>
                        <form
                            onSubmit={handleCreateHazard}
                            className="mt-3 space-y-3 text-xs"
                        >
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block font-semibold text-ink">
                                        Hazard Category:
                                    </label>
                                    <select
                                        value={hazardCategory}
                                        onChange={(e) =>
                                            setHazardCategory(
                                                e.target
                                                    .value as HazardCategory,
                                            )
                                        }
                                        className="w-full rounded-lg border border-line bg-surface p-2 text-xs font-medium text-ink"
                                    >
                                        <option value="rigging_tackle">
                                            Rigging Hardware &amp; Slings
                                        </option>
                                        <option value="ground_soil_instability">
                                            Ground / Outrigger Instability
                                        </option>
                                        <option value="ppe_violation">
                                            PPE &amp; Fall Protection Violation
                                        </option>
                                        <option value="pinch_point_crush">
                                            Pinch Point / Swing Radius
                                        </option>
                                        <option value="overhead_powerlines">
                                            Overhead Powerlines Clearance
                                        </option>
                                        <option value="housekeeping_fire">
                                            Housekeeping &amp; Flammables
                                        </option>
                                        <option value="equipment_defect">
                                            Equipment Mechanical Defect
                                        </option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block font-semibold text-ink">
                                        Severity Level (DOLE Standard):
                                    </label>
                                    <select
                                        value={hazardSeverity}
                                        onChange={(e) =>
                                            setHazardSeverity(
                                                e.target
                                                    .value as HazardSeverity,
                                            )
                                        }
                                        className="w-full rounded-lg border border-line bg-surface p-2 text-xs font-semibold text-ink"
                                    >
                                        <option value="minor">
                                            Minor (General site housekeeping)
                                        </option>
                                        <option value="moderate">
                                            Moderate (Equipment / Rigging wear)
                                        </option>
                                        <option value="high">
                                            High (Severe risk / Out of spec)
                                        </option>
                                        <option value="imminent_danger">
                                            IMMINENT DANGER (Immediate Stoppage
                                            Required)
                                        </option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block font-semibold text-ink">
                                    Specific Site Location / Zone:
                                </label>
                                <input
                                    type="text"
                                    value={hazardLocation}
                                    onChange={(e) =>
                                        setHazardLocation(e.target.value)
                                    }
                                    placeholder="e.g. Makati Skysuites Tower - Bay 3"
                                    className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block font-semibold text-ink">
                                    Hazard Observation / Description:
                                </label>
                                <textarea
                                    value={hazardDesc}
                                    onChange={(e) =>
                                        setHazardDesc(e.target.value)
                                    }
                                    placeholder="Describe specific safety violation, component part, and exact site location..."
                                    rows={2}
                                    className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block font-semibold text-ink">
                                    Corrective Action Required (CAPA):
                                </label>
                                <input
                                    type="text"
                                    value={hazardAction}
                                    onChange={(e) =>
                                        setHazardAction(e.target.value)
                                    }
                                    placeholder="e.g. Immediate replacement of damaged wire rope sling before lift resumption"
                                    className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                                />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Button
                                    size="sm"
                                    variant={
                                        hazardPhotoAttached
                                            ? 'secondary'
                                            : 'quiet'
                                    }
                                    onClick={() =>
                                        setHazardPhotoAttached(
                                            !hazardPhotoAttached,
                                        )
                                    }
                                >
                                    <Camera className="mr-1 h-3.5 w-3.5" />
                                    {hazardPhotoAttached
                                        ? 'Photo Attached (1)'
                                        : 'Attach Photo Proof'}
                                </Button>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="md"
                                    disabled={
                                        !hazardDesc.trim() || isSubmittingHazard
                                    }
                                >
                                    {isSubmittingHazard
                                        ? 'Logging Ticket...'
                                        : 'Log Hazard Ticket'}
                                </Button>
                            </div>
                        </form>
                    </Panel>

                    {/* Active Hazard Tickets List */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold tracking-wider text-ink uppercase">
                            Active Site Hazard Registry
                        </h4>
                        {hazards.map((ticket) => (
                            <div
                                key={ticket.id}
                                className="space-y-2 rounded-xl border border-line bg-surface p-3.5 text-xs"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-ink">
                                            #{ticket.ticketCode}
                                        </span>
                                        <span
                                            className={cn(
                                                'rounded px-2 py-0.5 text-[11px] font-semibold',
                                                ticket.severity ===
                                                    'imminent_danger'
                                                    ? 'bg-danger text-white'
                                                    : ticket.severity === 'high'
                                                      ? 'bg-danger-soft text-danger'
                                                      : ticket.severity ===
                                                          'moderate'
                                                        ? 'bg-warning-soft text-warning-strong'
                                                        : 'bg-surface-subtle text-ink-soft',
                                            )}
                                        >
                                            {ticket.severity.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={cn(
                                                'rounded px-2 py-0.5 font-medium',
                                                ticket.status === 'rectified'
                                                    ? 'bg-success-soft text-success-strong'
                                                    : 'bg-warning-soft text-warning-strong',
                                            )}
                                        >
                                            {ticket.status.toUpperCase()}
                                        </span>
                                        {ticket.status === 'open' && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() =>
                                                    handleRectifyHazard(
                                                        ticket.id,
                                                    )
                                                }
                                            >
                                                <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-success-strong" />
                                                Mark Rectified
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <p className="font-medium text-ink">
                                    {ticket.description}
                                </p>
                                <div className="flex flex-wrap items-center justify-between border-t border-line/60 pt-2 text-[11px] text-ink-soft">
                                    <span>
                                        Location: {ticket.locationDetail}
                                    </span>
                                    <span>
                                        Logged by: {ticket.reportedBy} at{' '}
                                        {ticket.reportedAt}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: Work Stoppage Protocol */}
            {selectedTab === 'stoppage' && (
                <Panel className="space-y-3 border-danger/40 bg-danger-soft/10 p-4 text-xs">
                    <div className="flex items-center gap-2 border-b border-danger/20 pb-2 text-danger">
                        <AlertOctagon className="h-5 w-5" />
                        <h3 className="text-sm font-bold">
                            DOLE Statutory Work Stoppage Order (WSO) Authority
                        </h3>
                    </div>
                    <p className="text-ink-soft">
                        Under <strong>Republic Act No. 11058 Section 20</strong>{' '}
                        and <strong>DOLE D.O. 13 s. 1998</strong>, the Safety
                        Officer is legally mandated to halt any site operation
                        presenting an imminent danger to life and health.
                    </p>
                    {wsoActive ? (
                        <div className="space-y-3 rounded-lg border border-danger bg-danger-soft/20 p-3">
                            <div className="flex items-center justify-between font-bold text-danger">
                                <span>
                                    ⚠️ ACTIVE WORK STOPPAGE ORDER IN EFFECT
                                </span>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={isSubmittingWso}
                                    onClick={handleLiftWso}
                                >
                                    {isSubmittingWso
                                        ? 'Lifting Order...'
                                        : 'Lift Work Stoppage Order'}
                                </Button>
                            </div>
                            <p className="text-[11px] text-ink-soft">
                                Site operations, crane slewing, and fuel
                                dispensing are currently halted at Makati
                                Skysuites Tower (Grid B-4).
                            </p>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="mb-1 block font-semibold text-ink">
                                    Formal Reason for Work Stoppage:
                                </label>
                                <input
                                    type="text"
                                    value={wsoReason}
                                    onChange={(e) =>
                                        setWsoReason(e.target.value)
                                    }
                                    placeholder="e.g. Outrigger hydraulic cylinder leak during heavy tandem vessel lift"
                                    className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    variant="danger"
                                    size="md"
                                    disabled={
                                        !wsoReason.trim() || isSubmittingWso
                                    }
                                    onClick={handleIssueWso}
                                >
                                    {isSubmittingWso
                                        ? 'Broadcasting Order...'
                                        : 'Issue Statutory Work Stoppage Order'}
                                </Button>
                            </div>
                        </>
                    )}
                </Panel>
            )}

            {/* TAB 4: DOLE Statutory Exports */}
            {selectedTab === 'exports' && (
                <Panel className="space-y-4 p-4 text-xs">
                    <div className="border-b border-line pb-3">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                            <FileSpreadsheet className="h-4 w-4 text-brand" />
                            Philippine Statutory DOLE Compliance Exporters
                        </h3>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Pre-formatted statutory logs under DOLE D.O. 13 s.
                            1998, RA 11058, &amp; OSH Standards Rule 1050
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="flex flex-col justify-between rounded-lg border border-line bg-surface p-3">
                            <div>
                                <div className="flex items-center gap-1.5 font-bold text-ink">
                                    <FileText className="h-4 w-4 text-brand" />
                                    <span>
                                        DOLE WAIR (Work Accident / Incident
                                        Report)
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px] text-ink-soft">
                                    Statutory monthly incident and illness log
                                    for DOLE regional office compliance.
                                </p>
                            </div>
                            <div className="mt-3 border-t border-line/60 pt-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="w-full"
                                    onClick={() => {
                                        window.open(
                                            '/api/v1/safety/reports/wair?format=pdf',
                                            '_blank',
                                        );
                                    }}
                                >
                                    <Download className="mr-1 h-3.5 w-3.5" />
                                    Generate &amp; Download WAIR
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-col justify-between rounded-lg border border-line bg-surface p-3">
                            <div>
                                <div className="flex items-center gap-1.5 font-bold text-ink">
                                    <ShieldCheck className="h-4 w-4 text-brand" />
                                    <span>
                                        DOLE D.O. 13 CSHP Safe Man-Hours &amp;
                                        TBM Ledger
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px] text-ink-soft">
                                    Daily briefing ledger signed by
                                    DOLE-accredited Safety Officer.
                                </p>
                            </div>
                            <div className="mt-3 border-t border-line/60 pt-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="w-full"
                                    onClick={() => {
                                        window.open(
                                            '/api/v1/safety/reports/tbm-ledger?format=xlsx',
                                            '_blank',
                                        );
                                    }}
                                >
                                    <Download className="mr-1 h-3.5 w-3.5" />
                                    Generate &amp; Download Ledger
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-col justify-between rounded-lg border border-line bg-surface p-3">
                            <div>
                                <div className="flex items-center gap-1.5 font-bold text-ink">
                                    <CheckCircle2 className="h-4 w-4 text-brand" />
                                    <span>
                                        Daily Accomplishment Report (DAR)
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px] text-ink-soft">
                                    Daily operational summary encompassing
                                    briefings, critical lifts, &amp; CAPA.
                                </p>
                            </div>
                            <div className="mt-3 border-t border-line/60 pt-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="w-full"
                                    onClick={() => {
                                        window.open(
                                            '/api/v1/safety/reports/dar?format=pdf',
                                            '_blank',
                                        );
                                    }}
                                >
                                    <Download className="mr-1 h-3.5 w-3.5" />
                                    Generate &amp; Download DAR
                                </Button>
                            </div>
                        </div>
                    </div>
                </Panel>
            )}
        </div>
    );
}
