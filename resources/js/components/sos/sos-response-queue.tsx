import { Inbox, RefreshCw, Siren } from 'lucide-react';
import { useState } from 'react';
import {
    Button,
    EmptyState,
    PageHeading,
    Panel,
    StatusBadge,
} from '@/components/ui';
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
            aria-label="Emergency response queue"
        >
            <PageHeading
                title="Emergency response queue"
                description="Acknowledge ownership, coordinate a safe response, and close each SOS with an audited outcome. Server state remains authoritative."
                actions={
                    onRefresh && (
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
                    )
                }
            />
            {incidents.length === 0 ? (
                <Panel>
                    <EmptyState
                        announce
                        icon={Inbox}
                        title="No active emergencies"
                        message="New server-accepted SOS incidents will appear here. Keep this workspace open for realtime or polling updates."
                    />
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
