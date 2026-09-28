import {
    AlarmClock,
    Clock3,
    MapPin,
    Phone,
    ShieldCheck,
    Siren,
    UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Panel, StatusBadge } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { PlaceViewModel, SosIncidentViewModel } from '@/types/workspace';
import { SosAcknowledgeControl } from './sos-acknowledge-control';
import {
    formatSosAge,
    formatSosTimestamp,
    humanizeSosValue,
} from './sos-helpers';
import { SosLocationSummary } from './sos-location-summary';
import { SosResolutionForm } from './sos-resolution-form';
import { useSosPlaceName } from './use-sos-place-name';

interface SosIncidentDetailProps {
    incident: SosIncidentViewModel | null;
}

export function SosIncidentDetail({ incident }: SosIncidentDetailProps) {
    if (!incident) {
        return (
            <Panel className="flex min-h-80 items-center justify-center p-6">
                <div className="max-w-sm text-center">
                    <Siren
                        className="mx-auto h-8 w-8 text-ink-soft"
                        aria-hidden="true"
                    />
                    <h2 className="mt-3 text-base font-semibold text-ink">
                        Select an emergency
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-ink-soft">
                        Review the incident details and the next safe responder
                        action.
                    </p>
                </div>
            </Panel>
        );
    }

    const awaitingAcknowledgement = !incident.acknowledged_at;

    return (
        <div className="min-w-0 space-y-4">
            <Panel className="overflow-hidden">
                <div className="border-b border-danger/20 bg-danger-soft/60 px-4 py-4 md:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-0.5 text-xs font-semibold text-danger-contrast">
                                    <Siren
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                    SOS
                                </span>
                                <StatusBadge status={incident.status.label} />
                                <span className="text-sm font-medium text-danger-strong">
                                    {humanizeSosValue(incident.category.value)}
                                </span>
                            </div>
                            <h2 className="mt-2 text-xl font-semibold text-ink">
                                {incident.worker.name}
                            </h2>
                            <HeaderPlace
                                latitude={incident.location?.latitude}
                                longitude={incident.location?.longitude}
                                place={incident.location?.place}
                                fallback={incident.dispatch?.site ?? null}
                            />
                            <p className="mt-1 text-sm text-ink-soft">
                                Emergency {incident.id.slice(0, 8)} · Received{' '}
                                {formatSosTimestamp(incident.received_at)} ·{' '}
                                <LiveAge value={incident.received_at} />
                            </p>
                        </div>
                        <div className="flex w-full flex-wrap items-start gap-2 sm:w-auto">
                            {incident.worker.phone && (
                                <a
                                    href={`tel:${incident.worker.phone}`}
                                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-subtle sm:flex-none"
                                >
                                    <Phone
                                        className="h-4 w-4 text-danger"
                                        aria-hidden="true"
                                    />
                                    Call {firstName(incident.worker.name)}
                                </a>
                            )}
                            <SosAcknowledgeControl
                                incident={incident}
                                className="flex-1 sm:flex-none"
                            />
                        </div>
                    </div>

                    {awaitingAcknowledgement ? (
                        <AcknowledgementCountdown
                            dueAt={incident.escalation_due_at}
                            escalatedAt={incident.escalated_at}
                        />
                    ) : (
                        incident.acknowledged_by && (
                            <p
                                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success-strong"
                                role="status"
                            >
                                <ShieldCheck
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Owned by {incident.acknowledged_by.name} since{' '}
                                {formatSosTimestamp(incident.acknowledged_at)}
                            </p>
                        )
                    )}
                </div>

                {incident.note && (
                    <div className="border-b border-line px-4 py-3 md:px-5">
                        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                            Worker note
                        </p>
                        <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-ink">
                            {incident.note}
                        </p>
                    </div>
                )}

                <div className="p-4 md:p-5">
                    <SosLocationSummary incident={incident} />
                </div>
            </Panel>

            <Panel className="p-4 md:p-5">
                <h3 className="text-base font-semibold text-ink">
                    Incident details
                </h3>
                <dl className="mt-2 grid gap-x-6 md:grid-cols-2">
                    <DetailPair
                        icon={UserRound}
                        label="Worker"
                        value={
                            incident.worker.phone
                                ? `${incident.worker.name} · ${incident.worker.phone}`
                                : incident.worker.name
                        }
                    />
                    <DetailPair
                        label="Category"
                        value={humanizeSosValue(incident.category.value)}
                    />
                    <DetailPair
                        label="Dispatch context"
                        value={
                            incident.dispatch
                                ? `${incident.dispatch.reference} · ${incident.dispatch.title}`
                                : 'No active dispatch attached'
                        }
                    />
                    <DetailPair
                        label="Asset context"
                        value={
                            incident.asset
                                ? `${incident.asset.code} · ${incident.asset.name}`
                                : 'No asset attached'
                        }
                    />
                    <DetailPair
                        icon={Clock3}
                        label="Acknowledgement deadline"
                        value={formatSosTimestamp(incident.escalation_due_at)}
                    />
                    <DetailPair
                        label="Escalated at"
                        value={formatSosTimestamp(incident.escalated_at)}
                    />
                    <DetailPair
                        label="Responder owner"
                        value={
                            incident.acknowledged_by?.name ??
                            'No responder has acknowledged'
                        }
                    />
                    <DetailPair
                        label="Acknowledged at"
                        value={formatSosTimestamp(incident.acknowledged_at)}
                    />
                </dl>
            </Panel>

            <Panel className="p-4 md:p-5">
                <div>
                    <h3 className="text-base font-semibold text-ink">
                        Delivery evidence
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-ink-soft">
                        These states describe server-recorded attempts. They do
                        not replace acknowledgement.
                    </p>
                </div>
                {incident.delivery_attempts.length > 0 ? (
                    <ul
                        className="mt-4 divide-y divide-line rounded-lg border border-line"
                        aria-label="SOS delivery attempts"
                    >
                        {incident.delivery_attempts.map((attempt, index) => (
                            <li
                                key={`${attempt.channel}-${attempt.target}-${index}`}
                                className="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center"
                            >
                                <span className="font-medium text-ink">
                                    {humanizeSosValue(attempt.channel)}
                                </span>
                                <span className="text-ink-soft">
                                    {humanizeSosValue(attempt.target)}
                                </span>
                                <StatusBadge
                                    status={humanizeSosValue(attempt.status)}
                                />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p
                        className="mt-4 rounded-lg bg-warning-soft p-3 text-sm text-warning-strong"
                        role="status"
                    >
                        No delivery attempt details are available in this
                        snapshot.
                    </p>
                )}
            </Panel>

            <Panel className="p-4 md:p-5">
                <SosResolutionForm incident={incident} />
            </Panel>
        </div>
    );
}

function HeaderPlace({
    latitude,
    longitude,
    place: serverPlace,
    fallback,
}: {
    latitude: number | null | undefined;
    longitude: number | null | undefined;
    place?: PlaceViewModel | null;
    fallback: string | null;
}) {
    const place = useSosPlaceName(latitude, longitude, serverPlace);
    const text =
        place.status === 'ready'
            ? [
                  place.primary,
                  place.secondary?.split(', ').slice(0, 3).join(', '),
              ]
                  .filter(Boolean)
                  .join(' · ')
            : place.status === 'loading'
              ? 'Finding address…'
              : place.status === 'none'
                ? fallback
                    ? `No GPS fix · job site: ${fallback}`
                    : 'No GPS fix'
                : null;

    if (!text) {
        return null;
    }

    return (
        <p className="mt-1 inline-flex items-start gap-1.5 text-sm font-medium text-ink">
            <MapPin
                className="mt-0.5 h-4 w-4 shrink-0 text-danger"
                aria-hidden="true"
            />
            <span>{text}</span>
        </p>
    );
}

function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] || 'worker';
}

function useNow(intervalMs = 1000): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), intervalMs);

        return () => clearInterval(timer);
    }, [intervalMs]);

    return now;
}

