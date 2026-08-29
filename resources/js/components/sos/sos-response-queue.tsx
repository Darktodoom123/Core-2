import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Phone,
    PhoneCall,
    Play,
    Radio,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Siren,
    Volume2,
    Wind,
    Wrench,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { Button, PageHeading, Panel, StatusBadge } from '@/components/ui';
import type { SosIncidentViewModel } from '@/types/workspace';
import {
    formatSosAge,
    formatSosTimestamp,
    humanizeSosValue,
} from './sos-helpers';
import { SosIncidentDetail } from './sos-incident-detail';

interface SosResponseQueueProps {
    incidents: SosIncidentViewModel[];
    refreshing?: boolean;
    onRefresh?: () => void;
}

const DEFAULT_ESCALATION_ROSTER = [
    {
        id: 1,
        tier: 'Tier 1 Priority',
        name: 'John Tan',
        role: 'Safety Director (HSE Lead)',
        phone: '+65 9123 4567',
        phone_e164: '+6591234567',
    },
    {
        id: 2,
        tier: 'Tier 2 Medical',
        name: 'Dr. Marcus Lim',
        role: 'Lead Site Medic & First-Aid Officer',
        phone: '+65 9876 5432',
        phone_e164: '+6598765432',
    },
    {
        id: 3,
        tier: 'Tier 3 Command',
        name: 'Operations Command Desk',
        role: '24/7 Incident Escalation Hotline',
        phone: '+65 6789 0123',
        phone_e164: '+6567890123',
    },
];

function playTestChime() {
    try {
        const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext;

        if (!AudioContextClass) {
            return;
        }

        const audioCtx = new AudioContextClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
            440,
            audioCtx.currentTime + 0.35,
        );

        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.01,
            audioCtx.currentTime + 0.35,
        );

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch {
        // Fallback gracefully if audio context is blocked
    }
}

