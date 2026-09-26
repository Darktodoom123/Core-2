import {
    ArrowUpRight,
    BadgeCheck,
    CalendarClock,
    Fuel,
    Hourglass,
    Lock,
    ShieldAlert,
    Siren,
    Timer,
    Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { LiveCountdown } from './live-time';
import type {
    AuthorizationSummary,
    FleetSummary,
    QueueCategory,
    SafetySummary,
    ScheduleSummary,
} from './manager-dashboard-model';
import {
    FLEET_BUCKET_LABELS,
    FLEET_BUCKET_ORDER,
    SCHEDULE_STATE_LABELS,
    SCHEDULE_STATE_ORDER,
    formatElapsed,
    timestampOf,
} from './manager-dashboard-model';
import type { Segment, SwatchTone } from './manager-ui';
import { SegmentBar } from './manager-ui';
import type { TodayDispatchesStatus } from './use-today-dispatches';

export const SCHEDULE_STATE_TONES = {
    in_progress: 'success',
    scheduled: 'info',
    awaiting_approval: 'warning',
    needs_resources: 'warning-hatched',
} satisfies Record<string, SwatchTone>;

export const FLEET_BUCKET_TONES = {
    available: 'success',
    on_job: 'info',
    maintenance: 'warning',
    blocked: 'danger',
    not_cleared: 'neutral',
} satisfies Record<string, SwatchTone>;

export function ManagerMetricStrip({
    schedule,
    scheduleStatus,
    fleet,
    authorizations,
    safety,
    now,
    canOpenDispatch,
    canOpenAssets,
    onOpenSection,
    onFilterQueue,
}: {
    schedule: ScheduleSummary;
    scheduleStatus: TodayDispatchesStatus;
    fleet: FleetSummary;
    authorizations: AuthorizationSummary;
    safety: SafetySummary;
    now: number;
    canOpenDispatch: boolean;
    canOpenAssets: boolean;
    onOpenSection: (section: 'dispatch' | 'assets') => void;
    onFilterQueue: (category: QueueCategory) => void;
}) {
    const scheduleSegments: Segment[] = SCHEDULE_STATE_ORDER.map((state) => ({
        key: state,
        count: schedule.counts[state],
        tone: SCHEDULE_STATE_TONES[state],
    }));
    const fleetSegments: Segment[] = FLEET_BUCKET_ORDER.map((bucket) => ({
        key: bucket,
        count: fleet.counts[bucket],
        tone: FLEET_BUCKET_TONES[bucket],
    }));
    const oldestWaiting = formatElapsed(authorizations.oldestWaitingSince, now);
    const escalationAt = timestampOf(safety.nextEscalationAt);

    return (
        <section
            aria-label="Today at a glance"
            className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-4"
        >
            <MetricCell
                label="Today's Dispatches"
                icon={CalendarClock}
                openLabel={canOpenDispatch ? 'Open dispatch workspace' : null}
                onOpen={() => onOpenSection('dispatch')}
            >
                {scheduleStatus === 'loading' ? (
                    <MetricLoading label="Loading today's schedule" />
                ) : scheduleStatus === 'ready' ? (
                    <>
                        <MetricValue
                            value={String(schedule.total)}
                            suffix="on today's schedule"
                        />
                        <SegmentBar segments={scheduleSegments} />
                        <MetricLegend
                            items={SCHEDULE_STATE_ORDER.map((state) => ({
                                key: state,
                                count: schedule.counts[state],
                                label: SCHEDULE_STATE_LABELS[
                                    state
                                ].toLowerCase(),
                            }))}
                        />
                    </>
                ) : (
                    <>
                        <MetricValue value="—" suffix="schedule unavailable" />
                        <p className="text-xs text-ink-soft">
                            {scheduleStatus === 'forbidden'
                                ? 'Your role cannot view the dispatch schedule.'
                                : "Today's schedule could not be loaded."}
                        </p>
                    </>
                )}
            </MetricCell>

            <MetricCell
                label="Fleet Readiness"
                icon={Truck}
                openLabel={canOpenAssets ? 'Open Fleet & Equipment' : null}
                onOpen={() => onOpenSection('assets')}
            >
                <MetricValue
                    value={
                        fleet.readinessPercent === null
                            ? '—'
                            : `${fleet.readinessPercent}%`
                    }
                    suffix={
                        fleet.loaded === 0
                            ? 'no units visible'
                            : `${fleet.inService} of ${fleet.loaded} units in service`
                    }
                />
                <SegmentBar segments={fleetSegments} />
                <MetricLegend
                    items={FLEET_BUCKET_ORDER.filter(
                        (bucket) =>
                            bucket !== 'not_cleared' ||
                            fleet.counts[bucket] > 0,
                    ).map((bucket) => ({
                        key: bucket,
                        count: fleet.counts[bucket],
                        label: FLEET_BUCKET_LABELS[bucket].toLowerCase(),
                    }))}
                />
            </MetricCell>

            <MetricCell label="Field Authorizations" icon={BadgeCheck}>
                <MetricValue
                    value={String(authorizations.total)}
                    suffix={
                        authorizations.total === 0
                            ? 'nothing waiting for you'
                            : 'waiting for you'
                    }
                />
                {authorizations.total > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {authorizations.approvals > 0 && (
                            <QueueChip
                                tone="warning"
                                icon={BadgeCheck}
                                label={`${authorizations.approvals} ${authorizations.approvals === 1 ? 'approval' : 'approvals'}`}
                                onClick={() => onFilterQueue('approvals')}
                            />
                        )}
                        {authorizations.fuelRequests > 0 && (
                            <QueueChip
                                tone="info"
                                icon={Fuel}
                                label={`${authorizations.fuelRequests} fuel ${authorizations.fuelRequests === 1 ? 'request' : 'requests'}`}
                                onClick={() => onFilterQueue('fuel')}
                            />
                        )}
                    </div>
                )}
                <MetricNote icon={Hourglass}>
                    {oldestWaiting
                        ? `Oldest waiting ${oldestWaiting}`
                        : 'All field requests clear'}
                </MetricNote>
            </MetricCell>

            <MetricCell
                label="Safety & Grounded Units"
                icon={ShieldAlert}
                tone={
                    safety.openSos > 0
                        ? 'danger'
                        : safety.blockedUnits > 0
                          ? 'warning'
                          : 'default'
                }
            >
                <MetricValue
                    value={String(safety.total)}
                    suffix={
                        safety.total === 0 ? 'all clear' : 'need action now'
                    }
                    tone={
                        safety.openSos > 0
                            ? 'danger'
                            : safety.blockedUnits > 0
                              ? 'warning'
                              : 'default'
                    }
                />
                {safety.total > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {safety.openSos > 0 && (
                            <QueueChip
                                tone="danger"
                                icon={Siren}
                                label={`${safety.openSos} SOS open`}
                                onClick={() => onFilterQueue('emergency')}
                            />
                        )}
                        {safety.blockedUnits > 0 && (
                            <QueueChip
                                tone="danger"
                                icon={Lock}
                                label={`${safety.blockedUnits} blocked ${safety.blockedUnits === 1 ? 'unit' : 'units'}`}
                                onClick={() => onFilterQueue('safety')}
                            />
                        )}
                    </div>
                )}
                {escalationAt !== null && escalationAt > now ? (
                    <MetricNote icon={Timer} tone="danger">
                        SOS escalates to emergency contacts in{' '}
                        <LiveCountdown
                            target={escalationAt}
                            expiredLabel="moments"
                        />
                    </MetricNote>
                ) : safety.escalatedCount > 0 ? (
                    <MetricNote icon={Timer} tone="danger">
                        {safety.escalatedCount} escalated to emergency contacts
                    </MetricNote>
                ) : safety.unacknowledged > 0 ? (
                    <MetricNote icon={ShieldAlert} tone="danger">
                        {safety.unacknowledged} awaiting acknowledgement
                    </MetricNote>
                ) : (
                    <MetricNote icon={ShieldAlert}>
                        {safety.openSos === 0
                            ? 'No open emergencies'
                            : 'Acknowledged · awaiting resolution'}
                    </MetricNote>
                )}
            </MetricCell>
        </section>
    );
}

