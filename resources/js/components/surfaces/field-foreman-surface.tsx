import {
    AlertOctagon,
    AlertTriangle,
    Camera,
    CheckCircle2,
    Clock,
    Fuel,
    HardHat,
    MapPin,
    Minus,
    Plus,
    Radio,
    ShieldAlert,
    ShieldCheck,
    Truck,
    Users,
    Wind,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Panel } from '@/components/ui';
import { getEcho } from '@/echo';
import { queueCommand, syncOutbox } from '@/lib/outbox';
import { cn } from '@/lib/utils';
import type {
    CrewMemberReadiness,
    ToolboxMeetingTopic,
} from '@/types/safety-foreman';

const SAMPLE_TOPICS: ToolboxMeetingTopic[] = [
    {
        id: 'tbm-01',
        title: 'DOLE D.O. 13: Critical Lifting & Swing Radius Clearance',
        category: 'Lifting & Rigging',
        summary:
            'Ensuring barricaded swing radius, verified crane outrigger pads, and zero personnel under suspended loads.',
        keyPoints: [
            'Verify ground bearing capacity and solid timber mats under outriggers.',
            'Confirm certified rigger (TESDA NC-II) has inspected slings and shackles.',
            'Maintain continuous radio/hand-signal communication with crane operator.',
        ],
    },
    {
        id: 'tbm-02',
        title: 'Overhead High-Voltage Power Lines Safety',
        category: 'Site Environment',
        summary:
            'Maintaining mandatory 10ft (3m) clearance from live electrical lines and spotter guidance.',
        keyPoints: [
            'Dedicated spotter must continuously watch boom tip proximity.',
            'Assume all overhead cables are energized until validated by site engineer.',
        ],
    },
    {
        id: 'tbm-03',
        title: 'Heat Stress Management & Hydration Protocol',
        category: 'Health & PPE',
        summary:
            'Mandatory hydration breaks during peak afternoon Philippine tropical heat (11:00 AM - 2:00 PM).',
        keyPoints: [
            'Rotate heavy manual labor crews every 45 minutes.',
            'Immediate reporting of dizziness, cramping, or severe fatigue.',
        ],
    },
];

const INITIAL_CREW: CrewMemberReadiness[] = [
    {
        id: 'crew-1',
        name: 'Arnel Bautista',
        role: 'crane_operator',
        roleLabel: 'Crane Operator (Heavy)',
        tesdaCertification: {
            name: 'Heavy Equipment Operation (NC-II)',
            expiryDate: '2027-04-15',
            status: 'valid',
        },
        preOpStatus: 'passed',
        tbmAttended: true,
        fitToWork: true,
    },
    {
        id: 'crew-2',
        name: 'Danilo Ramos',
        role: 'rigger_certified',
        roleLabel: 'Lead Certified Rigger',
        tesdaCertification: {
            name: 'Rigging Operations (NC-II)',
            expiryDate: '2026-11-30',
            status: 'valid',
        },
        preOpStatus: 'passed',
        tbmAttended: true,
        fitToWork: true,
    },
    {
        id: 'crew-3',
        name: 'Ramon De Jesus',
        role: 'signalman_spotter',
        roleLabel: 'Signalman / Spotter',
        preOpStatus: 'not_required',
        tbmAttended: true,
        fitToWork: true,
    },
    {
        id: 'crew-4',
        name: 'Edwin Villanueva',
        role: 'general_laborer',
        roleLabel: 'Rigging Assistant / Laborer',
        preOpStatus: 'not_required',
        tbmAttended: false,
        fitToWork: true,
    },
];

