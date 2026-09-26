import {
    EXECUTION_STATUSES,
    jobNeedsAssignment,
    sourceMatches,
} from '@/components/workspace/dispatch-desk/dispatch-desk-helpers';
import { parseScheduleDate } from '@/lib/date-utils';
import { humanize } from '@/lib/formatters';
import type {
    ApprovalViewModel,
    AssetViewModel,
    DispatchJobViewModel,
    FuelRequestViewModel,
    SosIncidentViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

/* =========================================================================
   Time helpers
   ========================================================================= */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function timestampOf(value: string | null | undefined): number | null {
    if (!value) {
        return null;
    }

    const parsed = Date.parse(value);

    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Compact elapsed time, e.g. "12 m", "1 h 05 m", "2 d". `precise` adds
 * seconds for the first ten minutes and is reserved for live-ticking values.
 */
export function formatElapsed(
    value: string | null | undefined,
    now: number,
    { precise = false }: { precise?: boolean } = {},
): string | null {
    const timestamp = timestampOf(value);

    if (timestamp === null) {
        return null;
    }

    const elapsed = Math.max(0, now - timestamp);

    if (elapsed < MINUTE_MS) {
        return precise ? `${Math.floor(elapsed / 1000)} s` : '<1 m';
    }

    if (elapsed < HOUR_MS) {
        const minutes = Math.floor(elapsed / MINUTE_MS);
        const seconds = Math.floor((elapsed % MINUTE_MS) / 1000);

        return precise && minutes < 10
            ? `${minutes} m ${seconds} s`
            : `${minutes} m`;
    }

    if (elapsed < DAY_MS) {
        const hours = Math.floor(elapsed / HOUR_MS);
        const minutes = Math.floor((elapsed % HOUR_MS) / MINUTE_MS);

        return `${hours} h ${String(minutes).padStart(2, '0')} m`;
    }

    return `${Math.floor(elapsed / DAY_MS)} d`;
}

/** Countdown clock such as "1:48" or "1:02:03". */
export function formatCountdown(milliseconds: number): string {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const paddedSeconds = String(seconds).padStart(2, '0');

    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
        : `${minutes}:${paddedSeconds}`;
}

export function isSameLocalDay(
    value: string | null | undefined,
    now: number,
): boolean {
    const timestamp = timestampOf(value);

    if (timestamp === null) {
        return false;
    }

    const date = new Date(timestamp);
    const today = new Date(now);

    return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    );
}

export function formatClockTime(value: string | Date | null): string {
    const date = value instanceof Date ? value : parseScheduleDate(value);

    if (!date) {
        return '';
    }

    return new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function formatStartLabel(value: string | null, now: number): string | null {
    const date = parseScheduleDate(value);

    if (!date) {
        return null;
    }

    if (isSameLocalDay(date.toISOString(), now)) {
        return `starts ${formatClockTime(date)}`;
    }

    return `starts ${new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)}`;
}

function plural(count: number, singular: string, pluralForm?: string): string {
    return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

function compareNullableTimestamps(
    left: string | null | undefined,
    right: string | null | undefined,
): number {
    const leftTime = timestampOf(left);
    const rightTime = timestampOf(right);

    if (leftTime === null && rightTime === null) {
        return 0;
    }

    if (leftTime === null) {
        return 1;
    }

    if (rightTime === null) {
        return -1;
    }

    return leftTime - rightTime;
}

/* =========================================================================
   Manager action & exception queue
   ========================================================================= */

export type QueueCategory = 'emergency' | 'safety' | 'approvals' | 'fuel';
export type QueueFilter = 'all' | QueueCategory;
export type QueueGroup = 'act_now' | 'decision';

export const QUEUE_CATEGORY_ORDER: readonly QueueCategory[] = [
    'emergency',
    'safety',
    'approvals',
    'fuel',
];

export const QUEUE_CATEGORY_LABELS: Record<QueueCategory, string> = {
    emergency: 'Emergency',
    safety: 'Safety',
    approvals: 'Approvals',
    fuel: 'Fuel',
};

interface QueueItemBase {
    key: string;
    category: QueueCategory;
    group: QueueGroup;
    title: string;
    detail: string;
    subject: string;
    subjectDetail: string | null;
    /** When the wait for this decision started. */
    since: string | null;
    sinceLabel: string;
}

export type ManagerQueueItem =
    | (QueueItemBase & { kind: 'sos'; incident: SosIncidentViewModel })
    | (QueueItemBase & { kind: 'blocked_asset'; asset: AssetViewModel })
    | (QueueItemBase & { kind: 'approval'; approval: ApprovalViewModel })
    | (QueueItemBase & {
          kind: 'fuel_request';
          request: FuelRequestViewModel;
          nextStep: string;
      })
    | (QueueItemBase & { kind: 'fuel_anomalies'; count: number });

export interface ManagerQueueInput {
    activeSosIncidents: SosIncidentViewModel[];
    assets: AssetViewModel[];
    approvals: ApprovalViewModel[];
    fuelRequests: FuelRequestViewModel[];
    capabilities: WorkspaceCapabilities;
}

const UNRESOLVED_SOS_STATUSES = ['active', 'escalated', 'acknowledged'];
const UNACKNOWLEDGED_SOS_STATUSES = ['active', 'escalated'];

export function isUnresolvedSos(incident: SosIncidentViewModel): boolean {
    return UNRESOLVED_SOS_STATUSES.includes(incident.status.value);
}

export function isUnacknowledgedSos(incident: SosIncidentViewModel): boolean {
    return UNACKNOWLEDGED_SOS_STATUSES.includes(incident.status.value);
}

export function hasDispatchBlockingWork(asset: AssetViewModel): boolean {
    return asset.blocking_work_orders_count > 0;
}

/**
 * Mirrors the fuel card's action rules so the dashboard never promises a
 * step the current role cannot perform in Fuel Management.
 */
export function fuelNextStep(
    request: FuelRequestViewModel,
    capabilities: WorkspaceCapabilities,
): string | null {
    switch (request.status.value) {
        case 'submitted':
            if (capabilities.forward_fuel && capabilities.approve_fuel) {
                return 'Approve or reject';
            }

            return capabilities.forward_fuel ? 'Forward for review' : null;
        case 'forwarded':
            return capabilities.approve_fuel ? 'Approve or reject' : null;
        case 'approved':
            return capabilities.verify_fuel ? 'Verify allocation' : null;
        case 'verified':
            return capabilities.record_fuel && (request.logs?.length ?? 0) === 0
                ? 'Record fuel log'
                : null;
        default:
            return null;
    }
}

function sosItem(incident: SosIncidentViewModel): ManagerQueueItem {
    const category =
        incident.category.value === 'unclassified'
            ? 'Emergency SOS'
            : incident.category.label;
    const state =
        incident.status.value === 'acknowledged'
            ? `Acknowledged by ${incident.acknowledged_by?.name ?? 'a responder'}`
            : incident.status.value === 'escalated'
              ? 'Escalated · not yet acknowledged'
              : 'Not yet acknowledged';
    const location = incident.dispatch?.site ?? incident.location?.context;

    return {
        kind: 'sos',
        key: `sos-${incident.id}`,
        category: 'emergency',
        group: 'act_now',
        incident,
        title: `${category} reported by ${incident.worker.name}`,
        detail: [incident.dispatch?.reference, location, state]
            .filter(Boolean)
            .join(' · '),
        subject: incident.asset
            ? `${incident.asset.code} · ${incident.asset.name}`
            : 'No equipment linked',
        subjectDetail: incident.dispatch?.title ?? null,
        since: incident.received_at,
        sinceLabel: 'since raised',
    };
}

function blockingOrderFor(asset: AssetViewModel) {
    return (asset.maintenance_work_orders ?? []).find(
        (order) => order.dispatch_blocking && order.released_at === null,
    );
}

function criticalDefectCount(asset: AssetViewModel): number {
    return (
        asset.latest_dvir?.critical_defects_count ??
        asset.lockout?.critical_defects_count ??
        0
    );
}

function blockedAssetItem(asset: AssetViewModel): ManagerQueueItem {
    const order = blockingOrderFor(asset);
    const critical = criticalDefectCount(asset) > 0;
    const reason =
        asset.lockout?.lockout_reason ??
        order?.defect ??
        'Dispatch-blocking maintenance is open';
    const since =
        order?.created_at ??
        (critical ? (asset.latest_dvir?.completed_at ?? null) : null) ??
        asset.latest_status_change?.occurred_at ??
        null;

    return {
        kind: 'blocked_asset',
        key: `asset-${asset.id}`,
        category: 'safety',
        group: 'act_now',
        asset,
        title: `${asset.code} blocked from dispatch`,
        detail: critical ? `Critical DVIR defect · ${reason}` : reason,
        subject: `${asset.code} · ${asset.name}`,
        subjectDetail: `${plural(asset.blocking_work_orders_count, 'dispatch-blocking work order')} open`,
        since,
        sinceLabel: 'since reported',
    };
}

function approvalTitle(approval: ApprovalViewModel): string {
    const fallbackTitle = (approval as unknown as { title?: string }).title;
    const reference = approval.subject?.reference ?? fallbackTitle ?? 'request';

    switch (approval.kind) {
        case 'dispatch_activation':
            return `Activate dispatch ${reference}`;
        case 'assignment_override':
            return `Approve assignment override for ${reference}`;
        case 'reassignment_override':
            return `Approve reassignment for ${reference}`;
        default:
            return approval.kind
                ? `Review ${humanize(approval.kind)} for ${reference}`
                : fallbackTitle ?? `Review approval for ${reference}`;
    }
}

function approvalItem(
    approval: ApprovalViewModel,
    now: number,
): ManagerQueueItem {
    const priority = approval.subject?.priority;
    const detail = approval.can_decide
        ? [
              priority && priority.value !== 'routine'
                  ? `${priority.label} job`
                  : null,
              approval.requester?.name
                  ? `requested by ${approval.requester.name}`
                  : null,
              formatStartLabel(approval.subject?.scheduled_start, now),
          ]
              .filter(Boolean)
              .join(' · ')
        : (approval.decision_blocker ??
          'Another authorized manager must decide this request.');

    const fallbackTitle = (approval as unknown as { title?: string }).title;

    return {
        kind: 'approval',
        key: `approval-${approval.id}`,
        category: 'approvals',
        group: 'decision',
        approval,
        title: approvalTitle(approval),
        detail,
        subject:
            approval.subject?.title ??
            approval.subject?.reference ??
            fallbackTitle ??
            'Approval',
        subjectDetail: approval.subject?.site ?? '',
        since: approval.created_at ?? null,
        sinceLabel: 'waiting',
    };
}

function formatLitres(value: string): string {
    const litres = Number.parseFloat(value);

    return Number.isFinite(litres)
        ? `${litres.toLocaleString(undefined, { maximumFractionDigits: 1 })} L`
        : `${value} L`;
}

function fuelRequestItem(
    request: FuelRequestViewModel,
    nextStep: string,
    now: number,
): ManagerQueueItem {
    const urgency =
        request.urgency && request.urgency.value !== 'normal'
            ? request.urgency.label
            : null;
    const neededBy = request.needed_by
        ? `needed by ${
              isSameLocalDay(request.needed_by, now)
                  ? formatClockTime(request.needed_by)
                  : new Intl.DateTimeFormat(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    }).format(new Date(request.needed_by))
          }`
        : null;
    const fuelLevel =
        typeof request.current_fuel_level_percent === 'number'
            ? `fuel level ${request.current_fuel_level_percent}%`
            : null;

    return {
        kind: 'fuel_request',
        key: `fuel-${request.id}`,
        category: 'fuel',
        group: 'decision',
        request,
        nextStep,
        title: `${formatLitres(request.quantity_litres)} ${humanize(request.fuel_type)} for ${request.asset?.code ?? 'unlinked equipment'}`,
        detail: [
            urgency,
            neededBy,
            fuelLevel,
            request.job ? `for ${request.job.reference}` : null,
            `requested by ${request.requester.name}`,
        ]
            .filter(Boolean)
            .join(' · '),
        subject: request.asset
            ? [request.asset.code, request.asset.name]
                  .filter(Boolean)
                  .join(' · ')
            : 'No equipment linked',
        subjectDetail: `Next step: ${nextStep}`,
        since: request.submitted_at ?? request.created_at ?? null,
        sinceLabel: 'waiting',
    };
}

function fuelAnomalyItem(
    fuelRequests: FuelRequestViewModel[],
): ManagerQueueItem | null {
    const anomalies = fuelRequests.flatMap((request) =>
        (request.logs ?? [])
            .filter((log) => log.is_anomaly)
            .map((log) => ({ log, request })),
    );

    if (anomalies.length === 0) {
        return null;
    }

    const latest = [...anomalies].sort((left, right) =>
        compareNullableTimestamps(right.log.recorded_at, left.log.recorded_at),
    )[0];
    const assetCodes = [
        ...new Set(
            anomalies
                .map(({ request }) => request.asset?.code)
                .filter((code): code is string => Boolean(code)),
        ),
    ];

    return {
        kind: 'fuel_anomalies',
        key: 'fuel-anomalies',
        category: 'fuel',
        group: 'decision',
        count: anomalies.length,
        title: `${plural(anomalies.length, 'fuel consumption anomaly', 'fuel consumption anomalies')} flagged`,
        detail:
            latest.log.anomaly_reason ??
            'Variance or burn rate outside the expected range needs review.',
        subject:
            assetCodes.length > 0
                ? assetCodes.slice(0, 3).join(', ') +
                  (assetCodes.length > 3 ? ` +${assetCodes.length - 3}` : '')
                : 'Fuel logs',
        subjectDetail: 'Review fuel logs',
        since: latest.log.recorded_at,
        sinceLabel: 'latest flagged',
    };
}

const PRIORITY_RANK: Record<string, number> = {
    emergency: 0,
    priority: 1,
    routine: 2,
};

const URGENCY_RANK: Record<string, number> = {
    critical: 0,
    urgent: 1,
    normal: 2,
};

/**
 * Builds the manager queue from live workspace data only. Ordering is
 * emergencies → safety blockers → decisions the user can make → fuel.
 */
export function buildManagerQueue(
    input: ManagerQueueInput,
    now: number,
): ManagerQueueItem[] {
    const sos = input.activeSosIncidents
        .filter(isUnresolvedSos)
        .sort(
            (left, right) =>
                Number(isUnacknowledgedSos(right)) -
                    Number(isUnacknowledgedSos(left)) ||
                compareNullableTimestamps(left.received_at, right.received_at),
        )
        .map(sosItem);

    const blocked = input.assets
        .filter(hasDispatchBlockingWork)
        .map(blockedAssetItem)
        .sort((left, right) => {
            const leftAsset = left.kind === 'blocked_asset' ? left.asset : null;
            const rightAsset =
                right.kind === 'blocked_asset' ? right.asset : null;
            const criticalOrder =
                Number(rightAsset ? criticalDefectCount(rightAsset) > 0 : 0) -
                Number(leftAsset ? criticalDefectCount(leftAsset) > 0 : 0);

            return (
                criticalOrder ||
                compareNullableTimestamps(left.since, right.since) ||
                left.subject.localeCompare(right.subject)
            );
        });

    const approvals = input.approvals
        .filter(
            (approval) => (approval.status?.value ?? 'pending') === 'pending',
        )
        .sort(
            (left, right) =>
                Number(right.can_decide) - Number(left.can_decide) ||
                (PRIORITY_RANK[left.subject?.priority?.value ?? 'routine'] ??
                    2) -
                    (PRIORITY_RANK[
                        right.subject?.priority?.value ?? 'routine'
                    ] ?? 2) ||
                compareNullableTimestamps(
                    left.subject?.scheduled_start,
                    right.subject?.scheduled_start,
                ) ||
                compareNullableTimestamps(left.created_at, right.created_at),
        )
        .map((approval) => approvalItem(approval, now));

    const fuel = input.fuelRequests
        .map((request) => ({
            request,
            nextStep: fuelNextStep(request, input.capabilities),
        }))
        .filter(
            (
                entry,
            ): entry is { request: FuelRequestViewModel; nextStep: string } =>
                entry.nextStep !== null,
        )
        .sort(
            (left, right) =>
                (URGENCY_RANK[left.request.urgency?.value ?? 'normal'] ?? 2) -
                    (URGENCY_RANK[right.request.urgency?.value ?? 'normal'] ??
                        2) ||
                compareNullableTimestamps(
                    left.request.needed_by,
                    right.request.needed_by,
                ) ||
                compareNullableTimestamps(
                    left.request.submitted_at ?? left.request.created_at,
                    right.request.submitted_at ?? right.request.created_at,
                ),
        )
        .map(({ request, nextStep }) =>
            fuelRequestItem(request, nextStep, now),
        );

    const anomalies = fuelAnomalyItem(input.fuelRequests);

    return [
        ...sos,
        ...blocked,
        ...approvals,
        ...fuel,
        ...(anomalies ? [anomalies] : []),
    ];
}

export function countQueueCategories(
    items: ManagerQueueItem[],
): Record<QueueCategory, number> {
    const counts: Record<QueueCategory, number> = {
        emergency: 0,
        safety: 0,
        approvals: 0,
        fuel: 0,
    };

    for (const item of items) {
        counts[item.category] += 1;
    }

    return counts;
}

export const QUEUE_PREVIEW_LIMIT = 5;

/** Emergencies are never collapsed behind "Show all". */
export function visibleQueueItems(
    items: ManagerQueueItem[],
    filter: QueueFilter,
    expanded: boolean,
): { items: ManagerQueueItem[]; total: number } {
    const filtered =
        filter === 'all'
            ? items
            : items.filter((item) => item.category === filter);
    const emergencies = filtered.filter(
        (item) => item.category === 'emergency',
    ).length;
    const limit = expanded
        ? filtered.length
        : Math.max(QUEUE_PREVIEW_LIMIT, emergencies);

    return { items: filtered.slice(0, limit), total: filtered.length };
}

export interface AuthorizationSummary {
    total: number;
    approvals: number;
    fuelRequests: number;
    oldestWaitingSince: string | null;
}

export function summarizeAuthorizations(
    items: ManagerQueueItem[],
): AuthorizationSummary {
    const decisions = items.filter(
        (item) =>
            (item.kind === 'approval' && item.approval.can_decide) ||
            item.kind === 'fuel_request',
    );
    const oldest = [...decisions].sort((left, right) =>
        compareNullableTimestamps(left.since, right.since),
    )[0];

    return {
        total: decisions.length,
        approvals: decisions.filter((item) => item.kind === 'approval').length,
        fuelRequests: decisions.filter((item) => item.kind === 'fuel_request')
            .length,
        oldestWaitingSince: oldest?.since ?? null,
    };
}

export interface SafetySummary {
    total: number;
    openSos: number;
    /** Open incidents nobody has acknowledged yet (active or escalated). */
    unacknowledged: number;
    blockedUnits: number;
    /** Soonest escalation among unacknowledged, not-yet-escalated incidents. */
    nextEscalationAt: string | null;
    escalatedCount: number;
}

export function summarizeSafety(
    incidents: SosIncidentViewModel[],
    assets: AssetViewModel[],
    now: number,
): SafetySummary {
    const unresolved = incidents.filter(isUnresolvedSos);
    const blockedUnits = assets.filter(hasDispatchBlockingWork).length;
    const upcoming = unresolved
        .filter(
            (incident) =>
                incident.status.value === 'active' &&
                (timestampOf(incident.escalation_due_at) ?? 0) > now,
        )
        .map((incident) => incident.escalation_due_at)
        .sort(compareNullableTimestamps);

    return {
        total: unresolved.length + blockedUnits,
        openSos: unresolved.length,
        unacknowledged: unresolved.filter(isUnacknowledgedSos).length,
        blockedUnits,
        nextEscalationAt: upcoming[0] ?? null,
        escalatedCount: unresolved.filter(
            (incident) => incident.status.value === 'escalated',
        ).length,
    };
}

/* =========================================================================
   Fleet readiness & breakdown
   ========================================================================= */

export type FleetBucket =
    'available' | 'on_job' | 'maintenance' | 'blocked' | 'not_cleared';

export const FLEET_BUCKET_ORDER: readonly FleetBucket[] = [
    'available',
    'on_job',
    'maintenance',
    'blocked',
    'not_cleared',
];

export const FLEET_BUCKET_LABELS: Record<FleetBucket, string> = {
    available: 'Available',
    on_job: 'On job',
    maintenance: 'In maintenance',
    blocked: 'Blocked',
    not_cleared: 'Not cleared',
};

const ON_JOB_STATUSES = ['assigned', 'working', 'in_transit', 'on_site'];
const MAINTENANCE_STATUSES = [
    'under_inspection',
    'under_maintenance',
    'awaiting_parts',
    'maintenance',
];

/** Exclusive bucket; dispatch-blocking work always wins. */
export function fleetBucket(asset: AssetViewModel): FleetBucket {
    if (hasDispatchBlockingWork(asset)) {
        return 'blocked';
    }

    if (ON_JOB_STATUSES.includes(asset.status.value)) {
        return 'on_job';
    }

    if (MAINTENANCE_STATUSES.includes(asset.status.value)) {
        return 'maintenance';
    }

    return asset.is_dispatchable ? 'available' : 'not_cleared';
}

const CATEGORY_ORDER = [
    'mobile_cranes',
    'tower_cranes',
    'heavy_equipment',
    'transport',
    'other',
];

const CATEGORY_LABELS: Record<string, string> = {
    mobile_cranes: 'Mobile cranes',
    tower_cranes: 'Tower cranes',
    heavy_equipment: 'Heavy equipment',
    transport: 'Transport',
    other: 'Other assets',
};

export interface FleetCategorySummary {
    value: string;
    label: string;
    total: number;
    inService: number;
    available: number;
}

export interface FleetSummary {
    loaded: number;
    total: number;
    partial: boolean;
    counts: Record<FleetBucket, number>;
    inService: number;
    readinessPercent: number | null;
    categories: FleetCategorySummary[];
    dvirsToday: number;
    hosWarnings: number;
}

const HOS_WARNING_STATUSES = ['warning', 'critical', 'violation'];

export function summarizeFleet(
    assets: AssetViewModel[],
    assetsTotal: number | undefined,
    now: number,
): FleetSummary {
    const counts: Record<FleetBucket, number> = {
        available: 0,
        on_job: 0,
        maintenance: 0,
        blocked: 0,
        not_cleared: 0,
    };
    const categories = new Map<string, FleetCategorySummary>();
    const warnedOperators = new Set<string>();
    let dvirsToday = 0;

    for (const asset of assets) {
        const bucket = fleetBucket(asset);
        const categoryValue = asset.category ?? 'other';
        const category = categories.get(categoryValue) ?? {
            value: categoryValue,
            label:
                CATEGORY_LABELS[categoryValue] ??
                asset.category_label ??
                humanize(categoryValue),
            total: 0,
            inService: 0,
            available: 0,
        };

        counts[bucket] += 1;
        category.total += 1;
        category.inService += Number(
            bucket === 'available' || bucket === 'on_job',
        );
        category.available += Number(bucket === 'available');
        categories.set(categoryValue, category);

        if (isSameLocalDay(asset.latest_dvir?.completed_at, now)) {
            dvirsToday += 1;
        }

        if (
            asset.hos &&
            (asset.hos.dole_warning ||
                HOS_WARNING_STATUSES.includes(asset.hos.fatigue_status))
        ) {
            warnedOperators.add(
                asset.active_operator
                    ? `operator-${asset.active_operator.id}`
                    : `asset-${asset.id}`,
            );
        }
    }

    const loaded = assets.length;
    const inService = counts.available + counts.on_job;

    return {
        loaded,
        total: Math.max(assetsTotal ?? loaded, loaded),
        partial: (assetsTotal ?? loaded) > loaded,
        counts,
        inService,
        readinessPercent:
            loaded > 0 ? Math.round((inService / loaded) * 100) : null,
        categories: [...categories.values()].sort(
            (left, right) =>
                (CATEGORY_ORDER.indexOf(left.value) + 1 || 99) -
                    (CATEGORY_ORDER.indexOf(right.value) + 1 || 99) ||
                left.label.localeCompare(right.label),
        ),
        dvirsToday,
        hosWarnings: warnedOperators.size,
    };
}

/* =========================================================================
   Today's dispatch schedule
   ========================================================================= */

export type ScheduleState =
    'in_progress' | 'scheduled' | 'awaiting_approval' | 'needs_resources';

export const SCHEDULE_STATE_ORDER: readonly ScheduleState[] = [
    'in_progress',
    'scheduled',
    'awaiting_approval',
    'needs_resources',
];

export const SCHEDULE_STATE_LABELS: Record<ScheduleState, string> = {
    in_progress: 'In progress',
    scheduled: 'Scheduled',
    awaiting_approval: 'Awaiting approval',
    needs_resources: 'Needs resources',
};

export type ScheduleSourceFilter = 'all' | 'service' | 'rental' | 'manual';

const SOURCE_FILTER_VALUES: Record<ScheduleSourceFilter, string> = {
    all: 'all',
    service: 'service_request',
    rental: 'rental_reservation',
    manual: 'manual',
};

export function isExecutionJob(job: DispatchJobViewModel): boolean {
    return (EXECUTION_STATUSES as readonly string[]).includes(job.status.value);
}

export function scheduleState(job: DispatchJobViewModel): ScheduleState {
    if (isExecutionJob(job)) {
        return 'in_progress';
    }

    if (job.status.value === 'pending_approval') {
        return 'awaiting_approval';
    }

    return jobNeedsAssignment(job) ? 'needs_resources' : 'scheduled';
}

export function matchesScheduleSource(
    job: DispatchJobViewModel,
    filter: ScheduleSourceFilter,
): boolean {
    return sourceMatches(job.source, SOURCE_FILTER_VALUES[filter]);
}

/** Same grouping as the dispatch desk source filter: non-Core 1 work is manual intake. */
export function sourceLabel(
    job: DispatchJobViewModel,
): 'Service' | 'Rental' | 'Manual' {
    if (matchesScheduleSource(job, 'service')) {
        return 'Service';
    }

    return matchesScheduleSource(job, 'rental') ? 'Rental' : 'Manual';
}

export interface JobInterval {
    start: Date;
    end: Date;
}

export function jobInterval(job: DispatchJobViewModel): JobInterval | null {
    const start = parseScheduleDate(job.scheduled_start);
    const end = parseScheduleDate(job.scheduled_end);

    if (!start || !end || end <= start) {
        return null;
    }

    return { start, end };
}

export function localDayBounds(now: number): { start: Date; end: Date } {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { start, end };
}

/** Separates jobs that overlap today from undated preparation drafts. */
export function partitionTodayJobs(
    jobs: DispatchJobViewModel[],
    now: number,
): { dated: DispatchJobViewModel[]; undated: DispatchJobViewModel[] } {
    const day = localDayBounds(now);
    const dated: DispatchJobViewModel[] = [];
    const undated: DispatchJobViewModel[] = [];

    for (const job of jobs) {
        const interval = jobInterval(job);

        if (interval) {
            if (interval.start < day.end && interval.end > day.start) {
                dated.push(job);
            }
        } else if (!job.scheduled_start && !job.scheduled_end) {
            undated.push(job);
        }
    }

    return { dated, undated };
}

/** Active work first, then by start time; matches the dispatch desk ranking. */
export function sortScheduleJobs(
    jobs: DispatchJobViewModel[],
): DispatchJobViewModel[] {
    return [...jobs].sort(
        (left, right) =>
            Number(isExecutionJob(right)) - Number(isExecutionJob(left)) ||
            compareNullableTimestamps(
                left.scheduled_start,
                right.scheduled_start,
            ) ||
            left.reference.localeCompare(right.reference),
    );
}

export interface ScheduleSummary {
    total: number;
    counts: Record<ScheduleState, number>;
    delayReported: number;
}

export function summarizeSchedule(
    jobs: DispatchJobViewModel[],
): ScheduleSummary {
    const counts: Record<ScheduleState, number> = {
        in_progress: 0,
        scheduled: 0,
        awaiting_approval: 0,
        needs_resources: 0,
    };
    let delayReported = 0;

    for (const job of jobs) {
        counts[scheduleState(job)] += 1;

        if (isExecutionJob(job) && job.latest_delay) {
            delayReported += 1;
        }
    }

    return { total: jobs.length, counts, delayReported };
}

export function countBySource(
    jobs: DispatchJobViewModel[],
): Record<ScheduleSourceFilter, number> {
    return {
        all: jobs.length,
        service: jobs.filter((job) => matchesScheduleSource(job, 'service'))
            .length,
        rental: jobs.filter((job) => matchesScheduleSource(job, 'rental'))
            .length,
        manual: jobs.filter((job) => matchesScheduleSource(job, 'manual'))
            .length,
    };
}

export interface TimelineWindow {
    start: Date;
    end: Date;
    hours: number[];
}

const DEFAULT_WINDOW_START_HOUR = 7;
const DEFAULT_WINDOW_END_HOUR = 17;

/** 07:00–17:00 like the Day board, widened to fit today's scheduled work. */
export function timelineWindow(
    jobs: DispatchJobViewModel[],
    now: number,
): TimelineWindow {
    const day = localDayBounds(now);
    let startHour = DEFAULT_WINDOW_START_HOUR;
    let endHour = DEFAULT_WINDOW_END_HOUR;

    for (const job of jobs) {
        const interval = jobInterval(job);

        if (!interval) {
            continue;
        }

        const clampedStart =
            interval.start < day.start ? day.start : interval.start;
        const clampedEnd = interval.end > day.end ? day.end : interval.end;
        const jobStartHour =
            (clampedStart.getTime() - day.start.getTime()) / HOUR_MS;
        const jobEndHour =
            (clampedEnd.getTime() - day.start.getTime()) / HOUR_MS;

        startHour = Math.min(startHour, Math.floor(jobStartHour));
        endHour = Math.max(endHour, Math.ceil(jobEndHour));
    }

    startHour = Math.max(0, startHour);
    endHour = Math.min(24, Math.max(endHour, startHour + 1));

    const start = new Date(day.start.getTime() + startHour * HOUR_MS);
    const end = new Date(day.start.getTime() + endHour * HOUR_MS);

    return {
        start,
        end,
        hours: Array.from(
            { length: endHour - startHour },
            (_, index) => startHour + index,
        ),
    };
}

export interface TimelineBar {
    leftPercent: number;
    widthPercent: number;
    startsBeforeWindow: boolean;
    endsAfterWindow: boolean;
}

export function timelineBar(
    job: DispatchJobViewModel,
    window: TimelineWindow,
): TimelineBar | null {
    const interval = jobInterval(job);

    if (!interval) {
        return null;
    }

    const span = window.end.getTime() - window.start.getTime();
    const start = Math.max(interval.start.getTime(), window.start.getTime());
    const end = Math.min(interval.end.getTime(), window.end.getTime());

    if (end <= start || span <= 0) {
        return null;
    }

    return {
        leftPercent: ((start - window.start.getTime()) / span) * 100,
        widthPercent: ((end - start) / span) * 100,
        startsBeforeWindow: interval.start < window.start,
        endsAfterWindow: interval.end > window.end,
    };
}

export function nowMarkerPercent(
    window: TimelineWindow,
    now: number,
): number | null {
    const span = window.end.getTime() - window.start.getTime();
    const offset = now - window.start.getTime();

    if (span <= 0 || offset < 0 || offset > span) {
        return null;
    }

    return (offset / span) * 100;
}

/** Server-ranked active and upcoming work, used when today is empty. */
export function upcomingJobs(
    jobs: DispatchJobViewModel[],
    excludedIds: ReadonlySet<number>,
    limit = 5,
): DispatchJobViewModel[] {
    return jobs
        .filter(
            (job) =>
                !['completed', 'cancelled'].includes(job.status.value) &&
                !excludedIds.has(job.id),
        )
        .slice(0, limit);
}

export function dispatchDetailHref(jobId: number): string {
    const params = new URLSearchParams({ return_to: '/?view=overview' });

    return `/operations/dispatch-jobs/${jobId}?${params.toString()}`;
}