function MetricCell({
    label,
    icon: Icon,
    tone = 'default',
    openLabel = null,
    onOpen,
    children,
}: {
    label: string;
    icon: LucideIcon;
    tone?: 'default' | 'warning' | 'danger';
    openLabel?: string | null;
    onOpen?: () => void;
    children: ReactNode;
}) {
    return (
        <div
            className={cn(
                'group relative flex min-w-0 flex-col gap-2.5 bg-surface p-4 sm:px-5',
                tone === 'danger' &&
                    'shadow-[inset_0_3px_0_var(--color-danger)]',
                tone === 'warning' &&
                    'shadow-[inset_0_3px_0_var(--color-warning)]',
                openLabel && 'transition-colors hover:bg-surface-subtle/60',
            )}
        >
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
                <Icon className="size-4 text-muted" aria-hidden="true" />
                {openLabel && onOpen ? (
                    <button
                        type="button"
                        onClick={onOpen}
                        aria-label={openLabel}
                        title={openLabel}
                        className="flex flex-1 items-center justify-between text-left rounded-md text-muted transition-colors group-hover:text-ink after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                    >
                        <span className="text-xs font-medium text-ink-soft">{label}</span>
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                    </button>
                ) : (
                    <p className="text-xs font-medium">{label}</p>
                )}
            </div>
            {children}
        </div>
    );
}

