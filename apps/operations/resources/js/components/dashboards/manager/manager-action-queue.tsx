import { Link } from '@inertiajs/react';
import {
    BadgeCheck,
    ChevronDown,
    CircleCheck,
    Fuel,
    Lock,
    Siren,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Ref } from 'react';
import { SosAcknowledgeControl } from '@/components/sos/sos-acknowledge-control';
import { Button, EmptyState, buttonVariants } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { WorkspaceSection } from '@/types/workspace';
import { LiveCountdown, LiveElapsed, LiveProgress } from './live-time';
import type {
    ManagerQueueItem,
    QueueCategory,
    QueueFilter,
} from './manager-dashboard-model';
import {
    QUEUE_CATEGORY_LABELS,
    QUEUE_CATEGORY_ORDER,
    countQueueCategories,
    dispatchDetailHref,
    formatElapsed,
    timestampOf,
    visibleQueueItems,
} from './manager-dashboard-model';
import { FilterButton, FilterGroup } from './manager-ui';

const QUEUE_LIST_ID = 'manager-queue-items';
const LONG_WAIT_MS = 60 * 60_000;

const TAGS: Record<
    ManagerQueueItem['kind'],
    { label: string; icon: LucideIcon; className: string }
> = {
    sos: {
        label: 'Emergency SOS',
        icon: Siren,
        className: 'border-danger bg-danger text-danger-contrast',
    },
    blocked_asset: {
        label: 'Blocked unit',
        icon: Lock,
        className: 'border-danger/35 bg-danger-soft text-danger-strong',
    },
    approval: {
        label: 'Approval',
        icon: BadgeCheck,
        className: 'border-warning/35 bg-warning-soft text-warning-strong',
    },
    fuel_request: {
        label: 'Fuel request',
        icon: Fuel,
        className: 'border-info/30 bg-info-soft text-info-strong',
    },
    fuel_anomalies: {
        label: 'Fuel anomaly',
        icon: Fuel,
        className: 'border-warning/35 bg-warning-soft text-warning-strong',
    },
};

export interface ManagerActionQueueProps {
    items: ManagerQueueItem[];
    filter: QueueFilter;
    expanded: boolean;
    now: number;
    headingRef?: Ref<HTMLHeadingElement>;
    availableSections: WorkspaceSection[];
    onFilterChange: (filter: QueueFilter) => void;
    onExpandedChange: (expanded: boolean) => void;
    onSectionChange: (section: WorkspaceSection) => void;
}

export function ManagerActionQueue({
    items,
    filter,
    expanded,
    now,
    headingRef,
    availableSections,
    onFilterChange,
    onExpandedChange,
    onSectionChange,
}: ManagerActionQueueProps) {
    const counts = countQueueCategories(items);
    const visible = visibleQueueItems(items, filter, expanded);
    const actNow = visible.items.filter((item) => item.group === 'act_now');
    const decisions = visible.items.filter((item) => item.group === 'decision');
    const hiddenCount = visible.total - visible.items.length;

    return (
        <section
            aria-labelledby="manager-queue-heading"
            className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface"
        >
            <header className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <h2
                        id="manager-queue-heading"
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-lg font-semibold tracking-tight text-ink focus-visible:outline-hidden"
                    >
                        Manager action &amp; exception queue
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-soft">
                        {items.length === 0
                            ? 'Emergencies, safety blockers, approvals, and fuel requests appear here.'
                            : `${items.length} ${items.length === 1 ? 'item' : 'items'} · emergencies first, then safety blockers, approvals, and fuel`}
                    </p>
                </div>
                {items.length > 0 && (
                    <FilterGroup label="Filter action queue">
                        <FilterButton
                            label="All"
                            count={items.length}
                            pressed={filter === 'all'}
                            onClick={() => onFilterChange('all')}
                        />
                        {QUEUE_CATEGORY_ORDER.map((category) => (
                            <FilterButton
                                key={category}
                                label={QUEUE_CATEGORY_LABELS[category]}
                                count={counts[category]}
                                pressed={filter === category}
                                emphasis={
                                    category === 'emergency'
                                        ? 'danger'
                                        : 'neutral'
                                }
                                onClick={() => onFilterChange(category)}
                            />
                        ))}
                    </FilterGroup>
                )}
            </header>

            {items.length === 0 ? (
                <EmptyState
                    compact
                    icon={CircleCheck}
                    title="Nothing needs your decision"
                    message="New emergencies, safety blockers, approvals, and fuel requests will appear here as soon as they are reported."
                />
            ) : visible.total === 0 ? (
                <EmptyState
                    compact
                    icon={CircleCheck}
                    title={`No ${QUEUE_CATEGORY_LABELS[filter as QueueCategory].toLowerCase()} items`}
                    message="Other categories still have items waiting."
                    primaryAction={
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onFilterChange('all')}
                        >
                            Show all items
                        </Button>
                    }
                />
            ) : (
                <div id={QUEUE_LIST_ID}>
                    {actNow.length > 0 && (
                        <QueueGroup
                            id="manager-queue-act-now"
                            title="Act now"
                            items={actNow}
                            startRank={1}
                            now={now}
                            availableSections={availableSections}
                            onSectionChange={onSectionChange}
                        />
                    )}
                    {decisions.length > 0 && (
                        <QueueGroup
                            id="manager-queue-decisions"
                            title="Awaiting your decision"
                            items={decisions}
                            startRank={actNow.length + 1}
                            now={now}
                            availableSections={availableSections}
                            onSectionChange={onSectionChange}
                        />
                    )}
                </div>
            )}

            {visible.total > 0 && (hiddenCount > 0 || expanded) && (
                <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-sm text-ink-soft sm:px-5">
                    <span className="tabular-nums">
                        Showing {visible.items.length} of {visible.total} ·
                        sorted by urgency, then waiting time
                    </span>
                    <Button
                        variant="quiet"
                        size="sm"
                        aria-expanded={expanded}
                        aria-controls={QUEUE_LIST_ID}
                        onClick={() => onExpandedChange(!expanded)}
                        className="font-semibold text-ink"
                    >
                        {expanded
                            ? 'Show fewer'
                            : `Show all ${visible.total} items`}
                        <ChevronDown
                            className={cn(
                                'size-4 transition-transform duration-150',
                                expanded && 'rotate-180',
                            )}
                            aria-hidden="true"
                        />
                    </Button>
                </footer>
            )}
        </section>
    );
}

