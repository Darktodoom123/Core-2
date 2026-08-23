import { CalendarDays, MapPin } from 'lucide-react';
import React from 'react';
import { DataPair, Panel } from '@/components/ui';
import { formatDateTime, humanize } from '@/lib/formatters';
import type { DispatchDetailPageProps } from '@/types/workspace';

export function DispatchContext({
    job,
}: {
    job: DispatchDetailPageProps['job'];
}) {
    return (
        <Panel id="dispatch-context" className="p-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-line pb-3">
                <h2 className="font-semibold text-ink">Dispatch context</h2>
                <span className="text-xs text-ink-soft">
                    Last updated: {formatDateTime(job.updated_at)}
                </span>
            </div>
            <dl className="mt-3 divide-y divide-line">
                <DataPair
                    label="Source"
                    value={
                        job.source
                            ? `${job.source.label}${job.source.reference ? ` · ${job.source.reference}` : ''}`
                            : 'Direct dispatch'
                    }
                />
                {job.source?.fulfillment_mode && (
                    <DataPair
                        label="Fulfillment"
                        value={humanize(job.source.fulfillment_mode)}
                    />
                )}
                <DataPair
                    label="Schedule"
                    value={
                        <span className="inline-flex items-start gap-2">
                            <CalendarDays
                                className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                                aria-hidden="true"
                            />
                            <span className="font-medium text-ink">
                                {formatDateTime(job.scheduled_start)} –{' '}
                                {formatDateTime(job.scheduled_end)}
                            </span>
                        </span>
                    }
                />
                <DataPair
                    label="Site"
                    value={
                        <span className="inline-flex items-start gap-2">
                            <MapPin
                                className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                                aria-hidden="true"
                            />
                            <span className="font-medium text-ink">
                                {job.site}
                            </span>
                        </span>
                    }
                />
            </dl>
            <div className="mt-4 rounded-lg border border-line bg-surface-subtle/80 p-3">
                <p className="text-xs font-semibold text-ink">Site note</p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                    {job.site_notes?.trim() ||
                        'No additional site instructions were recorded.'}
                </p>
            </div>
        </Panel>
    );
}
