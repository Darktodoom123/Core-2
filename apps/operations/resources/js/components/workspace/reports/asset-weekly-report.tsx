import {
    AlertCircle,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Download,
    FileSpreadsheet,
    FileText,
    Fuel,
    Loader2,
    Truck,
    Users,
    Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { EmptyState, Panel } from '@/components/ui';
import { buttonVariants } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface AssetOption {
    id: number;
    code: string;
    name: string;
    kind: string | null;
}

export interface AssetWeeklyReport {
    asset: {
        id: number;
        code: string;
        name: string;
        kind: string | null;
        registration_number: string | null;
        status: string | null;
        baseline_burn_rate: number | null;
        burn_rate_unit: string | null;
    };
    week: {
        start: string;
        end: string;
        previous: string;
        next: string;
        label: string;
        timezone: string;
    };
    generated_at: string;
    currency: 'PHP';
    summary: {
        jobs: number;
        personnel: number;
        shifts: number;
        on_duty_minutes: number;
        operating_minutes: number;
        job_reports: number;
        reported_work_minutes: number;
        fuel_logs: number;
        fuel_litres: number;
        fuel_cost: number | null;
        average_burn_rate: number | null;
        fuel_anomalies: number;
        inspections: number;
        inspections_with_defects: number;
        work_orders: number;
    };
    days: Array<{
        date: string;
        label: string;
        jobs: string[];
        operators: string[];
        on_duty_minutes: number;
    }>;
    personnel: Array<{
        user_id: number;
        name: string;
        roles: string[];
        jobs: string[];
        response: string | null;
        assigned_from: string | null;
        assigned_until: string | null;
        shifts_on_asset: number;
        minutes_on_asset: number;
        week_shifts: number;
        week_on_duty_minutes: number;
        week_operating_minutes: number;
        week_driving_minutes: number;
        week_standby_minutes: number;
        week_break_minutes: number;
    }>;
    jobs: Array<{
        id: number;
        reference: string;
        title: string | null;
        client: string | null;
        site: string | null;
        status: string | null;
        scheduled_start: string | null;
        scheduled_end: string | null;
    }>;
    fuel: Array<{
        id: number;
        recorded_at: string | null;
        job_reference: string | null;
        fuel_type: string | null;
        requested_litres: number | null;
        actual_litres: number | null;
        variance_litres: number | null;
        price_per_litre: number | null;
        total_cost: number | null;
        burn_rate: number | null;
        burn_rate_unit: string | null;
        is_anomaly: boolean;
        anomaly_reason: string | null;
        station: string | null;
        recorded_by: string | null;
    }>;
    shifts: Array<{
        id: number;
        operator: string | null;
        job_reference: string | null;
        status: string | null;
        started_at: string | null;
        ended_at: string | null;
        on_duty_minutes: number;
        operating_minutes: number;
        is_certified: boolean;
    }>;
    job_reports: Array<{
        id: number;
        job_reference: string | null;
        author: string | null;
        status: string;
        duration_minutes: number | null;
        ending_meter_value: number | null;
        meter_unit: string | null;
        signer_name: string | null;
        submitted_at: string | null;
        work_summary: string;
    }>;
    inspections: Array<{
        id: number;
        reference: string;
        type: string | null;
        inspector: string | null;
        completed_at: string | null;
        has_defects: boolean;
        critical_defects_count: number;
    }>;
    work_orders: Array<{
        id: number;
        defect: string | null;
        status: string | null;
        dispatch_blocking: boolean;
        scheduled_at: string | null;
        completed_at: string | null;
    }>;
}

const EMPTY = '—';

function hours(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) {
        return EMPTY;
    }

    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);

    return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function peso(amount: number | null | undefined): string {
    return amount === null || amount === undefined
        ? EMPTY
        : formatCurrency(amount);
}

