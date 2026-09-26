import {
    ArrowRight,
    ClipboardCheck,
    Hourglass,
    Info,
    Truck,
} from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { FleetSummary } from './manager-dashboard-model';
import {
    FLEET_BUCKET_LABELS,
    FLEET_BUCKET_ORDER,
} from './manager-dashboard-model';
import { FLEET_BUCKET_TONES } from './manager-metric-strip';
import { LegendSwatch, SegmentBar } from './manager-ui';

export function FleetBreakdownPanel({
    fleet,
    canOpenAssets,
    onOpenAssets,
}: {
    fleet: FleetSummary;
    canOpenAssets: boolean;
    onOpenAssets: () => void;
}) {
    const legendBuckets = FLEET_BUCKET_ORDER.filter(
        (bucket) => bucket !== 'not_cleared' || fleet.counts[bucket] > 0,
    );

    return (
        <section
            aria-labelledby="manager-readiness-heading"
            className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface"
        >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
                <h2
                    id="manager-readiness-heading"
                    className="text-lg font-semibold tracking-tight text-ink"
                >
                    Governance &amp; Fleet Breakdown
                </h2>
                {canOpenAssets && (
                    // Buttons take their font from the parent (app.css resets `button { font: inherit }`).
                    <div className="shrink-0 text-xs font-semibold">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onOpenAssets}
                            aria-label="View fleet in Fleet & Equipment"
                        >
                            View fleet
                            <ArrowRight
                                className="size-3.5"
                                aria-hidden="true"
                            />
                        </Button>
                    </div>
                )}
            </header>

            {fleet.loaded === 0 ? (
                <EmptyState
                    compact
                    icon={Truck}
                    title="No fleet units visible"
                    message="Units appear here when your role can view fleet assets."
                />
            ) : (
                <>
                    <div className="border-b border-line px-4 py-4 sm:px-5">
                        <p className="flex items-baseline gap-2 tabular-nums">
                            <span className="text-3xl leading-none font-semibold tracking-tight text-ink">
                                {fleet.total}
                            </span>
                            <span className="text-sm text-ink-soft">
                                units in fleet
                            </span>
                            {fleet.readinessPercent !== null && (
                                <span
                                    className={cn(
                                        'ml-auto text-sm font-semibold',
                                        fleet.readinessPercent >= 80
                                            ? 'text-success-strong'
                                            : 'text-warning-strong',
                                    )}
                                >
                                    {fleet.readinessPercent}% in service
                                </span>
                            )}
                        </p>
                        <SegmentBar
                            className="mt-3 h-2.5"
                            segments={FLEET_BUCKET_ORDER.map((bucket) => ({
                                key: bucket,
                                count: fleet.counts[bucket],
                                tone: FLEET_BUCKET_TONES[bucket],
                            }))}
                        />
                        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm min-[420px]:grid-cols-2">
                            {legendBuckets.map((bucket) => (
                                <div
                                    key={bucket}
                                    className="flex items-center gap-2"
                                >
                                    <LegendSwatch
                                        tone={FLEET_BUCKET_TONES[bucket]}
                                    />
                                    <dt className="text-ink-soft">
                                        {FLEET_BUCKET_LABELS[bucket]}
                                    </dt>
                                    <dd className="ml-auto font-semibold text-ink tabular-nums">
                                        {fleet.counts[bucket]}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        {fleet.partial && (
                            <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-soft">
                                <Info
                                    className="mt-px size-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                Breakdown covers the first {fleet.loaded} of{' '}
                                {fleet.total} units. Open Fleet &amp; Equipment
                                for the full register.
                            </p>
                        )}
                    </div>

                    <table className="w-full text-sm">
                        <caption className="sr-only">
                            Units in service by equipment category
                        </caption>
                        <thead>
                            <tr className="border-b border-line text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                                <th
                                    scope="col"
                                    className="px-4 py-2 text-left font-semibold sm:px-5"
                                >
                                    Category
                                </th>
                                <th
                                    scope="col"
                                    className="px-2 py-2 text-right font-semibold"
                                >
                                    In service
                                </th>
                                <th
                                    scope="col"
                                    className="w-28 px-4 py-2 sm:pr-5"
                                >
                                    <span className="sr-only">Share</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {fleet.categories.map((category) => {
                                const share =
                                    category.total > 0
                                        ? (category.inService /
                                              category.total) *
                                          100
                                        : 0;

                                return (
                                    <tr key={category.value}>
                                        <th
                                            scope="row"
                                            className="px-4 py-2.5 text-left font-semibold text-ink sm:px-5"
                                        >
                                            {category.label}
                                        </th>
                                        <td className="px-2 py-2.5 text-right text-ink-soft tabular-nums">
                                            <span className="font-semibold text-ink">
                                                {category.inService}
                                            </span>{' '}
                                            / {category.total}
                                        </td>
                                        <td className="px-4 py-2.5 sm:pr-5">
                                            <span
                                                className="block h-1.5 overflow-hidden rounded-full bg-surface-subtle"
                                                aria-hidden="true"
                                            >
                                                <span
                                                    className={cn(
                                                        'block h-full rounded-full',
                                                        share >= 75
                                                            ? 'bg-success'
                                                            : 'bg-warning',
                                                    )}
                                                    style={{
                                                        width: `${share}%`,
                                                    }}
                                                />
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <dl className="border-t border-line py-1.5 text-sm">
                        <div className="flex items-center gap-2.5 px-4 py-2 sm:px-5">
                            <ClipboardCheck
                                className="size-4 shrink-0 text-success-strong"
                                aria-hidden="true"
                            />
                            <dt className="text-ink-soft">
                                Units with a DVIR completed today
                            </dt>
                            <dd className="ml-auto font-semibold text-ink tabular-nums">
                                {fleet.dvirsToday}
                            </dd>
                        </div>
                        <div className="flex items-center gap-2.5 px-4 py-2 sm:px-5">
                            <Hourglass
                                className={cn(
                                    'size-4 shrink-0',
                                    fleet.hosWarnings > 0
                                        ? 'text-warning-strong'
                                        : 'text-ink-soft',
                                )}
                                aria-hidden="true"
                            />
                            <dt className="text-ink-soft">
                                Operators past the 9 h HoS warning
                            </dt>
                            <dd
                                className={cn(
                                    'ml-auto font-semibold tabular-nums',
                                    fleet.hosWarnings > 0
                                        ? 'text-warning-strong'
                                        : 'text-ink',
                                )}
                            >
                                {fleet.hosWarnings}
                            </dd>
                        </div>
                    </dl>
                </>
            )}
        </section>
    );
}