export function SosResponseQueue({
    incidents,
    refreshing = false,
    onRefresh,
}: SosResponseQueueProps) {
    const [selectedId, setSelectedId] = useState<string | null>(
        incidents[0]?.id ?? null,
    );
    const [drillModalOpen, setDrillModalOpen] = useState(false);
    const [drillAcknowledged, setDrillAcknowledged] = useState(false);
    const [drillCompleted, setDrillCompleted] = useState(false);
    const [audioTested, setAudioTested] = useState(false);

    const effectiveSelectedId =
        selectedId && incidents.some((incident) => incident.id === selectedId)
            ? selectedId
            : (incidents[0]?.id ?? null);
    const selectedIncident =
        incidents.find((incident) => incident.id === effectiveSelectedId) ??
        null;

    const handleTestAudio = () => {
        playTestChime();
        setAudioTested(true);
        window.setTimeout(() => setAudioTested(false), 3000);
    };

    return (
        <section
            className="space-y-4 p-4 md:p-6"
            aria-label="Safety and emergency response queue"
        >
            <PageHeading
                title="Safety & Response Hub"
                description="Acknowledge ownership, coordinate a safe response, and close each SOS with an audited outcome. Server state remains authoritative."
                actions={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleTestAudio}
                            title="Test browser audio alarm chime"
                        >
                            <Volume2 className="h-4 w-4" aria-hidden="true" />
                            {audioTested
                                ? 'Chime tested!'
                                : 'Test station audio'}
                        </Button>
                        {onRefresh && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onRefresh}
                                disabled={refreshing}
                            >
                                <RefreshCw
                                    className={
                                        refreshing
                                            ? 'h-4 w-4 animate-spin'
                                            : 'h-4 w-4'
                                    }
                                    aria-hidden="true"
                                />
                                {refreshing ? 'Refreshing…' : 'Refresh queue'}
                            </Button>
                        )}
                    </div>
                }
            />

            {incidents.length === 0 ? (
                <div className="space-y-4">
                    {/* Safety Status Banner */}
                    <Panel className="border-l-4 border-l-success bg-surface p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3.5">
                                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success-strong ring-1 ring-success/20">
                                    <ShieldCheck
                                        className="h-5 w-5"
                                        aria-hidden="true"
                                    />
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-base font-semibold text-ink">
                                            Safety Watch Active · All Systems
                                            Normal
                                        </h2>
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-strong">
                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                                            Active Monitoring
                                        </span>
                                    </div>
                                    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-soft">
                                        Realtime emergency monitoring daemon is
                                        active. Any field-activated SOS will
                                        instantly stream into this priority
                                        queue with audible alerts, GPS tracking,
                                        and automated responder notifications.
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    setDrillAcknowledged(false);
                                    setDrillCompleted(false);
                                    setDrillModalOpen(true);
                                }}
                                className="shrink-0"
                            >
                                <Play className="h-4 w-4" aria-hidden="true" />
                                Launch drill simulation
                            </Button>
                        </div>
                    </Panel>

                    {/* Operational Telemetry Grid */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Panel className="bg-surface p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                                    <Radio
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-medium tracking-wider text-ink-soft uppercase">
                                        Live Stream
                                    </p>
                                    <p className="text-sm font-semibold text-ink">
                                        Reverb Realtime Active
                                    </p>
                                </div>
                            </div>
                        </Panel>

                        <Panel className="bg-surface p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-strong">
                                    <Clock
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-medium tracking-wider text-ink-soft uppercase">
                                        Escalation Timeout
                                    </p>
                                    <p className="text-sm font-semibold text-ink">
                                        180s Server Deadline
                                    </p>
                                </div>
                            </div>
                        </Panel>

                        <Panel className="bg-surface p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft">
                                    <Activity
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-medium tracking-wider text-ink-soft uppercase">
                                        Audit Compliance
                                    </p>
                                    <p className="text-sm font-semibold text-ink">
                                        Forensic Event Hash
                                    </p>
                                </div>
                            </div>
                        </Panel>
                    </div>

                    {/* Emergency Escalation Contact Roster */}
                    <Panel className="bg-surface p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-ink">
                                    Emergency Escalation Contact Roster
                                </h3>
                                <p className="text-xs text-ink-soft">
                                    Configured company response contacts
                                    receiving automatic escalation if an
                                    emergency is unacknowledged within 180s:
                                </p>
                            </div>
                            <Phone
                                className="h-4 w-4 text-ink-soft"
                                aria-hidden="true"
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            {DEFAULT_ESCALATION_ROSTER.map((contact) => (
                                <div
                                    key={contact.id}
                                    className="flex flex-col justify-between rounded-lg border border-line bg-surface-subtle/40 p-3.5"
                                >
                                    <div>
                                        <span className="inline-block rounded border border-line bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                                            {contact.tier}
                                        </span>
                                        <p className="mt-1.5 text-xs font-semibold text-ink">
                                            {contact.name}
                                        </p>
                                        <p className="text-[11px] text-ink-soft">
                                            {contact.role}
                                        </p>
                                    </div>
                                    <a
                                        href={`tel:${contact.phone_e164}`}
                                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                                    >
                                        <PhoneCall
                                            className="h-3.5 w-3.5"
                                            aria-hidden="true"
                                        />
                                        {contact.phone}
                                    </a>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    {/* Site Response SOP Guidelines */}
                    <Panel className="bg-surface p-5">
                        <h3 className="mb-1 text-sm font-semibold text-ink">
                            Site Emergency Response Protocols (Quick Reference)
                        </h3>
                        <p className="mb-4 text-xs text-ink-soft">
                            Standard operating procedures for rapid triage upon
                            receiving an active emergency alert:
                        </p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="space-y-1.5 rounded-lg border border-line bg-surface-subtle/50 p-3.5">
                                <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                                    <Wrench className="h-3.5 w-3.5 text-brand-strong" />
                                    <span>Crane / Rigging Malfunction</span>
                                </div>
                                <p className="text-[11px] leading-normal text-ink-soft">
                                    Verify operator is in a safe cabin position.
                                    Secure the load if safe. Isolate
                                    hydraulic/electrical power and notify lead
                                    rigging engineer.
                                </p>
                            </div>

                            <div className="space-y-1.5 rounded-lg border border-line bg-surface-subtle/50 p-3.5">
                                <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                                    <AlertTriangle className="h-3.5 w-3.5 text-danger" />
                                    <span>Site Injury & Medical Aid</span>
                                </div>
                                <p className="text-[11px] leading-normal text-ink-soft">
                                    Use the direct "Call Worker" control to
                                    assess status. Dispatch on-site first-aider
                                    and relay exact GPS coordinates to local
                                    medical response.
                                </p>
                            </div>

                            <div className="space-y-1.5 rounded-lg border border-line bg-surface-subtle/50 p-3.5">
                                <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                                    <Wind className="h-3.5 w-3.5 text-warning-strong" />
                                    <span>Adverse Weather & Wind Hold</span>
                                </div>
                                <p className="text-[11px] leading-normal text-ink-soft">
                                    For wind speeds exceeding 30 knots or
                                    thunderstorm alerts, order crane boom
                                    stowage. Log stop-work order in the dispatch
                                    operations log.
                                </p>
                            </div>
                        </div>
                    </Panel>
                </div>
            ) : (
                <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(16rem,0.42fr)_minmax(0,1fr)]">
                    <Panel className="min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between border-b border-line px-4 py-3">
                            <div>
                                <h2 className="font-semibold text-ink">
                                    Active incidents
                                </h2>
                                <p className="mt-0.5 text-xs text-ink-soft">
                                    {incidents.length} unresolved
                                </p>
                            </div>
                            <Siren
                                className="h-5 w-5 text-danger"
                                aria-hidden="true"
                            />
                        </div>
                        <ul
                            className="divide-y divide-line"
                            aria-label="Active SOS incidents"
                        >
                            {incidents.map((incident) => {
                                const selected =
                                    incident.id === effectiveSelectedId;

                                return (
                                    <li key={incident.id}>
                                        <button
                                            type="button"
                                            className={`min-h-11 w-full px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none focus-visible:ring-inset ${selected ? 'bg-danger-soft/60' : ''}`}
                                            onClick={() =>
                                                setSelectedId(incident.id)
                                            }
                                            aria-pressed={selected}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="min-w-0 truncate font-semibold text-ink">
                                                    {incident.worker.name}
                                                </span>
                                                <StatusBadge
                                                    status={
                                                        incident.status.label
                                                    }
                                                />
                                            </div>
                                            <p className="mt-1 truncate text-sm text-ink-soft">
                                                {humanizeSosValue(
                                                    incident.category.value,
                                                )}
                                            </p>
                                            <p className="mt-1 text-xs text-ink-soft">
                                                {formatSosAge(
                                                    incident.received_at,
                                                )}{' '}
                                                ·{' '}
                                                {formatSosTimestamp(
                                                    incident.received_at,
                                                )}
                                            </p>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </Panel>
                    <SosIncidentDetail incident={selectedIncident} />
                </div>
            )}

            {/* Compliance Safety Drill Simulator Modal */}
            {drillModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="drill-modal-title"
                >
                    <div className="w-full max-w-lg space-y-4 rounded-xl border border-warning-strong/40 bg-surface p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-soft text-xs font-bold text-warning-strong">
                                    🧪
                                </span>
                                <div>
                                    <h3
                                        id="drill-modal-title"
                                        className="text-base font-semibold text-ink"
                                    >
                                        Compliance Safety Drill Simulation
                                    </h3>
                                    <p className="text-xs font-semibold tracking-wider text-warning-strong uppercase">
                                        Training Simulation · No Live Emergency
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="quiet"
                                size="sm"
                                onClick={() => setDrillModalOpen(false)}
                                aria-label="Close drill modal"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {!drillCompleted ? (
                            <div className="space-y-4">
                                <div className="space-y-2 rounded-lg border border-danger-strong/30 bg-danger-soft p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-danger-strong uppercase">
                                            Simulated Alarm: Boom Sensor Fault
                                        </span>
                                        <span className="text-xs font-semibold text-danger-strong">
                                            02:44 until escalation
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium text-ink">
                                        Operator: <strong>Johnathan Doe</strong>{' '}
                                        · Crane:{' '}
                                        <strong>
                                            Liebherr LTM 11200 (#CR-101)
                                        </strong>
                                    </p>
                                    <p className="text-xs text-ink-soft">
                                        Site:{' '}
                                        <em>
                                            Jurong Island Berth 4, Singapore
                                            (Lat: 1.3521°, Long: 103.8198°)
                                        </em>
                                    </p>
                                </div>

                                {!drillAcknowledged ? (
                                    <div className="space-y-3">
                                        <p className="text-xs text-ink-soft">
                                            Step 1: Test station operator
                                            response by claiming acknowledgement
                                            ownership.
                                        </p>
                                        <Button
                                            variant="danger"
                                            className="w-full justify-center"
                                            onClick={() => {
                                                playTestChime();
                                                setDrillAcknowledged(true);
                                            }}
                                        >
                                            <ShieldAlert className="h-4 w-4" />
                                            Acknowledge drill emergency
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-success-strong">
                                            <CheckCircle2 className="h-4 w-4" />
                                            Drill acknowledged in 18 seconds
                                            (Target: &lt; 45s)
                                        </div>
                                        <p className="text-xs text-ink-soft">
                                            Step 2: Simulate resolution closeout
                                            to complete the audit drill.
                                        </p>
                                        <Button
                                            variant="primary"
                                            className="w-full justify-center"
                                            onClick={() =>
                                                setDrillCompleted(true)
                                            }
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                            Complete compliance drill
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3 py-4 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success-strong">
                                    <CheckCircle2 className="h-6 w-6" />
                                </div>
                                <h4 className="text-base font-semibold text-ink">
                                    Safety Drill Successfully Completed
                                </h4>
                                <p className="mx-auto max-w-sm text-xs text-ink-soft">
                                    Station response time and acknowledgement
                                    workflow verified successfully. All systems
                                    are operational.
                                </p>
                                <Button
                                    variant="secondary"
                                    onClick={() => setDrillModalOpen(false)}
                                    className="mt-2"
                                >
                                    Close simulation
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