function LiveAge({ value }: { value: string }) {
    const now = useNow();

    return <span>{formatSosAge(value, now)}</span>;
}

function formatClock(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function AcknowledgementCountdown({
    dueAt,
    escalatedAt,
}: {
    dueAt: string | null;
    escalatedAt: string | null;
}) {
    const now = useNow();
    const due = dueAt ? new Date(dueAt).getTime() : Number.NaN;

    if (Number.isNaN(due)) {
        return null;
    }

    const remaining = Math.round((due - now) / 1000);
    const overdue = remaining <= 0;

    return (
        <p
            className={cn(
                'mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold tabular-nums',
                overdue
                    ? 'bg-danger text-danger-contrast'
                    : remaining <= 60
                      ? 'bg-warning-soft text-warning-strong'
                      : 'bg-surface text-ink ring-1 ring-line',
            )}
            role="timer"
            aria-live="off"
        >
            <AlarmClock className="h-4 w-4" aria-hidden="true" />
            {overdue
                ? escalatedAt
                    ? `Escalated · unacknowledged for ${formatClock(-remaining)} past deadline`
                    : `Acknowledgement overdue by ${formatClock(-remaining)}`
                : `Acknowledge within ${formatClock(remaining)}`}
        </p>
    );
}

function DetailPair({
    icon: Icon,
    label,
    value,
}: {
    icon?: typeof UserRound;
    label: string;
    value: string;
}) {
    return (
        <div className="grid grid-cols-[minmax(8rem,0.75fr)_minmax(0,1.25fr)] gap-3 border-b border-line py-2 text-sm">
            <dt className="inline-flex items-center gap-1.5 text-ink-soft">
                {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                {label}
            </dt>
            <dd className="min-w-0 font-medium break-words text-ink">
                {value}
            </dd>
        </div>
    );
}
