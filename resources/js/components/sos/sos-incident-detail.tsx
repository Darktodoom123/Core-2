import { Clock3, Phone, ShieldCheck, Siren, UserRound } from 'lucide-react';
import { Panel, StatusBadge } from '@/components/ui';
import type { SosIncidentViewModel } from '@/types/workspace';
import { SosAcknowledgeControl } from './sos-acknowledge-control';
import {
    formatSosAge,
    formatSosTimestamp,
    humanizeSosValue,
} from './sos-helpers';
import { SosLocationSummary } from './sos-location-summary';
import { SosResolutionForm } from './sos-resolution-form';

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

    return (
        <div className="space-y-4">
            <Panel className="overflow-hidden">
                <div className="border-b border-line bg-danger-soft/60 px-4 py-4 md:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-semibold text-ink">
                                    Emergency {incident.id.slice(0, 8)}
                                </h2>
                                <StatusBadge status={incident.status.label} />
                            </div>
                            <p className="mt-1 text-sm text-ink-soft">
                                Received{' '}
                                {formatSosTimestamp(incident.received_at)} ·{' '}
                                {formatSosAge(incident.received_at)}
                            </p>
                        </div>
                        {incident.worker.phone && (
                            <a
                                href={`tel:${incident.worker.phone}`}
                                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-subtle"
                            >
                                <Phone
                                    className="h-4 w-4 text-brand-strong"
                                    aria-hidden="true"
                                />
                                Call worker
                            </a>
                        )}
                    </div>
                </div>

                <div className="space-y-5 p-4 md:p-5">
                    <dl className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                        <DetailPair
                            icon={UserRound}
                            label="Worker"
                            value={incident.worker.name}
                        />
                        <DetailPair
                            label="Category"
                            value={humanizeSosValue(incident.category.value)}
                        />
                        <DetailPair
                            icon={Clock3}
                            label="Acknowledgement deadline"
                            value={formatSosTimestamp(
                                incident.escalation_due_at,
                            )}
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
                    </dl>

                    {incident.note && (
                        <div className="rounded-lg border border-line bg-surface-subtle p-3 text-sm">
                            <p className="font-semibold text-ink">
                                Worker note
                            </p>
                            <p className="mt-1 leading-5 whitespace-pre-wrap text-ink-soft">
                                {incident.note}
                            </p>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                        <SosAcknowledgeControl incident={incident} />
                        {incident.acknowledged_by && (
                            <p
                                className="inline-flex items-center gap-1.5 text-sm text-success-strong"
                                role="status"
                            >
                                <ShieldCheck
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Owned by {incident.acknowledged_by.name}
                            </p>
                        )}
                    </div>
                </div>
            </Panel>

            <Panel className="p-4 md:p-5">
                <SosLocationSummary incident={incident} />
            </Panel>

            <Panel className="p-4 md:p-5">
                <div>
                    <h2 className="text-base font-semibold text-ink">
                        Delivery evidence
                    </h2>
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