function QueueGroup({
    id,
    title,
    items,
    startRank,
    now,
    availableSections,
    onSectionChange,
}: {
    id: string;
    title: string;
    items: ManagerQueueItem[];
    startRank: number;
    now: number;
    availableSections: WorkspaceSection[];
    onSectionChange: (section: WorkspaceSection) => void;
}) {
    return (
        <div role="group" aria-labelledby={id}>
            <h3
                id={id}
                className="flex items-center gap-3 px-4 pt-3 pb-1.5 text-[11px] font-bold tracking-[0.07em] text-ink-soft uppercase after:h-px after:flex-1 after:bg-line sm:px-5"
            >
                {title}
            </h3>
            <ul className="divide-y divide-line border-b border-line last:border-b-0">
                {items.map((item, index) => (
                    <QueueRow
                        key={item.key}
                        item={item}
                        rank={startRank + index}
                        now={now}
                        availableSections={availableSections}
                        onSectionChange={onSectionChange}
                    />
                ))}
            </ul>
        </div>
    );
}

function QueueRow({
    item,
    rank,
    now,
    availableSections,
    onSectionChange,
}: {
    item: ManagerQueueItem;
    rank: number;
    now: number;
    availableSections: WorkspaceSection[];
    onSectionChange: (section: WorkspaceSection) => void;
}) {
    const tag = TAGS[item.kind];
    const TagIcon = tag.icon;
    const isSos = item.kind === 'sos';
    const age = formatElapsed(item.since, now);
    const waitedLong =
        item.group === 'decision' &&
        (timestampOf(item.since) ?? now) <= now - LONG_WAIT_MS;

    return (
        <li
            className={cn(
                'relative grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 px-4 py-4 sm:px-5 xl:grid-cols-[1.75rem_minmax(0,1fr)_12rem_5.75rem_12.5rem] xl:gap-x-5',
                isSos &&
                    'bg-danger-soft/70 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-danger',
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    'flex size-6 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                    isSos
                        ? 'border-danger bg-danger text-danger-contrast'
                        : 'border-line-strong bg-surface text-ink-soft',
                )}
            >
                {rank}
            </span>

            <div className="min-w-0">
                <span
                    className={cn(
                        'inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold',
                        tag.className,
                    )}
                >
                    <TagIcon className="size-3.5" aria-hidden="true" />
                    {tag.label}
                </span>
                <p className="mt-1.5 text-[15px] leading-snug font-semibold text-pretty text-ink">
                    {item.title}
                </p>
                <p className="mt-0.5 text-sm text-pretty text-ink-soft">
                    {item.detail}
                </p>
                {item.kind === 'sos' && (
                    <SosEscalation incident={item.incident} now={now} />
                )}
            </div>

            {/* Subject and age share one line until xl, then become columns. */}
            <div className="col-start-2 flex min-w-0 flex-wrap items-baseline gap-x-5 gap-y-1 xl:contents">
                <div className="min-w-0 text-sm xl:pt-7.5">
                    <p className="font-semibold text-ink">{item.subject}</p>
                    {item.subjectDetail && (
                        <p className="mt-0.5 text-xs text-ink-soft">
                            {item.subjectDetail}
                        </p>
                    )}
                </div>

                <p className="flex items-baseline gap-1.5 text-xs text-ink-soft tabular-nums xl:block xl:pt-7.5">
                    {age === null ? (
                        'Time not recorded'
                    ) : (
                        <>
                            <span
                                className={cn(
                                    'text-sm font-semibold xl:block',
                                    isSos
                                        ? 'text-danger-strong'
                                        : waitedLong
                                          ? 'text-warning-strong'
                                          : 'text-ink',
                                )}
                            >
                                {isSos ? (
                                    <LiveElapsed since={item.since} />
                                ) : (
                                    age
                                )}
                            </span>
                            {item.sinceLabel}
                        </>
                    )}
                </p>
            </div>

            {/* Buttons inherit font from here: app.css resets `button { font: inherit }` outside any layer. */}
            <div className="col-start-2 flex flex-wrap items-start gap-2 text-xs font-semibold xl:col-start-auto xl:flex-col xl:items-stretch xl:pt-6">
                <QueueRowActions
                    item={item}
                    availableSections={availableSections}
                    onSectionChange={onSectionChange}
                />
            </div>
        </li>
    );
}