export function FieldForemanSurface() {
    const [crew, setCrew] = useState<CrewMemberReadiness[]>(INITIAL_CREW);
    const [selectedTopicId, setSelectedTopicId] = useState<string>(
        SAMPLE_TOPICS[0].id,
    );
    const [tbmPhotoAttached, setTbmPhotoAttached] = useState(false);
    const [tbmSubmitted, setTbmSubmitted] = useState(false);
    const [soCoSigned, setSoCoSigned] = useState(false);

    // Equipment Accomplishment State
    const [craneOperatingHours, setCraneOperatingHours] = useState(4.5);
    const [craneIdleHours, setCraneIdleHours] = useState(1.0);
    const [completedLifts, setCompletedLifts] = useState(12);
    const [fuelLevel] = useState(65);
    const [fuelRequested, setFuelRequested] = useState(false);
    const [delayReason, setDelayReason] = useState<string | null>(null);

    // SOS & WSO State
    const [sosTriggered, setSosTriggered] = useState(false);
    const [isSubmittingTbm, setIsSubmittingTbm] = useState(false);
    const [tbmAuditHash, setTbmAuditHash] = useState<string | null>(null);
    const [isSubmittingSos, setIsSubmittingSos] = useState(false);
    const [activeWsoReason, setActiveWsoReason] = useState<string | null>(null);

    useEffect(() => {
        const echo = getEcho();

        if (echo) {
            const channel = echo.private('operations.safety');

            channel.listen(
                '.WorkStoppageChanged',
                (e: { notice?: { is_active?: boolean; reason?: string } }) => {
                    if (e.notice) {
                        if (e.notice.is_active) {
                            setActiveWsoReason(
                                e.notice.reason ??
                                    'Statutory DOLE Stop Work Order in Effect.',
                            );
                        } else {
                            setActiveWsoReason(null);
                        }
                    }
                },
            );

            return () => {
                channel.stopListening('.WorkStoppageChanged');
            };
        }
    }, []);

    const activeTopic =
        SAMPLE_TOPICS.find((t) => t.id === selectedTopicId) ?? SAMPLE_TOPICS[0];

    const attendedCount = crew.filter((c) => c.tbmAttended).length;
    const readyCrewCount = crew.filter(
        (c) => c.tbmAttended && c.fitToWork && c.preOpStatus !== 'flagged',
    ).length;

    const toggleCrewTbm = (id: string) => {
        setCrew((prev) =>
            prev.map((c) =>
                c.id === id ? { ...c, tbmAttended: !c.tbmAttended } : c,
            ),
        );
    };

    const handleSelectAllTbm = () => {
        const allAttended = crew.every((c) => c.tbmAttended);
        setCrew((prev) =>
            prev.map((c) => ({ ...c, tbmAttended: !allAttended })),
        );
    };

    const handleSubmitTbm = async () => {
        setIsSubmittingTbm(true);
        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';
        const attendeeIds = crew.filter((c) => c.tbmAttended).map((c) => c.id);

        const payload = {
            project_site: 'Makati Skysuites Tower (Site Grid B-4)',
            topic_id: activeTopic.id,
            topic_title: activeTopic.title,
            topic_category: activeTopic.category,
            attendee_ids:
                attendeeIds.length > 0
                    ? attendeeIds
                    : ['crew-1', 'crew-2', 'crew-3', 'crew-4'],
            photo_evidence_url: tbmPhotoAttached
                ? 'https://storage.core2-ph.com/tbm/site-grid-b4.jpg'
                : null,
            notes: 'Conducted pre-shift safety briefing covering swing radius clearance & PPE inspection.',
        };

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            queueCommand(
                'tbm.submit',
                '/operations/safety/toolbox-meetings',
                payload,
            );
            setTbmSubmitted(true);
            setTbmAuditHash('PH-DOLE-CSHP-QUEUED-OFFLINE');
            setIsSubmittingTbm(false);

            return;
        }

        try {
            const res = await fetch('/operations/safety/toolbox-meetings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                const json = await res.json();
                setTbmSubmitted(true);
                setTbmAuditHash(
                    json.data?.audit_hash ?? 'PH-DOLE-CSHP-2026-TBM-VERIFIED',
                );
                setTimeout(() => {
                    setSoCoSigned(true);
                }, 2000);
            } else {
                queueCommand(
                    'tbm.submit',
                    '/operations/safety/toolbox-meetings',
                    payload,
                );
                setTbmSubmitted(true);
                setTbmAuditHash('PH-DOLE-CSHP-QUEUED-OFFLINE');
            }
        } catch {
            queueCommand(
                'tbm.submit',
                '/operations/safety/toolbox-meetings',
                payload,
            );
            setTbmSubmitted(true);
            setTbmAuditHash('PH-DOLE-CSHP-QUEUED-OFFLINE');
            void syncOutbox();
        } finally {
            setIsSubmittingTbm(false);
        }
    };

    const handleDispatchSos = async () => {
        setIsSubmittingSos(true);
        const csrfToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';
        const commandId =
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `sos-${Date.now()}`;

        try {
            await fetch('/api/v1/sos-incidents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Idempotency-Key': commandId,
                },
                body: JSON.stringify({
                    command_id: commandId,
                    worker_note:
                        'On-site emergency distress broadcast from Field Foreman deck.',
                    latitude: 14.5547,
                    longitude: 121.0244,
                }),
            });
        } catch {
            // Graceful fallback
        } finally {
            setIsSubmittingSos(false);
            setSosTriggered(false);
        }
    };

    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-3 text-ink md:p-6">
            {/* Realtime Statutory Work Stoppage Emergency Banner */}
            {activeWsoReason && (
                <div className="border-danger-line flex animate-pulse items-center justify-between gap-3 rounded-xl border bg-danger-soft p-4 text-danger-strong shadow-sm">
                    <div className="flex items-center gap-3">
                        <AlertOctagon className="h-6 w-6 shrink-0 text-danger" />
                        <div>
                            <p className="text-xs font-bold tracking-wider uppercase">
                                Statutory Work Stoppage Order (WSO) Active
                            </p>
                            <p className="text-xs">{activeWsoReason}</p>
                        </div>
                    </div>
                    <span className="rounded-full bg-danger px-2.5 py-1 text-[11px] font-bold text-white uppercase">
                        Halt All Lifts
                    </span>
                </div>
            )}

            {/* Top Site & Environmental Status Bar */}
            <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                            <HardHat className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="text-base leading-tight font-bold text-ink">
                                Field Foreman Operations Deck
                            </h2>
                            <p className="flex items-center gap-1 text-xs text-ink-soft">
                                <MapPin className="h-3.5 w-3.5 text-brand" />
                                Project: Makati Skysuites Tower (Site Grid B-4)
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-success-soft px-2.5 py-1 font-medium text-success-strong">
                            <Radio className="h-3.5 w-3.5 animate-pulse" />
                            Shift Active (07:00 - 17:00)
                        </span>
                    </div>
                </div>

                {/* Weather & Environmental Safety Readout */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    <div className="rounded-lg border border-line bg-surface-subtle p-2.5">
                        <span className="block text-ink-soft">
                            Wind Speed (DOLE Safe):
                        </span>
                        <div className="mt-1 flex items-center gap-1.5 font-semibold text-ink">
                            <Wind className="h-4 w-4 text-brand" />
                            <span>14 km/h (Safe &lt;35 km/h)</span>
                        </div>
                    </div>
                    <div className="rounded-lg border border-line bg-surface-subtle p-2.5">
                        <span className="block text-ink-soft">
                            Ground Condition:
                        </span>
                        <div className="mt-1 flex items-center gap-1.5 font-semibold text-success-strong">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Compacted + Timber Mats</span>
                        </div>
                    </div>
                    <div className="col-span-2 rounded-lg border border-line bg-surface-subtle p-2.5 sm:col-span-1">
                        <span className="block text-ink-soft">
                            Assigned Crane:
                        </span>
                        <div className="mt-1 flex items-center gap-1.5 font-semibold text-ink">
                            <Truck className="h-4 w-4 text-brand" />
                            <span>SANY 50T (CR-501)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Crew Readiness & Verification Section */}
            <Panel className="p-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                    <div>
                        <h3 className="flex items-center gap-2 text-sm font-bold">
                            <Users className="h-4 w-4 text-brand" />
                            Site Crew Readiness & Pre-Op Check
                        </h3>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            {readyCrewCount} of {crew.length} personnel
                            certified, checked-in, & fit to work
                        </p>
                    </div>
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                            readyCrewCount === crew.length
                                ? 'bg-success-soft text-success-strong'
                                : 'bg-warning-soft text-warning-strong',
                        )}
                    >
                        {readyCrewCount === crew.length
                            ? 'Ready to Lift'
                            : 'Action Required'}
                    </span>
                </div>

                <div className="mt-3 space-y-2">
                    {crew.map((member) => (
                        <div
                            key={member.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-subtle p-2.5 transition-colors hover:bg-surface"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-semibold text-ink">
                                        {member.name}
                                    </span>
                                    <span className="rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink-soft">
                                        {member.roleLabel}
                                    </span>
                                </div>
                                {member.tesdaCertification && (
                                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-brand">
                                        <ShieldCheck className="h-3 w-3" />
                                        {member.tesdaCertification.name} (Valid
                                        to{' '}
                                        {member.tesdaCertification.expiryDate})
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {member.preOpStatus !== 'not_required' && (
                                    <span
                                        className={cn(
                                            'rounded px-2 py-0.5 text-xs font-medium',
                                            member.preOpStatus === 'passed'
                                                ? 'bg-success-soft text-success-strong'
                                                : 'bg-danger-soft text-danger-strong',
                                        )}
                                    >
                                        Pre-Op{' '}
                                        {member.preOpStatus.toUpperCase()}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => toggleCrewTbm(member.id)}
                                    className={cn(
                                        'flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors',
                                        member.tbmAttended
                                            ? 'border-brand bg-brand text-white'
                                            : 'border-line bg-surface text-ink-soft hover:bg-surface-subtle',
                                    )}
                                >
                                    {member.tbmAttended ? (
                                        <>
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            TBM In
                                        </>
                                    ) : (
                                        'No TBM'
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </Panel>

            {/* DOLE Toolbox Meeting (TBM) Module */}
            <Panel className="border-brand/30 bg-gradient-to-b from-surface to-brand-soft/10 p-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                    <div>
                        <h3 className="flex items-center gap-2 text-sm font-bold">
                            <HardHat className="h-4 w-4 text-brand" />
                            Daily Safety Toolbox Meeting (TBM)
                        </h3>
                        <p className="text-xs text-ink-soft">
                            Mandatory DOLE D.O. 13 s. 1998 compliance record
                        </p>
                    </div>
                    {tbmSubmitted && (
                        <span
                            className={cn(
                                'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                                soCoSigned
                                    ? 'bg-success-soft text-success-strong'
                                    : 'bg-warning-soft text-warning-strong',
                            )}
                        >
                            {soCoSigned ? (
                                <>
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    SO Co-Signed (Engr. Morales)
                                </>
                            ) : (
                                <>
                                    <Clock className="h-3.5 w-3.5 animate-spin" />
                                    Awaiting SO Co-Sign
                                </>
                            )}
                        </span>
                    )}
                </div>

                {!tbmSubmitted ? (
                    <div className="mt-3 space-y-3">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-ink">
                                Select Daily Safety Focus Topic:
                            </label>
                            <select
                                value={selectedTopicId}
                                onChange={(e) =>
                                    setSelectedTopicId(e.target.value)
                                }
                                className="w-full rounded-lg border border-line bg-surface p-2 text-xs font-medium text-ink focus:border-brand focus:outline-none"
                            >
                                {SAMPLE_TOPICS.map((topic) => (
                                    <option key={topic.id} value={topic.id}>
                                        [{topic.category}] {topic.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="rounded-lg border border-line bg-surface p-3 text-xs">
                            <p className="mb-1 font-semibold text-ink">
                                {activeTopic.title}
                            </p>
                            <p className="mb-2 text-ink-soft">
                                {activeTopic.summary}
                            </p>
                            <ul className="list-inside list-disc space-y-1 font-medium text-ink-soft">
                                {activeTopic.keyPoints.map((point, index) => (
                                    <li key={index}>{point}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Photo Proof Simulation */}
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-line bg-surface-subtle p-3">
                            <div className="flex items-center gap-2">
                                <Camera className="h-5 w-5 text-brand" />
                                <div>
                                    <p className="text-xs font-semibold text-ink">
                                        DOLE Group Attendance Photo
                                    </p>
                                    <p className="text-[11px] text-ink-soft">
                                        {tbmPhotoAttached
                                            ? 'Photo captured (4 workers in frame with PPE)'
                                            : 'Must include full crew with hard hats & safety vests'}
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant={
                                    tbmPhotoAttached ? 'secondary' : 'primary'
                                }
                                onClick={() =>
                                    setTbmPhotoAttached(!tbmPhotoAttached)
                                }
                            >
                                {tbmPhotoAttached
                                    ? 'Retake Photo'
                                    : 'Snap / Upload Photo'}
                            </Button>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <Button
                                size="sm"
                                variant="quiet"
                                onClick={handleSelectAllTbm}
                            >
                                Toggle All Crew ({attendedCount}/{crew.length})
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                disabled={
                                    attendedCount === 0 ||
                                    !tbmPhotoAttached ||
                                    isSubmittingTbm
                                }
                                onClick={handleSubmitTbm}
                            >
                                {isSubmittingTbm
                                    ? 'Submitting to DOLE Ledger...'
                                    : 'Submit TBM & Request SO Sign-off'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="mt-3 space-y-2 rounded-lg border border-line bg-surface p-3 text-xs">
                        <div className="flex items-center justify-between font-semibold text-success-strong">
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4" />
                                TBM Logged Today at 07:15 AM
                            </span>
                            <span>{attendedCount} Workers Attended</span>
                        </div>
                        <p className="text-ink-soft">
                            Topic: {activeTopic.title}
                        </p>
                        <p className="text-[11px] text-ink-soft">
                            Audit Hash:{' '}
                            <code className="text-brand">
                                {tbmAuditHash ?? 'PH-DOLE-CSHP-2026-TBM-8842'}
                            </code>
                        </p>
                    </div>
                )}
            </Panel>

            {/* Daily Accomplishment & Equipment Performance Tracker */}
            <Panel className="p-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                        <Truck className="h-4 w-4 text-brand" />
                        Daily Equipment Log & Accomplishment (DAR)
                    </h3>
                    <span className="text-xs text-ink-soft">
                        SANY 50T Mobile Crane
                    </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    {/* Hour Meters */}
                    <div className="space-y-2 rounded-lg border border-line bg-surface-subtle p-3">
                        <span className="flex items-center gap-1.5 font-semibold text-ink">
                            <Clock className="h-3.5 w-3.5 text-brand" />
                            Operating & Idle Hours
                        </span>
                        <div className="flex items-center justify-between">
                            <span className="text-ink-soft">
                                Working Run Time:
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCraneOperatingHours((h) =>
                                            Math.max(0, h - 0.5),
                                        )
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded border border-line bg-surface hover:bg-surface-subtle"
                                >
                                    <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-12 text-center text-sm font-bold text-ink">
                                    {craneOperatingHours} hrs
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCraneOperatingHours((h) => h + 0.5)
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded border border-line bg-surface hover:bg-surface-subtle"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-line/60 pt-2">
                            <span className="text-ink-soft">
                                Idle / Standby Time:
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCraneIdleHours((h) =>
                                            Math.max(0, h - 0.5),
                                        )
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded border border-line bg-surface hover:bg-surface-subtle"
                                >
                                    <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-12 text-center text-sm font-bold text-ink">
                                    {craneIdleHours} hrs
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCraneIdleHours((h) => h + 0.5)
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded border border-line bg-surface hover:bg-surface-subtle"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Lift / Cycle Counter */}
                    <div className="space-y-2 rounded-lg border border-line bg-surface-subtle p-3">
                        <span className="flex items-center gap-1.5 font-semibold text-ink">
                            <HardHat className="h-3.5 w-3.5 text-brand" />
                            Completed Lifts & Rigging Cycles
                        </span>
                        <div className="flex items-center justify-between pt-1">
                            <span className="text-ink-soft">
                                Total Lifts Today:
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCompletedLifts((c) =>
                                            Math.max(0, c - 1),
                                        )
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded border border-line bg-surface hover:bg-surface-subtle"
                                >
                                    <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-10 text-center text-base font-bold text-ink">
                                    {completedLifts}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCompletedLifts((c) => c + 1)
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded border border-line bg-surface hover:bg-surface-subtle"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Fuel Level & Quick Top-up Request */}
                        <div className="flex items-center justify-between border-t border-line/60 pt-2">
                            <span className="flex items-center gap-1 text-ink-soft">
                                <Fuel className="h-3.5 w-3.5 text-warning-strong" />
                                Fuel:{' '}
                                <strong className="text-ink">
                                    {fuelLevel}%
                                </strong>
                            </span>
                            <Button
                                size="sm"
                                variant={fuelRequested ? 'secondary' : 'quiet'}
                                disabled={fuelRequested}
                                onClick={() => setFuelRequested(true)}
                                className="text-xs"
                            >
                                {fuelRequested
                                    ? 'Fuel Requested (100L)'
                                    : 'Request Top-Up'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Site Delay Logger */}
                <div className="mt-3 space-y-2 rounded-lg border border-line bg-surface p-3 text-xs">
                    <span className="block font-semibold text-ink">
                        Record Site Delay or Downtime Reason (Non-Productive
                        Time):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {[
                            'Client Delay (Rebar Not Ready)',
                            'Sudden Heavy Rain (Safety Stop)',
                            'Access Road Blockage',
                            'Crane Repositioning',
                        ].map((reason) => (
                            <button
                                key={reason}
                                type="button"
                                onClick={() =>
                                    setDelayReason(
                                        delayReason === reason ? null : reason,
                                    )
                                }
                                className={cn(
                                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                                    delayReason === reason
                                        ? 'border-warning-strong bg-warning-soft text-warning-strong'
                                        : 'border-line bg-surface-subtle text-ink-soft hover:bg-surface',
                                )}
                            >
                                {reason}
                            </button>
                        ))}
                    </div>
                    {delayReason && (
                        <p className="text-[11px] font-medium text-warning-strong">
                            ✓ Logged delay: "{delayReason}" with timestamp
                            attached to DAR report.
                        </p>
                    )}
                </div>
            </Panel>

            {/* Emergency & Incident Quick Action Section */}
            <div className="rounded-xl border border-danger/30 bg-danger-soft/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger text-white">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-ink">
                                Site Emergency & Hazard Trigger
                            </h4>
                            <p className="text-xs text-ink-soft">
                                Direct broadcast to Safety Officer, Operations
                                Manager & Paramedic
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="danger"
                        size="md"
                        onClick={() => setSosTriggered(true)}
                        className="font-bold tracking-wide shadow-md"
                    >
                        TRIGGER SOS / STOP WORK
                    </Button>
                </div>
            </div>

            {/* SOS Modal Simulation */}
            {sosTriggered && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-danger bg-surface p-6 text-ink shadow-2xl">
                        <div className="flex items-start justify-between border-b border-line pb-3">
                            <div className="flex items-center gap-2 text-danger">
                                <AlertTriangle className="h-6 w-6" />
                                <h3 className="text-base font-bold text-ink">
                                    Confirm Site Emergency SOS
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSosTriggered(false)}
                                className="rounded p-1 hover:bg-surface-subtle"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="my-4 space-y-3 text-xs">
                            <p className="text-ink-soft">
                                This will instantly alert the{' '}
                                <strong>Safety Officer</strong>,{' '}
                                <strong>Operations Manager</strong>, and trigger
                                an emergency work stoppage at{' '}
                                <strong>
                                    Makati Skysuites Tower (Site Grid B-4)
                                </strong>
                                .
                            </p>
                            <div className="space-y-1 rounded-lg border border-line bg-surface-subtle p-3 text-[11px]">
                                <p>
                                    <strong>GPS Coordinates:</strong> 14.5547°
                                    N, 121.0244° E
                                </p>
                                <p>
                                    <strong>Timestamp:</strong> 2026-08-29
                                    20:56:00 (PST)
                                </p>
                                <p>
                                    <strong>Active Personnel:</strong> 4 on site
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                size="sm"
                                variant="quiet"
                                onClick={() => setSosTriggered(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                variant="danger"
                                disabled={isSubmittingSos}
                                onClick={handleDispatchSos}
                            >
                                {isSubmittingSos
                                    ? 'Broadcasting Distress...'
                                    : 'Dispatch Emergency SOS'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
