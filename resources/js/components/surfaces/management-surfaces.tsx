import {
    Activity,
    AlertTriangle,
    ArchiveRestore,
    ChevronRight,
    DatabaseBackup,
    Download,
    Fuel,
    Gauge,
    MapPin,
    UserCog,
} from 'lucide-react';
import { useState } from 'react';
import {
    Button,
    DataPair,
    InlineNotice,
    PageHeading,
    Panel,
    ProgressBar,
    StatusBadge,
} from '@/components/ui';
import type {
    AppSection,
    AuditEvent,
    DispatchJob,
    FuelRequest,
    Resource,
} from '@/types/operations';

const prototypeUsers = [
    {
        name: 'Marco Villanueva',
        email: 'marco@ctms.example',
        role: 'Dispatcher',
        status: 'Active',
        lastSeen: 'Now',
    },
    {
        name: 'Dianne Santos',
        email: 'dianne@ctms.example',
        role: 'Operations Manager',
        status: 'Active',
        lastSeen: '4 min ago',
    },
    {
        name: 'Luis Ramos',
        email: 'luis@ctms.example',
        role: 'Driver',
        status: 'Active',
        lastSeen: '7 min ago',
    },
    {
        name: 'Mika Williams',
        email: 'mika@ctms.example',
        role: 'Crane Operator',
        status: 'Active',
        lastSeen: '12 min ago',
    },
    {
        name: 'Ana Dizon',
        email: 'ana@ctms.example',
        role: 'Field Technician',
        status: 'Invited',
        lastSeen: 'Invitation sent',
    },
];