function SosEscalation({
    incident,
    now,
}: {
    incident: Extract<ManagerQueueItem, { kind: 'sos' }>['incident'];
    now: number;
}) {
    const received = timestampOf(incident.received_at);
    const due = timestampOf(incident.escalation_due_at);

    if (incident.status.value === 'escalated') {
        const escalatedAge = formatElapsed(incident.escalated_at, now);

        return (
            <p className="mt-1.5 text-xs font-semibold text-danger-strong">
                Escalated to emergency contacts
                {escalatedAge ? ` ${escalatedAge} ago` : ''}
            </p>
        );
    }

    if (
        incident.status.value !== 'active' ||
        received === null ||
        due === null ||
        due <= now
    ) {
        return null;
    }

    return (
        <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-danger-strong tabular-nums">
            <LiveProgress
                start={received}
                end={due}
                className="block h-1.5 w-28 overflow-hidden rounded-full bg-danger/15"
                fillClassName="block h-full rounded-full bg-danger"
            />
            <span>
                Escalates to emergency contacts in{' '}
                <LiveCountdown target={due} expiredLabel="moments" />
            </span>
        </p>
    );
}

function QueueRowActions({
    item,
    availableSections,
    onSectionChange,
}: {
    item: ManagerQueueItem;
    availableSections: WorkspaceSection[];
    onSectionChange: (section: WorkspaceSection) => void;
}) {
    const canOpen = (section: WorkspaceSection) =>
        availableSections.includes(section);

    switch (item.kind) {
        case 'sos':
            return (
                <>
                    <SosAcknowledgeControl
                        incident={item.incident}
                        size="sm"
                        className="xl:w-full"
                    />
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onSectionChange('sos')}
                        aria-label={`Open SOS incident reported by ${item.incident.worker.name}`}
                    >
                        Open incident
                    </Button>
                </>
            );
        case 'blocked_asset':
            return canOpen('assets') ? (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onSectionChange('assets')}
                    aria-label={`Review blocked unit ${item.asset.code}`}
                >
                    Review unit
                </Button>
            ) : null;
        case 'approval': {
            const { id, reference } = item.approval.subject;

            return (
                <Link
                    href={dispatchDetailHref(id)}
                    aria-label={
                        item.approval.can_decide
                            ? `Review approval for ${reference}`
                            : `View dispatch ${reference}`
                    }
                    className={buttonVariants({
                        variant: item.approval.can_decide
                            ? 'primary'
                            : 'secondary',
                        size: 'sm',
                        className: 'font-semibold',
                    })}
                >
                    {item.approval.can_decide
                        ? 'Review approval'
                        : 'View dispatch'}
                </Link>
            );
        }
        case 'fuel_request':
            return canOpen('fuel') ? (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onSectionChange('fuel')}
                    aria-label={`Review fuel request ${item.request.reference}`}
                >
                    Review request
                </Button>
            ) : null;
        case 'fuel_anomalies':
            return canOpen('fuel') ? (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onSectionChange('fuel')}
                >
                    Review fuel logs
                </Button>
            ) : null;
    }
}
