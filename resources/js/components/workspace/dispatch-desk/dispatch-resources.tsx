import { Link } from '@inertiajs/react';
import { Search, Truck, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { humanize, formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    DispatchJobViewModel,
    WorkspaceUserViewModel,
} from '@/types/workspace';
import { HISTORY_STATUSES, jobOverlapsDate } from './dispatch-desk-helpers';

export function resourceCommitments(
    jobs: DispatchJobViewModel[],
    kind: 'people' | 'assets',
    id: number,
    date: string,
) {
    return jobs.filter(
        (job) =>
            !HISTORY_STATUSES.some((status) => status === job.status.value) &&
            (!job.scheduled_start ||
                !job.scheduled_end ||
                jobOverlapsDate(job, date)) &&
            (kind === 'people'
                ? job.personnel_assignments.some(
                      (assignment) => assignment.user_id === id,
                  )
                : job.asset_assignments.some(
                      (assignment) => assignment.operational_asset_id === id,
                  )),
    );
}

export function hasResourceOverlap(jobs: DispatchJobViewModel[]) {
    return jobs.some((first, index) =>
        jobs.slice(index + 1).some((second) => {
            if (
                !first.scheduled_start ||
                !first.scheduled_end ||
                !second.scheduled_start ||
                !second.scheduled_end
            ) {
                return false;
            }

            return (
                new Date(first.scheduled_start).getTime() <
                    new Date(second.scheduled_end).getTime() &&
                new Date(second.scheduled_start).getTime() <
                    new Date(first.scheduled_end).getTime()
            );
        }),
    );
}

export function DispatchResources({
    users,
    assets,
    jobs,
    initialDate,
    returnTo,
    refreshing,
}: {
    users: WorkspaceUserViewModel[];
    assets: AssetViewModel[];
    jobs: DispatchJobViewModel[];
    initialDate: string;
    returnTo: string;
    refreshing: boolean;
}) {
    const [kind, setKind] = useState<'people' | 'assets'>('people');
    const [query, setQuery] = useState('');
    const [date, setDate] = useState(initialDate);
    const rows = useMemo(() => {
        const people = users
            .filter(
                (user) =>
                    [
                        'driver',
                        'crane_operator',
                        'rigger',
                        'field_foreman',
                    ].includes(user.role ?? '') ||
                    user.profile ||
                    (user.credentials?.length ?? 0) > 0,
            )
            .map((user) => ({
                id: user.id,
                name: user.name,
                detail: user.role_label ?? humanize(user.role ?? 'Personnel'),
                status:
                    !user.is_active || user.suspended_at
                        ? 'Account unavailable'
                        : user.profile?.availability_status
                          ? `Availability: ${humanize(user.profile.availability_status)}`
                          : 'Availability not recorded',
                warning:
                    !user.is_active ||
                    Boolean(user.suspended_at) ||
                    Boolean(
                        user.profile?.availability_status &&
                        user.profile.availability_status !== 'available',
                    ),
            }));
        const equipment = assets.map((asset) => ({
            id: asset.id,
            name: `${asset.code} · ${asset.name}`,
            detail: humanize(asset.subtype ?? asset.kind),
            status:
                asset.blocking_work_orders_count > 0
                    ? 'Maintenance blocks dispatch'
                    : !asset.is_dispatchable
                      ? `Not dispatchable · ${asset.status.label}`
                      : `Recorded status: ${asset.status.label}`,
            warning:
                !asset.is_dispatchable || asset.blocking_work_orders_count > 0,
        }));
        const term = query.trim().toLowerCase();

        return (kind === 'people' ? people : equipment)
            .filter((row) =>
                `${row.name} ${row.detail} ${row.status}`
                    .toLowerCase()
                    .includes(term),
            )
            .map((row) => ({
                ...row,
                commitments: resourceCommitments(jobs, kind, row.id, date),
            }));
    }, [assets, users, jobs, kind, query, date]);

    return (
        <section
            id="dispatch-resources"
            aria-labelledby="dispatch-resources-heading"
            aria-busy={refreshing}
            className="border-b border-line bg-surface px-5 py-5 lg:px-7"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2
                        id="dispatch-resources-heading"
                        className="text-lg font-semibold text-ink"
                    >
                        People &amp; assets
                    </h2>
                    <p className="mt-1 max-w-3xl text-sm text-ink-soft">
                        Recorded availability and commitments for the selected
                        resource date. Open a dispatch to check eligibility and
                        assign resources.
                    </p>
                </div>
                <label className="text-xs text-ink-soft">
                    Resource date
                    <input
                        aria-label="Resource date"
                        type="date"
                        value={date}
                        onChange={(event) => {
                            if (event.target.value) {
                                setDate(event.target.value);
                            }
                        }}
                        className="mt-1 block min-h-11 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink"
                    />
                </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <div
                    role="group"
                    aria-label="Resource type"
                    className="flex gap-1 rounded-lg border border-line p-1"
                >
                    {(['people', 'assets'] as const).map((value) => {
                        const Icon = value === 'people' ? Users : Truck;

                        return (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={kind === value}
                                onClick={() => setKind(value)}
                                className={cn(
                                    'inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                                    kind === value
                                        ? 'bg-brand-soft text-ink'
                                        : 'text-ink-soft hover:bg-surface-subtle',
                                )}
                            >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                                {value === 'people' ? 'People' : 'Assets'}
                            </button>
                        );
                    })}
                </div>
                <label className="relative min-w-0 flex-1 sm:max-w-sm">
                    <Search
                        className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-ink-soft"
                        aria-hidden="true"
                    />
                    <input
                        aria-label="Search people and assets"
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search name, role, or asset"
                        className="min-h-11 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-soft"
                    />
                </label>
                <p className="text-xs text-ink-soft" role="status">
                    {refreshing
                        ? 'Refreshing resources…'
                        : `${rows.length} matching ${kind}`}
                </p>
            </div>
            <p className="mt-3 text-xs text-ink-soft">
                Only loaded, permitted records are shown. No listed commitment
                does not confirm availability; reservations and safety are
                checked during assignment.
            </p>
            <div
                tabIndex={0}
                role="region"
                aria-label="Resource results"
                className="mt-3 max-h-96 overflow-y-auto rounded-lg border border-line focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
                {rows.length === 0 ? (
                    <p className="p-5 text-sm text-ink-soft">
                        {refreshing
                            ? 'Loading resources…'
                            : query
                              ? 'No matches. Try another name, role, or asset code.'
                              : `No ${kind === 'people' ? 'personnel' : 'asset'} records are loaded for your access.`}
                    </p>
                ) : (
                    <ul className="divide-y divide-line">
                        {rows.map((row) => (
                            <li
                                key={row.id}
                                className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold break-words text-ink">
                                        {row.name}
                                    </p>
                                    <p className="mt-1 text-xs text-ink-soft">
                                        {row.detail}
                                    </p>
                                    <p
                                        className={cn(
                                            'mt-1 text-xs',
                                            row.warning
                                                ? 'text-warning-strong'
                                                : 'text-ink-soft',
                                        )}
                                    >
                                        {row.status}
                                    </p>
                                </div>
                                <div className="min-w-0 text-xs text-ink-soft">
                                    {hasResourceOverlap(row.commitments) && (
                                        <p className="mb-1 font-semibold text-danger-strong">
                                            Overlapping assignments
                                        </p>
                                    )}
                                    {row.commitments.length === 0 ? (
                                        <p>
                                            No commitments in loaded dispatches
                                        </p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {row.commitments.map((job) => (
                                                <li key={job.id}>
                                                    <Link
                                                        className="inline-flex min-h-11 items-center font-semibold text-ink underline decoration-brand underline-offset-2"
                                                        href={`/operations/dispatch-jobs/${job.id}?${new URLSearchParams({ return_to: returnTo })}`}
                                                    >
                                                        {job.reference} ·{' '}
                                                        {job.site}
                                                    </Link>
                                                    <p>
                                                        {job.scheduled_start &&
                                                        job.scheduled_end
                                                            ? `${formatDateTime(job.scheduled_start)} – ${formatDateTime(job.scheduled_end)}`
                                                            : 'Schedule incomplete — review commitment'}
                                                    </p>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
