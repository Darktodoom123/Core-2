import {
    Activity,
    AlertOctagon,
    Camera,
    Check,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    FileText,
    HardHat,
    Plus,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Sliders,
    UserCheck,
    Users,
    X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Button, Panel } from '@/components/ui';
import { WeatherSafetyTelemetry } from '@/components/weather/weather-safety-telemetry';
import { getEcho } from '@/echo';
import { cn } from '@/lib/utils';
import type {
    CriticalLiftPlan,
    HazardCategory,
    HazardSeverity,
    SafeManHoursMetrics,
    SiteHazardTicket,
    ToolboxMeetingRecord,
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
        reportedAt: '08:15 AM',
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
        reportedAt: '09:00 AM',
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

const INITIAL_TBMS: ToolboxMeetingRecord[] = [
    {
        id: 'tbm-1',
        projectSite: 'Makati Skysuites Tower (Grid B-4)',
        date: '2026-08-29',
        time: '07:00 AM',
        topicId: 'tbm-dole-01',
        topicTitle: 'DOLE D.O. 13: Critical Lifting & Swing Radius Clearance',
        conductorName: 'Carlo Dela Cruz',
        conductorRole: 'Field Foreman',
        attendeeIds: ['101', '102', '103', '104', '105', '106'],
        attendeeCount: 6,
        photoEvidenceUrl:
            'https://storage.alibaton-ph.com/tbm-photos/tbm-8842.jpg',
        safetyOfficerCoSigned: true,
        safetyOfficerName: 'Engr. J. Morales (SO-3)',
        safetyOfficerSignedAt: '07:15 AM',
        notes: 'Verified 15m exclusion zone barricades and outrigger timber pad integrity.',
    },
    {
        id: 'tbm-2',
        projectSite: 'BGC Corporate Center Phase 3',
        date: '2026-08-29',
        time: '07:30 AM',
        topicId: 'tbm-dole-04',
        topicTitle: 'Rigging Hardware Inspection & Sling Defect Tagging',
        conductorName: 'Marcus Del Rosario',
        conductorRole: 'Field Foreman',
        attendeeIds: ['201', '202', '203', '204'],
        attendeeCount: 4,
        safetyOfficerCoSigned: false,
        notes: 'Reviewed synthetic sling inspection criteria; isolated 1 worn sling for discard.',
    },
    {
        id: 'tbm-3',
        projectSite: 'Cebu Pier 4 Port Terminal',
        date: '2026-08-29',
        time: '08:00 AM',
        topicId: 'tbm-dole-07',
        topicTitle: 'Working at Heights & Dual Lanyard 100% Tie-Off',
        conductorName: 'Rommel Santos',
        conductorRole: 'Field Foreman',
        attendeeIds: ['301', '302', '303', '304', '305'],
        attendeeCount: 5,
        safetyOfficerCoSigned: false,
        notes: 'Full harness and shock-absorbing lanyard inspection completed before boom elevation.',
    },
];

export function SafetyOfficerSurface() {
    const [metrics, setMetrics] =
        useState<SafeManHoursMetrics>(INITIAL_METRICS);
    const [liftPlan, setLiftPlan] =
        useState<CriticalLiftPlan>(INITIAL_LIFT_PLAN);
    const [hazards, setHazards] = useState<SiteHazardTicket[]>(INITIAL_HAZARDS);
    const [tbms, setTbms] = useState<ToolboxMeetingRecord[]>(INITIAL_TBMS);

    // Hazard Form State & Drawer
    const [showHazardForm, setShowHazardForm] = useState(false);
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
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    // TBM Co-Sign State
    const [coSigningTbmId, setCoSigningTbmId] = useState<string | null>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [metricsRes, hazardsRes, liftsRes, tbmsRes] =
                    await Promise.all([
                        fetch('/operations/safety/metrics', {
                            headers: { Accept: 'application/json' },
                        }),
                        fetch('/operations/safety/hazards', {
                            headers: { Accept: 'application/json' },
                        }),
                        fetch('/operations/safety/lift-plans', {
                            headers: { Accept: 'application/json' },
                        }),
                        fetch('/operations/safety/toolbox-meetings', {
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

                if (tbmsRes.ok) {
                    const json = await tbmsRes.json();

                    if (Array.isArray(json.data) && json.data.length > 0) {
                        setTbms(
                            json.data.map(
                                (t: {
                                    id: number;
                                    project_site: string;
                                    created_at?: string;
                                    topic_id: string;
                                    topic_title: string;
                                    conductor?: { name?: string };
                                    conductor_role?: string;
                                    attendee_ids?: string[];
                                    attendee_count?: number;
                                    photo_evidence_url?: string;
                                    safety_officer_signed_at?: string;
                                    safety_officer?: { name?: string };
                                    notes?: string;
                                }) => ({
                                    id: String(t.id),
                                    projectSite: t.project_site,
                                    date: t.created_at
                                        ? new Date(t.created_at)
                                              .toISOString()
                                              .split('T')[0]
                                        : 'Today',
                                    time: t.created_at
                                        ? new Date(
                                              t.created_at,
                                          ).toLocaleTimeString([], {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                          })
                                        : '07:00 AM',
                                    topicId: t.topic_id,
                                    topicTitle: t.topic_title,
                                    conductorName:
                                        t.conductor?.name ?? 'Field Foreman',
                                    conductorRole: 'Field Foreman' as const,
                                    attendeeIds: t.attendee_ids ?? [],
                                    attendeeCount: t.attendee_count ?? 5,
                                    photoEvidenceUrl: t.photo_evidence_url,
                                    safetyOfficerCoSigned: Boolean(
                                        t.safety_officer_signed_at,
                                    ),
                                    safetyOfficerName:
                                        t.safety_officer?.name ?? undefined,
                                    safetyOfficerSignedAt:
                                        t.safety_officer_signed_at ?? undefined,
                                    notes: t.notes,
                                }),
                            ),
                        );
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
        if (!rejectReason.trim()) {
            return;
        }

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
                    body: JSON.stringify({
                        decision: 'reject',
                        reason: rejectReason,
                    }),
                },
            );
        } catch {
            // Graceful fallback
        } finally {
            setIsAuthorizingLift(false);
            setShowRejectModal(false);
            setLiftPlan((prev) => ({
                ...prev,
                status: 'rejected',
                safetyOfficerSignOff: {
                    signed: false,
                    rejectionReason: rejectReason,
                },
            }));
        }
    };

    const handleCoSignTbm = async (meetingId: string) => {
        setCoSigningTbmId(meetingId);
        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        try {
            await fetch(
                `/operations/safety/toolbox-meetings/${meetingId}/cosign`,
                {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                },
            );
        } catch {
            // Graceful fallback
        } finally {
            setCoSigningTbmId(null);
            setTbms((prev) =>
                prev.map((m) =>
                    m.id === meetingId
                        ? {
                              ...m,
                              safetyOfficerCoSigned: true,
                              safetyOfficerName: 'Engr. J. Morales (SO-3)',
                              safetyOfficerSignedAt:
                                  new Date().toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                  }),
                          }
                        : m,
                ),
            );
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
        setShowHazardForm(false);

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

    const coSignedTbmCount = tbms.filter((t) => t.safetyOfficerCoSigned).length;
    const openHazardsCount = hazards.filter((h) => h.status === 'open').length;
    const imminentHazardsCount = hazards.filter(
        (h) => h.status === 'open' && h.severity === 'imminent_danger',
    ).length;

    return (
        <div className="mx-auto w-full max-w-7xl space-y-5 p-3 text-ink md:p-6">
            {/* Top Statutory Header Ribbon */}
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-ink shadow-xs">
                            <Shield className="h-6 w-6" />
                        </span>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-lg font-bold tracking-tight text-ink">
                                    OSH Safety Command &amp; Decision Center
                                </h1>
                                <span className="inline-flex items-center gap-1 rounded border border-brand/40 bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-strong uppercase">
                                    Statutory Authority
                                </span>
                            </div>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                DOLE D.O. 13 s. 1998 · Republic Act No. 11058 ·
                                OSH Standards Rule 1050 &amp; 1410
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success-soft px-3 py-1.5 text-xs font-bold text-success-strong">
                            <ShieldCheck className="h-4 w-4" />
                            SO-3 Officer: Engr. Jonathan Morales (DOLE Cert
                            #2023-441)
                        </div>
                        {wsoActive ? (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-danger bg-danger px-3 py-1.5 text-xs font-bold text-white shadow-xs">
                                <AlertOctagon className="h-4 w-4 animate-bounce" />
                                WSO ACTIVE
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-ink-soft">
                                <Activity className="h-3.5 w-3.5 text-success-strong" />
                                All Sites Normal
                            </span>
                        )}
                    </div>
                </div>

                {/* Statutory 5-KPI Ribbons */}
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-5">
                    <div className="rounded-xl border border-line bg-surface-subtle p-3.5 shadow-2xs">
                        <span className="block font-medium text-ink-soft">
                            Safe Man-Hours:
                        </span>
                        <div className="mt-1.5 flex items-baseline gap-1">
                            <span className="text-xl font-extrabold text-brand">
                                {metrics.safeManHoursWithoutLti.toLocaleString()}
                            </span>
                            <span className="text-[11px] font-semibold text-success-strong">
                                (0 LTI)
                            </span>
                        </div>
                        <p className="mt-1 text-[10px] text-ink-soft">
                            Cumulative project baseline
                        </p>
                    </div>

                    <div className="rounded-xl border border-line bg-surface-subtle p-3.5 shadow-2xs">
                        <span className="block font-medium text-ink-soft">
                            Days Incident-Free:
                        </span>
                        <div className="mt-1.5 flex items-baseline gap-1">
                            <span className="text-xl font-extrabold text-success-strong">
                                {metrics.daysWithoutLti}
                            </span>
                            <span className="text-[11px] text-ink-soft">
                                days
                            </span>
                        </div>
                        <p className="mt-1 text-[10px] text-ink-soft">
                            Zero Lost-Time Injuries
                        </p>
                    </div>

                    <div className="rounded-xl border border-line bg-surface-subtle p-3.5 shadow-2xs">
                        <span className="block font-medium text-ink-soft">
                            Daily TBM Governance:
                        </span>
                        <div className="mt-1.5 flex items-baseline gap-1">
                            <span className="text-xl font-extrabold text-ink">
                                {metrics.todayTbmCompletionPercentage}%
                            </span>
                            <span className="text-[11px] font-bold text-success-strong">
                                ({coSignedTbmCount}/{tbms.length} Co-Signed)
                            </span>
                        </div>
                        <p className="mt-1 text-[10px] text-ink-soft">
                            Morning site compliance
                        </p>
                    </div>

                    <div className="rounded-xl border border-line bg-surface-subtle p-3.5 shadow-2xs">
                        <span className="block font-medium text-ink-soft">
                            Active Hazard Tickets:
                        </span>
                        <div className="mt-1.5 flex items-baseline gap-1">
                            <span
                                className={cn(
                                    'text-xl font-extrabold',
                                    openHazardsCount > 0
                                        ? 'text-warning-strong'
                                        : 'text-success-strong',
                                )}
                            >
                                {openHazardsCount}
                            </span>
                            <span className="text-[11px] text-ink-soft">
                                open ({imminentHazardsCount} Imminent)
                            </span>
                        </div>
                        <p className="mt-1 text-[10px] text-ink-soft">
                            CAPA triage queue
                        </p>
                    </div>

                    <div className="rounded-xl border border-line bg-surface-subtle p-3.5 shadow-2xs">
                        <span className="block font-medium text-ink-soft">
                            Quarantine / LOTO:
                        </span>
                        <div className="mt-1.5 flex items-baseline gap-1">
                            <span
                                className={cn(
                                    'text-xl font-extrabold',
                                    wsoActive ? 'text-danger' : 'text-ink',
                                )}
                            >
                                {wsoActive ? '1 WSO' : '0 Lockouts'}
                            </span>
                            <span className="text-[11px] text-ink-soft">
                                {wsoActive ? 'Active Halt' : 'Clear'}
                            </span>
                        </div>
                        <p className="mt-1 text-[10px] text-ink-soft">
                            Equipment stop-work state
                        </p>
                    </div>
                </div>
            </div>

            {/* Active Work Stoppage Emergency Banner if Issued */}
            {wsoActive && (
                <div className="animate-pulse rounded-2xl border-2 border-danger bg-danger-soft p-4 shadow-lg">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <AlertOctagon className="mt-0.5 h-7 w-7 shrink-0 text-danger" />
                            <div>
                                <h2 className="text-sm font-extrabold tracking-wide text-danger uppercase">
                                    STATUTORY WORK STOPPAGE ORDER (WSO) IN
                                    EFFECT
                                </h2>
                                <p className="mt-1 text-xs font-semibold text-danger">
                                    {wsoReason ||
                                        'Imminent danger condition detected on site.'}
                                </p>
                                <p className="mt-0.5 text-[11px] text-ink-soft">
                                    Authority: DOLE D.O. 13 s. 1998 Section 8
                                    &amp; Republic Act No. 11058 Imminent Danger
                                    Mandate.
                                </p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant="secondary"
                            disabled={isSubmittingWso}
                            onClick={handleLiftWso}
                            className="shrink-0 bg-surface text-xs font-bold text-danger hover:bg-surface-subtle"
                        >
                            {isSubmittingWso
                                ? 'Lifting Order...'
                                : 'Lift Stoppage (Rectified)'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Multi-Column Desktop Command Center Layout */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                {/* ============================================================ */}
                {/* LEFT / PRIMARY DECISION COLUMN (8 cols / ~65%)                */}
                {/* ============================================================ */}
                <div className="space-y-5 lg:col-span-8">
                    {/* Decision Gate 1: Critical Lift Plan Gatekeeper */}
                    <Panel className="overflow-hidden p-4 shadow-xs md:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                                    <HardHat className="h-4 w-4" />
                                </span>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-ink">
                                            Critical Lift Authorization Gate #
                                            {liftPlan.liftReference}
                                        </h3>
                                        <span
                                            className={cn(
                                                'rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                                                liftPlan.status === 'approved'
                                                    ? 'bg-success-soft text-success-strong'
                                                    : liftPlan.status ===
                                                        'rejected'
                                                      ? 'bg-danger-soft text-danger-strong'
                                                      : 'bg-warning-soft text-warning-strong',
                                            )}
                                        >
                                            {liftPlan.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <p className="text-xs text-ink-soft">
                                        Site: {liftPlan.projectSite} · Assigned:{' '}
                                        {liftPlan.equipmentModel}
                                    </p>
                                </div>
                            </div>

                            <span className="inline-flex items-center gap-1 rounded bg-danger-soft px-2.5 py-1 text-xs font-bold text-danger">
                                <ShieldAlert className="h-3.5 w-3.5" />
                                Risk: CRITICAL LIFT (&gt;80% Cap)
                            </span>
                        </div>

                        {/* Interactive Load Capacity Margin Visual Bar */}
                        <div className="mt-4 rounded-xl border border-line bg-surface-subtle p-3.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-ink">
                                    Crane Load Moment vs. Rated Capacity Margin:
                                </span>
                                <span
                                    className={cn(
                                        'font-extrabold',
                                        liftPlan.loadPercentageOfCapacity > 85
                                            ? 'text-danger'
                                            : liftPlan.loadPercentageOfCapacity >
                                                75
                                              ? 'text-warning-strong'
                                              : 'text-success-strong',
                                    )}
                                >
                                    {liftPlan.loadPercentageOfCapacity}% of
                                    Rated Limit
                                </span>
                            </div>

                            {/* Visual Progress Bar */}
                            <div className="relative mt-2 h-3.5 w-full overflow-hidden rounded-full bg-line">
                                <div
                                    className={cn(
                                        'h-full transition-all duration-300',
                                        liftPlan.loadPercentageOfCapacity > 85
                                            ? 'bg-danger'
                                            : liftPlan.loadPercentageOfCapacity >
                                                75
                                              ? 'bg-warning'
                                              : 'bg-success',
                                    )}
                                    style={{
                                        width: `${Math.min(liftPlan.loadPercentageOfCapacity, 100)}%`,
                                    }}
                                />
                                {/* Threshold Markers */}
                                <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-ink/40"
                                    style={{ left: '80%' }}
                                    title="80% DOLE Critical Lift Threshold"
                                />
                                <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-danger"
                                    style={{ left: '85%' }}
                                    title="85% Safe DOLE Absolute Threshold"
                                />
                            </div>

                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-soft">
                                <span>0% Safe</span>
                                <span>75% Routine</span>
                                <span className="font-semibold text-warning-strong">
                                    80% DOLE Critical Sign-off
                                </span>
                                <span className="font-bold text-danger">
                                    85% DOLE Max Cap
                                </span>
                            </div>
                        </div>

                        {/* Engineering & Rigging Technical Verification Grid */}
                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
                            <div className="rounded-lg border border-line bg-surface p-3">
                                <span className="block text-ink-soft">
                                    Gross Load Weight:
                                </span>
                                <p className="mt-0.5 text-base font-extrabold text-ink">
                                    {liftPlan.grossLoadWeightTons} Tons
                                </p>
                                <p className="mt-0.5 text-[11px] text-ink-soft">
                                    Rated Cap:{' '}
                                    <strong>
                                        {liftPlan.craneRatedCapacityTons} T
                                    </strong>
                                </p>
                            </div>

                            <div className="rounded-lg border border-line bg-surface p-3">
                                <span className="block text-ink-soft">
                                    Certified Lead Rigger:
                                </span>
                                <p className="mt-0.5 font-bold text-ink">
                                    {liftPlan.leadRiggerName}
                                </p>
                                <p className="mt-0.5 text-[11px] font-semibold text-brand">
                                    ✓ {liftPlan.riggerTesdaNcNumber}
                                </p>
                            </div>

                            <div className="rounded-lg border border-line bg-surface p-3">
                                <span className="block text-ink-soft">
                                    Boom &amp; Radius:
                                </span>
                                <p className="mt-0.5 font-bold text-ink">
                                    {liftPlan.boomLengthMeters}m /{' '}
                                    {liftPlan.workingRadiusMeters}m
                                </p>
                                <p className="mt-0.5 text-[11px] text-ink-soft">
                                    Working Angle: 68°
                                </p>
                            </div>

                            <div className="rounded-lg border border-line bg-surface p-3">
                                <span className="block text-ink-soft">
                                    Ground Bearing Support:
                                </span>
                                <p className="mt-0.5 font-bold text-success-strong">
                                    ✓ {liftPlan.groundBearingCondition}
                                </p>
                                <p className="mt-0.5 text-[11px] text-ink-soft">
                                    Engineered Timber Mats
                                </p>
                            </div>

                            <div className="rounded-lg border border-line bg-surface p-3">
                                <span className="block text-ink-soft">
                                    Wind Speed Telemetry:
                                </span>
                                <p className="mt-0.5 font-bold text-ink">
                                    {liftPlan.weatherWindSpeedKph} km/h
                                </p>
                                <p className="mt-0.5 text-[11px] text-ink-soft">
                                    Max Allowed:{' '}
                                    {liftPlan.maxAllowedWindSpeedKph} km/h
                                </p>
                            </div>

                            <div className="rounded-lg border border-line bg-surface p-3">
                                <span className="block text-ink-soft">
                                    Crane Operator:
                                </span>
                                <p className="mt-0.5 font-bold text-ink">
                                    {liftPlan.craneOperatorName}
                                </p>
                                <p className="mt-0.5 text-[11px] font-semibold text-success-strong">
                                    ✓ Heavy Mobile Crane Certified
                                </p>
                            </div>
                        </div>

                        {/* Dual-Custody Sign-Off History */}
                        <div className="mt-4 space-y-2 rounded-xl border border-line bg-surface-subtle p-3.5 text-xs">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <UserCheck className="h-4 w-4 text-success-strong" />
                                    <div>
                                        <span className="font-semibold text-ink">
                                            Foreman Pre-Lift Verification:
                                        </span>
                                        <p className="text-[11px] text-ink-soft">
                                            Signed by{' '}
                                            {liftPlan.foremanSignOff.signedBy}{' '}
                                            at{' '}
                                            {liftPlan.foremanSignOff.signedAt}
                                        </p>
                                    </div>
                                </div>
                                <span className="font-bold text-success-strong">
                                    ✓ VERIFIED &amp; TRANSMITTED
                                </span>
                            </div>

                            <div className="flex items-center justify-between border-t border-line/60 pt-2.5">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-brand" />
                                    <div>
                                        <span className="font-semibold text-ink">
                                            Safety Officer Statutory Sign-Off:
                                        </span>
                                        <p className="text-[11px] text-ink-soft">
                                            {liftPlan.safetyOfficerSignOff
                                                .signed
                                                ? `Authorized by ${liftPlan.safetyOfficerSignOff.signedBy} at ${liftPlan.safetyOfficerSignOff.signedAt}`
                                                : liftPlan.status === 'rejected'
                                                  ? `REJECTED: ${liftPlan.safetyOfficerSignOff.rejectionReason}`
                                                  : 'Awaiting your statutory sign-off before crane swing activation.'}
                                        </p>
                                    </div>
                                </div>
                                {liftPlan.safetyOfficerSignOff.signed ? (
                                    <span className="font-bold text-success-strong">
                                        ✓ STATUTORILY AUTHORIZED
                                    </span>
                                ) : liftPlan.status === 'rejected' ? (
                                    <span className="font-bold text-danger">
                                        ✗ REJECTED
                                    </span>
                                ) : (
                                    <span className="font-bold text-warning-strong">
                                        PENDING YOUR REVIEW
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Decision Action Bar */}
                        {liftPlan.status === 'pending_so_review' && (
                            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
                                <Button
                                    size="sm"
                                    variant="danger"
                                    disabled={isAuthorizingLift}
                                    onClick={() => setShowRejectModal(true)}
                                >
                                    Reject / Require Recalculation
                                </Button>
                                <Button
                                    size="md"
                                    variant="primary"
                                    disabled={isAuthorizingLift}
                                    onClick={handleApproveLift}
                                >
                                    <Check className="mr-1.5 h-4 w-4" />
                                    {isAuthorizingLift
                                        ? 'Authorizing Permit...'
                                        : 'Authorize Critical Lift Permit'}
                                </Button>
                            </div>
                        )}

                        {/* Reject Modal */}
                        {showRejectModal && (
                            <div className="mt-3 rounded-xl border border-danger/40 bg-danger-soft/20 p-3.5 text-xs">
                                <label className="block font-bold text-danger">
                                    Reason for Critical Lift Rejection /
                                    Recalculation:
                                </label>
                                <input
                                    type="text"
                                    value={rejectReason}
                                    onChange={(e) =>
                                        setRejectReason(e.target.value)
                                    }
                                    placeholder="e.g. Ground bearing unverified; exceeds 80% margin without secondary timber pads."
                                    className="mt-2 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink"
                                />
                                <div className="mt-2.5 flex justify-end gap-2">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() =>
                                            setShowRejectModal(false)
                                        }
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        disabled={
                                            !rejectReason.trim() ||
                                            isAuthorizingLift
                                        }
                                        onClick={handleRejectLift}
                                    >
                                        Confirm Rejection
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Panel>

                    {/* Decision Gate 2: Multi-Site Daily Toolbox Meeting (TBM) Governance */}
                    <Panel className="p-4 shadow-xs md:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                                    <Users className="h-4 w-4" />
                                </span>
                                <div>
                                    <h3 className="text-sm font-bold text-ink">
                                        Multi-Site Daily Toolbox Meeting (TBM)
                                        Governance
                                    </h3>
                                    <p className="text-xs text-ink-soft">
                                        DOLE D.O. 13 Section 12 Statutory
                                        Briefing &amp; Crew Fitness Roster
                                    </p>
                                </div>
                            </div>
                            <span className="rounded bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-ink-soft">
                                {coSignedTbmCount}/{tbms.length} Sites Co-Signed
                            </span>
                        </div>

                        <div className="mt-3 space-y-2.5">
                            {tbms.map((tbm) => (
                                <div
                                    key={tbm.id}
                                    className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-surface-subtle p-3.5 text-xs sm:flex-row sm:items-center"
                                >
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-ink">
                                                {tbm.projectSite}
                                            </span>
                                            <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                                                {tbm.time}
                                            </span>
                                            <span className="rounded bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-strong">
                                                {tbm.attendeeCount} Crew
                                                Attended
                                            </span>
                                        </div>
                                        <p className="font-semibold text-ink">
                                            Topic: {tbm.topicTitle}
                                        </p>
                                        <p className="text-[11px] text-ink-soft">
                                            Conducted by {tbm.conductorName} ·{' '}
                                            {tbm.notes}
                                        </p>
                                    </div>

                                    <div className="shrink-0">
                                        {tbm.safetyOfficerCoSigned ? (
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-success-strong">
                                                <CheckCircle2 className="h-4 w-4" />
                                                <span>
                                                    Co-Signed (
                                                    {tbm.safetyOfficerSignedAt})
                                                </span>
                                            </div>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                disabled={
                                                    coSigningTbmId === tbm.id
                                                }
                                                onClick={() =>
                                                    handleCoSignTbm(tbm.id)
                                                }
                                            >
                                                <Check className="mr-1 h-3.5 w-3.5" />
                                                {coSigningTbmId === tbm.id
                                                    ? 'Signing...'
                                                    : 'Co-Sign TBM'}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    {/* Decision Gate 3: Active Site Hazard & CAPA Registry */}
                    <Panel className="p-4 shadow-xs md:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-soft text-warning-strong">
                                    <Sliders className="h-4 w-4" />
                                </span>
                                <div>
                                    <h3 className="text-sm font-bold text-ink">
                                        Site Hazard &amp; CAPA Registry
                                    </h3>
                                    <p className="text-xs text-ink-soft">
                                        Corrective &amp; Preventive Action Logs
                                        under DOLE OSH Standards Rule 1050
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant={
                                    showHazardForm ? 'secondary' : 'primary'
                                }
                                onClick={() =>
                                    setShowHazardForm(!showHazardForm)
                                }
                            >
                                {showHazardForm ? (
                                    <>
                                        <X className="mr-1 h-3.5 w-3.5" /> Close
                                        Form
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-1 h-3.5 w-3.5" />{' '}
                                        Log New Hazard
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Collapsible New Hazard Form */}
                        {showHazardForm && (
                            <form
                                onSubmit={handleCreateHazard}
                                className="mt-4 space-y-3 rounded-xl border border-line bg-surface-subtle p-4 text-xs"
                            >
                                <h4 className="font-bold text-ink">
                                    Log Site Non-Compliance / Hazard Ticket
                                </h4>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block font-semibold text-ink">
                                            Category:
                                        </label>
                                        <select
                                            value={hazardCategory}
                                            onChange={(e) =>
                                                setHazardCategory(
                                                    e.target
                                                        .value as HazardCategory,
                                                )
                                            }
                                            className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink"
                                        >
                                            <option value="rigging_tackle">
                                                Rigging Hardware &amp; Slings
                                            </option>
                                            <option value="ground_soil_instability">
                                                Ground / Outrigger Instability
                                            </option>
                                            <option value="ppe_violation">
                                                PPE &amp; Fall Protection
                                                Violation
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
                                            DOLE Severity Level:
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
                                                Minor (General housekeeping)
                                            </option>
                                            <option value="moderate">
                                                Moderate (Hardware / Rigging
                                                wear)
                                            </option>
                                            <option value="high">
                                                High (Severe risk / Out of spec)
                                            </option>
                                            <option value="imminent_danger">
                                                IMMINENT DANGER (Triggers Work
                                                Stoppage)
                                            </option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block font-semibold text-ink">
                                        Location / Site Grid:
                                    </label>
                                    <input
                                        type="text"
                                        value={hazardLocation}
                                        onChange={(e) =>
                                            setHazardLocation(e.target.value)
                                        }
                                        className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block font-semibold text-ink">
                                        Observation Description:
                                    </label>
                                    <textarea
                                        value={hazardDesc}
                                        onChange={(e) =>
                                            setHazardDesc(e.target.value)
                                        }
                                        rows={2}
                                        placeholder="Describe specific safety violation and part..."
                                        className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink"
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
                                        placeholder="e.g. Immediate replacement of damaged wire rope sling"
                                        className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink"
                                    />
                                </div>

                                <div className="flex items-center justify-between pt-1">
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
                                            : 'Attach Photo Evidence'}
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="md"
                                        disabled={
                                            !hazardDesc.trim() ||
                                            isSubmittingHazard
                                        }
                                    >
                                        {isSubmittingHazard
                                            ? 'Logging Ticket...'
                                            : 'Log Ticket'}
                                    </Button>
                                </div>
                            </form>
                        )}

                        {/* Active Hazard Tickets List */}
                        <div className="mt-3 space-y-2.5">
                            {hazards.map((ticket) => (
                                <div
                                    key={ticket.id}
                                    className="space-y-2 rounded-xl border border-line bg-surface p-3.5 text-xs shadow-2xs"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-ink">
                                                #{ticket.ticketCode}
                                            </span>
                                            <span
                                                className={cn(
                                                    'rounded px-2 py-0.5 text-[10px] font-bold uppercase',
                                                    ticket.severity ===
                                                        'imminent_danger'
                                                        ? 'bg-danger text-white'
                                                        : ticket.severity ===
                                                            'high'
                                                          ? 'bg-danger-soft text-danger'
                                                          : ticket.severity ===
                                                              'moderate'
                                                            ? 'bg-warning-soft text-warning-strong'
                                                            : 'bg-surface-subtle text-ink-soft',
                                                )}
                                            >
                                                {ticket.severity.replace(
                                                    /_/g,
                                                    ' ',
                                                )}
                                            </span>
                                            <span className="text-ink-soft">
                                                · {ticket.projectSite}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span
                                                className={cn(
                                                    'rounded px-2 py-0.5 text-[10px] font-bold uppercase',
                                                    ticket.status ===
                                                        'rectified'
                                                        ? 'bg-success-soft text-success-strong'
                                                        : 'bg-warning-soft text-warning-strong',
                                                )}
                                            >
                                                {ticket.status}
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
                                    <div className="rounded-lg bg-surface-subtle p-2 text-[11px] text-ink">
                                        <span className="font-semibold text-brand">
                                            CAPA Required:
                                        </span>{' '}
                                        {ticket.correctiveActionRequired}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between border-t border-line/60 pt-2 text-[10px] text-ink-soft">
                                        <span>
                                            Zone: {ticket.locationDetail}
                                        </span>
                                        <span>
                                            Logged by: {ticket.reportedBy} (
                                            {ticket.reportedAt})
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </div>

                {/* ============================================================ */}
                {/* RIGHT / TELEMETRY & FAST ACTION RAIL (4 cols / ~35%)          */}
                {/* ============================================================ */}
                <div className="space-y-5 lg:col-span-4">
                    {/* Live Site Environmental & Wind Telemetry */}
                    <WeatherSafetyTelemetry
                        variant="site"
                        locationLabel="Makati Skysuites & Metro Sites"
                        className="shadow-xs"
                    />

                    {/* Break-Glass Statutory Emergency Controls */}
                    <Panel className="space-y-3 border-danger/40 bg-danger-soft/10 p-4 text-xs shadow-xs">
                        <div className="flex items-center gap-2 border-b border-danger/20 pb-2 text-danger">
                            <AlertOctagon className="h-5 w-5 shrink-0" />
                            <div>
                                <h3 className="font-bold text-danger">
                                    Statutory Stop-Work Authority
                                </h3>
                                <p className="text-[10px] text-ink-soft">
                                    RA 11058 Sec 20 / DOLE D.O. 13 Sec 8
                                </p>
                            </div>
                        </div>

                        <p className="text-[11px] leading-relaxed text-ink-soft">
                            The Safety Officer is legally authorized to halt any
                            operation exhibiting imminent danger to life or
                            mechanical integrity.
                        </p>

                        {wsoActive ? (
                            <div className="space-y-2 rounded-xl border border-danger bg-danger-soft/30 p-3">
                                <p className="font-bold text-danger">
                                    ⚠️ WORK STOPPAGE ACTIVE
                                </p>
                                <p className="text-[11px] text-ink">
                                    {wsoReason ||
                                        'Imminent danger stop-work in effect.'}
                                </p>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={isSubmittingWso}
                                    onClick={handleLiftWso}
                                    className="w-full bg-surface text-danger"
                                >
                                    {isSubmittingWso
                                        ? 'Lifting Order...'
                                        : 'Lift Stoppage Order'}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="block font-semibold text-ink">
                                    Issue Work Stoppage Reason:
                                </label>
                                <input
                                    type="text"
                                    value={wsoReason}
                                    onChange={(e) =>
                                        setWsoReason(e.target.value)
                                    }
                                    placeholder="e.g. Outrigger hydraulic leak during heavy lift"
                                    className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink placeholder:text-ink-soft"
                                />
                                <Button
                                    variant="danger"
                                    size="md"
                                    disabled={
                                        !wsoReason.trim() || isSubmittingWso
                                    }
                                    onClick={handleIssueWso}
                                    className="w-full"
                                >
                                    {isSubmittingWso
                                        ? 'Broadcasting Order...'
                                        : 'Issue Statutory Work Stoppage'}
                                </Button>
                            </div>
                        )}
                    </Panel>

                    {/* Philippine Statutory DOLE Compliance Exporters */}
                    <Panel className="space-y-3 p-4 text-xs shadow-xs">
                        <div className="border-b border-line pb-2.5">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                                <FileSpreadsheet className="h-4 w-4 text-brand" />
                                Philippine Statutory DOLE Exporters
                            </h3>
                            <p className="mt-0.5 text-[11px] text-ink-soft">
                                Pre-formatted statutory filings under DOLE OSH
                                Standards Rule 1050
                            </p>
                        </div>

                        <div className="space-y-2.5">
                            <div className="rounded-lg border border-line bg-surface p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-bold text-ink">
                                        <FileText className="h-4 w-4 text-brand" />
                                        <span>DOLE WAIR (Incident Form)</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                            window.open(
                                                '/api/v1/safety/reports/wair?format=pdf',
                                                '_blank',
                                            );
                                        }}
                                    >
                                        <Download className="mr-1 h-3.5 w-3.5" />
                                        PDF
                                    </Button>
                                </div>
                                <p className="mt-1 text-[10px] text-ink-soft">
                                    Monthly Work Accident / Incident Report for
                                    regional DOLE submission.
                                </p>
                            </div>

                            <div className="rounded-lg border border-line bg-surface p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-bold text-ink">
                                        <ShieldCheck className="h-4 w-4 text-brand" />
                                        <span>CSHP Safe Man-Hours Ledger</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                            window.open(
                                                '/api/v1/safety/reports/tbm-ledger?format=xlsx',
                                                '_blank',
                                            );
                                        }}
                                    >
                                        <Download className="mr-1 h-3.5 w-3.5" />
                                        Excel
                                    </Button>
                                </div>
                                <p className="mt-1 text-[10px] text-ink-soft">
                                    Daily briefing ledger signed by
                                    DOLE-accredited Safety Officer.
                                </p>
                            </div>

                            <div className="rounded-lg border border-line bg-surface p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-bold text-ink">
                                        <CheckCircle2 className="h-4 w-4 text-brand" />
                                        <span>
                                            Daily Accomplishment Report (DAR)
                                        </span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                            window.open(
                                                '/api/v1/safety/reports/dar?format=pdf',
                                                '_blank',
                                            );
                                        }}
                                    >
                                        <Download className="mr-1 h-3.5 w-3.5" />
                                        PDF
                                    </Button>
                                </div>
                                <p className="mt-1 text-[10px] text-ink-soft">
                                    Daily operational summary encompassing
                                    briefings, critical lifts, &amp; CAPA.
                                </p>
                            </div>
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
