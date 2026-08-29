import { RefreshCw, ShieldCheck, Siren } from 'lucide-react';
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

export function SosResponseQueue({
    incidents,
    refreshing = false,
    onRefresh,
}: SosResponseQueueProps) {
    const [selectedId, setSelectedId] = useState<string | null>(
        incidents[0]?.id ?? null,
    );

    const effectiveSelectedId =
        selectedId && incidents.some((incident) => incident.id === selectedId)
            ? selectedId
            : (incidents[0]?.id ?? null);
    const selectedIncident =
        incidents.find((incident) => incident.id === effectiveSelectedId) ??
        null;

    return (
        <section
            className="space-y-4 p-4 md:p-6"
            aria-label="Safety and emergency response queue"
        >
            <PageHeading
                title="Emergency Response Queue"
                description="Triage, acknowledge, and resolve active field emergencies. Server state remains authoritative."
                actions={
                    <div className="flex items-center gap-2">
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
                <Panel className="flex flex-col items-center justify-center bg-surface p-12 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-success-soft text-success ring-1 ring-success/20">
                        <ShieldCheck className="h-8 w-8" aria-hidden="true" />
                    </div>
                    <h2 className="text-base font-semibold text-ink">
                        All Systems Normal · Zero Active Emergencies
                    </h2>
                    <p className="mt-1.5 max-w-md text-xs leading-relaxed text-ink-soft">
                        Real-time monitoring is active across all Alibaton
                        cranes and field operations. When an operator triggers
                        an emergency in the field, it will appear here
                        immediately.
                    </p>
                    <div className="mt-6 flex items-center gap-3">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                window.location.href = '/';
                            }}
                        >
                            Return to Operations Overview
                        </Button>
                    </div>
                </Panel>
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
        </section>
    );
}