export function AdministratorOverview({
    resources,
    auditEvents,
    onNavigate,
}: {
    resources: Resource[];
    auditEvents: AuditEvent[];
    onNavigate: (section: AppSection) => void;
}) {
    const attention = resources.filter(
        (resource) =>
            resource.status === 'Maintenance' || resource.status === 'Offline',
    );

    return (
        <div>
            <PageHeading
                title="System overview"
                description="Maintain platform access, registry quality, integration health, and recoverability."
                actions={
                    <Button variant="primary">
                        <UserCog className="h-4 w-4" aria-hidden="true" />
                        Invite user
                    </Button>
                }
            />
            <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
                <div className="space-y-4">
                    <Panel className="overflow-hidden">
                        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                            <div>
                                <h2 className="font-semibold text-ink">
                                    Platform health
                                </h2>
                                <p className="mt-0.5 text-xs text-ink-soft">
                                    Last checked two minutes ago
                                </p>
                            </div>
                            <StatusBadge status="Operational" />
                        </div>
                        <div className="divide-y divide-line">
                            {[
                                ['Laravel application', 'Operational', '36 ms'],
                                [
                                    'Queue processing',
                                    'Operational',
                                    '0 pending',
                                ],
                                ['GPS simulation', 'Operational', '5 assets'],
                                [
                                    'GPT Mini prototype',
                                    'Prototype',
                                    'Local draft',
                                ],
                                ['Nightly backup', 'Verified', 'Today, 02:12'],
                            ].map(([service, status, detail]) => (
                                <div
                                    key={service}
                                    className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_9rem_8rem] sm:items-center"
                                >
                                    <span className="font-medium text-ink">
                                        {service}
                                    </span>
                                    <StatusBadge status={status} />
                                    <span className="text-ink-soft sm:text-right">
                                        {detail}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    <Panel className="overflow-hidden">
                        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                            <div>
                                <h2 className="font-semibold text-ink">
                                    Registry readiness
                                </h2>
                                <p className="mt-0.5 text-xs text-ink-soft">
                                    Documents, certifications, and service state
                                </p>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => onNavigate('equipment')}
                            >
                                Open registries
                            </Button>
                        </div>
                        <div className="grid gap-5 p-4 sm:grid-cols-3">
                            <ProgressBar value={94} label="Fleet records" />
                            <ProgressBar value={91} label="Crane records" />
                            <ProgressBar
                                value={87}
                                label="People credentials"
                            />
                        </div>
                        <div className="border-t border-line px-4 py-3 text-sm text-ink-soft">
                            {attention.length === 0
                                ? 'No resources are currently marked offline or in maintenance.'
                                : `${attention.length} resources require administrative attention.`}
                        </div>
                    </Panel>
                </div>

                <Panel className="self-start overflow-hidden">
                    <div className="border-b border-line px-4 py-3">
                        <h2 className="font-semibold text-ink">
                            Recent administrative activity
                        </h2>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Auditable changes across the platform
                        </p>
                    </div>
                    <ol className="divide-y divide-line">
                        {auditEvents.slice(0, 5).map((event) => (
                            <li key={event.id} className="px-4 py-3">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft">
                                        <Activity
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-ink">
                                            {event.action}
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-ink-soft">
                                            {event.detail}
                                        </p>
                                        <p className="mt-1 text-xs text-muted">
                                            {event.actor} · {event.timestamp}
                                        </p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ol>
                </Panel>
            </div>
        </div>
    );
}

export function AdministrationSurface() {
    const [tab, setTab] = useState<'users' | 'rules'>('users');

    return (
        <div>
            <PageHeading
                title="Users & platform settings"
                description="Control access, dispatch policies, notifications, GPS retention, and prototype permissions."
                actions={
                    <Button variant="primary">
                        <UserCog className="h-4 w-4" aria-hidden="true" />
                        Invite user
                    </Button>
                }
            />
            <div className="p-4 md:p-6">
                <div className="mb-4 flex gap-1 rounded-lg bg-surface-subtle p-1 sm:w-fit">
                    <button
                        type="button"
                        onClick={() => setTab('users')}
                        className={`min-h-10 flex-1 rounded-md px-4 text-sm font-medium sm:flex-none ${tab === 'users' ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft'}`}
                    >
                        Users and roles
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('rules')}
                        className={`min-h-10 flex-1 rounded-md px-4 text-sm font-medium sm:flex-none ${tab === 'rules' ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft'}`}
                    >
                        Operational rules
                    </button>
                </div>

                {tab === 'users' ? (
                    <Panel className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[46rem] text-left">
                                <thead className="bg-surface-subtle text-xs text-ink-soft">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            User
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Role
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Status
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Last active
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Access
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {prototypeUsers.map((user) => (
                                        <tr key={user.email}>
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-semibold text-ink">
                                                    {user.name}
                                                </p>
                                                <p className="mt-0.5 text-xs text-ink-soft">
                                                    {user.email}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-ink-soft">
                                                {user.role}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge
                                                    status={user.status}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-sm text-ink-soft">
                                                {user.lastSeen}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Button
                                                    size="sm"
                                                    variant="quiet"
                                                >
                                                    Manage access
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                ) : (
                    <div className="grid gap-4 xl:grid-cols-2">
                        <Panel className="p-5">
                            <div className="flex items-center gap-3">
                                <Gauge
                                    className="h-5 w-5 text-brand"
                                    aria-hidden="true"
                                />
                                <h2 className="font-semibold text-ink">
                                    Dispatch controls
                                </h2>
                            </div>
                            <div className="mt-4 divide-y divide-line">
                                {[
                                    [
                                        'Require manager approval for emergency overrides',
                                        true,
                                    ],
                                    [
                                        'Allow GPT to prepare assignment changes',
                                        true,
                                    ],
                                    [
                                        'Allow GPT to apply changes automatically',
                                        false,
                                    ],
                                ].map(([label, checked]) => (
                                    <label
                                        key={String(label)}
                                        className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm text-ink"
                                    >
                                        <span>{String(label)}</span>
                                        <input
                                            type="checkbox"
                                            defaultChecked={Boolean(checked)}
                                            className="h-5 w-5 accent-brand"
                                        />
                                    </label>
                                ))}
                            </div>
                        </Panel>
                        <Panel className="p-5">
                            <div className="flex items-center gap-3">
                                <MapPin
                                    className="h-5 w-5 text-brand"
                                    aria-hidden="true"
                                />
                                <h2 className="font-semibold text-ink">
                                    GPS and notifications
                                </h2>
                            </div>
                            <dl className="mt-4 divide-y divide-line">
                                <DataPair
                                    label="GPS retention"
                                    value="90 days"
                                />
                                <DataPair
                                    label="Stale threshold"
                                    value="10 minutes"
                                />
                                <DataPair
                                    label="Emergency alerts"
                                    value="Push, email, and SMS"
                                />
                                <DataPair
                                    label="Field sharing"
                                    value="Active assignments only"
                                />
                            </dl>
                            <Button className="mt-4" variant="secondary">
                                Edit GPS policy
                            </Button>
                        </Panel>
                    </div>
                )}
            </div>
        </div>
    );
}

export function ManagerOverview({
    jobs,
    fuelRequests,
    onNavigate,
}: {
    jobs: DispatchJob[];
    fuelRequests: FuelRequest[];
    onNavigate: (section: AppSection) => void;
}) {
    const activeJobs = jobs.filter((job) =>
        ['Dispatched', 'En route', 'Arrived', 'In progress'].includes(
            job.status,
        ),
    );
    const pendingFuel = fuelRequests.filter(
        (request) => request.status === 'Pending',
    );

    return (
        <div className="relative isolate min-h-full">
            <div
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex transform-gpu overflow-hidden opacity-30"
                aria-hidden="true"
            >
                <div className="ml-[calc(50%-20rem)] aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-brand to-brand-soft opacity-40 blur-[100px]"></div>
            </div>

            <PageHeading
                title="Operations overview"
                description="Focus on exceptions, approvals, resource pressure, and today’s work in motion."
                actions={
                    <Button
                        variant="primary"
                        onClick={() => onNavigate('live')}
                    >
                        Open live operations
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                }
            />

            <div className="grid gap-6 p-4 md:p-6 xl:grid-cols-[1.5fr_1fr]">
                <div className="space-y-6">
                    <div className="relative overflow-hidden rounded-lg bg-surface p-6 shadow-sm ring-1 ring-line">
                        <div className="flex flex-col justify-between gap-6 border-b border-line pb-8 sm:flex-row sm:items-end">
                            <div>
                                <h2 className="text-sm font-semibold tracking-widest text-muted uppercase">
                                    Active Operations
                                </h2>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-6xl font-light tracking-tighter text-ink">
                                        {activeJobs.length}
                                    </span>
                                    <span className="text-lg font-medium text-ink-soft">
                                        / {jobs.length} total
                                    </span>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => onNavigate('board')}
                                className="shrink-0 rounded-full"
                            >
                                View full schedule
                            </Button>
                        </div>

                        <div className="space-y-3 pt-6">
                            {jobs.map((job) => (
                                <button
                                    key={job.id}
                                    type="button"
                                    onClick={() => onNavigate('board')}
                                    className="group relative flex w-full flex-col justify-between gap-4 rounded-lg p-4 text-left transition-all duration-300 hover:bg-surface-subtle hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none sm:flex-row sm:items-center"
                                >
                                    {[
                                        'In progress',
                                        'Dispatched',
                                        'En route',
                                    ].includes(job.status) && (
                                        <div className="absolute top-3 bottom-3 left-0 hidden w-1 rounded-r-full bg-brand opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                                    )}
                                    <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
                                        <div className="w-24 shrink-0 text-left sm:text-right">
                                            <p className="text-sm font-semibold text-ink transition-colors group-hover:text-brand">
                                                {job.reference}
                                            </p>
                                            <p className="mt-1 text-xs text-muted">
                                                {job.startTime}–{job.endTime}
                                            </p>
                                        </div>
                                        <div className="hidden h-10 w-px shrink-0 bg-line sm:block" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-base font-medium text-ink">
                                                {job.title}
                                            </p>
                                            <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted">
                                                <MapPin className="h-3 w-3 shrink-0" />
                                                <span className="truncate">
                                                    {job.site}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end">
                                        <StatusBadge status={job.priority} />
                                        <StatusBadge status={job.status} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-lg bg-surface p-6 shadow-sm ring-1 ring-line">
                        <h2 className="text-sm font-semibold tracking-widest text-muted uppercase">
                            Resource Pressure
                        </h2>
                        <p className="mt-1 text-xs text-muted">
                            Rolling 30-day utilization
                        </p>

                        <div className="mt-6 grid gap-5">
                            {[
                                { label: 'Cranes & equipment', value: 78 },
                                { label: 'Fleet', value: 80 },
                                { label: 'Field workforce', value: 82 },
                            ].map((stat) => (
                                <div key={stat.label}>
                                    <div className="mb-2 flex justify-between text-sm">
                                        <span className="font-medium text-ink">
                                            {stat.label}
                                        </span>
                                        <span className="text-muted">
                                            {stat.value}%
                                        </span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                                        <div
                                            className="h-full rounded-full bg-brand transition-all duration-1000 ease-out"
                                            style={{ width: `${stat.value}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-lg bg-surface p-6 shadow-sm ring-1 ring-line">
                        <h2 className="mb-6 text-sm font-semibold tracking-widest text-muted uppercase">
                            Action Required
                        </h2>

                        <div className="space-y-4">
                            <button
                                type="button"
                                onClick={() => onNavigate('fuel')}
                                className="group flex w-full items-start gap-4 rounded-lg border border-line p-4 text-left transition-all hover:border-warning hover:shadow-sm focus-visible:ring-2 focus-visible:ring-warning/50 focus-visible:outline-none"
                            >
                                <div className="rounded-full bg-warning-soft p-2 text-warning transition-transform group-hover:scale-110">
                                    <Fuel className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-ink transition-colors">
                                        {pendingFuel.length} fuel request
                                        awaiting approval
                                    </p>
                                    <p className="mt-1 text-xs text-muted">
                                        Earliest request: Today, 09:18
                                    </p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => onNavigate('dispatch')}
                                className="group flex w-full items-start gap-4 rounded-lg border border-line p-4 text-left transition-all hover:border-danger hover:shadow-sm focus-visible:ring-2 focus-visible:ring-danger/50 focus-visible:outline-none"
                            >
                                <div className="rounded-full bg-danger-soft p-2 text-danger transition-transform group-hover:scale-110">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-ink transition-colors">
                                        Emergency dispatch override
                                    </p>
                                    <p className="mt-1 text-xs text-muted">
                                        CON-1256 · Traffic support added
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => onNavigate('board')}
                        className="group w-full rounded-lg text-left focus-visible:ring-2 focus-visible:ring-warning/50 focus-visible:outline-none"
                    >
                        <InlineNotice tone="warning" title="Maintenance risk">
                            TR-03 is overdue for preventive service and remains
                            active on CON-1248. Confirm its return-to-yard time.
                        </InlineNotice>
                    </button>
                </div>
            </div>
        </div>
    );
}

export function ReportsSurface({
    resources,
    auditEvents,
    administrator = false,
}: {
    resources: Resource[];
    auditEvents: AuditEvent[];
    administrator?: boolean;
}) {
    const [restoreArmed, setRestoreArmed] = useState(false);
    const utilization = [72, 78, 68, 82, 75, 86, 80];

    return (
        <div>
            <PageHeading
                title={
                    administrator ? 'Audit & backups' : 'Performance reports'
                }
                description={
                    administrator
                        ? 'Review sensitive changes and confirm that recovery data remains usable.'
                        : 'Compare dispatch reliability, utilization, safety completion, and fuel performance.'
                }
                actions={
                    <Button variant="secondary">
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Export report
                    </Button>
                }
            />
            <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
                <div className="space-y-4">
                    {!administrator && (
                        <Panel className="p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="font-semibold text-ink">
                                        Seven-day equipment utilization
                                    </h2>
                                    <p className="mt-0.5 text-xs text-ink-soft">
                                        Active hours divided by available hours
                                    </p>
                                </div>
                                <StatusBadge status="80% average" />
                            </div>
                            <div className="mt-6 grid h-52 grid-cols-7 items-end gap-3 border-b border-line px-2">
                                {utilization.map((value, index) => (
                                    <div
                                        key={index}
                                        className="flex h-full flex-col items-center justify-end gap-2"
                                    >
                                        <span className="text-xs font-medium text-ink-soft">
                                            {value}%
                                        </span>
                                        <div
                                            className="w-full max-w-12 rounded-t-md bg-brand"
                                            style={{ height: `${value}%` }}
                                        />
                                        <span className="pb-2 text-xs text-ink-soft">
                                            {
                                                [
                                                    'Fri',
                                                    'Sat',
                                                    'Sun',
                                                    'Mon',
                                                    'Tue',
                                                    'Wed',
                                                    'Thu',
                                                ][index]
                                            }
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    )}

                    <Panel className="overflow-hidden">
                        <div className="border-b border-line px-4 py-3">
                            <h2 className="font-semibold text-ink">
                                {administrator
                                    ? 'Audit trail'
                                    : 'Operational indicators'}
                            </h2>
                        </div>
                        {administrator ? (
                            <div className="divide-y divide-line">
                                {auditEvents.map((event) => (
                                    <div
                                        key={event.id}
                                        className="grid gap-2 px-4 py-3 sm:grid-cols-[10rem_1fr_8rem]"
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-ink">
                                                {event.actor}
                                            </p>
                                            <p className="mt-0.5 text-xs text-ink-soft">
                                                {event.timestamp}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-ink">
                                                {event.action}
                                            </p>
                                            <p className="mt-0.5 text-xs text-ink-soft">
                                                {event.detail}
                                            </p>
                                        </div>
                                        <StatusBadge status="Recorded" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="divide-y divide-line">
                                {[
                                    [
                                        'Dispatches completed on schedule',
                                        '92%',
                                        'Up 4 points',
                                    ],
                                    [
                                        'Safety checklist completion',
                                        '98%',
                                        'Within target',
                                    ],
                                    [
                                        'Average resource utilization',
                                        '80%',
                                        'Healthy capacity',
                                    ],
                                    [
                                        'Fuel variance vs baseline',
                                        '+3.2%',
                                        'TR-03 requires review',
                                    ],
                                ].map(([label, value, note]) => (
                                    <div
                                        key={label}
                                        className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_6rem_10rem] sm:items-center"
                                    >
                                        <span className="text-sm font-medium text-ink">
                                            {label}
                                        </span>
                                        <span className="text-lg font-semibold text-ink">
                                            {value}
                                        </span>
                                        <span className="text-xs text-ink-soft">
                                            {note}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>
                </div>

                <div className="space-y-4">
                    <Panel className="p-4">
                        <h2 className="font-semibold text-ink">
                            Resource snapshot
                        </h2>
                        <div className="mt-4 space-y-4">
                            <ProgressBar
                                value={Math.round(
                                    resources.reduce(
                                        (sum, item) => sum + item.utilization,
                                        0,
                                    ) / resources.length,
                                )}
                                label="Overall utilization"
                            />
                            <ProgressBar value={94} label="Availability" />
                            <ProgressBar
                                value={91}
                                label="Credential readiness"
                            />
                        </div>
                    </Panel>

                    {administrator && (
                        <Panel className="p-4">
                            <div className="flex items-center gap-3">
                                <DatabaseBackup
                                    className="h-5 w-5 text-success"
                                    aria-hidden="true"
                                />
                                <div>
                                    <h2 className="font-semibold text-ink">
                                        Recovery status
                                    </h2>
                                    <p className="mt-0.5 text-xs text-ink-soft">
                                        Last verified today at 02:12
                                    </p>
                                </div>
                            </div>
                            <InlineNotice
                                tone="success"
                                title="Backup verified"
                            >
                                The latest nightly snapshot passed its integrity
                                check.
                            </InlineNotice>
                            <div className="mt-4 space-y-2">
                                <Button className="w-full" variant="secondary">
                                    Create manual backup
                                </Button>
                                {!restoreArmed ? (
                                    <Button
                                        className="w-full"
                                        variant="quiet"
                                        onClick={() => setRestoreArmed(true)}
                                    >
                                        <ArchiveRestore
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                        Prepare restore
                                    </Button>
                                ) : (
                                    <div className="rounded-lg bg-danger-soft p-3">
                                        <p className="text-sm font-semibold text-danger">
                                            Restore the latest verified backup?
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-red-800">
                                            This prototype action is guarded and
                                            does not change data.
                                        </p>
                                        <div className="mt-3 flex gap-2">
                                            <Button size="sm" variant="danger">
                                                Restore backup
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() =>
                                                    setRestoreArmed(false)
                                                }
                                            >
                                                Keep current data
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Panel>
                    )}
                </div>
            </div>
        </div>
    );
}