function MetricValue({
    value,
    suffix,
    tone = 'default',
}: {
    value: string;
    suffix: string;
    tone?: 'default' | 'warning' | 'danger';
}) {
    return (
        <p className="flex items-baseline gap-2 tabular-nums">
            <span
                className={cn(
                    'text-3xl leading-none font-semibold tracking-tight',
                    tone === 'danger'
                        ? 'text-danger-strong'
                        : tone === 'warning'
                          ? 'text-warning-strong'
                          : 'text-ink',
                )}
            >
                {value}
            </span>
            <span className="min-w-0 truncate text-sm text-ink-soft">
                {suffix}
            </span>
        </p>
    );
}

function MetricLegend({
    items,
}: {
    items: Array<{ key: string; count: number; label: string }>;
}) {
    return (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft tabular-nums">
            {items.map((item) => (
                <li
                    key={item.key}
                    className={item.count === 0 ? 'opacity-70' : undefined}
                >
                    <span className="mr-1 font-semibold text-ink">
                        {item.count}
                    </span>
                    {item.label}
                </li>
            ))}
        </ul>
    );
}

function MetricNote({
    icon: Icon,
    tone = 'default',
    children,
}: {
    icon: LucideIcon;
    tone?: 'default' | 'danger';
    children: ReactNode;
}) {
    return (
        <p
            className={cn(
                'flex items-center gap-1.5 text-xs tabular-nums',
                tone === 'danger'
                    ? 'font-semibold text-danger-strong'
                    : 'text-ink-soft',
            )}
        >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{children}</span>
        </p>
    );
}

function QueueChip({
    tone,
    icon: Icon,
    label,
    onClick,
}: {
    tone: 'warning' | 'info' | 'danger';
    icon: LucideIcon;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={`Show ${label} in the action queue`}
            className={cn(
                'inline-flex min-h-7 items-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
                tone === 'warning' &&
                    'border-warning/30 bg-warning-soft text-warning-strong hover:border-warning/60',
                tone === 'info' &&
                    'border-info/30 bg-info-soft text-info-strong hover:border-info/60',
                tone === 'danger' &&
                    'border-danger/35 bg-danger-soft text-danger-strong hover:border-danger/60',
            )}
        >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
        </button>
    );
}

function MetricLoading({ label }: { label: string }) {
    return (
        <div role="status" aria-label={label} className="space-y-2.5">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-3 w-3/4" />
        </div>
    );
}