function litres(value: number | null | undefined): string {
    return value === null || value === undefined
        ? EMPTY
        : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} L`;
}

function when(value: string | null | undefined): string {
    if (!value) {
        return EMPTY;
    }

    return new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Manila',
    }).format(new Date(value));
}

function humanizeRole(role: string): string {
    return role.replaceAll('_', ' ');
}

export function assetWeeklyDownloadUrl(
    assetId: number,
    weekStart: string,
    format: 'pdf' | 'csv',
): string {
    return `/operations/reports/asset-weekly/${assetId}/download?format=${format}&week=${weekStart}`;
}

async function fetchAssetWeeklyReport(
    assetId: number | null,
    week: string,
    signal: AbortSignal,
): Promise<{ assets: AssetOption[]; report: AssetWeeklyReport | null }> {
    const params = new URLSearchParams();

    if (assetId !== null) {
        params.set('asset_id', String(assetId));
    }

    if (week) {
        params.set('week', week);
    }

    const response = await fetch(
        `/operations/reports/asset-weekly?${params.toString()}`,
        {
            signal,
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        },
    );

    if (response.status === 403) {
        throw new Error(
            'You do not have access to asset reports. Ask an operations manager for fleet or reporting access.',
        );
    }

    if (response.status === 404) {
        throw new Error('That asset was not found or is not visible to you.');
    }

    if (!response.ok) {
        throw new Error(
            `Could not load the report (error ${response.status}).`,
        );
    }

    return response.json();
}

export function AssetWeeklyReportView({
    initialAssetId = null,
}: {
    initialAssetId?: number | null;
}) {
    const [assets, setAssets] = useState<AssetOption[]>([]);
    const [assetId, setAssetId] = useState<number | null>(initialAssetId);
    const [week, setWeek] = useState<string>('');
    const [report, setReport] = useState<AssetWeeklyReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selection changes go through here so the loading state flips in the
    // event, not inside the fetch effect.
    const select = (nextAssetId: number | null, nextWeek: string) => {
        setLoading(true);
        setError(null);
        setAssetId(nextAssetId);
        setWeek(nextWeek);
    };

    useEffect(() => {
        const controller = new AbortController();

        fetchAssetWeeklyReport(assetId, week, controller.signal)
            .then((payload) => {
                setAssets(payload.assets);
                setReport(payload.report);
                setError(null);
            })
            .catch((e: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }

                setReport(null);
                setError(
                    e instanceof Error
                        ? e.message
                        : 'Could not load the report.',
                );
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [assetId, week]);

    return (
        <div className="space-y-5">
            {/* Controls */}
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="relative flex items-center">
                        <span className="sr-only">Asset</span>
                        <Truck className="pointer-events-none absolute left-3 h-4 w-4 text-ink-soft" />
                        <select
                            aria-label="Asset"
                            value={assetId ?? ''}
                            onChange={(e) =>
                                select(
                                    e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                    week,
                                )
                            }
                            className="h-11 w-full appearance-none rounded-lg border border-line bg-surface-subtle pr-8 pl-9 text-sm font-medium text-ink focus:border-brand-strong focus:outline-none sm:w-80"
                        >
                            <option value="">Choose an asset…</option>
                            {assets.map((asset) => (
                                <option key={asset.id} value={asset.id}>
                                    {asset.code} — {asset.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div
                        className="flex items-center gap-1"
                        role="group"
                        aria-label="Week"
                    >
                        <button
                            type="button"
                            onClick={() =>
                                report && select(assetId, report.week.previous)
                            }
                            disabled={!report}
                            aria-label="Previous week"
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-surface-subtle hover:text-ink disabled:opacity-40"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <label className="relative flex items-center">
                            <span className="sr-only">Jump to week</span>
                            <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-ink-soft" />
                            <input
                                type="date"
                                value={report?.week.start ?? week}
                                onChange={(e) =>
                                    select(assetId, e.target.value)
                                }
                                className="h-11 rounded-lg border border-line bg-surface-subtle pr-2 pl-9 text-sm text-ink focus:border-brand-strong focus:outline-none"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() =>
                                report && select(assetId, report.week.next)
                            }
                            disabled={!report}
                            aria-label="Next week"
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-surface-subtle hover:text-ink disabled:opacity-40"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => select(assetId, '')}
                            className="h-11 rounded-lg px-3 text-xs font-semibold text-brand-strong hover:bg-surface-subtle"
                        >
                            This week
                        </button>
                    </div>
                </div>

                {report && (
                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href={assetWeeklyDownloadUrl(
                                report.asset.id,
                                report.week.start,
                                'pdf',
                            )}
                            download
                            className={buttonVariants({
                                size: 'sm',
                                variant: 'primary',
                            })}
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Download PDF
                        </a>
                        <a
                            href={assetWeeklyDownloadUrl(
                                report.asset.id,
                                report.week.start,
                                'csv',
                            )}
                            download
                            className={buttonVariants({
                                size: 'sm',
                                variant: 'secondary',
                            })}
                        >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            Download CSV
                        </a>
                    </div>
                )}
            </div>

            {error ? (
                <Panel className="p-6">
                    <div
                        className="flex items-start gap-2 text-sm text-danger-strong"
                        role="alert"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        {error}
                    </div>
                </Panel>
            ) : loading && !report ? (
                <Panel className="flex items-center justify-center gap-2 p-10 text-sm text-ink-soft">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                </Panel>
            ) : !report ? (
                <Panel className="p-8">
                    <EmptyState
                        icon={Truck}
                        title="Choose an asset"
                        message="See one crane or truck's week: fuel dispensed and cost, who operated it and when, jobs, job reports, inspections and work orders — then download it as PDF or CSV."
                    />
                </Panel>
            ) : (
                <div
                    className={cn(
                        'space-y-5 transition-opacity',
                        loading && 'opacity-60',
                    )}
                    aria-busy={loading}
                >
                    <AssetWeeklyReportBody report={report} />
                </div>
            )}
        </div>
    );
}

function Tile({
    label,
    value,
    hint,
    tone,
}: {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    tone?: 'danger';
}) {
    return (
        <div className="min-w-0 rounded-lg border border-line bg-surface px-3 py-2.5">
            <div className="text-[11px] font-semibold text-ink-soft">
                {label}
            </div>
            <div
                className={cn(
                    'mt-0.5 truncate text-lg font-bold text-ink tabular-nums',
                    tone === 'danger' && 'text-danger-strong',
                )}
            >
                {value}
            </div>
            {hint && (
                <div className="truncate text-[11px] text-ink-soft">{hint}</div>
            )}
        </div>
    );
}

function Section({
    icon,
    title,
    count,
    children,
}: {
    icon: ReactNode;
    title: string;
    count?: number;
    children: ReactNode;
}) {
    return (
        <Panel className="overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <span className="text-brand-strong">{icon}</span>
                <h3 className="text-sm font-semibold text-ink">{title}</h3>
                {count !== undefined && (
                    <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                        {count}
                    </span>
                )}
            </div>
            <div className="p-4">{children}</div>
        </Panel>
    );
}

function DataTable({
    headers,
    rows,
    empty,
    numeric = [],
}: {
    headers: string[];
    rows: ReactNode[][];
    empty: string;
    numeric?: number[];
}) {
    if (rows.length === 0) {
        return <p className="text-sm text-ink-soft">{empty}</p>;
    }

    return (
        <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                    <tr className="border-b border-line text-[11px] tracking-wide text-ink-soft uppercase">
                        {headers.map((header, i) => (
                            <th
                                key={header}
                                className={cn(
                                    'py-2 pr-3 font-semibold',
                                    numeric.includes(i) && 'text-right',
                                )}
                            >
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-line">
                    {rows.map((row, r) => (
                        <tr key={r} className="align-top">
                            {row.map((cell, i) => (
                                <td
                                    key={i}
                                    className={cn(
                                        'py-2 pr-3 text-ink',
                                        numeric.includes(i) &&
                                            'text-right tabular-nums',
                                    )}
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function AssetWeeklyReportBody({
    report,
}: {
    report: AssetWeeklyReport;
}) {
    const { asset, week, summary: s } = report;

    return (
        <>
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                        Week of {week.label}
                    </p>
                    <h2 className="text-xl font-bold text-ink">
                        {asset.code}{' '}
                        <span className="font-medium text-ink-soft">
                            {asset.name}
                        </span>
                    </h2>
                </div>
                <p className="text-xs text-ink-soft">
                    Mon–Sun · times in {week.timezone}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
                <Tile label="Jobs" value={s.jobs} />
                <Tile label="Personnel" value={s.personnel} />
                <Tile
                    label="On-duty on asset"
                    value={hours(s.on_duty_minutes)}
                    hint={`${s.shifts} shift${s.shifts === 1 ? '' : 's'}`}
                />
                <Tile
                    label="Reported work"
                    value={hours(s.reported_work_minutes)}
                    hint={`${s.job_reports} report${s.job_reports === 1 ? '' : 's'}`}
                />
                <Tile
                    label="Fuel dispensed"
                    value={litres(s.fuel_litres)}
                    hint={`${s.fuel_logs} log${s.fuel_logs === 1 ? '' : 's'}`}
                />
                <Tile label="Fuel cost" value={peso(s.fuel_cost)} />
                <Tile
                    label="Avg burn rate"
                    value={s.average_burn_rate ?? EMPTY}
                    hint={
                        asset.baseline_burn_rate !== null
                            ? `Baseline ${asset.baseline_burn_rate}`
                            : 'No baseline set'
                    }
                    tone={s.fuel_anomalies > 0 ? 'danger' : undefined}
                />
                <Tile
                    label="Inspections"
                    value={s.inspections}
                    hint={
                        s.inspections_with_defects > 0
                            ? `${s.inspections_with_defects} with defects`
                            : `${s.work_orders} work order${s.work_orders === 1 ? '' : 's'}`
                    }
                    tone={s.inspections_with_defects > 0 ? 'danger' : undefined}
                />
            </div>

            <Section
                icon={<CalendarDays className="h-4 w-4" />}
                title="Daily schedule"
            >
                <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                    {report.days.map((day) => {
                        const idle =
                            day.jobs.length === 0 && day.operators.length === 0;

                        return (
                            <li
                                key={day.date}
                                className={cn(
                                    'rounded-lg border p-2.5 text-xs',
                                    idle
                                        ? 'border-dashed border-line text-ink-soft'
                                        : 'border-line bg-surface-subtle/60',
                                )}
                            >
                                <div className="flex items-center justify-between gap-1 font-semibold text-ink">
                                    <span>{day.label}</span>
                                    {day.on_duty_minutes > 0 && (
                                        <span className="text-[11px] text-brand-strong tabular-nums">
                                            {hours(day.on_duty_minutes)}
                                        </span>
                                    )}
                                </div>
                                {idle ? (
                                    <p className="mt-1">No activity</p>
                                ) : (
                                    <>
                                        {day.jobs.length > 0 && (
                                            <p className="mt-1 font-medium text-ink">
                                                {day.jobs.join(', ')}
                                            </p>
                                        )}
                                        {day.operators.length > 0 && (
                                            <p className="mt-0.5 text-ink-soft">
                                                {day.operators.join(', ')}
                                            </p>
                                        )}
                                    </>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </Section>

            <Section
                icon={<Users className="h-4 w-4" />}
                title="Personnel schedule"
                count={report.personnel.length}
            >
                <DataTable
                    empty="No personnel assigned or on shift with this asset this week."
                    headers={[
                        'Name',
                        'Role',
                        'Jobs',
                        'Assigned',
                        'On this asset',
                        'Week on-duty (all assets)',
                        'Operating',
                        'Driving',
                        'Standby',
                    ]}
                    numeric={[4, 5, 6, 7, 8]}
                    rows={report.personnel.map((p) => [
                        <span key="n" className="font-semibold">
                            {p.name}
                            {p.response && (
                                <span className="block text-[11px] font-normal text-ink-soft">
                                    {p.response}
                                </span>
                            )}
                        </span>,
                        <span key="r" className="capitalize">
                            {p.roles.map(humanizeRole).join(', ') || EMPTY}
                        </span>,
                        p.jobs.join(', ') || EMPTY,
                        p.assigned_from
                            ? `${when(p.assigned_from)}${p.assigned_until ? ` → ${when(p.assigned_until)}` : ''}`
                            : EMPTY,
                        `${hours(p.minutes_on_asset)} (${p.shifts_on_asset})`,
                        `${hours(p.week_on_duty_minutes)} (${p.week_shifts})`,
                        hours(p.week_operating_minutes),
                        hours(p.week_driving_minutes),
                        hours(p.week_standby_minutes),
                    ])}
                />
                {report.personnel.length > 0 && (
                    <p className="mt-2 text-[11px] text-ink-soft">
                        Numbers in parentheses are shifts. Week totals include
                        shifts on other assets.
                    </p>
                )}
            </Section>

            <Section
                icon={<Fuel className="h-4 w-4" />}
                title="Fuel"
                count={report.fuel.length}
            >
                <DataTable
                    empty="No fuel dispensed to this asset this week."
                    headers={[
                        'Recorded',
                        'Job',
                        'Requested',
                        'Dispensed',
                        '₱ / L',
                        'Cost',
                        'Burn rate',
                        'Station',
                        'Recorded by',
                    ]}
                    numeric={[2, 3, 4, 5, 6]}
                    rows={[
                        ...report.fuel.map((f) => [
                            when(f.recorded_at),
                            f.job_reference ?? EMPTY,
                            litres(f.requested_litres),
                            litres(f.actual_litres),
                            peso(f.price_per_litre),
                            peso(f.total_cost),
                            <span
                                key="b"
                                className={cn(
                                    f.is_anomaly &&
                                        'font-semibold text-danger-strong',
                                )}
                                title={f.anomaly_reason ?? undefined}
                            >
                                {f.burn_rate ?? EMPTY}
                                {f.is_anomaly && ' ⚠'}
                            </span>,
                            f.station ?? EMPTY,
                            f.recorded_by ?? EMPTY,
                        ]),
                        ...(report.fuel.length > 0
                            ? [
                                  [
                                      <strong key="t">Total</strong>,
                                      '',
                                      '',
                                      <strong key="l">
                                          {litres(s.fuel_litres)}
                                      </strong>,
                                      '',
                                      <strong key="c">
                                          {peso(s.fuel_cost)}
                                      </strong>,
                                      <strong key="a">
                                          {s.average_burn_rate ?? EMPTY}
                                      </strong>,
                                      '',
                                      '',
                                  ],
                              ]
                            : []),
                    ]}
                />
            </Section>

            <div className="grid gap-5 xl:grid-cols-2">
                <Section
                    icon={<Truck className="h-4 w-4" />}
                    title="Jobs"
                    count={report.jobs.length}
                >
                    <DataTable
                        empty="This asset was not assigned to any job this week."
                        headers={[
                            'Reference',
                            'Title',
                            'Site',
                            'Status',
                            'Scheduled',
                        ]}
                        rows={report.jobs.map((job) => [
                            <a
                                key="ref"
                                href={`/operations/dispatch-jobs/${job.id}`}
                                className="font-semibold text-brand-strong hover:underline"
                            >
                                {job.reference}
                            </a>,
                            job.title ?? EMPTY,
                            job.site ?? EMPTY,
                            job.status ?? EMPTY,
                            when(job.scheduled_start),
                        ])}
                    />
                </Section>

                <Section
                    icon={<Users className="h-4 w-4" />}
                    title="Shifts on this asset"
                    count={report.shifts.length}
                >
                    <DataTable
                        empty="No shifts were logged on this asset this week."
                        headers={[
                            'Operator',
                            'Job',
                            'Started',
                            'Ended',
                            'On-duty',
                        ]}
                        numeric={[4]}
                        rows={report.shifts.map((shift) => [
                            shift.operator ?? EMPTY,
                            shift.job_reference ?? EMPTY,
                            when(shift.started_at),
                            shift.ended_at ? when(shift.ended_at) : 'Open',
                            hours(shift.on_duty_minutes),
                        ])}
                    />
                </Section>
            </div>

            <Section
                icon={<FileText className="h-4 w-4" />}
                title="Job reports"
                count={report.job_reports.length}
            >
                <DataTable
                    empty="No job reports filed for this asset's jobs this week."
                    headers={[
                        '#',
                        'Job',
                        'Author',
                        'Status',
                        'Duration',
                        'Sign-off',
                        'Work summary',
                    ]}
                    numeric={[4]}
                    rows={report.job_reports.map((r) => [
                        r.id,
                        r.job_reference ?? EMPTY,
                        r.author ?? EMPTY,
                        r.status,
                        hours(r.duration_minutes),
                        r.signer_name ?? EMPTY,
                        <span key="w" className="line-clamp-2">
                            {r.work_summary}
                        </span>,
                    ])}
                />
            </Section>

            <div className="grid gap-5 xl:grid-cols-2">
                <Section
                    icon={<ClipboardCheck className="h-4 w-4" />}
                    title="Inspections (DVIR)"
                    count={report.inspections.length}
                >
                    <DataTable
                        empty="No inspections completed this week."
                        headers={[
                            'Ref',
                            'Type',
                            'Inspector',
                            'Completed',
                            'Result',
                        ]}
                        rows={report.inspections.map((i) => [
                            i.reference,
                            i.type ?? EMPTY,
                            i.inspector ?? EMPTY,
                            when(i.completed_at),
                            <span
                                key="r"
                                className={
                                    i.has_defects
                                        ? 'font-semibold text-danger-strong'
                                        : 'text-success-strong'
                                }
                            >
                                {i.has_defects
                                    ? `Defects (${i.critical_defects_count} critical)`
                                    : 'No defects'}
                            </span>,
                        ])}
                    />
                </Section>

                <Section
                    icon={<Wrench className="h-4 w-4" />}
                    title="Maintenance work orders"
                    count={report.work_orders.length}
                >
                    <DataTable
                        empty="No work orders this week."
                        headers={[
                            '#',
                            'Defect',
                            'Status',
                            'Blocks dispatch',
                            'Completed',
                        ]}
                        rows={report.work_orders.map((o) => [
                            o.id,
                            o.defect ?? EMPTY,
                            o.status ?? EMPTY,
                            o.dispatch_blocking ? 'Yes' : 'No',
                            when(o.completed_at),
                        ])}
                    />
                </Section>
            </div>

            <p className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                <Download className="h-3 w-3" />
                Downloads contain exactly this data, generated on the server.
            </p>
        </>
    );
}
