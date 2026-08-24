import { AlertTriangle, ArrowRight, Radio, Siren } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import type { SosIncidentViewModel } from '@/types/workspace';
import { formatSosAge, humanizeSosValue } from './sos-helpers';

interface ActiveSosBannerProps {
    incidents: SosIncidentViewModel[];
    onOpenQueue: () => void;
}

export function ActiveSosBanner({
    incidents,
    onOpenQueue,
}: ActiveSosBannerProps) {
    const [now, setNow] = useState(() => Date.now());
    const [announcement, setAnnouncement] = useState('');
    const incidentSignature = useMemo(
        () =>
            incidents
                .map((incident) => `${incident.id}:${incident.status.value}`)
                .join('|'),
        [incidents],
    );
    const previousSignatureRef = useRef<string | null>(null);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 15_000);

        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        let announcementTimer: number | undefined;

        if (!incidentSignature) {
            announcementTimer = window.setTimeout(() => setAnnouncement(''), 0);
            previousSignatureRef.current = null;

            return () => {
                if (announcementTimer !== undefined) {
                    window.clearTimeout(announcementTimer);
                }
            };
        }

        const count = incidents.length;
        const escalated = incidents.filter(
            (incident) => incident.status.value === 'escalated',
        ).length;
        const nextAnnouncement = `${count} active emergency ${count === 1 ? 'incident' : 'incidents'} in the response queue.${escalated > 0 ? ` ${escalated} escalated.` : ''}`;

        if (previousSignatureRef.current !== incidentSignature) {
            announcementTimer = window.setTimeout(
                () => setAnnouncement(nextAnnouncement),
                0,
            );
        }

        previousSignatureRef.current = incidentSignature;

        return () => {
            if (announcementTimer !== undefined) {
                window.clearTimeout(announcementTimer);
            }
        };
    }, [incidentSignature, incidents]);

    if (incidents.length === 0) {
        return null;
    }

    const oldest = [...incidents].sort(
        (left, right) =>
            new Date(left.received_at).getTime() -
            new Date(right.received_at).getTime(),
    )[0];
    const escalatedCount = incidents.filter(
        (incident) => incident.status.value === 'escalated',
    ).length;

    return (
        <>
            <div
                className="sr-only"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
            >
                {announcement}
            </div>
            <section
                className="border-b border-danger-strong/30 bg-danger-soft px-4 py-3 md:px-6"
                aria-labelledby="active-sos-heading"
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger text-danger-contrast">
                            <Siren className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <h2
                                id="active-sos-heading"
                                className="font-semibold text-danger-strong"
                            >
                                Active emergency response
                            </h2>
                            <p className="mt-0.5 text-sm leading-5 text-danger-strong/90">
                                {incidents.length} unresolved{' '}
                                {incidents.length === 1
                                    ? 'incident'
                                    : 'incidents'}{' '}
                                · oldest {formatSosAge(oldest.received_at, now)}
                                {escalatedCount > 0 &&
                                    ` · ${escalatedCount} escalated`}
                            </p>
                            <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-danger-strong">
                                <Radio
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                />
                                Server state is authoritative. Open the queue to
                                respond.
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={onOpenQueue}
                        className="w-full shrink-0 sm:w-auto"
                    >
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        Open emergency queue
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>
                <p className="sr-only">
                    Categories present:{' '}
                    {incidents
                        .map((incident) =>
                            humanizeSosValue(incident.category.value),
                        )
                        .join(', ')}
                    .
                </p>
            </section>
        </>
    );
}
